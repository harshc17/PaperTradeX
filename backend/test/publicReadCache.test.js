const { test } = require('node:test');
const assert = require('node:assert/strict');
const PublicReadCache = require('../src/services/PublicReadCache');

test('simultaneous chart reads make one upstream request and reuse its result', async () => {
    const cache = new PublicReadCache(); let calls = 0;
    let release;
    const read = () => { calls++; return new Promise(resolve => { release = resolve; }); };
    const first = cache.load('NSE:INFY:1d', 10000, read);
    const second = cache.load('NSE:INFY:1d', 10000, read);
    await Promise.resolve(); release({ data: [1] });
    assert.deepEqual(await first, await second);
    assert.equal(calls, 1);
    await cache.load('NSE:INFY:1d', 10000, read);
    assert.equal(calls, 1);
});

test('expired, failed and empty reads can retry; exchange and period keys stay separate', async () => {
    const cache = new PublicReadCache(2);
    await assert.rejects(cache.load('NSE:INFY:1d', 1000, async () => { throw Error('timeout'); }));
    assert.equal(await cache.load('NSE:INFY:1d', 0, async () => 10), 10);
    assert.equal(await cache.load('NSE:INFY:1d', 1000, async () => 11), 11);
    assert.equal(await cache.load('BSE:INFY:1d', 1000, async () => 12), 12);
    assert.equal(await cache.load('NSE:INFY:1mo', 1000, async () => 13), 13);
    assert.equal(cache.entries.size, 2);
    await cache.load('empty', 1000, async () => [], value => value.length > 0);
    assert.equal(cache.entries.has('empty'), false);
});
