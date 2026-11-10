// Weighted-average recorded purchase cost, with a paise cost pool so partial
// sales cannot lose fractional cost through independent per-sale rounding.
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
        const amountPaise = Math.round(amount * 100);
        if (!symbol || !Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0 || !Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(amountPaise) || !trade.createdAt || !Number.isFinite(timestamp) || !['BUY', 'SELL'].includes(trade.type)) {
            throw new Error('Some trade records are incomplete. A reliable coach report cannot be calculated yet.');
        }
        const position = positions.get(symbol) || { quantity: 0, costPaise: 0 };
        if (trade.type === 'BUY') {
            position.costPaise += amountPaise;
            position.quantity += quantity;
            purchases++;
        } else {
            if (quantity > position.quantity) throw new Error('Trade history is missing purchases for a completed sale. A reliable coach report cannot be calculated yet.');
            const soldCostPaise = quantity === position.quantity ? position.costPaise : Math.round(position.costPaise * (quantity / position.quantity));
            sales.push({ symbol, quantity, price, proceeds: amountPaise / 100, costBasis: soldCostPaise / 100, pnl: (amountPaise - soldCostPaise) / 100, closedAt: new Date(timestamp).toISOString() });
            position.costPaise -= soldCostPaise;
            position.quantity -= quantity;
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
        methodology: 'Weighted-average purchase cost using recorded trade amounts. Cost allocated to a partial sale is rounded to paise; the remaining cost stays with the unsold shares. A full exit uses the exact remaining cost. Each sell execution counts as one completed sale. Win rate includes break-even sales. Open positions, cash balance and pending orders are excluded. No additional fees are assumed.',
    };
}

module.exports = { calculateTradePerformance };
