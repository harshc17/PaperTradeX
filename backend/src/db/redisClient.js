/**
 * redisClient.js — Primary datastore connection.
 *
 * Redis is the source of truth for the app. This module owns the single shared
 * client, tracks whether it is currently usable (`redisUp()`), and exposes a
 * `connectRedis()` bootstrap. All persistence logic lives in BaseModel.js; this
 * file only manages the connection and readiness signal.
 */
const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Reconnect with capped exponential backoff so a blip doesn't hammer the server.
const client = createClient({
    url: REDIS_URL,
    socket: {
        connectTimeout: 10000,
        reconnectStrategy: (retries) => Math.min(retries * 200, 3000),
    },
});

let ready = false;

client.on('ready', () => {
    ready = true;
    console.log('[Redis] Connected ✓');
});
client.on('error', (err) => {
    // Redis client emits 'error' on transient socket issues too; only log, never throw.
    console.warn('[Redis] Client error:', err.message);
});
client.on('reconnecting', () => {
    ready = false;
    console.warn('[Redis] Reconnecting…');
});
client.on('end', () => {
    ready = false;
    console.warn('[Redis] Connection closed.');
});

/** True when the client is connected and commands can be issued. */
function redisUp() {
    return ready && client.isReady;
}

/**
 * Establish the initial connection. Throws if Redis cannot be reached at
 * startup — Redis is the primary store, so a hard failure here is surfaced to
 * the caller (server.js logs it but keeps the process alive so the fallback
 * path can still serve requests from Mongo).
 */
async function connectRedis() {
    if (!client.isOpen) {
        await client.connect();
    }
    return client;
}

module.exports = { client, connectRedis, redisUp };
