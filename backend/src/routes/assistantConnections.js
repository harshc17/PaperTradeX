const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');
const { DISCLAIMER } = require('../services/FinancialPolicy');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');

module.exports = function assistantConnections({ authenticateToken, User, McpConnection, tools, secret, publicUrl }) {
    const router = express.Router();
    const signingKey = crypto.createHmac('sha256', secret).update('papertradex:read-only-mcp:v1').digest('hex');
    const issuer = 'papertradex-read-only-mcp', audience = 'papertradex-mcp';
    const limit = rateLimit({ windowMs: 900000, max: 60, keyGenerator: req => String(req.user?.id || req.ip), standardHeaders: true, legacyHeaders: false });
    router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
    router.get('/connections', authenticateToken, async (req, res) => {
        try { res.json({ connections: await McpConnection.find({ user: req.user.id, expiresAt: { $gt: new Date() }, revokedAt: null }).select('_id label expiresAt createdAt').lean(), mcpUrl: publicUrl }); }
        catch { res.status(503).json({ error: 'Connections are temporarily unavailable.' }); }
    });
    router.post('/connections', authenticateToken, limit, async (req, res) => {
        const label = req.body?.label;
        if (typeof label !== 'string' || !label.trim() || label.length > 80) return res.status(400).json({ error: 'Enter an assistant name, up to 80 characters.' });
        try {
            const account = await User.findById(req.user.id).select('tokenVersion').lean();
            if (!account) return res.status(401).json({ error: 'Sign in again.' });
            const id = crypto.randomBytes(32).toString('hex'), expiresAt = new Date(Date.now() + 3600000);
            const connection = await McpConnection.create({ user: req.user.id, tokenIdHash: hash(id), label: label.trim(), expiresAt });
            const token = jwt.sign({ sub: String(req.user.id), jti: id, scope: 'portfolio:read market:read knowledge:read calculations:read', version: account.tokenVersion || 0 }, signingKey,
                { algorithm: 'HS256', expiresIn: '1h', audience, issuer });
            res.status(201).json({ id: connection._id, label: label.trim(), expiresAt, token, mcpUrl: publicUrl });
        } catch { res.status(503).json({ error: 'Unable to create a connection. Try again.' }); }
    });
    router.delete('/connections/:id', authenticateToken, async (req, res) => {
        if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid connection.' });
        try { await McpConnection.updateOne({ _id: req.params.id, user: req.user.id }, { $set: { revokedAt: new Date() } }); res.json({ revoked: true }); }
        catch { res.status(503).json({ error: 'Unable to revoke this connection.' }); }
    });
    async function authenticateMcp(req, res, next) {
        try {
            const header = req.get('authorization') || '';
            if (!header.startsWith('Bearer ')) throw Error('Missing token');
            const claims = jwt.verify(header.slice(7), signingKey, { algorithms: ['HS256'], audience, issuer });
            if (claims.scope !== 'portfolio:read market:read knowledge:read calculations:read' || !/^[a-f0-9]{64}$/.test(claims.jti || '')) throw Error('Invalid scope');
            const [account, connection] = await Promise.all([
                User.findById(claims.sub).select('tokenVersion').lean(),
                McpConnection.findOne({ user: claims.sub, tokenIdHash: hash(claims.jti), revokedAt: null, expiresAt: { $gt: new Date() } }).lean(),
            ]);
            if (!account || !connection || (account.tokenVersion || 0) !== claims.version) throw Error('Revoked token');
            req.user = { id: claims.sub }; next();
        } catch { res.status(401).json({ error: 'A valid, unexpired read-only assistant token is required.' }); }
    }
    router.post('/mcp', authenticateMcp, limit, async (req, res) => {
        const server = new McpServer({ name: 'PaperTradeX verified financial data', version: '1.0.0' }, {
            instructions: `Read-only financial information tools. No trade or account-write tools exist. Use only verified outputs, fetch fresh account/market data, never recommend an investment, and never do arithmetic yourself. Use execute_financial_math. Cite document metadata or feed timestamps for every factual claim. Missing data is unavailable, never zero. ${DISCLAIMER}`,
        });
        const result = value => { const output = { ...value, disclaimer: DISCLAIMER }; return { content: [{ type: 'text', text: JSON.stringify(output) }], structuredContent: output }; };
        const safe = fn => async args => { try { return result(await fn(args)); } catch { return { isError: true, content: [{ type: 'text', text: 'Verified tool data is unavailable or inputs are invalid. Do not infer missing values.' }] }; } };
        const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
        server.registerTool('fetch_user_portfolio', { description: 'Fresh signed-in user portfolio, balance, holdings, server-calculated returns and performance. Account identity is taken from the connection, never an input.', inputSchema: {}, annotations }, safe(() => tools.fetchUserPortfolio(req.user.id)));
        server.registerTool('fetch_live_market_data', { description: 'Shared website quote feed, exchange identity, previous close and server-calculated change. Check status and observation timestamps; this is not guaranteed real-time exchange data.', inputSchema: { symbols: z.array(z.string().max(30)).min(1).max(20) }, annotations }, safe(({ symbols }) => tools.fetchLiveMarketData(symbols)));
        server.registerTool('fetch_user_watchlist', { description: 'Signed-in account-synced watchlist and fresh quote context; unavailable if not synced.', inputSchema: {}, annotations }, safe(() => tools.fetchUserWatchlist(req.user.id)));
        server.registerTool('fetch_company_disclosures', { description: 'Verified NSE announcement titles, dates and attachment links when available. Attachment text and sentiment are not verified.', inputSchema: { symbol: z.string().max(30) }, annotations }, safe(({ symbol }) => tools.fetchCompanyDisclosures(symbol)));
        server.registerTool('retrieve_financial_documents', { description: 'Curated documents with section, effective date and review date. Review dates are not regulatory effective dates.', inputSchema: { question: z.string().min(1).max(2000) }, annotations }, safe(({ question }) => ({ documents: tools.retrieveDocuments(question) })));
        server.registerTool('execute_financial_math', { description: 'Deterministic percentage change, CAGR, hypothetical SIP and dated XIRR calculations. Tax estimates are unavailable without verified effective-dated rules. Supply explicit user-provided inputs.', inputSchema: { operation: z.enum(['percentage_change', 'cagr', 'sip_projection', 'xirr']), initial: z.number().optional(), final: z.number().optional(), years: z.number().optional(), monthly: z.number().optional(), annualRate: z.number().optional(), months: z.number().optional(), flows: z.array(z.object({ amount: z.number(), date: z.string().max(30) })).max(1000).optional() }, annotations }, safe(args => tools.executeFinancialMath(args)));
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
        res.on('close', () => { transport.close(); server.close(); });
        try { await server.connect(transport); await transport.handleRequest(req, res, req.body); }
        catch { if (!res.headersSent) res.status(500).json({ error: 'Assistant tool request unavailable.' }); }
    });
    router.all('/mcp', (req, res) => res.status(405).set('Allow', 'POST').json({ error: 'Use authenticated Streamable HTTP POST requests.' }));
    return router;
};
