'use client';

export type PortfolioSnapshot = {
    capturedAt: string; returnSessionDate: string; marketOpen: boolean; balance: number;
    invested: number; currentValue: number | null; totalReturns: number | null; totalReturnsPercent: number | null;
    todayReturns: number | null; todayReturnsPercent: number | null; quotesDelayedOrUnavailable: boolean;
    holdings: { symbol: string; quantity: number; averagePrice: number; price: number | null;
        currentValue: number | null; totalReturns: number | null; quoteAt: string | null; status: string }[];
};
const rupees = (n: number | null) => n === null ? 'Unavailable' : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const at = (value: string) => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
export default function RagPortfolioSnapshot({ snapshot }: { snapshot: PortfolioSnapshot }) {
    return <section className="mt-4 min-w-0 rounded-xl border border-line p-3 sm:p-4" aria-label="Your portfolio snapshot">
        <h3 className="text-sm font-semibold">Your portfolio · recorded snapshot</h3>
        <p className="mt-1 text-xs leading-5 text-ink-muted">As of {at(snapshot.capturedAt)} IST. Ask again to refresh; this answer does not update automatically.</p>
        {snapshot.quotesDelayedOrUnavailable && <p className="mt-2 text-xs leading-5 text-[var(--warning)]">Some quotes are delayed or unavailable. Missing values are left unavailable, rather than counted as zero.</p>}
        <dl className="my-4 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
            {[
                ['Available balance', rupees(snapshot.balance)], ['Holdings value', rupees(snapshot.currentValue)],
                ['Invested', rupees(snapshot.invested)], ['Total unrealised returns', rupees(snapshot.totalReturns)],
                ['Total returns %', snapshot.totalReturnsPercent === null ? 'Unavailable' : `${snapshot.totalReturnsPercent.toFixed(2)}%`],
                ['1D return', `${rupees(snapshot.todayReturns)}${snapshot.todayReturnsPercent === null ? '' : ` (${snapshot.todayReturnsPercent.toFixed(2)}%)`}`],
            ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs leading-5 text-ink-muted">{label}</dt><dd className="mt-1 break-words text-sm font-medium tabular-nums">{value}</dd></div>)}
        </dl>
        <p className="mb-3 text-xs leading-5 text-ink-muted">Holdings value excludes cash. 1D return is for {snapshot.returnSessionDate}, including that session’s sales. {snapshot.marketOpen ? 'Market open.' : 'Market closed; showing last available quotes.'}</p>
        {!snapshot.holdings.length && <p className="text-sm">You currently have no holdings.</p>}
        <ul className="space-y-3">{snapshot.holdings.map(holding => <li key={holding.symbol} className="min-w-0 border-t border-line pt-3">
            <p className="break-words text-sm font-semibold">{holding.symbol} <span className="font-normal text-ink-muted">· {holding.quantity} shares</span></p>
            <dl className="mt-2 grid grid-cols-1 gap-2 text-xs min-[380px]:grid-cols-2">
                {[
                    ['Average purchase', rupees(holding.averagePrice)], ['Quote price', rupees(holding.price)],
                    ['Current value', rupees(holding.currentValue)], ['Unrealised P&L', rupees(holding.totalReturns)],
                ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-ink-muted">{label}</dt><dd className="mt-1 break-words tabular-nums">{value}</dd></div>)}
            </dl>
            <p className="mt-2 text-xs leading-5 text-ink-muted">{holding.status.replaceAll('_', ' ')}{holding.quoteAt ? ` · ${at(holding.quoteAt)} IST` : ''}</p>
        </li>)}</ul>
    </section>;
}
