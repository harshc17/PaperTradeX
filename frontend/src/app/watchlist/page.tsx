'use client';
import { apiFetch as fetch } from '@/lib/backend';

import CompanyLogo from '@/components/CompanyLogo';
import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/dashboard/Header';
import { Star, TrendingUp, TrendingDown, Plus, Trash2 } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import { API_URL } from '@/lib/config';
import { stockQuote } from '@/lib/stockQuote';

const DEFAULT_WATCHLIST = [
    { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
    { symbol: 'TCS.NS', name: 'TCS' },
    { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
    { symbol: 'INFY.NS', name: 'Infosys' },
    { symbol: 'ETERNAL.NS', name: 'Eternal (Zomato)' },
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
    const portfolio = usePortfolio();
    const { watchSymbol } = portfolio;
    const quotes: Record<string, { price: number; change: number; dayChange: number }> = {};
    for (const item of watchlist) {
        const quote = stockQuote(portfolio, item.symbol);
        if (quote.price !== null) quotes[item.symbol] = { price: quote.price, change: quote.change, dayChange: quote.percent };
    }
    useEffect(() => { const stop = watchlist.map(s => watchSymbol(s.symbol)); return () => stop.forEach(fn => fn()); }, [watchlist, watchSymbol]);
    const [addInput, setAddInput] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [syncError, setSyncError] = useState('');
    const [watchlistReady, setWatchlistReady] = useState(false);
    const syncQueue = useRef<Promise<void>>(Promise.resolve());
    const activeUser = useRef('');

    useEffect(() => {
        if (!authLoading && !user) router.push('/login');
    }, [user, authLoading]);

    useEffect(() => {
        setWatchlist([]);
        setWatchlistReady(false); setSyncError('');
        activeUser.current = String(user?.id || '');
        if (!user?.id) return;
        let cancelled = false;
        const key = `ptx_watchlist_${user.id}`;
        const token = localStorage.getItem('ptx_token') || localStorage.getItem('token');
        let local = DEFAULT_WATCHLIST;
        try {
            const legacyOwner = localStorage.getItem('ptx_watchlist_owner');
            const saved = localStorage.getItem(key) || (!legacyOwner || legacyOwner === String(user.id) ? localStorage.getItem('ptx_watchlist') : null);
            const parsed = saved ? JSON.parse(saved) : null;
            if (Array.isArray(parsed) && parsed.length <= 100 && parsed.every(row => typeof row.symbol === 'string' && /^[A-Z0-9^.&-]{1,30}$/.test(row.symbol))) local = parsed;
        } catch { /* Invalid browser cache never replaces the account watchlist. */ }
        async function load() {
            try {
                const response = await fetch(`${API_URL}/api/watchlist`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
                if (!response.ok) throw Error('Unable to load the synced watchlist.');
                const data = await response.json();
                if (cancelled) return;
                const list = data.initialized ? data.symbols.map((symbol: string) => ({ symbol, name: local.find(row => row.symbol === symbol)?.name || symbol.replace(/\.(NS|BO)$/, '') })) : local;
                if (!data.initialized) {
                    const saved = await fetch(`${API_URL}/api/watchlist`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ symbols: list.map((row: { symbol: string }) => row.symbol) }) });
                    if (!saved.ok) throw Error('Unable to sync the browser watchlist.');
                }
                if (cancelled) return;
                setWatchlist(list); setSyncError('');
                localStorage.setItem(key, JSON.stringify(list));
                localStorage.setItem('ptx_watchlist_owner', String(user!.id));
            } catch { if (!cancelled) { setWatchlist(local); setSyncError('Showing this browser’s watchlist. Account sync is unavailable; AI may not see these changes yet.'); } }
            finally { if (!cancelled) setWatchlistReady(true); }
        }
        void load();
        return () => { cancelled = true; };
    }, [user?.id]);

    const saveWatchlist = (list: { symbol: string; name: string }[]) => {
        if (!user?.id || !watchlistReady) return;
        setWatchlist(list);
        localStorage.setItem(`ptx_watchlist_${user.id}`, JSON.stringify(list));
        const token = localStorage.getItem('ptx_token') || localStorage.getItem('token');
        const owner = String(user.id);
        syncQueue.current = syncQueue.current.then(async () => {
            try {
                const response = await fetch(`${API_URL}/api/watchlist`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ symbols: list.map(row => row.symbol) }) });
                if (!response.ok) throw Error('Sync unavailable');
                if (activeUser.current === owner) setSyncError('');
            } catch { if (activeUser.current === owner) setSyncError('Saved in this browser. Account sync is unavailable; AI may not see these changes yet.'); }
        });
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
        setAddInput(''); setSearchResults([]);
    };

    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="min-h-screen bg-transparent font-sans page-fade-in">
            <Header />
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {syncError && <p role="status" className="mb-4 text-sm text-ink-muted">{syncError}</p>}
                <div className="flex items-center gap-2.5 mb-6">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Star className="w-4 h-4 text-primary" />
                    </div>
                    <h1 className="text-[24px] font-medium text-ink-heading font-heading">Watchlist</h1>
                </div>

                {/* Add stock */}
                <div className="terminal-card p-5 mb-5 relative">
                    <label className="block text-xs font-medium text-ink-faint mb-2">Add a stock</label>
                    <input type="text" value={addInput} disabled={!watchlistReady} onChange={e => setAddInput(e.target.value)}
                        placeholder="Search by name or symbol (e.g. HDFC, Infosys)"
                        className="w-full px-4 py-2.5 border border-line rounded-xl text-sm text-ink placeholder-[var(--text-faint)] bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
                    {searchResults.length > 0 && (
                        <div className="absolute top-full left-5 right-5 mt-1 bg-surface rounded-xl shadow-none border border-line overflow-hidden z-50">
                            {searchResults.map((r: any, i) => (
                                <div key={`${r.symbol}-${i}`}
                                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-3 cursor-pointer border-b border-line last:border-0 transition-colors"
                                    onClick={() => addToWatchlist(r.symbol, r.shortname || r.symbol)}>
                                    <div className="flex min-w-0 items-center gap-2">
                                        <CompanyLogo symbol={r.symbol} className="h-8 w-8" />
                                        <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-ink" title={r.shortname || r.symbol}>{r.shortname || r.symbol}</p>
                                        <p className="text-xs text-ink-faint">{r.symbol}</p>
                                        </div>
                                    </div>
                                    <span className="flex shrink-0 items-center gap-1 text-xs text-primary font-medium">
                                        <Plus className="w-3.5 h-3.5" /> Add
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Watchlist */}
                <div className="bg-surface rounded-2xl border border-line overflow-hidden shadow-none">
                    {watchlist.length === 0 ? (
                        <div className="p-14 text-center">
                            <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Star className="w-8 h-8 text-primary" />
                            </div>
                            <p className="text-ink-faint text-sm">Your watchlist is empty. Add stocks above.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-line">
                            {watchlist.map(item => {
                                const q = quotes[item.symbol];
                                const isUp = (q?.change ?? 0) >= 0;
                                const isAdded = addedSymbol && item.symbol.toUpperCase() === addedSymbol;
                                return (
                                    <div key={item.symbol}
                                        className={`grid grid-cols-1 gap-3 px-4 sm:px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center transition-colors group ${
                                            isAdded ? 'bg-primary/8 ring-1 ring-inset ring-primary/20' : 'hover:bg-surface-3'
                                        }`}>
                                        <div className="flex min-w-0 items-center gap-3 cursor-pointer"
                                            onClick={() => router.push(`/stock/${encodeURIComponent(item.symbol)}`)}>
                                            <CompanyLogo symbol={item.symbol} className="h-9 w-9" />
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-ink group-hover:text-primary transition-colors" title={item.name}>{item.name}</p>
                                                <p className="truncate text-xs text-ink-faint">{item.symbol} · {item.symbol.toUpperCase().endsWith('.BO') ? 'BSE' : 'NSE'}</p>
                                            </div>
                                        </div>
                                        <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-end sm:gap-4">
                                            {q ? (
                                                <>
                                                    <div className="text-right">
                                                        <p className="text-sm font-medium text-ink-heading tabular-nums font-num">₹{fmt(q.price)}</p>
                                                        <div className={`flex items-center gap-1 justify-end text-xs font-semibold tabular-nums font-num ${isUp ? 'text-up' : 'text-down'}`}>
                                                            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                            {isUp ? '+' : ''}{q.dayChange.toFixed(2)}%
                                                        </div>
                                                    </div>
                                                    <span className={`text-xs font-medium px-2 py-1 rounded-lg tabular-nums font-num border ${isUp ? 'bg-up/10 text-up border-up/20' : 'bg-down/10 text-down border-down/20'}`}>
                                                        {isUp ? '+' : ''}{q.change.toFixed(2)}
                                                    </span>
                                                </>
                                            ) : (
                                                <div className="w-20 h-8 shimmer rounded-xl" />
                                            )}
                                            <button onClick={() => removeFromWatchlist(item.symbol)}
                                                aria-label={`Remove ${item.symbol} from watchlist`}
                                                className="shrink-0 min-h-11 min-w-11 grid place-items-center p-1.5 rounded-lg text-ink-muted hover:text-down hover:bg-down/10 opacity-100 transition-colors">
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
