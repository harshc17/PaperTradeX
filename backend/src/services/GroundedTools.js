const { quoteKey, quoteTime } = require('./QuoteIdentity');
const { calculateTradePerformance } = require('./TradingCoach');
const { buildPortfolioSnapshot } = require('./RagPortfolio');
const { executeFinancialMath } = require('./FinancialMath');
const { retrieve } = require('./RagRetrieval');
const { documents: knowledge } = require('../knowledge');
const { trailingPE } = require('./StockValuation');
const indices = [
    { symbol: '^NSEI', shortname: 'NIFTY 50' }, { symbol: '^BSESN', shortname: 'SENSEX' },
    { symbol: '^NSEBANK', shortname: 'BANKNIFTY' }, { symbol: '^MIDCPNIFTY', shortname: 'MIDCPNIFTY' },
    { symbol: '^FINNIFTY', shortname: 'FINNIFTY' }, { symbol: '^BANKEX', shortname: 'BANKEX' },
];
module.exports = function createTools({ TransactionHistory, getPortfolioAccount, getQuote, getMarketContext, User, catalogue = [], getDisclosures, getFundamentals = async () => null, getEarnings, getExchangePE, searchInstruments = async () => [] }) {
    const instruments = [...catalogue, ...indices];
    function resolveSymbols(question) {
        const text = question.toUpperCase();
        return instruments.filter(item => [item.symbol, item.symbol.replace(/\.NS$/, ''), item.shortname].some(value =>
            value && new RegExp(`(^|[^A-Z0-9])${value.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Z0-9]|$)`).test(text))).map(item => item.symbol).slice(0, 8);
    }
    async function findListedInstrument(subject) {
        const key = subject.trim().toUpperCase();
        if (!/^[A-Z0-9][ A-Z0-9&.'’-]{0,69}$/.test(key)) return null;
        const local = catalogue.filter(item => [item.symbol, item.symbol.replace(/\.NS$/, ''), item.shortname?.toUpperCase()].includes(key));
        if (local.length === 1) return local[0];
        if (local.length > 1) return null;
        const results = await searchInstruments(subject).catch(() => []);
        const matches = results.filter(item => /^[A-Z0-9&.-]{1,30}\.(NS|BO)$/.test(item.symbol || '') &&
            ['EQUITY', 'ETF'].includes(item.quoteType) &&
            [item.symbol, item.symbol.replace(/\.(NS|BO)$/, ''), item.shortname?.toUpperCase(), item.longname?.toUpperCase()].includes(key));
        return matches.length === 1 ? matches[0] : matches.find(item => item.symbol === `${key}.NS`) || null;
    }
    async function fetchStockValuation(question, { signal } = {}) {
        const normalized = question.replace(/\brelaince\b/gi, 'Reliance');
        const subject = normalized.replace(/[?!.]+$/, '').trim()
            .replace(/\s*(?:[?,.]|\band\b)?\s*should (?:i|we)\b.*$/i, '')
            .replace(/^(?:what (?:is|are)|what['’]s|show(?: me)?|give me|tell me|check)\s+(?:the\s+)?/i, '');
        const term = '(?:trailing\\s+)?(?:p\\s*\\/\\s*e(?:\\s+ratio)?|pe\\s+ratio|price[- ]to[- ]earnings(?:\\s+ratio)?)';
        const name = subject.match(new RegExp(`^${term}\\s+(?:of|for)\\s+(.+)$`, 'i'))?.[1] ||
            subject.match(new RegExp(`^(.+?)\\s+${term}$`, 'i'))?.[1];
        const candidate = name && await findListedInstrument(name.replace(/['’]s$/i, ''));
        const symbols = candidate ? [candidate.symbol] : resolveSymbols(normalized);
        const company = symbols.length === 1 && (candidate || catalogue.find(item => item.symbol === symbols[0]));
        if (!company || !['EQUITY', 'ETF'].includes(company.quoteType)) return null;
        const { symbol, quoteType } = company;
        const label = company.shortname || company.longname || symbol;
        if (quoteType === 'ETF') {
            return { symbol, name: label, quoteType, market: (await fetchLiveMarketData([symbol])).quotes[0] };
        }
        return { symbol, name: label, quoteType, valuation: await trailingPE(symbol, {
            getQuote, getFundamentals, getEarnings: getEarnings && (ticker => getEarnings(ticker, signal)),
            getExchangePE: getExchangePE && (ticker => getExchangePE(ticker, signal)),
        }) };
    }
    async function fetchUserPortfolio(userId) {
        const trades = await TransactionHistory.find({ user: userId }).select('type symbol quantity price totalAmount createdAt').sort({ createdAt: 1, _id: 1 }).limit(20001).lean();
        if (trades.length > 20000) throw Error('Trade history exceeds the supported report size.');
        const performance = calculateTradePerformance(trades, { includeDetails: true });
        const account = await getPortfolioAccount(userId);
        const positions = new Map(performance.positions.map(p => [quoteKey(p.symbol), p.quantity]));
        if (account.holdings.length !== positions.size || account.holdings.some(h => positions.get(quoteKey(h.symbol)) !== h.quantity)) throw Error('Account changed or history incomplete');
        const portfolio = await buildPortfolioSnapshot(account, trades, { getQuote, ...getMarketContext() });
        return { portfolio, performance: performance.metrics };
    }
    async function fetchLiveMarketData(symbols) {
        if (!Array.isArray(symbols) || !symbols.length || symbols.length > 20 || symbols.some(s => typeof s !== 'string' || !/^[A-Z0-9^.&-]{1,30}$/.test(s))) throw Error('Provide 1–20 valid symbols.');
        const market = getMarketContext();
        const quotes = await Promise.all([...new Set(symbols)].map(async symbol => {
            let q; try { q = await getQuote(symbol); } catch { /* Unavailable is explicit. */ }
            const at = quoteTime(q?.timestamp);
            const valid = Number.isFinite(q?.price) && q.price > 0 && Number.isFinite(at) && at <= Date.now() + 5000;
            const previousClose = valid && Number.isFinite(q.prevClose) && q.prevClose > 0 ? q.prevClose : null;
            const change = previousClose === null ? null : Number((q.price - previousClose).toFixed(2));
            return { symbol: quoteKey(symbol), price: valid ? q.price : null, previousClose, change,
                changePercent: change === null ? null : Number((change / previousClose * 100).toFixed(4)),
                observedAt: valid ? new Date(at).toISOString() : null,
                status: !valid ? 'unavailable' : !market.marketOpen ? 'market_closed' : Date.now() - at > 60000 ? 'delayed' : 'latest_available' };
        }));
        return { capturedAt: new Date().toISOString(), ...market, quotes };
    }
    async function fetchUserWatchlist(userId, { includeQuotes = true } = {}) {
        const user = User ? await User.findById(userId).select('watchlistSymbols').lean() : null;
        const symbols = user?.watchlistSymbols;
        if (!Array.isArray(symbols)) return { available: false, reason: 'No account-synced watchlist is available.' };
        return { available: true, symbols, quotesLimitedTo: 20, quotesTruncated: includeQuotes && symbols.length > 20, marketData: includeQuotes && symbols.length ? await fetchLiveMarketData(symbols.slice(0, 20)) : null };
    }
    async function fetchCompanyDisclosures(symbol) {
        if (typeof symbol !== 'string' || !/^[A-Z0-9&-]{1,25}(\.NS)?$/.test(symbol) || !getDisclosures) return { available: false, reason: 'Verified exchange disclosures are unavailable for this instrument.' };
        try { return await getDisclosures(symbol.replace(/\.NS$/, '')); }
        catch { return { available: false, reason: 'Exchange disclosure feed is unavailable. No news or sentiment is inferred.' }; }
    }
    return { resolveSymbols, findListedInstrument, fetchStockValuation, fetchUserPortfolio, fetchLiveMarketData, fetchUserWatchlist, fetchCompanyDisclosures,
        executeFinancialMath, retrieveDocuments: question => retrieve(question, knowledge, 4) };
};
