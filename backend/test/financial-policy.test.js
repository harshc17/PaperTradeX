const { test } = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../src/services/FinancialPolicy');
const { executeFinancialMath, parseCalculation } = require('../src/services/FinancialMath');
test('strict financial policy prioritises effective dates and never substitutes review dates', () => {
    const rows = [
        { title: 'Older circular', topicKey: 'rule', section: '4', effectiveDate: '2024-01-01' },
        { title: 'New circular', topicKey: 'rule', section: '4', effectiveDate: '2025-01-01' },
        { title: 'Undated circular', topicKey: 'rule', section: '4', reviewedAt: '2026-11-22' },
    ];
    assert.deepEqual(policy.currentVersions(rows).map(s => s.title), ['New circular']);
    assert.match(policy.sourceLabel({ title: 'Study note', reviewedAt: '2026-11-22' }), /Effective date not supplied; reviewed/);
    assert.equal(policy.adviceQuestion('Which fund should I buy?'), true);
    assert.equal(policy.adviceQuestion('How do I buy a stock in PaperTradeX?'), false);
    assert.equal(policy.hasUnsupportedNumbers('Return 12%', [{ text: '{"return":10}' }]), true);
    assert.equal(policy.hasUnsupportedNumbers('Value 1,000 [S1]', [{ text: '{"value":1000}' }]), false);
    assert.equal(policy.hasUnsupportedNumbers('1. Market risk [S1]\n2. Tracking risk [S1]', [{ text: 'Market risk and tracking risk' }]), false);
    assert.equal(policy.hasUnsupportedNumbers('1. Return 17% [S1]', [{ text: 'No return specified' }]), true);
    assert.equal(policy.missingSentenceCitations('ETFs carry market risk. They trade on exchanges [S1].'), true);
    assert.equal(policy.withDisclaimer('Answer').split(policy.DISCLAIMER).length, 2);
});
test('financial arithmetic is deterministic, bounded and uses explicit inputs', () => {
    assert.equal(executeFinancialMath({ operation: 'percentage_change', initial: 100, final: 110 }).value, 10);
    assert.equal(executeFinancialMath({ operation: 'cagr', initial: 100, final: 121, years: 2 }).value, 10);
    assert.equal(executeFinancialMath({ operation: 'sip_projection', monthly: 1000, annualRate: 0, months: 12 }).value, 12000);
    assert.ok(Math.abs(executeFinancialMath({ operation: 'xirr', flows: [{ amount: -100, date: '2025-01-01' }, { amount: 110, date: '2026-01-01' }] }).value - 10) < .001);
    assert.throws(() => executeFinancialMath({ operation: 'tax' }), /verified/);
    assert.throws(() => executeFinancialMath({ operation: 'cagr', initial: 0, final: 10, years: 1 }));
    assert.deepEqual(parseCalculation('Calculate CAGR from 100 to 121 over 2 years'), { operation: 'cagr', initial: 100, final: 121, years: 2 });
});
