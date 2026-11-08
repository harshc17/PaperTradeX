'use client';
import Link from 'next/link';
import { usePortfolio } from '@/context/PortfolioContext';
import { useAuth } from '@/context/AuthContext';
export default function PortfolioSummary() {
 const {balance}=useAuth();
 const {holdings,totalInvested,currentValue,totalReturns,totalReturnsPercent,todayReturns,todayReturnsPercent}=usePortfolio();
 const fmt=(n:number)=>n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
 return (<div className="bg-surface rounded-2xl border border-line p-4 sm:p-6 shadow-none">
                <div className="flex items-center justify-between mb-3 sm:mb-5">
                    <h3 className="text-base font-semibold text-ink-heading font-heading">Your portfolio</h3>
                    <Link href="/holdings" className="text-[12px] text-primary hover:underline font-medium">View all →</Link>
                </div>

                <div className="mb-3 sm:mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div><p className="text-[12px] text-ink-faint mb-1">Current value</p>
                    <h2 className="text-[28px] font-medium text-ink-heading tabular-nums font-num">₹{fmt(currentValue)}</h2></div>
                    <div className="lg:hidden text-right"><p className="text-xs text-ink-faint mb-1">Available cash</p><p className="text-lg text-primary font-semibold font-num">₹{fmt(balance)}</p></div>
                </div>

                {holdings.length > 0 ? (
                    <div className="space-y-3 pt-4 border-t border-line">
                        {[
                            { label: 'Market move (1D)', val: todayReturns, pct: todayReturnsPercent },
                            { label: 'Total returns', val: totalReturns, pct: totalReturnsPercent },
                        ].map(({ label, val, pct }) => (
                            <div key={label} className="flex flex-wrap gap-2 justify-between items-center">
                                <span className="text-sm text-ink-faint">{label}</span>
                                <span className={`text-sm font-semibold tabular-nums font-num ${val >= 0 ? 'text-up' : 'text-down'}`}>
                                    {val >= 0 ? '+' : '-'}₹{fmt(Math.abs(val))} ({Math.abs(pct).toFixed(2)}%)
                                </span>
                            </div>
                        ))}
                        <div className="flex flex-wrap gap-2 justify-between items-center">
                            <span className="text-sm text-ink-faint">Invested</span>
                            <span className="text-sm font-semibold text-ink tabular-nums font-num">₹{fmt(totalInvested)}</span>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-2 sm:py-4 border-t border-line">
                        <p className="text-sm text-ink-faint mb-3">No holdings yet</p>
                        <Link href="/dashboard" className="text-sm font-semibold text-primary hover:underline">Explore stocks →</Link>
                    </div>
                )}
            </div>);
}
