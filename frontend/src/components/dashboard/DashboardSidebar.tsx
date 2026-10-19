'use client';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import { ChevronRight, BarChart3, Search, Bot, Trophy } from 'lucide-react';
import AIPortfolioAnalyst from './AIPortfolioAnalyst';

export default function DashboardSidebar() {
    const { balance } = useAuth();
    const { holdings, totalInvested, currentValue, totalReturns, totalReturnsPercent, todayReturns, todayReturnsPercent } = usePortfolio();

    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const isProfit = totalReturns >= 0;

    const tools = [
        { name: 'Ask AI', icon: <Bot className="w-4 h-4 text-[#c084fc]" />, href: '/ask-ai', badge: 'New' },
        { name: 'Stock Screener', icon: <Search className="w-4 h-4 text-[#60a5fa]" />, href: '/stock-screener' },
        { name: 'ETF Screener', icon: <BarChart3 className="w-4 h-4 text-[#a78bfa]" />, href: '/etf-screener' },
    ];

    return (
        <div className="space-y-5">
            {/* Portfolio Card */}
            <div className="bg-surface rounded-[14px] border border-white/10 p-6 shadow-soft">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-[15px] font-semibold text-ink-heading font-heading">Your Portfolio</h3>
                    <Link href="/holdings" className="text-[12px] text-primary hover:underline font-medium">View all →</Link>
                </div>

                <div className="mb-5">
                    <p className="text-[12px] text-ink-faint uppercase tracking-wider mb-1">Current Value</p>
                    <h2 className="text-[26px] font-bold text-ink-heading tracking-tight tabular-nums font-num">₹{fmt(currentValue)}</h2>
                </div>

                {holdings.length > 0 ? (
                    <div className="space-y-3 pt-4 border-t border-white/10">
                        {[
                            { label: '1D returns', val: todayReturns, pct: todayReturnsPercent },
                            { label: 'Total returns', val: totalReturns, pct: totalReturnsPercent },
                        ].map(({ label, val, pct }) => (
                            <div key={label} className="flex justify-between items-center">
                                <span className="text-[13px] text-ink-faint">{label}</span>
                                <span className={`text-[13px] font-semibold tabular-nums font-num ${val >= 0 ? 'text-up' : 'text-down'}`}>
                                    {val >= 0 ? '+' : '-'}₹{fmt(Math.abs(val))} ({Math.abs(pct).toFixed(2)}%)
                                </span>
                            </div>
                        ))}
                        <div className="flex justify-between items-center">
                            <span className="text-[13px] text-ink-faint">Invested</span>
                            <span className="text-[13px] font-semibold text-ink tabular-nums font-num">₹{fmt(totalInvested)}</span>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4 border-t border-white/10">
                        <p className="text-[13px] text-ink-faint mb-3">No holdings yet.</p>
                        <Link href="/dashboard" className="text-[13px] font-semibold text-primary hover:underline">Start investing →</Link>
                    </div>
                )}
            </div>

            {/* Products & Tools */}
            <div className="bg-surface rounded-[14px] border border-white/10 p-5 shadow-soft">
                <h3 className="text-[15px] font-semibold text-ink-heading mb-4 font-heading">Products & Tools</h3>
                <div className="space-y-1">
                    {tools.map(tool => (
                        <Link key={tool.name} href={tool.href}
                            className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-surface-3 transition-colors group cursor-pointer">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-surface-3 border border-white/10 group-hover:border-white/20 flex items-center justify-center transition-all group-hover:scale-105">
                                    {tool.icon}
                                </div>
                                <span className="text-[13px] font-medium text-ink-muted group-hover:text-ink transition-colors">{tool.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {tool.badge && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-[#c084fc]/15 text-[10px] font-bold text-[#c084fc] uppercase border border-[#c084fc]/20">{tool.badge}</span>
                                )}
                                <ChevronRight className="w-4 h-4 text-ink-faint group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Weekly Challenge */}
            <Link href="/challenge" className="block group">
                <div className="rounded-[14px] p-6 relative overflow-hidden transition-transform group-hover:-translate-y-1"
                    style={{ background: 'linear-gradient(135deg, #1a1040 0%, #2d1b69 50%, #1e1050 100%)', border: '1px solid rgba(139,92,246,0.25)' }}>
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[30px] -mr-10 -mt-10 pointer-events-none"
                        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)' }} />
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Trophy className="w-4 h-4 text-[#a78bfa]" />
                                <h3 className="text-[15px] font-bold text-white font-heading">Weekly Challenge</h3>
                            </div>
                            <p className="text-[12px] text-[#a78bfa]/80">Compete & test your strategy!</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-white/20 transition-colors">
                            <ChevronRight className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </Link>

            {/* AI Portfolio Analyst */}
            <AIPortfolioAnalyst />
        </div>
    );
}
