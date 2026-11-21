const { quoteKey, quoteTime } = require('./QuoteIdentity');
const money = n => Number.isFinite(n) ? Number(n.toFixed(2)) : null;

// Mirrors frontend/lib/dailyReturn.ts; parity tests exercise both implementations.
// Keep session purchases at execution cost and retain the return on today's sales.
function calculateDailyReturn(holdings, trades, prices, previousClose, sessionDate) {
    const groups = new Map();
    const group = symbol => { const key = quoteKey(symbol); if (!groups.has(key)) groups.set(key, { quantity: 0, bought: 0, sold: 0, buys: 0, sales: 0 }); return groups.get(key); };
    holdings.forEach(h => { group(h.symbol).quantity += h.quantity; });
    trades.filter(t => sessionDate && new Date(Date.parse(t.createdAt) + 330 * 60000).toISOString().slice(0, 10) === sessionDate).forEach(t => {
        const g = group(t.symbol);
        if (t.type === 'BUY') { g.bought += t.quantity; g.buys += t.totalAmount; }
        else { g.sold += t.quantity; g.sales += t.totalAmount; }
    });
    let value = 0, basis = 0, ready = !!sessionDate;
    const bySymbol = {};
    groups.forEach((g, symbol) => {
        const opening = g.quantity - g.bought + g.sold, price = prices[symbol], close = previousClose[symbol];
        const available = opening >= 0 && (!g.quantity || (Number.isFinite(price) && price > 0)) && (!opening || (Number.isFinite(close) && close > 0));
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

async function buildPortfolioSnapshot({ balance, holdings }, trades, { getQuote, sessionDate, marketOpen }) {
    if (!Number.isFinite(balance) || balance < 0 || !Array.isArray(holdings) || holdings.length > 200) throw Error('Portfolio unavailable');
    const positions = holdings.map(h => ({ symbol: quoteKey(h.symbol), quantity: h.quantity, averagePrice: h.averagePrice }));
    if (positions.some(h => !h.symbol || !Number.isSafeInteger(h.quantity) || h.quantity <= 0 || !Number.isFinite(h.averagePrice) || h.averagePrice <= 0)) throw Error('Invalid holdings');
    // Sold-out positions still need a previous close for this session's return.
    const sold = trades.filter(t => new Date(Date.parse(t.createdAt) + 330 * 60000).toISOString().slice(0, 10) === sessionDate).map(t => quoteKey(t.symbol));
    const symbols = [...new Set([...positions.map(h => h.symbol), ...sold])];
    if (symbols.length > 400) throw Error('Portfolio quote limit exceeded');
    const prices = {}, previousClose = {}, quotes = {};
    // Bound provider work, while reusing the same accepted displayQuote cache/feed.
    for (let i = 0; i < symbols.length; i += 8) await Promise.all(symbols.slice(i, i + 8).map(async symbol => {
        let q; try { q = await getQuote(symbol); } catch { /* Unavailable stays null. */ }
        const at = quoteTime(q?.timestamp);
        const observedAt = Date.now();
        const valid = Number.isFinite(q?.price) && q.price > 0 && Number.isFinite(at) && at <= observedAt + 5000;
        if (valid) prices[symbol] = q.price;
        const close = q?.prevClose ?? (Number.isFinite(q?.change) ? q.price - q.change : undefined);
        if (valid && Number.isFinite(close) && close > 0) previousClose[symbol] = close;
        quotes[symbol] = { quoteAt: valid ? new Date(at).toISOString() : null,
            status: !valid ? 'unavailable' : marketOpen && observedAt - at > 60000 ? 'delayed' : marketOpen ? 'latest_available' : 'market_closed' };
    }));
    const daily = calculateDailyReturn(positions, trades, prices, previousClose, sessionDate);
    const rows = positions.map(h => {
        const invested = h.quantity * h.averagePrice, value = h.quantity * prices[h.symbol], pnl = value - invested;
        const day = daily.bySymbol[h.symbol];
        return { ...h, price: prices[h.symbol] ?? null, invested: money(invested), currentValue: money(value),
            totalReturns: money(pnl), totalReturnsPercent: money(invested > 0 ? pnl / invested * 100 : 0),
            todayReturns: daily.ready && day?.ready ? day.value : null, ...quotes[h.symbol] };
    });
    // Sum before rounding, exactly as PortfolioContext does.
    const invested = positions.reduce((n, h) => n + h.quantity * h.averagePrice, 0);
    const currentValue = positions.reduce((n, h) => n + h.quantity * (prices[h.symbol] ?? NaN), 0);
    const totalReturns = currentValue - invested;
    return { capturedAt: new Date().toISOString(), returnSessionDate: sessionDate, marketOpen, balance: money(balance),
        invested: money(invested), currentValue: money(currentValue), totalReturns: money(totalReturns),
        totalReturnsPercent: money(invested > 0 ? totalReturns / invested * 100 : 0),
        todayReturns: daily.ready ? daily.value : null, todayReturnsPercent: daily.ready ? money(daily.percent) : null,
        quotesDelayedOrUnavailable: symbols.some(symbol => ['delayed', 'unavailable'].includes(quotes[symbol].status)),
        holdings: rows,
        methodology: 'Point-in-time snapshot from the same account records and display quote feed as Dashboard and Holdings. Current value and total returns exclude available balance. Total returns are unrealised P&L on open holdings. 1D return includes this session’s sales, overnight shares at prior close, and purchases at execution cost. Missing quotes or incomplete daily references leave affected values null. Quotes may have different timestamps; this saved answer does not stream updates.' };
}
module.exports = { buildPortfolioSnapshot, calculateDailyReturn };
