const { test } = require('node:test');
const assert = require('node:assert/strict');
const closingQuote = require('../src/services/ClosingQuote');
test('quote failure can recover the real latest session close with its original timestamp', async () => {
    const quote = await closingQuote('HDFCBANK', '2026-11-17', async (symbol, period) => {
        assert.equal(symbol, 'HDFCBANK'); assert.equal(period, '1d');
        return { prevClose: 816.5, data: [{ date: '2026-11-17T09:58:00.000Z', close: 814.9500122070312 }] };
    });
    assert.equal(quote.price, 814.95); assert.equal(quote.prevClose, 816.5);
    assert.equal(quote.change, -1.55); assert.equal(quote.timestamp, '2026-11-17T09:58:00.000Z');
});
test('older sessions and incomplete chart data cannot masquerade as the latest close', async () => {
    for (const series of [
        { prevClose: 100, data: [{ date: '2026-11-16T10:00:00Z', close: 110 }] },
        { data: [{ date: '2026-11-17T10:00:00Z', close: 110 }] },
        { prevClose: 100, data: [] },
    ]) assert.equal(await closingQuote('ITC', '2026-11-17', async () => series), null);
});
