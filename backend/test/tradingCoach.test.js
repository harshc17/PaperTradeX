const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateTradePerformance } = require('../src/services/TradingCoach');
const trade = (type, quantity, price, day = 1, symbol = 'RELIANCE') => ({ type, quantity, price, totalAmount: quantity * price, symbol, createdAt: new Date(`2026-11-${String(day).padStart(2, '0')}T10:00:00Z`) });

test('weighted-average cost matches partial sales and later purchases', () => {
    const report = calculateTradePerformance([trade('BUY', 10, 100), trade('BUY', 10, 200, 2), trade('SELL', 5, 180, 3), trade('SELL', 10, 120, 4), trade('BUY', 5, 100, 5), trade('SELL', 10, 125, 6)]);
    assert.equal(report.metrics.netRealisedPnl, -150);
    assert.equal(report.metrics.winRate, 33.33);
    assert.equal(report.metrics.realisedReturnPercent, -4.29);
    assert.equal(report.metrics.averageWin, 150);
    assert.equal(report.metrics.averageLoss, 300);
    assert.equal(report.metrics.profitFactor, 0.5);
    assert.equal(report.metrics.completedSales, 3);
    assert.equal(report.metrics.breakEven, 1);
    assert.equal(report.metrics.closedCostBasis, 3500);
    assert.equal(report.recentSales[0].pnl, 0);
    assert.equal(report.bySymbol[0].pnl, -150);
});
test('empty history and open purchases do not produce invented returns', () => {
    for (const trades of [[], [trade('BUY', 20, 500)]]) {
        const { metrics, recentSales } = calculateTradePerformance(trades);
        assert.equal(metrics.completedSales, 0);
        assert.equal(metrics.netRealisedPnl, 0);
        assert.equal(metrics.winRate, null);
        assert.equal(metrics.realisedReturnPercent, null);
        assert.equal(metrics.profitFactor, null);
        assert.deepEqual(recentSales, []);
    }
});
test('partial sales retain a one-paise cost remainder and reconcile with recorded cash', () => {
    const report = calculateTradePerformance([trade('BUY', 1, 100), trade('BUY', 1, 100.01, 2), trade('SELL', 1, 100, 3), trade('SELL', 1, 100, 4)]);
    assert.equal(report.metrics.netRealisedPnl, -0.01);
    assert.equal(report.metrics.closedCostBasis, 200.01);
    assert.equal(report.metrics.grossLoss, 0.01);
    assert.equal(report.metrics.completedSales, 2);
    assert.equal(Number(report.recentSales.reduce((sum, sale) => sum + sale.proceeds - sale.costBasis, 0).toFixed(2)), -0.01);
});
test('many partial sales conserve recorded purchase cost through full exit', () => {
    const trades = [trade('BUY', 7, 100.03), trade('BUY', 4, 100.08, 2)];
    for (let i = 0; i < 11; i++) trades.push(trade('SELL', 1, 101, 3));
    const report = calculateTradePerformance(trades);
    assert.equal(report.metrics.closedCostBasis, 1100.53);
    assert.equal(report.metrics.netRealisedPnl, 10.47);
});
test('separate symbols, full exits, and re-entry retain correct costs', () => {
    const { metrics, bySymbol } = calculateTradePerformance([trade('BUY', 2, 100), trade('BUY', 1, 500, 2, 'TCS'), trade('SELL', 2, 150, 3), trade('BUY', 1, 400, 4), trade('SELL', 1, 350, 5)]);
    assert.equal(metrics.netRealisedPnl, 50);
    assert.equal(metrics.closedCostBasis, 600);
    assert.equal(bySymbol.length, 1); // Open TCS position is excluded.
});
test('missing purchases, invalid numbers and invalid timestamps reject the report', () => {
    assert.throws(() => calculateTradePerformance([trade('SELL', 1, 50)]), /missing purchases/);
    assert.throws(() => calculateTradePerformance([trade('BUY', 1, NaN)]), /incomplete/);
    assert.throws(() => calculateTradePerformance([{ ...trade('BUY', 1, 50), createdAt: 'invalid' }]), /incomplete/);
});
test('AI provider failure and malformed output never produce a fabricated coach review', async () => {
    const service = require('../src/services/AIService');
    const original = service._generate;
    const report = calculateTradePerformance([trade('BUY', 1, 100), trade('SELL', 1, 110, 2)]);
    try {
        service._generate = async () => null;
        await assert.rejects(service.reviewCompletedTrades(report), /unavailable/);
        service._generate = async () => '{"summary":"Invented incomplete output"}';
        await assert.rejects(service.reviewCompletedTrades(report), /unavailable/);
        service._generate = async () => JSON.stringify({ summary: 'Review', strengths: ['Observation'], focusAreas: [], exercise: 'Write a trade journal.' });
        assert.equal((await service.reviewCompletedTrades(report)).exercise, 'Write a trade journal.');
    } finally { service._generate = original; }
});
test('route isolates users, ignores submitted metrics, and handles unavailable AI honestly', async () => {
    const express = require('express');
    const router = require('../src/routes/tradingCoach');
    const oldKeys = {};
    for (const key of ['GROQ_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY']) { oldKeys[key] = process.env[key]; delete process.env[key]; }
    const data = { alice: [trade('BUY', 10, 100), trade('SELL', 5, 110, 2)], bob: [trade('BUY', 1, 500)] };
    let calls = 0;
    const app = express(); app.use(express.json());
    app.use('/coach', router({
        TransactionHistory: { find: ({ user }) => { assert(['alice', 'bob', 'charlie'].includes(user)); const query = { select() { return this; }, sort(order) { assert.deepEqual(order, { createdAt: 1, _id: 1 }); return this; }, limit() { return this; }, lean: async () => data[user] || [] }; return query; } },
        AIService: { reviewCompletedTrades: async performance => { calls++; assert.equal(performance.metrics.netRealisedPnl, 50); assert(!('user' in performance)); return { summary: 'Evidence-based review', strengths: [], focusAreas: [], exercise: 'Journal your next trade.' }; } },
        authenticateToken: (req, res, next) => { const user = req.headers.authorization; if (!user) return res.sendStatus(401); req.user = { id: user }; next(); },
    }));
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/coach`;
    const request = async (user, method = 'GET', body) => {
        const res = await fetch(base + (method === 'POST' ? '/review' : ''), { method, headers: { ...(user ? { Authorization: user } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
        return { status: res.status, data: res.status === 401 ? null : await res.json() };
    };
    try {
        assert.equal((await request(null)).status, 401);
        const alice = await request('alice');
        assert.equal(alice.data.metrics.netRealisedPnl, 50);
        assert.equal(alice.data.aiAvailable, false);
        assert.equal(alice.data.review, null);
        assert.equal((await request('bob')).data.metrics.completedSales, 0);
        assert.equal((await request('bob', 'POST')).status, 409);
        assert.equal((await request('alice', 'POST')).status, 503);
        assert.equal(calls, 0);
        process.env.GROQ_API_KEY = 'test-provider';
        const review = await request('alice', 'POST', { metrics: { netRealisedPnl: 1000000 }, userId: 'bob' });
        assert.equal(review.status, 200);
        assert.equal(review.data.metrics.netRealisedPnl, 50);
        assert.equal(calls, 1);
        assert.equal((await request('alice', 'POST')).data.cached, true);
        assert.equal(calls, 1);
        assert.equal((await request('bob')).data.review, null);
        data.alice.push(trade('SELL', 1, 100, 3));
        assert.equal((await request('alice')).data.review, null); // Old review invalidated by changed trades.
        data.charlie = [trade('SELL', 1, 100)];
        assert.equal((await request('charlie')).status, 422);
    } finally {
        server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
        for (const [key, value] of Object.entries(oldKeys)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    }
});
