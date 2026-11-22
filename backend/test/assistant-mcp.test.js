const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const router = require('../src/routes/assistantConnections');
test('MCP tokens are user-scoped, short-lived, revocable and cannot authenticate trading; tools are read-only', async t => {
    const rows = [], accounts = { alice: { tokenVersion: 0 }, bob: { tokenVersion: 0 } }, calls = [];
    const query = value => ({ select() { return this; }, async lean() { return value; } });
    const matches = (row, q) => Object.entries(q).every(([key, value]) => value && value.$gt ? new Date(row[key]) > value.$gt : row[key] === value);
    const model = {
        find(q) { return query(rows.filter(r => matches(r, q)).map(({ _id, label, expiresAt }) => ({ _id, label, expiresAt }))); },
        findOne(q) { return query(rows.find(r => matches(r, q)) || null); },
        async create(row) { const result = { ...row, _id: String(rows.length + 1).padStart(24, '0'), revokedAt: null }; rows.push(result); return result; },
        async updateOne(q, update) { const row = rows.find(r => matches(r, q)); if (row) Object.assign(row, update.$set); },
    };
    const tools = {
        async fetchUserPortfolio(id) { calls.push(id); return { portfolio: { balance: id === 'alice' ? 100 : 200 } }; },
        async fetchLiveMarketData(symbols) { return { quotes: symbols.map(symbol => ({ symbol, price: null, status: 'unavailable' })) }; },
        async fetchUserWatchlist(id) { calls.push(id); return { symbols: [] }; },
        async fetchCompanyDisclosures() { return { available: false }; },
        retrieveDocuments: () => [], executeFinancialMath: input => ({ value: input.initial }),
    };
    const app = express(); app.use(express.json());
    app.use('/api/assistant', router({ User: { findById: id => query(accounts[id] || null) }, McpConnection: model, tools,
        authenticateToken(req, res, next) { if (!req.headers['x-user']) return res.sendStatus(401); req.user = { id: req.headers['x-user'] }; next(); },
        secret: 'test-app-secret', publicUrl: 'https://example.com/api/assistant/mcp' }));
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    t.after(() => { server.closeAllConnections(); server.close(); });
    const base = `http://127.0.0.1:${server.address().port}/api/assistant`;
    async function request(path, { body, token, user, method = 'POST' } = {}) {
        const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(user ? { 'x-user': user } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
        return { status: response.status, data: await response.json() };
    }
    assert.equal((await fetch(base + '/connections')).status, 401);
    const created = await request('/connections', { user: 'alice', body: { label: 'Test client' } });
    assert.equal(created.status, 201); assert.ok(created.data.token);
    assert.throws(() => jwt.verify(created.data.token, 'test-app-secret'));
    const claims = jwt.decode(created.data.token); assert.equal(claims.sub, 'alice'); assert.equal(claims.exp - claims.iat, 3600);
    assert.ok(!JSON.stringify(rows).includes(created.data.token));
    const token = created.data.token;
    assert.equal((await request('/mcp', { body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } })).status, 401);
    const initialized = await request('/mcp', { token, body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'Test', version: '1' } } } });
    assert.equal(initialized.status, 200);
    const listed = await request('/mcp', { token, body: { jsonrpc: '2.0', id: 2, method: 'tools/list' } });
    const names = listed.data.result.tools.map(tool => tool.name);
    assert.ok(names.includes('fetch_user_portfolio')); assert.ok(names.includes('execute_financial_math'));
    assert.ok(names.every(name => !/buy|sell|trade|order|delete|update/.test(name)));
    assert.ok(listed.data.result.tools.every(tool => tool.annotations.readOnlyHint));
    const portfolio = await request('/mcp', { token, body: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'fetch_user_portfolio', arguments: { userId: 'bob' } } } });
    assert.equal(portfolio.data.result.structuredContent.portfolio.balance, 100); assert.deepEqual(calls, ['alice']);
    await request(`/connections/${created.data.id}`, { user: 'bob', method: 'DELETE' });
    assert.equal(rows[0].revokedAt, null);
    accounts.alice.tokenVersion = 1;
    assert.equal((await request('/mcp', { token, body: { jsonrpc: '2.0', id: 4, method: 'tools/list' } })).status, 401);
    accounts.alice.tokenVersion = 0;
    await request(`/connections/${created.data.id}`, { user: 'alice', method: 'DELETE' });
    assert.equal((await request('/mcp', { token, body: { jsonrpc: '2.0', id: 5, method: 'tools/list' } })).status, 401);
});
