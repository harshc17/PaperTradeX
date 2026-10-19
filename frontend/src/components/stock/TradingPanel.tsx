'use client';
import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import { API_URL } from '@/lib/config';
import {
    CheckCircle2,
    XCircle,
    Loader2,
    Clock,
    Sparkles,
    ArrowUpRight,
    ArrowDownRight,
    Zap,
    Minus,
    Plus,
    ShieldCheck,
    Coins,
} from 'lucide-react';

type Toast = { type: 'success' | 'error'; message: string };

export default function TradingPanel({ symbol }: { symbol: string }) {
    const { user, balance, refreshBalance } = useAuth();
    const { executeTrade, refreshPortfolio, refreshOrders, marketStatus } = usePortfolio();

    const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
    const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
    const [quantity, setQuantity] = useState('1');
    const [limitPrice, setLimitPrice] = useState('');
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [priceChange, setPriceChange] = useState<number>(0);
    const [exchange, setExchange] = useState<'NSE' | 'BSE'>(symbol.toUpperCase().endsWith('.BO') ? 'BSE' : 'NSE');
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<Toast | null>(null);

    const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();

    useEffect(() => {
        const s = getSocket();
        s.emit('subscribe', symbol);
        s.emit('subscribe', bare);
        const onUpdate = (payload: Record<string, any>) => {
            const entry = payload[bare] ?? payload[symbol] ?? payload[bare + '.NS'];
            if (typeof entry?.price === 'number') {
                setCurrentPrice(entry.price);
                setPriceChange(entry.dayChange ?? 0);
            }
        };
        s.on('market_update', onUpdate);
        return () => { s.off('market_update', onUpdate); };
    }, [symbol, bare]);

    useEffect(() => {
        const fetchSym = symbol.toUpperCase().endsWith('.BO') ? symbol : bare;
        fetch(`${API_URL}/api/stock/${encodeURIComponent(fetchSym)}/realtime`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (typeof data?.price === 'number' && currentPrice === null) {
                    setCurrentPrice(data.price);
                    setPriceChange(data.dayChange ?? 0);
                    if (!limitPrice) setLimitPrice(data.price.toFixed(2));
                }
            })
            .catch(() => {});
    }, [symbol, bare, currentPrice, limitPrice]);

    useEffect(() => {
        if (currentPrice && !limitPrice) {
            setLimitPrice(currentPrice.toFixed(2));
        }
    }, [currentPrice, limitPrice]);



    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    const nsePrice = currentPrice ?? 0;
    const bsePrice = nsePrice > 0 ? +(nsePrice + 0.35).toFixed(2) : 0;
    const displayPrice = exchange === 'NSE' ? nsePrice : bsePrice;
    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const activePrice = orderType === 'MARKET' ? (displayPrice || 0) : (parseFloat(limitPrice) || displayPrice || 0);
    const parsedQty = Math.max(0, parseInt(quantity, 10) || 0);
    const estimatedTotal = parsedQty * activePrice;
    const balanceRemaining = Math.max(0, balance - (side === 'BUY' ? estimatedTotal : 0));

    const setQtyPreset = (q: number) => setQuantity(String(q));
    const setMaxQty = () => {
        if (activePrice <= 0) return;
        const max = Math.floor(balance / activePrice);
        setQuantity(String(Math.max(1, max)));
    };

    const adjustLimitPrice = (pct: number) => {
        if (!displayPrice) return;
        const newPrice = displayPrice * (1 + pct / 100);
        setLimitPrice(newPrice.toFixed(2));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) { showToast('error', 'Please login to trade'); return; }
        if (!parsedQty || parsedQty <= 0) { showToast('error', 'Enter a valid quantity'); return; }
        if (!activePrice || activePrice <= 0) { showToast('error', 'Valid price required'); return; }

        if (side === 'BUY' && balance < estimatedTotal) {
            showToast('error', `Insufficient balance. Required: ₹${fmt(estimatedTotal)}, Available: ₹${fmt(balance)}`);
            return;
        }

        setLoading(true);
        try {
            const currentMarketPrice = displayPrice || activePrice;
            const parsedLimit = parseFloat(limitPrice) || activePrice;
            const result = await executeTrade(
                symbol,
                side,
                parsedQty,
                currentMarketPrice,
                orderType,
                orderType === 'LIMIT' ? parsedLimit : undefined
            );

            const execPrice = result.price || activePrice;
            if (result.status === 'FILLED') {
                showToast('success', `${side} ${parsedQty} share(s) of ${bare} @ ₹${fmt(execPrice)} executed!`);
            } else {
                showToast('success', `Limit order queued (ID: ${result.orderId}) @ ₹${fmt(parsedLimit)}`);
            }

            setQuantity('1');
            await Promise.all([refreshBalance(), refreshPortfolio(), refreshOrders()]);
        } catch (err: any) {
            showToast('error', err.message || 'Trade execution failed');
        } finally {
            setLoading(false);
        }
    };

    const isBuy = side === 'BUY';
    const isUp = priceChange >= 0;

    return (
        <div className="relative rounded-2xl bg-[#0f1724]/95 backdrop-blur-xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.45)] overflow-hidden transition-all sticky top-20">
            {/* Ambient edge glow */}
            <div
                className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] pointer-events-none transition-all duration-500"
                style={{
                    background: isBuy
                        ? 'radial-gradient(circle, rgba(38,208,124,0.25) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(255,92,108,0.25) 0%, transparent 70%)'
                }}
            />

            {/* Notification Toast */}
            {toast && (
                <div
                    className={`mx-5 mt-4 mb-1 z-50 flex items-center gap-2.5 p-3.5 rounded-xl text-xs font-semibold shadow-lg border animate-in slide-in-from-top-2 fade-in duration-200 ${
                        toast.type === 'success'
                            ? 'bg-up/15 border-up/30 text-up shadow-[0_0_15px_rgba(38,208,124,0.2)]'
                            : 'bg-down/15 border-down/30 text-down shadow-[0_0_15px_rgba(255,92,108,0.2)]'
                    }`}
                >
                    {toast.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-up" />
                    ) : (
                        <XCircle className="w-4 h-4 flex-shrink-0 text-down" />
                    )}
                    <span className="leading-tight">{toast.message}</span>
                </div>
            )}

            {/* Header: Symbol, Exchange & Market Status */}
            <div className="px-5 pt-5 pb-4 border-b border-white/[0.08]">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[19px] font-black tracking-tight text-ink-heading font-heading">
                            {bare}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-ink-faint">
                            EQ
                        </span>
                    </div>

                    {/* Exchange Switcher */}
                    <div className="flex items-center gap-1 bg-[#151f30] border border-white/10 rounded-lg p-0.5">
                        {(['NSE', 'BSE'] as const).map(ex => (
                            <button
                                key={ex}
                                type="button"
                                onClick={() => setExchange(ex)}
                                className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md transition-all ${
                                    exchange === ex
                                        ? 'bg-primary text-[#002f23] shadow-sm'
                                        : 'text-ink-faint hover:text-ink'
                                }`}
                            >
                                {ex}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Price & Day Change */}
                <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                        <span className="text-[22px] font-bold text-ink-heading tabular-nums font-num">
                            ₹{fmt(displayPrice)}
                        </span>
                        <span className={`inline-flex items-center text-xs font-semibold tabular-nums font-num ${isUp ? 'text-up' : 'text-down'}`}>
                            {isUp ? <ArrowUpRight className="w-3.5 h-3.5 inline mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 inline mr-0.5" />}
                            {isUp ? '+' : ''}{priceChange.toFixed(2)}%
                        </span>
                    </div>

                    {/* Market Status Badge */}
                    <div
                        className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all ${
                            marketStatus?.isOpen
                                ? 'bg-up/10 text-up border-up/25 shadow-[0_0_10px_rgba(38,208,124,0.15)]'
                                : marketStatus?.session === 'PRE_MARKET'
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                                : 'bg-surface-2 text-ink-muted border-white/10'
                        }`}
                        title={marketStatus?.statusMessage || 'Market is closed'}
                    >
                        {marketStatus?.isOpen ? (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse" />
                                Live Market
                            </>
                        ) : marketStatus?.session === 'PRE_MARKET' ? (
                            <>
                                <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
                                Pre-Market
                            </>
                        ) : (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Market Closed
                            </>
                        )}
                    </div>
                </div>

                {!marketStatus?.isOpen && (
                    <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-white/5 flex items-center justify-between text-[11px] text-ink-faint">
                        <span className="flex items-center gap-1.5 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                            <span className="truncate">{marketStatus?.sessionName || 'Market Closed'}</span>
                        </span>
                        <span className="font-num text-ink-muted text-[10px] font-semibold flex-shrink-0">
                            {marketStatus?.nextOpenFormatted ? `Opens ${marketStatus.nextOpenFormatted}` : ''}
                        </span>
                    </div>
                )}
            </div>

            {/* Segmented Buy / Sell Control */}
            <div className="p-3 bg-[#131d2e]/80 border-b border-white/[0.08]">
                <div className="grid grid-cols-2 p-1 rounded-xl bg-[#0a101d] border border-white/10">
                    <button
                        type="button"
                        onClick={() => setSide('BUY')}
                        className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                            isBuy
                                ? 'bg-up text-[#003829] shadow-[0_0_16px_rgba(38,208,124,0.35)] scale-[1.02]'
                                : 'text-ink-faint hover:text-ink'
                        }`}
                    >
                        Buy
                    </button>
                    <button
                        type="button"
                        onClick={() => setSide('SELL')}
                        className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                            !isBuy
                                ? 'bg-down text-white shadow-[0_0_16px_rgba(255,92,108,0.35)] scale-[1.02]'
                                : 'text-ink-faint hover:text-ink'
                        }`}
                    >
                        Sell
                    </button>
                </div>
            </div>

            {/* Trading Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {/* Order Type Tabs */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
                            Order Type
                        </label>
                        <span className="text-[11px] text-primary/80 font-medium">Delivery (CNC)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setOrderType('MARKET')}
                            className={`h-9 rounded-xl text-xs font-bold border transition-all ${
                                orderType === 'MARKET'
                                    ? 'bg-primary/15 border-primary text-primary shadow-[0_0_12px_rgba(51,201,221,0.2)]'
                                    : 'bg-[#151f30] border-white/10 text-ink-muted hover:border-white/20'
                            }`}
                        >
                            Market Price
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setOrderType('LIMIT');
                                if (!limitPrice && currentPrice) setLimitPrice(currentPrice.toFixed(2));
                            }}
                            className={`h-9 rounded-xl text-xs font-bold border transition-all ${
                                orderType === 'LIMIT'
                                    ? 'bg-primary/15 border-primary text-primary shadow-[0_0_12px_rgba(51,201,221,0.2)]'
                                    : 'bg-[#151f30] border-white/10 text-ink-muted hover:border-white/20'
                            }`}
                        >
                            Limit Price
                        </button>
                    </div>
                </div>

                {/* Quantity Input with Quick Chips */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
                            Quantity
                        </label>
                        <div className="flex items-center gap-1.5">
                            {[1, 5, 10, 50].map(q => (
                                <button
                                    key={q}
                                    type="button"
                                    onClick={() => setQtyPreset(q)}
                                    className="px-2 py-0.5 text-[10px] font-semibold rounded bg-[#151f30] hover:bg-white/10 text-ink-faint hover:text-ink transition-colors border border-white/5"
                                >
                                    +{q}
                                </button>
                            ))}
                            {isBuy && (
                                <button
                                    type="button"
                                    onClick={setMaxQty}
                                    className="px-2 py-0.5 text-[10px] font-bold rounded bg-primary/15 text-primary hover:bg-primary/25 transition-colors border border-primary/20"
                                >
                                    MAX
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="relative flex items-center">
                        <button
                            type="button"
                            onClick={() => setQuantity(String(Math.max(1, parsedQty - 1)))}
                            className="absolute left-1.5 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-ink-muted flex items-center justify-center transition-colors"
                        >
                            <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            value={quantity}
                            onChange={e => setQuantity(e.target.value)}
                            required
                            className="w-full h-11 px-11 text-center font-bold text-ink-heading text-base bg-[#151f30] border border-white/10 rounded-xl outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 tabular-nums font-num transition-all"
                            placeholder="Shares qty"
                        />
                        <button
                            type="button"
                            onClick={() => setQuantity(String(parsedQty + 1))}
                            className="absolute right-1.5 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-ink-muted flex items-center justify-center transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Limit Price Input (Only for LIMIT orders) */}
                {orderType === 'LIMIT' && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
                                Limit Price (₹)
                            </label>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => adjustLimitPrice(-1)}
                                    className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[#151f30] text-down hover:bg-down/10 border border-down/20"
                                >
                                    -1%
                                </button>
                                <button
                                    type="button"
                                    onClick={() => adjustLimitPrice(0)}
                                    className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[#151f30] text-ink-muted hover:bg-white/10 border border-white/10"
                                >
                                    LTP
                                </button>
                                <button
                                    type="button"
                                    onClick={() => adjustLimitPrice(1)}
                                    className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[#151f30] text-up hover:bg-up/10 border border-up/20"
                                >
                                    +1%
                                </button>
                            </div>
                        </div>
                        <input
                            type="number"
                            step="0.05"
                            min="0.01"
                            value={limitPrice}
                            onChange={e => setLimitPrice(e.target.value)}
                            required
                            className="w-full h-11 px-3.5 font-bold text-ink-heading text-sm bg-[#151f30] border border-white/10 rounded-xl outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 tabular-nums font-num transition-all"
                            placeholder="Set target price"
                        />
                    </div>
                )}

                {/* Order Summary Tile */}
                <div className="p-3.5 rounded-xl bg-[#141e2e]/70 border border-white/[0.08] space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-ink-faint">
                        <span>Order Value:</span>
                        <span className="font-bold text-ink-heading tabular-nums font-num">
                            ₹{fmt(estimatedTotal)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-medium text-ink-faint">
                        <span>Available Balance:</span>
                        <span className="text-ink font-semibold tabular-nums font-num">
                            ₹{fmt(balance)}
                        </span>
                    </div>
                    {isBuy && (
                        <div className="flex items-center justify-between text-xs font-medium text-ink-faint pt-1.5 border-t border-white/[0.06]">
                            <span>Remaining Balance:</span>
                            <span className={`font-semibold tabular-nums font-num ${balanceRemaining < 0 ? 'text-down' : 'text-primary'}`}>
                                ₹{fmt(balanceRemaining)}
                            </span>
                        </div>
                    )}
                    <div className="flex items-center justify-end text-[11px] text-ink-faint pt-1">
                        <span className="text-ink-muted">Paper Simulation</span>
                    </div>
                </div>

                {/* Action Submit Button */}
                <button
                    id="place-order-btn"
                    type="submit"
                    disabled={loading || !currentPrice || (isBuy && balance < estimatedTotal)}
                    className={`w-full h-12 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 ${
                        isBuy
                            ? 'bg-gradient-to-r from-[#26d07c] to-[#1cb569] text-[#003829] hover:brightness-110 shadow-[0_4px_20px_rgba(38,208,124,0.35)]'
                            : 'bg-gradient-to-r from-[#ff5c6c] to-[#e64656] text-white hover:brightness-110 shadow-[0_4px_20px_rgba(255,92,108,0.35)]'
                    }`}
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Processing Trade...</span>
                        </>
                    ) : isBuy && balance < estimatedTotal ? (
                        <span>Insufficient Balance</span>
                    ) : (
                        <span>{isBuy ? 'Buy' : 'Sell'}</span>
                    )}
                </button>

                {/* Footer notes */}
                <div className="text-center">
                    <p className="text-[11px] text-ink-faint flex items-center justify-center gap-1.5">
                        <Coins className="w-3 h-3 text-primary" />
                        Virtual funds only &bull; Real-time market execution
                    </p>
                </div>
            </form>
        </div>
    );
}
