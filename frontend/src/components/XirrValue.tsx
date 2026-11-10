import { formatXirr, type XirrResult } from '@/lib/xirr';

export default function XirrValue({ result, large = false }: { result?: XirrResult; large?: boolean }) {
    const rate = result?.rate ?? null;
    const description = rate === null ? result?.reason || 'XIRR is not available yet' : 'Annualised money-weighted return using dated purchases, sales and current holding value. Cash balance is excluded.';
    return <div className="min-w-0" title={description}>
        <p aria-label={rate === null ? `XIRR unavailable: ${description}` : undefined} className={`whitespace-nowrap font-num tabular-nums font-medium ${large ? 'text-[28px]' : 'text-sm'} ${rate === null ? 'text-ink-muted' : rate >= 0 ? 'text-up' : 'text-down'}`}>{rate === null ? '—' : formatXirr(rate)}</p>
    </div>;
}
