const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../../frontend/node_modules/typescript');
const moduleExports = {};
const source = fs.readFileSync(require.resolve('../../frontend/src/lib/dailyReturn.ts'), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: moduleExports });
const { calculateDailyReturn: calculate } = moduleExports;
const session = require('../src/services/ReturnSession');
const day = '2026-11-09';
const trade = (type, quantity, price, date = '2026-11-09T05:00:00Z') => ({ symbol: 'ABC', type, quantity, totalAmount: quantity * price, createdAt: date });

test('same-day purchases earn only from execution price, not previous close', () => {
    const holdings = [{ symbol: 'ABC.NS', quantity: 2 }];
    const trades = [trade('BUY', 2, 1300)];
    assert.equal(calculate(holdings, trades, { ABC: 1300 }, { ABC: 1380 }, day).value, 0);
    const result = calculate(holdings, trades, { ABC: 1310 }, { ABC: 1380 }, day);
    assert.equal(result.value, 20); assert.equal(result.percent, 20 / 2600 * 100);
});
test('overnight positions, additions and partial sales retain actual session P&L', () => {
    const holdings = [{ symbol: 'ABC', quantity: 7 }];
    const result = calculate(holdings, [trade('BUY', 2, 105), trade('SELL', 5, 120)], { ABC: 110 }, { ABC: 100 }, day);
    // Ten opening shares: 7*110 + 5*120 - 10*100 - 2*105 = 160.
    assert.equal(result.value, 160); assert.equal(result.percent, 160 / 1210 * 100);
});
test('full sales and intraday round trips keep realized return with no holdings', () => {
    assert.equal(calculate([], [trade('SELL', 10, 110)], {}, { ABC: 100 }, day).value, 100);
    const roundTrip = calculate([], [trade('BUY', 10, 100), trade('SELL', 10, 110)], {}, {}, day);
    assert.equal(roundTrip.value, 100); assert.equal(roundTrip.percent, 10); assert.equal(roundTrip.ready, true);
});
test('old trades are excluded, date boundaries use IST and missing quotes stay unavailable', () => {
    const holdings = [{ symbol: 'ABC', quantity: 1 }];
    assert.equal(calculate(holdings, [trade('BUY', 1, 50, '2026-11-06T05:00:00Z')], { ABC: 110 }, { ABC: 100 }, day).value, 10);
    assert.equal(calculate(holdings, [], { ABC: 110 }, {}, day).ready, false);
    assert.equal(calculate(holdings, [trade('BUY', 1, 100, '2026-11-08T20:00:00Z')], { ABC: 110 }, {}, day).value, 10);
    assert.equal(calculate([], [], {}, {}, undefined).ready, false);
});
test('pre-open, holidays and weekends retain the latest started trading session', () => {
    assert.equal(session(new Date('2026-11-09T03:30:00Z')), '2026-11-06');
    assert.equal(session(new Date('2026-11-09T03:45:00Z')), '2026-11-09');
    assert.equal(session(new Date('2026-11-09T14:00:00Z')), '2026-11-09');
    assert.equal(session(new Date('2026-11-08T08:00:00Z')), '2026-11-06');
    assert.equal(session(new Date('2026-11-10T08:00:00Z'), { '2026-11-10': 'Holiday' }), '2026-11-09');
});
