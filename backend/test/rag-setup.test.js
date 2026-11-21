const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildConfiguredIndex } = require('../src/services/RagSetup');
test('operator setup is opt-in, indexes only managed sources and stops when complete', async () => {
    let calls = 0; const logs = [];
    const options = { enabled: false, configured: () => true, log: line => logs.push(line), index: async knowledge => {
        calls++; assert.ok(knowledge.every(d => d.scope !== 'account' && d.scope !== 'private'));
        return { indexed: 15, total: 15, remaining: 0 };
    } };
    await buildConfiguredIndex({}, options); assert.equal(calls, 0);
    await buildConfiguredIndex({}, { ...options, enabled: true }); assert.equal(calls, 1); assert.match(logs[0], /15\/15/);
    await buildConfiguredIndex({}, { ...options, enabled: true, configured: () => false }); assert.equal(calls, 1);
    await buildConfiguredIndex({}, { ...options, enabled: true, index: async () => { const e = Error('sensitive body'); e.status = 429; throw e; } });
    assert.match(logs.at(-1), /HTTP 429/); assert.ok(!logs.at(-1).includes('sensitive'));
});
