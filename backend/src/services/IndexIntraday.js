const NSEClient = require('./NSEClient');
const returnSessionDate = require('./ReturnSession');
const OfficialIndexSnapshot = require('./OfficialIndexSnapshot');
// Identifiers verified against the headers of the corresponding public index pages.
const SYMBOLS = { '^MIDCPNIFTY': 'NIFTYMIDSELECT', '^FINNIFTY': 'FINNIFTY' };

function parseCandles(payload, session, now = new Date()) {
    if (!Array.isArray(payload?.candles)) return [];
    const points = new Map();
    for (const candle of payload.candles) {
        if (!Array.isArray(candle)) continue;
        const [seconds, open, high, low, close, volume] = candle;
        if (![seconds, open, high, low, close].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0)) continue;
        const at = seconds * 1000;
        const ist = new Date(at + 330 * 60000);
        const minute = ist.getUTCHours() * 60 + ist.getUTCMinutes();
        if (ist.toISOString().slice(0, 10) !== session || minute < 555 || minute > 930 || at > +now + 15000) continue;
        if (high < Math.max(open, close) || low > Math.min(open, close) || low > high) continue;
        points.set(at, { date: new Date(at).toISOString(), open, high, low, close,
            volume: typeof volume === 'number' && volume >= 0 ? volume : 0 });
    }
    return [...points.values()].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

async function historical(symbol, now = new Date()) {
    const key = symbol.toUpperCase(), providerSymbol = SYMBOLS[key];
    if (!providerSymbol) throw new Error('Unsupported intraday index');
    const session = returnSessionDate(now, NSEClient.constructor.HOLIDAYS);
    const [response, snapshot] = await Promise.all([
        fetch(`https://groww.in/v1/api/charting_service/v2/chart/delayed/exchange/NSE/segment/CASH/${providerSymbol}/daily?intervalInMinutes=1`, {
            signal: AbortSignal.timeout(10000),
        }),
        OfficialIndexSnapshot.latest(now),
    ]);
    if (!response.ok) throw new Error('Delayed intraday feed unavailable');
    const payload = await response.json();
    const data = parseCandles(payload, session, now);
    if (data.length < 2) throw new Error('Current-session intraday candles unavailable');
    let official = snapshot[key];
    // Today's report may not be published yet just after 15:30. The previous
    // session's published close remains the reference for today's return.
    if (!official) {
        official = (await OfficialIndexSnapshot.latest(new Date(`${session}T00:00:00+05:30`)))[key];
    }
    const prior = official?.asOf === session ? official.prevClose : official?.asOf < session ? official.price : null;
    const prevClose = Number.isFinite(payload.closingPrice) && payload.closingPrice > 0 ? payload.closingPrice : prior;
    return { data, prevClose, source: 'Groww public delayed feed', resolution: 'intraday', delayed: true, session,
        note: `Delayed intraday · ${session} · 1-minute candles`,
    };
}
module.exports = { historical, parseCandles };
