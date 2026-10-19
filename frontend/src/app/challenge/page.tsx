'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/dashboard/Header';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import {
    Loader2,
    Trophy,
    Target,
    Wallet,
    TrendingUp,
    Search,
    X,
    Clock,
    ShieldCheck,
    Zap,
    Sparkles,
    ArrowUpRight,
    ArrowDownRight,
    CheckCircle2,
    Minus,
    Plus,
} from 'lucide-react';
import { API_URL } from '@/lib/config';

type ChallengePosition = {
    symbol: string;
    quantity: number;
    averagePrice: number;
    ltp: number;
    currentValue: number;
    pnl: number;
};

type ChallengeSnapshot = {
    id: string;
    status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
    startAt: string;
    endAt: string;
    initialBalance: number;
    targetBalance: number;
    cashBalance: number;
    equity: number;
    pnl: number;
    progressPercent: number;
    targetRemaining: number;
    positions: ChallengePosition[];
};

type ChallengeTrade = {
    _id: string;
    type: 'BUY' | 'SELL';
    symbol: string;
    quantity: number;
    price: number;
    totalAmount: number;
    createdAt: string;
};

type SearchQuote = {
    symbol: string;
    shortname?: string;
    quoteType?: string;
    exchange?: string;
};

const POPULAR_SYMBOLS = [
    { symbol: 'RELIANCE.NS', shortname: 'Reliance Industries', exchange: 'NSE' },
    { symbol: 'TCS.NS', shortname: 'Tata Consultancy Services', exchange: 'NSE' },
    { symbol: 'HDFCBANK.NS', shortname: 'HDFC Bank', exchange: 'NSE' },
    { symbol: 'INFY.NS', shortname: 'Infosys', exchange: 'NSE' },
    { symbol: 'ICICIBANK.NS', shortname: 'ICICI Bank', exchange: 'NSE' },
    { symbol: 'SBIN.NS', shortname: 'State Bank of India', exchange: 'NSE' },
    { symbol: 'BHARTIARTL.NS', shortname: 'Bharti Airtel', exchange: 'NSE' },
    { symbol: 'ITC.NS', shortname: 'ITC Limited', exchange: 'NSE' },
    { symbol: 'LT.NS', shortname: 'Larsen & Toubro', exchange: 'NSE' },
    { symbol: 'TATAMOTORS.NS', shortname: 'Tata Motors', exchange: 'NSE' },
    { symbol: 'NIFTYBEES.NS', shortname: 'Nippon Nifty BeES ETF', exchange: 'NSE' },
    { symbol: 'GOLDBEES.NS', shortname: 'Nippon Gold BeES ETF', exchange: 'NSE' },
    { symbol: 'BANKBEES.NS', shortname: 'Nippon Bank BeES ETF', exchange: 'NSE' },
    { symbol: 'NSE.BO', shortname: 'National Stock Exchange of India', exchange: 'BSE' },
];

const API = API_URL;

export default function ChallengePage() {
    const { user, loading: authLoading } = useAuth();
    const { marketStatus, marketOpen } = usePortfolio();
    const router = useRouter();

    const [challenge, setChallenge] = useState<ChallengeSnapshot | null>(null);
    const [trades, setTrades] = useState<ChallengeTrade[]>([]);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);
    const [placing, setPlacing] = useState(false);
    const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
    const [symbol, setSymbol] = useState('RELIANCE.NS');
    const [selectedName, setSelectedName] = useState('Reliance Industries');
    const [quantity, setQuantity] = useState('1');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchQuote[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
    const [priceSource, setPriceSource] = useState('');
    const [priceLoading, setPriceLoading] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const token = useMemo(() => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('ptx_token') || localStorage.getItem('token') || '';
    }, []);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchState = async () => {
        if (!token) return;
        const r = await fetch(`${API}/api/challenge/state`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error('Failed to load challenge state');
        const data = await r.json();
        setChallenge(data.challenge || null);
    };

    const fetchTrades = async () => {
        if (!token) return;
        const r = await fetch(`${API}/api/challenge/trades`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const data = await r.json();
        setTrades(data.trades || []);
    };

    useEffect(() => {
        if (!authLoading && !user) router.push('/login');
    }, [authLoading, user, router]);

    useEffect(() => {
        const load = async () => {
            if (!token || !user) return;
            setLoading(true);
            try {
                await Promise.all([fetchState(), fetchTrades()]);
            } catch (e: any) {
                showToast('error', e.message || 'Unable to load challenge');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [token, user]);

    // Local instant filter + remote search debounce
    useEffect(() => {
        if (!showResults) {
            setSearchResults([]);
            return;
        }

        const q = searchQuery.toLowerCase().trim();
        const localMatches = POPULAR_SYMBOLS.filter(
            item => item.symbol.toLowerCase().includes(q) || item.shortname.toLowerCase().includes(q)
        );

        if (!q) {
            setSearchResults(POPULAR_SYMBOLS.slice(0, 6));
            return;
        }

        setSearchResults(localMatches.slice(0, 6));

        if (q.length < 2) return;

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const r = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`, {
                    signal: controller.signal,
                });
                if (!r.ok) return;
                const data = await r.json();
                const allowed = (data.quotes || []).filter((item: SearchQuote) => {
                    const kind = String(item.quoteType || 'EQUITY').toUpperCase();
                    return kind === 'EQUITY' || kind === 'ETF';
                });

                // Merge deduplicating by symbol
                const seen = new Set(localMatches.map(m => m.symbol.toUpperCase()));
                const combined = [...localMatches];
                for (const item of allowed) {
                    const key = String(item.symbol || '').toUpperCase();
                    if (!seen.has(key)) {
                        seen.add(key);
                        combined.push(item);
                    }
                }
                setSearchResults(combined.slice(0, 8));
            } catch (e: any) {
                if (e?.name !== 'AbortError') {
                    // keep local matches
                }
            } finally {
                setSearchLoading(false);
            }
        }, 120);

        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [searchQuery, showResults]);

    // Fetch live quote for currently selected symbol
    useEffect(() => {
        if (!symbol) return;

        const loadPrice = async () => {
            setPriceLoading(true);
            try {
                const r = await fetch(`${API}/api/stock/${encodeURIComponent(symbol)}/realtime`);
                if (!r.ok) {
                    setSelectedPrice(null);
                    setPriceSource('');
                    return;
                }
                const data = await r.json();
                if (typeof data?.price === 'number') {
                    setSelectedPrice(data.price);
                    setPriceSource(data?.source || 'market');
                } else {
                    setSelectedPrice(null);
                    setPriceSource('');
                }
            } catch {
                setSelectedPrice(null);
                setPriceSource('');
            } finally {
                setPriceLoading(false);
            }
        };

        loadPrice();
    }, [symbol]);

    const acceptChallenge = async () => {
        if (!token) return;
        setAccepting(true);
        try {
            const r = await fetch(`${API}/api/challenge/accept`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Could not accept challenge');
            setChallenge(data.challenge);
            await fetchTrades();
            showToast('success', data.reused ? 'Active challenge resumed' : 'Challenge accepted: ₹10,000 allocated');
        } catch (e: any) {
            showToast('error', e.message || 'Could not accept challenge');
        } finally {
            setAccepting(false);
        }
    };

    const placeTrade = async () => {
        if (!token || !challenge) return;
        const qty = parseInt(quantity, 10);
        if (!qty || qty <= 0) {
            showToast('error', 'Enter valid quantity');
            return;
        }

        setPlacing(true);
        try {
            const r = await fetch(`${API}/api/challenge/trade`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ symbol, type: side, quantity: qty }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Trade failed');

            setChallenge(data.challenge);
            setQuantity('1');
            await fetchTrades();
            showToast('success', `${side} executed @ ₹${Number(data.filledPrice).toFixed(2)}`);
        } catch (e: any) {
            showToast('error', e.message || 'Trade failed');
        } finally {
            setPlacing(false);
        }
    };

    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const qty = parseInt(quantity, 10) || 0;
    const estimatedTotal = qty > 0 && selectedPrice ? qty * selectedPrice : 0;

    // Remaining duration calculation
    const timeRemainingFormatted = useMemo(() => {
        if (!challenge?.endAt) return null;
        const diffMs = new Date(challenge.endAt).getTime() - Date.now();
        if (diffMs <= 0) return 'Expired';
        const d = Math.floor(diffMs / (86400 * 1000));
        const h = Math.floor((diffMs % (86400 * 1000)) / (3600 * 1000));
        const m = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
        if (d > 0) return `${d}d ${h}h remaining`;
        if (h > 0) return `${h}h ${m}m remaining`;
        return `${m}m remaining`;
    }, [challenge?.endAt]);

    // Calculate max quantity affordable or held
    const handleSetMax = () => {
        if (!challenge) return;
        if (side === 'BUY') {
            if (!selectedPrice || selectedPrice <= 0) return;
            const maxBuy = Math.floor(challenge.cashBalance / selectedPrice);
            setQuantity(String(Math.max(1, maxBuy)));
        } else {
            const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
            const pos = challenge.positions.find(p => p.symbol.toUpperCase() === bare || p.symbol.toUpperCase() === symbol.toUpperCase());
            if (pos && pos.quantity > 0) {
                setQuantity(String(pos.quantity));
            } else {
                setQuantity('1');
            }
        }
    };

    // Quick select a position to sell
    const handleQuickSell = (pos: ChallengePosition) => {
        setSide('SELL');
        setSymbol(pos.symbol);
        setSelectedName(pos.symbol);
        setQuantity(String(pos.quantity));
    };

    if (authLoading || !user) return null;

    return (
        <div className="min-h-screen bg-transparent font-sans page-fade-in text-ink">
            <Header />

            {/* Notification Toast */}
            {toast && (
                <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-xl border text-sm font-semibold shadow-xl flex items-center gap-2.5 backdrop-blur-md transition-all ${
                    toast.type === 'success'
                        ? 'bg-[#00281b]/95 border-up/30 text-up shadow-[0_0_20px_rgba(38,208,124,0.2)]'
                        : 'bg-[#2a0e14]/95 border-down/30 text-down shadow-[0_0_20px_rgba(255,77,106,0.2)]'
                }`}>
                    {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-up flex-shrink-0" /> : <X className="w-4 h-4 text-down flex-shrink-0" />}
                    <span>{toast.message}</span>
                </div>
            )}

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center min-h-[420px] rounded-2xl bg-surface border border-white/10 p-12 text-center">
                        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                        <p className="text-base font-semibold text-ink-heading">Loading Weekly Challenge...</p>
                        <p className="text-xs text-ink-faint mt-1">Fetching live portfolio allocations and rules</p>
                    </div>
                ) : !challenge ? (
                    /* ═════════════════════════════════════════════════════════════
                       CHALLENGE BRIEFING (Not yet accepted)
                       ═════════════════════════════════════════════════════════════ */
                    <div className="space-y-8">
                        {/* Hero Card */}
                        <div className="relative overflow-hidden rounded-3xl bg-surface border border-white/10 p-8 sm:p-12 shadow-soft">
                            {/* Ambient Glows */}
                            <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-up/10 rounded-full blur-3xl pointer-events-none" />

                            <div className="relative z-10 max-w-3xl">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-5">
                                    <Trophy className="w-3.5 h-3.5" />
                                    7-Day Trading Sprint
                                </div>

                                <h1 className="text-3xl sm:text-5xl font-extrabold text-ink-heading tracking-tight leading-[1.15] mb-4">
                                    Turn <span className="text-primary font-num">₹10,000</span> into <span className="text-up font-num">₹15,000</span> in 7 Days
                                </h1>

                                <p className="text-base sm:text-lg text-ink-muted leading-relaxed mb-8">
                                    Put your trading skills to the ultimate test against authentic, live Indian stock market movements.
                                    Trade with a dedicated virtual challenge wallet — zero risk to your main portfolio.
                                </p>

                                <div className="flex flex-wrap items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={acceptChallenge}
                                        disabled={accepting}
                                        className="inline-flex items-center gap-2.5 h-12 px-8 rounded-xl bg-primary text-[#061016] font-bold text-sm hover:bg-primary-hover shadow-[0_0_25px_rgba(51,201,221,0.30)] hover:shadow-[0_0_35px_rgba(51,201,221,0.45)] transition-all disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                                    >
                                        {accepting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin text-[#061016]" />
                                                <span>Allocating ₹10,000 Wallet...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4 text-[#061016]" />
                                                <span>Accept Challenge & Start</span>
                                            </>
                                        )}
                                    </button>

                                    <div className="text-xs text-ink-faint flex items-center gap-1.5">
                                        <ShieldCheck className="w-4 h-4 text-up" />
                                        100% Free · No Real Money At Risk
                                    </div>
                                </div>
                            </div>

                            {/* 3 Key Parameter Metrics */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 pt-8 border-t border-white/10">
                                <div className="p-4 rounded-xl bg-surface-2 border border-white/5">
                                    <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-1">Starting Balance</p>
                                    <p className="text-2xl font-bold text-ink-heading font-num">₹10,000</p>
                                    <p className="text-[11px] text-ink-muted mt-0.5">Isolated virtual challenge wallet</p>
                                </div>
                                <div className="p-4 rounded-xl bg-surface-2 border border-white/5">
                                    <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-1">Target Equity</p>
                                    <p className="text-2xl font-bold text-up font-num">₹15,000</p>
                                    <p className="text-[11px] text-ink-muted mt-0.5">+50% return in 7 calendar days</p>
                                </div>
                                <div className="p-4 rounded-xl bg-surface-2 border border-white/5">
                                    <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-1">Duration</p>
                                    <p className="text-2xl font-bold text-primary font-num">7 Days</p>
                                    <p className="text-[11px] text-ink-muted mt-0.5">Real-time matching during market hours</p>
                                </div>
                            </div>
                        </div>

                        {/* Rules Blueprint */}
                        <div className="rounded-3xl bg-surface border border-white/10 p-8 shadow-soft">
                            <h2 className="text-xl font-bold text-ink-heading tracking-tight mb-2">Challenge Rules & Guidelines</h2>
                            <p className="text-sm text-ink-muted mb-6">Designed to simulate real institutional swing trading conditions:</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-5 rounded-2xl bg-surface-2 border border-white/5 flex gap-4 items-start">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-primary">
                                        <Wallet className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-ink-heading text-sm mb-1">Isolated Capital</h3>
                                        <p className="text-xs text-ink-muted leading-relaxed">
                                            You are granted a dedicated ₹10,000 virtual balance. Your main portfolio balance (₹1,00,000) and orders remain completely separate and protected.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-5 rounded-2xl bg-surface-2 border border-white/5 flex gap-4 items-start">
                                    <div className="w-10 h-10 rounded-xl bg-up/10 border border-up/20 flex items-center justify-center flex-shrink-0 text-up">
                                        <Zap className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-ink-heading text-sm mb-1">Live Market Execution</h3>
                                        <p className="text-xs text-ink-muted leading-relaxed">
                                            All challenge orders execute at real-time NSE and BSE stock and ETF quotes. You can buy and sell freely as market movements unfold.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-5 rounded-2xl bg-surface-2 border border-white/5 flex gap-4 items-start">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-primary">
                                        <Target className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-ink-heading text-sm mb-1">50% Growth Goal</h3>
                                        <p className="text-xs text-ink-muted leading-relaxed">
                                            Your objective is to grow total portfolio equity (cash balance + market value of your positions) to ₹15,000 or higher before the 7-day timer concludes.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-5 rounded-2xl bg-surface-2 border border-white/5 flex gap-4 items-start">
                                    <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center flex-shrink-0 text-amber-400">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-ink-heading text-sm mb-1">Fair Session Settlement</h3>
                                        <p className="text-xs text-ink-muted leading-relaxed">
                                            When the market closes at 3:30 PM IST, your portfolio P&L stays securely locked to the official closing session LTP so there are no arbitrary overnight fluctuations.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ═════════════════════════════════════════════════════════════
                       ACTIVE CHALLENGE DASHBOARD & TRADING PANEL
                       ═════════════════════════════════════════════════════════════ */
                    <div className="space-y-6">
                        {/* Status Header */}
                        <div className="flex flex-wrap items-center justify-between gap-4 bg-surface rounded-2xl border border-white/10 p-5 shadow-soft">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-2xl font-bold text-ink-heading tracking-tight">Weekly Challenge</h1>
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                        challenge.status === 'COMPLETED'
                                            ? 'bg-up/10 text-up border border-up/30 shadow-[0_0_12px_rgba(38,208,124,0.2)]'
                                            : challenge.status === 'ACTIVE'
                                            ? 'bg-primary/10 text-primary border border-primary/30 shadow-[0_0_12px_rgba(51,201,221,0.2)]'
                                            : 'bg-down/10 text-down border border-down/30'
                                    }`}>
                                        <span className={`w-2 h-2 rounded-full ${challenge.status === 'COMPLETED' ? 'bg-up' : challenge.status === 'ACTIVE' ? 'bg-primary animate-pulse' : 'bg-down'}`} />
                                        {challenge.status}
                                    </span>
                                </div>
                                <p className="text-xs text-ink-muted mt-1">Goal: Turn ₹10,000 into ₹15,000 before time runs out</p>
                            </div>

                            {/* Remaining Time & Market State */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface-2 border border-white/5 text-xs font-semibold text-ink-muted">
                                    <Clock className="w-3.5 h-3.5 text-primary" />
                                    <span>{timeRemainingFormatted || '7 Days Sprint'}</span>
                                </div>

                                <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface-2 border border-white/5 text-xs font-semibold text-ink-muted">
                                    <span className={`w-2 h-2 rounded-full ${marketOpen ? 'bg-up' : 'bg-ink-faint'}`} />
                                    <span>{marketOpen ? 'Market Open' : 'P&L Frozen (Market Closed)'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Top 4 Metrics Row */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-surface rounded-2xl border border-white/10 p-5 shadow-soft">
                                <div className="flex items-center justify-between text-ink-faint mb-2">
                                    <span className="text-xs font-semibold uppercase tracking-wider">Available Cash</span>
                                    <Wallet className="w-4 h-4 text-primary" />
                                </div>
                                <p className="text-2xl font-bold text-ink-heading font-num tracking-tight">₹{fmt(challenge.cashBalance)}</p>
                                <p className="text-[11px] text-ink-faint mt-1">Uninvested challenge cash</p>
                            </div>

                            <div className="bg-surface rounded-2xl border border-white/10 p-5 shadow-soft">
                                <div className="flex items-center justify-between text-ink-faint mb-2">
                                    <span className="text-xs font-semibold uppercase tracking-wider">Total Equity</span>
                                    <TrendingUp className="w-4 h-4 text-up" />
                                </div>
                                <p className="text-2xl font-bold text-ink-heading font-num tracking-tight">₹{fmt(challenge.equity)}</p>
                                <p className="text-[11px] text-ink-faint mt-1">Cash + market value of shares</p>
                            </div>

                            <div className="bg-surface rounded-2xl border border-white/10 p-5 shadow-soft">
                                <div className="flex items-center justify-between text-ink-faint mb-2">
                                    <span className="text-xs font-semibold uppercase tracking-wider">Sprint Target</span>
                                    <Target className="w-4 h-4 text-primary" />
                                </div>
                                <p className="text-2xl font-bold text-ink-heading font-num tracking-tight">₹{fmt(challenge.targetBalance)}</p>
                                <p className="text-[11px] text-ink-faint mt-1">Target portfolio threshold</p>
                            </div>

                            <div className="bg-surface rounded-2xl border border-white/10 p-5 shadow-soft">
                                <div className="flex items-center justify-between text-ink-faint mb-2">
                                    <span className="text-xs font-semibold uppercase tracking-wider">Net P&L</span>
                                    <Trophy className={`w-4 h-4 ${challenge.pnl >= 0 ? 'text-up' : 'text-down'}`} />
                                </div>
                                <p className={`text-2xl font-bold font-num tracking-tight flex items-center gap-1 ${challenge.pnl >= 0 ? 'text-up' : 'text-down'}`}>
                                    {challenge.pnl >= 0 ? <ArrowUpRight className="w-5 h-5 inline" /> : <ArrowDownRight className="w-5 h-5 inline" />}
                                    {challenge.pnl >= 0 ? '+' : ''}₹{fmt(challenge.pnl)}
                                </p>
                                <p className="text-[11px] text-ink-faint mt-1">
                                    {challenge.initialBalance > 0
                                        ? `${(((challenge.equity - challenge.initialBalance) / challenge.initialBalance) * 100).toFixed(2)}% return`
                                        : '0%'}
                                </p>
                            </div>
                        </div>

                        {/* Target Progress Bar */}
                        {(() => {
                            const profitGoal = Math.max(1, (challenge.targetBalance || 15000) - (challenge.initialBalance || 10000));
                            const currentProfit = Math.max(0, challenge.equity - (challenge.initialBalance || 10000));
                            const progressPct = Math.min(100, Math.max(0, (currentProfit / profitGoal) * 100));

                            return (
                                <div className="bg-surface rounded-2xl border border-white/10 p-6 shadow-soft space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Target className="w-4 h-4 text-primary" />
                                            <span className="font-semibold text-ink-heading">Sprint Target · ₹{fmt(profitGoal)} Profit Goal</span>
                                        </div>
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-xs text-ink-muted font-num">
                                                ₹{fmt(currentProfit)} / ₹{fmt(profitGoal)}
                                            </span>
                                            <span className="font-bold text-primary font-num text-xs bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                                                {progressPct.toFixed(1)}% Reached
                                            </span>
                                        </div>
                                    </div>

                                    <div className="w-full h-3 bg-surface-2 rounded-full overflow-hidden p-0.5 border border-white/5">
                                        <div
                                            className="h-full bg-gradient-to-r from-primary to-up rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(51,201,221,0.4)]"
                                            style={{ width: `${progressPct}%` }}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-ink-muted">
                                        <span>Initial: ₹{fmt(challenge.initialBalance)}</span>
                                        <span className="font-semibold text-ink">
                                            {challenge.targetRemaining > 0
                                                ? `₹${fmt(challenge.targetRemaining)} remaining to complete challenge`
                                                : '🎉 Target reached! Challenge Completed!'}
                                        </span>
                                        <span>Target: ₹{fmt(challenge.targetBalance)}</span>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Main Grid: Holdings & Trades (2 cols) vs Trading Panel (1 col) */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            {/* Left Area (8 cols) */}
                            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
                                {/* Challenge Holdings Table */}
                                <div className="bg-surface rounded-2xl border border-white/10 overflow-hidden shadow-soft">
                                    <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <h2 className="font-bold text-ink-heading text-base">Challenge Holdings</h2>
                                            <span className="text-xs bg-surface-2 text-ink-muted px-2 py-0.5 rounded-full font-num">
                                                {challenge.positions.length}
                                            </span>
                                        </div>
                                        <p className="text-xs text-ink-faint">Live LTP & Valuation</p>
                                    </div>

                                    {challenge.positions.length === 0 ? (
                                        <div className="p-12 text-center">
                                            <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-white/5 mx-auto mb-3 flex items-center justify-center text-ink-faint">
                                                <Wallet className="w-6 h-6" />
                                            </div>
                                            <p className="font-semibold text-ink text-sm">No challenge holdings yet</p>
                                            <p className="text-xs text-ink-muted mt-1 max-w-sm mx-auto">
                                                Use the trading panel to purchase stocks or ETFs with your ₹{fmt(challenge.cashBalance)} challenge balance.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm">
                                                <thead>
                                                    <tr className="bg-surface-2 text-[11px] uppercase tracking-wider text-ink-faint border-b border-white/5 font-semibold">
                                                        <th className="px-6 py-3.5">Asset</th>
                                                        <th className="px-4 py-3.5 text-right">Qty</th>
                                                        <th className="px-4 py-3.5 text-right">Avg Price</th>
                                                        <th className="px-4 py-3.5 text-right">LTP</th>
                                                        <th className="px-4 py-3.5 text-right">Current Value</th>
                                                        <th className="px-4 py-3.5 text-right">P&L</th>
                                                        <th className="px-6 py-3.5 text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {challenge.positions.map((p) => {
                                                        const isPosProfit = p.pnl >= 0;
                                                        const pnlPercent = p.averagePrice > 0 ? ((p.ltp - p.averagePrice) / p.averagePrice) * 100 : 0;
                                                        return (
                                                            <tr key={p.symbol} className="hover:bg-surface-2/60 transition-colors">
                                                                <td className="px-6 py-4">
                                                                    <div className="font-bold text-ink-heading">{p.symbol}</div>
                                                                    <div className="text-[11px] text-ink-faint">EQUITY / ETF</div>
                                                                </td>
                                                                <td className="px-4 py-4 text-right font-num font-semibold text-ink">
                                                                    {p.quantity}
                                                                </td>
                                                                <td className="px-4 py-4 text-right font-num text-ink-muted">
                                                                    ₹{fmt(p.averagePrice)}
                                                                </td>
                                                                <td className="px-4 py-4 text-right font-num font-semibold text-ink">
                                                                    ₹{fmt(p.ltp)}
                                                                </td>
                                                                <td className="px-4 py-4 text-right font-num font-semibold text-ink-heading">
                                                                    ₹{fmt(p.currentValue)}
                                                                </td>
                                                                <td className={`px-4 py-4 text-right font-num font-bold ${isPosProfit ? 'text-up' : 'text-down'}`}>
                                                                    <div>{isPosProfit ? '+' : ''}₹{fmt(p.pnl)}</div>
                                                                    <div className="text-[11px] opacity-80 font-normal">
                                                                        {isPosProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleQuickSell(p)}
                                                                        className="px-3 py-1 rounded-lg bg-surface-2 hover:bg-down/20 border border-white/10 hover:border-down/40 text-xs font-semibold text-ink-muted hover:text-down transition-colors cursor-pointer"
                                                                    >
                                                                        Sell
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Challenge Trade History */}
                                <div className="bg-surface rounded-2xl border border-white/10 p-6 shadow-soft">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="font-bold text-ink-heading text-base">Challenge Trade Ledger</h2>
                                        <span className="text-xs text-ink-faint font-num">{trades.length} trades</span>
                                    </div>

                                    {trades.length === 0 ? (
                                        <p className="text-xs text-ink-muted py-4 text-center">No trades executed in this challenge yet.</p>
                                    ) : (
                                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                                            {trades.map((t) => (
                                                <div
                                                    key={t._id}
                                                    className="p-3.5 rounded-xl bg-surface-2 border border-white/5 flex items-center justify-between gap-3 hover:border-white/10 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                                            t.type === 'BUY' ? 'bg-up/10 text-up border border-up/20' : 'bg-down/10 text-down border border-down/20'
                                                        }`}>
                                                            {t.type}
                                                        </span>
                                                        <div>
                                                            <p className="font-bold text-ink text-sm leading-tight">{t.symbol}</p>
                                                            <p className="text-[11px] text-ink-faint mt-0.5">
                                                                {new Date(t.createdAt).toLocaleDateString('en-IN', {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit',
                                                                })}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="text-right font-num">
                                                        <p className="text-sm font-semibold text-ink-heading">₹{fmt(t.totalAmount)}</p>
                                                        <p className="text-[11px] text-ink-faint">
                                                            {t.quantity} shares @ ₹{fmt(t.price)}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Area: Challenge Trading Terminal (4-5 cols) */}
                            <div className="lg:col-span-5 xl:col-span-4">
                                <div className="sticky top-20 bg-surface rounded-2xl border border-white/10 p-6 shadow-soft space-y-5">
                                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                                        <h2 className="font-bold text-ink-heading text-base">Challenge Terminal</h2>
                                        <span className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                                            ₹{fmt(challenge.cashBalance)} Cash
                                        </span>
                                    </div>

                                    {/* BUY / SELL Switcher */}
                                    <div className="grid grid-cols-2 gap-2 bg-surface-2 p-1 rounded-xl border border-white/5">
                                        <button
                                            type="button"
                                            onClick={() => setSide('BUY')}
                                            className={`py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                                                side === 'BUY'
                                                    ? 'bg-up text-[#00281b] shadow-[0_0_14px_rgba(38,208,124,0.3)]'
                                                    : 'text-ink-muted hover:text-ink'
                                            }`}
                                        >
                                            Buy
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSide('SELL')}
                                            className={`py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                                                side === 'SELL'
                                                    ? 'bg-down text-white shadow-[0_0_14px_rgba(255,77,106,0.3)]'
                                                    : 'text-ink-muted hover:text-ink'
                                            }`}
                                        >
                                            Sell
                                        </button>
                                    </div>

                                    {/* Asset Selector & Search */}
                                    <div className="relative">
                                        <label className="block text-[11px] font-bold text-ink-faint uppercase tracking-wider mb-1.5">
                                            Select Stock or ETF
                                        </label>
                                        <div className="relative">
                                            <Search className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => {
                                                    setSearchQuery(e.target.value);
                                                    setShowResults(true);
                                                }}
                                                onFocus={() => setShowResults(true)}
                                                placeholder="Search e.g. RELIANCE, TCS, GOLDBEES"
                                                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-white/10 bg-surface-2 text-ink text-sm placeholder-[#5c6675] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                            />
                                            {searchQuery && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSearchQuery('');
                                                        setShowResults(false);
                                                    }}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Dropdown Menu */}
                                        {showResults && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-surface-2 rounded-xl shadow-2xl border border-white/15 overflow-hidden z-30 max-h-60 overflow-y-auto">
                                                {searchLoading && searchResults.length === 0 ? (
                                                    <div className="p-3 text-center text-xs text-ink-faint">Searching...</div>
                                                ) : searchResults.length === 0 ? (
                                                    <div className="p-3 text-center text-xs text-ink-faint">No matching symbols found</div>
                                                ) : (
                                                    searchResults.map((item) => (
                                                        <div
                                                            key={`${item.symbol}-${item.exchange || ''}`}
                                                            onClick={() => {
                                                                setSymbol(item.symbol);
                                                                setSelectedName(item.shortname || item.symbol);
                                                                setSearchQuery('');
                                                                setShowResults(false);
                                                            }}
                                                            className="px-3.5 py-2.5 hover:bg-surface-3 cursor-pointer flex items-center justify-between border-b border-white/5 last:border-b-0 transition-colors"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-semibold text-ink-heading">{item.shortname || item.symbol}</p>
                                                                <p className="text-xs text-ink-faint">{item.symbol} {item.exchange ? `· ${item.exchange}` : ''}</p>
                                                            </div>
                                                            <span className="text-xs text-primary font-medium">Select</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Active Selected Symbol Card */}
                                    <div className="p-3.5 rounded-xl bg-surface-2 border border-white/5">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs text-ink-faint font-semibold uppercase">{symbol}</p>
                                                <p className="text-sm font-bold text-ink-heading leading-tight mt-0.5">{selectedName}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-base font-bold text-ink-heading font-num">
                                                    {priceLoading ? (
                                                        <Loader2 className="w-4 h-4 animate-spin text-primary inline" />
                                                    ) : selectedPrice ? (
                                                        `₹${fmt(selectedPrice)}`
                                                    ) : (
                                                        <span className="text-xs text-ink-faint">Unavailable</span>
                                                    )}
                                                </p>
                                                <p className="text-[10px] text-ink-muted mt-0.5">{priceSource ? `${priceSource} price` : 'Live quote'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quantity Stepper & Quick Max */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-[11px] font-bold text-ink-faint uppercase tracking-wider">
                                                Quantity (Shares)
                                            </label>
                                            <button
                                                type="button"
                                                onClick={handleSetMax}
                                                className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                                            >
                                                MAX {side === 'BUY' ? 'AFFORDABLE' : 'HELD'}
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setQuantity(prev => String(Math.max(1, (parseInt(prev, 10) || 1) - 1)))}
                                                className="w-10 h-10 rounded-xl bg-surface-2 hover:bg-surface-3 border border-white/10 flex items-center justify-center text-ink cursor-pointer active:scale-95 transition-all"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>

                                            <input
                                                type="number"
                                                min="1"
                                                value={quantity}
                                                onChange={(e) => setQuantity(e.target.value)}
                                                className="flex-1 h-10 px-3 rounded-xl border border-white/10 bg-surface-2 text-ink text-center font-bold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-num"
                                            />

                                            <button
                                                type="button"
                                                onClick={() => setQuantity(prev => String((parseInt(prev, 10) || 0) + 1))}
                                                className="w-10 h-10 rounded-xl bg-surface-2 hover:bg-surface-3 border border-white/10 flex items-center justify-center text-ink cursor-pointer active:scale-95 transition-all"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Order Cost Breakdown */}
                                    <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
                                        <div className="flex items-center justify-between text-ink-muted">
                                            <span>Estimated Order Value</span>
                                            <span className="font-semibold text-ink-heading font-num">₹{fmt(estimatedTotal)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-ink-muted">
                                            <span>Available Challenge Cash</span>
                                            <span className="font-semibold text-primary font-num">₹{fmt(challenge.cashBalance)}</span>
                                        </div>
                                        {side === 'BUY' && (
                                            <div className="flex items-center justify-between text-ink-muted">
                                                <span>Remaining After Trade</span>
                                                <span className={`font-semibold font-num ${challenge.cashBalance >= estimatedTotal ? 'text-ink-heading' : 'text-down'}`}>
                                                    ₹{fmt(Math.max(0, challenge.cashBalance - estimatedTotal))}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Submit Action Button */}
                                    <button
                                        type="button"
                                        onClick={placeTrade}
                                        disabled={
                                            placing ||
                                            challenge.status !== 'ACTIVE' ||
                                            !selectedPrice ||
                                            qty <= 0 ||
                                            (side === 'BUY' && estimatedTotal > challenge.cashBalance)
                                        }
                                        className={`w-full h-11 rounded-xl font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
                                            side === 'BUY'
                                                ? 'bg-up text-[#00281b] hover:bg-up-hover shadow-[0_0_18px_rgba(38,208,124,0.25)]'
                                                : 'bg-down text-white hover:bg-down-hover shadow-[0_0_18px_rgba(255,77,106,0.25)]'
                                        }`}
                                    >
                                        {placing ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Executing {side === 'BUY' ? 'Buy' : 'Sell'}...</span>
                                            </>
                                        ) : (
                                            <span>{side === 'BUY' ? 'Buy' : 'Sell'}</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
