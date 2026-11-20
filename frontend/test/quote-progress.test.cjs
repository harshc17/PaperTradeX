const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const result = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/quoteProgress.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: result });
test('repeated cached broadcasts cannot postpone the holdings recovery check forever', () => {
    const now = Date.now(), previousAt = now - 20000;
    const q = { price: 100, timestamp: new Date(previousAt).toISOString() };
    assert.equal(result.quoteAdvanced(q, previousAt, now), false);
    assert.equal(result.quoteAdvanced({ ...q, timestamp: new Date(now - 1000).toISOString() }, previousAt, now), true);
    assert.equal(result.quoteAdvanced({ ...q, price: 0 }, 0, now), false);
    assert.equal(result.quoteAdvanced({ ...q, timestamp: new Date(now + 60000).toISOString() }, 0, now), false);
});
