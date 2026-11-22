const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateHistory, conversationContext } = require('../src/services/RagConversation');
const pair = (q, a = 'Earlier answer') => [{ role: 'user', content: q }, { role: 'assistant', content: a }];

test('conversation routing retains finance topics and resets account scope on a new topic', () => {
    assert.equal(validateHistory([]), true);
    const finance = conversationContext('Give me an example of that.', pair('Explain diversification'));
    assert.match(finance.retrievalQuestion, /diversification/);
    assert.equal(finance.accountQuestion, false);
    assert.equal(conversationContext('Why?', pair('What is my portfolio value?')).accountQuestion, true);
    assert.equal(conversationContext('Which holding contributes most?', pair('What is my portfolio value?')).accountQuestion, true);
    const reset = conversationContext('Why?', [...pair('What is my balance?'), ...pair('What is an ETF?')]);
    assert.equal(reset.accountQuestion, false); assert.match(reset.retrievalQuestion, /ETF/);
    assert.equal(conversationContext('Why?', []).accountQuestion, false);
    assert.equal(conversationContext('Can you give me another example of that?', []).needsClarification, true);
    assert.equal(conversationContext('Can you give me another example of that?', pair('Explain diversification')).needsClarification, false);
    assert.equal(conversationContext('How does compound interest work?', []).needsClarification, false);
    assert.equal(conversationContext('Why?', [...pair('What is my portfolio value?'), ...pair('Is that diversified?')]).accountQuestion, true);
});
