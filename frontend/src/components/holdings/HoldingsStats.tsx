'use client';
import { useHoldings } from '@/context/HoldingsContext';

export default function HoldingsStats() {
    const { currentValue, totalReturns, totalReturnsPercent, dayReturns, totalInvested } = useHoldings();

    // Format helper
    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dayReturnsPercent = currentValue > 0 ? (dayReturns / currentValue) * 100 : 0;

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-3xl font-medium text-ink dark:text-ink mb-6">Your investments</h1>

            <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-lg p-8">
                <div className="space-y-6">
                    {/* Current */}
                    <div className="flex justify-between items-baseline">
                        <p className="text-ink-muted dark:text-ink-faint">Current</p>
                        <p className="text-3xl font-medium text-ink dark:text-ink">₹{fmt(currentValue)}</p>
                    </div>

                    {/* 1D Returns */}
                    <div className="flex justify-between items-center">
                        <p className="text-ink-muted dark:text-ink-faint">1D returns</p>
                        <p className={`text-lg font-semibold flex items-center gap-2 ${dayReturns >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {dayReturns >= 0 ? '+' : '-'}₹{fmt(Math.abs(dayReturns))}
                            <span className="text-sm">({dayReturnsPercent >= 0 ? '+' : '-'}{fmt(Math.abs(dayReturnsPercent))}%)</span>
                        </p>
                    </div>

                    {/* Total returns */}
                    <div className="flex justify-between items-center">
                        <p className="text-ink-muted dark:text-ink-faint">Total returns</p>
                        <p className={`text-lg font-semibold flex items-center gap-2 ${totalReturns >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {totalReturns >= 0 ? '+' : '-'}₹{fmt(Math.abs(totalReturns))}
                            <span className="text-sm">({totalReturnsPercent >= 0 ? '+' : '-'}{fmt(Math.abs(totalReturnsPercent))}%)</span>
                        </p>
                    </div>

                    {/* Invested */}
                    <div className="flex justify-between items-center pt-4 border-t border-line dark:border-line">
                        <p className="text-ink-muted dark:text-ink-faint">Invested</p>
                        <p className="text-lg font-semibold text-ink dark:text-ink">₹{fmt(totalInvested)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
