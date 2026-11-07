'use client';

import { useState } from 'react';
import { STOCK_LOGOS } from '@/lib/stock-logos';

export default function CompanyLogo({ symbol, className = 'h-10 w-10' }: { symbol: string; className?: string }) {
    const ticker = symbol.toUpperCase().replace(/\.(NS|BO)$/, '');
    const [failedTicker, setFailedTicker] = useState<string | null>(null);
    const available = /^[A-Z0-9][A-Z0-9&-]{0,29}$/.test(ticker) && failedTicker !== ticker;
    const source = STOCK_LOGOS.has(ticker) ? `/stock-logos/${encodeURIComponent(ticker)}.webp` : `/api/company-logo?symbol=${encodeURIComponent(ticker)}`;

    return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 ${available ? 'bg-white p-1.5' : 'bg-surface-3 text-xs font-bold text-primary'} ${className}`}>
        {available
            ? <img src={source} alt="" width={40} height={40} loading="lazy" decoding="async" className="h-full w-full object-contain" onError={() => setFailedTicker(ticker)} />
            : ticker.replace(/[^A-Z0-9]/g, '').slice(0, 2) || '—'}
    </span>;
}
