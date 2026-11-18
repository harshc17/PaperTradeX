const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateCandles, withinDailyRanges, withLatestSession } = require('../src/services/ChartIntegrity');
const p = (date, close, extra = {}) => ({ date, close, ...extra });
test('invalid and internally inconsistent bars are rejected without suppressing genuine large moves', () => {
    const valid = [p('2026-11-17T10:00:00Z', 100), p('2026-11-18T10:00:00Z', 300, { open: 100, low: 90, high: 310 })];
    assert.equal(validateCandles(valid), valid);
    for (const points of [ [p('bad', 10)], [p('2026-11-17T10:00:00Z', NaN)],
        [p('2026-11-17T10:00:00Z', 10, { high: 0, low: 0 })],
        [p('2026-11-17T10:00:00Z', 300, { high: 200 })], [valid[1], valid[0]], [valid[0], valid[0]] ]) {
        assert.throws(() => validateCandles(points));
    }
    assert.throws(() => validateCandles([p('2026-11-19T10:00:00Z', 100)], new Date('2026-11-18T10:00:00Z')));
    assert(!withinDailyRanges([p('2026-11-18T09:51:00Z', 82744.97)], [p('2026-11-18T03:45:00Z', 82031.81, { low: 81780.47, high: 82578.87 })]));
});
test('append the latest observed index session without inventing intervening history or overwriting old days', () => {
    const old = p('2026-11-17T10:00:00Z', 28195);
    const series = { data: [old], source: 'NSE daily', resolution: 'daily' };
    const result = withLatestSession(series, { data: [p('2026-11-18T03:45:00Z', 28000), p('2026-11-18T09:59:00Z', 27992.25)] });
    assert.equal(result.data[0], old);
    assert.equal(result.data.length, 2);
    assert.equal(result.data[1].close, 27992.25);
    assert.equal(result.asOf, '2026-11-18T09:59:00Z');
    assert.equal(withLatestSession(result, { data: [old] }), result);
});
