const { nseQuoteTime } = require('./QuoteIdentity');
module.exports = function exchangeDisclosures(client) {
    const cache = new Map();
    return async symbol => {
        const found = cache.get(symbol);
        if (found && found.until > Date.now()) return found.value;
        const value = (async () => {
            // Reuse the existing exchange session/backoff. Never open extra sessions or evade a block.
            if (!client._sessionValid || client._inBackoff) return { available: false, reason: 'Verified exchange disclosure feed is currently unavailable.' };
            try {
                const rows = await client._get(`/api/corporate-announcements?index=equities&symbol=${encodeURIComponent(symbol)}`, 0);
                if (!Array.isArray(rows)) throw Error('Invalid exchange response');
                const announcements = rows.filter(row => row.symbol === symbol).map(row => {
                    const at = nseQuoteTime(row.an_dt || row.sort_date);
                    let url = null;
                    try { const parsed = new URL(row.attchmntFile); if (parsed.protocol === 'https:' && !parsed.username && !parsed.password && (parsed.hostname === 'nseindia.com' || parsed.hostname.endsWith('.nseindia.com'))) url = parsed.href; } catch { /* No unsafe external attachment links. */ }
                    return { symbol, title: String(row.desc || row.attchmntText || '').replace(/<[^>]*>/g, '').slice(0, 400),
                        publishedAt: Number.isFinite(at) && at <= Date.now() + 5000 ? new Date(at).toISOString() : null, url };
                }).filter(row => row.title && row.publishedAt).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 5);
                return { available: announcements.length > 0, source: 'NSE corporate announcements', fetchedAt: new Date().toISOString(), announcements,
                    limitation: 'Announcement titles and attachment links only. Attachment contents and news sentiment have not been verified.' };
            } catch { return { available: false, reason: 'Verified exchange disclosure feed is unavailable.' }; }
        })();
        cache.set(symbol, { until: Date.now() + 300000, value });
        if (cache.size > 200) cache.delete(cache.keys().next().value);
        return value;
    };
};
