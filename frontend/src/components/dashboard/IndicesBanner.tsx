'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSocket } from '@/lib/socket';
import { API_URL } from '@/lib/config';

const INDICES = [
    { symbol: '^NSEI',       label: 'NIFTY 50'   },
    { symbol: '^BSESN',      label: 'SENSEX'     },
    { symbol: '^NSEBANK',    label: 'BANKNIFTY'  },
    { symbol: '^MIDCPNIFTY', label: 'MIDCPNIFTY' },
    { symbol: '^FINNIFTY',   label: 'FINNIFTY'   },
    { symbol: '^BANKEX',     label: 'BANKEX'     },
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
            fetch(`${API_URL}/api/indices`).then(r => r.ok ? r.json() : null)
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
        <div className="border-b border-line overflow-hidden" style={{ background: 'var(--bg)' }}>
            <div role="region" aria-label="Market indices" tabIndex={0} className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8 overflow-x-auto overscroll-x-contain no-scrollbar">
            <div className="flex w-max items-center gap-8 sm:gap-10">
                {INDICES.map(({ symbol, label }) => {
                    const q = quotes[symbol];
                    const isUp = (q?.change ?? 0) >= 0;
                    return (
                        <Link href={`/stock/${encodeURIComponent(symbol)}`} key={symbol}
                            className="shrink-0 min-h-12 py-3 flex items-center gap-2 hover:bg-surface-3 cursor-pointer transition-colors group">
                            <span className="text-[13px] sm:text-sm font-semibold text-ink-heading group-hover:text-ink transition-colors">{label}</span>
                            {q ? (
                                <div className="flex items-baseline gap-2 whitespace-nowrap">
                                    <span className="text-[13px] sm:text-sm font-medium text-ink tabular-nums font-num">{fmt(q.price)}</span>
                                    <span className={`text-[13px] sm:text-sm font-medium tabular-nums font-num ${isUp ? 'text-up' : 'text-down'}`}>
                                        {q.change < 0 ? '−' : ''}{fmt(Math.abs(q.change))} ({q.dayChange < 0 ? '−' : ''}{Math.abs(q.dayChange).toFixed(2)}%)
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
        </div>
    );
}
