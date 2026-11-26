const { test } = require('node:test');
const assert = require('node:assert/strict');
let calls = 0, seen = [];
const defaultQuote = async () => [
    { symbol: 'RELIANCE.NS', regularMarketPrice: 100, regularMarketTime: new Date() },
    { symbol: 'RELIANCE.BO', regularMarketPrice: 101, regularMarketTime: new Date() },
    { symbol: 'WRONG.NS', regularMarketPrice: 999 },
    { symbol: '^NSEI', regularMarketPrice: 25000, regularMarketTime: new Date() },
];
let quoteImpl = defaultQuote, combineImpl = async () => undefined;
let chartImpl = async () => ({ quotes: [{ close: 105, date: new Date() }], meta: { chartPreviousClose: 90 } });
class Yahoo {
    async quote(symbols) { calls++; seen = symbols; return quoteImpl(symbols); }
    async quoteCombine(...args) { return combineImpl(...args); }
    async chart(...args) { return chartImpl(...args); }
}
require.cache[require.resolve('yahoo-finance2')] = { exports: { default: Yahoo } };
require.cache[require.resolve('../src/services/TradeEngine')] = { exports: { processMarketTick: async () => {} } };
const history = require('../src/services/HistoricalClient');
const cashReport = require('../src/services/OfficialCashClose');
cashReport.quote = async () => null;

test('batched live reads coalesce viewers and preserve exact NSE/BSE identities', async () => {
    const [a, b] = await Promise.all([
        history.quoteBatch(['RELIANCE', 'RELIANCE.BO', '^NSEI', '^MIDCPNIFTY']),
        history.quoteBatch(['RELIANCE', 'RELIANCE.BO', '^NSEI', '^MIDCPNIFTY']),
    ]);
    assert.equal(calls, 1); assert.equal(a, b);
    assert.equal(a.RELIANCE.regularMarketPrice, 100);
    assert.equal(a['RELIANCE.BO'].regularMarketPrice, 101);
    assert(!a['^MIDCPNIFTY']); assert(!seen.includes('^NSMIDCP')); assert(!a['WRONG.NS']);
});

test('quote detail recovers its exact exchange from a combined validation error', async () => {
    const saved = combineImpl;
    const nse = { symbol: 'RELIANCE.NS', regularMarketPrice: 123 };
    const bse = { symbol: 'RELIANCE.BO', regularMarketPrice: 124 };
    try {
        combineImpl = async () => { const error = new Error('schema changed'); error.name = 'FailedYahooValidationError'; error.result = [bse, nse]; throw error; };
        assert.equal(await history._quoteDetail('RELIANCE'), nse);
        assert.equal(await history._quoteDetail('RELIANCE.BO'), bse);
        assert.equal(await history._quoteDetail('NONEXISTENT'), null);
        combineImpl = async () => { const error = new Error('single result'); error.name = 'FailedYahooValidationError'; error.result = nse; throw error; };
        assert.equal(await history._quoteDetail('RELIANCE'), nse);
    } finally { combineImpl = saved; }
});

test('later chunk failure retains earlier quotes; first chunk failure still permits later quotes', async () => {
    const saved = quoteImpl;
    const symbols = Array.from({ length: 101 }, (_, i) => 'BATCH' + String(i).padStart(3, '0'));
    let chunk = 0;
    try {
        quoteImpl = async symbols => { if (++chunk === 2) throw new Error('later chunk failed'); return symbols.map(symbol => ({ symbol, regularMarketPrice: 100 })); };
        const first = await history.quoteBatch(symbols);
        assert.equal(chunk, 2); assert.equal(Object.keys(first).length, 100); assert.equal(first.BATCH000.regularMarketPrice, 100);
        chunk = 0;
        quoteImpl = async symbols => { if (++chunk === 1) throw new Error('first chunk failed'); return symbols.map(symbol => ({ symbol, regularMarketPrice: 101 })); };
        const last = await history.quoteBatch(symbols);
        assert.equal(chunk, 2); assert.deepEqual(Object.keys(last), ['BATCH100']);
    } finally { quoteImpl = saved; }
});

test('total batch failure propagates for backoff and can retry successfully', async () => {
    const saved = quoteImpl;
    try {
        quoteImpl = async () => { throw new Error('provider unavailable'); };
        await assert.rejects(history.quoteBatch(['RETRY']), /provider unavailable/);
        quoteImpl = async symbols => symbols.map(symbol => ({ symbol, regularMarketPrice: 50 }));
        assert.equal((await history.quoteBatch(['RETRY'])).RETRY.regularMarketPrice, 50);
    } finally { quoteImpl = saved; }
});

test('fast refresh preserves source timestamps and rejects older index replies', async () => {
    const MarketData = require('../src/services/MarketData');
    const service = new MarketData({ emit() {} }); service.subscribe('RELIANCE');
    await service._fetchFastQuotes(); assert.equal(service.cache.RELIANCE.price, 100); assert(!service.cache['^NSEI.NS']);
    const at = service.cache['^NSEI'].timestamp, saved = history.quoteBatch;
    history.quoteBatch = async () => ({ '^NSEI': { regularMarketPrice: 1, regularMarketTime: new Date(+at - 60000) } });
    try { await service._fetchFastQuotes(); assert.equal(service.cache['^NSEI'].price, 25000); assert.equal(+service.cache['^NSEI'].timestamp, +at); }
    finally { history.quoteBatch = saved; }
});

test('intraday index returns use the prior session close rather than the chart window start', async () => {
    const saved = combineImpl;
    const snapshot = require('../src/services/OfficialIndexSnapshot');
    const savedLatest = snapshot.latest;
    try {
        snapshot.latest = async () => ({});
        combineImpl = async symbol => ({ symbol, regularMarketPrice: 105, regularMarketPreviousClose: 100,
            regularMarketTime: new Date() });
        const quote = await history.indexQuote('^NSEI');
        assert.equal(quote.prevClose, 100);
        assert.equal(quote.change, 5);
        assert.equal(quote.dayChange, 5);
    } finally { combineImpl = saved; snapshot.latest = savedLatest; }
});

test('consecutive daily closes override stale same-day metadata for indices and stocks', () => {
    const points = [{ date: '2026-11-19T10:00:00Z', close: 83010 }, { date: '2026-11-20T10:00:00Z', close: 83919.71 }];
    const quote = { regularMarketPrice: 83919.71, regularMarketPreviousClose: 82031.8,
        regularMarketChange: 1887.91, regularMarketTime: new Date('2026-11-20T10:00:00Z') };
    const daily = [{ date: '2026-11-19T03:45:00Z', close: 83021.75 }];
    assert.equal(history.indexPreviousClose(quote, {}, points, null, daily), 83021.75);
    assert.equal(history.indexPreviousClose(quote, {}, points, { asOf: '2026-11-20', prevClose: 83021.75 }, daily), 83021.75);
    assert.equal(history.indexPreviousClose(quote, {}, points, null, [{ date: '2026-11-18T03:45:00Z', close: 82031.8 }]), 82031.8);
});

test('live batch and stock details correct stale changes using the exact prior-session daily close', async () => {
    const saved = { quoteImpl, combineImpl, historical: history.historical };
    const at = new Date('2026-11-20T10:00:00Z');
    try {
        history.historical = async symbol => ({ data: [{ date: '2026-11-19T03:45:00Z', close: symbol.endsWith('.BO') ? 301.25 : 301 }] });
        quoteImpl = async symbols => symbols.map(symbol => ({ symbol, regularMarketPrice: 299.10, regularMarketPreviousClose: 296.60, regularMarketChange: 2.50, regularMarketTime: at }));
        combineImpl = async symbol => ({ symbol, regularMarketPrice: 299.10, regularMarketChange: 2.50, regularMarketTime: at });
        const batch = await history.quoteBatch(['TESTREF', 'TESTREF.BO']);
        assert.equal(batch.TESTREF.regularMarketChange, -1.9);
        assert.equal(batch['TESTREF.BO'].regularMarketChange, -2.15);
        const detail = await history.quoteDetail('TESTDETAIL');
        assert.equal(detail.regularMarketChange, -1.9);
        assert.equal(detail.regularMarketPreviousClose, 301);
    } finally { quoteImpl = saved.quoteImpl; combineImpl = saved.combineImpl; history.historical = saved.historical; }
});

test('chart quote recovery uses the official close when the prior daily candle is missing', async () => {
    const saved = { chartImpl, combineImpl, historical: history.historical, quote: cashReport.quote };
    const observedAt = new Date('2026-11-26T06:09:23Z');
    try {
        combineImpl = async () => { throw Error('status 429'); };
        history.historical = async () => ({ data: [{ date: '2026-11-23T03:45:00Z', close: 103.05 }] });
        chartImpl = async symbol => ({ meta: {
            symbol, regularMarketPrice: 101.35, regularMarketTime: observedAt, chartPreviousClose: 99.96,
        } });
        cashReport.quote = async (symbol, session) => {
            assert.equal(symbol, 'GOLDBEES.NS');
            assert.equal(session, '2026-11-25');
            return { price: 100.11, asOf: '2026-11-25' };
        };
        const quote = await history.quoteDetail('GOLDBEES');
        assert.equal(quote.regularMarketPrice, 101.35);
        assert.equal(quote.regularMarketPreviousClose, 100.11);
        assert.equal(quote.regularMarketChange, 1.24);
        assert.equal(+quote.regularMarketTime, +observedAt);
    } finally {
        chartImpl = saved.chartImpl; combineImpl = saved.combineImpl;
        history.historical = saved.historical; cashReport.quote = saved.quote;
    }
});
