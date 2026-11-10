'use client';
import CompanyLogo from '@/components/CompanyLogo';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { getSocket } from '@/lib/socket';

const STOCKS = [
    { symbol: 'RELIANCE.NS', name: 'Reliance' },
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

type QuoteData = { symbol: string; name: string; price: number; dayChange: number; change: number };

function resolveMoverQuote(quotes: Record<string, QuoteData>, symbol: string): QuoteData | undefined {
    const upper = symbol.toUpperCase();
    const bare = upper.replace(/\.(NS|BO)$/i, '');
    return quotes[upper] || quotes[bare] || quotes[`${bare}.NS`];
}

export default function MarketMovers({ sourceQuotes = {} }: { sourceQuotes?: Record<string, { price: number; change: number; dayChange: number }> }) {
    const router = useRouter();
    const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
    const [tab, setTab] = useState<'gainers' | 'losers'>('gainers');

    useEffect(() => {
        const s = getSocket();
        STOCKS.forEach(st => s.emit('subscribe', st.symbol));
        const onMarketUpdate = (payload: Record<string, any>) => {
            setQuotes(prev => {
                const next = { ...prev };
                Object.entries(payload).forEach(([sym, d]: [string, any]) => {
                    const normalizedSym = sym.endsWith('.NS') ? sym : `${sym}.NS`;
                    const meta = STOCKS.find(s => s.symbol === sym) || STOCKS.find(s => s.symbol === normalizedSym);
                    if (meta && typeof d?.price === 'number') {
                        next[meta.symbol] = { symbol: meta.symbol, name: meta.name, price: d.price, dayChange: d.dayChange ?? 0, change: d.change ?? 0 };
                    }
                });
                return next;
            });
        };

        s.on('market_update', onMarketUpdate);
        return () => { s.off('market_update', onMarketUpdate); };
    }, []);

    const resolved = STOCKS.map(st => {
        const q = resolveMoverQuote(quotes, st.symbol) || sourceQuotes[st.symbol];
        return q ? { ...q, symbol: st.symbol, name: st.name } : undefined;
    }).filter((q): q is QuoteData => Boolean(q));
    const sorted = resolved
        .filter(q => Number.isFinite(q.dayChange) && (tab === 'gainers' ? q.dayChange > 0 : q.dayChange < 0))
        .sort((a, b) => tab === 'gainers' ? b.dayChange - a.dayChange : a.dayChange - b.dayChange)
        .slice(0, 5);

    return (
        <div className="bg-surface rounded-2xl border border-line overflow-hidden shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-5 py-4 border-b border-line">
                <h2 className="text-base font-semibold text-ink-heading font-heading">Market movers</h2>
                <div role="tablist" aria-label="Market mover direction" className="flex bg-surface-2 border border-line rounded-xl p-0.5">
                    {(['gainers', 'losers'] as const).map(t => (
                        <button type="button" role="tab" id={`market-movers-${t}`} aria-selected={tab === t} aria-controls="market-movers-results" tabIndex={tab === t ? 0 : -1} key={t} onClick={() => setTab(t)}
                            onKeyDown={event => {
                                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                                event.preventDefault();
                                const next = event.key === 'Home' ? 'gainers' : event.key === 'End' ? 'losers' : t === 'gainers' ? 'losers' : 'gainers';
                                setTab(next);
                                event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#market-movers-${next}`)?.focus();
                            }}
                            className={`min-h-11 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${
                                tab === t ? 'bg-surface-3 text-primary border border-line' : 'text-ink-faint hover:text-ink-muted'
                            }`}>
                            {t === 'gainers' ? 'Gainers' : 'Losers'}
                        </button>
                    ))}
                </div>
            </div>

            <div id="market-movers-results" role="tabpanel" aria-labelledby={`market-movers-${tab}`} tabIndex={0} aria-label="Market movers" className="divide-y divide-line">
                {sorted.length > 0 ? sorted.map((q, idx) => {
                    const isUp = q.dayChange >= 0;
                    return (
                        <button type="button" key={q.symbol}
                            className="flex min-h-14 w-full items-center justify-between gap-2 px-3 sm:px-4 py-2.5 text-left hover:bg-surface-3 transition-colors group"
                            onClick={() => router.push(`/stock/${encodeURIComponent(q.symbol)}`)}>
                            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                                <span className="shrink-0 text-xs font-medium text-ink-faint w-4 font-num">{idx + 1}</span>
                                <CompanyLogo symbol={q.symbol} className="h-8 w-8" />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-ink group-hover:text-primary transition-colors" title={q.name}>{q.name}</p>
                                    <p className="text-xs text-ink-faint font-num">₹{q.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                            <span className={`shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg tabular-nums font-num ${
                                isUp ? 'bg-up/10 text-up border border-up/20' : 'bg-down/10 text-down border border-down/20'
                            }`}>
                                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {isUp ? '+' : ''}{q.dayChange.toFixed(2)}%
                            </span>
                        </button>
                    );
                }) : resolved.length > 0 ? (
                    <p className="px-4 py-6 text-sm text-ink-muted">No {tab} among the tracked stocks right now.</p>
                ) : (
                    [...Array(5)].map((_, i) => (
                        <div key={i} className="flex min-h-14 items-center justify-between gap-2 px-3 sm:px-4 py-2.5">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 shimmer rounded-xl" />
                                <div className="space-y-1.5">
                                    <div className="w-24 h-3.5 shimmer rounded" />
                                    <div className="w-16 h-3 shimmer rounded" />
                                </div>
                            </div>
                            <div className="w-16 h-7 shimmer rounded-xl" />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
