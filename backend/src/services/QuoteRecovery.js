// The public chart endpoint is independent of Yahoo's cookie/crumb quote API.
// Keep exchange identity and observation time; never manufacture a fresh tick.
module.exports = function createQuoteRecovery({ fetchChart, now = Date.now }) {
    let blockedUntil = 0;
    const pending = new Map(), cache = new Map();
    return {
        blocked: () => now() < blockedUntil,
        failed(error) {
            if (/429|Too Many Requests|crumb|401|403/i.test(error?.message || '')) blockedUntil = now() + 60000;
        },
        async chart(symbol) {
            if (cache.get(symbol)?.until > now()) return cache.get(symbol).value;
            if (pending.has(symbol)) return pending.get(symbol);
            const request = (async () => {
                const result = await fetchChart(symbol);
                const meta = result?.meta;
                const price = meta?.regularMarketPrice;
                const previous = meta?.previousClose ?? meta?.chartPreviousClose;
                const at = Number(meta?.regularMarketTime) * 1000;
                if (meta?.symbol?.toUpperCase() !== symbol.toUpperCase() || !Number.isFinite(price) || price <= 0 ||
                    !Number.isFinite(previous) || previous <= 0 || !Number.isFinite(at) || at <= 0 || at > now() + 5000) return null;
                if ((meta.regularMarketDayHigh > 0 && price > meta.regularMarketDayHigh + 0.01) ||
                    (meta.regularMarketDayLow > 0 && price < meta.regularMarketDayLow - 0.01)) return null;
                const value = { symbol, regularMarketPrice: price, regularMarketPreviousClose: previous,
                    regularMarketChange: price - previous, regularMarketChangePercent: (price / previous - 1) * 100,
                    regularMarketTime: new Date(at), shortName: meta.shortName || meta.longName || symbol,
                    currency: meta.currency, exchange: meta.exchangeName };
                cache.set(symbol, { value, until: now() + 10000 });
                if (cache.size > 256) cache.delete(cache.keys().next().value);
                return value;
            })().catch(error => {
                // Share temporary failures too, so every viewer does not
                // immediately retry the same throttled provider request.
                cache.set(symbol, { value: null, until: now() + 30000 });
                throw error;
            }).finally(() => pending.delete(symbol));
            pending.set(symbol, request);
            return request;
        },
    };
};
