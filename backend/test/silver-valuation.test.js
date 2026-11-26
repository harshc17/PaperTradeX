const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseBenchmark, frontContract } = require('../src/services/SilverQuotes');
const { trailingPE, datedEarnings } = require('../src/services/StockValuation');

test('physical silver uses the latest published IBJA session and ignores missing or unrelated prices', () => {
    const am = '<span id="lblSilver999_AM">1,46,933</span>';
    assert.deepEqual(parseBenchmark(am + '<span id="lblSilver999_PM"></span>'), { price: 146933, session: 'AM' });
    assert.deepEqual(parseBenchmark(am + '<span id="lblSilver999_PM">147000</span>'), { price: 147000, session: 'PM' });
    assert.equal(parseBenchmark('<span id="lblGold999_AM">122982</span>'), null);
});

test('MCX quote selection rejects options, wrong units and expired contracts', () => {
    const now = Date.parse('2026-11-26T07:01:00Z');
    const near = { symbol: 'SILVER', exchange: 'MCX', type: 'future', currency: 'INR', unit: 'kg', price: 145748,
        expiry: '2026-12-04', tradedAt: '2026-11-26T07:00:00Z' };
    const rows = [
        { ...near, expiry: '2026-11-25' }, { ...near, type: 'option' }, { ...near, unit: 'g' },
        { ...near, tradedAt: '2026-11-06T07:00:00Z' }, { ...near, tradedAt: '2026-11-26T07:05:00Z' },
        { ...near, expiry: '2027-03-05' }, near,
    ];
    assert.deepEqual(frontContract(rows, 'SILVER', now), near);
    assert.equal(frontContract(rows, 'SILVERM', now), null);
});

test('Reliance P/E falls back to filing-derived trailing EPS and a time-verified share price', async () => {
    const now = Date.parse('2026-11-26T07:01:00Z');
    const input = { now, getFundamentals: async () => null, getQuote: async () => ({ price: 1400, timestamp: '2026-11-26T07:00:00Z' }) };
    const result = await trailingPE('RELIANCE.NS', input);
    assert.equal(result.eps, 60.68);
    assert.equal(result.multiple.toFixed(2), '23.07');
    assert.equal(await trailingPE('RELIANCE.BO', input), null);
    assert.equal(await trailingPE('RELIANCE.NS', { ...input, now: Date.parse('2027-04-05') }), null);
});

test('stock P/E accepts dated, exchange-specific Yahoo EPS and preserves reported losses', async () => {
    const now = Date.parse('2026-11-26T07:01:00Z');
    const row = { asOfDate: '2026-09-30', periodType: 'TTM', currencyCode: 'INR', reportedValue: { raw: 143.36 } };
    const payload = { timeseries: { result: [{ meta: { symbol: ['HAL.NS'], type: ['trailingDilutedEPS'] },
        trailingDilutedEPS: [row, { ...row, asOfDate: '2026-12-31' }, { ...row, asOfDate: '2026-10-01', currencyCode: 'USD' }] }] } };
    const earnings = datedEarnings(payload, 'HAL.NS', now);
    assert.equal(earnings.eps, 143.36);
    assert.equal(datedEarnings(payload, 'HAL.BO', now), null);
    const getQuote = async () => ({ price: 4920, timestamp: '2026-11-26T07:00:00Z' });
    const getFundamentals = async () => assert.fail('Do not call the quote fundamentals fallback when EPS is known');
    const result = await trailingPE('HAL.NS', { getQuote, getFundamentals, getEarnings: async () => earnings, now });
    assert.equal(result.multiple.toFixed(2), '34.32');
    const loss = await trailingPE('HAL.NS', { getQuote, getFundamentals, getEarnings: async () => ({ ...earnings, eps: -5 }), now });
    assert.equal(loss.multiple, null);
});
