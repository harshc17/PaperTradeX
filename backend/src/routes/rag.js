const express = require('express');
const rateLimit = require('express-rate-limit');
const knowledge = require('../knowledge/papertradex.json');
const vectors = require('../services/RagVectors');
const { retrieve } = require('../services/RagRetrieval');
const generator = require('../services/RagGenerator');
const { calculateTradePerformance } = require('../services/TradingCoach');
const { buildPortfolioSnapshot } = require('../services/RagPortfolio');
const { portfolioQuestion } = require('../services/RagIntent');

module.exports = function ragRouter({ authenticateToken, RagVector, TransactionHistory, getPortfolioAccount, getQuote, getMarketContext, generation = generator,
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
        const { question, includePerformance = false, includePortfolio = false } = req.body || {};
        if (typeof question !== 'string' || !question.trim() || question.length > 2000 || typeof includePerformance !== 'boolean' || typeof includePortfolio !== 'boolean') return res.status(400).json({ error: 'Enter a question up to 2,000 characters and valid account options.' });
        const accountQuestion = portfolioQuestion(question);
        if (accountQuestion && !includePortfolio) return res.json({ mode: 'no_sources', answer: 'Enable the portfolio option below to answer from your actual holdings, available balance and returns.', sources: [], performance: null, portfolio: null });
        const usePortfolio = includePortfolio && accountQuestion;
        try {
            let performance = null;
            let portfolio = null;
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
                }
            }
            // Account facts are direct structured retrieval; don't pay for an unnecessary query embedding.
            const retrieval = accountQuestion ? { passages: retrieve(question, knowledge, 2), method: 'account+keyword' } : await vectors.search(question, knowledge, RagVector);
            const selected = retrieval.passages;
            if (performance) selected.unshift({ id: 'account-performance', title: 'Your completed paper trades', url: '/trading-coach', scope: 'account',
                text: 'Server-calculated performance snapshot. Each sell execution is one completed sale. No completed sales means win rate is unavailable. ' + JSON.stringify(performance) });
            if (portfolio) selected.unshift({ id: 'account-portfolio', title: 'Your actual paper portfolio snapshot', url: '/holdings', scope: 'account', text: JSON.stringify(portfolio) });
            const sources = selected.slice(0, 7).map((source, i) => ({ citation: `S${i + 1}`, id: source.id, title: source.title,
                url: source.url, referenceUrl: source.referenceUrl, scope: source.scope, text: source.text }));
            let answer = null;
            if (generation.configured()) {
                try { answer = await generation.generate(question.trim(), sources); } catch { /* Keep source retrieval usable during provider outages. */ }
            }
            res.json({ mode: answer ? 'generated' : sources.length ? 'retrieval' : 'no_sources', basis: answer?.basis || null, provider: answer?.provider || null,
                answer: answer?.answer || (portfolio ? 'Here is your actual portfolio snapshot [S1]. These values are calculated by PaperTradeX; an AI explanation has not been generated.' : sources.length ? 'Here are the closest matching source passages. An AI answer has not been generated.' : 'No matching sources were found. Conversational finance answers need an enabled OpenAI or Gemini API key; the education library is managed by PaperTradeX.'),
                sources, performance, portfolio, retrieval: retrieval.method, generatedAt: new Date().toISOString() });
        } catch { res.status(503).json({ error: usePortfolio ? 'Unable to load a reliable portfolio snapshot. Refresh and try again, or ask a general education question.' : 'Unable to search your sources. Please try again.' }); }
    });
    return router;
};
