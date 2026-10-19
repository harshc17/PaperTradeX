'use client';
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

export default function MarketMovers() {
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

    const resolved = STOCKS.map(st => resolveMoverQuote(quotes, st.symbol)).filter((q): q is QuoteData => Boolean(q));
    const sorted = resolved.sort((a, b) => tab === 'gainers' ? b.dayChange - a.dayChange : a.dayChange - b.dayChange).slice(0, 5);

    return (
        <div className="bg-surface rounded-[14px] border border-white/10 overflow-hidden shadow-soft">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h2 className="text-[15px] font-semibold text-ink-heading font-heading">Market Movers</h2>
                <div className="flex bg-surface-2 border border-white/10 rounded-xl p-0.5">
                    {(['gainers', 'losers'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize ${
                                tab === t ? 'bg-surface-3 text-primary border border-white/10' : 'text-ink-faint hover:text-ink-muted'
                            }`}>
                            {t === 'gainers' ? 'Top Gainers' : 'Top Losers'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="divide-y divide-[#222c3a]/60">
                {sorted.length > 0 ? sorted.map((q, idx) => {
                    const isUp = q.dayChange >= 0;
                    return (
                        <div key={q.symbol}
                            className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-3 transition-colors cursor-pointer group"
                            onClick={() => router.push(`/stock/${encodeURIComponent(q.symbol)}`)}>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-ink-faint w-4 font-num">{idx + 1}</span>
                                <div className="w-8 h-8 rounded-xl bg-surface-3 border border-white/10 flex items-center justify-center text-[9px] font-bold text-ink-muted group-hover:text-primary group-hover:border-primary/30 transition-colors">
                                    {q.symbol.replace('.NS', '').substring(0, 2)}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">{q.name}</p>
                                    <p className="text-[10px] text-ink-faint font-num">₹{q.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                            <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl tabular-nums font-num ${
                                isUp ? 'bg-up/10 text-up border border-up/20' : 'bg-down/10 text-down border border-down/20'
                            }`}>
                                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {isUp ? '+' : ''}{q.dayChange.toFixed(2)}%
                            </span>
                        </div>
                    );
                }) : (
                    [...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between px-5 py-3.5">
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
