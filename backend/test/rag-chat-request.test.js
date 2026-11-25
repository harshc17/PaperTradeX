const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../../frontend/node_modules/typescript');
const exported = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../../frontend/src/lib/ragChatRequest.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exported });
const { buildChatRequest } = exported;
const options = { includePortfolio: true, includePerformance: false };

test('retry retains its original follow-up context and options after later messages, without extending history', () => {
    const prior = [{ question: 'Explain diversification', result: { mode: 'generated', answer: 'Spread investments [S1].' } }];
    const saved = buildChatRequest('Give an example of that.', options, prior);
    const before = JSON.stringify(saved);
    const later = Array.from({ length: 8 }, (_, i) => ({ question: `Later question ${i}`, result: { mode: 'generated', answer: 'A different topic.' } }));
    const retry = buildChatRequest('Wrong replacement', { includePortfolio: false, includePerformance: true }, later, saved);
    assert.equal(retry, saved); assert.equal(JSON.stringify(retry), before);
    assert.equal(retry.history[0].content, 'Explain diversification'); assert.equal(retry.history[1].content, 'Spread investments.');
});

test('new requests exclude failed answers, bound context and omit previous account figures; new chat has none', () => {
    const entries = Array.from({ length: 6 }, (_, i) => ({ question: `Question ${i}`, result: { mode: 'generated', answer: 'Answer' } }));
    entries.push({ question: 'My balnce?', result: { mode: 'generated', interpretedQuestion: 'My balance?', answer: 'Balance 999999', portfolio: {} } });
    entries.push({ question: 'Failed', result: { mode: 'unavailable', answer: 'Retry' } });
    const payload = buildChatRequest('Why?', options, entries);
    assert.equal(payload.history.length, 8); assert.ok(!JSON.stringify(payload).includes('999999'));
    assert.ok(!JSON.stringify(payload.history).includes('Failed'));
    assert.equal(payload.history.at(-2).content, 'My balance?');
    assert.equal(buildChatRequest('Why?', options, []).history.length, 0);
});
