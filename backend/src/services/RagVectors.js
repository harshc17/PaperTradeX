const { chunkDocument, retrieve } = require('./RagRetrieval');
const MODEL = 'gemini-embedding-2', TAG = `${MODEL}:768:v1`;
function configured() { return process.env.RAG_VECTOR_ENABLED === 'true' && Boolean(process.env.GEMINI_API_KEY); }
function cosine(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length || [...a, ...b].some(n => !Number.isFinite(n))) return -1;
    let dot = 0, x = 0, y = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; x += a[i] ** 2; y += b[i] ** 2; }
    return x && y ? dot / Math.sqrt(x * y) : -1;
}
async function embed(texts, query = false) {
    if (!configured()) throw Error('Vector search not configured');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents`, {
        method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: texts.map(text => ({ model: `models/${MODEL}`, outputDimensionality: 768,
            content: { parts: [{ text: query ? `task: search result | query: ${text}` : text }] } })) }),
    });
    if (!response.ok) { const error = Error('Embedding provider unavailable'); error.status = response.status; throw error; }
    const vectors = (await response.json()).embeddings?.map(e => e.values);
    if (!Array.isArray(vectors) || vectors.length !== texts.length || vectors.some(v => !Array.isArray(v) || v.length !== 768 || v.some(n => !Number.isFinite(n)) || !v.some(n => n !== 0))) throw Error('Invalid embeddings');
    return vectors;
}
async function index(knowledge, store, embeddings = embed) {
    const chunks = knowledge.flatMap(chunkDocument);
    const existing = await store.find({ model: TAG, chunkId: { $in: chunks.map(c => c.id) } }).select('chunkId').lean();
    const known = new Set(existing.map(v => v.chunkId));
    const missing = chunks.filter(c => !known.has(c.id));
    const batch = missing.slice(0, 32);
    if (batch.length) {
        const vectors = await embeddings(batch.map(c => `title: ${c.title} | text: ${c.text}`));
        await store.bulkWrite(batch.map((c, i) => ({ updateOne: { filter: { model: TAG, chunkId: c.id },
            update: { $set: { values: vectors[i] } }, upsert: true } })));
    }
    return { indexed: known.size + batch.length, total: chunks.length, remaining: missing.length - batch.length };
}
async function search(question, knowledge, store, embeddings = embed) {
    const lexical = retrieve(question, knowledge, 5);
    if (!configured() || !store) return { passages: lexical.slice(0, 4), method: 'keyword' };
    try {
        // Only compiled, administrator-managed sources are eligible. Account data is never embedded.
        const chunks = knowledge.flatMap(chunkDocument), current = new Map(chunks.map(c => [c.id, c]));
        const rows = await store.find({ model: TAG, chunkId: { $in: [...current.keys()] } }).select('chunkId values').limit(2000).lean();
        if (!rows.length) return { passages: lexical.slice(0, 4), method: 'keyword' };
        const [query] = await embeddings([question], true);
        const semantic = rows.map(r => ({ ...current.get(r.chunkId), similarity: cosine(query, r.values) })).filter(r => r.id && r.similarity > .25).sort((a, b) => b.similarity - a.similarity);
        const scores = new Map();
        for (const list of [lexical, semantic]) list.slice(0, 12).forEach((c, i) => { const found = scores.get(c.id) || { ...c, rank: 0 }; found.rank += 1 / (60 + i); scores.set(c.id, found); });
        const counts = new Map();
        const passages = [...scores.values()].sort((a, b) => b.rank - a.rank).filter(c => { const n = counts.get(c.documentId) || 0; counts.set(c.documentId, n + 1); return n < 2; }).slice(0, 4);
        return { passages, method: 'hybrid', indexed: rows.length, total: chunks.length };
    } catch { return { passages: lexical.slice(0, 4), method: 'keyword', note: 'Semantic search unavailable; keyword retrieval used.' }; }
}
module.exports = { configured, cosine, embed, index, search, TAG };
