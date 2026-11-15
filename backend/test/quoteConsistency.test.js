const { test } = require('node:test');
const assert = require('node:assert/strict');
const { quoteKey, nseQuoteTime, isFreshQuote } = require('../src/services/QuoteIdentity');
const path = require('node:path');
const root = path.resolve(__dirname, '../src/services');
let processed = [];
for (const [file, exports] of Object.entries({
    'NSEClient.js': { equityQuote: async () => { throw Error('blocked'); } },
    'HistoricalClient.js': { quoteDetail: async symbol => ({ regularMarketPrice: symbol.endsWith('.BO') ? 140 : 110,
        regularMarketChange: 10, regularMarketChangePercent: 10, regularMarketTime: new Date() }) },
    'TradeEngine.js': { processMarketTick: async (...tick) => { processed.push(tick); } },
})) require.cache[path.join(root, file)] = { exports };
const MarketData = require('../src/services/MarketData');

test('exchange identities remain separate and NSE timestamps use IST', () => {
    assert.equal(quoteKey('reliance.ns'), 'RELIANCE');
    assert.equal(quoteKey('reliance.bo'), 'RELIANCE.BO');
    assert.equal(nseQuoteTime('13-Nov-2026 15:30:00'), Date.parse('2026-11-13T10:00:00Z'));
});

test('fallback requests share one quote per exchange without cache collisions', async () => {
    const service = new MarketData({ emit() {} });
    const [nse, bse, again] = await Promise.all([
        service.refreshSymbol('RELIANCE.NS'), service.refreshSymbol('RELIANCE.BO'), service.refreshSymbol('RELIANCE'),
    ]);
    assert.equal(nse, again);
    assert.equal(nse.price, 110); assert.equal(bse.price, 140);
    assert.equal(service.cache['RELIANCE.NS'], service.cache.RELIANCE);
    assert.notEqual(service.cache['RELIANCE.BO'], service.cache.RELIANCE);
});

test('older quotes cannot overwrite newer prices or trigger execution', () => {
    const service = new MarketData({ emit() {} });
    processed = [];
    const newer = service._updateCache('INFY', 200, 10, 5, 'Infosys', Date.now());
    const older = service._updateCache('INFY', 100, -90, -45, 'Infosys', Date.now() - 120000);
    assert.equal(older, newer); assert.equal(service.cache.INFY.price, 200);
    assert.equal(processed.length, 1);
});

test('stale and unknown timestamps never fill paper orders or appear fresh', () => {
    const service = new MarketData({ emit() {} });
    processed = [];
    const stale = service._updateCache('TCS', 100, 0, 0, 'TCS', Date.now() - 120000);
    assert.equal(isFreshQuote(stale), false);
    assert.equal(service._updateCache('SBIN', 100, 0, 0, 'SBI'), null);
    assert.equal(processed.length, 0);
});
