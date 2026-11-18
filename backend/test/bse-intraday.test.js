const { test } = require('node:test');
const assert = require('node:assert/strict');
const { historical, withinSessionRange } = require('../src/services/BseIntraday');
const at = time => Date.parse(`2026-11-18T${time}+05:30`) / 1000;
const daily = { data: [{ date: '2026-11-17T03:45:00Z', close: 82532.19 },
    { date: '2026-11-18T03:45:00Z', low: 81780.47, high: 82578.87, close: 82031.81 }] };

test('verified BSE identity and real daily close remove the inconsistent fallback spike', async () => {
    const saved = global.fetch;
    const urls = [];
    global.fetch = async url => { urls.push(url); return { ok: true, json: async () => ({ candles: [
        [at('09:15:00'), 82376.56, 82508.46, 82268.61, 82496.46],
        [at('15:29:00'), 82030.21, 82031.81, 82030.21, 82031.81],
    ] }) }; };
    try {
        const result = await historical('^BSESN', async () => daily, new Date('2026-11-18T16:00:00+05:30'));
        assert(urls[0].includes('/exchange/BSE/segment/CASH/1/daily'));
        assert.equal(result.prevClose, 82532.19);
        assert.equal(result.data.at(-1).close, 82031.81);
        assert.equal(result.data.at(-1).date, '2026-11-18T10:00:00.000Z');
        assert.equal(result.source, 'Groww public BSE intraday');
        assert.equal(result.delayed, true);
        assert(!withinSessionRange([{ close: 82744.97 }], daily.data.at(-1)));
        assert(withinSessionRange([{ close: 82030.21 }], daily.data.at(-1)));
    } finally { global.fetch = saved; }
});

test('BSE chart rejects wrong-session and out-of-range candles rather than smoothing them', async () => {
    const saved = global.fetch;
    try {
        global.fetch = async () => ({ ok: true, json: async () => ({ candles: [
            [at('15:20:00'), 82700, 82744.97, 82700, 82744.97],
            [at('15:21:00'), 82000, 82040, 82000, 82030],
        ] }) });
        await assert.rejects(historical('^BSESN', async () => daily, new Date('2026-11-18T16:00:00+05:30')), /daily range/);
        await assert.rejects(historical('^BSESN', async () => daily, new Date('2026-11-19T16:00:00+05:30')), /session unavailable/);
    } finally { global.fetch = saved; }
});
