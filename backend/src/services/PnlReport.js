const { calculateTradePerformance } = require('./TradingCoach');
const { quoteKey, quoteTime } = require('./QuoteIdentity');

function csvCell(value) {
    let text = value == null ? '' : String(value);
    if (/^[\s]*[=+@-]/.test(text) && typeof value !== 'number') text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
}
const money = value => Number.isFinite(value) ? Number(value.toFixed(2)) : null;

async function buildPnlReport(transactions, { getQuote, marketOpen, now }) {
    const trades = transactions.map(t => ({ ...t, symbol: typeof t.symbol === 'string' ? quoteKey(t.symbol) : '' }));
    const performance = calculateTradePerformance(trades, { includeDetails: true });
    const holdings = await Promise.all(performance.positions.map(async position => {
        let quote;
        try { quote = await getQuote(position.symbol); } catch { /* Leave unavailable valuations blank. */ }
        const observedAt = now ?? Date.now();
        const at = quoteTime(quote?.timestamp);
        const valid = Number.isFinite(quote?.price) && quote.price > 0 && Number.isFinite(at) && at <= observedAt + 5000;
        const currentValue = valid ? money(position.quantity * quote.price) : null;
        return { ...position, price: valid ? quote.price : null, currentValue,
            pnl: currentValue == null ? null : money(currentValue - position.invested),
            quoteAt: valid ? new Date(at).toISOString() : '',
            status: !valid ? 'Unavailable' : marketOpen && observedAt - at > 60000 ? 'Delayed - last known quote' : marketOpen ? 'Latest available quote' : 'Market closed - last available quote' };
    }));
    const complete = holdings.every(p => p.currentValue !== null);
    const invested = money(holdings.reduce((n, p) => n + p.invested, 0));
    const currentValue = complete ? money(holdings.reduce((n, p) => n + p.currentValue, 0)) : null;
    const unrealised = complete ? money(currentValue - invested) : null;
    const realised = performance.metrics.netRealisedPnl;
    const rows = [
        ['PaperTradeX P&L Report'], ['Account type', 'Paper trading - virtual funds only'],
        ['Period', 'All time'], ['Generated at (UTC)', new Date(now ?? Date.now()).toISOString()], ['Currency', 'INR'],
        ['Cost method', 'Weighted-average recorded purchase cost; partial sales allocated to paise'],
        ['Notes', 'Cash and pending/cancelled orders excluded. No additional fees or taxes assumed. This is not a tax statement. Quotes can have different source times.'], [],
        ['Summary', 'Amount (INR)'], ['Realised P&L', realised], ['Unrealised P&L', unrealised],
        ['Combined P&L', unrealised == null ? null : money(realised + unrealised)],
        ['Open position cost', invested], ['Open position value', currentValue],
        ['Valuation status', !complete ? 'Incomplete - some quotes unavailable; totals left blank' : holdings.some(p => p.status.startsWith('Delayed')) ? 'Includes delayed quotes' : 'Complete'], [],
        ['Completed sales'], ['Sold at (UTC)', 'Symbol', 'Quantity', 'Execution price (INR)', 'Cost basis (INR)', 'Proceeds (INR)', 'Realised P&L (INR)'],
        ...performance.sales.map(s => [s.closedAt, s.symbol, s.quantity, s.price, s.costBasis, s.proceeds, s.pnl]), [],
        ['Open positions'], ['Symbol', 'Quantity', 'Cost (INR)', 'Quote price (INR)', 'Current value (INR)', 'Unrealised P&L (INR)', 'Quote time (UTC)', 'Quote status'],
        ...holdings.map(p => [p.symbol, p.quantity, p.invested, p.price, p.currentValue, p.pnl, p.quoteAt, p.status]),
    ];
    return { csv: '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n'),
        summary: { realised, unrealised, invested, currentValue, complete }, holdings, sales: performance.sales,
        generatedAt: new Date(now ?? Date.now()).toISOString() };
}
module.exports = { buildPnlReport, csvCell };
