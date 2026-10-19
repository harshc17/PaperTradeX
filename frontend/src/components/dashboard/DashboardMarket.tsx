'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSocket } from '@/lib/socket';
import { API_URL } from '@/lib/config';
import { TrendingUp, TrendingDown } from 'lucide-react';
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
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[16px] font-semibold text-ink-heading font-heading">Market Overview</h2>
                    {lastUpdated && (
                        <div className="flex items-center gap-2 text-xs text-ink-faint">
                            <span className="live-dot w-1.5 h-1.5 bg-up rounded-full" />
                            Live · {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {INDEX_SYMBOLS.map(sym => {
                        const q = resolveQuote(quotes, sym);
                        const isUp = (q?.change ?? 0) >= 0;
                        return (
                            <Link href={`/stock/${encodeURIComponent(sym)}`} key={sym} className="block group">
                                <div className="card-interactive terminal-card p-4 h-full cursor-pointer flex flex-col justify-center">
                                    <p className="text-[10px] font-bold text-ink-faint uppercase tracking-widest mb-2 group-hover:text-primary transition-colors">{INDEX_LABELS[sym]}</p>
                                    {q ? (
                                        <>
                                            <p className="text-[19px] font-bold text-ink-heading tracking-tight tabular-nums font-num">{fmt(q.price)}</p>
                                            <div className={`flex items-center gap-1 mt-1 text-[11px] font-semibold tabular-nums font-num ${isUp ? 'text-up' : 'text-down'}`}>
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
                    <h2 className="text-[16px] font-semibold text-ink-heading font-heading">Top Stocks</h2>
                    <button className="text-[12px] text-primary hover:underline font-medium">View all →</button>
                </div>
                <div className="bg-surface rounded-[14px] border border-white/10 overflow-hidden shadow-soft">
                    <div className="grid grid-cols-12 px-5 py-3 bg-surface-2 border-b border-white/10 text-[10px] font-bold text-ink-faint uppercase tracking-widest">
                        <div className="col-span-5">Company</div>
                        <div className="col-span-3 text-right">Price</div>
                        <div className="col-span-2 text-right">Change</div>
                        <div className="col-span-2 text-right">Action</div>
                    </div>
                    <div className="divide-y divide-[#222c3a]/60">
                        {TOP_STOCKS.map(stock => {
                            const q = resolveQuote(quotes, stock.symbol);
                            const isUp = (q?.change ?? 0) >= 0;
                            const initials = stock.symbol.replace('.NS', '').substring(0, 2);
                            return (
                                <div key={stock.symbol}
                                    className="grid grid-cols-12 px-5 py-4 items-center hover:bg-surface-3 transition-colors cursor-pointer group"
                                    onClick={() => router.push(`/stock/${encodeURIComponent(stock.symbol)}`)}>
                                    <div className="col-span-5 flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-surface-3 border border-white/10 flex items-center justify-center text-[10px] font-bold text-ink-muted group-hover:border-primary/30 group-hover:text-primary transition-all flex-shrink-0">
                                            {initials}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">{stock.name}</p>
                                            <p className="text-[11px] text-ink-faint">{stock.symbol.replace('.NS', '')} · NSE</p>
                                        </div>
                                    </div>
                                    <div className="col-span-3 text-right">
                                        {q ? <p className="text-sm font-bold text-ink-heading tabular-nums font-num">₹{fmt(q.price)}</p>
                                            : <div className="w-16 h-4 shimmer rounded ml-auto" />}
                                    </div>
                                    <div className="col-span-2 text-right">
                                        {q ? (
                                            <span className={`text-xs font-bold px-2 py-1 rounded-lg tabular-nums font-num ${isUp ? 'text-up bg-up/10 border border-up/20' : 'text-down bg-down/10 border border-down/20'}`}>
                                                {isUp ? '+' : ''}{q.dayChange.toFixed(2)}%
                                            </span>
                                        ) : <div className="w-12 h-5 shimmer rounded ml-auto" />}
                                    </div>
                                    <div className="col-span-2 flex justify-end">
                                        <button
                                            id={`buy-btn-${stock.symbol}`}
                                            onClick={e => { e.stopPropagation(); router.push(`/stock/${encodeURIComponent(stock.symbol)}`); }}
                                            className="px-3.5 py-1.5 text-xs font-bold text-[#003829] rounded-lg transition-all opacity-0 group-hover:opacity-100 translate-y-0.5 group-hover:translate-y-0"
                                            style={{ background: 'linear-gradient(135deg, #33c9dd, #22a9bc)' }}>
                                            Buy
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
