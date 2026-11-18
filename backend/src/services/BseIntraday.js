const { parseCandles } = require('./IndexIntraday');
const returnSessionDate = require('./ReturnSession');
const NSEClient = require('./NSEClient');
// Exact BSE script codes verified against the public instrument headers.
const SYMBOLS = { '^BSESN': '1', '^BANKEX': '14' };

function withinSessionRange(points, dailyBar) {
    if (!(dailyBar?.low > 0) || !(dailyBar?.high >= dailyBar.low)) return false;
    return points.every(p => p.close >= dailyBar.low - .02 && p.close <= dailyBar.high + .02);
}

async function historical(symbol, loadDaily, now = new Date(), exchange = 'BSE') {
    const key = symbol.toUpperCase();
    const code = exchange === 'BSE' ? SYMBOLS[key]
        : !key.startsWith('^') && !key.endsWith('.BO') ? key.replace(/\.NS$/, '') : null;
    if (!code) throw Error('Unsupported exchange instrument');
    const session = returnSessionDate(now, NSEClient.constructor.HOLIDAYS);
    const [response, daily] = await Promise.all([
        fetch(`https://groww.in/v1/api/charting_service/v2/chart/delayed/exchange/${exchange}/segment/CASH/${encodeURIComponent(code)}/daily?intervalInMinutes=1`,
            { signal: AbortSignal.timeout(10000) }), loadDaily(),
    ]);
    if (!response.ok) throw Error('BSE intraday series unavailable');
    let data = parseCandles(await response.json(), session, now);
    if (data.length < 2) throw Error('BSE intraday session unavailable');
    const priorSession = returnSessionDate(new Date(`${session}T00:00:00+05:30`), NSEClient.constructor.HOLIDAYS);
    const prior = daily.data?.findLast(bar => bar.date.slice(0, 10) === priorSession);
    const current = daily.data?.findLast(bar => bar.date.slice(0, 10) === session);
    if (!(prior?.close > 0)) throw Error('BSE prior session unavailable');
    if (current && !withinSessionRange(data, current)) throw Error('BSE intraday series conflicts with daily range');
    const end = Date.parse(`${session}T15:30:00+05:30`);
    if (+now >= end && current?.close > 0 && Date.parse(data.at(-1).date) < end) {
        data = [...data, { date: new Date(end).toISOString(), close: current.close }];
    }
    return { data, prevClose: Math.round(prior.close * 100) / 100,
        source: `Groww public ${exchange} intraday`, resolution: 'intraday', delayed: true, session,
        asOf: data.at(-1).date };
}
module.exports = { historical, withinSessionRange,
    nseHistorical: (symbol, loadDaily) => historical(require('./InstrumentAliases').providerSymbol(symbol), loadDaily, new Date(), 'NSE') };
