import type { PortfolioSnapshot } from './RagPortfolioSnapshot';

type Holding = PortfolioSnapshot['holdings'][number];
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const format = (value: number | null | undefined) => value == null ? '—' : money.format(value);
const signed = (value: number) => value > 0 ? `+${format(value)}` : format(value);
const palette = ['#14b8a6', '#6696ee', '#b28be4', '#d4983b', '#e4789b', '#6fa471', '#808897'];

export default function PortfolioBreakdown({ snapshot }: { snapshot: PortfolioSnapshot }) {
    const groups = [
        { label: 'In profit', tone: 'text-up', holdings: snapshot.holdings.filter(row => (row.totalReturns ?? 0) > 0).sort((a, b) => b.totalReturns! - a.totalReturns!) },
        { label: 'In loss', tone: 'text-down', holdings: snapshot.holdings.filter(row => (row.totalReturns ?? 0) < 0).sort((a, b) => a.totalReturns! - b.totalReturns!) },
        { label: 'At break-even', tone: 'text-ink-muted', holdings: snapshot.holdings.filter(row => row.totalReturns === 0) },
        { label: 'Valuation unavailable', tone: 'text-ink-muted', holdings: snapshot.holdings.filter(row => row.totalReturns === null) },
    ];
    const biggestMoves = [...groups[0].holdings.slice(0, 3), ...groups[1].holdings.slice(0, 3)];
    const magnitude = Math.max(0, ...biggestMoves.map(row => Math.abs(row.totalReturns!)));

    return <div className="mt-5 space-y-5 border-t border-line pt-5">
        <ValueComparison invested={snapshot.invested} currentValue={snapshot.currentValue} />
        <div className="grid gap-4 lg:grid-cols-2">
            <section className="min-w-0 rounded-xl bg-surface-2 p-4" aria-label="Holdings allocation">
                <h4 className="text-sm font-semibold">Holdings allocation</h4>
                <p className="mt-1 text-xs text-ink-muted">Share of holdings value, excluding cash.</p>
                <Allocation holdings={snapshot.holdings} total={snapshot.currentValue} />
            </section>
            <section className="min-w-0 rounded-xl bg-surface-2 p-4" aria-label="Largest unrealised gains and losses">
                <h4 className="text-sm font-semibold">Largest gains and losses</h4>
                <p className="mt-1 text-xs text-ink-muted">Unrealised P&amp;L by holding.</p>
                {magnitude === 0 ? <p className="mt-4 text-sm text-ink-muted">No valued positions with a gain or loss.</p> :
                    <ul className="mt-4 space-y-3">{biggestMoves.map(row => {
                        const value = row.totalReturns!;
                        const positive = value > 0;
                        return <li key={row.symbol} className="min-w-0">
                            <div className="mb-1 flex justify-between gap-2 text-xs font-medium tabular-nums">
                                <span className="min-w-0 break-words">{row.symbol}</span>
                                <span className={positive ? 'text-up' : 'text-down'}>{signed(value)}</span>
                            </div>
                            <div aria-hidden="true" className="relative h-2 rounded-full bg-surface">
                                <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--text-faint)]" />
                                <div className={`absolute inset-y-0 rounded-full ${positive ? 'left-1/2 bg-[var(--up)]' : 'right-1/2 bg-[var(--down)]'}`}
                                    style={{ width: `${Math.abs(value) / magnitude * 50}%` }} />
                            </div>
                        </li>;
                    })}</ul>}
            </section>
        </div>
        <section aria-label="Profit and loss by holding">
            <h4 className="text-sm font-semibold">Profit and loss by holding</h4>
            <div className="mt-3 flex flex-wrap gap-2">
                {groups.map(group => <span key={group.label} className="rounded-full border border-line px-2.5 py-1 text-xs">
                    <strong className={group.tone}>{group.holdings.length}</strong> {group.label.toLowerCase()}
                </span>)}
            </div>
            {groups.filter(group => group.holdings.length).map(group => <div key={group.label} className="mt-4">
                <h5 className={`text-sm font-semibold ${group.tone}`}>{group.label}</h5>
                <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
                    {group.holdings.map(row => <li key={row.symbol} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-3 py-2.5 text-xs sm:text-sm">
                        <span className="break-words font-semibold">{row.symbol}</span>
                        <span className={`text-right font-semibold tabular-nums ${group.tone}`}>{row.totalReturns === null ? 'Unavailable' : signed(row.totalReturns)}{row.totalReturnsPercent != null && ` (${row.totalReturnsPercent.toFixed(2)}%)`}</span>
                        <span className="text-ink-muted">{row.quantity} {row.quantity === 1 ? 'unit' : 'units'} · Avg. {format(row.averagePrice)}</span>
                        <span className="text-right text-ink-muted tabular-nums">Value {format(row.currentValue)}</span>
                    </li>)}
                </ul>
            </div>)}
        </section>
    </div>;
}

function ValueComparison({ invested, currentValue }: { invested: number; currentValue: number | null }) {
    const maximum = Math.max(invested, currentValue ?? 0, 1);
    const metrics = [
        { label: 'Invested', value: invested, fill: '#6696ee' },
        { label: 'Current value', value: currentValue, fill: '#14b8a6' },
    ];
    return <section className="rounded-xl bg-surface-2 p-4" aria-label="Invested versus current holdings value">
        <h4 className="text-sm font-semibold">Portfolio value overview</h4>
        <dl className="mt-4 space-y-3">{metrics.map(({ label, value, fill }) => <div key={label}>
            <div className="mb-1 flex flex-wrap justify-between gap-x-3 text-xs font-medium">
                <dt>{label}</dt><dd className="tabular-nums">{value === null ? 'Unavailable' : format(value)}</dd>
            </div>
            {value !== null && <div aria-hidden="true" className="h-2 rounded-full bg-surface">
                <div className="h-full rounded-full" style={{ width: `${value / maximum * 100}%`, backgroundColor: fill }} />
            </div>}
        </div>)}</dl>
    </section>;
}

function Allocation({ holdings, total }: { holdings: Holding[]; total: number | null }) {
    if (total === null || total <= 0 || holdings.some(row => row.currentValue === null)) {
        return <p className="mt-4 text-sm text-ink-muted">Allocation needs a complete holdings valuation.</p>;
    }
    const sorted = [...holdings].sort((a, b) => b.currentValue! - a.currentValue!);
    const visible = sorted.slice(0, palette.length - 1).map(row => ({ label: row.symbol, value: row.currentValue! }));
    if (sorted.length >= palette.length) {
        visible.push({ label: 'Other holdings', value: sorted.slice(palette.length - 1).reduce((sum, row) => sum + row.currentValue!, 0) });
    }
    // Normalize displayed slice angles so rounded valuations still fill the circle.
    const plottedTotal = visible.reduce((sum, row) => sum + row.value, 0);
    if (plottedTotal <= 0) return <p className="mt-4 text-sm text-ink-muted">Allocation is unavailable.</p>;
    let cursor = 0;
    const arcs = visible.map((row, i) => {
        const start = cursor;
        cursor += row.value / plottedTotal * 100;
        return `${palette[i]} ${start}% ${cursor}%`;
    });
    return <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
        <div aria-hidden="true" className="grid h-28 w-28 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${arcs.join(', ')})` }}>
            <span className="h-16 w-16 rounded-full bg-surface-2" />
        </div>
        <ul className="min-w-[9rem] flex-1 space-y-2 text-xs">{visible.map((row, i) => <li key={row.label} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 break-words"><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: palette[i] }} />{row.label}</span>
            <span className="shrink-0 tabular-nums">{(row.value / plottedTotal * 100).toFixed(1)}%</span>
        </li>)}</ul>
    </div>;
}
