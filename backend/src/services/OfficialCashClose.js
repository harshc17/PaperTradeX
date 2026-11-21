const PublicReadCache = require('./PublicReadCache');
const { providerSymbol } = require('./InstrumentAliases');
const cache = new PublicReadCache(4);

function parseSnapshot(text, session, sourceUrl) {
    const lines = text.trim().split(/\r?\n/);
    const headers = (lines.shift() || '').split(',').map(s => s.trim());
    const result = {};
    for (const line of lines) {
        const fields = line.split(',').map(s => s.trim());
        const row = Object.fromEntries(headers.map((name, i) => [name, fields[i]]));
        if (row.SERIES !== 'EQ' || !row.SYMBOL || !row.DATE1) continue;
        const date = Date.parse(`${row.DATE1} 15:30:00 GMT+0530`);
        if (!Number.isFinite(date) || new Date(date + 330 * 60000).toISOString().slice(0, 10) !== session) continue;
        const price = Number(row.CLOSE_PRICE), prevClose = Number(row.PREV_CLOSE);
        if (!(price > 0) || !(prevClose > 0)) continue;
        const change = Math.round((price - prevClose) * 100) / 100;
        result[row.SYMBOL] = { price, prevClose, change, dayChange: change / prevClose * 100,
            timestamp: new Date(date), source: 'official-nse-cash-close', asOf: session, sourceUrl };
    }
    return result;
}
async function quote(symbol, session) {
    const key = providerSymbol(symbol).replace(/\.NS$/i, '');
    if (key.startsWith('^') || key.endsWith('.BO')) return null;
    const snapshot = await cache.load(session, 60000, async () => {
        const url = `https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${session.split('-').reverse().join('')}.csv`;
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
            return response.ok ? parseSnapshot(await response.text(), session, url) : {};
        } catch { return {}; }
    });
    return snapshot[key] || null;
}
module.exports = { quote, parseSnapshot };
