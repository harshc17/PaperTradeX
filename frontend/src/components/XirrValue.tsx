import { formatXirr, type XirrResult } from '@/lib/xirr';

export default function XirrValue({ result, large = false }: { result?: XirrResult; large?: boolean }) {
    const rate = result?.rate ?? null;
    return <div className="min-w-0" title="Annualised money-weighted return using dated purchases, sales and current holding value. Cash balance is excluded. Short histories can produce large annualised rates.">
        <p className={`break-words font-num tabular-nums font-medium ${large ? 'text-[28px]' : 'text-sm'} ${rate === null ? 'text-ink-muted' : rate >= 0 ? 'text-up' : 'text-down'}`}>{rate === null ? '—' : formatXirr(rate)}</p>
        <p className="mt-1 max-w-[240px] text-xs text-ink-faint">{rate === null ? result?.reason || 'Waiting for transaction history' : `Annualised · ${result?.days} day${result?.days === 1 ? '' : 's'} of history`}</p>
    </div>;
}
