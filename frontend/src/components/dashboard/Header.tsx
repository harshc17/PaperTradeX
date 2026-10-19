'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Bell, TrendingUp, LogOut, ChevronDown, X, History, Clock, Calendar, Zap, Info, ShieldCheck } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import { API_URL } from '@/lib/config';

// Comprehensive local stock index for instant zero-latency search.
const QUICK_SYMBOLS = [
    // Nifty 50
    { symbol: 'RELIANCE.NS', shortname: 'Reliance Industries', exchange: 'NSE' },
    { symbol: 'TCS.NS', shortname: 'Tata Consultancy Services', exchange: 'NSE' },
    { symbol: 'HDFCBANK.NS', shortname: 'HDFC Bank', exchange: 'NSE' },
    { symbol: 'INFY.NS', shortname: 'Infosys', exchange: 'NSE' },
    { symbol: 'ICICIBANK.NS', shortname: 'ICICI Bank', exchange: 'NSE' },
    { symbol: 'SBIN.NS', shortname: 'State Bank of India', exchange: 'NSE' },
    { symbol: 'BHARTIARTL.NS', shortname: 'Bharti Airtel', exchange: 'NSE' },
    { symbol: 'ITC.NS', shortname: 'ITC Limited', exchange: 'NSE' },
    { symbol: 'LT.NS', shortname: 'Larsen and Toubro', exchange: 'NSE' },
    { symbol: 'BAJFINANCE.NS', shortname: 'Bajaj Finance', exchange: 'NSE' },
    { symbol: 'HINDUNILVR.NS', shortname: 'Hindustan Unilever', exchange: 'NSE' },
    { symbol: 'MARUTI.NS', shortname: 'Maruti Suzuki', exchange: 'NSE' },
    { symbol: 'SUNPHARMA.NS', shortname: 'Sun Pharmaceutical', exchange: 'NSE' },
    { symbol: 'AXISBANK.NS', shortname: 'Axis Bank', exchange: 'NSE' },
    { symbol: 'KOTAKBANK.NS', shortname: 'Kotak Mahindra Bank', exchange: 'NSE' },
    { symbol: 'TITAN.NS', shortname: 'Titan Company', exchange: 'NSE' },
    { symbol: 'ULTRACEMCO.NS', shortname: 'UltraTech Cement', exchange: 'NSE' },
    { symbol: 'TATAMOTORS.NS', shortname: 'Tata Motors', exchange: 'NSE' },
    { symbol: 'NTPC.NS', shortname: 'NTPC Limited', exchange: 'NSE' },
    { symbol: 'POWERGRID.NS', shortname: 'Power Grid Corporation', exchange: 'NSE' },
    { symbol: 'M&M.NS', shortname: 'Mahindra and Mahindra', exchange: 'NSE' },
    { symbol: 'ONGC.NS', shortname: 'Oil and Natural Gas Corporation', exchange: 'NSE' },
    { symbol: 'TRENT.NS', shortname: 'Trent Limited', exchange: 'NSE' },
    { symbol: 'BEL.NS', shortname: 'Bharat Electronics', exchange: 'NSE' },
    { symbol: 'COALINDIA.NS', shortname: 'Coal India', exchange: 'NSE' },
    { symbol: 'TATASTEEL.NS', shortname: 'Tata Steel', exchange: 'NSE' },
    { symbol: 'ADANIENT.NS', shortname: 'Adani Enterprises', exchange: 'NSE' },
    { symbol: 'ADANIPORTS.NS', shortname: 'Adani Ports SEZ', exchange: 'NSE' },
    { symbol: 'JSWSTEEL.NS', shortname: 'JSW Steel', exchange: 'NSE' },
    { symbol: 'HCLTECH.NS', shortname: 'HCL Technologies', exchange: 'NSE' },
    { symbol: 'BAJAJ-AUTO.NS', shortname: 'Bajaj Auto', exchange: 'NSE' },
    { symbol: 'BAJAJFINSV.NS', shortname: 'Bajaj Finserv', exchange: 'NSE' },
    { symbol: 'TECHM.NS', shortname: 'Tech Mahindra', exchange: 'NSE' },
    { symbol: 'ASIANPAINT.NS', shortname: 'Asian Paints', exchange: 'NSE' },
    { symbol: 'NESTLEIND.NS', shortname: 'Nestle India', exchange: 'NSE' },
    { symbol: 'CIPLA.NS', shortname: 'Cipla', exchange: 'NSE' },
    { symbol: 'DRREDDY.NS', shortname: 'Dr Reddys Laboratories', exchange: 'NSE' },
    { symbol: 'WIPRO.NS', shortname: 'Wipro', exchange: 'NSE' },
    { symbol: 'APOLLOHOSP.NS', shortname: 'Apollo Hospitals', exchange: 'NSE' },
    { symbol: 'BRITANNIA.NS', shortname: 'Britannia Industries', exchange: 'NSE' },
    { symbol: 'SBILIFE.NS', shortname: 'SBI Life Insurance', exchange: 'NSE' },
    { symbol: 'HDFCLIFE.NS', shortname: 'HDFC Life Insurance', exchange: 'NSE' },
    { symbol: 'HINDALCO.NS', shortname: 'Hindalco Industries', exchange: 'NSE' },
    { symbol: 'BPCL.NS', shortname: 'Bharat Petroleum', exchange: 'NSE' },
    { symbol: 'LTIM.NS', shortname: 'LTIMindtree', exchange: 'NSE' },
    { symbol: 'EICHERMOT.NS', shortname: 'Eicher Motors', exchange: 'NSE' },
    { symbol: 'GRASIM.NS', shortname: 'Grasim Industries', exchange: 'NSE' },
    { symbol: 'SHRIRAMFIN.NS', shortname: 'Shriram Finance', exchange: 'NSE' },
    { symbol: 'DIVISLAB.NS', shortname: 'Divis Laboratories', exchange: 'NSE' },
    { symbol: 'INDUSINDBK.NS', shortname: 'IndusInd Bank', exchange: 'NSE' },
    // Mid/Large Caps
    { symbol: 'JIOFIN.NS', shortname: 'Jio Financial Services', exchange: 'NSE' },
    { symbol: 'ZOMATO.NS', shortname: 'Zomato', exchange: 'NSE' },
    { symbol: 'HAL.NS', shortname: 'Hindustan Aeronautics', exchange: 'NSE' },
    { symbol: 'VEDL.NS', shortname: 'Vedanta', exchange: 'NSE' },
    { symbol: 'IRFC.NS', shortname: 'Indian Railway Finance Corporation', exchange: 'NSE' },
    { symbol: 'IRCTC.NS', shortname: 'Indian Railway Catering and Tourism', exchange: 'NSE' },
    { symbol: 'TATAPOWER.NS', shortname: 'Tata Power', exchange: 'NSE' },
    { symbol: 'BHEL.NS', shortname: 'Bharat Heavy Electricals', exchange: 'NSE' },
    { symbol: 'RECLTD.NS', shortname: 'REC Limited', exchange: 'NSE' },
    { symbol: 'PFC.NS', shortname: 'Power Finance Corporation', exchange: 'NSE' },
    { symbol: 'BANKBARODA.NS', shortname: 'Bank of Baroda', exchange: 'NSE' },
    { symbol: 'PNB.NS', shortname: 'Punjab National Bank', exchange: 'NSE' },
    { symbol: 'IOC.NS', shortname: 'Indian Oil Corporation', exchange: 'NSE' },
    { symbol: 'GAIL.NS', shortname: 'GAIL India', exchange: 'NSE' },
    { symbol: 'DLF.NS', shortname: 'DLF Limited', exchange: 'NSE' },
    { symbol: 'ADANIPOWER.NS', shortname: 'Adani Power', exchange: 'NSE' },
    { symbol: 'ADANIGREEN.NS', shortname: 'Adani Green Energy', exchange: 'NSE' },
    { symbol: 'SUZLON.NS', shortname: 'Suzlon Energy', exchange: 'NSE' },
    { symbol: 'RVNL.NS', shortname: 'Rail Vikas Nigam', exchange: 'NSE' },
    { symbol: 'DMART.NS', shortname: 'Avenue Supermarts DMart', exchange: 'NSE' },
    { symbol: 'MRF.NS', shortname: 'MRF', exchange: 'NSE' },
    { symbol: 'PAYTM.NS', shortname: 'One 97 Communications Paytm', exchange: 'NSE' },
    { symbol: 'SWIGGY.NS', shortname: 'Swiggy', exchange: 'NSE' },
    { symbol: 'PIDILITIND.NS', shortname: 'Pidilite Industries', exchange: 'NSE' },
    { symbol: 'HAVELLS.NS', shortname: 'Havells India', exchange: 'NSE' },
    { symbol: 'SIEMENS.NS', shortname: 'Siemens India', exchange: 'NSE' },
    { symbol: 'ABB.NS', shortname: 'ABB India', exchange: 'NSE' },
    { symbol: 'POLYCAB.NS', shortname: 'Polycab India', exchange: 'NSE' },
    { symbol: 'DIXON.NS', shortname: 'Dixon Technologies', exchange: 'NSE' },
    { symbol: 'PERSISTENT.NS', shortname: 'Persistent Systems', exchange: 'NSE' },
    { symbol: 'COFORGE.NS', shortname: 'Coforge', exchange: 'NSE' },
    { symbol: 'MAXHEALTH.NS', shortname: 'Max Healthcare', exchange: 'NSE' },
    { symbol: 'FORTIS.NS', shortname: 'Fortis Healthcare', exchange: 'NSE' },
    { symbol: 'LUPIN.NS', shortname: 'Lupin', exchange: 'NSE' },
    { symbol: 'MAZDOCK.NS', shortname: 'Mazagon Dock Shipbuilders', exchange: 'NSE' },
    // BSE-listed stocks
    { symbol: 'NSE.BO', shortname: 'National Stock Exchange of India', exchange: 'BSE' },
    { symbol: 'BSE.BO', shortname: 'BSE Limited', exchange: 'BSE' },
    { symbol: 'CDSL.BO', shortname: 'Central Depository Services', exchange: 'BSE' },
    { symbol: 'MCX.BO', shortname: 'Multi Commodity Exchange', exchange: 'BSE' },
    // Indices
    { symbol: '^NSEI', shortname: 'NIFTY 50', exchange: 'NSE' },
    { symbol: '^BSESN', shortname: 'SENSEX', exchange: 'BSE' },
    { symbol: '^NSEBANK', shortname: 'BANK NIFTY', exchange: 'NSE' },
    { symbol: '^NSMIDCP100', shortname: 'NIFTY MIDCAP 100', exchange: 'NSE' },
    { symbol: '^CNXIT', shortname: 'NIFTY IT', exchange: 'NSE' },
    { symbol: '^CNXFIN', shortname: 'FINNIFTY', exchange: 'NSE' },
    // ETFs
    { symbol: 'NIFTYBEES.NS', shortname: 'Nippon India Nifty BeES ETF', exchange: 'NSE' },
    { symbol: 'GOLDBEES.NS', shortname: 'Nippon India Gold BeES ETF', exchange: 'NSE' },
    { symbol: 'BANKBEES.NS', shortname: 'Nippon India Bank BeES ETF', exchange: 'NSE' },
    { symbol: 'CPSEETF.NS', shortname: 'CPSE ETF', exchange: 'NSE' },
    { symbol: 'LIQUIDBEES.NS', shortname: 'Nippon India Liquid BeES ETF', exchange: 'NSE' },
];

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, balance, logout, refreshBalance } = useAuth();
    const { marketStatus, marketOpen } = usePortfolio();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showMarketModal, setShowMarketModal] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
    const [localResults, setLocalResults] = useState<any[]>([]);
    const searchRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const marketModalRef = useRef<HTMLDivElement>(null);
    const searchAbortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        refreshBalance();
    }, [refreshBalance]);

    // Live countdown timer that updates every second
    useEffect(() => {
        if (marketStatus) {
            setSecondsLeft(marketStatus.isOpen ? marketStatus.secondsUntilClose : marketStatus.secondsUntilOpen);
        }
    }, [marketStatus]);

    useEffect(() => {
        if (secondsLeft === null || secondsLeft <= 0) return;
        const interval = setInterval(() => {
            setSecondsLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, [secondsLeft]);

    const formatRemaining = (totalSec: number | null) => {
        if (totalSec === null || totalSec <= 0) return '0s';
        const d = Math.floor(totalSec / 86400);
        const h = Math.floor((totalSec % 86400) / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    useEffect(() => {
        const fetchResults = async () => {
            if (searchQuery.length < 1) { setSearchResults([]); setLocalResults([]); return; }
            const q = searchQuery.toLowerCase().trim();
            const instant = QUICK_SYMBOLS.filter(item =>
                item.symbol.toLowerCase().includes(q) || item.shortname.toLowerCase().includes(q)
            ).slice(0, 5);
            setLocalResults(instant);
            if (searchAbortRef.current) searchAbortRef.current.abort();
            const controller = new AbortController();
            searchAbortRef.current = controller;
            try {
                const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(searchQuery)}`, { signal: controller.signal });
                const data = await res.json();
                setSearchResults((data.quotes || []).slice(0, 8));
            } catch (error) {
                if ((error as any)?.name !== 'AbortError') console.error('Search error:', error);
            }
        };
        const t = setTimeout(fetchResults, 80);
        return () => clearTimeout(t);
    }, [searchQuery]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
            if (marketModalRef.current && !marketModalRef.current.contains(e.target as Node)) setShowMarketModal(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => { logout(); router.push('/login'); };

    const navItems = [
        { name: 'Explore', href: '/dashboard' },
        { name: 'Holdings', href: '/holdings' },
        { name: 'Orders', href: '/orders' },
        { name: 'Transactions', href: '/transactions' },
        { name: 'Watchlist', href: '/watchlist' },
        { name: 'Weekly Challenge', href: '/challenge' },
    ];

    const fmtBalance = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

    return (
        <header className="sticky top-0 z-40 flex flex-col border-b border-white/10"
            style={{ background: 'rgba(10, 14, 20, 0.88)', backdropFilter: 'saturate(160%) blur(18px)', WebkitBackdropFilter: 'saturate(160%) blur(18px)' }}>

            {/* Top row */}
            <div className="flex items-center justify-between px-4 lg:px-6 py-3 gap-4">
                {/* Logo */}
                <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0 group">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:rotate-3"
                        style={{ background: 'linear-gradient(135deg, #33c9dd, #22a9bc)', boxShadow: '0 0 18px rgba(51,201,221,0.30)' }}>
                        <TrendingUp className="h-5 w-5 text-[#003829]" />
                    </div>
                    <span className="text-base font-bold tracking-tight text-ink-heading hidden sm:block font-heading">PaperTradeX</span>
                </Link>

                {/* Search */}
                <div className="flex-1 max-w-xl relative" ref={searchRef}>
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            id="stock-search-input"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onFocus={() => setShowResults(true)}
                            placeholder="Search stocks, ETFs, indices..."
                            className="w-full pl-10 pr-10 py-2.5 border border-white/10 rounded-xl bg-surface text-ink placeholder-[#5c6675] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                        />
                        {searchQuery && (
                            <button onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Search dropdown */}
                    {showResults && searchQuery.length >= 1 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-surface rounded-xl shadow-xl border border-white/10 overflow-hidden max-h-80 overflow-y-auto z-50">
                            {(() => {
                                const seen = new Set<string>();
                                const combined: any[] = [];
                                for (const item of [...localResults, ...searchResults]) {
                                    const key = String(item.symbol || '').toUpperCase();
                                    if (key && !seen.has(key)) {
                                        seen.add(key);
                                        combined.push(item);
                                    }
                                }
                                if (combined.length === 0) {
                                    return <div className="px-4 py-6 text-center text-sm text-ink-faint">No results found</div>;
                                }
                                return (
                                    <>
                                        <div className="px-3 py-2 bg-surface-2 border-b border-white/10">
                                            <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-widest">Search Results</p>
                                        </div>
                                        {combined.slice(0, 10).map((result: any, i: number) => (
                                            <div key={`${result.symbol}-${i}`}
                                                className="px-4 py-3 hover:bg-surface-3 cursor-pointer flex justify-between items-center group transition-colors border-b border-white/10/50 last:border-0"
                                                onClick={() => { router.push(`/stock/${encodeURIComponent(result.symbol)}`); setSearchQuery(''); setShowResults(false); }}>
                                                <div>
                                                    <div className="font-semibold text-ink text-sm">{result.shortname || result.name || result.symbol}</div>
                                                    <div className="text-xs text-ink-faint flex items-center gap-2 mt-0.5">
                                                        {result.exchange && <span className="bg-surface-3 text-ink-muted px-1.5 py-0.5 rounded text-[10px] font-medium">{result.exchange}</span>}
                                                        <span>{result.symbol}</span>
                                                    </div>
                                                </div>
                                                <span className="text-xs text-ink-faint group-hover:text-primary transition-colors">→</span>
                                            </div>
                                        ))}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>

                {/* Right actions */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Market Status Pill */}
                    <button
                        type="button"
                        onClick={() => setShowMarketModal(true)}
                        className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                            marketStatus?.isOpen
                                ? 'bg-up/10 text-up border-up/30 hover:bg-up/15 shadow-[0_0_12px_rgba(38,208,124,0.15)]'
                                : marketStatus?.session === 'PRE_MARKET'
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/15'
                                : 'bg-surface-2 text-ink-muted border-white/10 hover:border-white/20 hover:text-ink'
                        }`}
                        title="View NSE/BSE Trading Hours & Schedule"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                marketStatus?.isOpen ? 'bg-up' : marketStatus?.session === 'PRE_MARKET' ? 'bg-amber-400' : 'bg-primary'
                            }`} />
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${
                                marketStatus?.isOpen ? 'bg-up' : marketStatus?.session === 'PRE_MARKET' ? 'bg-amber-400' : 'bg-primary'
                            }`} />
                        </span>
                        <span className="font-bold tracking-tight">
                            {marketStatus?.isOpen ? 'NSE LIVE' : marketStatus?.session === 'PRE_MARKET' ? 'PRE-OPEN' : 'NSE CLOSED'}
                        </span>
                        <span className="text-[10px] opacity-75 font-num tabular-nums border-l border-white/10 pl-1.5">
                            {marketStatus?.isOpen ? `Closes ${formatRemaining(secondsLeft)}` : `Opens in ${formatRemaining(secondsLeft)}`}
                        </span>
                    </button>

                    {/* Balance pill */}
                    {user && (
                        <div className="hidden md:flex items-center gap-1.5 bg-[#0e2a30] border border-primary/20 text-primary px-3.5 py-1.5 rounded-xl text-sm font-semibold tabular-nums font-num"
                            style={{ boxShadow: '0 0 12px rgba(51,201,221,0.10)' }}>
                            <span className="text-xs opacity-70">₹</span>
                            {fmtBalance(balance)}
                        </div>
                    )}

                    <button className="relative text-ink-faint hover:text-ink-muted p-2 rounded-lg hover:bg-surface-3 transition-colors">
                        <Bell className="h-5 w-5" />
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-down rounded-full ring-2 ring-[#0a0e14]" />
                    </button>

                    {/* User menu */}
                    {user ? (
                        <div className="relative" ref={userMenuRef}>
                            <button id="user-menu-btn" onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 p-1 rounded-xl hover:bg-surface-3 transition-colors">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[#003829] font-bold text-sm"
                                    style={{ background: 'linear-gradient(135deg, #33c9dd, #22a9bc)' }}>
                                    {user.name?.[0]?.toUpperCase() || 'U'}
                                </div>
                                <ChevronDown className={`w-4 h-4 text-ink-faint transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                            </button>
                            {showUserMenu && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-surface rounded-xl shadow-xl border border-white/10 overflow-hidden z-50">
                                    <div className="px-4 py-3 border-b border-white/10">
                                        <p className="font-semibold text-ink-heading text-sm">{user.name}</p>
                                        <p className="text-xs text-ink-faint">{user.email}</p>
                                        <div className="mt-2 bg-[#0e2a30] rounded-lg px-2 py-1.5 flex items-center justify-between border border-primary/15">
                                            <span className="text-xs text-ink-faint">Balance</span>
                                            <span className="text-sm font-bold text-primary font-num">₹{fmtBalance(balance)}</span>
                                        </div>
                                    </div>
                                    <Link
                                        href="/transactions"
                                        onClick={() => setShowUserMenu(false)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-surface-3 transition-colors border-b border-white/10"
                                    >
                                        <History className="w-4 h-4 text-primary" />
                                        Transaction History
                                    </Link>
                                    <button onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-down hover:bg-down/10 transition-colors">
                                        <LogOut className="w-4 h-4" />
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Link href="/login" className="px-4 py-2 text-[#003829] text-sm font-bold rounded-lg transition-colors"
                            style={{ background: 'linear-gradient(135deg, #33c9dd, #22a9bc)' }}>
                            Login
                        </Link>
                    )}
                </div>
            </div>

            {/* Market Schedule Modal */}
            {showMarketModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
                    <div
                        ref={marketModalRef}
                        className="max-w-lg w-full bg-[#0e1624] border border-white/15 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                    >
                        {/* Header */}
                        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#141f30]">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                                    <Clock className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-ink-heading font-heading">
                                        NSE & BSE Trading Hours
                                    </h3>
                                    <p className="text-xs text-ink-faint">
                                        Indian Standard Time (IST · UTC+05:30)
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowMarketModal(false)}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-ink-muted hover:text-ink transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
                            {/* Current Session Banner */}
                            <div className={`p-4 rounded-xl border flex items-center justify-between ${
                                marketStatus?.isOpen
                                    ? 'bg-up/10 border-up/30 text-up'
                                    : marketStatus?.session === 'PRE_MARKET'
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                    : 'bg-[#182234] border-white/10 text-ink'
                            }`}>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                                marketStatus?.isOpen ? 'bg-up' : marketStatus?.session === 'PRE_MARKET' ? 'bg-amber-400' : 'bg-primary'
                                            }`} />
                                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                                                marketStatus?.isOpen ? 'bg-up' : marketStatus?.session === 'PRE_MARKET' ? 'bg-amber-400' : 'bg-primary'
                                            }`} />
                                        </span>
                                        <span className="font-bold text-xs uppercase tracking-wider">
                                            {marketStatus?.sessionName || 'Market Closed'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-ink-muted">
                                        {marketStatus?.statusMessage}
                                    </p>
                                </div>

                                <div className="text-right">
                                    <span className="text-[10px] font-semibold text-ink-faint uppercase block">
                                        {marketStatus?.isOpen ? 'Closes In' : 'Opens In'}
                                    </span>
                                    <span className="text-sm font-bold text-ink-heading font-num">
                                        {formatRemaining(secondsLeft)}
                                    </span>
                                </div>
                            </div>

                            {/* Schedule Timetable */}
                            <div className="space-y-2">
                                <span className="text-[11px] font-bold text-ink-faint uppercase tracking-wider block px-1">
                                    Standard Trading Schedule (Mon – Fri)
                                </span>

                                <div className="space-y-1.5">
                                    <div className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                                        marketStatus?.session === 'PRE_MARKET' ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' : 'bg-surface-2 border-white/5 text-ink-muted'
                                    }`}>
                                        <div className="flex items-center gap-2.5">
                                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                                            <div>
                                                <div className="font-semibold text-ink">Pre-Market Session</div>
                                                <div className="text-[11px] text-ink-faint">Order collection & price equilibrium discovery</div>
                                            </div>
                                        </div>
                                        <span className="font-num font-bold text-ink">09:00 – 09:15 AM</span>
                                    </div>

                                    <div className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                                        marketStatus?.isOpen ? 'bg-up/10 border-up/40 text-up' : 'bg-surface-2 border-white/5 text-ink-muted'
                                    }`}>
                                        <div className="flex items-center gap-2.5">
                                            <span className="w-2 h-2 rounded-full bg-up animate-pulse" />
                                            <div>
                                                <div className="font-semibold text-ink">Regular Trading Session</div>
                                                <div className="text-[11px] text-ink-faint">Continuous real-time order matching</div>
                                            </div>
                                        </div>
                                        <span className="font-num font-bold text-ink">09:15 AM – 03:30 PM</span>
                                    </div>

                                    <div className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                                        marketStatus?.session === 'POST_MARKET' ? 'bg-orange-500/10 border-orange-500/40 text-orange-300' : 'bg-surface-2 border-white/5 text-ink-muted'
                                    }`}>
                                        <div className="flex items-center gap-2.5">
                                            <span className="w-2 h-2 rounded-full bg-orange-400" />
                                            <div>
                                                <div className="font-semibold text-ink">Post-Market Closing Run</div>
                                                <div className="text-[11px] text-ink-faint">Execution at final closing price</div>
                                            </div>
                                        </div>
                                        <span className="font-num font-bold text-ink">03:30 – 04:00 PM</span>
                                    </div>

                                    <div className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                                        marketStatus?.session === 'CLOSED' ? 'bg-[#182638] border-primary/30 text-primary' : 'bg-surface-2 border-white/5 text-ink-muted'
                                    }`}>
                                        <div className="flex items-center gap-2.5">
                                            <span className="w-2 h-2 rounded-full bg-primary" />
                                            <div>
                                                <div className="font-semibold text-ink">After-Market Orders (AMO)</div>
                                                <div className="text-[11px] text-ink-faint">Orders queued for the next market session</div>
                                            </div>
                                        </div>
                                        <span className="font-num font-bold text-ink">04:00 PM – 09:00 AM</span>
                                    </div>
                                </div>
                            </div>

                            {/* Next Session & Exchange Info */}
                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <div className="bg-surface-2 rounded-xl p-3 border border-white/5">
                                    <span className="text-[10px] uppercase font-bold text-ink-faint block">Next Regular Open</span>
                                    <span className="text-xs font-bold text-ink-heading font-num">
                                        {marketStatus?.nextOpenFormatted || 'Mon, 09:15 AM IST'}
                                    </span>
                                </div>

                                <div className="bg-surface-2 rounded-xl p-3 border border-white/5">
                                    <span className="text-[10px] uppercase font-bold text-ink-faint block">Current Time (IST)</span>
                                    <span className="text-xs font-bold text-primary font-num">
                                        {marketStatus?.currentTimeIST || 'Asia/Kolkata'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-white/10 bg-[#141f30] flex justify-end">
                            <button
                                onClick={() => setShowMarketModal(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-[#003829] transition-all hover:brightness-110"
                                style={{ background: 'linear-gradient(135deg, #33c9dd, #22a9bc)' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom nav */}
            <div className="px-4 lg:px-6 border-t border-white/10/60">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {navItems.map(item => {
                        const isActive = pathname === item.href;
                        return (
                            <Link key={item.name} href={item.href}
                                className={`relative text-xs font-semibold uppercase tracking-wider whitespace-nowrap px-3.5 py-3 transition-colors ${
                                    isActive ? 'text-primary' : 'text-ink-faint hover:text-ink-muted'
                                }`}>
                                {item.name}
                                <span className={`absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-primary transition-all duration-300 ${
                                    isActive ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
                                }`} style={{ boxShadow: isActive ? '0 0 8px rgba(51,201,221,0.6)' : 'none' }} />
                            </Link>
                        );
                    })}
                </div>
            </div>
        </header>
    );
}
