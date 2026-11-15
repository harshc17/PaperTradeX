const PublicReadCache = require('./PublicReadCache');
const NSEClient = require('./NSEClient');
const returnSessionDate = require('./ReturnSession');
const cache = new PublicReadCache(8);
const INDEX_NAMES = {
    'NIFTY 50': { symbol: '^NSEI', shortname: 'NIFTY 50' },
    'NIFTY BANK': { symbol: '^NSEBANK', shortname: 'BANKNIFTY' },
    'NIFTY MIDCAP SELECT': { symbol: '^MIDCPNIFTY', shortname: 'MIDCPNIFTY' },
    'NIFTY FINANCIAL SERVICES': { symbol: '^FINNIFTY', shortname: 'FINNIFTY' },
};

function csvRow(line) {
    return (line.match(/("(?:[^"]|"")*"|[^,]*)(,|$)/g) || [])
        .map(field => field.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim());
}

function parseSnapshot(text, session, sourceUrl) {
    const lines = text.trim().split(/\r?\n/);
    const headers = csvRow(lines.shift() || '');
    const result = {};
    const expectedDate = session.split('-').reverse().join('-');
    for (const line of lines) {
        const fields = csvRow(line);
        const row = Object.fromEntries(headers.map((key, i) => [key, fields[i]]));
        const index = INDEX_NAMES[row['Index Name']?.toUpperCase()];
        if (!index || row['Index Date'] !== expectedDate) continue;
        const price = Number(row['Closing Index Value']);
        const change = Number(row['Points Change']);
        const dayChange = Number(row['Change(%)']);
        if (!(price > 0) || !Number.isFinite(change) || !Number.isFinite(dayChange)) continue;
        result[index.symbol] = { ...index, price, change, dayChange, prevClose: price - change,
            timestamp: new Date(`${session}T15:30:00+05:30`),
            source: 'official-nse-close', asOf: session, sourceUrl };
    }
    return result;
}

async function latest(now = new Date()) {
    const ist = new Date(+now + 330 * 60000);
    // Before today's close, only a previous session's completed report is available.
    const beforeClose = ist.getUTCHours() * 60 + ist.getUTCMinutes() < 930;
    const sessionEnd = new Date(`${ist.toISOString().slice(0, 10)}T18:00:00+05:30`);
    const session = returnSessionDate(beforeClose ? new Date(+sessionEnd - 86400000) : sessionEnd, NSEClient.constructor.HOLIDAYS);
    return cache.load(session, 60000, async () => {
        const sourceUrl = `https://nsearchives.nseindia.com/content/indices/ind_close_all_${session.split('-').reverse().join('')}.csv`;
        try {
            const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(8000) });
            return response.ok ? parseSnapshot(await response.text(), session, sourceUrl) : {};
        } catch { return {}; }
    });
}

module.exports = { latest, parseSnapshot };
