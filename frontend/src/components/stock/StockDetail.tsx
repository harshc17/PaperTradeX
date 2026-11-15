'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Bookmark, Link2, TrendingDown, TrendingUp } from 'lucide-react';
import { useStockQuote } from '@/lib/useStockQuote';
import { API_URL } from '@/lib/config';
import CompanyLogo from '@/components/CompanyLogo';
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
const detailCache = new Map<string, StockData>();

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
    const [stockData, setStockData]   = useState<StockData | null>(() => detailCache.get(symbol) || null);
    const [loading, setLoading]       = useState(true);
    const quote = useStockQuote(symbol);
    const flash = null;

    const [inWatchlist, setInWatchlist] = useState(false);



    /* ─── HTTP fetch on mount ───────────────────────────────────────────────── */
    useEffect(() => {
        setLoading(true);
        let cancelled = false;

        setStockData(detailCache.get(symbol) || null);
        fetch(`${API_URL}/api/stock/${encodeURIComponent(symbol)}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && !cancelled) {
                    detailCache.set(symbol, data);
                    if (detailCache.size > 64) detailCache.delete(detailCache.keys().next().value!);
                    setStockData(data);

                }
            })
            .catch(console.error)
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [symbol]);

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
    if (loading && !stockData && quote.price === null) {
        return (
            <div className="terminal-card p-6 shadow-none space-y-4">
                <div className="animate-pulse space-y-4">
                    <div className="h-5 w-48 shimmer rounded-lg" />
                    <div className="h-10 w-36 shimmer rounded-lg" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-12 shimmer rounded-lg" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!stockData && quote.price === null) {
        return (
            <div className="terminal-card p-6 shadow-none text-center py-12">
                <p className="text-down font-medium">Failed to load stock data. Please try again.</p>
            </div>
        );
    }

    // Metadata can arrive later than the quote. A slow company-details
    // request must not hide a price that the shared feed already supplied.
    const details = stockData || { symbol, shortName: symbol.replace(/\.(NS|BO)$/i, ''), exchange: symbol.endsWith('.BO') || ['^BSESN', '^BANKEX'].includes(symbol.toUpperCase()) ? 'BSE' : 'NSE', regularMarketPreviousClose: 0, regularMarketChange: 0, regularMarketChangePercent: 0 };

    const currentPrice = quote.price;

    // Recompute change/changePercent dynamically so they stay in sync with the live
    // price as it streams in via WebSocket. Use regularMarketPreviousClose as the
    // fixed anchor (fetched once at mount, never changes within a trading session).
    const prevClose = quote.previousClose ?? 0;
    const change = prevClose > 0
        ? parseFloat(((currentPrice ?? 0) - prevClose).toFixed(2))
        : (details.regularMarketChange ?? 0);
    const changePercent = prevClose > 0
        ? parseFloat(((change / prevClose) * 100).toFixed(2))
        : (details.regularMarketChangePercent ?? 0);
    const isUp = change >= 0;

    const isNegative = change < 0;
    const changeClass = isNegative ? 'text-down' : 'text-up';
    const prettySymbol = String(details.symbol || symbol).replace(/\.NS$/i, '');

    const addToWatchlistAndOpen = () => {
        try {
            const itemSymbol = (details.symbol || symbol || '').toUpperCase();
            const itemName = details.shortName || itemSymbol;
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
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 basis-72">
                    <div className="text-[20px] break-words text-ink-muted leading-6 mb-1">
                        {prettySymbol} · {details.exchange}
                    </div>
                    <h1 className="flex items-center gap-3 text-[24px] sm:text-[28px] font-semibold text-ink-heading leading-[1.15] mb-2.5">
                        <CompanyLogo symbol={symbol} />
                        <span className="min-w-0 break-words">{details.shortName}</span>
                    </h1>

                    <div className={`flex flex-wrap items-baseline gap-2 transition-colors duration-300 ${
                        flash === 'up' ? 'text-up' : flash === 'down' ? 'text-down' : 'text-ink-heading'
                    }`}>
                        <span className="text-[24px] sm:text-[28px] font-semibold tabular-nums">
                            {currentPrice === null ? '—' : '₹' + currentPrice.toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </span>
                        <span className={`text-sm sm:text-base font-semibold ${changeClass} inline-flex items-center gap-1`}>
                            {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {change.toFixed(2)} ({Math.abs(changePercent).toFixed(2)}%)
                        </span>
                        <span className="text-sm sm:text-base text-ink-faint font-normal">1D</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        <p className="text-xs text-ink-faint">
                            {quote.timestamp ? 'Quote ' + timeAgo(quote.timestamp) : 'Waiting for quote'} · {marketOpen ? (quote.stale ? 'Quote stale — trading paused' : 'Latest quote') : 'Market closed (LTP)'} · {quote.source || 'unavailable'}
                        </p>
                        {!marketOpen && marketStatus && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-surface-2 border border-line text-ink-muted">
                                {marketStatus.sessionName} · Opens {marketStatus.nextOpenFormatted}
                            </span>
                        )}
                    </div>
                </div>

                <div className="hidden shrink-0 sm:flex items-center gap-3 pt-1">
                    <button className="w-12 h-12 rounded-full border border-line bg-surface grid place-items-center text-ink-muted hover:text-primary">
                        <Link2 className="w-4 h-4" />
                    </button>
                    <button className="w-12 h-12 rounded-full border border-line bg-surface grid place-items-center text-ink-muted hover:text-primary">
                        <Bell className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={addToWatchlistAndOpen}
                        title={inWatchlist ? 'Open watchlist' : 'Add to watchlist'}
                        className={`w-12 h-12 rounded-full border grid place-items-center transition-colors duration-200 ${
                            inWatchlist
                                ? 'border-up bg-up/10 text-up shadow-none'
                                : 'border-line bg-surface text-ink-muted hover:text-up hover:border-up/40 hover:bg-up/5'
                        }`}
                    >
                        <Bookmark className={`w-5 h-5 ${inWatchlist ? 'fill-current' : ''}`} />
                    </button>
                </div>
            </div>
        </div>
    );
}
