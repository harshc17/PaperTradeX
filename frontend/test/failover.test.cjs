const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const primary = 'https://primary.test', backup = 'https://backup.test';
function load(file, modules, globals = {}) {
    const context = { exports: {}, require: name => modules[name], console, Headers, Response,
        AbortController, AbortSignal, setTimeout, clearTimeout, crypto, ...globals };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/' + file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText, context);
    return context.exports;
}
function setup(handler) {
    const calls = [];
    const fetch = async (url, opts = {}) => { calls.push({ url, opts }); return handler(url, opts); };
    const api = load('backend.ts', { './config': { API_URL: primary, BACKUP_API_URL: backup } }, { fetch });
    return { api, calls };
}
const ok = data => new Response(JSON.stringify(data), { status: 200 });
test('failed primary reads switch to backup; recovery switches back without touching auth', async () => {
    let down = true;
    const { api } = setup(url => {
        if (url.startsWith(primary) && down) throw Error('offline');
        return ok(url.endsWith('/health') ? { status: 'ok' } : { balance: 100 });
    });
    const changes = []; api.onBackendChange(url => changes.push(url));
    assert.equal((await api.apiFetch(primary + '/api/portfolio')).status, 200);
    assert.equal(api.getBackend(), backup);
    down = false; await api.checkBackend(true);
    assert.equal(api.getBackend(), primary);
    assert.equal(changes.join(','), `${backup},${primary}`);
});
test('a committed trade whose response is lost is replayed with the SAME request ID', async () => {
    let down = false; const keys = [];
    const { api } = setup((url, opts) => {
        if (url.endsWith('/health')) { if (url.startsWith(primary) && down) throw Error('offline'); return ok({ status: 'ok' }); }
        keys.push(opts.headers.get('Idempotency-Key'));
        if (url.startsWith(primary)) { down = true; throw Error('response lost after commit'); }
        return ok({ success: true, orderId: 'M-1' });
    });
    const r = await api.apiFetch(primary + '/api/trade', { method: 'POST', body: '{}' });
    assert.equal((await r.json()).orderId, 'M-1');
    assert.equal(keys.length, 2); assert.ok(keys[0]); assert.equal(keys[0], keys[1]);
});
test('auth errors and provider failures do not switch hosts or duplicate writes', async () => {
    let status = 401;
    const { api, calls } = setup(url => url.endsWith('/health') ? ok({ status: 'ok' }) : new Response('{}', { status }));
    assert.equal((await api.apiFetch(primary + '/api/portfolio')).status, 401);
    status = 503;
    assert.equal((await api.apiFetch(primary + '/api/forgot-password', { method: 'POST', body: '{}' })).status, 503);
    assert.equal(api.getBackend(), primary);
    assert.equal(calls.filter(c => c.url.endsWith('/api/forgot-password')).length, 1);
});
test('non-idempotent writes are never replayed after a connection fails', async () => {
    let down = false;
    const { api, calls } = setup(url => {
        if (url.endsWith('/health')) { if (url.startsWith(primary) && down) throw Error('offline'); return ok({ status: 'ok' }); }
        down = true; throw Error('connection lost');
    });
    await assert.rejects(api.apiFetch(primary + '/api/register', { method: 'POST', body: '{}' }), /check the result/);
    assert.equal(api.getBackend(), backup);
    assert.equal(calls.filter(c => c.url.endsWith('/api/register')).length, 1);
});
test('caller cancellations never replay a request', async () => {
    const controller = new AbortController();
    const { api, calls } = setup(() => { controller.abort(); throw Error('cancelled'); });
    await assert.rejects(api.apiFetch(primary + '/api/search', { signal: controller.signal }));
    assert.equal(calls.length, 1);
});
test('a healthy Railway API with missing quotes switches to Render and avoids immediate failback', async () => {
    const { api } = setup(url => {
        if (url.endsWith('/health')) return ok({ status: 'ok' });
        return url.startsWith(primary) ? new Response('{}', { status: 503 }) : ok({ price: 814.95 });
    });
    assert.equal((await (await api.apiFetch(primary + '/api/stock/HDFCBANK/realtime')).json()).price, 814.95);
    assert.equal(api.getBackend(), backup);
    await api.checkBackend(true);
    assert.equal(api.getBackend(), backup);
});
test('incomplete index lists recover all six indices from the alternate host', async () => {
    const keys = ['^NSEI', '^BSESN', '^NSEBANK', '^MIDCPNIFTY', '^FINNIFTY', '^BANKEX'];
    const { api } = setup(url => url.endsWith('/health') ? ok({ status: 'ok' })
        : ok(Object.fromEntries((url.startsWith(primary) ? keys.slice(0, 4) : keys).map(key => [key, { price: 100 }]))));
    const data = await (await api.apiFetch(primary + '/api/indices')).json();
    assert.equal(Object.keys(data).length, 6);
    assert.equal(api.getBackend(), backup);
});
test('a temporary account-service error recovers the portfolio without treating it as a logout', async () => {
    const { api } = setup(url => url.endsWith('/health') ? ok({ status: 'ok' }) : url.startsWith(primary)
        ? new Response('{}', { status: 503 }) : ok({ balance: 97721.39, holdings: [{ symbol: 'GOLDBEES' }] }));
    const response = await api.apiFetch(primary + '/api/portfolio');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).balance, 97721.39);
    assert.equal(api.getBackend(), backup);
});
test('socket failover preserves listeners, replays subscriptions and detaches the old host', async () => {
    const sockets = []; let change;
    class FakeSocket {
        connected = false; handlers = {}; sent = [];
        on(event, fn) { this.handlers[event] = fn; }
        onAny(fn) { this.any = fn; }
        connect() { this.connected = true; this.handlers.connect(); }
        emit(...args) { this.sent.push(args); }
        disconnect() { this.connected = false; }
        removeAllListeners() { this.handlers = {}; this.any = undefined; }
    }
    const { MarketSocket } = load('socket.ts', { 'socket.io-client': { io: url => { const s = new FakeSocket(); s.url = url; sockets.push(s); return s; } },
        './backend': { checkBackend: async () => primary, getBackend: () => primary, onBackendChange: fn => { change = fn; } } });
    const socket = new MarketSocket(); let received = 0;
    const listener = () => received++;
    socket.on('market_update', listener); socket.emit('subscribe', 'ITC');
    change(backup);
    assert.equal(sockets[0].connected, false); assert.equal(sockets[1].url, backup);
    assert.equal(sockets[1].sent[0].join(','), 'subscribe,ITC');
    sockets[1].any('market_update', {}); assert.equal(received, 1);
    socket.off('market_update', listener); sockets[1].any('market_update', {}); assert.equal(received, 1);
});
