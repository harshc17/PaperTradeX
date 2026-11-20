import { quoteSymbol } from './quoteSymbol';

type QuoteState = {
    livePrices: Record<string, number>;
    liveChanges: Record<string, number>;
    livePreviousClose: Record<string, number>;
    quoteTimes: Record<string, number>;
    quoteSources: Record<string, string>;
    marketOpen: boolean | null;
};

// Every price surface reads one exchange-specific observation. In particular,
// a change must describe this price, rather than an older metadata response.
export function stockQuote(state: QuoteState, symbol: string, now = Date.now()) {
    const key = quoteSymbol(symbol);
    const value = state.livePrices[key];
    const price = Number.isFinite(value) && value > 0 ? value : null;
    const timestamp = state.quoteTimes[key];
    const previousClose = state.livePreviousClose[key];
    const change = price !== null && previousClose > 0
        ? Number((price - previousClose).toFixed(2)) : state.liveChanges[key] ?? 0;
    const stale = price === null || !timestamp || timestamp > now + 5000
        || (!!state.marketOpen && now - timestamp > 60000);
    return { price, change, percent: previousClose > 0 ? change / previousClose * 100 : 0,
        previousClose, timestamp, source: state.quoteSources[key], stale, marketOpen: state.marketOpen };
}
