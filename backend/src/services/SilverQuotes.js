const PublicReadCache = require('./PublicReadCache');
const cache = new PublicReadCache();
const IBJA_URL = 'https://www.ibjarates.com/';

function parseBenchmark(html) {
    // Only the current AM/PM Silver 999 cells. The historical tables use different fields.
    const rate = session => {
        const match = html.match(new RegExp(`<span id="lblSilver999_${session}">\\s*([\\d,]+(?:\\.\\d+)?)\\s*</span>`, 'i'));
        const value = Number(match?.[1].replaceAll(',', ''));
        return Number.isFinite(value) && value > 0 ? value : null;
    };
    const pm = rate('PM');
    const price = pm ?? rate('AM');
    return price === null ? null : { price, session: pm === null ? 'AM' : 'PM' };
}

function frontContract(quotes, symbol, now = Date.now()) {
    if (!Array.isArray(quotes)) return null;
    const today = new Date(now + 330 * 60000).toISOString().slice(0, 10);
    return quotes.filter(quote =>
        quote?.symbol === symbol && quote.exchange === 'MCX' && quote.type === 'future' &&
        quote.currency === 'INR' && quote.unit === 'kg' &&
        typeof quote.expiry === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(quote.expiry) && quote.expiry >= today &&
        Number.isFinite(quote.price) && quote.price > 0 &&
        typeof quote.tradedAt === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(quote.tradedAt) &&
        Date.parse(quote.tradedAt) >= now - 7 * 86400000 && Date.parse(quote.tradedAt) <= now + 5000)
        .sort((a, b) => a.expiry.localeCompare(b.expiry) || Date.parse(b.tradedAt) - Date.parse(a.tradedAt))[0] || null;
}

async function read(url, accept, signal, token) {
    const response = await fetch(url, { headers: token ? { accept, authorization: `Bearer ${token}` } : { accept }, redirect: 'error',
        signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]) });
    if (!response.ok || !response.headers.get('content-type')?.includes(accept)) throw Error('Silver source unavailable');
    return response;
}

async function physical(signal) {
    return cache.load('ibja', 5 * 60000, async () => {
        const response = await read(IBJA_URL, 'text/html', signal);
        const quote = parseBenchmark(await response.text());
        return quote && { ...quote, checkedAt: new Date().toISOString() };
    }).catch(() => null);
}

async function futures(symbol, signal) {
    // URL is server configuration for a licensed feed or its normalized gateway.
    // The public MCX website prohibits automated collection and redistribution.
    const endpoint = process.env.MCX_LICENSED_SILVER_FEED_URL;
    if (!endpoint) return { configured: false, quote: null };
    const quotes = await cache.load('licensed-mcx', 30000, async () => {
        const url = new URL(endpoint);
        if (url.protocol !== 'https:' || url.username || url.password) throw Error('Invalid MCX feed URL');
        const response = await read(url, 'application/json', signal, process.env.MCX_LICENSED_SILVER_FEED_TOKEN);
        return (await response.json()).quotes;
    }).catch(() => null);
    return { configured: true, quote: frontContract(quotes, symbol) };
}

module.exports = { physical, futures, parseBenchmark, frontContract };
