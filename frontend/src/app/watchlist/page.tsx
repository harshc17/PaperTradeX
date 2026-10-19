'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/dashboard/Header';
import { Star, TrendingUp, TrendingDown, Plus, Trash2 } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { API_URL } from '@/lib/config';

const DEFAULT_WATCHLIST = [
    { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
    { symbol: 'TCS.NS', name: 'TCS' },
    { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
    { symbol: 'INFY.NS', name: 'Infosys' },
    { symbol: 'ZOMATO.NS', name: 'Zomato' },
];

export default function WatchlistPage() {
    return <Suspense fallback={null}><WatchlistContent /></Suspense>;
}

function WatchlistContent() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const addedSymbol = (searchParams.get('added') || '').toUpperCase();
    const [watchlist, setWatchlist] = useState<{ symbol: string; name: string }[]>([]);
    const [quotes, setQuotes] = useState<Record<string, { price: number; change: number; dayChange: number }>>({});
    const [addInput, setAddInput] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);

    useEffect(() => {
        if (!authLoading && !user) router.push('/login');
    }, [user, authLoading]);

    useEffect(() => {
        const saved = localStorage.getItem('ptx_watchlist');
        const list = saved ? JSON.parse(saved) : DEFAULT_WATCHLIST;
        setWatchlist(list);
        const s = getSocket();
        list.forEach((item: any) => s.emit('subscribe', item.symbol));
        const onUpdate = (payload: Record<string, any>) => {
            setQuotes(prev => {
                const next = { ...prev };
                Object.entries(payload).forEach(([sym, d]: [string, any]) => {
                    if (typeof d?.price === 'number') next[sym] = { price: d.price, change: d.change ?? 0, dayChange: d.dayChange ?? 0 };
                });
                return next;
            });
        };
        s.on('market_update', onUpdate);
        return () => { s.off('market_update', onUpdate); };
    }, []);

    const saveWatchlist = (list: { symbol: string; name: string }[]) => {
        setWatchlist(list);
        localStorage.setItem('ptx_watchlist', JSON.stringify(list));
    };

    const removeFromWatchlist = (symbol: string) => saveWatchlist(watchlist.filter(w => w.symbol !== symbol));

    useEffect(() => {
        if (addInput.length < 2) { setSearchResults([]); return; }
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(addInput)}`);
                const data = await res.json();
                setSearchResults((data.quotes || []).slice(0, 5));
            } catch { setSearchResults([]); }
        }, 300);
        return () => clearTimeout(t);
    }, [addInput]);

    const addToWatchlist = (symbol: string, name: string) => {
        if (watchlist.find(w => w.symbol === symbol)) return;
        saveWatchlist([...watchlist, { symbol, name }]);
        getSocket().emit('subscribe', symbol);
        setAddInput(''); setSearchResults([]);
    };

    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="min-h-screen bg-transparent font-sans page-fade-in">
            <Header />
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center gap-2.5 mb-6">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Star className="w-4 h-4 text-primary" />
                    </div>
                    <h1 className="text-[24px] font-bold text-ink-heading font-heading">My Watchlist</h1>
                </div>

                {/* Add stock */}
                <div className="terminal-card p-5 mb-5 relative">
                    <label className="block text-[11px] font-bold text-ink-faint uppercase tracking-widest mb-2">Add a stock</label>
                    <input type="text" value={addInput} onChange={e => setAddInput(e.target.value)}
                        placeholder="Search by name or symbol (e.g. HDFC, Infosys)"
                        className="w-full px-4 py-2.5 border border-white/10 rounded-xl text-sm text-ink placeholder-[#5c6675] bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                    {searchResults.length > 0 && (
                        <div className="absolute top-full left-5 right-5 mt-1 bg-surface rounded-xl shadow-xl border border-white/10 overflow-hidden z-50">
                            {searchResults.map((r: any, i) => (
                                <div key={`${r.symbol}-${i}`}
                                    className="flex items-center justify-between px-4 py-3 hover:bg-surface-3 cursor-pointer border-b border-white/10/50 last:border-0 transition-colors"
                                    onClick={() => addToWatchlist(r.symbol, r.shortname || r.symbol)}>
                                    <div>
                                        <p className="text-sm font-semibold text-ink">{r.shortname || r.symbol}</p>
                                        <p className="text-xs text-ink-faint">{r.symbol}</p>
                                    </div>
                                    <span className="flex items-center gap-1 text-xs text-primary font-medium">
                                        <Plus className="w-3.5 h-3.5" /> Add
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Watchlist */}
                <div className="bg-surface rounded-[14px] border border-white/10 overflow-hidden shadow-soft">
                    {watchlist.length === 0 ? (
                        <div className="p-14 text-center">
                            <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Star className="w-8 h-8 text-primary/40" />
                            </div>
                            <p className="text-ink-faint text-sm">Your watchlist is empty. Add stocks above.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[#222c3a]/60">
                            {watchlist.map(item => {
                                const q = quotes[item.symbol];
                                const isUp = (q?.change ?? 0) >= 0;
                                const isAdded = addedSymbol && item.symbol.toUpperCase() === addedSymbol;
                                return (
                                    <div key={item.symbol}
                                        className={`flex items-center justify-between px-5 py-4 transition-colors group ${
                                            isAdded ? 'bg-primary/8 ring-1 ring-inset ring-primary/20' : 'hover:bg-surface-3'
                                        }`}>
                                        <div className="flex items-center gap-3 flex-1 cursor-pointer"
                                            onClick={() => router.push(`/stock/${encodeURIComponent(item.symbol)}`)}>
                                            <div className="w-9 h-9 rounded-xl bg-surface-3 border border-white/10 flex items-center justify-center text-xs font-bold text-ink-muted group-hover:border-primary/30 group-hover:text-primary transition-colors">
                                                {item.symbol.replace('.NS', '').substring(0, 2)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">{item.name}</p>
                                                <p className="text-xs text-ink-faint">{item.symbol} · NSE</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {q ? (
                                                <>
                                                    <div className="text-right">
                                                        <p className="text-sm font-bold text-ink-heading tabular-nums font-num">₹{fmt(q.price)}</p>
                                                        <div className={`flex items-center gap-1 justify-end text-xs font-semibold tabular-nums font-num ${isUp ? 'text-up' : 'text-down'}`}>
                                                            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                            {isUp ? '+' : ''}{q.dayChange.toFixed(2)}%
                                                        </div>
                                                    </div>
                                                    <span className={`text-xs font-bold px-2 py-1 rounded-lg tabular-nums font-num border ${isUp ? 'bg-up/10 text-up border-up/20' : 'bg-down/10 text-down border-down/20'}`}>
                                                        {isUp ? '+' : ''}{q.change.toFixed(2)}
                                                    </span>
                                                </>
                                            ) : (
                                                <div className="w-20 h-8 shimmer rounded-xl" />
                                            )}
                                            <button onClick={() => removeFromWatchlist(item.symbol)}
                                                className="p-1.5 rounded-lg text-[#2e3a4b] hover:text-down hover:bg-down/10 opacity-0 group-hover:opacity-100 transition-all">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
