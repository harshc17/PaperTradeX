'use client';
import { useEffect, useState } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { quoteSymbol } from './quoteSymbol';

export function useStockQuote(symbol: string) {
    const { livePrices, liveChanges, livePreviousClose, quoteTimes, quoteSources, watchSymbol, marketOpen } = usePortfolio();
    const key = quoteSymbol(symbol);
    const [now, setNow] = useState(Date.now());
    useEffect(() => watchSymbol(key), [key, watchSymbol]);
    useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
    const timestamp = quoteTimes[key];
    const stale = !timestamp || (!!marketOpen && now - timestamp > 60000);
    const price = livePrices[key] ?? null;
    const change = liveChanges[key] ?? 0;
    const close = livePreviousClose[key];
    return { price, change, percent: close > 0 ? change / close * 100 : 0, previousClose: close,
        timestamp, source: quoteSources[key], stale, marketOpen };
}
