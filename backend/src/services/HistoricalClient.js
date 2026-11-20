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
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'],
    fetch: (url, options = {}) => fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(10000) }),
});
const { providerSymbol } = require('./InstrumentAliases');
const PublicReadCache = require('./PublicReadCache');
const readCache = new PublicReadCache();
const NSEClient = require('./NSEClient');
const returnSessionDate = require('./ReturnSession');
const OfficialIndexHistory = require('./OfficialIndexHistory');
const IndexIntraday = require('./IndexIntraday');
const OfficialIndexSnapshot = require('./OfficialIndexSnapshot');
const BankexHistory = require('./BankexHistory');
const BseIntraday = require('./BseIntraday');
const { validateCandles, withinDailyRanges, withLatestSession } = require('./ChartIntegrity');
const { quoteTime } = require('./QuoteIdentity');
const NseArchive = require('./NseArchive');
const quoteRecovery = require('./QuoteRecovery')({
    fetchChart: async symbol => {
        // Match the chart host used by yahoo-finance2 and the working index feed.
        const response = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m`,
            { signal: AbortSignal.timeout(4500) });
        if (!response.ok) throw new Error(`Chart quote HTTP ${response.status}`);
        return (await response.json())?.chart?.result?.[0];
    },
});

function aggregateDaily(quotes) {
    const days = new Map();
    for (const q of [...quotes].filter(q => q?.close > 0).sort((a, b) => +new Date(a.date) - +new Date(b.date))) {
        const day = new Date(+new Date(q.date) + 330 * 60000).toISOString().slice(0, 10);
        const old = days.get(day);
        days.set(day, { date: q.date, open: old?.open ?? q.open ?? q.close,
            high: Math.max(old?.high ?? -Infinity, q.high ?? q.close),
            low: Math.min(old?.low ?? Infinity, q.low ?? q.close), close: q.close,
            volume: (old?.volume || 0) + (q.volume || 0) });
    }
    return [...days.values()];
}

function chartPreviousClose(quote, meta = {}) {
    if (Number.isFinite(quote?.regularMarketPrice) && quote.regularMarketPrice > 0 && Number.isFinite(quote?.regularMarketChange)) {
        const previous = Math.round((quote.regularMarketPrice - quote.regularMarketChange) * 100) / 100;
        if (previous > 0) return previous;
    }
    return [quote?.regularMarketPreviousClose, meta.regularMarketPreviousClose, meta.previousClose, meta.chartPreviousClose]
        .find(value => typeof value === 'number' && Number.isFinite(value) && value > 0) ?? null;
}

// A multi-session chart's metadata can refer to the beginning of its window.
// Use the preceding session's final bar when the quote endpoint is unavailable.
function indexPreviousClose(quote, meta, quotes, official) {
    const session = date => new Date(+new Date(date) + 330 * 60000).toISOString().slice(0, 10);
    const last = quotes.at(-1);
    if (!last) return null;
    const day = session(last.date);
    const priorDay = returnSessionDate(new Date(`${day}T00:00:00+05:30`), NSEClient.constructor.HOLIDAYS);
    if (official?.asOf === day && official.prevClose > 0) return official.prevClose;
    if (official?.asOf === priorDay && official.price > 0) return official.price;
    if (quote && quote.regularMarketTime && session(quote.regularMarketTime) === day) {
        const previous = chartPreviousClose(quote);
        if (previous > 0) return previous;
    }
    const prior = quotes.findLast(point => session(point.date) < day);
    return prior?.close > 0 ? prior.close : chartPreviousClose(null, meta);
}

// Period → { lookbackDays, interval }
const PERIOD_CONFIG = {
    '1d':  { lookbackDays: 5,    interval: '1m'  }, // One-minute bars, last 5 days (covers weekends)
    '1w':  { lookbackDays: 8,    interval: '1h'  }, // 1-hour bars, last 8 days
    '1mo': { lookbackDays: 32,   interval: '1d'  },
    '3mo': { lookbackDays: 93,   interval: '1d'  },
    '6mo': { lookbackDays: 185,  interval: '1d'  },
    '1y':  { lookbackDays: 367,  interval: '1d'  },
    '3y':  { lookbackDays: 1099, interval: '1wk' },
    '5y':  { lookbackDays: 1832, interval: '1wk' },
    // Yahoo monthly ETF bars can mix adjusted closes with invalid OHLC ranges.
    'max': { lookbackDays: 9000, interval: '1wk' },
};

// Yahoo uses .NS suffix for NSE stocks, .BO for BSE stocks.
// Preserve existing exchange suffixes; only append .NS if bare.
function toYahooSymbol(symbol) {
    symbol = providerSymbol(symbol);
    if (symbol.toUpperCase() === '^BANKEX') return 'BSE-BANK.BO';
    if (symbol.startsWith('^')) return symbol; // indices unchanged
    const upper = symbol.toUpperCase();
    if (upper.endsWith('.NS') || upper.endsWith('.BO')) return upper;
    return upper + '.NS'; // default to NSE for bare symbols
}

// Resolve verified retired symbols, then keep the requested exchange exact.
function getYahooCandidates(symbol) {
    symbol = providerSymbol(symbol);
    if (symbol.toUpperCase() === '^BANKEX') return ['BSE-BANK.BO'];
    if (symbol.startsWith('^')) return [symbol];
    const upper = symbol.toUpperCase();
    if (upper.endsWith('.BO') || upper.endsWith('.NS')) return [upper];
    return [upper + '.NS'];
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
        const open = NSEClient.constructor.isMarketHours();
        const session = returnSessionDate(new Date(), NSEClient.constructor.HOLIDAYS);
        const key = `chart:${getYahooCandidates(symbol).join(',')}:${period}:${session}:${open}`;
        // Delayed feeds can deliver the final candles after the exchange closes.
        const closeTime = Date.parse(`${session}T15:30:00+05:30`);
        const settling = Date.now() >= closeTime && Date.now() < closeTime + 3600000;
        return readCache.load(key, open || period === '1d' || settling ? 30000 : 3600000,
            async () => { const result = await this._historical(symbol, period); validateCandles(result.data || []); return result; },
            value => value?.data?.length > 0);
    },

    async _historical(symbol, period) {
        const cfg = PERIOD_CONFIG[period] || PERIOD_CONFIG['1mo'];
        const bseIntraday = ['^BSESN', '^BANKEX'].includes(symbol.toUpperCase()) && period === '1d';
        if (bseIntraday) {
            try { return await BseIntraday.historical(symbol, () => this.historical(symbol, '1mo')); }
            catch { /* only use the fallback below if its bars pass the daily-range check */ }
        }
        if (symbol.toUpperCase() === '^BANKEX' && ['3mo', '6mo', '1y', '3y', '5y', 'max'].includes(period)) {
            const series = await BankexHistory.historical(period);
            try { return withLatestSession(series, await this.historical(symbol, '1d')); }
            catch { return series; }
        }
        if (OfficialIndexHistory.NAMES[symbol.toUpperCase()]) {
            if (period === '1d') return IndexIntraday.historical(symbol);
            const series = await OfficialIndexHistory.historical(symbol, period, cfg.lookbackDays);
            try { return withLatestSession(series, await this.historical(symbol, '1d')); }
            catch { return series; } // keep real history if the newest feed is unavailable
        }
        const candidates = getYahooCandidates(symbol);
        const quoteRead = period === '1d' ? this.quoteDetail(symbol).catch(() => null) : Promise.resolve(null);
        const officialRead = period === '1d' && symbol.startsWith('^') ? OfficialIndexSnapshot.latest() : Promise.resolve({});
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
                if (r?.meta?.symbol && r.meta.symbol.toUpperCase() !== yhSymbol.toUpperCase()) continue;
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

        let raw = result?.quotes || [];
        let source = 'Yahoo OHLCV';
        if (symbol.toUpperCase() === '^BANKEX' && period === '1mo' && raw.filter(q => q?.close > 0).length < 2) {
            const hourly = await yf.chart('BSE-BANK.BO', { period1, period2: now, interval: '1h' }, { validateResult: false });
            if (hourly.meta?.symbol !== 'BSE-BANK.BO') throw new Error('BANKEX history identity mismatch');
            raw = aggregateDaily(hourly.quotes || []);
            source = 'Yahoo hourly OHLCV aggregated by session';
        }

        const points = raw
            .filter(q => q && q.close != null && q.close > 0)
            .map(q => ({
                date:   q.date instanceof Date ? q.date.toISOString() : q.date,
                // Zero OHLC fields mean missing provider metadata, not a trade
                // at zero. Preserve the real close without inventing a range.
                open:   Number.isFinite(q.open) && q.open > 0 ? q.open : undefined,
                high:   Number.isFinite(q.high) && q.high > 0 ? q.high : undefined,
                low:    Number.isFinite(q.low) && q.low > 0 ? q.low : undefined,
                close:  q.close,
                volume: q.volume ?? 0,
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Renamed ETF tickers can have only a few weeks of Yahoo history even
        // though their verified exchange archive goes back years.
        if (period === 'max' && !symbol.startsWith('^') && !symbol.toUpperCase().endsWith('.BO') &&
            points.length && Date.parse(points[0].date) > +now - 367 * 86400000) {
            try {
                const archive = await NseArchive.historical(symbol);
                if (Date.parse(archive.data[0].date) < Date.parse(points[0].date)) {
                    return withLatestSession(archive, await this.historical(symbol, '1d'));
                }
            } catch { /* preserve the real available history if the archive is unavailable */ }
        }

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
            const quote = await quoteRead;
            let official = (await officialRead)[symbol.toUpperCase()];
            const sessionDay = filteredPoints.at(-1)?.date?.slice(0, 10);
            let dailyBars = [];
            if (sessionDay) {
                try { dailyBars = (await this.historical(symbol, '1mo')).data || []; }
                catch { /* use the validated intraday reference below */ }
                const priorDay = returnSessionDate(new Date(`${sessionDay}T00:00:00+05:30`), NSEClient.constructor.HOLIDAYS);
                const prior = dailyBars.findLast(bar => bar.date.slice(0, 10) === priorDay);
                if (!official && prior?.close > 0) official = { asOf: priorDay, price: Math.round(prior.close * 100) / 100 };
            }
            prevClose = indexPreviousClose(quote, meta, points, official);
            const finalBar = dailyBars.at(-1);
            if (!withinDailyRanges(filteredPoints, dailyBars)) {
                if (!symbol.startsWith('^') && !symbol.toUpperCase().endsWith('.BO')) {
                    return BseIntraday.nseHistorical(symbol, () => this.historical(symbol, '1mo'));
                }
                throw Error('Intraday candles conflict with verified daily ranges');
            }
            if (bseIntraday && finalBar?.date.slice(0, 10) === sessionDay &&
                !BseIntraday.withinSessionRange(filteredPoints, finalBar)) {
                throw Error('BSE fallback candles conflict with daily session range');
            }
            const end = sessionDay && Date.parse(`${sessionDay}T15:30:00+05:30`);
            if (!NSEClient.constructor.isMarketHours() && end && +now >= end &&
                finalBar?.date.slice(0, 10) === sessionDay && finalBar.close > 0 &&
                Date.parse(filteredPoints.at(-1)?.date || '') < end) {
                filteredPoints = [...filteredPoints, { date: new Date(end).toISOString(), close: finalBar.close }];
                source += ' + daily session close';
            }
        }

        if (period === '1w') {
            const daily = await this.historical(symbol, '1mo');
            if (!withinDailyRanges(filteredPoints, daily.data)) {
                return { ...daily, data: daily.data.filter(p => Date.parse(p.date) >= +period1),
                    source: daily.source + ' (daily fallback)', resolution: 'daily', note: 'Daily history; inconsistent intraday feed unavailable' };
            }
        }

        validateCandles(filteredPoints);
        const resolution = source.includes('aggregated') || cfg.interval === '1d' ? 'daily'
            : cfg.interval === '1wk' ? 'weekly' : cfg.interval === '1mo' ? 'monthly' : 'intraday';
        const observed = quoteTime(result?.meta?.regularMarketTime);
        return { data: filteredPoints, prevClose, source, resolution,
            asOf: Number.isFinite(observed) ? new Date(observed).toISOString() : filteredPoints.at(-1)?.date };
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
        return readCache.load(`quote:${getYahooCandidates(symbol).join(',')}`, 2000,
            () => this._quoteDetail(symbol));
    },

    async quoteBatch(symbols) {
        if (quoteRecovery.blocked()) throw new Error('Quote provider cooling down');
        const requests = [...new Set(symbols)].filter(symbol => !['^MIDCPNIFTY', '^FINNIFTY'].includes(symbol)).sort();
        const providers = [...new Set(requests.map(symbol => getYahooCandidates(symbol)[0]))].sort();
        if (!providers.length) return {};
        return readCache.load(`batch:${requests.join(',')}`, 0, async () => {
            const quotes = [];
            let lastError;
            for (let offset = 0; offset < providers.length; offset += 100) {
                try {
                    const result = await yf.quote(providers.slice(offset, offset + 100), {}, { validateResult: false });
                    quotes.push(...(Array.isArray(result) ? result : []));
                } catch (error) { quoteRecovery.failed(error); lastError = error; }
            }
            if (!quotes.length && lastError) throw lastError;
            const exact = new Map(quotes.filter(q => q?.symbol && q.regularMarketPrice > 0).map(q => [q.symbol.toUpperCase(), q]));
            return Object.fromEntries(requests.flatMap(symbol => {
                const quote = exact.get(getYahooCandidates(symbol)[0].toUpperCase());
                return quote ? [[symbol, quote]] : [];
            }));
        }, value => Object.keys(value).length > 0);
    },

    async _quoteDetail(symbol) {
        const candidates = getYahooCandidates(symbol);
        for (const yhSymbol of candidates) {
            try {
                if (quoteRecovery.blocked()) {
                    const recovered = await quoteRecovery.chart(yhSymbol);
                    if (recovered) return recovered;
                    continue;
                }
                const data = await yf.quoteCombine(yhSymbol, {}, { validateResult: false });
                if (data && data.symbol?.toUpperCase() === yhSymbol.toUpperCase() && data.regularMarketPrice > 0) {
                    return data;
                }
            } catch (e) {
                quoteRecovery.failed(e);
                if (e.name === 'FailedYahooValidationError' && e.result) {
                    // quoteCombine validates the entire batch even when validation
                    // is disabled; recover only this exact, usable instrument.
                    const results = Array.isArray(e.result) ? e.result : [e.result];
                    const quote = results.find(r => typeof r?.symbol === 'string' &&
                        r.symbol.toUpperCase() === yhSymbol.toUpperCase() && Number.isFinite(r.regularMarketPrice) && r.regularMarketPrice > 0);
                    if (quote) return quote;
                }
                console.warn(`[Yahoo] quote failed for "${yhSymbol}": ${e.message}`);
            }
            try {
                const recovered = await quoteRecovery.chart(yhSymbol);
                if (recovered) return recovered;
            } catch { /* a missing quote stays unavailable */ }
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
            const period1 = new Date(now - 7 * 86400000); // includes Friday's close on Mondays
            const [result, quote, official] = await Promise.all([yf.chart(symbol, {
                period1,
                period2: now,
                interval: '1m',
            }, { validateResult: false }), this.quoteDetail(symbol).catch(() => null),
                OfficialIndexSnapshot.latest().catch(() => ({}))]);

            const quotes = (result?.quotes || []).filter(q => q?.close > 0);
            if (quotes.length === 0) return null;

            const last = quotes[quotes.length - 1];
            const meta = result?.meta || {};

            const price = last.close;
            const prevClose = indexPreviousClose(quote, meta, quotes, official[symbol]);
            if (!(prevClose > 0)) return null;
            const change    = parseFloat((price - prevClose).toFixed(2));
            const dayChange = prevClose > 0
                ? parseFloat(((change / prevClose) * 100).toFixed(2))
                : 0;

            return { price, prevClose, change, dayChange, timestamp: last.date, source: 'yahoo-delayed' };
        } catch {
            return null;
        }
    },
    aggregateDaily,
    chartPreviousClose,
    indexPreviousClose,
};

