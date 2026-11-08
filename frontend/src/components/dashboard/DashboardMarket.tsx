'use client';
import CompanyLogo from '@/components/CompanyLogo';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSocket } from '@/lib/socket';
import { API_URL } from '@/lib/config';
import { usePortfolio } from '@/context/PortfolioContext';
import { TrendingUp, TrendingDown, ArrowUpRight, Loader2 } from 'lucide-react';
import MarketMovers from './MarketMovers';
import DashboardNews from './DashboardNews';

const INDEX_SYMBOLS = ['^NSEI', '^BSESN', '^NSEBANK', '^MIDCPNIFTY', '^FINNIFTY'];
const INDEX_LABELS: Record<string, string> = {
    '^NSEI': 'NIFTY 50',
    '^BSESN': 'SENSEX',
    '^NSEBANK': 'BANKNIFTY',
    '^MIDCPNIFTY': 'MIDCPNIFTY',
    '^FINNIFTY': 'FINNIFTY'
};

const TOP_STOCKS = [
    { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
    { symbol: 'TCS.NS', name: 'TCS' },
    { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
    { symbol: 'INFY.NS', name: 'Infosys' },
    { symbol: 'ICICIBANK.NS', name: 'ICICI Bank' },
    { symbol: 'SBIN.NS', name: 'SBI' },
    { symbol: 'ITC.NS', name: 'ITC' },
    { symbol: 'AXISBANK.NS', name: 'Axis Bank' },
    { symbol: 'WIPRO.NS', name: 'Wipro' },
    { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance' },
];

type QuoteData = { symbol: string; price: number; change: number; dayChange: number; shortname?: string };

function normalizeQuote(sym: string, d: any): QuoteData | null {
    if (typeof d?.price !== 'number') return null;
    return { symbol: sym, price: d.price, change: d.change ?? 0, dayChange: d.dayChange ?? 0, shortname: d.shortname };
}

function resolveQuote(quotes: Record<string, QuoteData>, symbol: string): QuoteData | undefined {
    const upper = symbol.toUpperCase();
    const bare = upper.replace(/\.(NS|BO)$/i, '');
    return quotes[upper] || quotes[bare] || quotes[`${bare}.NS`];
}

export default function DashboardMarket() {
    const router = useRouter();
    const { marketStatus } = usePortfolio();
    const [showAllStocks, setShowAllStocks] = useState(false);
    const [openingSymbol, setOpeningSymbol] = useState<string | null>(null);
    const [isNavigating, startNavigation] = useTransition();
    const openStock = (symbol: string) => {
        if (isNavigating) return;
        setOpeningSymbol(symbol);
        startNavigation(() => router.push('/stock/' + encodeURIComponent(symbol)));
    };
    const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    useEffect(() => {
        const s = getSocket();
        const allSymbols = [...INDEX_SYMBOLS, ...TOP_STOCKS.map(s => s.symbol)];
        allSymbols.forEach(sym => s.emit('subscribe', sym));

        const onUpdate = (payload: Record<string, any>) => {
            setQuotes(prev => {
                const next = { ...prev };
                Object.entries(payload).forEach(([sym, d]: [string, any]) => {
                    const q = normalizeQuote(sym, d);
                    if (!q) return;
                    next[sym] = q;
                    if (!sym.startsWith('^')) {
                        if (sym.endsWith('.NS')) next[sym.replace(/\.NS$/i, '')] = { ...q, symbol: sym.replace(/\.NS$/i, '') };
                        else next[`${sym}.NS`] = { ...q, symbol: `${sym}.NS` };
                    }
                });
                return next;
            });
            setLastUpdated(new Date());
        };

        const onPriceTick = (tick: Record<string, any>) => {
            if (typeof tick?.symbol !== 'string') return;
            const q = normalizeQuote(tick.symbol, tick);
            if (!q) return;
            setQuotes(prev => {
                const next = { ...prev };
                next[tick.symbol] = q;
                if (!tick.symbol.startsWith('^')) {
                    if (tick.symbol.endsWith('.NS')) next[tick.symbol.replace(/\.NS$/i, '')] = { ...q, symbol: tick.symbol.replace(/\.NS$/i, '') };
                    else next[`${tick.symbol}.NS`] = { ...q, symbol: `${tick.symbol}.NS` };
                }
                return next;
            });
            setLastUpdated(new Date());
        };

        s.on('market_update', onUpdate);
        s.on('price_tick', onPriceTick);

        const hydrateQuotes = async () => {
            try {
                const [indicesRes, ...stockRes] = await Promise.all([
                    fetch(`${API_URL}/api/indices`).then(r => r.ok ? r.json() : null).catch(() => null),
                    ...TOP_STOCKS.map(st =>
                        fetch(`${API_URL}/api/stock/${encodeURIComponent(st.symbol)}/realtime`)
                            .then(r => r.ok ? r.json() : null).catch(() => null)
                    ),
                ]);
                setQuotes(prev => {
                    const next = { ...prev };
                    if (indicesRes) Object.entries(indicesRes).forEach(([sym, d]: [string, any]) => { const q = normalizeQuote(sym, d); if (q) next[sym] = q; });
                    stockRes.forEach((d: any) => {
                        const sym = String(d?.symbol || '').toUpperCase();
                        if (!sym || typeof d?.price !== 'number') return;
                        const key = sym.endsWith('.NS') ? sym : `${sym}.NS`;
                        next[key] = { symbol: key, price: d.price, change: d.change ?? 0, dayChange: d.dayChange ?? 0, shortname: key };
                    });
                    return next;
                });
                setLastUpdated(new Date());
            } catch { /* silent */ }
        };

        hydrateQuotes();
        const refreshTimer = setInterval(hydrateQuotes, 8000);
        return () => { s.off('market_update', onUpdate); s.off('price_tick', onPriceTick); clearInterval(refreshTimer); };
    }, []);

    const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

    return (
        <div className="space-y-8">
            {/* Market Indices */}
            <section>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h2 className="text-base font-medium text-ink-heading">Market overview</h2>
                    {lastUpdated && (
                        <div className="flex items-center gap-2 text-xs text-ink-faint">
                            <span className={`w-1.5 h-1.5 rounded-full ${marketStatus?.isOpen ? 'bg-up' : 'bg-ink-faint'}`} />
                            <span>{marketStatus ? (marketStatus.isOpen ? 'NSE open' : 'NSE closed') : 'Market snapshot'} · Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST</span>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {INDEX_SYMBOLS.map(sym => {
                        const q = resolveQuote(quotes, sym);
                        const isUp = (q?.change ?? 0) >= 0;
                        return (
                            <Link href={`/stock/${encodeURIComponent(sym)}`} key={sym} className="block group">
                                <div className="card-interactive terminal-card p-4 h-full cursor-pointer flex flex-col justify-center">
                                    <p className="text-xs font-medium text-ink-faint mb-2 group-hover:text-primary transition-colors">{INDEX_LABELS[sym]}</p>
                                    {q ? (
                                        <>
                                            <p className="text-lg sm:text-xl font-medium text-ink-heading tabular-nums font-num">{fmt(q.price)}</p>
                                            <div className={`flex flex-wrap items-center gap-1 mt-2 text-xs font-normal tabular-nums font-num ${isUp ? 'text-up' : 'text-down'}`}>
                                                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                {isUp ? '+' : ''}{fmt(q.change)} ({isUp ? '+' : ''}{q.dayChange.toFixed(2)}%)
                                            </div>
                                        </>
                                    ) : (
                                        <div className="h-10 flex flex-col justify-center gap-1.5">
                                            <div className="w-20 h-4 shimmer rounded-md" />
                                            <div className="w-14 h-3 shimmer rounded" />
                                        </div>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </section>

            {/* Top Stocks */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-medium text-ink-heading">Top stocks</h2>
                    <button type="button" aria-expanded={showAllStocks} aria-controls="top-stocks-list" onClick={() => setShowAllStocks(v => !v)} className="lg:hidden min-h-11 text-[12px] text-primary hover:underline font-medium">{showAllStocks ? 'Show fewer' : 'View all 10'}</button>
                </div>
                <div className="bg-surface rounded-2xl border border-line overflow-hidden shadow-none">
                    <div className="hidden sm:grid grid-cols-12 gap-2 px-3 sm:px-5 py-3 bg-surface-2 border-b border-line text-xs font-medium text-ink-faint">
                        <div className="col-span-5">Company</div>
                        <div className="col-span-5 sm:col-span-3 text-right">Price</div>
                        <div className="col-span-2 text-right" title="Compared with the previous market close">Day change</div>
                        <div className="col-span-2 text-right">Action</div>
                    </div>
                    <div id="top-stocks-list" className="divide-y divide-line">
                        {TOP_STOCKS.map((stock, index) => {
                            const q = resolveQuote(quotes, stock.symbol);
                            const isUp = (q?.change ?? 0) >= 0;

                            return (
                                <div key={stock.symbol}
                                    className={`${index >= 4 && !showAllStocks ? 'hidden lg:grid' : 'grid'} grid-cols-12 gap-1 px-3 sm:px-5 py-3 sm:py-4 items-center hover:bg-surface-3 transition-colors cursor-pointer group`}
                                    onClick={() => openStock(stock.symbol)}>
                                    <div className="col-span-7 sm:col-span-5 min-w-0 flex items-center gap-2 sm:gap-3">
                                        <CompanyLogo symbol={stock.symbol} className="h-8 w-8 sm:h-9 sm:w-9" />
                                        <div className="min-w-0">
                                            <p className="truncate text-xs sm:text-sm font-semibold text-ink group-hover:text-primary transition-colors" title={stock.name}>{stock.name}</p>
                                            <p className="text-xs text-ink-faint">{stock.symbol.replace('.NS', '')} · NSE</p>
                                        </div>
                                    </div>
                                    <div className="col-span-3 text-right">
                                        {q ? <p className="text-xs sm:text-sm whitespace-nowrap font-medium text-ink-heading tabular-nums font-num">₹{fmt(q.price)}</p>
                                            : <div className="w-16 h-4 shimmer rounded ml-auto" />}
                                    </div>
                                    <div className="col-span-7 sm:col-span-2 text-left sm:text-right">
                                        {q ? (
                                            <span className={`text-xs sm:text-xs font-medium px-1 sm:px-2 py-1 rounded-lg tabular-nums font-num ${isUp ? 'text-up bg-up/10 border border-up/20' : 'text-down bg-down/10 border border-down/20'}`}>
                                                {isUp ? '+' : ''}{q.dayChange.toFixed(2)}%
                                            </span>
                                        ) : <div className="w-12 h-5 shimmer rounded ml-auto" />}
                                    </div>
                                    <div className="col-span-5 sm:col-span-2 flex justify-end">
                                        <button
                                            id={`buy-btn-${stock.symbol}`}
                                            onClick={e => { e.stopPropagation(); openStock(stock.symbol); }}
                                            disabled={isNavigating}
                                            aria-label={`Buy ${stock.name}`}
                                            aria-busy={isNavigating && openingSymbol === stock.symbol}
                                            className="min-h-11 min-w-11 inline-flex items-center justify-center gap-1.5 px-2 sm:px-2 py-2 text-xs font-medium text-[var(--primary-ink)] rounded-lg transition-colors duration-150 hover:brightness-110 shadow-none active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60 disabled:cursor-wait"
                                            style={{ background: 'var(--surface-2)', color: 'var(--text-main)', border: '1px solid var(--surface-border-strong)' }}>
                                            {isNavigating && openingSymbol === stock.symbol ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span className="sm:sr-only">Opening…</span></> : <><span>Buy</span><ArrowUpRight className="w-3.5 h-3.5" /></>}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section><MarketMovers /></section>
            <section><DashboardNews /></section>
        </div>
    );
}
