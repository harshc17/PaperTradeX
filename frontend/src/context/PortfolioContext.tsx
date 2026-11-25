'use client';
import { apiFetch as fetch } from '@/lib/backend';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { getSocket } from '@/lib/socket';
import { API_URL as API } from '@/lib/config';
import { useAuth } from './AuthContext';
import { calculateDailyReturn } from '@/lib/dailyReturn';
import { quoteAdvanced } from '@/lib/quoteProgress';
import { calculatePortfolioXirr, type XirrResult } from '@/lib/xirr';

function normalizeSymbol(symbol: string) {
    return symbol.trim().toUpperCase().replace(/\.NS$/i, '');
}

export interface PortfolioItem {
    symbol: string;
    quantity: number;
    averagePrice: number;
    currentPrice?: number;
    currentValue?: number;
    pnl?: number;
    pnlPercent?: number;
    dayChange?: number;
    dayPnl?: number;
    dayPnlPercent?: number;
    dayPnlReady?: boolean;
    xirr?: XirrResult;
}

interface Order {
    id: number;
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: string;
    limitPrice?: number;
    status: string;
    createdAt: string;
    price?: number;
    totalAmount?: number;
}

export interface Transaction {
    id: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    totalAmount: number;
    createdAt: string;
}

export interface MarketStatusInfo {
    returnSessionDate?: string;
    isOpen: boolean;
    session: 'REGULAR' | 'PRE_MARKET' | 'POST_MARKET' | 'CLOSED';
    sessionName: string;
    isWeekend: boolean;
    isHoliday: boolean;
    holidayName: string | null;
    currentTimeIST: string;
    nextOpenTime: string;
    nextOpenFormatted: string;
    closeTime: string | null;
    secondsUntilOpen: number;
    secondsUntilClose: number;
    countdown: string;
    statusMessage: string;
    exchange: string;
}

interface PortfolioContextType {
    holdingsReady: boolean;
    portfolioError: string | null;
    pricesStale: boolean;
    quoteTimes: Record<string, number>;
    quoteSources: Record<string, string>;
    livePreviousClose: Record<string, number>;
    watchSymbol: (symbol: string) => () => void;
    portfolioXirr: XirrResult;
    holdings: PortfolioItem[];
    orders: Order[];
    transactions: Transaction[];
    totalInvested: number;
    currentValue: number;
    totalReturns: number;
    totalReturnsPercent: number;
    todayReturns: number;
    todayReturnsPercent: number;
    todayReturnsReady: boolean;
    livePrices: Record<string, number>;
    liveChanges: Record<string, number>;
    marketOpen: boolean | null;
    marketStatus: MarketStatusInfo | null;
    refreshMarketStatus: () => Promise<void>;
    refreshPortfolio: () => Promise<void>;
    refreshOrders: () => Promise<void>;
    refreshTransactions: () => Promise<void>;
    executeTrade: (
        symbol: string,
        type: 'BUY' | 'SELL',
        quantity: number,
        price: number,
        orderType?: string,
        limitPrice?: number
    ) => Promise<any>;
    cancelOrder: (orderId: string) => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

function clearAuthState() {
    localStorage.removeItem('ptx_token');
    localStorage.removeItem('token');
    localStorage.removeItem('ptx_user');
    localStorage.removeItem('user');
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
    const [holdings, setHoldings] = useState<PortfolioItem[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [holdingsLoaded, setHoldingsLoaded] = useState(false);
    const [portfolioError, setPortfolioError] = useState<string | null>(null);
    const portfolioRequest = useRef(0);
    const pendingTrades = useRef(new Map<string, string>());
    const [transactionsLoaded, setTransactionsLoaded] = useState(false);
    const [livePrices, setLivePrices] = useState<Record<string, number>>({});
    // Prevent delayed REST responses or broadcasts from rolling a symbol back.
    const latestQuoteAt = useRef<Record<string, number>>({});
    const [quoteTimes, setQuoteTimes] = useState<Record<string, number>>({});
    const [quoteSources, setQuoteSources] = useState<Record<string, string>>({});
    const [watched, setWatched] = useState<Record<string, number>>({});
    const watchSymbol = useCallback((symbol: string) => {
        const key = normalizeSymbol(symbol);
        setWatched(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
        return () => setWatched(prev => ({ ...prev, [key]: Math.max(0, (prev[key] || 0) - 1) }));
    }, []);
    const lastSocketQuoteAt = useRef<Record<string, number>>({});
    const [liveChanges, setLiveChanges] = useState<Record<string, number>>({});
    const [livePreviousClose, setLivePreviousClose] = useState<Record<string, number>>({});
    const [marketOpen, setMarketOpen] = useState<boolean | null>(null);
    const [marketStatus, setMarketStatus] = useState<MarketStatusInfo | null>(null);
    const [now, setNow] = useState(Date.now());
    useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

    const getToken = () => localStorage.getItem('ptx_token') || localStorage.getItem('token') || '';

    const refreshPortfolio = useCallback(async () => {
        const token = getToken();
        if (!token) return;
        const requestId = ++portfolioRequest.current;
        try {
            const res = await fetch(`${API}/api/portfolio`, {
                headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15000),
            });
            if (requestId !== portfolioRequest.current) return;
            if (res.status === 401 || res.status === 403) {
                clearAuthState();
                setPortfolioError('Your session expired. Please sign in again to load your holdings.');
                return;
            }
            if (!res.ok) throw new Error('Holdings request failed');
            if (res.ok) {
                const data = await res.json();
                if (requestId !== portfolioRequest.current) return;
                if (!Array.isArray(data.holdings)) throw new Error('Incomplete holdings response');
                const h: PortfolioItem[] = (data.holdings || []).map((item: any) => ({
                    symbol: normalizeSymbol(item.symbol),
                    quantity: item.quantity,
                    averagePrice: item.averagePrice,
                }));
                setHoldings(h);
                setHoldingsLoaded(true);
                setPortfolioError(null);
            }
        } catch {
            if (requestId === portfolioRequest.current) setPortfolioError('Unable to refresh holdings. Please retry.');
        }
    }, []);

    const refreshOrders = useCallback(async () => {
        const token = getToken();
        if (!token) return;
        try {
            const res = await fetch(`${API}/api/orders`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.status === 401 || res.status === 403) {
                clearAuthState();
                return;
            }
            if (res.ok) {
                const data = await res.json();
                setOrders(data.orders || []);
            }
        } catch (e) { /* silent */ }
    }, []);

    const refreshTransactions = useCallback(async () => {
        const token = getToken();
        if (!token) return;
        try {
            const res = await fetch(`${API}/api/transactions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.status === 401 || res.status === 403) {
                clearAuthState();
                return;
            }
            if (res.ok) {
                const data = await res.json();
                setTransactions(data.transactions || []);
                setTransactionsLoaded(true);
            }
        } catch (e) { /* silent */ }
    }, []);

    const executeTrade = async (
        symbol: string,
        type: 'BUY' | 'SELL',
        quantity: number,
        price: number,
        orderType = 'MARKET',
        limitPrice?: number
    ) => {
        const token = getToken();
        if (!token) throw new Error('Not authenticated');
        // Keep an unresolved order's ID across manual retries and reloads too.
        const pendingKey = `ptx_pending_trade:${authContext.user?.id}:${JSON.stringify([normalizeSymbol(symbol), type, quantity, orderType, limitPrice ?? null])}`;
        let requestKey = pendingTrades.current.get(pendingKey);
        try { requestKey ||= sessionStorage.getItem(pendingKey) || undefined; } catch { /* storage may be disabled */ }
        requestKey ||= crypto.randomUUID();
        pendingTrades.current.set(pendingKey, requestKey);
        try { sessionStorage.setItem(pendingKey, requestKey); } catch { /* retain the in-memory key */ }
        const res = await fetch(`${API}/api/trade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': requestKey },
            body: JSON.stringify({ symbol, type, quantity, price, orderType, limitPrice })
        });
        const data = await res.json();
        if (res.ok || (res.status >= 400 && res.status < 500)) {
            pendingTrades.current.delete(pendingKey);
            try { sessionStorage.removeItem(pendingKey); } catch { /* storage may be disabled */ }
        }
        if (res.status === 401 || res.status === 403) {
            clearAuthState();
            throw new Error(data.error || 'Session expired. Please login again.');
        }
        if (!res.ok) throw new Error(data.error || 'Trade failed');
        // Refresh portfolio after trade
        await Promise.all([refreshPortfolio(), refreshOrders(), refreshTransactions()]);
        return data;
    };

    const cancelOrder = async (orderId: string) => {
        const token = getToken();
        if (!token) throw new Error('Not authenticated');
        const res = await fetch(`${API}/api/orders/${encodeURIComponent(orderId)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.status === 401 || res.status === 403) {
            clearAuthState();
            throw new Error(data.error || 'Session expired. Please login again.');
        }
        if (!res.ok) throw new Error(data.error || 'Failed to cancel order');
        await refreshOrders();
    };

    const applyQuotes = useCallback((payload: Record<string, any>) => {
        const prices: Record<string, number> = {}, changes: Record<string, number> = {};
        const closes: Record<string, number> = {}, times: Record<string, number> = {};
        const sources: Record<string, string> = {};
        for (const [symbol, q] of Object.entries(payload)) {
            const key = normalizeSymbol(symbol), at = Date.parse(q?.timestamp || '');
            if (!(q?.price > 0) || !Number.isFinite(at) || at < (latestQuoteAt.current[key] || 0)) continue;
            latestQuoteAt.current[key] = at;
            prices[key] = q.price; times[key] = at; sources[key] = q.source || 'nse';
            if (Number.isFinite(q.change)) changes[key] = q.change;
            const close = q.prevClose ?? (Number.isFinite(q.change) ? q.price - q.change : null);
            if (close > 0) closes[key] = close;
        }
        if (!Object.keys(prices).length) return;
        setLivePrices(prev => ({ ...prev, ...prices }));
        setLiveChanges(prev => ({ ...prev, ...changes }));
        setLivePreviousClose(prev => ({ ...prev, ...closes }));
        setQuoteTimes(prev => ({ ...prev, ...times }));
        setQuoteSources(prev => ({ ...prev, ...sources }));
    }, []);

    useEffect(() => {
        const socket = getSocket();
        const update = (payload: Record<string, any>) => {
            if (marketOpen === false) return;
            for (const [symbol, quote] of Object.entries(payload)) {
                const key = normalizeSymbol(symbol);
                if (quoteAdvanced(quote, latestQuoteAt.current[key] || 0)) {
                    lastSocketQuoteAt.current[key] = Date.now();
                }
            }
            applyQuotes(payload);
        };
        const tick = (q: any) => { if (q?.symbol) update({ [q.symbol]: q }); };
        socket.on('market_update', update);
        socket.on('price_tick', tick);
        return () => { socket.off('market_update', update); socket.off('price_tick', tick); };
    }, [marketOpen, applyQuotes]);

    // Use Auth context to trigger a refresh when user logs in
    const authContext = useAuth();
    const user = authContext?.user;

    useEffect(() => {
        setHoldingsLoaded(false);
        setPortfolioError(null);
        setTransactionsLoaded(false);
        if (user) {
            refreshPortfolio();
            refreshTransactions();
            const timer = setInterval(() => {
                refreshPortfolio();
                refreshTransactions();
            }, 30000);
            return () => clearInterval(timer);
        } else {
            portfolioRequest.current++;
            setHoldings([]);
            setTransactions([]);
            setOrders([]);
            setLivePrices({});
            setLivePreviousClose({});
        }
    }, [refreshPortfolio, refreshTransactions, user]);

    const refreshMarketStatus = useCallback(async () => {
        try {
            const r = await fetch(`${API}/api/market-status`);
            if (!r.ok) return;
            const d = await r.json();
            setMarketStatus(d);
            if (typeof d?.isOpen === 'boolean') setMarketOpen(d.isOpen);
        } catch {
            // silent
        }
    }, []);

    useEffect(() => {
        refreshMarketStatus();
        const marketTimer = setInterval(refreshMarketStatus, 30000);

        return () => {
            clearInterval(marketTimer);
        };
    }, [refreshMarketStatus]);

    // A single quote pipeline serves both held symbols and open stock pages.
    useEffect(() => {
        let cancelled = false, busy = false;
        const controller = new AbortController();
        const sessionDate = marketStatus?.returnSessionDate;
        const soldToday = transactions.filter(t => t.type === 'SELL' && sessionDate &&
            new Date(Date.parse(t.createdAt) + 330 * 60000).toISOString().slice(0, 10) === sessionDate);
        const symbols = [...new Set([...holdings.map(h => h.symbol), ...soldToday.map(t => t.symbol),
            ...Object.keys(watched).filter(key => watched[key] > 0)].map(normalizeSymbol))];
        const socket = getSocket();
        const subscribe = () => symbols.forEach(key => socket.emit('subscribe', key));
        subscribe(); socket.on('connect', subscribe);
        const refresh = async () => {
            if (busy) return;
            busy = true;
            await Promise.allSettled(symbols.map(async key => {
                if (marketOpen && socket.connected && Date.now() - (lastSocketQuoteAt.current[key] || 0) < 8000) return;
                const response = await fetch(`${API}/api/stock/${encodeURIComponent(key)}/realtime`, { cache: 'no-store', signal: controller.signal });
                if (response.ok) {
                    const quote = await response.json();
                    if (!cancelled) applyQuotes({ [key]: quote });
                }
            }));
            busy = false;
        };
        refresh();
        const interval = setInterval(refresh, marketOpen ? 1000 : 60000);
        return () => {
            cancelled = true; controller.abort(); clearInterval(interval); socket.off('connect', subscribe);
            symbols.forEach(key => socket.emit('deprioritize', key));
        };
    }, [holdings, transactions, watched, marketOpen, marketStatus?.returnSessionDate, applyQuotes]);

    const valuationDate = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
    const xirr = useMemo(() => calculatePortfolioXirr(holdings, transactions, livePrices, valuationDate), [holdings, transactions, livePrices, valuationDate]);
    const waitingXirr: XirrResult = { rate: null, days: 0, reason: 'Waiting for complete transaction history' };
    const xirrReady = holdingsLoaded && transactionsLoaded;
    const portfolioXirr = xirrReady ? xirr.portfolio : waitingXirr;
    const returnSessionDate = marketStatus?.returnSessionDate;
    const dailyReturn = useMemo(() => calculateDailyReturn(holdings, transactions, livePrices, livePreviousClose, returnSessionDate),
        [holdings, transactions, livePrices, livePreviousClose, returnSessionDate]);
    const todayReturnsReady = holdingsLoaded && transactionsLoaded && dailyReturn.ready;
    // Compute derived values with live prices
    const enrichedHoldings = holdings.map(h => {
        const normalizedSymbol = normalizeSymbol(h.symbol);
        const ltp = livePrices[h.symbol] ?? livePrices[normalizedSymbol] ?? NaN;
        const currentValue = h.quantity * ltp;
        const invested = h.quantity * h.averagePrice;
        const pnl = currentValue - invested;
        const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

        const prevClose = livePreviousClose[h.symbol] ?? livePreviousClose[normalizedSymbol];
        const change = liveChanges[h.symbol] ?? liveChanges[normalizedSymbol];
        const dayChange = typeof change === 'number' && Number.isFinite(change)
            ? change
            : (typeof prevClose === 'number' && prevClose > 0 ? (ltp - prevClose) : 0);
        const symbolReturn = dailyReturn.bySymbol[normalizedSymbol];
        const dayPnl = symbolReturn?.value ?? 0;
        const dayPnlPercent = symbolReturn?.percent ?? 0;

        return {
            ...h,
            symbol: normalizedSymbol,
            currentPrice: ltp,
            currentValue,
            pnl,
            pnlPercent,
            dayChange,
            dayPnl,
            dayPnlPercent,
            dayPnlReady: todayReturnsReady && !!symbolReturn?.ready,
            xirr: xirrReady ? xirr.bySymbol[normalizedSymbol] : waitingXirr,
        };
    });

    const totalInvested = holdingsLoaded ? enrichedHoldings.reduce((a, h) => a + h.quantity * h.averagePrice, 0) : NaN;
    const currentValue = holdingsLoaded ? enrichedHoldings.reduce((a, h) => a + (h.currentValue ?? NaN), 0) : NaN;
    const totalReturns = currentValue - totalInvested;
    const totalReturnsPercent = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;
    
    const todayReturns = todayReturnsReady ? dailyReturn.value : 0;
    const todayReturnsPercent = todayReturnsReady ? dailyReturn.percent : 0;

    return (
        <PortfolioContext.Provider value={{
            holdingsReady: holdingsLoaded, portfolioError,
            pricesStale: holdings.some(h => !quoteTimes[h.symbol] || (!!marketOpen && now - quoteTimes[h.symbol] > 60000)),
            quoteTimes, quoteSources, livePreviousClose, watchSymbol,
            holdings: enrichedHoldings,
            portfolioXirr,
            orders,
            transactions,
            totalInvested,
            currentValue,
            totalReturns,
            totalReturnsPercent,
            todayReturns,
            todayReturnsPercent,
            todayReturnsReady,
            livePrices,
            liveChanges,
            marketOpen,
            marketStatus,
            refreshMarketStatus,
            refreshPortfolio,
            refreshOrders,
            refreshTransactions,
            executeTrade,
            cancelOrder,
        }}>
            {children}
        </PortfolioContext.Provider>
    );
}

export function usePortfolio() {
    const ctx = useContext(PortfolioContext);
    if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider');
    return ctx;
}
