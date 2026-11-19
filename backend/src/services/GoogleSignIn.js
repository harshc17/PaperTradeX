const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const fail = (status, message) => Object.assign(new Error(message), { status });

module.exports = function googleSignIn({ User, clientId, secret, verifyToken }) {
    function config() {
        if (!clientId) return { enabled: false };
        const nonce = crypto.randomBytes(32).toString('hex');
        const challenge = jwt.sign({ purpose: 'google-sign-in', nonce }, secret,
            { algorithm: 'HS256', audience: clientId, issuer: 'papertradex-google', expiresIn: '10m' });
        return { enabled: true, clientId, nonce, challenge };
    }
    async function signIn(credential, challenge) {
        if (!clientId) throw fail(503, 'Google sign-in is not configured yet.');
        if (typeof credential !== 'string' || !credential || credential.length > 20000 ||
            typeof challenge !== 'string' || challenge.length > 4000) throw fail(400, 'Start Google sign-in again.');
        let state;
        try {
            state = jwt.verify(challenge, secret, { algorithms: ['HS256'], audience: clientId, issuer: 'papertradex-google' });
            if (state.purpose !== 'google-sign-in' || typeof state.nonce !== 'string') throw Error('Invalid challenge');
        } catch { throw fail(401, 'Google sign-in expired. Please try again.'); }
        let payload;
        try { payload = await verifyToken(credential); }
        catch { throw fail(401, 'Google sign-in could not be verified. Please try again.'); }
        if (typeof payload?.sub !== 'string' || !payload.sub || payload.sub.length > 255 ||
            typeof payload.email !== 'string' || !validator.isEmail(payload.email) || payload.email_verified !== true) {
            throw fail(401, 'Choose a Google account with a verified email address.');
        }
        if (typeof payload.nonce !== 'string' || payload.nonce.length !== state.nonce.length ||
            !crypto.timingSafeEqual(Buffer.from(payload.nonce), Buffer.from(state.nonce))) {
            throw fail(401, 'Google sign-in did not match this request. Please try again.');
        }
        await User.init(); // unique identity index must exist before account writes
        let user = await User.findOne({ googleId: payload.sub });
        if (user) return user;
        const email = payload.email.toLowerCase().trim();
        // Google does not continuously verify ownership of third-party email
        // accounts. Never use those emails to take over a password account.
        const authoritative = email.endsWith('@gmail.com') || (typeof payload.hd === 'string' && payload.hd.length > 0);
        if (!authoritative) throw fail(403, 'Use email sign-in for this account. Google cannot confirm ownership of its email domain.');
        user = await User.findOne({ email });
        if (user) {
            if (user.googleId && user.googleId !== payload.sub) throw fail(409, 'This email is already linked to another Google account. Use email sign-in.');
            const linked = await User.findOneAndUpdate({ _id: user._id,
                $or: [{ googleId: null }, { googleId: payload.sub }] },
                { $set: { googleId: payload.sub, emailVerifiedAt: user.emailVerifiedAt || new Date() } }, { new: true });
            if (!linked) throw fail(409, 'Account details changed. Please sign in again.');
            return linked;
        }
        try {
            return await User.create({ email, name: typeof payload.name === 'string' && payload.name.trim()
                ? payload.name.trim().slice(0, 120) : email.split('@')[0], googleId: payload.sub,
                authProvider: 'google', emailVerifiedAt: new Date(), password_hash: null });
        } catch (error) {
            if (error.code !== 11000) throw error;
            const existing = await User.findOne({ googleId: payload.sub });
            if (existing) return existing;
            throw fail(409, 'An account already uses this email. Please try signing in again.');
        }
    }
    return { config, signIn };
};
