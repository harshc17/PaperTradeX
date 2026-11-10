// Mirrors TradeEngine's weighted-average purchase cost, including partial sales.
// Only executed TransactionHistory records belong here; pending orders are excluded.
const round = (value, digits = 2) => Number(value.toFixed(digits));

function calculateTradePerformance(transactions) {
    const positions = new Map();
    const sales = [];
    let purchases = 0;
    for (const trade of transactions) {
        const symbol = String(trade.symbol || '').toUpperCase();
        const quantity = Number(trade.quantity), price = Number(trade.price), amount = Number(trade.totalAmount);
        const timestamp = new Date(trade.createdAt).getTime();
        if (!symbol || !Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0 || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(timestamp) || !['BUY', 'SELL'].includes(trade.type)) {
            throw new Error('Some trade records are incomplete. A reliable coach report cannot be calculated yet.');
        }
        const position = positions.get(symbol) || { quantity: 0, averagePrice: 0 };
        if (trade.type === 'BUY') {
            position.averagePrice = position.quantity ? round((position.quantity * position.averagePrice + amount) / (position.quantity + quantity), 4) : price;
            position.quantity += quantity;
            purchases++;
        } else {
            if (quantity > position.quantity) throw new Error('Trade history is missing purchases for a completed sale. A reliable coach report cannot be calculated yet.');
            const costBasis = position.averagePrice * quantity;
            sales.push({ symbol, quantity, price, proceeds: round(amount), costBasis: round(costBasis), pnl: round(amount - costBasis), closedAt: new Date(timestamp).toISOString() });
            position.quantity -= quantity;
            if (!position.quantity) position.averagePrice = 0;
        }
        positions.set(symbol, position);
    }
    const wins = sales.filter(s => s.pnl > 0), losses = sales.filter(s => s.pnl < 0);
    const sum = (items, field) => round(items.reduce((n, item) => n + item[field], 0));
    const grossProfit = sum(wins, 'pnl'), grossLoss = Math.abs(sum(losses, 'pnl'));
    const costBasis = sum(sales, 'costBasis');
    const symbolMap = new Map();
    for (const sale of sales) {
        const group = symbolMap.get(sale.symbol) || { symbol: sale.symbol, completedSales: 0, pnl: 0 };
        group.completedSales++;
        group.pnl = round(group.pnl + sale.pnl);
        symbolMap.set(sale.symbol, group);
    }
    return {
        metrics: {
            completedSales: sales.length, purchases, wins: wins.length, losses: losses.length,
            breakEven: sales.length - wins.length - losses.length,
            netRealisedPnl: sum(sales, 'pnl'), grossProfit, grossLoss,
            winRate: sales.length ? round(wins.length / sales.length * 100) : null,
            realisedReturnPercent: costBasis ? round(sum(sales, 'pnl') / costBasis * 100) : null,
            averageWin: wins.length ? round(grossProfit / wins.length) : null,
            averageLoss: losses.length ? round(grossLoss / losses.length) : null,
            profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss) : null,
            closedCostBasis: costBasis,
            firstTradeAt: transactions.length ? new Date(transactions[0].createdAt).toISOString() : null,
            latestTradeAt: transactions.length ? new Date(transactions[transactions.length - 1].createdAt).toISOString() : null,
        },
        bySymbol: [...symbolMap.values()].sort((a, b) => b.pnl - a.pnl),
        recentSales: sales.slice(-10).reverse(),
        methodology: 'Weighted-average purchase cost, matching portfolio accounting. Each sell execution counts as one completed sale, including partial sales. Win rate includes break-even sales. Open positions, cash balance and pending orders are excluded. Amounts reflect recorded paper trades; no additional fees are assumed.',
    };
}

module.exports = { calculateTradePerformance };
