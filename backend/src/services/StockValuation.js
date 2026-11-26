const { quoteTime } = require('./QuoteIdentity');

// RIL's consolidated financial results published 30 October 2026, EPS row.
const reliance = {
    periodEnd: '2026-09-30',
    auditedYear: 59.69,
    priorHalfYear: 33.37,
    latestHalfYear: 34.36,
};

async function trailingPE(symbol, { getQuote, getFundamentals, now = Date.now() }) {
    const latest = await getFundamentals(symbol).catch(() => null);
    if (Number.isFinite(latest?.trailingPE) && latest.trailingPE > 0) {
        return { multiple: latest.trailingPE, source: 'Yahoo Finance', observedAt: now };
    }
    if (symbol !== 'RELIANCE.NS' || now - Date.parse(reliance.periodEnd) > 135 * 86400000) return null;
    const quote = await getQuote(symbol).catch(() => null);
    const observedAt = quoteTime(quote?.timestamp);
    if (!Number.isFinite(quote?.price) || quote.price <= 0 || !Number.isFinite(observedAt) ||
        observedAt > now + 5000 || now - observedAt > 7 * 86400000) return null;
    const eps = Math.round((reliance.auditedYear - reliance.priorHalfYear + reliance.latestHalfYear) * 100) / 100;
    return { multiple: quote.price / eps, observedAt, eps, price: quote.price, periodEnd: reliance.periodEnd };
}

module.exports = { trailingPE };
