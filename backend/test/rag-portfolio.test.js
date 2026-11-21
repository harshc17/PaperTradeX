const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../../frontend/node_modules/typescript');
const { buildPortfolioSnapshot, calculateDailyReturn } = require('../src/services/RagPortfolio');
const moduleExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../../frontend/src/lib/dailyReturn.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: moduleExports });
const snapshot = (account, trades, quotes, marketOpen = true) => buildPortfolioSnapshot(account, trades, {
    getQuote: async symbol => quotes[symbol], marketOpen, sessionDate: '2026-11-20',
});
const trade = (type, quantity, totalAmount, symbol = 'ABC') => ({ type, quantity, totalAmount, price: totalAmount / quantity, symbol, createdAt: '2026-11-20T05:00:00Z' });
test('RAG session returns match Dashboard/Holdings across partial sales, additions and missing quotes', () => {
    for (let opening = 0; opening <= 10; opening++) for (let bought = 0; bought <= 3; bought++) for (let sold = 0; sold <= opening + bought; sold++) {
        const quantity = opening + bought - sold;
        const holdings = quantity ? [{ symbol: 'ABC.NS', quantity }] : [];
        const trades = [...(bought ? [trade('BUY', bought, bought * 103.47)] : []), ...(sold ? [trade('SELL', sold, sold * 109.18)] : [])];
        for (const [prices, closes] of [[{ ABC: 110.28 }, { ABC: 101.33 }], [{}, { ABC: 101.33 }], [{ ABC: 110.28 }, {}]]) {
            const expected = moduleExports.calculateDailyReturn(holdings, trades, prices, closes, '2026-11-20');
            assert.deepEqual(calculateDailyReturn(holdings, trades, prices, closes, '2026-11-20'), JSON.parse(JSON.stringify(expected)));
        }
    }
});
test('snapshot uses authoritative holdings cost, excludes cash from returns and preserves exchange identity', async () => {
    const now = new Date().toISOString();
    const account = { balance: 5000, holdings: [{ symbol: 'ABC.NS', quantity: 7, averagePrice: 102.1234 }, { symbol: 'ABC.BO', quantity: 1, averagePrice: 90 }] };
    const quotes = { ABC: { price: 110, prevClose: 100, timestamp: now }, 'ABC.BO': { price: 95, prevClose: 92, timestamp: now } };
    const result = await snapshot(account, [trade('BUY', 2, 210), trade('SELL', 5, 600)], quotes);
    assert.equal(result.balance, 5000); assert.equal(result.currentValue, 865);
    assert.equal(result.invested, Number((7 * 102.1234 + 90).toFixed(2)));
    assert.equal(result.totalReturns, Number((865 - (7 * 102.1234 + 90)).toFixed(2)));
    assert.equal(result.todayReturns, 163); assert.equal(result.quotesDelayedOrUnavailable, false);
    assert.equal(result.holdings[0].averagePrice, 102.1234); assert.equal(result.holdings[1].price, 95);
    assert.ok(!JSON.stringify(result).includes('owner'));
});
test('unavailable quotes do not fabricate zero returns; delayed and closed quotes retain timestamps', async () => {
    const account = { balance: 0, holdings: [{ symbol: 'ABC', quantity: 1, averagePrice: 100 }] };
    const missing = await snapshot(account, [], {});
    assert.equal(missing.currentValue, null); assert.equal(missing.totalReturns, null); assert.equal(missing.todayReturns, null);
    assert.equal(missing.holdings[0].status, 'unavailable');
    const old = { ABC: { price: 110, prevClose: 100, timestamp: new Date(Date.now() - 120000).toISOString() } };
    const delayed = await snapshot(account, [], old);
    assert.equal(delayed.currentValue, 110); assert.equal(delayed.quotesDelayedOrUnavailable, true); assert.equal(delayed.holdings[0].status, 'delayed');
    const closed = await snapshot(account, [], old, false);
    assert.equal(closed.holdings[0].status, 'market_closed'); assert.equal(closed.holdings[0].quoteAt, old.ABC.timestamp);
    const noReference = await snapshot(account, [], { ABC: { price: 110, timestamp: new Date().toISOString() } });
    assert.equal(noReference.totalReturns, 10); assert.equal(noReference.todayReturns, null);
});
test('no holdings and sold-out positions retain balance and actual session sale return', async () => {
    const empty = await snapshot({ balance: 100000, holdings: [] }, [], {});
    assert.equal(empty.currentValue, 0); assert.equal(empty.totalReturns, 0); assert.equal(empty.todayReturns, 0);
    const sold = await snapshot({ balance: 100100, holdings: [] }, [trade('SELL', 10, 1100)], { ABC: { price: 110, prevClose: 100, timestamp: new Date().toISOString() } });
    assert.equal(sold.currentValue, 0); assert.equal(sold.todayReturns, 100);
});
test('malformed account data and excessive holdings are rejected instead of partially valued', async () => {
    await assert.rejects(snapshot({ balance: NaN, holdings: [] }, [], {}));
    await assert.rejects(snapshot({ balance: 0, holdings: [{ symbol: 'X', quantity: -1, averagePrice: 1 }] }, [], {}));
    await assert.rejects(snapshot({ balance: 0, holdings: Array(201).fill({ symbol: 'X', quantity: 1, averagePrice: 1 }) }, [], {}));
});
