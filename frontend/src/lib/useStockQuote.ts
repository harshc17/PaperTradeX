'use client';
import { useEffect, useState } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { quoteSymbol } from './quoteSymbol';
import { stockQuote } from './stockQuote';

export function useStockQuote(symbol: string) {
    const { livePrices, liveChanges, livePreviousClose, quoteTimes, quoteSources, watchSymbol, marketOpen } = usePortfolio();
    const key = quoteSymbol(symbol);
    const [now, setNow] = useState(Date.now());
    useEffect(() => watchSymbol(key), [key, watchSymbol]);
    useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
    return stockQuote({ livePrices, liveChanges, livePreviousClose, quoteTimes, quoteSources, marketOpen }, key, now);
}
