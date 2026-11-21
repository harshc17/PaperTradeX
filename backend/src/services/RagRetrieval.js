const crypto = require('crypto');
const stop = new Set('a an the is are was were of to for in on and or it this that how what why can do does i me my please'.split(' '));
const aliases = { etfs: 'etf', indices: 'index', indexes: 'index', companies: 'company', realized: 'realised', annualized: 'annualised', diversify: 'diversification', diversified: 'diversification', diversifying: 'diversification' };
function tokens(text) {
    return (String(text).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/p\s*&\s*l|\bpnl\b/g, 'profit loss').match(/[a-z0-9]+/g) || [])
        .filter(t => !stop.has(t)).map(t => aliases[t] || (t.length > 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));
}
function chunkDocument(document) {
    const content = String(document.content || '').replace(/\r/g, '').trim();
    const chunks = [];
    for (let offset = 0; offset < content.length;) {
        let end = Math.min(content.length, offset + 1100);
        if (end < content.length) {
            const boundary = content.lastIndexOf(' ', end);
            if (boundary > offset + 700) end = boundary;
        }
        const text = content.slice(offset, end).trim();
        if (text) chunks.push({ id: crypto.createHash('sha256').update(`${document.id}:${offset}:${text}`).digest('hex').slice(0, 20),
            documentId: document.id, title: document.title, url: document.url || null, referenceUrl: document.referenceUrl || null,
            scope: document.scope || 'public', text });
        if (end === content.length) break;
        offset = Math.max(offset + 1, end - 160);
    }
    return chunks;
}
function retrieve(question, documents, limit = 5) {
    const chunks = documents.flatMap(chunkDocument);
    const terms = [...new Set(tokens(question))];
    if (!terms.length || !chunks.length) return [];
    const indexed = chunks.map(chunk => {
        const words = tokens(`${chunk.title} ${chunk.title} ${chunk.text}`), frequencies = new Map();
        for (const word of words) frequencies.set(word, (frequencies.get(word) || 0) + 1);
        return { chunk, length: words.length, frequencies };
    });
    const average = indexed.reduce((sum, item) => sum + item.length, 0) / indexed.length || 1;
    const frequency = Object.fromEntries(terms.map(term => [term, indexed.filter(item => item.frequencies.has(term)).length]));
    const ranked = indexed.map(item => ({ ...item.chunk, score: terms.reduce((score, term) => {
        const tf = item.frequencies.get(term) || 0;
        const idf = Math.log(1 + (indexed.length - frequency[term] + .5) / (frequency[term] + .5));
        return score + idf * tf * 2.2 / (tf + 1.2 * (.25 + .75 * item.length / average));
    }, 0) })).filter(item => item.score > .2).sort((a, b) => b.score - a.score);
    // Limit repeated chunks so one long upload cannot consume every source slot.
    const counts = new Map();
    return ranked.filter(item => { const n = counts.get(item.documentId) || 0; counts.set(item.documentId, n + 1); return n < 2; }).slice(0, limit);
}
module.exports = { tokens, chunkDocument, retrieve };
