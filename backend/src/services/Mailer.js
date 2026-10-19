const nodemailer = require('nodemailer');

const SMTP_CONFIGURED = !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
);

let transporter = null;
if (SMTP_CONFIGURED) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
}

async function sendResetEmail(toEmail, resetLink) {
    const from = process.env.SMTP_FROM || 'PaperTradeX <no-reply@papertradex.com>';
    const subject = 'Reset your PaperTradeX password';
    const html = `
        <p>You requested a password reset for your PaperTradeX account.</p>
        <p><a href="${resetLink}">Click here to reset your password</a></p>
        <p>This link expires in <strong>1 hour</strong>. If you did not request this, ignore this email.</p>
        <p style="color:#888;font-size:12px">${resetLink}</p>
    `;

    if (!SMTP_CONFIGURED) {
        console.log('\n[Mailer] SMTP not configured — password reset link (dev only):');
        console.log(`[Mailer] ${resetLink}\n`);
        return;
    }

    await transporter.sendMail({ from, to: toEmail, subject, html });
}

module.exports = { sendResetEmail };
