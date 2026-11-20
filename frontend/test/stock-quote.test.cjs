const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(name, modules = {}) {
    const result = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/' + name), 'utf8'),
        { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
        { exports: result, require: key => modules[key] });
    return result;
}
const { stockQuote } = load('stockQuote.ts', { './quoteSymbol': load('quoteSymbol.ts') });
const now = Date.now();
const state = { livePrices: { ABC: 110, 'ABC.BO': 120 }, liveChanges: { ABC: 1 },
    livePreviousClose: { ABC: 100, 'ABC.BO': 115 }, quoteTimes: { ABC: now, 'ABC.BO': now },
    quoteSources: { ABC: 'nse', 'ABC.BO': 'bse' }, marketOpen: true };
test('stock, watchlist and dashboard aliases resolve one price and matching previous-close change', () => {
    const a = stockQuote(state, 'abc.ns', now), b = stockQuote(state, ' ABC ', now);
    assert.equal(a.price, b.price); assert.equal(a.price, 110);
    assert.equal(a.change, 10); assert.equal(a.percent, 10);
    assert.equal(a.timestamp, b.timestamp); assert.equal(a.stale, false);
    const next = stockQuote({ ...state, livePrices: { ABC: 111 } }, 'ABC.NS', now);
    assert.equal(next.price, 111); assert.equal(next.change, 11); assert.equal(next.percent, 11);
});
test('BSE prices keep their own identity and unavailable instruments never borrow NSE quotes', () => {
    const bse = stockQuote(state, 'abc.bo', now);
    assert.equal(bse.price, 120); assert.equal(bse.previousClose, 115); assert.equal(bse.source, 'bse');
    assert.equal(stockQuote(state, 'MISSING.BO', now).price, null);
});
test('stale, missing and future observations stay stale across every price surface', () => {
    assert.equal(stockQuote(state, 'ABC', now + 61000).stale, true);
    assert.equal(stockQuote({ ...state, marketOpen: false }, 'ABC', now + 61000).stale, false);
    assert.equal(stockQuote(state, 'MISSING', now).stale, true);
    assert.equal(stockQuote({ ...state, quoteTimes: { ABC: now + 60000 } }, 'ABC', now).stale, true);
});
