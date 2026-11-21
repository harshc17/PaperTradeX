function portfolioQuestion(question) {
    const text = question.toLowerCase();
    const account = /\b(portfolio|holdings?|balance|returns?|profits?|loss|losses|invested|stocks?|shares?|cash|pnl|p&l)\b/.test(text);
    return account && (/\b(my|mine|me|i|our|mera|meri|mere)\b/.test(text) || /^(show|list|view|check|analyse|analyze|review|summari[sz]e|portfolio|holdings|balance)\b/.test(text.trim()));
}
module.exports = { portfolioQuestion };
