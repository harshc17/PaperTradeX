const { test } = require('node:test');
const assert = require('node:assert/strict');

test('signup and reset use Brevo HTTPS and the PaperTradeX sender', async () => {
    const originalFetch = global.fetch, originalKey = process.env.BREVO_API_KEY, originalFrom = process.env.EMAIL_FROM;
    process.env.BREVO_API_KEY = 'test-key'; delete process.env.EMAIL_FROM;
    delete require.cache[require.resolve('../src/services/Mailer')];
    const mailer = require('../src/services/Mailer'); const calls = [];
    global.fetch = async (url, options) => { calls.push({ url, ...options, body: JSON.parse(options.body) }); return { ok: true }; };
    try {
        await mailer.sendSignupOtp('qa@example.com', '123456'); await mailer.sendResetOtp('qa@example.com', '654321');
        assert.equal(calls.length, 2);
        for (const call of calls) {
            assert.equal(call.url, 'https://api.brevo.com/v3/smtp/email');
            assert.equal(call.body.sender.email, 'harsh@papertradex.in');
            assert.equal(call.headers['api-key'], 'test-key');
        }
        assert.match(calls[0].body.textContent, /123456/); assert.match(calls[1].body.textContent, /654321/);
        global.fetch = async () => ({ ok: false });
        await assert.rejects(mailer.sendResetOtp('qa@example.com', '123456'), /rejected/);
    } finally {
        global.fetch = originalFetch;
        for (const [key, value] of [['BREVO_API_KEY', originalKey], ['EMAIL_FROM', originalFrom]]) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
    }
});
