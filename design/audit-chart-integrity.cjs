const fs = require('node:fs');
const path = require('node:path');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? walk(path.join(dir, e.name)) : /\.(tsx?|js)$/.test(e.name) ? [path.join(dir, e.name)] : []);
const symbols = [...new Set(walk('frontend/src').concat(walk('backend/src')).flatMap(file =>
    [...fs.readFileSync(file, 'utf8').matchAll(/\bsymbol:\s*['"`]([A-Z0-9&-]+\.(?:NS|BO))['"`]/g)].map(m => m[1])))].sort();
symbols.push('^NSEI', '^BSESN', '^NSEBANK', '^MIDCPNIFTY', '^FINNIFTY', '^BANKEX');
const host = process.env.AUDIT_HOST || 'https://papertradex-roib.onrender.com';
const periods = process.env.AUDIT_PERIODS ? process.env.AUDIT_PERIODS.split(',') : ['1d', '1w', '1mo', '3mo', '6mo', '1y', '3y', '5y', 'max'];
const output = process.env.AUDIT_OUTPUT || 'design/chart-integrity-2026-11-18.json';
const results = []; let cursor = 0;
const day = date => new Date(Date.parse(date) + 330 * 60000).toISOString().slice(0, 10);
async function read(url) {
    const start = Date.now();
    try { const r = await fetch(host + url, { signal: AbortSignal.timeout(25000) });
        return { status: r.status, ms: Date.now() - start, body: await r.json() }; }
    catch (e) { return { status: 0, ms: Date.now() - start, body: { error: e.message } }; }
}
function save() { fs.writeFileSync(output, JSON.stringify({ at: new Date().toISOString(), host, symbols: symbols.length, periods, checked: results.length, results }, null, 2)); }
async function worker() {
    while (cursor < symbols.length) {
        const symbol = symbols[cursor++], base = '/api/stock/' + encodeURIComponent(symbol);
        const [daily, quote] = await Promise.all([read(base + '/history?period=1mo'), read(base + '/realtime')]);
        const ranges = new Map((daily.body.data || []).map(p => [day(p.date), p]));
        const row = { symbol, quote, series: {} };
        for (const period of periods) {
            const response = period === '1mo' ? daily : await read(base + '/history?period=' + period);
            const points = response.body.data || [], issues = [];
            let previous = -Infinity;
            for (const point of points) {
                const at = Date.parse(point.date);
                if (!Number.isFinite(at) || at > Date.now() + 15000 || !(point.close > 0) || !Number.isFinite(point.close)) issues.push({ type: 'invalid', point });
                if (at <= previous) issues.push({ type: 'date-order', point });
                previous = at;
                if (point.high != null && point.low != null && (point.close > point.high + .02 || point.close < point.low - .02)) issues.push({ type: 'ohlc', point });
                const range = Number.isFinite(at) && ranges.get(day(point.date));
                if (['1d', '1w'].includes(period) && range?.high > 0 && range?.low > 0 &&
                    (point.close > range.high + .02 || point.close < range.low - .02)) issues.push({ type: 'daily-range', point, range });
            }
            const last = points.at(-1), q = quote.body;
            if (last && q.price > 0 && Math.abs(last.close - q.price) > .02) issues.push({ type: 'endpoint-mismatch', chartPrice: last.close, quotePrice: q.price, chartTime: last.date, quoteTime: q.timestamp });
            row.series[period] = { status: response.status, ms: response.ms, count: points.length, source: response.body.source, issues, body: response.body };
        }
        results.push(row); save();
        console.log(JSON.stringify({ checked: results.length, total: symbols.length, symbol, issues: Object.entries(row.series).filter(([,r]) => r.status !== 200 || r.issues.length).map(([p,r]) => [p,r.status,r.issues.length]) }));
    }
}
Promise.all([worker(), worker()]).then(() => { save(); console.log('Audit complete: ' + output); }).catch(e => { save(); console.error(e); process.exitCode = 1; });
