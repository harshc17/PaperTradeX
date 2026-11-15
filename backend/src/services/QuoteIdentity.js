// Existing bare positions are NSE. BSE keeps its suffix throughout storage,
// subscriptions and valuation; it must never share an NSE cache key.
function quoteKey(symbol) {
    return String(symbol).trim().toUpperCase().replace(/\.NS$/, '');
}
function quoteTime(value) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
    return Date.parse(value || '');
}
function isFreshQuote(quote) {
    const at = quoteTime(quote?.timestamp);
    return quote?.price > 0 && Number.isFinite(at) && Date.now() - at <= 60000 && at <= Date.now() + 5000;
}
function nseQuoteTime(value) {
    // NSE timestamps are exchange-local and commonly use DD-MMM-YYYY.
    return value ? Date.parse(String(value) + ' GMT+0530') : NaN;
}
module.exports = { quoteKey, quoteTime, isFreshQuote, nseQuoteTime };
