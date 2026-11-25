const express = require('express');
const rateLimit = require('express-rate-limit');
const knowledge = require('../knowledge/papertradex.json');
const vectors = require('../services/RagVectors');
const { retrieve } = require('../services/RagRetrieval');
const generator = require('../services/RagGenerator');
const { calculateTradePerformance } = require('../services/TradingCoach');
const { buildPortfolioSnapshot } = require('../services/RagPortfolio');
const { validateHistory, conversationContext } = require('../services/RagConversation');
const policy = require('../services/FinancialPolicy');
const { parseCalculation } = require('../services/FinancialMath');

module.exports = function ragRouter({ authenticateToken, RagVector, TransactionHistory, getPortfolioAccount, getQuote, getMarketContext, grounding, generation = generator,
    enabled = () => process.env.RAG_ENABLED !== 'false' }) {
    const router = express.Router();
    router.use(authenticateToken);
    router.use((req, res, next) => {
        res.set('Cache-Control', 'private, no-store');
        if (!enabled()) return res.status(503).json({ error: 'Knowledge assistant is unavailable.' });
        next();
    });
    const limit = rateLimit({ windowMs: 15 * 60000, max: 20, keyGenerator: req => String(req.user.id),
        standardHeaders: true, legacyHeaders: false, message: { error: 'Please wait before sending more questions or documents.' } });
    router.get('/config', (req, res) => res.json({ enabled: true, generationAvailable: generation.configured(),
        provider: generation.provider?.() || null,
        retrieval: vectors.configured() ? 'hybrid-capable' : 'keyword', vectorAvailable: vectors.configured() }));
    router.get('/sources', (req, res) => res.json({ sources: knowledge.map(d => ({ id: d.id, title: d.title, scope: d.scope || 'public', referenceUrl: d.referenceUrl || null })) }));
    router.all(['/documents', '/documents/:id'], (req, res) => res.status(410).json({ error: 'User document uploads are disabled. The knowledge library is managed by PaperTradeX.' }));
    router.post('/index', limit, async (req, res) => {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Administrator access required.' });
        if (!vectors.configured() || !RagVector) return res.status(503).json({ error: 'Configure Gemini vector search before indexing.' });
        try { res.json(await vectors.index(knowledge, RagVector)); }
        catch { res.status(503).json({ error: 'Indexing unavailable. Try again; keyword search remains available.' }); }
    });
    router.post('/ask', limit, async (req, res) => {
        const { question, includePerformance = false, includePortfolio = false, history = [] } = req.body || {};
        if (typeof question !== 'string' || !question.trim() || question.length > 2000 || typeof includePerformance !== 'boolean' || typeof includePortfolio !== 'boolean') return res.status(400).json({ error: 'Enter a question up to 2,000 characters and valid account options.' });
        if (!validateHistory(history)) return res.status(400).json({ error: 'Chat context must contain up to four user/assistant pairs, each up to 1,000 characters.' });
        const context = conversationContext(question, history);
        const { accountQuestion, retrievalQuestion } = context;
        if (policy.adviceQuestion(question)) return res.json({ mode: 'no_sources', answer: 'I cannot recommend buying, selling, holding or switching a specific investment. I can provide verified factual data, objective comparisons and documented regulatory rules.', sources: [], performance: null, portfolio: null });
        if (context.needsClarification) return res.json({ mode: 'no_sources', answer: 'What topic or example are you referring to? This is a new chat, so please tell me what you would like to continue discussing.', sources: [], performance: null, portfolio: null });
        if (accountQuestion && !includePortfolio) return res.json({ mode: 'no_sources', answer: 'Enable account context in Answer options to answer from your actual holdings, available balance and returns.', sources: [], performance: null, portfolio: null });
        const usePortfolio = includePortfolio && accountQuestion;
        try {
            let performance = null;
            let portfolio = null;
            let portfolioCalculation = null;
            if (includePerformance || usePortfolio) {
                const trades = await TransactionHistory.find({ user: req.user.id }).select('type symbol quantity price totalAmount createdAt').sort({ createdAt: 1, _id: 1 }).limit(20001).lean();
                if (trades.length > 20000) return res.status(422).json({ error: 'Trade history exceeds the supported report size.' });
                // Validate the executed ledger before using it for any account return.
                const calculated = calculateTradePerformance(trades, { includeDetails: usePortfolio });
                if (includePerformance) performance = calculated.metrics;
                if (usePortfolio) {
                    if (!getPortfolioAccount || !getQuote || !getMarketContext) throw Error('Portfolio connection unavailable');
                    const account = await getPortfolioAccount(req.user.id);
                    const key = require('../services/QuoteIdentity').quoteKey;
                    const ledger = new Map(calculated.positions.map(p => [key(p.symbol), p.quantity]));
                    if (account.holdings.length !== ledger.size || account.holdings.some(h => ledger.get(key(h.symbol)) !== h.quantity)) throw Error('Account changed or history incomplete');
                    portfolio = await buildPortfolioSnapshot(account, trades,
                        { getQuote, ...getMarketContext() });
                    if (/\bxirr\b/i.test(question) && grounding && portfolio.currentValue !== null) {
                        const daily = new Map();
                        trades.forEach(t => { const date = new Date(Date.parse(t.createdAt) + 330 * 60000).toISOString().slice(0, 10); daily.set(date, (daily.get(date) || 0) + (t.type === 'BUY' ? -t.totalAmount : t.totalAmount)); });
                        const date = new Date(Date.parse(portfolio.capturedAt) + 330 * 60000).toISOString().slice(0, 10);
                        daily.set(date, (daily.get(date) || 0) + portfolio.currentValue);
                        try { portfolioCalculation = grounding.executeFinancialMath({ operation: 'xirr', flows: [...daily].map(([date, amount]) => ({ date, amount })) }); }
                        catch { portfolioCalculation = { operation: 'xirr', value: null, reason: 'No reliable XIRR solution is available for the supported cash-flow history.', calculatedAt: portfolio.capturedAt }; }
                    }
                }
            }
            const overviewQuestion = /\b(?:portfolio (?:status|overview|summary|breakdown|report)|(?:show|summarize|summarise) (?:me )?my (?:current )?portfolio|how is my portfolio doing|(?:what|how) (?:is|are) my (?:current )?portfolio(?=\s*(?:[?.!]|$)))\b/i;
            if (portfolio && overviewQuestion.test(question)) {
                return res.json({ mode: 'portfolio_report', answer: 'Here’s your paper portfolio breakdown.', sources: [], portfolio, performance });
            }
            // Account facts are direct structured retrieval; don't pay for an unnecessary query embedding.
            const retrieval = accountQuestion ? { passages: retrieve(retrievalQuestion, knowledge, 2), method: 'account+keyword' } : await vectors.search(retrievalQuestion, knowledge, RagVector);
            const selected = policy.currentVersions(retrieval.passages);
            const symbols = grounding?.resolveSymbols(retrievalQuestion) || [];
            const asksNews = /\b(news|sentiment|filings?|announcements?|quarterly results|earnings)\b/i.test(question);
            const asksRegulatory = /\b(tax (rate|slab|rules?)|capital gains tax|sebi circular|rbi circular|current.*expense ratio)\b/i.test(question);
            if (asksRegulatory && !selected.some(s => s.documentType === 'regulatory' && s.effectiveDate)) return res.json({ mode: 'no_sources', answer: policy.UNVERIFIED, sources: [], performance, portfolio });
            if (grounding && /\b(my|our)\b.*\bwatchlist\b/i.test(retrievalQuestion)) {
                if (!includePortfolio) return res.json({ mode: 'no_sources', answer: 'Enable account context to answer from your synced watchlist.', sources: [], portfolio: null, performance: null });
                const watchlist = await grounding.fetchUserWatchlist(req.user.id, { includeQuotes: false });
                selected.unshift({ id: 'account-watchlist', title: 'Verified account watchlist', scope: 'account', text: JSON.stringify(watchlist), observedAt: new Date().toISOString() });
            }
            if (asksNews) {
                const disclosures = grounding ? await Promise.all(symbols.slice(0, 2).map(symbol => grounding.fetchCompanyDisclosures(symbol))) : [];
                const available = disclosures.filter(d => d.available);
                if (!available.length) return res.json({ mode: 'no_sources', answer: policy.UNVERIFIED, sources: [], performance, portfolio });
                available.forEach(d => selected.unshift({ id: 'exchange-disclosures', title: 'NSE corporate announcement titles', scope: 'market', observedAt: d.fetchedAt, text: JSON.stringify(d) }));
            }
            const calculation = parseCalculation(question);
            if (calculation && grounding) {
                const result = grounding.executeFinancialMath(calculation);
                selected.unshift({ id: 'tool-calculation', title: 'Server financial calculation', scope: 'calculation', observedAt: result.calculatedAt, text: JSON.stringify(result) });
            }
            if (portfolioCalculation) selected.unshift({ id: 'tool-calculation', title: 'Server XIRR calculation', scope: 'calculation', observedAt: portfolioCalculation.calculatedAt, text: JSON.stringify(portfolioCalculation) });
            if (performance) selected.unshift({ id: 'account-performance', title: 'Your completed paper trades', url: '/trading-coach', scope: 'account', observedAt: new Date().toISOString(),
                text: 'Server-calculated performance snapshot. Each sell execution is one completed sale. No completed sales means win rate is unavailable. ' + JSON.stringify(performance) });
            if (portfolio) selected.unshift({ id: 'account-portfolio', title: 'Your actual paper portfolio snapshot', url: '/holdings', scope: 'account', observedAt: portfolio.capturedAt, text: JSON.stringify(portfolio) });
            const sources = selected.slice(0, 7).map((source, i) => ({ citation: `S${i + 1}`, id: source.id, title: source.title,
                url: source.url, referenceUrl: source.referenceUrl, scope: source.scope, text: source.text,
                section: source.section, effectiveDate: source.effectiveDate || null, reviewedAt: source.reviewedAt || null,
                observedAt: source.observedAt || null, documentType: source.documentType }));
            if (!sources.length) return res.json({ mode: 'no_sources', answer: policy.UNVERIFIED, sources: [], performance, portfolio });
            let answer = null;
            if (generation.configured()) {
                try { answer = await generation.generate(question.trim(), sources, { history: context.history, accountQuestion }); }
                catch (error) {
                    // Constant-only diagnostics: never log questions, account snapshots or provider response bodies.
                    const known = ['AI provider unavailable', 'Incomplete AI answer', 'Unsupported AI citations', 'Missing account citation', 'Unsupported numerical claim', 'Missing sentence citation'];
                    console.warn('[RAG generation]', known.includes(error.message) ? error.message : 'Invalid or unavailable response', Number(error.status) || '');
                }
            }
            res.json({ mode: answer ? 'generated' : 'unavailable', retryable: !answer, basis: answer?.basis || null, provider: answer?.provider || null,
                answer: answer ? policy.cleanChatAnswer(answer.answer) : (portfolio ? 'I couldn’t finish the AI explanation. Your verified portfolio snapshot is available below. Retry the answer to continue this conversation.' : 'I couldn’t generate an answer right now. Please retry; your question and conversation context are saved in this chat.'),
                sources, performance, portfolio, retrieval: retrieval.method, generatedAt: new Date().toISOString() });
        } catch { res.status(503).json({ error: usePortfolio ? 'Unable to load a reliable portfolio snapshot. Refresh and try again, or ask a general education question.' : 'Unable to search your sources. Please try again.' }); }
    });
    return router;
};
