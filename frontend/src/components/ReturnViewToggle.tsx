'use client';
import { usePortfolio } from '@/context/PortfolioContext';

export default function ReturnViewToggle() {
    const { returnView, setReturnView } = usePortfolio();
    return <label className="inline-flex max-w-full items-center gap-2 text-xs text-ink-muted">
        <span className="sr-only">Return calculation</span>
        <select value={returnView} onChange={e => setReturnView(e.target.value === 'xirr' ? 'xirr' : 'absolute')}
            className="min-h-11 max-w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <option value="absolute">Absolute return</option>
            <option value="xirr">XIRR (annualised)</option>
        </select>
    </label>;
}
