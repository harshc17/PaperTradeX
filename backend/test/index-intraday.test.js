const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCandles, historical } = require('../src/services/IndexIntraday');
const at = time => Date.parse(`2026-11-13T${time}+05:30`) / 1000;
const candle = time => [at(time), 100, 110, 95, 105, null];

test('intraday parser keeps real regular-session candles, rejects stale and future data', () => {
    const data = parseCandles({ candles: [candle('09:16:00'), candle('09:15:00'), candle('09:15:00'),
        candle('08:00:00'), candle('17:00:00'), [at('09:20:00'), 100, 90, 95, 105],
        [Date.parse('2025-12-05T09:15:00+05:30') / 1000, 100, 110, 95, 105]] },
    '2026-11-13', new Date('2026-11-13T09:17:00+05:30'));
    assert.equal(data.length, 2);
    assert.equal(data[0].date, '2026-11-13T03:45:00.000Z');
    assert.equal(data[1].close, 105);
    assert.equal(data[1].volume, 0);
    assert.deepEqual(parseCandles({ candles: [candle('09:15:00')] }, '2026-11-16'), []);
});

test('exact index feeds use session validation and the correct prior-session baseline', async () => {
    const snapshot = require('../src/services/OfficialIndexSnapshot');
    const saved = { fetch: global.fetch, latest: snapshot.latest };
    const requested = [];
    global.fetch = async url => { requested.push(url); return { ok: true, json: async () => ({ candles: [candle('09:15:00'), candle('09:16:00')], closingPrice: null }) }; };
    snapshot.latest = async () => ({ '^FINNIFTY': { price: 105, prevClose: 102, asOf: '2026-11-13' }, '^MIDCPNIFTY': { price: 105, prevClose: 101, asOf: '2026-11-13' } });
    try {
        const fin = await historical('^FINNIFTY', new Date('2026-11-15T12:00:00Z'));
        const mid = await historical('^MIDCPNIFTY', new Date('2026-11-15T12:00:00Z'));
        assert.equal(fin.data.length, 2);
        assert.equal(fin.prevClose, 102);
        assert.equal(mid.prevClose, 101);
        assert.equal(fin.delayed, true);
        assert.equal(fin.resolution, 'intraday');
        assert(requested[0].includes('/FINNIFTY/daily?intervalInMinutes=1'));
        assert(requested[1].includes('/NIFTYMIDSELECT/daily?intervalInMinutes=1'));
        await assert.rejects(historical('^FINNIFTY', new Date('2026-11-16T10:00:00+05:30')), /Current-session/);
    } finally { global.fetch = saved.fetch; snapshot.latest = saved.latest; }
});
