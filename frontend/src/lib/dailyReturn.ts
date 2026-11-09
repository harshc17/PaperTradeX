type Holding = { symbol: string; quantity: number };
type Trade = { symbol: string; type: 'BUY' | 'SELL'; quantity: number; totalAmount: number; createdAt: string };
const normalize = (symbol: string) => symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
const istDate = (date: string) => {
    const time = Date.parse(date);
    return Number.isFinite(time) ? new Date(time + 330 * 60000).toISOString().slice(0, 10) : '';
};

// Opening shares are reconstructed from current positions and filled trades.
// Today's buys start earning at execution price; sales retain their daily P&L.
export function calculateDailyReturn(holdings: Holding[], trades: Trade[], prices: Record<string, number>, previousClose: Record<string, number>, sessionDate: string | undefined) {
    const groups = new Map<string, { quantity: number; bought: number; sold: number; buys: number; sales: number }>();
    const group = (symbol: string) => {
        const key = normalize(symbol);
        if (!groups.has(key)) groups.set(key, { quantity: 0, bought: 0, sold: 0, buys: 0, sales: 0 });
        return groups.get(key)!;
    };
    holdings.forEach(h => { group(h.symbol).quantity += h.quantity; });
    trades.filter(t => sessionDate && istDate(t.createdAt) === sessionDate).forEach(t => {
        const g = group(t.symbol);
        if (t.type === 'BUY') { g.bought += t.quantity; g.buys += t.totalAmount; }
        else { g.sold += t.quantity; g.sales += t.totalAmount; }
    });
    let value = 0, basis = 0, ready = !!sessionDate;
    const bySymbol: Record<string, { value: number; percent: number; ready: boolean }> = {};
    groups.forEach((g, symbol) => {
        const opening = g.quantity - g.bought + g.sold;
        const price = prices[symbol];
        const close = previousClose[symbol];
        const available = opening >= 0 && (!g.quantity || (Number.isFinite(price) && price > 0))
            && (!opening || (Number.isFinite(close) && close > 0));
        if (!available) { ready = false; bySymbol[symbol] = { value: 0, percent: 0, ready: false }; return; }
        const openingValue = opening ? opening * close : 0;
        const symbolValue = Number(((g.quantity ? g.quantity * price : 0) - openingValue - g.buys + g.sales).toFixed(2));
        const symbolBasis = openingValue + g.buys;
        value += symbolValue; basis += symbolBasis;
        bySymbol[symbol] = { value: symbolValue, percent: symbolBasis > 0 ? symbolValue / symbolBasis * 100 : 0, ready: true };
    });
    value = Number(value.toFixed(2));
    return { value, percent: basis > 0 ? value / basis * 100 : 0, ready, bySymbol };
}
