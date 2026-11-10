'use client';
import BrandLogo from '@/components/BrandLogo';
import CompanyLogo from '@/components/CompanyLogo';
import ThemeToggle from '@/components/ThemeToggle';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Bell, LogOut, ChevronDown, Menu, X, History, Clock, Info } from 'lucide-react';
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
    const [showMobileNav, setShowMobileNav] = useState(false);
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
        { name: 'Weekly challenge', href: '/challenge' },
    ];

    const fmtBalance = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <header className="sticky top-0 z-40 flex flex-col border-b border-line"
            style={{ background: 'var(--surface)' }}>

            {/* Top row */}
            <div className="mx-auto w-full max-w-[1280px] flex items-center justify-between flex-wrap xl:flex-nowrap px-4 sm:px-6 lg:px-8 py-4 gap-4">
                {/* Logo */}
                <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0 group">
                    <BrandLogo compact className="text-[24px]" />
                </Link>

                {/* Search */}
                <div className="order-3 xl:order-none basis-full xl:basis-auto min-w-0 xl:flex-1 xl:max-w-xl relative" ref={searchRef}>
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            id="stock-search-input"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onFocus={() => setShowResults(true)}
                            placeholder="Search stocks, ETFs, indices..."
                            className="w-full pl-10 pr-10 py-3 border border-transparent rounded-xl bg-surface-2 text-ink placeholder-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
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
                        <div className="absolute top-full left-0 right-0 mt-2 bg-surface rounded-xl shadow-none border border-line overflow-hidden max-h-80 overflow-y-auto z-50">
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
                                        <div className="px-3 py-2 bg-surface-2 border-b border-line">
                                            <p className="text-xs font-semibold text-ink-faint">Search Results</p>
                                        </div>
                                        {combined.slice(0, 10).map((result: any, i: number) => (
                                            <div key={`${result.symbol}-${i}`}
                                                className="px-4 py-3 hover:bg-surface-3 cursor-pointer flex justify-between items-center gap-3 group transition-colors border-b border-line last:border-0"
                                                onClick={() => { router.push(`/stock/${encodeURIComponent(result.symbol)}`); setSearchQuery(''); setShowResults(false); }}>
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <CompanyLogo symbol={result.symbol} className="h-8 w-8" />
                                                    <div className="min-w-0">
                                                    <div className="truncate font-semibold text-ink text-sm" title={result.shortname || result.name || result.symbol}>{result.shortname || result.name || result.symbol}</div>
                                                    <div className="text-xs text-ink-faint flex items-center gap-2 mt-0.5">
                                                        {result.exchange && <span className="bg-surface-3 text-ink-muted px-1.5 py-0.5 rounded text-xs font-medium">{result.exchange}</span>}
                                                        <span>{result.symbol}</span>
                                                    </div>
                                                    </div>
                                                </div>
                                                <span className="shrink-0 text-xs text-ink-faint group-hover:text-primary transition-colors">→</span>
                                            </div>
                                        ))}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>

                {/* Right actions */}
                <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0 ml-auto">
                    <ThemeToggle showLabel className="hidden sm:inline-flex" />
                    {/* Market Status Pill */}
                    <button
                        type="button"
                        onClick={() => setShowMarketModal(true)}
                        className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                            marketStatus?.isOpen
                                ? 'bg-up/10 text-up border-up/30 hover:bg-up/15 shadow-none'
                                : marketStatus?.session === 'PRE_MARKET'
                                ? 'bg-amber-500/10 text-[var(--warning)] border-amber-500/30 hover:bg-amber-500/15'
                                : 'bg-surface-2 text-ink-muted border-line hover:border-line hover:text-ink'
                        }`}
                        title="View NSE/BSE Trading Hours & Schedule"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${
                                marketStatus?.isOpen ? 'bg-up' : marketStatus?.session === 'PRE_MARKET' ? 'bg-amber-400' : 'bg-ink-faint'
                            }`} />
                        </span>
                        <span className="font-medium">
                            {marketStatus?.isOpen ? 'NSE open' : marketStatus?.session === 'PRE_MARKET' ? 'Pre-open' : 'Market closed'}
                        </span>
                        <span className="hidden 2xl:inline text-xs font-num tabular-nums border-l border-line pl-1.5">
                            {marketStatus?.isOpen ? `Closes ${formatRemaining(secondsLeft)}` : `Opens in ${formatRemaining(secondsLeft)}`}
                        </span>
                    </button>

                    {/* Balance pill */}
                    {user && (
                        <div className="flex items-center gap-1.5 bg-surface-2 border border-line text-ink px-2 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold tabular-nums font-num"
                            >
                            <span className="text-xs opacity-70">₹</span>
                            {fmtBalance(balance)}
                        </div>
                    )}

                    <button aria-label="Notifications" className="relative text-ink-faint hover:text-ink-muted p-2 rounded-lg hover:bg-surface-3 transition-colors">
                        <Bell className="h-5 w-5" />
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-down rounded-full ring-2 ring-[var(--bg)]" />
                    </button>

                    {/* User menu */}
                    {user ? (
                        <div className="relative" ref={userMenuRef}>
                            <button id="user-menu-btn" aria-label="Account menu" aria-expanded={showUserMenu} onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 p-1 rounded-xl hover:bg-surface-3 transition-colors">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--primary-ink)] font-medium text-sm"
                                    style={{ background: 'var(--primary)', color: 'var(--primary-ink)' }}>
                                    {user.name?.[0]?.toUpperCase() || 'U'}
                                </div>
                                <ChevronDown className={`w-4 h-4 text-ink-faint transition-colors ${showUserMenu ? 'rotate-180' : ''}`} />
                            </button>
                            {showUserMenu && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-surface rounded-xl shadow-none border border-line overflow-hidden z-50">
                                    <div className="px-4 py-3 border-b border-line">
                                        <p className="font-semibold text-ink-heading text-sm">{user.name}</p>
                                        <p className="text-xs text-ink-faint">{user.email}</p>
                                        <div className="mt-2 bg-[var(--surface-2)] rounded-lg px-2 py-1.5 flex items-center justify-between border border-primary/15">
                                            <span className="text-xs text-ink-faint">Balance</span>
                                            <span className="text-sm font-medium text-primary font-num">₹{fmtBalance(balance)}</span>
                                        </div>
                                    </div>
                                    <Link
                                        href="/transactions"
                                        onClick={() => setShowUserMenu(false)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-surface-3 transition-colors border-b border-line"
                                    >
                                        <History className="w-4 h-4 text-primary" />
                                        Transactions
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
                        <Link href="/login" className="px-4 py-2 text-[var(--primary-ink)] text-sm font-medium rounded-lg transition-colors"
                            style={{ background: 'var(--primary)', color: 'var(--primary-ink)' }}>
                            Login
                        </Link>
                    )}
                </div>
            </div>

            {/* Market Schedule Modal */}
            {showMarketModal && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                    <div
                        ref={marketModalRef}
                        role="dialog" aria-modal="true" aria-labelledby="market-hours-title"
                        onKeyDown={event => { if (event.key === 'Escape') setShowMarketModal(false); }}
                        className="max-h-[85dvh] overflow-y-auto overflow-x-hidden max-w-lg w-full bg-surface-2 border border-line rounded-2xl shadow-none animate-in fade-in zoom-in-95 duration-200"
                    >
                        {/* Header */}
                        <div className="sticky top-0 z-10 p-4 sm:p-5 border-b border-line flex items-center justify-between gap-2 bg-[var(--surface-2)]">
                            <div className="flex min-w-0 items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                                    <Clock className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h3 id="market-hours-title" className="text-base font-medium text-ink-heading font-heading">
                                        NSE & BSE Trading Hours
                                    </h3>
                                    <p className="text-xs text-ink-faint">
                                        Indian Standard Time (IST · UTC+05:30)
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button" aria-label="Close market hours" autoFocus
                                onClick={() => setShowMarketModal(false)}
                                className="min-w-11 h-11 shrink-0 rounded-lg bg-surface-2 hover:bg-surface-3 flex items-center justify-center text-ink-muted hover:text-ink transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 sm:p-5 space-y-4">
                            {/* Current Session Banner */}
                            <div className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                                marketStatus?.isOpen
                                    ? 'bg-up/10 border-up/30 text-up'
                                    : marketStatus?.session === 'PRE_MARKET'
                                    ? 'bg-amber-500/10 border-amber-500/30 text-[var(--warning)]'
                                    : 'bg-surface-2 border-line text-ink'
                            }`}>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className={` absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                                marketStatus?.isOpen ? 'bg-up' : marketStatus?.session === 'PRE_MARKET' ? 'bg-amber-400' : 'bg-ink-faint'
                            }`} />
                                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                                                marketStatus?.isOpen ? 'bg-up' : marketStatus?.session === 'PRE_MARKET' ? 'bg-amber-400' : 'bg-ink-faint'
                            }`} />
                                        </span>
                                        <span className="font-medium text-xs">
                                            {marketStatus?.sessionName || 'Market closed'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-ink-muted">
                                        {marketStatus?.statusMessage}
                                    </p>
                                </div>

                                <div className="text-right">
                                    <span className="text-xs font-semibold text-ink-faint block">
                                        {marketStatus?.isOpen ? 'Closes In' : 'Opens In'}
                                    </span>
                                    <span className="text-sm font-medium text-ink-heading font-num">
                                        {formatRemaining(secondsLeft)}
                                    </span>
                                </div>
                            </div>

                            {/* Schedule Timetable */}
                            <div className="space-y-2">
                                <span className="text-xs font-medium text-ink-faint block px-1">
                                    Standard Trading Schedule (Mon – Fri)
                                </span>

                                <div className="space-y-1.5">
                                    <div className={`p-3 rounded-xl border flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between text-xs transition-colors ${
                                        marketStatus?.session === 'PRE_MARKET' ? 'bg-amber-500/10 border-amber-500/40 text-[var(--warning)]' : 'bg-surface-2 border-line text-ink-muted'
                                    }`}>
                                        <div className="flex items-center gap-2.5">
                                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                                            <div>
                                                <div className="font-semibold text-ink">Pre-Market Session</div>
                                                <div className="text-xs text-ink-faint">Order collection & price equilibrium discovery</div>
                                            </div>
                                        </div>
                                        <span className="font-num font-medium text-ink">09:00 – 09:15 AM</span>
                                    </div>

                                    <div className={`p-3 rounded-xl border flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between text-xs transition-colors ${
                                        marketStatus?.isOpen ? 'bg-up/10 border-up/40 text-up' : 'bg-surface-2 border-line text-ink-muted'
                                    }`}>
                                        <div className="flex items-center gap-2.5">
                                            <span className="w-2 h-2 rounded-full bg-up animate-pulse" />
                                            <div>
                                                <div className="font-semibold text-ink">Regular Trading Session</div>
                                                <div className="text-xs text-ink-faint">Continuous real-time order matching</div>
                                            </div>
                                        </div>
                                        <span className="font-num font-medium text-ink">09:15 AM – 03:30 PM</span>
                                    </div>

                                    <div className={`p-3 rounded-xl border flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between text-xs transition-colors ${
                                        marketStatus?.session === 'POST_MARKET' ? 'bg-orange-500/10 border-orange-500/40 text-[var(--warning)]' : 'bg-surface-2 border-line text-ink-muted'
                                    }`}>
                                        <div className="flex items-center gap-2.5">
                                            <span className="w-2 h-2 rounded-full bg-orange-400" />
                                            <div>
                                                <div className="font-semibold text-ink">Post-Market Closing Run</div>
                                                <div className="text-xs text-ink-faint">Execution at final closing price</div>
                                            </div>
                                        </div>
                                        <span className="font-num font-medium text-ink">03:30 – 04:00 PM</span>
                                    </div>

                                    <div className={`p-3 rounded-xl border flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between text-xs transition-colors ${
                                        marketStatus?.session === 'CLOSED' ? 'bg-surface-2 border-primary/30 text-primary' : 'bg-surface-2 border-line text-ink-muted'
                                    }`}>
                                        <div className="flex items-center gap-2.5">
                                            <span className="w-2 h-2 rounded-full bg-primary" />
                                            <div>
                                                <div className="font-semibold text-ink">After-Market Orders (AMO)</div>
                                                <div className="text-xs text-ink-faint">Orders queued for the next market session</div>
                                            </div>
                                        </div>
                                        <span className="font-num font-medium text-ink">04:00 PM – 09:00 AM</span>
                                    </div>
                                </div>
                            </div>

                            {/* Next Session & Exchange Info */}
                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <div className="bg-surface-2 rounded-xl p-3 border border-line">
                                    <span className="text-xs font-medium text-ink-faint block">Next Regular Open</span>
                                    <span className="text-xs font-medium text-ink-heading font-num">
                                        {marketStatus?.nextOpenFormatted || 'Mon, 09:15 AM IST'}
                                    </span>
                                </div>

                                <div className="bg-surface-2 rounded-xl p-3 border border-line">
                                    <span className="text-xs font-medium text-ink-faint block">Current Time (IST)</span>
                                    <span className="text-xs font-medium text-primary font-num">
                                        {marketStatus?.currentTimeIST || 'Asia/Kolkata'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-line bg-[var(--surface-2)] flex justify-end">
                            <button
                                onClick={() => setShowMarketModal(false)}
                                className="min-h-11 px-4 py-2 rounded-xl text-xs font-medium text-[var(--primary-ink)] transition-colors hover:brightness-110"
                                style={{ background: 'var(--primary)', color: 'var(--primary-ink)' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom nav */}
            <nav aria-label="Main navigation" className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-3 sm:hidden">
                <button type="button" aria-expanded={showMobileNav} aria-controls="mobile-navigation" onClick={() => setShowMobileNav(v => !v)} className="flex min-h-11 min-w-0 flex-1 items-center justify-between text-sm text-ink">
                    <span>{navItems.find(item => pathname === item.href)?.name || 'Navigation'}</span>
                    {showMobileNav ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </button>
                <ThemeToggle className="my-1" />
                </div>
                {showMobileNav && <div id="mobile-navigation" className="grid grid-cols-2 gap-1 border-t border-line py-2 sm:hidden">
                    {navItems.map(item => <Link key={item.href} href={item.href} onClick={() => setShowMobileNav(false)} aria-current={pathname === item.href ? 'page' : undefined} className={`flex min-h-11 items-center rounded-lg px-3 text-sm transition-colors ${pathname === item.href ? 'bg-surface-2 text-primary' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'}`}>{item.name}</Link>)}
                </div>}
                <div className="hidden sm:flex items-center gap-5 overflow-x-auto no-scrollbar">
                    {navItems.map(item => {
                        const isActive = pathname === item.href;
                        return (
                            <Link key={item.name} href={item.href}
                                aria-current={isActive ? 'page' : undefined}
                                className={`relative text-sm font-semibold whitespace-nowrap px-1 py-4 transition-colors ${
                                    isActive ? 'text-primary' : 'text-ink-faint hover:text-ink-muted'
                                }`}>
                                {item.name}
                                <span className={`absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-primary transition-colors duration-300 ${
                                    isActive ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
                                }`}  />
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </header>
    );
}
