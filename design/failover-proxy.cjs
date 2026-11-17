// Local-only outage simulation. Never changes either production server.
const http = require('node:http');
const https = require('node:https');
let primaryDown = false;
const tunnels = new Set();
for (const [port, target] of [[3015, 'https://paperttradex-production.up.railway.app'], [3016, 'https://papertradex-roib.onrender.com']]) {
    const server = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3014');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
        if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
        if (req.url === '/_test/primary' && port === 3015 && req.method === 'POST') {
            const chunks = []; for await (const c of req) chunks.push(c);
            primaryDown = JSON.parse(Buffer.concat(chunks)).offline;
            if (primaryDown) tunnels.forEach(socket => socket.destroy());
            res.writeHead(200); return res.end(JSON.stringify({ primaryDown }));
        }
        if (port === 3015 && primaryDown) { res.writeHead(503); return res.end('{"status":"unavailable"}'); }
        try {
            const chunks = []; for await (const c of req) chunks.push(c);
            const headers = { Origin: 'https://papertradex.in' };
            for (const k of ['content-type', 'authorization', 'idempotency-key']) if (req.headers[k]) headers[k] = req.headers[k];
            const response = await fetch(target + req.url, { method: req.method, headers,
                body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks), signal: AbortSignal.timeout(45000) });
            res.writeHead(response.status, { 'Content-Type': response.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' });
            res.end(Buffer.from(await response.arrayBuffer()));
            if (req.url === '/api/portfolio' || req.url === '/api/orders') console.log(JSON.stringify({ port, path: req.url, status: response.status }));
        } catch { if (!res.headersSent) res.writeHead(502); res.end(); }
    });
    server.on('upgrade', (req, socket, head) => {
        if (port === 3015 && primaryDown) return socket.destroy();
        const headers = { ...req.headers, host: new URL(target).host, origin: 'https://papertradex.in' };
        const upstream = https.request(target + req.url, { headers });
        upstream.on('upgrade', (response, remote, remoteHead) => {
            socket.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(response.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`);
            if (head.length) remote.write(head); if (remoteHead.length) socket.write(remoteHead);
            socket.pipe(remote); remote.pipe(socket);
            if (port === 3015) tunnels.add(socket);
            socket.on('close', () => { tunnels.delete(socket); remote.destroy(); });
            socket.on('error', () => remote.destroy()); remote.on('error', () => socket.destroy());
        });
        upstream.on('error', () => socket.destroy()); upstream.end();
    });
    server.listen(port, '127.0.0.1', () => console.log(`Verification proxy ready: ${port}`));
}
