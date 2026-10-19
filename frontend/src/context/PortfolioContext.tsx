'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { getSocket } from '@/lib/socket';
import { API_URL as API } from '@/lib/config';
import { useAuth } from './AuthContext';

function normalizeSymbol(symbol: string) {
    return symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
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
    holdings: PortfolioItem[];
    orders: Order[];
    transactions: Transaction[];
    totalInvested: number;
    currentValue: number;
    totalReturns: number;
    totalReturnsPercent: number;
    todayReturns: number;
    todayReturnsPercent: number;
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
    const [livePrices, setLivePrices] = useState<Record<string, number>>({});
    const [liveChanges, setLiveChanges] = useState<Record<string, number>>({});
    const [livePreviousClose, setLivePreviousClose] = useState<Record<string, number>>({});
    const [marketOpen, setMarketOpen] = useState<boolean | null>(null);
    const [marketStatus, setMarketStatus] = useState<MarketStatusInfo | null>(null);
    const closedSnapshotKey = useRef('');

    const getToken = () => localStorage.getItem('ptx_token') || localStorage.getItem('token') || '';

    const refreshPortfolio = useCallback(async () => {
        const token = getToken();
        if (!token) return;
        try {
            const res = await fetch(`${API}/api/portfolio`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.status === 401 || res.status === 403) {
                clearAuthState();
                return;
            }
            if (res.ok) {
                const data = await res.json();
                const h: PortfolioItem[] = (data.holdings || []).map((item: any) => ({
                    symbol: normalizeSymbol(item.symbol),
                    quantity: item.quantity,
                    averagePrice: item.averagePrice,
                }));
                setHoldings(h);
                // Subscribe to live prices for holdings
                const s = getSocket();
                h.forEach(item => s.emit('subscribe', item.symbol));
            }
        } catch (e) { /* silent */ }
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
        const res = await fetch(`${API}/api/trade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ symbol, type, quantity, price, orderType, limitPrice })
        });
        const data = await res.json();
        if (res.status === 401 || res.status === 403) {
            clearAuthState();
            throw new Error(data.error || 'Session expired. Please login again.');
        }
        if (!res.ok) throw new Error(data.error || 'Trade failed');
        // Refresh portfolio after trade
        await refreshPortfolio();
        await refreshOrders();
        await refreshTransactions();
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

    // Keep held symbols subscribed; re-subscribe automatically after reconnect.
    useEffect(() => {
        if (holdings.length === 0) return;
        const s = getSocket();
        const symbols = holdings.map(h => h.symbol);

        const subscribeAll = () => {
            symbols.forEach(sym => s.emit('subscribe', sym));
        };

        subscribeAll();
        s.on('connect', subscribeAll);

        return () => {
            s.off('connect', subscribeAll);
        };
    }, [holdings]);

    // Socket live prices
    useEffect(() => {
        const s = getSocket();
        const handleMarketUpdate = (payload: Record<string, any>) => {
            if (marketOpen === false) return;

            const updates: Record<string, number> = {};
            const changeUpdates: Record<string, number> = {};
            const prevCloseUpdates: Record<string, number> = {};
            
            Object.entries(payload).forEach(([sym, d]: [string, any]) => {
                if (typeof d?.price === 'number') {
                    updates[sym] = d.price;
                    updates[normalizeSymbol(sym)] = d.price;
                }
                if (typeof d?.change === 'number') {
                    changeUpdates[sym] = d.change;
                    changeUpdates[normalizeSymbol(sym)] = d.change;
                }
                if (typeof d?.price === 'number') {
                    const prevClose = typeof d?.change === 'number' && Number.isFinite(d.change)
                        ? d.price - d.change
                        : typeof d?.dayChange === 'number' && Number.isFinite(d.dayChange) && d.dayChange !== 0
                            ? d.price / (1 + (d.dayChange / 100))
                            : null;

                    if (typeof prevClose === 'number' && Number.isFinite(prevClose) && prevClose > 0) {
                        prevCloseUpdates[sym] = prevClose;
                        prevCloseUpdates[normalizeSymbol(sym)] = prevClose;
                    }
                }
            });

            if (Object.keys(updates).length > 0) {
                setLivePrices(prev => {
                    let changed = false;
                    const next = { ...prev };
                    Object.entries(updates).forEach(([sym, price]) => {
                        if (next[sym] === price) return;
                        next[sym] = price;
                        changed = true;
                    });
                    return changed ? next : prev;
                });
            }

            if (Object.keys(changeUpdates).length > 0) {
                setLiveChanges(prev => {
                    let changed = false;
                    const next = { ...prev };
                    Object.entries(changeUpdates).forEach(([sym, change]) => {
                        if (next[sym] === change) return;
                        next[sym] = change;
                        changed = true;
                    });
                    return changed ? next : prev;
                });
            }

            if (Object.keys(prevCloseUpdates).length > 0) {
                setLivePreviousClose(prev => {
                    let changed = false;
                    const next = { ...prev };
                    Object.entries(prevCloseUpdates).forEach(([sym, prevClose]) => {
                        if (next[sym] === prevClose) return;
                        next[sym] = prevClose;
                        changed = true;
                    });
                    return changed ? next : prev;
                });
            }
        };

        s.on('market_update', handleMarketUpdate);

        return () => {
            s.off('market_update', handleMarketUpdate);
        };
    }, [marketOpen]);

    // Use Auth context to trigger a refresh when user logs in
    const authContext = useAuth();
    const user = authContext?.user;

    useEffect(() => {
        if (user) {
            refreshPortfolio();
            refreshOrders();
            refreshTransactions();
        }
    }, [refreshPortfolio, refreshOrders, refreshTransactions, user]);

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

    // Fallback: refresh held-symbol prices periodically via REST in case socket ticks are missed.
    useEffect(() => {
        if (holdings.length === 0) return;

        let isCancelled = false;
        const symbols = holdings.map(h => normalizeSymbol(h.symbol));
        const snapshotKey = symbols.slice().sort().join('|');

        const refreshHeldPrices = async () => {
            const responses = await Promise.allSettled(
                symbols.map(async (sym) => {
                    const r = await fetch(`${API}/api/stock/${encodeURIComponent(sym)}/realtime`);
                    if (!r.ok) return null;
                    const d = await r.json();
                    return typeof d?.price === 'number'
                        ? { symbol: sym, price: d.price, change: d.change, dayChange: d.dayChange, prevClose: d.prevClose }
                        : null;
                })
            );

            if (isCancelled) return;

            const updates: Record<string, number> = {};
            const changeUpdates: Record<string, number> = {};
            const prevCloseUpdates: Record<string, number> = {};
            
            responses.forEach((res) => {
                if (res.status !== 'fulfilled' || !res.value) return;
                
                const d = res.value;
                const sym = d.symbol;
                const normSym = normalizeSymbol(sym);

                updates[sym] = d.price;
                updates[normSym] = d.price;
                
                if (typeof d.change === 'number') {
                    changeUpdates[sym] = d.change;
                    changeUpdates[normSym] = d.change;
                }

                const prevClose = typeof d.prevClose === 'number' && d.prevClose > 0
                    ? d.prevClose
                    : typeof d.change === 'number' && Number.isFinite(d.change)
                        ? d.price - d.change
                        : typeof d.dayChange === 'number' && Number.isFinite(d.dayChange) && d.dayChange !== 0
                            ? d.price / (1 + (d.dayChange / 100))
                            : null;

                if (typeof prevClose === 'number' && Number.isFinite(prevClose) && prevClose > 0) {
                    prevCloseUpdates[sym] = prevClose;
                    prevCloseUpdates[normSym] = prevClose;
                }
            });

            if (Object.keys(updates).length > 0) {
                setLivePrices(prev => ({ ...prev, ...updates }));
            }
            if (Object.keys(changeUpdates).length > 0) {
                setLiveChanges(prev => ({ ...prev, ...changeUpdates }));
            }
            if (Object.keys(prevCloseUpdates).length > 0) {
                setLivePreviousClose(prev => ({ ...prev, ...prevCloseUpdates }));
            }
        };

        if (marketOpen === false) {
            if (closedSnapshotKey.current !== snapshotKey) {
                closedSnapshotKey.current = snapshotKey;
                refreshHeldPrices();
            }

            return () => {
                isCancelled = true;
            };
        }

        closedSnapshotKey.current = '';
        refreshHeldPrices();

        if (marketOpen !== true) {
            return () => {
                isCancelled = true;
            };
        }

        const pollId = setInterval(refreshHeldPrices, 5000);

        return () => {
            isCancelled = true;
            clearInterval(pollId);
        };
    }, [holdings, marketOpen]);

    // Compute derived values with live prices
    const enrichedHoldings = holdings.map(h => {
        const normalizedSymbol = normalizeSymbol(h.symbol);
        const ltp = livePrices[h.symbol] ?? livePrices[normalizedSymbol] ?? h.averagePrice;
        const currentValue = h.quantity * ltp;
        const invested = h.quantity * h.averagePrice;
        const pnl = currentValue - invested;
        const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

        const prevClose = livePreviousClose[h.symbol] ?? livePreviousClose[normalizedSymbol];
        const change = liveChanges[h.symbol] ?? liveChanges[normalizedSymbol];
        const dayChange = typeof change === 'number' && Number.isFinite(change)
            ? change
            : (typeof prevClose === 'number' && prevClose > 0 ? (ltp - prevClose) : 0);
        const dayPnl = h.quantity * dayChange;
        const yesterdayHoldingValue = typeof prevClose === 'number' && prevClose > 0
            ? (h.quantity * prevClose)
            : (currentValue - dayPnl);
        const dayPnlPercent = yesterdayHoldingValue > 0
            ? (dayPnl / yesterdayHoldingValue) * 100
            : (invested > 0 ? (dayPnl / invested) * 100 : 0);

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
        };
    });

    const totalInvested = enrichedHoldings.reduce((a, h) => a + h.quantity * h.averagePrice, 0);
    const currentValue = enrichedHoldings.reduce((a, h) => a + (h.currentValue ?? 0), 0);
    const totalReturns = currentValue - totalInvested;
    const totalReturnsPercent = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;
    
    // 1D Return = sum of (quantity * absolute change today)
    const todayReturns = enrichedHoldings.reduce((a, h) => {
        const currentPrice = h.currentPrice ?? h.averagePrice;
        const prevClose = livePreviousClose[h.symbol] ?? livePreviousClose[normalizeSymbol(h.symbol)];
        const change = liveChanges[h.symbol] ?? liveChanges[normalizeSymbol(h.symbol)];

        if (typeof change === 'number' && Number.isFinite(change)) {
            return a + (h.quantity * change);
        }
        if (typeof prevClose === 'number' && prevClose > 0) {
            return a + (h.quantity * (currentPrice - prevClose));
        }
        return a;
    }, 0);
    // Baseline for today's % return is the value of the portfolio at yesterday's close
    // Yesterday's Value = Current Value - Today's Return
    const yesterdayValue = currentValue - todayReturns;
    const todayReturnsPercent = yesterdayValue > 0
        ? (todayReturns / yesterdayValue) * 100
        : totalInvested > 0
            ? (todayReturns / totalInvested) * 100
            : 0;

    return (
        <PortfolioContext.Provider value={{
            holdings: enrichedHoldings,
            orders,
            transactions,
            totalInvested,
            currentValue,
            totalReturns,
            totalReturnsPercent,
            todayReturns,
            todayReturnsPercent,
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
