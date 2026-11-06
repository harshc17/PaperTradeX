const crypto = require('crypto');

module.exports = function passwordReset({ User, mailer, secret, hashPassword, now = () => new Date() }) {
    const digest = value => crypto.createHmac('sha256', secret).update(value).digest('hex');
    const emailOf = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
    return {
        async request(email) {
            if (!mailer.isConfigured()) throw new Error('Email delivery is unavailable. Please try again later.');
            email = emailOf(email);
            const time = now();
            const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
            const hash = digest(`${email}:${code}`);
            const user = await User.findOneAndUpdate({ email, password_hash: { $ne: null },
                $or: [{ resetOtpSentAt: null }, { resetOtpSentAt: { $lte: new Date(+time - 60000) } }] },
            { $set: { resetOtpHash: hash, resetOtpExpires: new Date(+time + 600000), resetOtpAttempts: 0,
                resetOtpSentAt: time, resetPasswordToken: null, resetPasswordExpires: null } });
            if (!user) return;
            try { await mailer.sendResetOtp(email, code); }
            catch (error) {
                await User.updateOne({ _id: user._id, resetOtpHash: hash }, { $set: { resetOtpHash: null, resetOtpSentAt: null } });
                throw new Error('Email delivery is unavailable. Please try again later.');
            }
        },
        async verify(email, code) {
            email = emailOf(email);
            if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new Error('Invalid or expired code');
            // Claim an attempt atomically so concurrent guesses share the same limit.
            const user = await User.findOneAndUpdate({ email, resetOtpHash: { $ne: null },
                resetOtpExpires: { $gt: now() }, resetOtpAttempts: { $lt: 5 } }, { $inc: { resetOtpAttempts: 1 } });
            if (!user || !crypto.timingSafeEqual(Buffer.from(user.resetOtpHash, 'hex'), Buffer.from(digest(`${email}:${code}`), 'hex'))) {
                throw new Error('Invalid or expired code');
            }
            const token = crypto.randomBytes(32).toString('hex');
            const result = await User.updateOne({ _id: user._id, resetOtpHash: user.resetOtpHash,
                resetOtpExpires: { $gt: now() } }, { $set: { resetOtpHash: null, resetOtpExpires: null,
                resetPasswordToken: digest(token), resetPasswordExpires: new Date(+now() + 600000) } });
            if (!result.modifiedCount) throw new Error('Invalid or expired code');
            return token;
        },
        async reset(email, token, password) {
            if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid or expired reset session');
            const password_hash = await hashPassword(password);
            const user = await User.findOneAndUpdate({ email: emailOf(email), resetPasswordToken: digest(token),
                resetPasswordExpires: { $gt: now() } }, { $set: { password_hash, resetPasswordToken: null,
                resetPasswordExpires: null, resetOtpHash: null, resetOtpExpires: null }, $inc: { tokenVersion: 1 } });
            if (!user) throw new Error('Invalid or expired reset session');
        },
    };
};
