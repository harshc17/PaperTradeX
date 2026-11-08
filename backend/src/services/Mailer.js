const nodemailer = require('nodemailer');
const SMTP_CONFIGURED = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const FROM_EMAIL = process.env.EMAIL_FROM || 'harsh@papertradex.in';
const transporter = SMTP_CONFIGURED ? nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 15000, socketTimeout: 15000,
}) : null;
async function send(toEmail, subject, text) {
    if (process.env.BREVO_API_KEY) {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({ sender: { name: 'PaperTradeX', email: FROM_EMAIL }, to: [{ email: toEmail }], subject, textContent: text }),
        });
        if (!response.ok) {
            const failure = await response.json().catch(() => ({}));
            const message = String(failure.message || '').toLowerCase();
            const reason = /ip|not verified/.test(message) ? 'IP authorization required'
                : /key/.test(message) ? 'API key rejected'
                : /sender/.test(message) ? 'Sender verification required' : 'Provider authorization or delivery failure';
            // Extract only the server's public IPv4 address from an IP rejection.
            // Never log the complete provider message, API key or OTP content.
            const addresses = reason === 'IP authorization required'
                ? (message.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []).filter(ip => ip.split('.').every(part => Number(part) <= 255)) : [];
            const ipHint = addresses.length ? `; outbound IP ${[...new Set(addresses)].join(', ')}` : '';
            console.error(`[Mailer] Brevo rejected delivery (HTTP ${response.status}; ${reason}${ipHint})`);
            throw new Error('Email provider rejected delivery');
        }
        return;
    }
    if (!transporter) throw new Error('Email delivery is not configured');
    await transporter.sendMail({ from: { name: 'PaperTradeX', address: FROM_EMAIL }, to: toEmail, subject, text });
}
module.exports = {
    isConfigured: () => !!process.env.BREVO_API_KEY || SMTP_CONFIGURED,
    sendSignupOtp: (email, code) => send(email, 'Verify your PaperTradeX email',
        `Your email verification code is ${code}. It expires in 10 minutes. Enter it to finish creating your PaperTradeX account. Do not share this code. If you did not request it, ignore this email.`),
    sendResetOtp: (email, code) => send(email, 'Your PaperTradeX password reset code',
        `Your password reset code is ${code}. It expires in 10 minutes. Do not share this code. If you did not request it, ignore this email.`),
};
