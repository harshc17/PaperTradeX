'use client';
import { useHoldings } from '@/context/HoldingsContext';

export default function HoldingsList() {
    const { holdings } = useHoldings();

    if (holdings.length === 0) {
        return (
            <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-surface-2 dark:bg-surface-2 rounded-full flex items-center justify-center mb-4">
                    <span className="text-sm text-ink-muted">NSE / BSE</span>
                </div>
                <h3 className="text-lg font-medium text-ink dark:text-ink mb-2">No holdings yet</h3>
                <p className="text-ink-muted dark:text-ink-faint max-w-sm">
                    Start building your portfolio by exploring and buying stocks from the dashboard.
                </p>
            </div>
        );
    }

    return (
        <div className="py-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-ink dark:text-ink">Stocks ({holdings.length})</h2>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Search holdings..."
                        className="text-sm border border-line dark:border-line rounded-lg px-3 py-2 bg-transparent focus:outline-none focus:border-blue-500 w-64"
                    />
                </div>
            </div>

            <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-surface-2 dark:bg-surface-2/50 border-b border-line dark:border-line text-xs font-medium text-ink-muted dark:text-ink-faint">
                            <th className="px-6 py-4 font-medium">Company</th>
                            <th className="px-6 py-4 font-medium text-right">Qty.</th>
                            <th className="px-6 py-4 font-medium text-right">Average price</th>
                            <th className="px-6 py-4 font-medium text-right">LTP</th>
                            <th className="px-6 py-4 font-medium text-right">Cur. Value</th>
                            <th className="px-6 py-4 font-medium text-right">P&L</th>
                            <th className="px-6 py-4 font-medium text-right">Net Chg.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {holdings.map((stock) => {
                            const currentValue = stock.qty * stock.ltp;
                            const investedValue = stock.qty * stock.avg;
                            const pnl = currentValue - investedValue;
                            const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;
                            const isProfit = pnl >= 0;

                            return (
                                <tr key={stock.symbol} className="hover:bg-surface-2 dark:hover:bg-surface-2/30 transition-colors cursor-pointer">
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-ink dark:text-ink">{stock.name}</div>
                                        <div className="text-xs text-ink-faint">{stock.symbol}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm text-ink-muted dark:text-ink-muted">{stock.qty}</td>
                                    <td className="px-6 py-4 text-right text-sm text-ink-muted dark:text-ink-muted">₹{stock.avg.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="text-sm font-medium text-ink dark:text-ink">₹{stock.ltp.toFixed(2)}</div>
                                        <div className={`text-xs mt-0.5 ${stock.dayChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {stock.dayChange > 0 ? '+' : ''}{stock.dayChange}%
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium text-ink dark:text-ink">
                                        ₹{currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium">
                                        <div className={`${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                                            {isProfit ? '+' : ''}₹{Math.abs(pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className={`text-xs mt-0.5 ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                                            ({pnlPercent.toFixed(2)}%)
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className={`text-xs font-semibold ${isProfit ? 'text-green-600' : 'text-red-600'} bg-surface-2 dark:bg-surface-2 py-1 px-2 rounded inline-block`}>
                                            {isProfit ? 'PROFIT' : 'LOSS'}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
