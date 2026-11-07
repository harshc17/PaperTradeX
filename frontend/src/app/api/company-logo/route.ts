import { NextRequest } from 'next/server';

const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400' };

export async function GET(request: NextRequest) {
    const symbol = (request.nextUrl.searchParams.get('symbol') || '').toUpperCase().replace(/\.(NS|BO)$/, '');
    if (!/^[A-Z0-9][A-Z0-9&-]{0,29}$/.test(symbol)) return new Response(null, { status: 400 });

    // Only fixed public asset hosts are allowed; the caller cannot supply a URL.
    const ticker = encodeURIComponent(symbol);
    const sources = [
        `https://images.dhan.co/symbol/${ticker}.png`,
        `https://assets-netstorage.groww.in/stock-assets/logos2/${ticker}.webp`,
    ];
    for (const source of sources) {
        try {
            const response = await fetch(source, { signal: AbortSignal.timeout(2500), redirect: 'error', next: { revalidate: 604800 } });
            if (!response.ok) continue;
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.length < 20 || bytes.length > 512_000) continue;
            const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
            const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
            if (!png && !webp) continue;
            return new Response(bytes, { headers: { ...CACHE_HEADERS, 'Content-Type': png ? 'image/png' : 'image/webp', 'X-Content-Type-Options': 'nosniff' } });
        } catch {
            // An unavailable logo must never prevent stock information loading.
        }
    }
    return new Response(null, { status: 404, headers: CACHE_HEADERS });
}
