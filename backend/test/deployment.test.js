const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const http = require('node:http');
const { createRequire } = require('node:module');
const path = require('node:path');

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
            };
            if (name === './services/MarketData') return class {
                startPolling() { polling = true; }
            };
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
