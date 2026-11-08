const crypto = require('crypto');

module.exports = function signupVerification({ PendingSignup, User, mailer, secret, now = () => new Date() }) {
    const digest = (email, code) => crypto.createHmac('sha256', secret).update(`signup:${email}:${code}`).digest('hex');
    const emailOf = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
    return {
        async request({ email, name, phone, password_hash }) {
            if (!mailer.isConfigured()) throw new Error('Email delivery is unavailable. Please try again later.');
            email = emailOf(email);
            const time = now();
            const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
            const otpHash = digest(email, code);
            // The unique email index makes concurrent sends share the cooldown.
            try {
                await PendingSignup.findOneAndUpdate({ email, $or: [{ sentAt: null }, { sentAt: { $lte: new Date(+time - 60000) } }] },
                    { $set: { name, phone, password_hash, otpHash, attempts: 0, sentAt: time, expiresAt: new Date(+time + 600000) } },
                    { upsert: true, setDefaultsOnInsert: true });
            } catch (error) {
                if (error.code === 11000) throw new Error('Please wait 60 seconds before requesting another code.');
                throw error;
            }
            try { await mailer.sendSignupOtp(email, code); }
            catch {
                await PendingSignup.deleteOne({ email, otpHash });
                throw new Error('Email delivery is unavailable. Please try again later.');
            }
        },
        async verify(email, code) {
            email = emailOf(email);
            if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new Error('Invalid or expired code');
            const pending = await PendingSignup.findOneAndUpdate({ email, expiresAt: { $gt: now() }, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } });
            if (!pending || !crypto.timingSafeEqual(Buffer.from(pending.otpHash, 'hex'), Buffer.from(digest(email, code), 'hex'))) throw new Error('Invalid or expired code');
            // Only one verification can consume the code and create the account.
            const claimed = await PendingSignup.findOneAndDelete({ _id: pending._id, otpHash: pending.otpHash, expiresAt: { $gt: now() } });
            if (!claimed) throw new Error('Invalid or expired code');
            return User.create({ email, name: claimed.name, phone: claimed.phone,
                password_hash: claimed.password_hash, authProvider: 'local', emailVerifiedAt: now() });
        },
    };
};
