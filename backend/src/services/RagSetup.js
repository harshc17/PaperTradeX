const vectors = require('./RagVectors');
const knowledge = require('../knowledge/papertradex.json');

// Explicit operator-controlled maintenance only; never grants an HTTP caller admin access.
async function buildConfiguredIndex(store, { enabled = process.env.RAG_BUILD_INDEX_ON_START === 'true',
    configured = vectors.configured, index = vectors.index, log = console.log } = {}) {
    if (!enabled) return;
    if (!configured()) { log('[RAG index] skipped: embedding configuration unavailable'); return; }
    try {
        for (let batch = 0; batch < 4; batch++) {
            const result = await index(knowledge, store);
            log(`[RAG index] ${result.indexed}/${result.total} indexed; ${result.remaining} remaining`);
            if (!result.remaining) return result;
        }
        log('[RAG index] batch limit reached; use administrator indexing for remaining chunks');
    } catch (error) {
        // Never log credentials, document contents or provider response bodies.
        log(`[RAG index] failed: ${Number.isInteger(error.status) ? `provider HTTP ${error.status}` : 'provider or database unavailable'}`);
    }
}
module.exports = { buildConfiguredIndex };
