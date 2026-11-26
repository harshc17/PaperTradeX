const { quoteTime } = require('./QuoteIdentity');
const PublicReadCache = require('./PublicReadCache');
const earningsCache = new PublicReadCache();
const metric = 'trailingDilutedEPS';

// Consolidated diluted EPS from company filings for the half year ended 30 September 2026.
const filings = {
    'RELIANCE.NS': { year: 59.69, previousHalf: 33.37, latestHalf: 34.36, source: "Reliance's published results" },
    'HAL.NS': { year: 136.30, previousHalf: 45.65, latestHalf: 52.71, source: 'HAL’s consolidated exchange filing' },
    'TCS.NS': { year: 145.99, previousHalf: 68.64, latestHalf: 75.27, source: 'TCS’s consolidated financial statements' },
};
const filingPeriodEnd = '2026-09-30';

async function fetchExchangePE(symbol, signal) {
    if (!/^[A-Z0-9&.-]{1,30}\.NS$/.test(symbol)) return null;
    const ticker = symbol.slice(0, -3);
    return earningsCache.load(`nse-pe:${ticker}`, 5 * 60000, async () => {
        const params = new URLSearchParams({ functionName: 'getSymbolData', marketType: 'N', series: 'EQ', symbol: ticker });
        const response = await fetch(`https://www.nseindia.com/api/NextApi/apiClient/GetQuoteApi?${params}`,
            { signal: AbortSignal.any([signal, AbortSignal.timeout(3500)]) });
        if (!response.ok) return null;
        const rows = (await response.json())?.equityResponse;
        if (!Array.isArray(rows)) return null;
        const exact = rows.find(row => row?.metaData?.symbol === ticker && row.metaData.series === 'EQ');
        const multiple = Number(exact?.metaData?.pdSymbolPe);
        return Number.isFinite(multiple) && multiple > 0 ? { multiple, source: 'NSE India' } : null;
    }).catch(() => null);
}

function datedEarnings(payload, symbol, now) {
    const blocks = payload?.timeseries?.result;
    if (!Array.isArray(blocks)) return null;
    const series = blocks.find(block => block?.meta?.symbol?.[0] === symbol && block.meta.type?.[0] === metric);
    if (!Array.isArray(series?.[metric])) return null;
    const latest = series[metric].filter(row => {
        const day = Date.parse(row?.asOfDate);
        return row?.periodType === 'TTM' && row.currencyCode === 'INR' &&
            Number.isFinite(row.reportedValue?.raw) && Number.isFinite(day) &&
            new Date(day).toISOString().slice(0, 10) === row.asOfDate &&
            day <= now && now - day <= 135 * 86400000;
    }).sort((a, b) => b.asOfDate.localeCompare(a.asOfDate))[0];
    return latest ? { eps: latest.reportedValue.raw, periodEnd: latest.asOfDate, source: 'Yahoo Finance' } : null;
}

async function fetchEarnings(symbol, signal) {
    if (!/^[A-Z0-9&.-]{1,30}\.(?:NS|BO)$/.test(symbol)) return null;
    return earningsCache.load(symbol, 60 * 60000, async () => {
        const now = Date.now();
        const params = new URLSearchParams({ type: metric,
            period1: Math.floor((now - 180 * 86400000) / 1000), period2: Math.ceil(now / 1000) });
        const suffix = `/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?${params}`;
        for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
            try {
                const response = await fetch(`https://${host}${suffix}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(3200)]) });
                if (response.ok) return datedEarnings(await response.json(), symbol, now);
            } catch { /* Try Yahoo's alternate API host on a transport failure. */ }
        }
        return null;
    }).catch(() => null);
}

async function trailingPE(symbol, { getQuote, getFundamentals, getEarnings = async () => null, getExchangePE = async () => null, now }) {
    const exchangePE = await getExchangePE(symbol);
    if (exchangePE) return exchangePE;
    let earnings = await getEarnings(symbol);
    if (!earnings) {
        const latest = await getFundamentals(symbol).catch(() => null);
        if (Number.isFinite(latest?.trailingPE) && latest.trailingPE > 0) {
            return { multiple: latest.trailingPE, source: 'Yahoo Finance', observedAt: now ?? Date.now() };
        }
        const filing = filings[symbol];
        if (!filing || (now ?? Date.now()) - Date.parse(filingPeriodEnd) > 135 * 86400000) return null;
        const eps = Math.round((filing.year - filing.previousHalf + filing.latestHalf) * 100) / 100;
        earnings = { eps, periodEnd: filingPeriodEnd, source: filing.source };
    }
    if (earnings.eps <= 0) return { ...earnings, multiple: null };
    const quote = await getQuote(symbol).catch(() => null);
    const observedAt = quoteTime(quote?.timestamp);
    const checkedAt = now ?? Date.now();
    if (!Number.isFinite(quote?.price) || quote.price <= 0 || !Number.isFinite(observedAt) ||
        observedAt > checkedAt + 5000 || checkedAt - observedAt > 7 * 86400000) return null;
    return { ...earnings, multiple: quote.price / earnings.eps, observedAt, price: quote.price };
}

module.exports = { trailingPE, fetchEarnings, datedEarnings, fetchExchangePE };
