const PERIODS = {
    '1y': { range: '1y', query: 'intervalInDays=1', resolution: 'daily' },
    '5y': { range: '5y', query: 'intervalInDays=5', resolution: 'sampled' },
    'max': { range: 'all', query: 'noOfCandles=300', resolution: 'sampled' },
};

function parseCandles(payload, now = new Date()) {
    const points = new Map();
    for (const c of Array.isArray(payload?.candles) ? payload.candles : []) {
        if (!Array.isArray(c)) continue;
        const [seconds, open, high, low, close, volume] = c;
        if (![seconds, open, high, low, close].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0)) continue;
        if (seconds * 1000 > +now + 15000 || low > Math.min(open, close) || high < Math.max(open, close) || low > high) continue;
        points.set(seconds, { date: new Date(seconds * 1000).toISOString(), open, high, low, close,
            volume: typeof volume === 'number' && volume >= 0 ? volume : 0 });
    }
    return [...points.values()].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

async function historical(period) {
    const config = PERIODS[period];
    if (!config) throw new Error('Unsupported BANKEX history period');
    // BSE symbol 14 is verified against Groww's BANKEX instrument metadata.
    const response = await fetch(`https://groww.in/v1/api/charting_service/v2/chart/delayed/exchange/BSE/segment/CASH/14/${config.range}?${config.query}`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('BANKEX history unavailable');
    const data = parseCandles(await response.json());
    if (data.length < 2) throw new Error('BANKEX historical series incomplete');
    return { data, prevClose: null, source: 'Groww public BANKEX history', resolution: config.resolution,
        note: config.resolution === 'sampled' ? 'Historical candles aggregated over multiple sessions' : 'Daily historical candles' };
}
module.exports = { historical, parseCandles };
