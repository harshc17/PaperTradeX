const { portfolioQuestion } = require('./RagIntent');

// History is supplied by the browser, never an authoritative account record.
function validateHistory(history) {
    if (!Array.isArray(history) || history.length > 8) return false;
    return history.every((message, i) => message && Object.keys(message).every(k => ['role', 'content'].includes(k)) &&
        message.role === (i % 2 === 0 ? 'user' : 'assistant') && typeof message.content === 'string' &&
        message.content.trim().length > 0 && message.content.length <= 1000) && history.length % 2 === 0;
}

function continuation(question) {
    return /\b(it|its|that|this|these|those|they|them|their|above|previous|earlier|same|second|first|latter|former)\b/i.test(question) ||
        /^(and\b|also\b|why\b|what about\b|how about\b|how (can|should) (i|we)\b|what (percentage|proportion)\b|tell me more\b|go on\b|continue\b|elaborate\b|can you explain\b|explain (more|why)\b|give (me )?an? example\b|simplify\b|in simpler\b)/i.test(question.trim());
}

function conversationContext(question, history) {
    let account = false;
    let topic = '';
    const context = [];
    for (let i = 0; i < history.length; i += 2) {
        const user = history[i];
        const explicitAccount = portfolioQuestion(user.content);
        const refersBack = continuation(user.content) || (account && /\b(holdings?|stocks?|balance|returns?|profits?|losses?|cash|invested)\b/i.test(user.content));
        account = explicitAccount || (refersBack && account);
        if (explicitAccount || !refersBack || !topic) topic = user.content;
        context.push(user, { role: 'assistant', content: account
            ? 'A portfolio answer was shown. Previous account figures are omitted; use the fresh verified account source for any account facts.'
            : history[i + 1].content });
    }
    const followUp = continuation(question) || (account && /\b(holdings?|stocks?|balance|returns?|profits?|losses?|cash|invested)\b/i.test(question));
    return {
        accountQuestion: portfolioQuestion(question) || (followUp && account),
        needsClarification: !history.length && !portfolioQuestion(question) && question.length < 120 &&
            /\b(it|that|those|them|above|previous|earlier|same|second|latter|former)\b/i.test(question) &&
            /^(why\b|what about\b|how about\b|give\b|show\b|tell\b|can you\b|explain (it|that)\b|and\b|also\b)/i.test(question.trim()),
        retrievalQuestion: followUp && topic ? `${topic}\nFollow-up: ${question}` : question,
        history: context,
    };
}

module.exports = { validateHistory, conversationContext };
