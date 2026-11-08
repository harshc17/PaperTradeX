'use client';
import { useHoldings } from "@/context/HoldingsContext";

export default function InvestmentCard() {
    const { currentValue, totalReturns, totalReturnsPercent, totalInvested } = useHoldings();

    // Format helper
    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    return (
        <div className="bg-surface dark:bg-surface rounded-xl border border-line dark:border-line p-6 h-full flex flex-col justify-between">
            <h2 className="text-lg font-medium text-ink dark:text-ink mb-6">Your investments</h2>

            <div className="space-y-6">
                <div>
                    <p className="text-sm text-ink-muted dark:text-ink-faint mb-1">Current</p>
                    <p className="text-3xl font-semibold text-ink dark:text-white">₹{fmt(currentValue)}</p>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-ink-muted dark:text-ink-faint">Total returns</span>
                        <span className={`text-sm font-medium ${totalReturns >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {totalReturns >= 0 ? '+' : '-'}₹{fmt(Math.abs(totalReturns))} ({totalReturnsPercent >= 0 ? '+' : '-'}{fmt(Math.abs(totalReturnsPercent))}%)
                        </span>
                    </div>
                </div>

                <div className="pt-4 border-t border-dashed border-line dark:border-line flex items-center justify-between">
                    <span className="text-sm text-ink-muted dark:text-ink-faint">Invested</span>
                    <span className="text-lg font-medium text-ink dark:text-white">₹{fmt(totalInvested)}</span>
                </div>
            </div>
        </div>
    )
}
