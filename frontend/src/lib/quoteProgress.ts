// A repeated socket broadcast is a heartbeat, not a new market observation.
export function quoteAdvanced(quote: { price?: number; timestamp?: string }, previousAt = 0, now = Date.now()) {
    const at = Date.parse(quote?.timestamp || '');
    return Number.isFinite(quote?.price) && (quote.price || 0) > 0 && Number.isFinite(at)
        && at > previousAt && at <= now + 5000;
}
