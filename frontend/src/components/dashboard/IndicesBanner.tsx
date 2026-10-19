'use client';
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { getSocket } from '@/lib/socket';

const INDICES = [
    { symbol: '^NSEI',       label: 'NIFTY 50'   },
    { symbol: '^BSESN',      label: 'SENSEX'     },
    { symbol: '^NSEBANK',    label: 'BANKNIFTY'  },
    { symbol: '^MIDCPNIFTY', label: 'MIDCPNIFTY' },
    { symbol: '^FINNIFTY',   label: 'FINNIFTY'   },
];

export default function IndicesBanner() {
    const [quotes, setQuotes] = useState<Record<string, { price: number; change: number; dayChange: number }>>({});

    useEffect(() => {
        const s = getSocket();
        INDICES.forEach(i => s.emit('subscribe', i.symbol));

        const applyQuote = (sym: string, d: any) => {
            if (typeof d?.price !== 'number') return;
            setQuotes(prev => ({ ...prev, [sym]: { price: d.price, change: d.change ?? 0, dayChange: d.dayChange ?? 0 } }));
        };

        const onUpdate = (payload: Record<string, any>) => Object.entries(payload).forEach(([sym, d]: [string, any]) => applyQuote(sym, d));
        const onPriceTick = (tick: Record<string, any>) => { if (typeof tick?.symbol === 'string') applyQuote(tick.symbol, tick); };

        s.on('market_update', onUpdate);
        s.on('price_tick', onPriceTick);

        const fetchIndices = () =>
            fetch('http://localhost:3001/api/indices').then(r => r.ok ? r.json() : null)
                .then(data => {
                    if (!data) return;
                    setQuotes(prev => {
                        const next = { ...prev };
                        Object.entries(data).forEach(([sym, d]: [string, any]) => {
                            if (typeof d?.price === 'number') next[sym] = { price: d.price, change: d.change ?? 0, dayChange: d.dayChange ?? 0 };
                        });
                        return next;
                    });
                }).catch(() => {});

        fetchIndices();
        const refreshTimer = setInterval(fetchIndices, 10000);
        return () => { s.off('market_update', onUpdate); s.off('price_tick', onPriceTick); clearInterval(refreshTimer); };
    }, []);

    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="border-b border-white/10 overflow-hidden" style={{ background: 'rgba(13, 19, 28, 0.80)' }}>
            <div className="flex items-center divide-x divide-[#222c3a] overflow-x-auto no-scrollbar">
                {INDICES.map(({ symbol, label }) => {
                    const q = quotes[symbol];
                    const isUp = (q?.change ?? 0) >= 0;
                    return (
                        <Link href={`/stock/${encodeURIComponent(symbol)}`} key={symbol}
                            className="flex-shrink-0 px-6 py-2.5 flex items-center gap-4 hover:bg-surface-3 cursor-pointer transition-colors group">
                            <span className="text-[10px] font-bold text-ink-faint uppercase tracking-widest group-hover:text-ink-muted transition-colors">{label}</span>
                            {q ? (
                                <div className="flex items-baseline gap-2">
                                    <span className="text-sm font-bold text-ink tabular-nums font-num">{fmt(q.price)}</span>
                                    <span className={`text-xs font-semibold flex items-center gap-0.5 tabular-nums font-num ${isUp ? 'text-up' : 'text-down'}`}>
                                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {isUp ? '+' : ''}{q.dayChange.toFixed(2)}%
                                    </span>
                                </div>
                            ) : (
                                <div className="w-28 h-4 shimmer rounded" />
                            )}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
