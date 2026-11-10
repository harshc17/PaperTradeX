'use client';
import XirrValue from '@/components/XirrValue';
import CompanyLogo from '@/components/CompanyLogo';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import Header from '@/components/dashboard/Header';
import { TrendingUp, TrendingDown, Package, Search, Clock, ArrowUpRight, ExternalLink, Wallet, PieChart, RefreshCw, Filter } from 'lucide-react';

export default function HoldingsPage() {
    const { user, balance, loading: authLoading } = useAuth();
    const {
        portfolioXirr,
        holdings,
        orders,
        totalInvested,
        currentValue,
        totalReturns,
        totalReturnsPercent,
        todayReturns,
        todayReturnsPercent,
        todayReturnsReady,
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

            <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Title & Refresh */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h1 className="text-[28px] font-medium text-ink-heading font-heading">
                                Holdings
                            </h1>
                            <span className="whitespace-nowrap text-xs font-medium px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                                {holdings.length} Positions
                            </span>
                        </div>
                        <p className="text-xs text-ink-faint">
                            Track your virtual holdings, returns and allocation
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={handleManualRefresh}
                            disabled={isRefreshing}
                            className="inline-flex min-h-11 items-center whitespace-nowrap gap-1.5 px-3 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-line text-xs font-medium text-ink-muted hover:text-ink transition-colors active:scale-[0.98]"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
                            Refresh prices
                        </button>
                        <Link
                            href="/dashboard"
                            className="inline-flex min-h-11 items-center whitespace-nowrap gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-primary text-[var(--primary-ink)] hover:brightness-110 transition-colors shadow-none"
                        >

                            Discover Stocks
                        </Link>
                    </div>
                </div>

                {/* Open Orders Notification Banner */}
                {openOrders.length > 0 && (
                    <div className="mb-7 p-4 rounded-2xl bg-surface border border-primary/30 flex items-center justify-between shadow-none">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
                                <Clock className="w-4 h-4 animate-pulse" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-ink-heading">
                                    {openOrders.length} Pending Limit Order{openOrders.length > 1 ? 's' : ''}
                                </p>
                                <p className="text-xs text-ink-faint">
                                    Limit orders execute automatically once the target price is reached.
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/orders"
                            className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                        >
                            View Open Orders &rarr;
                        </Link>
                    </div>
                )}

                {/* KPI Metrics Summary Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {/* Card 1: Current Portfolio Value */}
                    <div className="rounded-2xl p-5 bg-surface border border-line shadow-none relative overflow-hidden group">
                        <div className="flex items-center justify-between text-xs text-ink-faint mb-2">
                            <span className="font-semibold text-xs">Portfolio Value</span>
                            <PieChart className="w-4 h-4 text-primary" />
                        </div>
                        <h2 className="text-[28px] font-medium text-ink-heading tabular-nums font-num mb-2">
                            ₹{fmt(currentValue)}
                        </h2>
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                            <span className="text-ink-faint" title="Latest trading session profit/loss, using previous close for overnight shares and execution prices for today's trades. Includes today's sales; percentage is based on opening holdings value plus today's purchases.">1D return:</span>
                            <span className={`tabular-nums font-num font-semibold ${isTodayProfit ? 'text-up' : 'text-down'}`}>
                                {todayReturnsReady ? <>{isTodayProfit ? '+' : '-'}₹{fmt(Math.abs(todayReturns))} ({todayReturnsPercent < 0 ? '−' : ''}{Math.abs(todayReturnsPercent).toFixed(2)}%)</> : '—'}
                            </span>
                        </div>
                    </div>

                    <div className="rounded-2xl p-5 bg-surface border border-line min-w-0">
                        <div className="flex items-center justify-between text-xs text-ink-faint mb-2">
                            <span className="font-semibold">Total returns</span>
                            {isProfit ? <TrendingUp className="w-4 h-4 text-up" /> : <TrendingDown className="w-4 h-4 text-down" />}
                        </div>
                            <h2 className={`text-[28px] font-medium tabular-nums font-num mb-2 ${isProfit ? 'text-up' : 'text-down'}`}>{isProfit ? '+' : '-'}₹{fmt(Math.abs(totalReturns))}</h2>
                            <span className={`text-xs font-num ${isProfit ? 'text-up' : 'text-down'}`}>{isProfit ? '+' : '-'}{Math.abs(totalReturnsPercent).toFixed(2)}% Overall</span>
                            <div className="mt-3 border-t border-line pt-3"><p className="text-xs text-ink-faint mb-1">Portfolio XIRR</p><XirrValue result={portfolioXirr} /></div>
                    </div>

                    {/* Card 3: Invested Capital */}
                    <div className="rounded-2xl p-5 bg-surface border border-line shadow-none relative overflow-hidden group">
                        <div className="flex items-center justify-between text-xs text-ink-faint mb-2">
                            <span className="font-semibold text-xs">Total invested</span>
                            <Wallet className="w-4 h-4 text-ink-faint" />
                        </div>
                        <h2 className="text-[28px] font-medium text-ink-heading tabular-nums font-num mb-2">
                            ₹{fmt(totalInvested)}
                        </h2>
                        <p className="text-xs text-ink-faint">
                            Across {holdings.length} stock position{holdings.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    {/* Card 4: Available balance */}
                    <div className="rounded-2xl p-5 bg-surface border border-line shadow-none relative overflow-hidden group">
                        <div className="flex items-center justify-between text-xs text-ink-faint mb-2">
                            <span className="font-semibold text-xs">Available balance</span>
                            <span className="w-2 h-2 rounded-full bg-primary" />
                        </div>
                        <h2 className="text-[28px] font-medium text-primary tabular-nums font-num mb-2">
                            ₹{fmt(balance)}
                        </h2>
                        <p className="text-xs text-ink-faint">
                            Ready for immediate deployment
                        </p>
                    </div>
                </div>

                {/* Holdings Table Section */}
                {holdings.length === 0 ? (
                    <div className="rounded-2xl border border-line bg-surface p-12 text-center shadow-none">
                        <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Package className="w-8 h-8 text-primary" />
                        </div>
                        <h3 className="text-lg font-medium text-ink-heading mb-2">No Holdings Yet</h3>
                        <p className="text-ink-faint text-sm max-w-md mx-auto mb-6">
                            Start building your paper trading portfolio. Buy your first shares in top companies with zero risk.
                        </p>

                        <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-lg mx-auto">
                            {['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'SBIN'].map(sym => (
                                <Link
                                    key={sym}
                                    href={`/stock/${sym}`}
                                    className="px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-line text-xs font-semibold text-ink-muted hover:text-ink transition-colors flex items-center gap-1.5"
                                >
                                    <span>{sym}</span>
                                    <ArrowUpRight className="w-3 h-3 text-primary" />
                                </Link>
                            ))}
                        </div>

                        <Link
                            href="/dashboard"
                            className="inline-flex px-6 py-2.5 text-[var(--primary-ink)] rounded-xl font-medium text-sm transition-colors active:scale-[0.98] shadow-none"
                            style={{ background: 'var(--primary)', color: 'var(--primary-ink)' }}
                        >
                            Explore Stocks on Dashboard
                        </Link>
                    </div>
                ) : (
                    <div className="bg-surface rounded-2xl border border-line shadow-none overflow-hidden">
                        {/* Table Controls (Search & Tabs & View Mode) */}
                        <div className="p-4 sm:p-5 border-b border-line flex flex-col md:flex-row md:items-center justify-between gap-4">
                            {/* Search */}
                            <div className="relative w-full sm:w-72">
                                <Search className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search your holdings..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full h-9 pl-9 pr-3 text-xs bg-surface-2 border border-line rounded-xl outline-none focus:border-primary text-ink transition-colors"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {/* Filter Pills */}
                                <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-xl border border-line">
                                    {(
                                        [
                                            { key: 'ALL', label: `All (${holdings.length})` },
                                            { key: 'PROFIT', label: 'Overall Profitable' },
                                            { key: 'LOSS', label: 'Overall In Loss' },
                                            { key: 'TODAY_PROFIT', label: '1D gainers' },
                                        ] as const
                                    ).map(t => (
                                        <button
                                            key={t.key}
                                            type="button"
                                            onClick={() => setFilterTab(t.key)}
                                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                                                filterTab === t.key
                                                    ? 'bg-primary text-[var(--primary-ink)] shadow-none'
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
                        <p className="px-4 pt-3 text-xs text-ink-faint lg:hidden">Swipe to view all columns</p>
                        <div className="overflow-x-auto overscroll-x-contain" role="region" aria-label="Holdings and stock returns" tabIndex={0}>
                            <table className="w-full min-w-[960px] text-left [&_td]:whitespace-nowrap">
                                <thead>
                                    <tr className="bg-surface-2/60 text-xs font-medium text-ink-faint border-b border-line">
                                        <th className="px-5 py-3.5">Asset / Company</th>
                                        <th className="px-5 py-3.5 text-right">Quantity</th>
                                        <th className="px-5 py-3.5 text-right">Average price</th>
                                        <th className="px-5 py-3.5 text-right">Current value</th>
                                        <th className="px-5 py-3.5 text-right" title="Session profit/loss using previous close for overnight shares and execution prices for today's trades, including sales">1D return</th>
                                        <th className="px-5 py-3.5 text-right">Total returns</th>
                                        <th className="px-5 py-3.5 text-center">Action</th>
                                        <th className="min-w-[136px] px-5 py-3.5 text-right whitespace-nowrap">XIRR <span className="block text-xs font-normal">Annualised</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
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
                                                        <CompanyLogo symbol={h.symbol} />
                                                        <div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-sm font-medium text-ink-heading">
                                                                    {cleanSymbol}
                                                                </span>
                                                                <span className="text-xs font-semibold text-ink-faint px-1.5 py-0.2 rounded bg-surface-2">
                                                                    NSE
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-xs text-ink-faint font-num">
                                                                    Alloc: {holdingWeight.toFixed(1)}%
                                                                </span>
                                                                <div className="w-12 h-1 bg-surface-2 rounded-full overflow-hidden">
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
                                                <td className="px-5 py-4 text-right text-sm font-medium text-ink-heading tabular-nums font-num">
                                                    ₹{fmt(h.currentValue ?? 0)}
                                                </td>

                                                {/* Today's Gain Column */}
                                                <td className="px-5 py-4 text-right">
                                                    <p className={`text-sm font-medium tabular-nums font-num ${isDayUp ? 'text-up' : 'text-down'}`}>
                                                        {h.dayPnlReady ? <>{isDayUp ? '+' : '-'}₹{fmt(Math.abs(h.dayPnl ?? 0))}</> : '—'}
                                                    </p>
                                                    <span className={`inline-block text-xs font-semibold tabular-nums font-num mt-0.5 ${isDayUp ? 'text-up' : 'text-down'}`}>
                                                        {h.dayPnlReady ? <>{isDayUp ? '+' : '-'}{Math.abs(h.dayPnlPercent ?? 0).toFixed(2)}%</> : '—'}
                                                    </span>
                                                </td>

                                                {/* Total returns (Unrealized P&L Column) */}
                                                <td className="px-5 py-4 text-right">
                                                    <p className={`text-sm font-medium tabular-nums font-num ${isUp ? 'text-up' : 'text-down'}`}>
                                                        {isUp ? '+' : '-'}₹{fmt(Math.abs(h.pnl ?? 0))}
                                                    </p>
                                                    <span className={`inline-block text-xs font-semibold tabular-nums font-num mt-0.5 ${isUp ? 'text-up' : 'text-down'}`}>
                                                        {isUp ? '+' : '-'}{Math.abs(h.pnlPercent ?? 0).toFixed(2)}%
                                                    </span>
                                                </td>

                                                {/* Quick Action */}
                                                <td className="px-5 py-4 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => router.push(`/stock/${encodeURIComponent(cleanSymbol)}`)}
                                                        className="px-3 py-1.5 text-xs font-medium rounded-xl bg-surface-2 hover:bg-primary hover:text-[var(--primary-ink)] border border-line transition-colors text-ink-muted active:scale-[0.98] inline-flex items-center gap-1"
                                                    >
                                                        <span>Trade</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                </td>
                                                <td className="px-5 py-4 text-right"><XirrValue result={h.xirr} /></td>
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
