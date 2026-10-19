'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import Header from '@/components/dashboard/Header';
import {
    ClipboardList,
    X,
    Loader2,
    Search,
    CheckCircle2,
    Clock,
    XCircle,
    RefreshCw,
    ExternalLink,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    Zap
} from 'lucide-react';

export default function OrdersPage() {
    const { user, loading: authLoading } = useAuth();
    const { orders, refreshOrders, cancelOrder } = usePortfolio();
    const router = useRouter();

    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'FILLED' | 'CANCELLED'>('ALL');
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) router.push('/login');
        else if (user) refreshOrders();
    }, [user, authLoading, refreshOrders, router]);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        await refreshOrders();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    const handleCancel = async (orderId: string) => {
        setCancellingId(orderId);
        try {
            await cancelOrder(orderId);
            showToast('success', 'Limit order cancelled successfully');
        } catch (e: any) {
            showToast('error', e.message || 'Failed to cancel order');
        } finally {
            setCancellingId(null);
        }
    };

    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            const matchesSearch = o.symbol.toLowerCase().includes(searchQuery.toLowerCase());
            if (!matchesSearch) return false;
            if (statusFilter === 'ALL') return true;
            return o.status === statusFilter;
        });
    }, [orders, searchQuery, statusFilter]);

    const openCount = orders.filter(o => o.status === 'OPEN').length;
    const filledCount = orders.filter(o => o.status === 'FILLED').length;
    const cancelledCount = orders.filter(o => o.status === 'CANCELLED').length;

    return (
        <div className="min-h-screen bg-transparent font-sans page-fade-in pb-16">
            <Header />

            {toast && (
                <div
                    className={`fixed top-20 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-semibold shadow-float border animate-in slide-in-from-top-2 fade-in duration-200 ${
                        toast.type === 'success'
                            ? 'bg-up/15 border-up/30 text-up shadow-[0_0_15px_rgba(38,208,124,0.25)]'
                            : 'bg-down/15 border-down/30 text-down shadow-[0_0_15px_rgba(255,92,108,0.25)]'
                    }`}
                >
                    {toast.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-up" />
                    ) : (
                        <XCircle className="w-4 h-4 text-down" />
                    )}
                    {toast.message}
                </div>
            )}

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Title Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-[26px] font-bold text-ink-heading tracking-tight font-heading">
                                Order Book
                            </h1>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                {orders.length} Total
                            </span>
                        </div>
                        <p className="text-xs text-ink-faint">
                            Live history of all executed market orders and queued limit orders.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleManualRefresh}
                            disabled={isRefreshing}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-white/10 text-xs font-medium text-ink-muted hover:text-ink transition-all active:scale-95"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
                            Sync Orders
                        </button>
                        <Link
                            href="/holdings"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-[#003829] hover:brightness-110 transition-all shadow-[0_0_15px_rgba(51,201,221,0.25)]"
                        >
                            <Zap className="w-3.5 h-3.5" />
                            View Holdings
                        </Link>
                    </div>
                </div>

                {/* Quick Metric Tiles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <div className="rounded-2xl p-5 bg-surface border border-white/10 shadow-soft">
                        <div className="flex items-center justify-between text-xs text-ink-faint mb-2">
                            <span className="uppercase tracking-wider font-semibold text-[11px]">Open Limit Orders</span>
                            <Clock className="w-4 h-4 text-primary" />
                        </div>
                        <h2 className="text-[26px] font-bold text-primary tabular-nums font-num">
                            {openCount}
                        </h2>
                        <p className="text-xs text-ink-faint mt-1">Pending target fill price</p>
                    </div>

                    <div className="rounded-2xl p-5 bg-surface border border-white/10 shadow-soft">
                        <div className="flex items-center justify-between text-xs text-ink-faint mb-2">
                            <span className="uppercase tracking-wider font-semibold text-[11px]">Filled Trades</span>
                            <CheckCircle2 className="w-4 h-4 text-up" />
                        </div>
                        <h2 className="text-[26px] font-bold text-up tabular-nums font-num">
                            {filledCount}
                        </h2>
                        <p className="text-xs text-ink-faint mt-1">Settled into portfolio</p>
                    </div>

                    <div className="rounded-2xl p-5 bg-surface border border-white/10 shadow-soft">
                        <div className="flex items-center justify-between text-xs text-ink-faint mb-2">
                            <span className="uppercase tracking-wider font-semibold text-[11px]">Cancelled</span>
                            <XCircle className="w-4 h-4 text-ink-faint" />
                        </div>
                        <h2 className="text-[26px] font-bold text-ink-muted tabular-nums font-num">
                            {cancelledCount}
                        </h2>
                        <p className="text-xs text-ink-faint mt-1">Withdrawn orders</p>
                    </div>
                </div>

                {/* Orders Content */}
                {orders.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-surface p-14 text-center shadow-soft">
                        <div className="w-16 h-16 bg-surface-2 border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <ClipboardList className="w-8 h-8 text-ink-faint" />
                        </div>
                        <h3 className="text-base font-bold text-ink-heading mb-2">No Orders Placed</h3>
                        <p className="text-ink-faint text-sm max-w-sm mx-auto mb-6">
                            When you place market or limit trades on any stock, your order history will appear here.
                        </p>
                        <Link
                            href="/dashboard"
                            className="inline-flex px-6 py-2.5 text-[#003829] rounded-xl font-bold text-sm transition-all shadow-[0_0_20px_rgba(51,201,221,0.3)]"
                            style={{ background: 'linear-gradient(135deg, #33c9dd, #22a9bc)' }}
                        >
                            Explore Stocks
                        </Link>
                    </div>
                ) : (
                    <div className="bg-surface rounded-2xl border border-white/10 shadow-soft overflow-hidden">
                        {/* Filter Toolbar */}
                        <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            {/* Search */}
                            <div className="relative w-full sm:w-72">
                                <Search className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search by symbol..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full h-9 pl-9 pr-3 text-xs bg-surface-2 border border-white/10 rounded-xl outline-none focus:border-primary text-ink transition-colors"
                                />
                            </div>

                            {/* Status Filter Tabs */}
                            <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-xl border border-white/10">
                                {(
                                    [
                                        { key: 'ALL', label: `All (${orders.length})` },
                                        { key: 'OPEN', label: `Open (${openCount})` },
                                        { key: 'FILLED', label: `Filled (${filledCount})` },
                                        { key: 'CANCELLED', label: `Cancelled` },
                                    ] as const
                                ).map(t => (
                                    <button
                                        key={t.key}
                                        type="button"
                                        onClick={() => setStatusFilter(t.key)}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                            statusFilter === t.key
                                                ? 'bg-primary text-[#003829] shadow-sm'
                                                : 'text-ink-faint hover:text-ink'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-surface-2/60 text-[10px] font-bold text-ink-faint uppercase tracking-wider border-b border-white/10">
                                        <th className="px-6 py-3.5">Time & Date</th>
                                        <th className="px-6 py-3.5">Side</th>
                                        <th className="px-6 py-3.5">Symbol</th>
                                        <th className="px-6 py-3.5 text-right">Quantity</th>
                                        <th className="px-6 py-3.5 text-right">Execution Price</th>
                                        <th className="px-6 py-3.5 text-right">Total Amount</th>
                                        <th className="px-6 py-3.5 text-center">Status</th>
                                        <th className="px-6 py-3.5 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.06]">
                                    {filteredOrders.map(order => {
                                        const isBuy = order.side === 'BUY';
                                        const date = new Date(order.createdAt);
                                        const price = order.price ?? order.limitPrice ?? 0;
                                        const total = order.totalAmount ?? price * order.quantity;
                                        const isOpen = order.status === 'OPEN';
                                        const cleanSymbol = order.symbol.replace(/\.(NS|BO)$/i, '');

                                        return (
                                            <tr
                                                key={order.id}
                                                className="hover:bg-surface-2/40 transition-colors group"
                                            >
                                                {/* Date & Time */}
                                                <td className="px-6 py-4 text-xs font-num text-ink-muted">
                                                    <p className="font-semibold text-ink">
                                                        {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                    <p className="text-[10px] text-ink-faint">
                                                        {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                    </p>
                                                </td>

                                                {/* Side */}
                                                <td className="px-6 py-4">
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                                                            isBuy
                                                                ? 'bg-up/10 text-up border-up/20'
                                                                : 'bg-down/10 text-down border-down/20'
                                                        }`}
                                                    >
                                                        {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                        {order.side}
                                                    </span>
                                                </td>

                                                {/* Symbol */}
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-8 h-8 rounded-xl bg-surface-2 border border-white/10 flex items-center justify-center text-[10px] font-black text-primary">
                                                            {cleanSymbol.slice(0, 2)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-ink-heading">
                                                                {cleanSymbol}
                                                            </p>
                                                            <div className="flex items-center gap-1.5 text-[10px] text-ink-faint">
                                                                <span className="font-semibold">{order.orderType}</span>
                                                                <span>&bull;</span>
                                                                <span className="font-mono">{order.id}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Quantity */}
                                                <td className="px-6 py-4 text-right text-sm font-semibold text-ink-muted tabular-nums font-num">
                                                    {order.quantity}
                                                </td>

                                                {/* Price */}
                                                <td className="px-6 py-4 text-right text-sm text-ink-muted tabular-nums font-num">
                                                    ₹{fmt(price)}
                                                </td>

                                                {/* Total */}
                                                <td className="px-6 py-4 text-right text-sm font-bold text-ink tabular-nums font-num">
                                                    ₹{fmt(total)}
                                                </td>

                                                {/* Status Badge */}
                                                <td className="px-6 py-4 text-center">
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                                            order.status === 'FILLED'
                                                                ? 'bg-up/10 text-up border-up/20'
                                                                : order.status === 'OPEN'
                                                                ? 'bg-primary/10 text-primary border-primary/20'
                                                                : 'bg-surface-2 text-ink-faint border-white/10'
                                                        }`}
                                                    >
                                                        {order.status === 'FILLED' && <CheckCircle2 className="w-2.5 h-2.5" />}
                                                        {order.status === 'OPEN' && <Clock className="w-2.5 h-2.5 animate-pulse" />}
                                                        {order.status === 'CANCELLED' && <XCircle className="w-2.5 h-2.5" />}
                                                        {order.status}
                                                    </span>
                                                </td>

                                                {/* Action */}
                                                <td className="px-6 py-4 text-right">
                                                    {isOpen && order.id.toString().startsWith('L-') ? (
                                                        <button
                                                            onClick={() => handleCancel(order.id.toString())}
                                                            disabled={cancellingId === order.id.toString()}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-down border border-down/25 rounded-xl hover:bg-down/10 transition-colors disabled:opacity-50 active:scale-95"
                                                        >
                                                            {cancellingId === order.id.toString() ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                <X className="w-3 h-3" />
                                                            )}
                                                            Cancel
                                                        </button>
                                                    ) : (
                                                        <Link
                                                            href={`/stock/${cleanSymbol}`}
                                                            className="text-ink-faint hover:text-primary transition-colors inline-block"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                        </Link>
                                                    )}
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
