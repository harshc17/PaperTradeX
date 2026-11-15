const NAMES = {
    '^MIDCPNIFTY': 'NIFTY MIDCAP SELECT',
    '^FINNIFTY': 'NIFTY FINANCIAL SERVICES',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function requestDate(date) {
    return `${String(date.getUTCDate()).padStart(2, '0')}-${MONTHS[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}
function parseHistory(payload, name, from, to) {
    let rows = payload;
    if (!Array.isArray(rows)) rows = rows?.d;
    if (typeof rows === 'string') rows = JSON.parse(rows);
    if (!Array.isArray(rows)) return [];
    const points = new Map();
    for (const row of rows) {
        if (row.INDEX_NAME?.toUpperCase().trim() !== name) continue;
        const match = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/.exec(row.HistoricalDate || '');
        if (!match) continue;
        const month = MONTHS.findIndex(m => m.toLowerCase() === match[2].toLowerCase());
        if (month < 0) continue;
        const date = new Date(`${match[3]}-${String(month + 1).padStart(2, '0')}-${match[1].padStart(2, '0')}T15:30:00+05:30`);
        const close = Number(row.CLOSE), open = Number(row.OPEN), high = Number(row.HIGH), low = Number(row.LOW);
        if (+date < +from || +date > +to || ![open, high, low, close].every(n => Number.isFinite(n) && n > 0)) continue;
        points.set(+date, { date: date.toISOString(), open, high, low, close, volume: 0 });
    }
    return [...points.values()].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

async function historical(symbol, period, lookbackDays, now = new Date()) {
    const name = NAMES[symbol.toUpperCase()];
    if (!name) throw new Error('Unsupported official index');
    // The official endpoint supplies daily OHLC. Never present those as intraday candles.
    const from = new Date(+now - Math.max(lookbackDays, 10) * 86400000);
    const cinfo = JSON.stringify({ name, indexName: name, startDate: requestDate(from), endDate: requestDate(now) });
    const response = await fetch('https://www.niftyindices.com/BackPage/getHistoricaldatatabletoString', {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Referer: 'https://www.niftyindices.com/reports/historical-data' },
        body: JSON.stringify({ cinfo }), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Official index history unavailable');
    const data = parseHistory(await response.json(), name, from, now);
    const prevClose = data.length > 1 ? data[data.length - 2].close : null;
    return { data: period === '1d' ? data.slice(-1) : data, prevClose,
        source: 'NSE Indices daily OHLC', resolution: 'daily',
        note: period === '1d' ? 'Intraday history unavailable. Showing the latest official daily close.' : 'Official daily history',
    };
}
module.exports = { historical, parseHistory, NAMES };
