export function keepNewestQuote<T extends { timestamp?: string }>(current: T | undefined, incoming: T): T {
    const previous = Date.parse(current?.timestamp || '');
    const next = Date.parse(incoming.timestamp || '');
    return current && Number.isFinite(previous) && (!Number.isFinite(next) || next < previous) ? current : incoming;
}
