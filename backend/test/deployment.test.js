const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const http = require('node:http');
const { createRequire } = require('node:module');
const path = require('node:path');
const jwt = require('jsonwebtoken');

test('protected routes reject missing/forged tokens and non-admin refresh requests', async t => {
    const app = await boot(t);
    for (const [route, method] of [['/api/portfolio', 'GET'], ['/api/orders', 'GET'], ['/api/transactions', 'GET'], ['/api/trade', 'POST'], ['/api/ai/market-news/refresh', 'POST']]) {
        const response = await fetch(app.url + route, { method });
        assert.equal(response.status, 401, route);
    }
    const forged = await fetch(app.url + '/api/portfolio', { headers: { Authorization: 'Bearer invalid' } });
    assert.equal(forged.status, 403);
    const token = jwt.sign({ id: 'test', role: 'USER' }, 'deployment-test-secret');
    const forbidden = await fetch(app.url + '/api/ai/market-news/refresh', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    assert.equal(forbidden.status, 403);
    const malformed = await fetch(app.url + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: { $ne: null }, password: [] }) });
    assert.equal(malformed.status, 401);
    const trade = await fetch(app.url + '/api/trade', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: 'RELIANCE', type: 'BUY', quantity: 1, price: 0.01 }) });
    assert.equal(trade.status, 200);
    assert.equal((await trade.json()).price, 1300);
});

test('Google configuration stays disabled until its public client ID is supplied', async t => {
    const app = await boot(t);
    const config = await fetch(app.url + '/api/auth/google/config');
    assert.equal(config.status, 200);
    assert.equal(config.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await config.json(), { enabled: false });
    const rejected = await fetch(app.url + '/api/auth/google', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' },
        body: JSON.stringify({ credential: 'not-a-google-token', challenge: 'not-a-challenge' }) });
    assert.equal(rejected.status, 403);
});

// Exercise real Express/Socket.IO listeners without external databases or market APIs.
async function boot(t, { fail = false, uri = 'mongodb://test', ready = 1, marketPolling = 'true', authDBUnavailable = false, marketOpen = true, providerQuote = null, indexQuotes = {} } = {}) {
    const filename = path.resolve(__dirname, '../src/server.js');
    const realRequire = createRequire(filename);
    const state = { readyState: ready };
    let server, exitCode, polling = false;
    const context = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout, clearTimeout, setInterval, clearInterval, Buffer, URL,
        process: {
            env: { NODE_ENV: 'production', JWT_SECRET: 'deployment-test-secret',
                MONGODB_URI: uri, PORT: '0', FRONTEND_URL: 'https://papertradex.vercel.app',
                MARKET_POLLING_ENABLED: marketPolling },
            exit(code) { exitCode = code; },
        },
        require(name) {
            if (name === 'dotenv') return { config() {} };
            if (name === 'mongoose') return { connection: state };
            if (name === 'http') return { createServer(app) {
                server = http.createServer(app); return server;
            } };
            if (name === './models') return {
                async connectDB() { if (fail) throw new Error('Database unavailable'); },
                async seedAdmin() {},
                User: { findById: async () => {
                    if (authDBUnavailable) throw Error('Database temporarily unavailable');
                    return { role: 'USER', tokenVersion: 0 };
                } },
            };
            if (name === './services/MarketData') return class {
                cache = { RELIANCE: { price: 1300 }, ...indexQuotes };
                async _fetchIndices() {}
                async tradeQuote() { return { price: 1300, timestamp: Date.now() }; }
                startPolling() { polling = true; }
            };
            if (name === './services/NSEClient') return { getMarketStatus: () => ({ isOpen: marketOpen }), constructor: { isMarketHours: () => marketOpen, HOLIDAYS: {} } };
            if (name === './services/HistoricalClient') return { quoteDetail: async () => providerQuote };
            if (name === './services/ClosingQuote') return realRequire(name);
            if (name === './services/TradeEngine') return {
                assertMarketOpen() {},
                findTradeReplay: async () => null,
                executeTrade: async (user, type, symbol, quantity, price) => ({ success: true, price }),
            };
            if (['./services/PasswordReset', './services/SignupVerification', './services/ReturnSession', './services/MarketIndex', './services/QuoteIdentity', './services/GoogleSignIn'].includes(name)) return realRequire(name);
            if (name.startsWith('./services/')) return {};
            return realRequire(name);
        },
    };
    t.after(() => { server?.closeAllConnections(); server?.close(); });
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    for (let i = 0; i < 100 && !server.listening && exitCode === undefined; i++) {
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    return { server, state, exitCode, polling, url: server.listening ? `http://127.0.0.1:${server.address().port}` : null };
}

test('closed-market display preserves daily return and all index pages share the ticker quote', async t => {
    const session = require('../src/services/ReturnSession')();
    const timestamp = `${session}T03:45:00Z`;
    const keys = ['^NSEI', '^BSESN', '^NSEBANK', '^MIDCPNIFTY', '^FINNIFTY', '^BANKEX'];
    const indexQuotes = Object.fromEntries(keys.map(symbol => [symbol,
        { symbol, price: 82031.81, prevClose: 82532.19, change: -500.38, dayChange: -.61, timestamp }]));
    const app = await boot(t, { marketOpen: false, indexQuotes,
        providerQuote: { regularMarketPrice: 105, regularMarketChange: 5,
            regularMarketPreviousClose: 98, regularMarketTime: new Date(timestamp) } });
    const stock = await fetch(app.url + '/api/stock/TEST/realtime').then(r => r.json());
    assert.equal(stock.prevClose, 100);
    assert.equal(stock.change, 5);
    const ticker = await fetch(app.url + '/api/indices').then(r => r.json());
    for (const symbol of keys) {
        const quote = await fetch(app.url + `/api/stock/${encodeURIComponent(symbol)}/realtime`).then(r => r.json());
        assert.equal(quote.price, ticker[symbol].price);
        assert.equal(quote.prevClose, ticker[symbol].prevClose);
        assert.equal(quote.change, ticker[symbol].change);
    }
});

test('health follows database readiness; API and Socket.IO enforce frontend origin', async t => {
    const app = await boot(t);
    assert.equal(app.polling, true);
    const marketStatus = await fetch(app.url + '/api/market-status').then(r => r.json());
    assert.match(marketStatus.returnSessionDate, /^\d{4}-\d{2}-\d{2}$/);
    const origin = 'https://papertradex.vercel.app';
    for (const endpoint of ['/health', '/socket.io/?EIO=4&transport=polling']) {
        const allowed = await fetch(app.url + endpoint, { headers: { Origin: origin } });
        assert.equal(allowed.status, 200);
        assert.equal(allowed.headers.get('access-control-allow-origin'), origin);
        const denied = await fetch(app.url + endpoint, { headers: { Origin: 'https://other.vercel.app' } });
        assert.equal(denied.headers.get('access-control-allow-origin'), null);
    }
    const preflight = await fetch(app.url + '/api/login', {
        method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    app.state.readyState = 0;
    assert.equal((await fetch(app.url + '/health')).status, 503);
});

test('database connection failure stops startup before listening or polling', async t => {
    const app = await boot(t, { fail: true });
    assert.equal(app.exitCode, 1);
    assert.equal(app.server.listening, false);
    assert.equal(app.polling, false);
});

test('production requires an explicit database URI', async t => {
    const app = await boot(t, { uri: '' });
    assert.equal(app.exitCode, 1);
    assert.equal(app.server.listening, false);
});

test('inactive recovery instance serves health without starting market polling', async t => {
    const app = await boot(t, { marketPolling: 'false' });
    assert.equal(app.polling, false);
    assert.equal((await fetch(app.url + '/health')).status, 200);
    app.state.readyState = 0;
    assert.equal((await fetch(app.url + '/health')).status, 503);
});

test('temporary account database errors do not invalidate a valid login', async t => {
    const app = await boot(t, { authDBUnavailable: true });
    const token = jwt.sign({ id: 'test', role: 'USER' }, 'deployment-test-secret');
    const response = await fetch(app.url + '/api/portfolio', { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 503);
    assert.doesNotMatch((await response.json()).error, /expired/i);
});
