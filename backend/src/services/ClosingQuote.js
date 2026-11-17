// Recover an actual completed session's quote without inventing a price or timestamp.
module.exports = async function closingQuote(symbol, sessionDate, loadHistory) {
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
