const { test } = require('node:test');
const assert = require('node:assert/strict');
const { historical, parseCandles } = require('../src/services/BankexHistory');
test('BANKEX history rejects malformed/future bars and sorts real source timestamps', () => {
    const data = parseCandles({ candles: [[1700000000, 100, 110, 90, 105, null], [1600000000, 90, 105, 85, 100, 12],
        [1700000000, 100, 110, 90, 105, null], [1900000000, 100, 110, 90, 105, 0], [1700000060, 100, 80, 95, 105, 0]] }, new Date('2026-11-16'));
    assert.equal(data.length, 2);
    assert.equal(data[0].close, 100);
    assert.equal(data[1].volume, 0);
});
test('BANKEX ranges stay on the exact BSE instrument and preserve source aggregation', async () => {
    const saved = global.fetch, urls = [];
    global.fetch = async url => { urls.push(url); return { ok: true, json: async () => ({ candles: [[1600000000, 90, 105, 85, 100], [1700000000, 100, 110, 90, 105]] }) }; };
    try {
        const year = await historical('1y'), all = await historical('max');
        assert.equal(year.data.length, 2); assert.equal(year.resolution, 'daily');
        assert.equal(all.resolution, 'sampled');
        assert(urls.every(url => url.includes('/exchange/BSE/segment/CASH/14/')));
        assert(urls[1].endsWith('/all?noOfCandles=300'));
    } finally { global.fetch = saved; }
});
