const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { calculateTradePerformance } = require('../services/TradingCoach');

module.exports = function tradingCoachRouter({ TransactionHistory, AIService, authenticateToken }) {
    const router = express.Router();
    const reviews = new Map(), pending = new Map();
    const available = () => Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY);
    router.use(authenticateToken);
    router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
    const limit = rateLimit({ windowMs: 15 * 60 * 1000, max: 6, keyGenerator: req => String(req.user.id), standardHeaders: true, legacyHeaders: false, message: { error: 'Please wait before requesting another AI review. Your performance report is still available.' } });

    async function load(userId) {
        const trades = await TransactionHistory.find({ user: userId })
            .select('type symbol quantity price totalAmount createdAt updatedAt').sort({ createdAt: 1, _id: 1 }).limit(20001).lean();
        if (trades.length > 20000) throw Object.assign(new Error('This account has more trades than the coach currently supports.'), { status: 422 });
        let performance;
        try { performance = calculateTradePerformance(trades); }
        catch (error) { throw Object.assign(error, { status: 422 }); }
        const revision = crypto.createHash('sha256').update(JSON.stringify(trades)).digest('hex');
        return { ...performance, revision };
    }
    function cached(userId, revision) {
        const item = reviews.get(String(userId));
        return item && item.revision === revision && item.expiresAt > Date.now() ? item.review : null;
    }
    router.get('/', async (req, res) => {
        try {
            const performance = await load(req.user.id);
            res.json({ ...performance, aiAvailable: available(), review: cached(req.user.id, performance.revision) });
        } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Could not load completed trades. Please try again.' }); }
    });
    router.post('/review', limit, async (req, res) => {
        try {
            const performance = await load(req.user.id);
            if (!performance.metrics.completedSales) return res.status(409).json({ error: 'Complete a paper sale before requesting a review.' });
            const existing = cached(req.user.id, performance.revision);
            if (existing) return res.json({ ...performance, review: existing, cached: true });
            if (!available()) return res.status(503).json({ error: 'AI reviews are not enabled yet. Your calculated performance is available below.' });
            const key = `${req.user.id}:${performance.revision}`;
            let generation = pending.get(key);
            if (!generation) {
                generation = AIService.reviewCompletedTrades(performance).then(content => {
                    const review = { ...content, generatedAt: new Date().toISOString() };
                    if (reviews.size >= 200) reviews.delete(reviews.keys().next().value);
                    reviews.set(String(req.user.id), { revision: performance.revision, review, expiresAt: Date.now() + 30 * 60 * 1000 });
                    return review;
                }).finally(() => pending.delete(key));
                pending.set(key, generation);
            }
            const review = await generation;
            res.json({ ...performance, review, cached: false });
        } catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : 'AI coaching is temporarily unavailable. Your calculated performance remains available.' }); }
    });
    return router;
};
