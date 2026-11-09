'use client';
import CompanyLogo from '@/components/CompanyLogo';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import Header from '@/components/dashboard/Header';
import { History, Search, ArrowUpRight, ArrowDownRight, RefreshCw, Download, ExternalLink, TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';

export default function TransactionsPage() {
    const { user, loading: authLoading } = useAuth();
    const { transactions, refreshTransactions } = usePortfolio();
    const router = useRouter();

    const [searchQuery, setSearchQuery] = useState('');
    const [sideFilter, setSideFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        } else if (user) {
            refreshTransactions();
        }
    }, [user, authLoading, refreshTransactions, router]);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        await refreshTransactions();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Filtered transaction list
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const matchesSearch = t.symbol.toLowerCase().includes(searchQuery.toLowerCase());
            if (!matchesSearch) return false;
            if (sideFilter === 'ALL') return true;
            return t.type === sideFilter;
        });
    }, [transactions, searchQuery, sideFilter]);

    // Financial calculations
    const totalBuyVolume = useMemo(() => {
        return transactions
            .filter(t => t.type === 'BUY')
            .reduce((sum, t) => sum + (t.totalAmount || t.price * t.quantity), 0);
    }, [transactions]);

    const totalSellVolume = useMemo(() => {
        return transactions
            .filter(t => t.type === 'SELL')
            .reduce((sum, t) => sum + (t.totalAmount || t.price * t.quantity), 0);
    }, [transactions]);

    const exportCSV = () => {
        if (transactions.length === 0) return;
        const headers = ['Transaction ID', 'Time', 'Type', 'Symbol', 'Quantity', 'Price (INR)', 'Total Amount (INR)'];
        const rows = transactions.map(t => [
            t.id,
            new Date(t.createdAt).toISOString(),
            t.type,
            t.symbol,
            t.quantity,
            t.price,
            t.totalAmount,
        ]);
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `papertradex_transactions_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-transparent font-sans page-fade-in pb-16">
            <Header />

            <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Title & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h1 className="text-[28px] font-medium text-ink-heading font-heading">
                                Transactions
                            </h1>
                            <span className="whitespace-nowrap text-xs font-medium px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                                {transactions.length} Records
                            </span>
                        </div>
                        <p className="text-xs text-ink-faint">
                            Complete historical ledger of all your executed paper trades and capital flows.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={handleManualRefresh}
                            disabled={isRefreshing}
                            className="inline-flex min-h-11 items-center whitespace-nowrap gap-1.5 px-3 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-line text-xs font-medium text-ink-muted hover:text-ink transition-colors active:scale-[0.98]"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
                            Refresh trades
                        </button>
                        {transactions.length > 0 && (
                            <button
                                onClick={exportCSV}
                                className="inline-flex min-h-11 items-center whitespace-nowrap gap-1.5 px-3.5 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-line text-xs font-medium text-ink-heading transition-colors active:scale-[0.98] shadow-none"
                            >
                                <Download className="w-3.5 h-3.5 text-primary" />
                                Export CSV
                            </button>
                        )}
                        <Link
                            href="/holdings"
                            className="inline-flex min-h-11 items-center whitespace-nowrap gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-primary text-[var(--primary-ink)] hover:brightness-110 transition-colors shadow-none"
                        >
                            <Zap className="w-3.5 h-3.5" />
                            View Holdings
                        </Link>
                    </div>
                </div>

                {/* Ledger Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    {/* Total Transactions */}
                    <div className="rounded-2xl p-5 bg-surface border border-line shadow-none">
                        <div className="flex items-center justify-between text-xs text-ink-faint mb-2">
                            <span className="font-semibold text-xs">Total Executions</span>
                            <Activity className="w-4 h-4 text-primary" />
                        </div>
                        <h2 className="text-[28px] font-medium text-ink-heading tabular-nums font-num">
                            {transactions.length}
                        </h2>
                        <p className="text-xs text-ink-faint mt-1">Lifetime simulated orders</p>
                    </div>

                    {/* Total buy volume */}
                    <div className="rounded-2xl p-5 bg-surface border border-line shadow-none">
                        <div className="flex items-center justify-between text-xs text-ink-faint mb-2">
                            <span className="font-semibold text-xs">Total buy volume</span>
                            <TrendingUp className="w-4 h-4 text-up" />
                        </div>
                        <h2 className="text-[28px] font-medium text-up tabular-nums font-num">
                            ₹{fmt(totalBuyVolume)}
                        </h2>
                        <p className="text-xs text-ink-faint mt-1">Capital invested in equities</p>
                    </div>

                    {/* Total Sell Volume */}
                    <div className="rounded-2xl p-5 bg-surface border border-line shadow-none">
                        <div className="flex items-center justify-between text-xs text-ink-faint mb-2">
                            <span className="font-semibold text-xs">Total sell realised</span>
                            <TrendingDown className="w-4 h-4 text-down" />
                        </div>
                        <h2 className="text-[28px] font-medium text-ink-heading tabular-nums font-num">
                            ₹{fmt(totalSellVolume)}
                        </h2>
                        <p className="text-xs text-ink-faint mt-1">Liquidated proceeds</p>
                    </div>
                </div>

                {/* Ledger Table Section */}
                {transactions.length === 0 ? (
                    <div className="rounded-2xl border border-line bg-surface p-14 text-center shadow-none">
                        <div className="w-16 h-16 bg-surface-2 border border-line rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <History className="w-8 h-8 text-ink-faint" />
                        </div>
                        <h3 className="text-base font-medium text-ink-heading mb-2">No Transactions Yet</h3>
                        <p className="text-ink-faint text-sm max-w-sm mx-auto mb-6">
                            Every time a buy or sell trade is filled, a permanent immutable record is saved to your ledger.
                        </p>
                        <Link
                            href="/dashboard"
                            className="inline-flex px-6 py-2.5 text-[var(--primary-ink)] rounded-xl font-medium text-sm transition-colors shadow-none"
                            style={{ background: 'var(--primary)', color: 'var(--primary-ink)' }}
                        >
                            Make Your First Trade
                        </Link>
                    </div>
                ) : (
                    <div className="bg-surface rounded-2xl border border-line shadow-none overflow-hidden">
                        {/* Filter Toolbar */}
                        <div className="p-4 sm:p-5 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            {/* Search */}
                            <div className="relative w-full sm:w-72">
                                <Search className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search by symbol..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full h-9 pl-9 pr-3 text-xs bg-surface-2 border border-line rounded-xl outline-none focus:border-primary text-ink transition-colors"
                                />
                            </div>

                            {/* Side Filter Tabs */}
                            <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-xl border border-line">
                                {(
                                    [
                                        { key: 'ALL', label: `All (${transactions.length})` },
                                        { key: 'BUY', label: `BUY (${transactions.filter(t => t.type === 'BUY').length})` },
                                        { key: 'SELL', label: `SELL (${transactions.filter(t => t.type === 'SELL').length})` },
                                    ] as const
                                ).map(t => (
                                    <button
                                        key={t.key}
                                        type="button"
                                        onClick={() => setSideFilter(t.key)}
                                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                            sideFilter === t.key
                                                ? 'bg-primary text-[var(--primary-ink)] shadow-none'
                                                : 'text-ink-faint hover:text-ink'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto overscroll-x-contain">
                            <table className="w-full min-w-[700px] text-left">
                                <thead>
                                    <tr className="bg-surface-2/60 text-xs font-medium text-ink-faint border-b border-line">
                                        <th className="px-6 py-3.5">Date & Time</th>
                                        <th className="px-6 py-3.5">Type</th>
                                        <th className="px-6 py-3.5">Symbol</th>
                                        <th className="px-6 py-3.5 text-right">Shares</th>
                                        <th className="px-6 py-3.5 text-right">Execution Price</th>
                                        <th className="px-6 py-3.5 text-right">Total Value</th>
                                        <th className="px-6 py-3.5 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {filteredTransactions.map(txn => {
                                        const isBuy = txn.type === 'BUY';
                                        const date = new Date(txn.createdAt);
                                        const cleanSymbol = txn.symbol.replace(/\.(NS|BO)$/i, '');

                                        return (
                                            <tr
                                                key={txn.id}
                                                className="hover:bg-surface-2/40 transition-colors group"
                                            >
                                                {/* Date & Time */}
                                                <td className="px-6 py-4 text-xs font-num text-ink-muted">
                                                    <p className="font-semibold text-ink">
                                                        {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </p>
                                                    <p className="text-xs text-ink-faint">
                                                        {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </p>
                                                </td>

                                                {/* Type */}
                                                <td className="px-6 py-4">
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium   border ${
                                                            isBuy
                                                                ? 'bg-up/10 text-up border-up/20'
                                                                : 'bg-down/10 text-down border-down/20'
                                                        }`}
                                                    >
                                                        {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                        {txn.type}
                                                    </span>
                                                </td>

                                                {/* Symbol */}
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2.5">
                                                        <CompanyLogo symbol={cleanSymbol} className="h-8 w-8" />
                                                        <div>
                                                            <p className="text-sm font-medium text-ink-heading">
                                                                {cleanSymbol}
                                                            </p>
                                                            <p className="text-xs text-ink-faint font-mono">
                                                                ID: {txn.id.slice(-6)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Quantity */}
                                                <td className="px-6 py-4 text-right text-sm font-semibold text-ink-muted tabular-nums font-num">
                                                    {txn.quantity}
                                                </td>

                                                {/* Price */}
                                                <td className="px-6 py-4 text-right text-sm text-ink-muted tabular-nums font-num">
                                                    ₹{fmt(txn.price)}
                                                </td>

                                                {/* Total Value */}
                                                <td className="px-6 py-4 text-right text-sm font-medium text-ink-heading tabular-nums font-num">
                                                    ₹{fmt(txn.totalAmount || txn.price * txn.quantity)}
                                                </td>

                                                {/* Action */}
                                                <td className="px-6 py-4 text-center">
                                                    <Link
                                                        href={`/stock/${cleanSymbol}`}
                                                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-surface-2 hover:bg-primary hover:text-[var(--primary-ink)] border border-line transition-colors text-ink-muted inline-flex items-center gap-1"
                                                    >
                                                        <span>Trade</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </Link>
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
