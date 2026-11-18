type Point = { date: string; close: number };
type Quote = { price: number | null; timestamp?: number };

// Add only an actual, newer observation. Never extend yesterday's chart into
// today's session, or replace newer history with a delayed/older quote.
export function chartWithQuote<T extends Point>(history: T[], period: string, asOf: string | undefined, quote: Quote, now = Date.now()): (T | Point)[] {
    const last = history.at(-1), at = quote.timestamp;
    if (!last || !(quote.price && Number.isFinite(quote.price) && quote.price > 0) || !at || at > now + 15000) return history;
    const observed = period === '1d' ? Date.parse(last.date) : Date.parse(asOf || '');
    if (!Number.isFinite(observed) || at < observed || at < Date.parse(last.date)) return history;
    if (period === '1d') {
        const day = new Date(Date.parse(history[0].date) + 330 * 60000).toISOString().slice(0, 10);
        if (at < Date.parse(`${day}T09:15:00+05:30`) || at > Date.parse(`${day}T15:30:00+05:30`)) return history;
    }
    if (Math.abs(last.close - quote.price) < .005) return history;
    const point = { date: new Date(at).toISOString(), close: quote.price };
    return at === Date.parse(last.date) ? [...history.slice(0, -1), point] : [...history, point];
}
