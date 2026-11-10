const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../../frontend/node_modules/typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../../frontend/src/lib/xirr.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: exportsObject });
const { calculateXirr, calculatePortfolioXirr, formatXirr } = exportsObject;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
const flow = (amount, date) => ({ amount, date });
const trade = (symbol, type, totalAmount, createdAt) => ({ symbol, type, totalAmount, createdAt });

test('Microsoft irregular cash-flow reference and unsorted input', () => {
    const flows = [flow(-10000, '2008-01-01'), flow(2750, '2008-03-01'), flow(4250, '2008-10-30'), flow(3250, '2009-02-15'), flow(2750, '2009-04-01')];
    near(calculateXirr(flows).rate, 0.373362535);
    near(calculateXirr(flows.reverse()).rate, 0.373362535);
});
test('one year gain, loss, zero return, and short-history annualisation', () => {
    near(calculateXirr([flow(-100, '2025-11-10'), flow(110, '2026-11-10')]).rate, .1);
    near(calculateXirr([flow(-100, '2025-11-10'), flow(80, '2026-11-10')]).rate, -.2);
    near(calculateXirr([flow(-100, '2025-11-10'), flow(100, '2026-11-10')]).rate, 0);
    near(calculateXirr([flow(-100, '2026-11-09'), flow(101, '2026-11-10')]).rate, Math.pow(1.01, 365) - 1);
});
test('same IST day, one-sided flows and invalid data do not invent a rate', () => {
    assert.equal(calculateXirr([flow(-100, '2026-11-09T20:00:00Z'), flow(110, '2026-11-10')]).rate, null);
    assert.equal(calculateXirr([flow(110, '2026-11-10')]).rate, null);
    assert.equal(calculateXirr([flow(-100, 'invalid'), flow(110, '2026-11-10')]).rate, null);
    assert.equal(calculateXirr([flow(-100, '2025-11-10'), flow(NaN, '2026-11-10')]).rate, null);
});
test('partial sales, rebuys and terminal holding value use executed cash flows', () => {
    const trades = [trade('ABC.NS', 'BUY', 1000, '2025-11-10'), trade('ABC', 'SELL', 330, '2026-03-10'), trade('ABC', 'BUY', 200, '2026-05-10')];
    const r = calculatePortfolioXirr([{ symbol: 'ABC.NS', quantity: 9 }], trades, { ABC: 120 }, '2026-11-10');
    near(r.bySymbol.ABC.rate, calculateXirr([flow(-1000, '2025-11-10'), flow(330, '2026-03-10'), flow(-200, '2026-05-10'), flow(1080, '2026-11-10')]).rate);
    near(r.portfolio.rate, r.bySymbol.ABC.rate);
});
test('fully sold stocks keep sale date and cash balance is not a contribution', () => {
    const trades = [trade('ABC', 'BUY', 1000, '2024-11-10'), trade('ABC', 'SELL', 1100, '2025-11-10')];
    const r = calculatePortfolioXirr([], trades, {}, '2026-11-10');
    near(r.portfolio.rate, .1);
    assert.equal(r.portfolio.days, 365);
});
test('portfolio combines dated flows across stocks and waits for missing quotes', () => {
    const trades = [trade('ABC', 'BUY', 100, '2025-11-10'), trade('XYZ', 'BUY', 200, '2025-11-10')];
    near(calculatePortfolioXirr([{ symbol: 'ABC', quantity: 1 }, { symbol: 'XYZ', quantity: 1 }], trades, { ABC: 110, XYZ: 220 }, '2026-11-10').portfolio.rate, .1);
    const missing = calculatePortfolioXirr([{ symbol: 'ABC', quantity: 1 }, { symbol: 'XYZ', quantity: 1 }], trades, { ABC: 110 }, '2026-11-10');
    assert.equal(missing.portfolio.rate, null);
    near(missing.bySymbol.ABC.rate, .1);
    assert.equal(missing.bySymbol.XYZ.rate, null);
});
test('very large annualised returns stay compact', () => {
    assert.equal(formatXirr(.1), '+10.00%');
    assert.equal(formatXirr(-.2), '−20.00%');
    assert.equal(formatXirr(1e10), '+1.00e+12%');
});
