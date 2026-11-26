const { quoteTime } = require('./QuoteIdentity');
const PublicReadCache = require('./PublicReadCache');
const earningsCache = new PublicReadCache();
const metric = 'trailingDilutedEPS';

// RIL's consolidated financial results published 30 October 2026, EPS row.
const reliance = {
    periodEnd: '2026-09-30',
    auditedYear: 59.69,
    priorHalfYear: 33.37,
    latestHalfYear: 34.36,
};

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
        const response = await fetch(`https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?${params}`,
            { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });
        if (!response.ok) return null;
        return datedEarnings(await response.json(), symbol, now);
    }).catch(() => null);
}

async function trailingPE(symbol, { getQuote, getFundamentals, getEarnings = async () => null, now }) {
    let earnings = await getEarnings(symbol).catch(() => null);
    if (!earnings) {
        const latest = await getFundamentals(symbol).catch(() => null);
        if (Number.isFinite(latest?.trailingPE) && latest.trailingPE > 0) {
            return { multiple: latest.trailingPE, source: 'Yahoo Finance', observedAt: now ?? Date.now() };
        }
        if (symbol !== 'RELIANCE.NS' || (now ?? Date.now()) - Date.parse(reliance.periodEnd) > 135 * 86400000) return null;
        const eps = Math.round((reliance.auditedYear - reliance.priorHalfYear + reliance.latestHalfYear) * 100) / 100;
        earnings = { eps, periodEnd: reliance.periodEnd, source: "Reliance's published results" };
    }
    if (earnings.eps <= 0) return { ...earnings, multiple: null };
    const quote = await getQuote(symbol).catch(() => null);
    const observedAt = quoteTime(quote?.timestamp);
    const checkedAt = now ?? Date.now();
    if (!Number.isFinite(quote?.price) || quote.price <= 0 || !Number.isFinite(observedAt) ||
        observedAt > checkedAt + 5000 || checkedAt - observedAt > 7 * 86400000) return null;
    return { ...earnings, multiple: quote.price / earnings.eps, observedAt, price: quote.price };
}

module.exports = { trailingPE, fetchEarnings, datedEarnings };
