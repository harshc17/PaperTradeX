const { test } = require('node:test');
const assert = require('node:assert/strict');
const factory = require('../src/services/SignupVerification');

function setup() {
    let row, code, fail = false, time = new Date('2026-11-08T10:00:00Z');
    const accounts = [];
    function matches(q) {
        return row && Object.entries(q).every(([k, v]) => {
            if (k === '$or') return v.some(matches);
            if (v && typeof v === 'object' && !(v instanceof Date)) return Object.entries(v).every(([op, x]) => op === '$gt' ? row[k] > x : op === '$lt' ? row[k] < x : row[k] <= x);
            return v == null ? row[k] == null : row[k] === v;
        });
    }
    const PendingSignup = {
        async findOneAndUpdate(q, u, options) {
            if (!matches(q)) {
                if (!options?.upsert) return null;
                if (row) throw Object.assign(new Error('duplicate email'), { code: 11000 });
                row = { _id: 'pending', email: q.email };
            }
            const old = { ...row };
            Object.assign(row, u.$set);
            for (const [k, v] of Object.entries(u.$inc || {})) row[k] += v;
            return old;
        },
        async findOneAndDelete(q) { if (!matches(q)) return null; const old = row; row = null; return old; },
        async deleteOne(q) { if (matches(q)) row = null; },
    };
    const service = factory({ PendingSignup, User: { async create(user) { accounts.push(user); return user; } },
        secret: 'test-secret', now: () => time,
        mailer: { isConfigured: () => true, async sendSignupOtp(email, value) { if (fail) throw Error('provider failed'); code = value; } } });
    return { service, accounts, get row() { return row; }, get code() { return code; },
        advance(ms) { time = new Date(+time + ms); }, failDelivery() { fail = true; } };
}
const details = { email: 'QA@example.com', name: 'QA', phone: '', password_hash: 'hashed-password' };

test('signup creates no account or session before verification; code is single use', async () => {
    const x = setup(); await x.service.request(details);
    assert.equal(x.accounts.length, 0); assert.match(x.code, /^\d{6}$/); assert.notEqual(x.row.otpHash, x.code);
    const results = await Promise.allSettled([x.service.verify(details.email, x.code), x.service.verify(details.email, x.code)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(x.accounts.length, 1); assert.equal(x.accounts[0].email, 'qa@example.com'); assert.ok(x.accounts[0].emailVerifiedAt);
    await assert.rejects(x.service.verify(details.email, x.code));
});
test('resend is throttled; five incorrect codes lock verification', async () => {
    const x = setup(); await x.service.request(details); await assert.rejects(x.service.request(details), /60 seconds/);
    const wrong = x.code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await assert.rejects(x.service.verify(details.email, wrong));
    await assert.rejects(x.service.verify(details.email, x.code)); assert.equal(x.accounts.length, 0);
    x.advance(61000); await x.service.request(details); await x.service.verify(details.email, x.code); assert.equal(x.accounts.length, 1);
});
test('expired code and delivery failure cannot create accounts', async () => {
    const x = setup(); await x.service.request(details); x.advance(600001);
    await assert.rejects(x.service.verify(details.email, x.code)); assert.equal(x.accounts.length, 0);
    x.failDelivery(); await assert.rejects(x.service.request(details), /unavailable/); assert.equal(x.row, null);
});
