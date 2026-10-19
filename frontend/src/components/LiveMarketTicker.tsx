'use client';
import { useEffect, useMemo, useState } from 'react';
import { getSocket } from '@/lib/socket';

type Quote = { symbol: string; shortname?: string; price?: number; change?: number; dayChange?: number; };

const DEFAULT_SYMBOLS = ['^NSEI', '^BSESN', '^NSEBANK', 'TCS.NS', 'RELIANCE.NS', 'HDFCBANK.NS', 'INFY.NS'];

export default function LiveMarketTicker() {
    const [quotes, setQuotes] = useState<Record<string, Quote>>({});
    const [inputSymbol, setInputSymbol] = useState('');

    useEffect(() => {
        const s = getSocket();
        DEFAULT_SYMBOLS.forEach(sym => s.emit('subscribe', sym));
        const onUpdate = (payload: Record<string, Quote>) => setQuotes(prev => ({ ...prev, ...payload }));
        s.on('market_update', onUpdate);
        return () => { s.off('market_update', onUpdate); };
    }, []);

    const sortedQuotes = useMemo(() => Object.values(quotes).sort((a, b) => (a.symbol || '').localeCompare(b.symbol || '')), [quotes]);

    const handleAddSymbol = () => {
        const raw = inputSymbol.trim().toUpperCase();
        if (!raw) return;
        getSocket().emit('subscribe', raw);
        setInputSymbol('');
    };

    return (
        <div className="bg-surface border border-white/10 rounded-xl p-4 shadow-soft">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-ink-heading font-heading">Live Market <span className="text-ink-faint font-normal text-xs">(≈1s updates)</span></h2>
                <div className="flex gap-2">
                    <input value={inputSymbol} onChange={e => setInputSymbol(e.target.value)}
                        placeholder="Add symbol..."
                        className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-surface-2 text-ink placeholder-[#5c6675] focus:outline-none focus:ring-1 focus:ring-primary/40" />
                    <button onClick={handleAddSymbol}
                        className="text-xs px-3 py-1 rounded-lg text-[#003829] font-bold transition-colors"
                        style={{ background: 'linear-gradient(135deg, #33c9dd, #22a9bc)' }}>
                        Add
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                    <thead>
                        <tr className="text-ink-faint border-b border-white/10 text-[10px] uppercase tracking-widest">
                            <th className="text-left py-2 pr-4">Symbol</th>
                            <th className="text-left py-2 pr-4">Name</th>
                            <th className="text-right py-2 pr-4">Last</th>
                            <th className="text-right py-2 pr-4">Change</th>
                            <th className="text-right py-2">Day %</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedQuotes.map(q => {
                            const change = q.change ?? 0;
                            const pct = q.dayChange ?? 0;
                            const isUp = change >= 0;
                            return (
                                <tr key={q.symbol} className="border-b border-white/10/50 last:border-0 hover:bg-surface-3 transition-colors">
                                    <td className="py-2 pr-4 font-bold text-[11px] text-ink font-num">{q.symbol}</td>
                                    <td className="py-2 pr-4 text-[11px] text-ink-faint max-w-[150px] truncate">{q.shortname || '-'}</td>
                                    <td className="py-2 pr-4 text-right text-[11px] text-ink tabular-nums font-num">{q.price != null ? q.price.toFixed(2) : '-'}</td>
                                    <td className={`py-2 pr-4 text-right text-[11px] tabular-nums font-num ${isUp ? 'text-up' : 'text-down'}`}>
                                        {change >= 0 ? '+' : ''}{change.toFixed(2)}
                                    </td>
                                    <td className={`py-2 text-right text-[11px] tabular-nums font-num ${isUp ? 'text-up' : 'text-down'}`}>
                                        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                                    </td>
                                </tr>
                            );
                        })}
                        {sortedQuotes.length === 0 && (
                            <tr><td colSpan={5} className="py-4 text-center text-xs text-ink-faint">Waiting for live ticks...</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
