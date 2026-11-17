const { test } = require('node:test');
const assert = require('node:assert/strict');
const { quoteKey, nseQuoteTime, isFreshQuote } = require('../src/services/QuoteIdentity');
const { providerSymbol } = require('../src/services/InstrumentAliases');
const path = require('node:path');
const root = path.resolve(__dirname, '../src/services');
let processed = [];
for (const [file, exports] of Object.entries({
    'NSEClient.js': { _inBackoff: false, equityQuote: async () => { throw Error('blocked'); } },
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

test('retired ticker lookup uses its current security without crossing exchanges', () => {
    assert.equal(providerSymbol('ZOMATO.NS'), 'ETERNAL.NS');
    assert.equal(providerSymbol('LTIM'), 'LTM');
    assert.equal(providerSymbol('SETFNIF50.NS'), 'SBINIFTY50.NS');
    assert.equal(providerSymbol('ICICIBANKP'), 'PVTBANIETF');
    assert.notEqual(providerSymbol('ICICIBANKP'), 'BANKIETF');
    assert.equal(providerSymbol('RELIANCE.BO'), 'RELIANCE.BO');
    assert.equal(providerSymbol('LTIM.BO'), 'LTIM.BO');
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

test('duplicate ticks do not reprocess orders, but new timestamps and price corrections do', () => {
    const service = new MarketData({ emit() {} });
    processed = [];
    const at = Date.now() - 1000;
    const first = service._updateCache('RELIANCE', 100, 1, 1, 'Reliance', at);
    assert.equal(service._updateCache('RELIANCE.NS', 100, 1, 1, 'Reliance', at), first);
    assert.equal(processed.length, 1);
    service._updateCache('RELIANCE', 100, 2, 2, 'Reliance', at);
    assert.equal(service.cache.RELIANCE.change, 2);
    assert.equal(processed.length, 1);
    service._updateCache('RELIANCE', 100, 2, 2, 'Reliance', at + 100);
    service._updateCache('RELIANCE', 101, 3, 3, 'Reliance', at + 100);
    assert.equal(processed.length, 3);
});

test('view-only index ticks never invoke order processing', () => {
    const service = new MarketData({ emit() {} });
    processed = [];
    for (const symbol of ['^NSEI', '^BSESN', '^NSEBANK', '^MIDCPNIFTY', '^FINNIFTY', '^BANKEX']) {
        service._updateCache(symbol, 100, 1, 1, symbol, Date.now());
        assert.equal(service.cache[symbol].price, 100);
    }
    assert.equal(processed.length, 0);
});

test('trades reuse an accepted fresh shared quote and refresh only when stale', async () => {
    const service = new MarketData({ emit() {} });
    const fresh = { price: 100, timestamp: new Date(Date.now() - 10000) };
    service.cache.RELIANCE = fresh;
    let refreshes = 0;
    service.refreshSymbol = async key => { refreshes++; assert.equal(key, 'RELIANCE'); return { price: 101, timestamp: new Date() }; };
    assert.equal(await service.tradeQuote('RELIANCE.NS'), fresh);
    assert.equal(refreshes, 0);
    service.cache.RELIANCE = { price: 100, timestamp: new Date(Date.now() - 61000) };
    assert.equal((await service.tradeQuote('RELIANCE')).price, 101);
    assert.equal(refreshes, 1);
});
