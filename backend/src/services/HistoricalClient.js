/**
 * HistoricalClient.js — Historical OHLCV data for stock price charts
 *
 * Uses Yahoo Finance's chart() API for all periods including 1D intraday.
 * Yahoo Finance is reliable for historical/OHLCV data (no schema issues here).
 *
 * Supported periods: 1d, 1w, 1mo, 6mo, 1y, 5y, max
 *
 * For 1D (intraday): uses 2-minute bars covering last 1 trading day.
 * For 1W:            uses 1-hour bars.
 * For 1M–1Y:         uses 1-day bars.
 * For 5Y:            uses 1-week bars.
 * For max:           uses 1-month bars.
 */

const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

// Period → { lookbackDays, interval }
const PERIOD_CONFIG = {
    '1d':  { lookbackDays: 5,    interval: '5m'  }, // 5-min bars, last 5 days (covers weekends)
    '1w':  { lookbackDays: 8,    interval: '1h'  }, // 1-hour bars, last 8 days
    '1mo': { lookbackDays: 32,   interval: '1d'  },
    '3mo': { lookbackDays: 93,   interval: '1d'  },
    '6mo': { lookbackDays: 185,  interval: '1d'  },
    '1y':  { lookbackDays: 367,  interval: '1d'  },
    '5y':  { lookbackDays: 1832, interval: '1wk' },
    'max': { lookbackDays: 9000, interval: '1mo' },
};

// Yahoo uses .NS suffix for NSE stocks, .BO for BSE stocks.
// Preserve existing exchange suffixes; only append .NS if bare.
function toYahooSymbol(symbol) {
    if (symbol.startsWith('^')) return symbol; // indices unchanged
    const upper = symbol.toUpperCase();
    if (upper.endsWith('.NS') || upper.endsWith('.BO')) return upper;
    return upper + '.NS'; // default to NSE for bare symbols
}

// Returns candidate symbols to try in order, with fallback to the other exchange.
// e.g. 'NSE.BO' → ['NSE.BO', 'NSE.NS']
// e.g. 'RELIANCE.NS' → ['RELIANCE.NS', 'RELIANCE.BO']
// e.g. 'RELIANCE' → ['RELIANCE.NS', 'RELIANCE.BO']
function getYahooCandidates(symbol) {
    if (symbol.startsWith('^')) return [symbol];
    const upper = symbol.toUpperCase();
    if (upper.endsWith('.BO')) return [upper, upper.replace(/\.BO$/, '.NS')];
    if (upper.endsWith('.NS')) return [upper, upper.replace(/\.NS$/, '.BO')];
    return [upper + '.NS', upper + '.BO'];
}

module.exports = {
    /**
     * Search Yahoo Finance for symbols.
     */
    async search(query) {
        try {
            const results = await yf.search(query, {}, { validateResult: false });
            return results.quotes || [];
        } catch (e) {
            // yahoo-finance2 schema validation might fail on newer API formats,
            // but the parsed result is often still perfectly valid in e.result.quotes
            if (e.name === 'FailedYahooValidationError' && e.result && e.result.quotes) {
                return e.result.quotes;
            }
            console.warn(`[Yahoo] Search fallback failed for query "${query}": ${e.message}`);
            return [];
        }
    },

    /**
     * Fetch historical OHLCV for chart display.
     * @param {string} symbol  e.g. "HDFCBANK.NS", "HDFCBANK", "^NSEI"
     * @param {string} period  one of: 1d, 1w, 1mo, 3mo, 6mo, 1y, 5y, max
     * @returns {Array} ascending array of { date, open, high, low, close, volume }
     */
    async historical(symbol, period) {
        const cfg = PERIOD_CONFIG[period] || PERIOD_CONFIG['1mo'];
        const candidates = getYahooCandidates(symbol);
        const now = new Date();
        const period1 = new Date(now - cfg.lookbackDays * 86400000);

        // Try each candidate symbol (e.g. .BO first, then .NS fallback)
        let result = null;
        for (const yhSymbol of candidates) {
            try {
                const r = await yf.chart(yhSymbol, {
                    period1,
                    period2: now,
                    interval: cfg.interval,
                }, { validateResult: false });
                const quotes = r?.quotes || [];
                if (quotes.some(q => q?.close > 0)) {
                    result = r;
                    break;
                }
            } catch { /* try next */ }
        }
        if (!result) result = {};
        // chart() with validateResult:false works reliably for historical OHLCV
        // (result already fetched above)

        const raw = result?.quotes || [];

        const points = raw
            .filter(q => q && q.close != null && q.close > 0)
            .map(q => ({
                date:   q.date instanceof Date ? q.date.toISOString() : q.date,
                open:   q.open   ?? q.close,
                high:   q.high   ?? q.close,
                low:    q.low    ?? q.close,
                close:  q.close,
                volume: q.volume ?? 0,
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // For 1D: filter to only the last trading day (most recent session)
        let filteredPoints = points;
        if (period === '1d' && points.length > 0) {
            const lastDate = new Date(points[points.length - 1].date);
            const lastDay = lastDate.toDateString();
            const todayPoints = points.filter(p => new Date(p.date).toDateString() === lastDay);
            filteredPoints = todayPoints.length > 0 ? todayPoints : points;
        }

        // Extract previous close from Yahoo chart meta.
        // This is the true prior-session close used for 1D return calculation.
        let prevClose = null;
        if (period === '1d') {
            const meta = result?.meta || {};
            const raw = meta.regularMarketPreviousClose ?? meta.chartPreviousClose ?? meta.previousClose ?? null;
            if (typeof raw === 'number' && raw > 0) prevClose = raw;
        }

        return { data: filteredPoints, prevClose };
    },

    /**
     * Validate that a symbol exists and return its latest close price.
     * Used for smoke-testing a symbol before displaying it.
     */
    async latestPrice(symbol) {
        const candidates = getYahooCandidates(symbol);
        const now = new Date();
        const period1 = new Date(now - 3 * 86400000); // last 3 days

        for (const yhSymbol of candidates) {
            try {
                const result = await yf.chart(yhSymbol, {
                    period1,
                    period2: now,
                    interval: '2m',
                }, { validateResult: false });

                const raw = result?.quotes || [];
                const valid = raw.filter(q => q?.close > 0);
                if (valid.length > 0) {
                    return valid[valid.length - 1].close;
                }
            } catch { /* try next */ }
        }
        return null;
    },

    /**
     * Get a full quote object for a stock using Yahoo Finance.
     * Returns standardized fields compatible with the stock detail endpoint.
     * @param {string} symbol  e.g. "HDFCBANK", "RELIANCE"
     */
    async quoteDetail(symbol) {
        const candidates = getYahooCandidates(symbol);
        for (const yhSymbol of candidates) {
            try {
                const data = await yf.quote(yhSymbol, {}, { validateResult: false });
                if (data && (data.regularMarketPrice > 0 || data.regularMarketPreviousClose > 0)) {
                    return data;
                }
            } catch (e) {
                if (e.name === 'FailedYahooValidationError' && e.result) {
                    const r = e.result;
                    if (r && (r.regularMarketPrice > 0 || r.regularMarketPreviousClose > 0)) return r;
                }
                console.warn(`[Yahoo] quote failed for "${yhSymbol}": ${e.message}`);
            }
        }
        return null;
    },

    /**
     * Fetch near-real-time quote data for an index (e.g. "^BSESN", "^NSEI").
     * Uses 1-minute intraday chart bars so index points track live market moves.
     * Returns { price, prevClose, change, dayChange } or null if unavailable.
     */
    async indexQuote(symbol) {
        try {
            const now = new Date();
            const period1 = new Date(now - 3 * 86400000); // enough to include previous trading session
            const result = await yf.chart(symbol, {
                period1,
                period2: now,
                interval: '1m',
            }, { validateResult: false });

            const quotes = (result?.quotes || []).filter(q => q?.close > 0);
            if (quotes.length === 0) return null;

            const last = quotes[quotes.length - 1];
            const meta = result?.meta || {};

            const price = last.close;
            const prevClose =
                meta?.regularMarketPreviousClose ??
                meta?.chartPreviousClose ??
                meta?.previousClose ??
                price;
            const change    = parseFloat((price - prevClose).toFixed(2));
            const dayChange = prevClose > 0
                ? parseFloat(((change / prevClose) * 100).toFixed(2))
                : 0;

            return { price, prevClose, change, dayChange };
        } catch {
            return null;
        }
    },
};

