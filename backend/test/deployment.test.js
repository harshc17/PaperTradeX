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

// Exercise real Express/Socket.IO listeners without external databases or market APIs.
async function boot(t, { fail = false, uri = 'mongodb://test', ready = 1 } = {}) {
    const filename = path.resolve(__dirname, '../src/server.js');
    const realRequire = createRequire(filename);
    const state = { readyState: ready };
    let server, exitCode, polling = false;
    const context = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout, clearTimeout, setInterval, clearInterval, Buffer, URL,
        process: {
            env: { NODE_ENV: 'production', JWT_SECRET: 'deployment-test-secret',
                MONGODB_URI: uri, PORT: '0', FRONTEND_URL: 'https://papertradex.vercel.app' },
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
                User: { findById: async () => ({ role: 'USER', tokenVersion: 0 }) },
            };
            if (name === './services/MarketData') return class {
                cache = { RELIANCE: { price: 1300 } };
                startPolling() { polling = true; }
            };
            if (name === './services/NSEClient') return { constructor: { isMarketHours: () => true } };
            if (name === './services/TradeEngine') return {
                assertMarketOpen() {},
                executeTrade: async (user, type, symbol, quantity, price) => ({ success: true, price }),
            };
            if (name === './services/PasswordReset') return realRequire(name);
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

test('health follows database readiness; API and Socket.IO enforce frontend origin', async t => {
    const app = await boot(t);
    assert.equal(app.polling, true);
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
