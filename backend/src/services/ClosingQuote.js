// Recover an actual completed session's quote without inventing a price or timestamp.
module.exports = async function closingQuote(symbol, sessionDate, loadHistory) {
    // The final daily bar can be available before delayed intraday bars catch
    // up. Its date is the session start, not the time of the closing price.
    try {
        const daily = await loadHistory(symbol, '1mo');
        const bars = daily?.data || [];
        const last = bars.at(-1), prior = bars.at(-2);
        const day = last?.date && new Date(Date.parse(last.date) + 330 * 60000).toISOString().slice(0, 10);
        if (day === sessionDate && last.close > 0 && prior?.close > 0) {
            const price = Math.round(last.close * 100) / 100;
            const prevClose = Math.round(prior.close * 100) / 100;
            const change = Math.round((price - prevClose) * 100) / 100;
            return { price, prevClose, change, dayChange: change / prevClose * 100,
                timestamp: new Date(`${sessionDate}T15:30:00+05:30`),
                barTimestamp: last.date, source: 'daily-session-close' };
        }
    } catch { /* retain the intraday fallback when daily history is unavailable */ }
    const series = await loadHistory(symbol, '1d');
    const last = series?.data?.at(-1);
    const at = Date.parse(last?.date || '');
    if (!Number.isFinite(at) || !(last?.close > 0) || !(series.prevClose > 0)) return null;
    const day = new Date(at + 330 * 60000).toISOString().slice(0, 10);
    if (day !== sessionDate) return null;
    const price = Math.round(last.close * 100) / 100;
    const prevClose = series.prevClose;
    const change = Math.round((price - prevClose) * 100) / 100;
    return { price, prevClose, change, dayChange: change / prevClose * 100,
        timestamp: last.date, source: 'historical-session-close' };
};

module.exports.fromProvider = function fromProvider(quote, sessionDate) {
    const { quoteTime } = require('./QuoteIdentity');
    const at = quoteTime(quote?.regularMarketTime);
    const price = quote?.regularMarketPrice;
    if (!(price > 0) || !Number.isFinite(at) || at > Date.now() + 15000) return null;
    if (new Date(at + 330 * 60000).toISOString().slice(0, 10) !== sessionDate) return null;
    // Yahoo can leave regularMarketPreviousClose one session behind even while
    // its price and daily change have rolled forward together.
    const prevClose = Number.isFinite(quote.regularMarketChange)
        ? Math.round((price - quote.regularMarketChange) * 100) / 100
        : quote.regularMarketPreviousClose;
    if (!(prevClose > 0)) return null;
    const change = Math.round((price - prevClose) * 100) / 100;
    return { price, prevClose, change, dayChange: change / prevClose * 100,
        timestamp: new Date(at), source: 'yahoo-session-close' };
};
