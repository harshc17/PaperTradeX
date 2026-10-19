'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import Header from '@/components/dashboard/Header';
import { TrendingUp, TrendingDown, Search, Filter } from 'lucide-react';

const STOCKS = [
    // ── Banking & Financial Services ──
    { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', category: 'Banking' },
    { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', category: 'Banking' },
    { symbol: 'SBIN.NS', name: 'State Bank of India', category: 'Banking' },
    { symbol: 'AXISBANK.NS', name: 'Axis Bank', category: 'Banking' },
    { symbol: 'KOTAKBANK.NS', name: 'Kotak Mahindra Bank', category: 'Banking' },
    { symbol: 'BANKBARODA.NS', name: 'Bank of Baroda', category: 'Banking' },
    { symbol: 'PNB.NS', name: 'Punjab National Bank', category: 'Banking' },
    { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance', category: 'Finance' },
    { symbol: 'BAJAJFINSV.NS', name: 'Bajaj Finserv', category: 'Finance' },
    { symbol: 'SHRIRAMFIN.NS', name: 'Shriram Finance', category: 'Finance' },
    { symbol: 'JIOFIN.NS', name: 'Jio Financial Services', category: 'Finance' },
    { symbol: 'SBILIFE.NS', name: 'SBI Life Insurance', category: 'Finance' },
    { symbol: 'HDFCLIFE.NS', name: 'HDFC Life Insurance', category: 'Finance' },

    // ── Information Technology ──
    { symbol: 'TCS.NS', name: 'Tata Consultancy Services', category: 'Technology' },
    { symbol: 'INFY.NS', name: 'Infosys', category: 'Technology' },
    { symbol: 'HCLTECH.NS', name: 'HCL Technologies', category: 'Technology' },
    { symbol: 'WIPRO.NS', name: 'Wipro', category: 'Technology' },
    { symbol: 'TECHM.NS', name: 'Tech Mahindra', category: 'Technology' },
    { symbol: 'LTIM.NS', name: 'LTIMindtree', category: 'Technology' },
    { symbol: 'PERSISTENT.NS', name: 'Persistent Systems', category: 'Technology' },
    { symbol: 'COFORGE.NS', name: 'Coforge', category: 'Technology' },
    { symbol: 'TATAELXSI.NS', name: 'Tata Elxsi', category: 'Technology' },

    // ── Energy & Utilities ──
    { symbol: 'RELIANCE.NS', name: 'Reliance Industries', category: 'Energy' },
    { symbol: 'NTPC.NS', name: 'NTPC Limited', category: 'Energy' },
    { symbol: 'POWERGRID.NS', name: 'Power Grid Corporation', category: 'Energy' },
    { symbol: 'ONGC.NS', name: 'Oil & Natural Gas Corp', category: 'Energy' },
    { symbol: 'COALINDIA.NS', name: 'Coal India', category: 'Energy' },
    { symbol: 'BPCL.NS', name: 'Bharat Petroleum', category: 'Energy' },
    { symbol: 'IOC.NS', name: 'Indian Oil Corporation', category: 'Energy' },
    { symbol: 'TATAPOWER.NS', name: 'Tata Power', category: 'Energy' },
    { symbol: 'ADANIGREEN.NS', name: 'Adani Green Energy', category: 'Energy' },
    { symbol: 'SUZLON.NS', name: 'Suzlon Energy', category: 'Energy' },

    // ── Automobile & Components ──
    { symbol: 'MARUTI.NS', name: 'Maruti Suzuki', category: 'Automobile' },
    { symbol: 'TATAMOTORS.NS', name: 'Tata Motors', category: 'Automobile' },
    { symbol: 'M&M.NS', name: 'Mahindra & Mahindra', category: 'Automobile' },
    { symbol: 'BAJAJ-AUTO.NS', name: 'Bajaj Auto', category: 'Automobile' },
    { symbol: 'EICHERMOT.NS', name: 'Eicher Motors', category: 'Automobile' },
    { symbol: 'HEROMOTOCO.NS', name: 'Hero MotoCorp', category: 'Automobile' },
    { symbol: 'MRF.NS', name: 'MRF Limited', category: 'Automobile' },

    // ── Healthcare & Pharma ──
    { symbol: 'SUNPHARMA.NS', name: 'Sun Pharma', category: 'Pharma' },
    { symbol: 'CIPLA.NS', name: 'Cipla', category: 'Pharma' },
    { symbol: 'DRREDDY.NS', name: "Dr. Reddy's Laboratories", category: 'Pharma' },
    { symbol: 'DIVISLAB.NS', name: "Divi's Laboratories", category: 'Pharma' },
    { symbol: 'APOLLOHOSP.NS', name: 'Apollo Hospitals', category: 'Pharma' },
    { symbol: 'MAXHEALTH.NS', name: 'Max Healthcare', category: 'Pharma' },
    { symbol: 'LUPIN.NS', name: 'Lupin', category: 'Pharma' },

    // ── Consumer, Retail & FMCG ──
    { symbol: 'ITC.NS', name: 'ITC Limited', category: 'FMCG' },
    { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever', category: 'FMCG' },
    { symbol: 'NESTLEIND.NS', name: 'Nestle India', category: 'FMCG' },
    { symbol: 'TATACONSUM.NS', name: 'Tata Consumer Products', category: 'FMCG' },
    { symbol: 'BRITANNIA.NS', name: 'Britannia Industries', category: 'FMCG' },
    { symbol: 'TITAN.NS', name: 'Titan Company', category: 'Consumer' },
    { symbol: 'TRENT.NS', name: 'Trent Limited (Westside/Zudio)', category: 'Consumer' },
    { symbol: 'ASIANPAINT.NS', name: 'Asian Paints', category: 'Consumer' },
    { symbol: 'PIDILITIND.NS', name: 'Pidilite Industries', category: 'Consumer' },
    { symbol: 'HAVELLS.NS', name: 'Havells India', category: 'Consumer' },
    { symbol: 'DMART.NS', name: 'Avenue Supermarts (DMart)', category: 'Consumer' },

    // ── Metals & Mining ──
    { symbol: 'TATASTEEL.NS', name: 'Tata Steel', category: 'Metals' },
    { symbol: 'JSWSTEEL.NS', name: 'JSW Steel', category: 'Metals' },
    { symbol: 'HINDALCO.NS', name: 'Hindalco Industries', category: 'Metals' },
    { symbol: 'VEDL.NS', name: 'Vedanta', category: 'Metals' },

    // ── Infrastructure, Defence & Capital Goods ──
    { symbol: 'LT.NS', name: 'Larsen & Toubro', category: 'Infrastructure' },
    { symbol: 'ADANIENT.NS', name: 'Adani Enterprises', category: 'Infrastructure' },
    { symbol: 'ADANIPORTS.NS', name: 'Adani Ports & SEZ', category: 'Infrastructure' },
    { symbol: 'ULTRACEMCO.NS', name: 'UltraTech Cement', category: 'Infrastructure' },
    { symbol: 'HAL.NS', name: 'Hindustan Aeronautics', category: 'Defence' },
    { symbol: 'BEL.NS', name: 'Bharat Electronics', category: 'Defence' },
    { symbol: 'BHEL.NS', name: 'Bharat Heavy Electricals', category: 'Capital Goods' },
    { symbol: 'SIEMENS.NS', name: 'Siemens India', category: 'Capital Goods' },
    { symbol: 'POLYCAB.NS', name: 'Polycab India', category: 'Capital Goods' },
    { symbol: 'DIXON.NS', name: 'Dixon Technologies', category: 'Manufacturing' },
    { symbol: 'DLF.NS', name: 'DLF Limited', category: 'Real Estate' },
    { symbol: 'RVNL.NS', name: 'Rail Vikas Nigam Limited', category: 'Railways' },
    { symbol: 'IRFC.NS', name: 'Indian Railway Finance Corp', category: 'Railways' },
    { symbol: 'IRCTC.NS', name: 'IRCTC', category: 'Railways' },
    { symbol: 'MAZDOCK.NS', name: 'Mazagon Dock Shipbuilders', category: 'Defence' },

    // ── Telecom, Media & New-Age ──
    { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel', category: 'Telecom' },
    { symbol: 'ZOMATO.NS', name: 'Zomato', category: 'New-Age' },
    { symbol: 'SWIGGY.NS', name: 'Swiggy', category: 'New-Age' },
    { symbol: 'PAYTM.NS', name: 'One 97 Communications (Paytm)', category: 'New-Age' },
    { symbol: 'NYKAA.NS', name: 'FSN E-Commerce (Nykaa)', category: 'New-Age' },
    { symbol: 'POLICYBZR.NS', name: 'PB Fintech (PolicyBazaar)', category: 'New-Age' },
];

type QuoteData = { symbol: string; price: number; change: number; dayChange: number };

export default function StockScreenerPage() {
    const router = useRouter();
    const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [searchResults, setSearchResults] = useState<typeof STOCKS>([]);
    const subbedRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const s = getSocket();

        const onUpdate = (payload: Record<string, any>) => {
            setQuotes(prev => {
                const next = { ...prev };
                Object.entries(payload).forEach(([sym, d]: [string, any]) => {
                    const normalizedSym = sym.endsWith('.NS') ? sym : `${sym}.NS`;
                    if (typeof d?.price === 'number') {
                        next[normalizedSym] = {
                            symbol: normalizedSym,
                            price: d.price,
                            change: d.change ?? 0,
                            dayChange: d.dayChange ?? 0,
                        };
                    }
                });
                return next;
            });
        };

        s.on('market_update', onUpdate);

        return () => {
            s.off('market_update', onUpdate);
        };
    }, []);

    // API Search Effect
    useEffect(() => {
        if (searchTerm.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        const controller = new AbortController();
        fetch(`http://localhost:3001/api/search?q=${encodeURIComponent(searchTerm)}`, { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
                if (data.quotes) {
                    const results = data.quotes.map((q: any) => ({
                        symbol: q.symbol,
                        name: q.shortname || q.name || q.symbol,
                        category: q.exchange || 'Equity'
                    }));
                    setSearchResults(results);
                }
            })
            .catch(err => {
                if (err.name !== 'AbortError') console.error('Search error:', err);
            });

        return () => controller.abort();
    }, [searchTerm]);

    const categories = ['All', ...Array.from(new Set(STOCKS.map(e => e.category)))];

    const filteredStocks = searchTerm.length >= 2 
        ? searchResults 
        : STOCKS.filter(st => {
            const matchesSearch = st.name.toLowerCase().includes(searchTerm.toLowerCase()) || st.symbol.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = selectedCategory === 'All' || st.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });

    // Dynamic subscription for new symbols
    useEffect(() => {
        const s = getSocket();
        
        filteredStocks.forEach(st => {
            if (!subbedRef.current.has(st.symbol)) {
                subbedRef.current.add(st.symbol);
                s.emit('subscribe', st.symbol);
                
                fetch(`http://localhost:3001/api/stock/${encodeURIComponent(st.symbol)}/realtime`)
                    .then(r => r.ok ? r.json() : null)
                    .then(d => {
                        if (d && typeof d.price === 'number') {
                            setQuotes(prev => ({
                                ...prev,
                                [st.symbol]: {
                                    symbol: st.symbol,
                                    price: d.price,
                                    change: d.change ?? 0,
                                    dayChange: d.dayChange ?? 0,
                                }
                            }));
                        }
                    })
                    .catch(() => null);
            }
        });
    }, [filteredStocks]);

    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="min-h-screen bg-transparent font-sans page-fade-in">
            <Header />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-[26px] font-semibold text-[#3b4252] font-heading">Stock Screener</h1>
                        <p className="text-gray-500 text-sm mt-1">Analyze and discover all equities in the Indian market</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search all stocks..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00b386]/20 focus:border-[#00b386] w-full md:w-64 transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Categories - Only show when not searching globally */}
                {searchTerm.length < 2 && (
                    <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                        <Filter className="w-4 h-4 text-gray-400 mr-2" />
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                                    selectedCategory === cat
                                        ? 'bg-[#3b4252] text-white shadow-sm'
                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}

                {searchTerm.length >= 2 && (
                    <div className="mb-4 text-sm text-gray-500">
                        Showing global search results for <span className="font-semibold text-gray-900">"{searchTerm}"</span>
                    </div>
                )}

                <div className="bg-white rounded-[16px] border border-gray-200/80 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-[12px] font-semibold text-gray-500 uppercase tracking-wider">
                                    <th className="px-6 py-4">Company Name</th>
                                    <th className="px-6 py-4">Sector</th>
                                    <th className="px-6 py-4 text-right">LTP</th>
                                    <th className="px-6 py-4 text-right">Change</th>
                                    <th className="px-6 py-4 text-right">1D Return</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredStocks.length > 0 ? (
                                    filteredStocks.map(st => {
                                        const q = quotes[st.symbol];
                                        const isUp = (q?.change ?? 0) >= 0;
                                        const initials = st.symbol.substring(0, 2);

                                        return (
                                            <tr
                                                key={st.symbol}
                                                className="hover:bg-gray-50/60 transition-colors cursor-pointer group"
                                                onClick={() => router.push(`/stock/${encodeURIComponent(st.symbol)}`)}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center text-[11px] font-bold text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                                                            {initials}
                                                        </div>
                                                        <div>
                                                            <p className="text-[14px] font-semibold text-[#3b4252] group-hover:text-[#00b386] transition-colors">{st.name}</p>
                                                            <p className="text-[12px] text-gray-400">{st.symbol.replace('.NS', '')}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[11px] font-medium rounded-lg">
                                                        {st.category}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {q ? (
                                                        <p className="text-[14px] font-bold text-[#3b4252]">₹{fmt(q.price)}</p>
                                                    ) : (
                                                        <div className="w-16 h-4 bg-gray-100 rounded animate-pulse ml-auto" />
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {q ? (
                                                        <div className={`flex items-center justify-end gap-1 ${isUp ? 'text-[#00b386]' : 'text-[#eb5b3c]'}`}>
                                                            {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                                            <span className="text-[13px] font-semibold">{isUp ? '+' : ''}{fmt(q.change)}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="w-12 h-4 bg-gray-100 rounded animate-pulse ml-auto" />
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {q ? (
                                                        <span className={`text-[12px] font-bold px-2.5 py-1.5 rounded-lg ${isUp ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                                                            {isUp ? '+' : ''}{q.dayChange.toFixed(2)}%
                                                        </span>
                                                    ) : (
                                                        <div className="w-14 h-6 bg-gray-100 rounded-lg animate-pulse ml-auto" />
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={e => { e.stopPropagation(); router.push(`/stock/${encodeURIComponent(st.symbol)}`); }}
                                                        className="px-4 py-1.5 text-[13px] font-semibold text-[#00b386] border border-[#00b386] rounded-xl hover:bg-[#00b386] hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        Trade
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400 text-sm">
                                            {searchTerm.length >= 2 ? `No stocks found matching "${searchTerm}".` : "No stocks found matching your criteria."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
