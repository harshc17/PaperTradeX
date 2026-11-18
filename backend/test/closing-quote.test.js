const { test } = require('node:test');
const assert = require('node:assert/strict');
const closingQuote = require('../src/services/ClosingQuote');

test('final daily close replaces a delayed intraday endpoint without fabricating missing candles', async () => {
    const quote = await closingQuote('HDFCBANK', '2026-11-18', async (symbol, period) => {
        assert.equal(period, '1mo');
        return { data: [{ date: '2026-11-17T03:45:00Z', close: 814.950012 },
            { date: '2026-11-18T03:45:00Z', close: 808.150024 }] };
    });
    assert.equal(quote.price, 808.15);
    assert.equal(quote.prevClose, 814.95);
    assert.equal(quote.change, -6.8);
    assert.equal(+quote.timestamp, Date.parse('2026-11-18T10:00:00Z'));
    assert.equal(quote.barTimestamp, '2026-11-18T03:45:00Z');
    assert.equal(quote.source, 'daily-session-close');
});

test('closing quotes keep price, daily change and previous close consistent for all assets', () => {
    for (const values of [
        { regularMarketPrice: 82031.81, regularMarketChange: -500.38, regularMarketPreviousClose: 82104.8, expected: 82532.19 },
        { regularMarketPrice: 105, regularMarketChange: 5, regularMarketPreviousClose: 98, expected: 100 },
        { regularMarketPrice: 110, regularMarketPreviousClose: 100, expected: 100 },
    ]) {
        const q = closingQuote.fromProvider({ ...values, regularMarketTime: new Date('2026-11-18T10:02:11Z') }, '2026-11-18');
        assert.equal(q.prevClose, values.expected);
        assert.equal(q.change, Math.round((q.price - q.prevClose) * 100) / 100);
        assert.equal(q.dayChange, q.change / q.prevClose * 100);
    }
    assert.equal(closingQuote.fromProvider({ regularMarketPrice: 105, regularMarketChange: 5,
        regularMarketTime: new Date('2026-11-17T10:02:11Z') }, '2026-11-18'), null);
});
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
