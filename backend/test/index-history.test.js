const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseHistory, historical } = require('../src/services/OfficialIndexHistory');
const { aggregateDaily, chartPreviousClose } = require('../src/services/HistoricalClient');
const name = 'NIFTY FINANCIAL SERVICES';
const { indexPreviousClose } = require('../src/services/HistoricalClient');

test('index fallback uses the actual prior session instead of multi-day chart metadata', () => {
    const bars = [
        { date: '2026-11-16T09:59:00Z', close: 82104.8 },
        { date: '2026-11-17T09:59:00Z', close: 82532.19 },
        { date: '2026-11-18T08:00:00Z', close: 81827.7 },
    ];
    const staleMeta = { previousClose: 82104.8, chartPreviousClose: 82104.8 };
    assert.equal(indexPreviousClose(null, staleMeta, bars), 82532.19);
    assert.equal(indexPreviousClose({ regularMarketTime: new Date('2026-11-16T10:00:00Z'),
        regularMarketPrice: 82104.8, regularMarketChange: 100 }, staleMeta, bars), 82532.19);
    assert.equal(indexPreviousClose(null, staleMeta, bars,
        { asOf: '2026-11-17', price: 82535 }), 82535);
    assert.equal(indexPreviousClose(null, staleMeta, bars,
        { asOf: '2026-11-16', price: 82104.8 }), 82532.19);
});

test('Monday index baseline accepts Friday official close and same-session quote changes', () => {
    const bars = [{ date: '2026-11-13T09:59:00Z', close: 100 },
        { date: '2026-11-16T06:00:00Z', close: 105 }];
    assert.equal(indexPreviousClose(null, {}, bars, { asOf: '2026-11-13', price: 101 }), 101);
    assert.equal(indexPreviousClose({ regularMarketTime: new Date('2026-11-16T06:00:00Z'),
        regularMarketPrice: 105, regularMarketChange: 3 }, {}, bars), 102);
});
const row = (date, close, index = name) => ({ INDEX_NAME: index, HistoricalDate: date, OPEN: '100', HIGH: '120', LOW: '90', CLOSE: String(close) });

test('1D reference line uses session previous close instead of the chart-window baseline', () => {
    assert.equal(chartPreviousClose({ regularMarketPreviousClose: 112.71 }, { previousClose: 112.71, chartPreviousClose: 116.86 }), 112.71);
    assert.equal(chartPreviousClose(null, { previousClose: 112.71, chartPreviousClose: 116.86 }), 112.71);
    assert.equal(chartPreviousClose({ regularMarketPreviousClose: 0 }, { chartPreviousClose: 116.86 }), 116.86);
    assert.equal(chartPreviousClose({ regularMarketPrice: 82778.38, regularMarketChange: 673.59375, regularMarketPreviousClose: 81592.5 }), 82104.79);
});

test('official history keeps the exact index, date range, ordering and unique sessions', () => {
    const rows = [row('13 Nov 2026', 115), row('12 Nov 2026', 110), row('12 Nov 2026', 110),
        row('13 Nov 2026', 999, 'NIFTY FINANCIAL SERVICES 25/50'), row('11 Nov 2025', 99), row('bad date', 105)];
    const data = parseHistory({ d: JSON.stringify(rows) }, name, new Date('2026-11-01'), new Date('2026-11-15'));
    assert.deepEqual(data.map(q => q.close), [110, 115]);
    assert.equal(data[1].date, '2026-11-13T10:00:00.000Z');
});

test('official daily history is labelled and cannot be substituted for intraday', async () => {
    const saved = global.fetch;
    global.fetch = async (url, options) => {
        const request = JSON.parse(JSON.parse(options.body).cinfo);
        assert.equal(request.name, name);
        return { ok: true, json: async () => [row('12 Nov 2026', 110), row('13 Nov 2026', 115)] };
    };
    try {
        const result = await historical('^FINNIFTY', '1mo', 32, new Date('2026-11-15T12:00:00Z'));
        assert.equal(result.data.length, 2);
        assert.equal(result.data[1].close, 115);
        assert.equal(result.prevClose, 110);
        assert.equal(result.resolution, 'daily');
        assert.equal(result.note, 'Official daily history');
        await assert.rejects(historical('^FINNIFTY', '1d', 5), /intraday reader/);
    } finally { global.fetch = saved; }
});

test('BANKEX hourly bars aggregate by IST session without making up missing prices', () => {
    const data = aggregateDaily([
        { date: '2026-11-13T04:00:00Z', open: 100, high: 115, low: 99, close: 110, volume: 2 },
        { date: '2026-11-12T10:00:00Z', open: 95, high: 101, low: 94, close: 100, volume: 3 },
        { date: '2026-11-13T10:00:00Z', open: 110, high: 120, low: 105, close: 117, volume: 4 },
    ]);
    assert.equal(data.length, 2);
    assert.deepEqual(data[1], { date: '2026-11-13T10:00:00Z', open: 100, high: 120, low: 99, close: 117, volume: 6 });
});
