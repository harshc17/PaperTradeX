'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Bookmark, Link2, TrendingDown, TrendingUp } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { API_URL } from '@/lib/config';
import { usePortfolio } from '@/context/PortfolioContext';

type StockData = {
    symbol: string;
    shortName: string;
    regularMarketPrice: number;
    regularMarketChange: number;
    regularMarketChangePercent: number;
    regularMarketPreviousClose: number;
    regularMarketOpen: number;
    regularMarketDayHigh: number;
    regularMarketDayLow: number;
    regularMarketVolume: number;
    marketCap: number | null;
    marketCapUnit?: string;
    fiftyTwoWeekHigh: number | null;
    fiftyTwoWeekLow: number | null;
    pe?: number | null;
    industry?: string | null;
    sector?: string | null;
    currency: string;
    exchange: string;
    quoteType: string;
    profile?: any;
};

function timeAgo(ts: number): string {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 5)  return 'just now';
    if (secs < 60) return `${secs}s ago`;
    return `${Math.floor(secs / 60)}m ago`;
}

/* ─── Component ──────────────────────────────────────────────────────────────── */
export default function StockDetail({ symbol }: { symbol: string }) {
    const router = useRouter();
    const { marketStatus, marketOpen } = usePortfolio();
    const [stockData, setStockData]   = useState<StockData | null>(null);
    const [loading, setLoading]       = useState(true);
    const [livePrice, setLivePrice]   = useState<number | null>(null);
    const [flash, setFlash]           = useState<'up' | 'down' | null>(null);
    const [isLive, setIsLive]         = useState(false);
    const [inWatchlist, setInWatchlist] = useState(false);
    const [lastUpdateTs, setLastUpdateTs] = useState<number>(Date.now());
    const [ticker, setTicker]         = useState(0); // increments every second for "X ago" label
    const pollRef                     = useRef<ReturnType<typeof setInterval> | null>(null);
    const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();

    /* ─── HTTP fetch on mount ───────────────────────────────────────────────── */
    useEffect(() => {
        fetch(`${API_URL}/api/stock/${encodeURIComponent(symbol)}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) {
                    setStockData(data);
                    setLivePrice(data.regularMarketPrice);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [symbol]);

    /* ─── WebSocket real-time updates ──────────────────────────────────────── */
    useEffect(() => {
        const s = getSocket();
        s.emit('subscribe', symbol);

        const handlePriceTick = (tick: any) => {
            if (!marketOpen) return;
            if (tick.symbol !== bare && tick.symbol !== symbol) return;
            updatePrice(tick.price);
        };

        const handleMarketUpdate = (payload: Record<string, any>) => {
            if (!marketOpen) return;
            const entry = payload[bare] || payload[symbol] || payload[bare + '.NS'];
            if (typeof entry?.price === 'number') updatePrice(entry.price);
        };

        const updatePrice = (newPrice: number) => {
            setLivePrice(prev => {
                if (prev !== null) {
                    setFlash(newPrice >= prev ? 'up' : 'down');
                    setTimeout(() => setFlash(null), 800);
                }
                return newPrice;
            });
            setIsLive(true);
            setLastUpdateTs(Date.now());
        };

        s.on('price_tick', handlePriceTick);
        s.on('market_update', handleMarketUpdate);

        // Mark stale if no update for 8 seconds
        const staleTimer = setInterval(() => {
            if (Date.now() - lastUpdateTs > 8000) setIsLive(false);
        }, 3000);

        return () => {
            s.off('price_tick', handlePriceTick);
            s.off('market_update', handleMarketUpdate);
            s.emit('deprioritize', symbol);
            clearInterval(staleTimer);
        };
    }, [symbol, bare, marketOpen]);

    /* ─── HTTP polling fallback every 4s when not LIVE ─────────────────────── */
    useEffect(() => {
        if (pollRef.current) clearInterval(pollRef.current);

        pollRef.current = setInterval(async () => {
            if (!marketOpen) return; // Do not poll when market is closed (keeps price frozen to chart price)
            if (isLive) return; // WebSocket is working — skip
            try {
                const fetchSym = symbol.toUpperCase().endsWith('.BO') ? symbol : bare;
                const r = await fetch(`${API_URL}/api/stock/${encodeURIComponent(fetchSym)}/realtime`);
                if (!r.ok) return;
                const data = await r.json();
                if (typeof data?.price === 'number') {
                    setLivePrice(prev => {
                        if (prev !== null) {
                            setFlash(data.price >= prev ? 'up' : 'down');
                            setTimeout(() => setFlash(null), 800);
                        }
                        return data.price;
                    });
                    setLastUpdateTs(Date.now());
                }
            } catch { /* silent */ }
        }, 4000);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [isLive, bare, marketOpen]);

    /* ─── Ticker for "Updated X ago" label ─────────────────────────────────── */
    useEffect(() => {
        const t = setInterval(() => setTicker(p => p + 1), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        try {
            const saved = localStorage.getItem('ptx_watchlist');
            const current = saved ? JSON.parse(saved) : [];
            const list = Array.isArray(current) ? current : [];
            const activeSymbol = String(stockData?.symbol || symbol || '').toUpperCase();
            const exists = list.some((w: any) => String(w?.symbol || '').toUpperCase() === activeSymbol);
            setInWatchlist(exists);
        } catch {
            setInWatchlist(false);
        }
    }, [stockData?.symbol, symbol]);

    /* ─── Loading skeleton ─────────────────────────────────────────────────── */
    if (loading) {
        return (
            <div className="terminal-card p-6 shadow-soft space-y-4">
                <div className="animate-pulse space-y-4">
                    <div className="h-5 w-48 shimmer rounded-lg" />
                    <div className="h-10 w-36 shimmer rounded-lg" />
                    <div className="grid grid-cols-4 gap-4 pt-4">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-12 shimmer rounded-lg" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!stockData) {
        return (
            <div className="terminal-card p-6 shadow-soft text-center py-12">
                <p className="text-down font-medium">Failed to load stock data. Please try again.</p>
            </div>
        );
    }

    const currentPrice = livePrice ?? stockData.regularMarketPrice;

    // Recompute change/changePercent dynamically so they stay in sync with the live
    // price as it streams in via WebSocket. Use regularMarketPreviousClose as the
    // fixed anchor (fetched once at mount, never changes within a trading session).
    const prevClose = stockData.regularMarketPreviousClose ?? 0;
    const change = prevClose > 0
        ? parseFloat((currentPrice - prevClose).toFixed(2))
        : (stockData.regularMarketChange ?? 0);
    const changePercent = prevClose > 0
        ? parseFloat(((change / prevClose) * 100).toFixed(2))
        : (stockData.regularMarketChangePercent ?? 0);
    const isUp = change >= 0;

    const isNegative = change < 0;
    const changeClass = isNegative ? 'text-down' : 'text-up';
    const prettySymbol = stockData.symbol.replace('.NS', '');

    const addToWatchlistAndOpen = () => {
        try {
            const itemSymbol = (stockData.symbol || symbol || '').toUpperCase();
            const itemName = stockData.shortName || itemSymbol;
            const saved = localStorage.getItem('ptx_watchlist');
            const current = saved ? JSON.parse(saved) : [];
            const list = Array.isArray(current) ? current : [];
            const exists = list.some((w: any) => String(w?.symbol || '').toUpperCase() === itemSymbol);
            if (!exists) {
                list.push({ symbol: itemSymbol, name: itemName });
                localStorage.setItem('ptx_watchlist', JSON.stringify(list));
                setInWatchlist(true);
            }
            router.push(`/watchlist?added=${encodeURIComponent(itemSymbol)}`);
            return;
        } catch {
            // ignore localStorage parsing errors and still navigate
        }
        router.push('/watchlist');
    };

    return (
        <div className="bg-transparent">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="text-[20px] text-ink-muted leading-6 mb-1 tracking-tight">
                        {prettySymbol} · {stockData.exchange}
                    </div>
                    <h1 className="text-[24px] sm:text-[26px] font-semibold text-ink-heading leading-[1.15] mb-2.5">
                        {stockData.shortName}
                    </h1>

                    <div className={`flex items-baseline gap-2 transition-colors duration-300 ${
                        flash === 'up' ? 'text-up' : flash === 'down' ? 'text-down' : 'text-ink-heading'
                    }`}>
                        <span className="text-[24px] sm:text-[26px] font-semibold tabular-nums tracking-tight">
                            ₹{currentPrice.toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </span>
                        <span className={`text-sm sm:text-base font-semibold ${changeClass} inline-flex items-center gap-1`}>
                            {isUp ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                            {change.toFixed(2)} ({Math.abs(changePercent).toFixed(2)}%)
                        </span>
                        <span className="text-sm sm:text-base text-ink-faint font-normal">1D</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        <p className="text-xs text-ink-faint">
                            Updated {timeAgo(lastUpdateTs)} · {marketOpen ? (isLive ? 'Live NSE Feed' : 'Delayed') : 'Market Closed (LTP)'}
                        </p>
                        {!marketOpen && marketStatus && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-2 border border-white/10 text-ink-muted">
                                {marketStatus.sessionName} · Opens {marketStatus.nextOpenFormatted}
                            </span>
                        )}
                    </div>
                </div>

                <div className="hidden sm:flex items-center gap-3 pt-1">
                    <button className="w-12 h-12 rounded-full border border-white/10 bg-surface grid place-items-center text-ink-muted hover:text-primary">
                        <Link2 className="w-5 h-5" />
                    </button>
                    <button className="w-12 h-12 rounded-full border border-white/10 bg-surface grid place-items-center text-ink-muted hover:text-primary">
                        <Bell className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        onClick={addToWatchlistAndOpen}
                        title={inWatchlist ? 'Open watchlist' : 'Add to watchlist'}
                        className={`w-12 h-12 rounded-full border grid place-items-center transition-all duration-200 ${
                            inWatchlist
                                ? 'border-up bg-up/10 text-up shadow-sm'
                                : 'border-white/10 bg-surface text-ink-muted hover:text-up hover:border-up/40 hover:bg-up/5'
                        }`}
                    >
                        <Bookmark className={`w-5 h-5 ${inWatchlist ? 'fill-current' : ''}`} />
                    </button>
                </div>
            </div>
        </div>
    );
}
