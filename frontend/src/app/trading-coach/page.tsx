'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import Header from '@/components/dashboard/Header';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/lib/config';

type Metrics = { completedSales: number; wins: number; losses: number; breakEven: number; netRealisedPnl: number; grossProfit: number; grossLoss: number; winRate: number | null; realisedReturnPercent: number | null; averageWin: number | null; averageLoss: number | null; profitFactor: number | null; latestTradeAt: string | null };
type Sale = { symbol: string; quantity: number; proceeds: number; costBasis: number; pnl: number; closedAt: string };
type Review = { summary: string; strengths: string[]; focusAreas: string[]; exercise: string; generatedAt: string };
type Report = { metrics: Metrics; methodology: string; recentSales: Sale[]; revision: string; aiAvailable: boolean; review: Review | null };
const money = (value: number | null) => value === null ? '—' : value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const date = (value: string) => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function TradingCoachPage() {
    const { user, token, loading } = useAuth();
    const router = useRouter();
    const [report, setReport] = useState<Report | null>(null);
    const [fetching, setFetching] = useState(true);
    const [reviewing, setReviewing] = useState(false);
    const [error, setError] = useState('');
    const [refresh, setRefresh] = useState(0);
    const reviewRequest = useRef<AbortController | null>(null);
    useEffect(() => () => reviewRequest.current?.abort(), []);
    useEffect(() => {
        if (!loading && !user) router.replace('/login');
    }, [loading, user, router]);
    useEffect(() => {
        if (!token) return;
        const controller = new AbortController();
        setFetching(true); setError(''); setReport(null);
        fetch(`${API_URL}/api/ai/coach`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
            .then(async response => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Could not load your trade performance.');
                return data;
            })
            .then(data => { if (!controller.signal.aborted) setReport(data); })
            .catch(e => { if (!controller.signal.aborted) setError(e.message || 'Could not load your trade performance.'); })
            .finally(() => { if (!controller.signal.aborted) setFetching(false); });
        return () => controller.abort();
    }, [token, refresh]);

    async function generateReview() {
        if (reviewing || !report?.aiAvailable || !report.metrics.completedSales) return;
        const controller = new AbortController();
        reviewRequest.current = controller;
        setReviewing(true); setError('');
        try {
            const response = await fetch(`${API_URL}/api/ai/coach/review`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'AI review is temporarily unavailable.');
            if (!controller.signal.aborted) setReport({ ...data, aiAvailable: report.aiAvailable });
        } catch (e: any) { if (!controller.signal.aborted) setError(e.message || 'AI review is temporarily unavailable.'); }
        finally { if (!controller.signal.aborted) setReviewing(false); }
    }
    if (loading || !user) return null;
    const metrics = report?.metrics;
    return <div className="min-h-screen">
        <Header />
        <main className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div className="min-w-0"><h1 className="text-2xl sm:text-[28px] font-semibold">Trading coach</h1><p className="mt-2 max-w-2xl text-sm text-ink-muted">Review completed paper trades, understand your results, and build better practice habits.</p></div>
                <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={fetching || reviewing} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm text-ink-muted disabled:opacity-50"><RefreshCw className="h-4 w-4" />Refresh results</button>
            </div>
            {error && <div role="alert" className="mb-5 rounded-xl border border-down/30 bg-down/5 p-4 text-sm text-down break-words">{error}</div>}
            {fetching ? <p role="status" className="flex items-center gap-2 py-8 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" />Calculating your completed-trade performance…</p> : !report ? <button type="button" onClick={() => setRefresh(value => value + 1)} className="min-h-11 text-sm text-primary hover:underline">Try again</button> : <>
                {metrics!.latestTradeAt && <p className="mb-4 text-xs text-ink-faint">Results through {date(metrics!.latestTradeAt)} IST</p>}
                <section aria-label="Completed trade performance" className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                    {[
                        { label: 'Realised profit / loss', value: money(metrics!.netRealisedPnl), note: 'From completed sales only' },
                        { label: 'Win rate', value: metrics!.winRate === null ? '—' : `${metrics!.winRate.toFixed(2)}%`, note: `${metrics!.wins} wins · ${metrics!.losses} losses · ${metrics!.breakEven} break-even` },
                        { label: 'Completed sales', value: String(metrics!.completedSales), note: 'Partial sales count separately' },
                        { label: 'Realised return', value: metrics!.realisedReturnPercent === null ? '—' : `${metrics!.realisedReturnPercent.toFixed(2)}%`, note: 'Profit / loss divided by sold cost basis' },
                    ].map(item => <div key={item.label} className="min-w-0 rounded-xl border border-line bg-surface p-4"><p className="text-xs text-ink-muted">{item.label}</p><p className="mt-3 break-words text-xl sm:text-2xl font-semibold font-num">{item.value}</p><p className="mt-2 text-xs leading-5 text-ink-faint">{item.note}</p></div>)}
                </section>
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] items-start gap-5 mb-7">
                    <section className="min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-6" aria-labelledby="coach-review-heading">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><h2 id="coach-review-heading" className="text-lg font-semibold">AI trade review</h2><button type="button" onClick={generateReview} disabled={reviewing || !report.aiAvailable || !metrics!.completedSales} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-[var(--primary-ink)] disabled:opacity-50">{reviewing && <Loader2 className="h-4 w-4 animate-spin" />}{reviewing ? 'Reviewing…' : report.review ? 'Review again' : 'Review my trades'}</button></div>
                        <p className="text-xs text-ink-faint mb-4">Reviews use calculated trade statistics. Account details and login information are excluded.</p>
                        {!report.aiAvailable && <p className="text-sm text-ink-muted mb-4">AI reviews are not enabled yet. Your verified performance report is available on this page.</p>}
                        {!metrics!.completedSales && <div className="rounded-lg bg-surface-2 p-4"><p className="text-sm text-ink-muted">No completed sales yet. Buy and later sell shares in paper trading to build a record the coach can review.</p><Link href="/dashboard" className="mt-2 inline-flex min-h-11 items-center text-sm text-primary hover:underline">Explore stocks →</Link></div>}
                        {reviewing && <p role="status" className="text-sm text-ink-muted">Reviewing your completed sales and calculated results…</p>}
                        {report.review && <div className="space-y-5 text-sm leading-6 break-words"><p>{report.review.summary}</p>{[{ title: 'What went well', items: report.review.strengths }, { title: 'What to work on', items: report.review.focusAreas }].map(section => <div key={section.title}><h3 className="font-semibold mb-2">{section.title}</h3><ul className="list-disc pl-5 space-y-2">{section.items.map((text, index) => <li key={index}>{text}</li>)}</ul></div>)}<div className="rounded-lg bg-surface-2 p-4"><h3 className="font-semibold mb-1">Next practice exercise</h3><p>{report.review.exercise}</p></div><p className="text-xs text-ink-faint">Reviewed {date(report.review.generatedAt)} IST · Educational feedback on simulated trades.</p></div>}
                    </section>
                    <aside className="min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-5"><h2 className="text-base font-semibold mb-4">Win and loss breakdown</h2><dl className="space-y-4 text-sm">{[{ label: 'Total winning profit', value: money(metrics!.grossProfit) }, { label: 'Total losses', value: money(metrics!.grossLoss) }, { label: 'Average win', value: money(metrics!.averageWin) }, { label: 'Average loss', value: money(metrics!.averageLoss) }, { label: 'Profit factor', value: metrics!.profitFactor === null ? '—' : metrics!.profitFactor.toFixed(2) }].map(item => <div key={item.label} className="flex flex-wrap justify-between gap-2"><dt className="text-ink-muted">{item.label}</dt><dd className="font-num font-medium break-words">{item.value}</dd></div>)}</dl><p className="mt-5 text-xs leading-5 text-ink-faint">Profit factor is winning profit divided by losses. It is unavailable when there are no losses. A small number of sales does not establish a reliable trading pattern.</p></aside>
                </div>
                <section className="min-w-0 rounded-xl border border-line bg-surface overflow-hidden mb-6"><h2 className="px-4 sm:px-6 py-4 text-lg font-semibold">Recent completed sales</h2>{report.recentSales.length ? <div role="region" aria-label="Completed sales details" tabIndex={0} className="overflow-x-auto overscroll-x-contain"><table className="min-w-[680px] w-full text-sm text-left"><thead className="bg-surface-2 text-xs text-ink-muted"><tr>{['Stock', 'Sold', 'Proceeds', 'Cost basis', 'Realised P/L', 'Sale time (IST)'].map(label => <th key={label} scope="col" className="px-4 py-3 whitespace-nowrap">{label}</th>)}</tr></thead><tbody className="divide-y divide-line">{report.recentSales.map((sale, index) => <tr key={`${sale.closedAt}-${index}`}><td className="px-4 py-3 font-medium">{sale.symbol}</td><td className="px-4 py-3 font-num">{sale.quantity}</td><td className="px-4 py-3 whitespace-nowrap font-num">{money(sale.proceeds)}</td><td className="px-4 py-3 whitespace-nowrap font-num">{money(sale.costBasis)}</td><td className={`px-4 py-3 whitespace-nowrap font-num ${sale.pnl < 0 ? 'text-down' : sale.pnl > 0 ? 'text-up' : 'text-ink-muted'}`}>{money(sale.pnl)}</td><td className="px-4 py-3 whitespace-nowrap text-ink-muted">{date(sale.closedAt)}</td></tr>)}</tbody></table></div> : <p className="px-4 sm:px-6 pb-5 text-sm text-ink-muted">Your completed sales will appear here.</p>}</section>
                <details className="text-sm text-ink-muted"><summary className="cursor-pointer min-h-11 py-3">How these results are calculated</summary><p className="max-w-3xl leading-6 pb-4">{report.methodology}</p></details>
            </>}
        </main>
    </div>;
}
