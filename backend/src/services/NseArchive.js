const { providerSymbol } = require('./InstrumentAliases');
const { parseCandles } = require('./BankexHistory');
async function historical(symbol) {
    const key = providerSymbol(symbol).toUpperCase();
    if (key.startsWith('^') || key.endsWith('.BO')) throw Error('NSE history cannot substitute for another exchange');
    const code = key.replace(/\.NS$/, '');
    const response = await fetch(`https://groww.in/v1/api/charting_service/v2/chart/delayed/exchange/NSE/segment/CASH/${encodeURIComponent(code)}/all?noOfCandles=300`,
        { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error('NSE archive unavailable');
    const data = parseCandles(await response.json());
    if (data.length < 2) throw Error('NSE archive incomplete');
    return { data, source: 'Groww public NSE archive', resolution: 'sampled', prevClose: null,
        note: 'Historical candles sampled over multiple sessions' };
}
module.exports = { historical };
