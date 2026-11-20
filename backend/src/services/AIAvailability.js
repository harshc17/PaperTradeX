const enabled = false;
function requireAvailable(req, res, next) {
    if (enabled) return next();
    return res.status(503).json({ error: 'AI features are coming soon.', code: 'AI_COMING_SOON' });
}
module.exports = { enabled, requireAvailable };
