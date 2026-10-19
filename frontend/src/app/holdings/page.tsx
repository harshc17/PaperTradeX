'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import Header from '@/components/dashboard/Header';
import {
    TrendingUp,
    TrendingDown,
    Package,
    Search,
    Clock,
    ArrowUpRight,
    ArrowDownRight,
    ExternalLink,
    Wallet,
    PieChart,
    Sparkles,
    RefreshCw,
    Filter,
    ArrowUpDown,
    Activity
} from 'lucide-react';

export default function HoldingsPage() {
    const { user, balance, loading: authLoading } = useAuth();
    const {
        holdings,
        orders,
        totalInvested,
        currentValue,
        totalReturns,
        totalReturnsPercent,
        todayReturns,
        todayReturnsPercent,
        refreshPortfolio,
        refreshOrders,
    } = usePortfolio();
    const router = useRouter();

    const [searchQuery, setSearchQuery] = useState('');
    const [filterTab, setFilterTab] = useState<'ALL' | 'PROFIT' | 'LOSS' | 'TODAY_PROFIT'>('ALL');
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        } else if (user) {
            refreshPortfolio();
            refreshOrders();
        }
    }, [user, authLoading, refreshPortfolio, refreshOrders, router]);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        await Promise.all([refreshPortfolio(), refreshOrders()]);
        setTimeout(() => setIsRefreshing(false), 600);
    };

    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const isProfit = totalReturns >= 0;
    const isTodayProfit = todayReturns >= 0;

    // Filter pending limit orders
    const openOrders = useMemo(() => {
        return orders.filter(o => o.status === 'OPEN');
    }, [orders]);

    // Filter holdings based on search and tab
    const filteredHoldings = useMemo(() => {
        return holdings.filter(h => {
            const matchesSearch =
                h.symbol.toLowerCase().includes(searchQuery.toLowerCase());
            if (!matchesSearch) return false;

            if (filterTab === 'PROFIT') return (h.pnl ?? 0) > 0;
            if (filterTab === 'LOSS') return (h.pnl ?? 0) < 0;
            if (filterTab === 'TODAY_PROFIT') return (h.dayPnl ?? 0) > 0;
            return true;
        });
    }, [holdings, searchQuery, filterTab]);

    return (
        <div className="min-h-screen bg-transparent font-sans page-fade-in pb-16">
            <Header />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Title & Refresh */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-[26px] font-bold text-ink-heading tracking-tight font-heading">
                                Portfolio & Holdings
                            </h1>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                {holdings.length} Positions
                            </span>
                        </div>
                        <p className="text-xs text-ink-faint">
                            Real-time tracking of your paper assets, performance, and allocations.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleManualRefresh}
                            disabled={isRefreshing}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-white/10 text-xs font-medium text-ink-muted hover:text-ink transition-all active:scale-95"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
                            Sync Live Prices
                        </button>
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-[#003829] hover:brightness-110 transition-all shadow-[0_0_15px_rgba(51,201,221,0.25)]"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            Discover Stocks
                        </Link>
                    </div>
                </div>

                {/* Open Orders Notification Banner */}
                {openOrders.length > 0 && (
                    <div className="mb-7 p-4 rounded-2xl bg-gradient-to-r from-[#172236] to-[#121b2b] border border-primary/30 flex items-center justify-between shadow-soft">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
                                <Clock className="w-4 h-4 animate-pulse" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-ink-heading">
                                    {openOrders.length} Pending Limit Order{openOrders.length > 1 ? 's' : ''}
                                </p>
                                <p className="text-[11px] text-ink-faint">
                                    Limit orders execute automatically once the target price is reached.
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/orders"
                            className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                        >
                            View Open Orders &rarr;
                        </Link>
                    </div>
                )}

                {/* KPI Metrics Summary Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {/* Card 1: Current Portfolio Value */}
                    <div className="rounded-2xl p-5 bg-surface border border-white/10 shadow-soft relative overflow-hidden group">
                        <div className="flex items-center justify-between text-xs text-ink-faint mb-2">
                            <span className="uppercase tracking-wider font-semibold text-[11px]">Portfolio Value</span>
                            <PieChart className="w-4 h-4 text-primary/70" />
                        </div>
                        <h2 className="text-[26px] font-bold text-ink-heading tabular-nums font-num mb-2">
                            ₹{fmt(currentValue)}
                        </h2>
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                            <span className="text-ink-faint">Day&apos;s Gain:</span>
                            <span className={`tabular-nums font-num font-semibold ${isTodayProfit ? 'text-up' : 'text-down'}`}>
                                {isTodayProfit ? '+' : '-'}₹{fmt(Math.abs(todayReturns))} ({Math.abs(todayReturnsPercent).toFixed(2)}%)
                            </span>
                        </div>
                    </div>

                    {/* Card 2: Total Returns */}
                    <div className="rounded-2xl p-5 bg-surface border border-white/10 shadow-soft relative overflow-hidden group">
                        <div className="flex items-center justify-between text-xs text-ink-faint mb-2">
                            <span className="uppercase tracking-wider font-semibold text-[11px]">Total Returns</span>
                            {isProfit ? <TrendingUp className="w-4 h-4 text-up" /> : <TrendingDown className="w-4 h-4 text-down" />}
                        </div>
                        <div className="flex items-baseline gap-2 mb-2">
                            <h2 className={`text-[26px] font-bold tabular-nums font-num ${isProfit ? 'text-up' : 'text-down'}`}>
                                {isProfit ? '+' : '-'}₹{fmt(Math.abs(totalReturns))}
                            </h2>
                        </div>
                        <div className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg bg-surface-2 border border-white/10">
                            <span className={`tabular-nums font-num ${isProfit ? 'text-up' : 'text-down'}`}>
                                {isProfit ? '+' : '-'}{Math.abs(totalReturnsPercent).toFixed(2)}% Overall
                            </span>
                        </div>
                    </div>

                    {/* Card 3: Invested Capital */}
                    <div className="rounded-2xl p-5 bg-surface border border-white/10 shadow-soft relative overflow-hidden group">
                        <div className="flex items-center justify-between text-xs text-ink-faint mb-2">
                            <span className="uppercase tracking-wider font-semibold text-[11px]">Total Invested</span>
                            <Wallet className="w-4 h-4 text-ink-faint" />
                        </div>
                        <h2 className="text-[26px] font-bold text-ink-heading tabular-nums font-num mb-2">
                            ₹{fmt(totalInvested)}
                        </h2>
                        <p className="text-xs text-ink-faint">
                            Across {holdings.length} stock position{holdings.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    {/* Card 4: Available Balance */}
                    <div className="rounded-2xl p-5 bg-surface border border-white/10 shadow-soft relative overflow-hidden group">
                        <div className="flex items-center justify-between text-xs text-ink-faint mb-2">
                            <span className="uppercase tracking-wider font-semibold text-[11px]">Available Balance</span>
                            <span className="w-2 h-2 rounded-full bg-primary" />
                        </div>
                        <h2 className="text-[26px] font-bold text-primary tabular-nums font-num mb-2">
                            ₹{fmt(balance)}
                        </h2>
                        <p className="text-xs text-ink-faint">
                            Ready for immediate deployment
                        </p>
                    </div>
                </div>

                {/* Holdings Table Section */}
                {holdings.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-surface p-12 text-center shadow-soft">
                        <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Package className="w-8 h-8 text-primary/70" />
                        </div>
                        <h3 className="text-lg font-bold text-ink-heading mb-2">No Holdings Yet</h3>
                        <p className="text-ink-faint text-sm max-w-md mx-auto mb-6">
                            Start building your paper trading portfolio. Buy your first shares in top companies with zero risk.
                        </p>

                        <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-lg mx-auto">
                            {['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'SBIN'].map(sym => (
                                <Link
                                    key={sym}
                                    href={`/stock/${sym}`}
                                    className="px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-white/10 text-xs font-semibold text-ink-muted hover:text-ink transition-colors flex items-center gap-1.5"
                                >
                                    <span>{sym}</span>
                                    <ArrowUpRight className="w-3 h-3 text-primary" />
                                </Link>
                            ))}
                        </div>

                        <Link
                            href="/dashboard"
                            className="inline-flex px-6 py-2.5 text-[#003829] rounded-xl font-bold text-sm transition-all active:scale-95 shadow-[0_0_20px_rgba(51,201,221,0.3)]"
                            style={{ background: 'linear-gradient(135deg, #33c9dd, #22a9bc)' }}
                        >
                            Explore Stocks on Dashboard
                        </Link>
                    </div>
                ) : (
                    <div className="bg-surface rounded-2xl border border-white/10 shadow-soft overflow-hidden">
                        {/* Table Controls (Search & Tabs & View Mode) */}
                        <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            {/* Search */}
                            <div className="relative w-full sm:w-72">
                                <Search className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search your holdings..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full h-9 pl-9 pr-3 text-xs bg-surface-2 border border-white/10 rounded-xl outline-none focus:border-primary text-ink transition-colors"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {/* Filter Pills */}
                                <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-xl border border-white/10">
                                    {(
                                        [
                                            { key: 'ALL', label: `All (${holdings.length})` },
                                            { key: 'PROFIT', label: 'Overall Profitable' },
                                            { key: 'LOSS', label: 'Overall In Loss' },
                                            { key: 'TODAY_PROFIT', label: "Today's Gainers" },
                                        ] as const
                                    ).map(t => (
                                        <button
                                            key={t.key}
                                            type="button"
                                            onClick={() => setFilterTab(t.key)}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                filterTab === t.key
                                                    ? 'bg-primary text-[#003829] shadow-sm'
                                                    : 'text-ink-faint hover:text-ink'
                                            }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Holdings Data Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-surface-2/60 text-[10px] font-bold text-ink-faint uppercase tracking-wider border-b border-white/10">
                                        <th className="px-5 py-3.5">Asset / Company</th>
                                        <th className="px-5 py-3.5 text-right">Quantity</th>
                                        <th className="px-5 py-3.5 text-right">Avg. Price</th>
                                        <th className="px-5 py-3.5 text-right">Current Value</th>
                                        <th className="px-5 py-3.5 text-right">Today&apos;s Gain</th>
                                        <th className="px-5 py-3.5 text-right">Total Returns</th>
                                        <th className="px-5 py-3.5 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.06]">
                                    {filteredHoldings.map(h => {
                                        const isUp = (h.pnl ?? 0) >= 0;
                                        const isDayUp = (h.dayPnl ?? 0) >= 0;
                                        const cleanSymbol = h.symbol.replace(/\.(NS|BO)$/i, '');
                                        const holdingWeight = currentValue > 0 && h.currentValue
                                            ? (h.currentValue / currentValue) * 100
                                            : 0;

                                        return (
                                            <tr
                                                key={h.symbol}
                                                className="hover:bg-surface-2/40 transition-colors group"
                                            >
                                                {/* Asset / Company */}
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1a2538] to-[#121a28] border border-white/10 flex items-center justify-center text-xs font-black text-primary tracking-wider shadow-inner group-hover:scale-105 transition-transform">
                                                            {cleanSymbol.slice(0, 2)}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-sm font-bold text-ink-heading">
                                                                    {cleanSymbol}
                                                                </span>
                                                                <span className="text-[10px] font-semibold text-ink-faint px-1.5 py-0.2 rounded bg-white/5">
                                                                    NSE
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[11px] text-ink-faint font-num">
                                                                    Alloc: {holdingWeight.toFixed(1)}%
                                                                </span>
                                                                <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-primary rounded-full"
                                                                        style={{ width: `${Math.min(100, holdingWeight)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Quantity */}
                                                <td className="px-5 py-4 text-right text-sm font-semibold text-ink-muted tabular-nums font-num">
                                                    {h.quantity}
                                                </td>

                                                {/* Average Price */}
                                                <td className="px-5 py-4 text-right text-sm text-ink-muted tabular-nums font-num">
                                                    ₹{fmt(h.averagePrice)}
                                                </td>

                                                {/* Current Total Value */}
                                                <td className="px-5 py-4 text-right text-sm font-bold text-ink-heading tabular-nums font-num">
                                                    ₹{fmt(h.currentValue ?? 0)}
                                                </td>

                                                {/* Today's Gain Column */}
                                                <td className="px-5 py-4 text-right">
                                                    <p className={`text-sm font-bold tabular-nums font-num ${isDayUp ? 'text-up' : 'text-down'}`}>
                                                        {isDayUp ? '+' : '-'}₹{fmt(Math.abs(h.dayPnl ?? 0))}
                                                    </p>
                                                    <span className={`inline-block text-[11px] font-semibold tabular-nums font-num mt-0.5 ${isDayUp ? 'text-up' : 'text-down'}`}>
                                                        {isDayUp ? '+' : '-'}{Math.abs(h.dayPnlPercent ?? 0).toFixed(2)}%
                                                    </span>
                                                </td>

                                                {/* Total Returns (Unrealized P&L Column) */}
                                                <td className="px-5 py-4 text-right">
                                                    <p className={`text-sm font-bold tabular-nums font-num ${isUp ? 'text-up' : 'text-down'}`}>
                                                        {isUp ? '+' : '-'}₹{fmt(Math.abs(h.pnl ?? 0))}
                                                    </p>
                                                    <span className={`inline-block text-[11px] font-semibold tabular-nums font-num mt-0.5 ${isUp ? 'text-up' : 'text-down'}`}>
                                                        {isUp ? '+' : '-'}{Math.abs(h.pnlPercent ?? 0).toFixed(2)}%
                                                    </span>
                                                </td>

                                                {/* Quick Action */}
                                                <td className="px-5 py-4 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => router.push(`/stock/${encodeURIComponent(cleanSymbol)}`)}
                                                        className="px-3 py-1.5 text-xs font-bold rounded-xl bg-surface-2 hover:bg-primary hover:text-[#003829] border border-white/10 transition-all text-ink-muted active:scale-95 inline-flex items-center gap-1"
                                                    >
                                                        <span>Trade</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
