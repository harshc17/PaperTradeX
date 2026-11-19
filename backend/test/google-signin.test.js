const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const create = require('../src/services/GoogleSignIn');
const clientId = 'papertradex-test.apps.googleusercontent.com', secret = 'test-google-sign-in-secret';
function setup(existing = null) {
    const state = { user: existing, creates: 0, links: 0, payload: {} };
    const User = {
        init: async () => {},
        findOne: async query => query.googleId ? state.user?.googleId === query.googleId ? state.user : null
            : state.user?.email === query.email ? state.user : null,
        findOneAndUpdate: async (query, update) => {
            if (state.user._id !== query._id || (state.user.googleId && state.user.googleId !== state.payload.sub)) return null;
            state.links++; Object.assign(state.user, update.$set); return state.user;
        },
        create: async data => { state.creates++; state.user = { _id: 'new-user', role: 'USER', balance: 100000, ...data }; return state.user; },
    };
    const service = create({ User, clientId, secret, verifyToken: async () => state.payload });
    const config = service.config();
    state.payload = { sub: 'google-subject', email: 'owner@gmail.com', email_verified: true, nonce: config.nonce, name: 'Owner' };
    return { state, User, service, config };
}
test('verified Google signup creates one verified account with no password', async () => {
    const { state, service, config } = setup();
    const first = await service.signIn('google-credential', config.challenge);
    const second = await service.signIn('google-credential', config.challenge);
    assert.equal(first._id, second._id); assert.equal(state.creates, 1);
    assert.equal(first.authProvider, 'google'); assert.equal(first.password_hash, null);
    assert(first.emailVerifiedAt instanceof Date); assert.equal(first.balance, 100000);
});
test('existing email account keeps its identity, password, balance and token version', async () => {
    const existing = { _id: 'existing-user', email: 'owner@gmail.com', googleId: null, authProvider: 'local',
        password_hash: 'unchanged-hash', balance: 97721.39, role: 'USER', tokenVersion: 3 };
    const { service, config, state } = setup(existing);
    const user = await service.signIn('google-credential', config.challenge);
    assert.equal(user._id, 'existing-user'); assert.equal(user.balance, 97721.39);
    assert.equal(user.password_hash, 'unchanged-hash'); assert.equal(user.tokenVersion, 3);
    assert.equal(user.authProvider, 'local'); assert.equal(state.creates, 0); assert.equal(state.links, 1);
});
test('request challenge works across primary and backup with the same secret', async () => {
    const { User, state, config } = setup();
    const backup = create({ User, clientId, secret, verifyToken: async () => state.payload });
    assert.equal((await backup.signIn('google-credential', config.challenge)).email, 'owner@gmail.com');
});
test('invalid signatures, expired challenges, nonce mismatches and unverified accounts cannot write users', async () => {
    const { state, service, config } = setup();
    for (const challenge of [config.challenge + 'broken', jwt.sign({ purpose: 'google-sign-in', nonce: config.nonce }, secret,
        { audience: clientId, issuer: 'papertradex-google', expiresIn: -1 })]) {
        await assert.rejects(service.signIn('google-credential', challenge), error => error.status === 401);
    }
    state.payload.nonce = 'x'.repeat(64);
    await assert.rejects(service.signIn('google-credential', config.challenge), error => error.status === 401);
    state.payload.nonce = config.nonce; state.payload.email_verified = false;
    await assert.rejects(service.signIn('google-credential', config.challenge), error => error.status === 401);
    assert.equal(state.creates, 0); assert.equal(state.links, 0);
});
test('third-party Google email cannot take over a password account or relink another Google identity', async () => {
    const existing = { _id: 'local', email: 'owner@example.com', googleId: null, balance: 500 };
    const { service, config, state } = setup(existing);
    state.payload.email = existing.email;
    await assert.rejects(service.signIn('google-credential', config.challenge), error => error.status === 403);
    assert.equal(state.links, 0);
    existing.email = 'owner@gmail.com'; existing.googleId = 'another-google-user'; state.payload.email = existing.email;
    await assert.rejects(service.signIn('google-credential', config.challenge), error => error.status === 409);
    assert.equal(existing.googleId, 'another-google-user');
});
test('disabled Google configuration is explicit and does not accept credentials', async () => {
    const service = create({ User: {}, clientId: '', secret });
    assert.deepEqual(service.config(), { enabled: false });
    await assert.rejects(service.signIn('credential', 'challenge'), error => error.status === 503);
});

test('a concurrent create resolves to the existing identity without another account or balance', async () => {
    const { state, User, service, config } = setup();
    User.create = async data => {
        state.creates++;
        state.user = { _id: 'created-by-other-request', balance: 99900, role: 'USER', ...data };
        throw Object.assign(new Error('Duplicate identity'), { code: 11000 });
    };
    const user = await service.signIn('google-credential', config.challenge);
    assert.equal(user._id, 'created-by-other-request');
    assert.equal(user.balance, 99900);
    assert.equal(state.creates, 1);
});
