const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const ts = require('../../frontend/node_modules/typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../../frontend/src/lib/chartQuote.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject });
const { chartWithQuote } = exportsObject;
const at = date => Date.parse(date);
test('all ranges use a newer actual quote while preserving their historical data', () => {
    const history = [{ date: '2026-11-18T09:00:00Z', close: 100 }];
    const quote = { price: 105, timestamp: at('2026-11-18T09:01:00Z') };
    for (const range of ['1d','1w','1mo','3mo','6mo','1y','3y','5y','max']) {
        const result = chartWithQuote(history, range, history[0].date, quote, at('2026-11-18T10:00:00Z'));
        assert.equal(result.at(-1).close, 105);
        assert.equal(result[0], history[0]);
    }
});
test('delayed, future, cross-session and unknown-date quotes cannot corrupt a chart', () => {
    const history = [{ date: '2026-11-18T09:00:00Z', close: 100 }];
    for (const quote of [{ price: 105, timestamp: at('2026-11-18T08:59:00Z') },
        { price: 105, timestamp: at('2026-11-19T09:00:00Z') }, { price: NaN, timestamp: at(history[0].date) }]) {
        assert.equal(chartWithQuote(history,'1d',undefined,quote,at('2026-11-18T10:00:00Z')),history);
    }
    assert.equal(chartWithQuote(history,'1d',undefined,{price:105,timestamp:at('2026-11-19T09:00:00Z')},at('2026-11-19T10:00:00Z')),history);
    assert.equal(chartWithQuote(history,'5y',undefined,{price:105,timestamp:at('2026-11-18T09:01:00Z')}),history);
});
