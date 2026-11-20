const { test } = require('node:test');
const assert = require('node:assert/strict');
const create = require('../src/services/QuoteRecovery');
const now = Date.parse('2026-11-20T07:00:00Z');
const meta = { symbol: 'RELIANCE.NS', regularMarketPrice: 1362.9, previousClose: 1340,
    regularMarketTime: now / 1000 - 30, regularMarketDayHigh: 1370, regularMarketDayLow: 1330 };
test('rate limits cool down the shared quote API and retry after a minute', () => {
    let time = now;
    const service = create({ now: () => time });
    service.failed(new Error('Failed to get crumb, status 429'));
    assert(service.blocked()); time += 60001; assert(!service.blocked());
});
test('chart recovery coalesces readers, retains source time, and computes real previous-close returns', async () => {
    let calls = 0;
    const service = create({ now: () => now, fetchChart: async () => { calls++; return { meta }; } });
    const [a, b] = await Promise.all([service.chart('RELIANCE.NS'), service.chart('RELIANCE.NS')]);
    assert.equal(a, b); assert.equal(calls, 1);
    assert.equal(a.regularMarketPrice, 1362.9);
    assert.equal(a.regularMarketTime.getTime(), now - 30000);
    assert(Math.abs(a.regularMarketChange - 22.9) < 0.00001);
    await service.chart('RELIANCE.NS'); assert.equal(calls, 1);
});
test('wrong exchanges, impossible prices and future times are never accepted', async () => {
    for (const patch of [{ symbol: 'RELIANCE.BO' }, { regularMarketPrice: 1500 },
        { regularMarketPrice: 0 }, { previousClose: null, chartPreviousClose: null },
        { regularMarketTime: now / 1000 + 60 }]) {
        const service = create({ now: () => now, fetchChart: async () => ({ meta: { ...meta, ...patch } }) });
        assert.equal(await service.chart('RELIANCE.NS'), null);
    }
});
test('a throttled chart is not retried by every reader until its cooldown expires', async () => {
    let calls = 0, time = now;
    const service = create({ now: () => time, fetchChart: async () => { calls++; throw Error('HTTP 429'); } });
    await assert.rejects(service.chart('TCS.NS'), /429/);
    assert.equal(await service.chart('TCS.NS'), null);
    assert.equal(calls, 1);
    time += 30001;
    await assert.rejects(service.chart('TCS.NS'), /429/);
    assert.equal(calls, 2);
});
