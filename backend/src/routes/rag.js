const express = require('express');
const rateLimit = require('express-rate-limit');
const knowledge = require('../knowledge/papertradex.json');
const { retrieve } = require('../services/RagRetrieval');
const generator = require('../services/RagGenerator');
const { calculateTradePerformance } = require('../services/TradingCoach');

module.exports = function ragRouter({ authenticateToken, RagDocument, TransactionHistory, generation = generator,
    enabled = () => process.env.RAG_ENABLED !== 'false' }) {
    const router = express.Router();
    router.use(authenticateToken);
    router.use((req, res, next) => {
        res.set('Cache-Control', 'private, no-store');
        if (!enabled()) return res.status(503).json({ error: 'Knowledge assistant is unavailable.' });
        next();
    });
    const limit = rateLimit({ windowMs: 15 * 60000, max: 20, keyGenerator: req => String(req.user.id),
        standardHeaders: true, legacyHeaders: false, message: { error: 'Please wait before sending more questions or documents.' } });
    router.get('/config', (req, res) => res.json({ enabled: true, generationAvailable: generation.configured(),
        retrieval: 'BM25', maxDocumentCharacters: 30000, maxDocuments: 25 }));
    router.get('/documents', async (req, res) => {
        try {
            const documents = await RagDocument.find({ owner: req.user.id }).select('title createdAt updatedAt characters').sort({ createdAt: -1 }).limit(30).lean();
            res.json({ documents: documents.map(d => ({ id: String(d._id), title: d.title, characters: d.characters, createdAt: d.createdAt })) });
        } catch { res.status(503).json({ error: 'Unable to load your knowledge library.' }); }
    });
    router.post('/documents', limit, async (req, res) => {
        const { title, content } = req.body || {};
        if (typeof title !== 'string' || !title.trim() || title.length > 120 || typeof content !== 'string' || content.trim().length < 40 || content.length > 30000 || content.includes('\u0000')) {
            return res.status(400).json({ error: 'Use a title up to 120 characters and 40–30,000 characters of plain text.' });
        }
        try {
            if (await RagDocument.countDocuments({ owner: req.user.id }) >= 25) return res.status(409).json({ error: 'Your library holds up to 25 documents. Remove one before adding another.' });
            const document = await RagDocument.create({ owner: req.user.id, title: title.trim(), content: content.trim(), characters: content.trim().length });
            res.status(201).json({ document: { id: String(document._id), title: document.title, characters: document.characters } });
        } catch { res.status(503).json({ error: 'Unable to save your document.' }); }
    });
    router.delete('/documents/:id', async (req, res) => {
        if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid document.' });
        try {
            const removed = await RagDocument.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
            if (!removed) return res.status(404).json({ error: 'Document not found.' });
            res.json({ success: true });
        } catch { res.status(503).json({ error: 'Unable to remove document.' }); }
    });
    router.post('/ask', limit, async (req, res) => {
        const { question, includePerformance = false } = req.body || {};
        if (typeof question !== 'string' || !question.trim() || question.length > 2000 || typeof includePerformance !== 'boolean') return res.status(400).json({ error: 'Enter a question up to 2,000 characters.' });
        try {
            const documents = await RagDocument.find({ owner: req.user.id }).select('title content updatedAt').sort({ createdAt: -1 }).limit(30).lean();
            const corpus = [...knowledge, ...documents.map(d => ({ id: String(d._id), title: d.title, content: d.content, scope: 'private' }))];
            let performance = null;
            if (includePerformance) {
                const trades = await TransactionHistory.find({ user: req.user.id }).select('type symbol quantity price totalAmount createdAt').sort({ createdAt: 1, _id: 1 }).limit(20001).lean();
                if (trades.length > 20000) return res.status(422).json({ error: 'Trade history exceeds the supported report size.' });
                performance = calculateTradePerformance(trades).metrics;
            }
            const selected = retrieve(question, corpus);
            if (performance) selected.unshift({ id: 'account-performance', title: 'Your completed paper trades', url: '/trading-coach', scope: 'account',
                text: 'Server-calculated performance snapshot. Each sell execution is one completed sale. No completed sales means win rate is unavailable. ' + JSON.stringify(performance) });
            const sources = selected.slice(0, 6).map((source, i) => ({ citation: `S${i + 1}`, id: source.id, title: source.title,
                url: source.url, scope: source.scope, text: source.text }));
            if (!sources.length) return res.json({ mode: 'no_sources', answer: 'I could not find supporting material for that question. Add a relevant document or ask about PaperTradeX features.', sources: [], performance });
            let answer = null;
            if (generation.configured()) {
                try { answer = await generation.generate(question.trim(), sources); } catch { /* Keep source retrieval usable during provider outages. */ }
            }
            res.json({ mode: answer ? 'generated' : 'retrieval', answer: answer?.answer || 'Here are the closest matching source passages. An AI answer has not been generated.',
                sources, performance, generatedAt: new Date().toISOString() });
        } catch { res.status(503).json({ error: 'Unable to search your sources. Please try again.' }); }
    });
    return router;
};
