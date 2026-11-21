'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Send, Loader2 } from 'lucide-react';
import Header from '@/components/dashboard/Header';
import RagPortfolioSnapshot, { type PortfolioSnapshot } from '@/components/RagPortfolioSnapshot';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/backend';
import { API_URL } from '@/lib/config';

type Source = { citation: string; id: string; title: string; url?: string; referenceUrl?: string; scope: string; text: string };
type Result = { mode: 'generated' | 'retrieval' | 'no_sources'; answer: string; sources: Source[];
    basis?: string; retrieval?: string;
    portfolio?: PortfolioSnapshot | null;
    performance: { completedSales: number; netRealisedPnl: number; winRate: number | null } | null };
type Entry = { id: number; question: string; result: Result };
async function request(path: string, init: RequestInit = {}) {
    const token = localStorage.getItem('ptx_token') || localStorage.getItem('token');
    if (!token) throw new Error('Please sign in again.');
    const response = await apiFetch(`${API_URL}/api/rag${path}`, { ...init, cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The knowledge assistant is unavailable.');
    return data;
}

export default function AskAIPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    useEffect(() => { if (!loading && !user) router.replace('/login'); }, [user, loading, router]);
    if (loading || !user) return null;
    return <KnowledgeAssistant key={user.id} />;
}

function KnowledgeAssistant() {
    const [ready, setReady] = useState(false);
    const [generation, setGeneration] = useState(false);
    const [provider, setProvider] = useState('Gemini');
    const [question, setQuestion] = useState('');
    const [performance, setPerformance] = useState(false);
    const [includePortfolio, setIncludePortfolio] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [entries, setEntries] = useState<Entry[]>([]);
    const active = useRef<AbortController | null>(null);
    const sequence = useRef(0);
    useEffect(() => {
        const controller = new AbortController();
        request('/config', { signal: controller.signal }).then(data => {
            setGeneration(data.generationAvailable); setProvider(data.provider === 'openai' ? 'OpenAI' : 'Gemini'); setReady(true);
        }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
        return () => { controller.abort(); active.current?.abort(); };
    }, []);
    async function ask(event: React.FormEvent) {
        event.preventDefault();
        if (busy || !ready || !question.trim()) return;
        const text = question.trim();
        const controller = new AbortController();
        active.current = controller; setBusy(true); setError('');
        try {
            const result: Result = await request('/ask', { method: 'POST', signal: controller.signal,
                body: JSON.stringify({ question: text, includePerformance: performance, includePortfolio }) });
            const entry = { id: ++sequence.current, question: text, result };
            setEntries(previous => [...previous.slice(-9), entry]); setQuestion('');
        } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to search.'); }
        finally { if (!controller.signal.aborted) setBusy(false); }
    }
    return <div className="min-h-screen bg-page text-ink">
        <Header />
        <main className="mx-auto w-full max-w-3xl px-3 py-3 sm:px-6 sm:py-6">
            <Link href="/dashboard" className="inline-flex min-h-11 items-center text-sm text-primary">← Explore</Link>
            <div className="mb-4 flex items-start gap-2.5">
                <BookOpen className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0"><h1 className="text-2xl font-semibold tracking-tight">Ask AI</h1>
                    <p className="mt-1 text-sm leading-5 text-ink-muted">Ask about your portfolio, finance or the stock market.</p></div>
            </div>
                <section className="flex min-w-0 flex-col gap-4" aria-label="Ask AI questions">
                    <form onSubmit={ask} className="min-w-0 rounded-xl border border-line bg-surface p-3 sm:p-5">
                        <label htmlFor="rag-question" className="text-sm font-medium">Ask question</label>
                        <div className="my-2 flex flex-wrap gap-2">
                            <button type="button" disabled={busy} onClick={() => { setQuestion('What is my current portfolio value, balance and returns?'); setIncludePortfolio(true); }} className="min-h-11 max-w-full rounded-lg border border-line px-3 text-left text-xs leading-5 text-primary">My portfolio →</button>
                            <button type="button" disabled={busy} onClick={() => setQuestion('Explain diversification and market risk in simple terms.')} className="min-h-11 max-w-full rounded-lg border border-line px-3 text-left text-xs leading-5 text-ink-muted">Explain diversification →</button>
                        </div>
                        <textarea id="rag-question" value={question} disabled={busy} onChange={e => setQuestion(e.target.value)} maxLength={2000} rows={2} placeholder="What would you like to know?" required className="mt-1 min-h-20 max-h-48 w-full resize-y rounded-lg border border-line bg-page p-3 text-base leading-6 outline-none focus:border-primary sm:text-sm" />
                        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-xs leading-5 text-ink-muted"><input type="checkbox" checked={includePortfolio} onChange={e => setIncludePortfolio(e.target.checked)} className="h-4 w-4 shrink-0 accent-primary" />Use my holdings, balance and returns for portfolio questions</label>
                        <details className="mb-3 min-w-0"><summary className="min-h-11 cursor-pointer py-3 text-xs text-ink-muted">Answer options & privacy</summary>
                            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-xs leading-5 text-ink-muted"><input type="checkbox" checked={performance} onChange={e => setPerformance(e.target.checked)} className="h-4 w-4 shrink-0 accent-primary" />Include my completed-trade statistics</label>
                            <p className="mt-1 text-xs leading-5 text-ink-muted">{generation ? `Questions, relevant passages and selected account data go to ${provider}.` : 'AI generation is unavailable; portfolio snapshots and source search remain available.'} Semantic retrieval uses Gemini. Each question is independent; chat history is not sent. Never share passwords, OTPs or API keys. Portfolio answers are recorded snapshots and quotes can be delayed. This assistant cannot place orders.</p>
                        </details>
                        <button disabled={busy || !ready || !question.trim()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-black disabled:opacity-50 sm:w-auto">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{busy ? 'Thinking…' : !ready ? 'Connecting…' : generation ? 'Ask AI' : 'Search sources'}</button>
                        <p className="mt-2 text-xs leading-5 text-ink-muted">AI can make mistakes. Check figures and references before relying on an answer.</p>
                    </form>
                    {error && <p role="alert" className="break-words text-sm text-down">{error}</p>}
                    {[...entries].reverse().map(entry => <article key={entry.id} className="min-w-0 rounded-xl border border-line bg-surface p-3 sm:p-5">
                        <h2 className="break-words text-base font-semibold">{entry.question}</h2>
                        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-ink-muted">{entry.result.mode === 'generated' ? 'AI answer' : entry.result.mode === 'no_sources' ? 'No supporting sources' : 'Source passages'}</p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{entry.result.answer}</p>
                        {entry.result.sources.length > 0 && <p className="mt-2 text-xs text-ink-muted">{entry.result.retrieval === 'hybrid' ? 'Semantic + keyword retrieval' : 'Keyword retrieval'} · {entry.result.sources.length} sources</p>}
                        {entry.result.basis === 'general_education' && <p className="mt-2 text-xs leading-5 text-ink-muted">Includes general model knowledge, not verified live market research. Sources below support only the claims they address.</p>}
                        {entry.result.portfolio && <RagPortfolioSnapshot snapshot={entry.result.portfolio} />}
                        {entry.result.performance && <dl className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-surface-2 p-3 text-sm sm:grid-cols-3">
                            <div><dt className="text-xs text-ink-muted">Completed sales</dt><dd className="mt-1">{entry.result.performance.completedSales}</dd></div>
                            <div><dt className="text-xs text-ink-muted">Realised P&L</dt><dd className="mt-1 break-words">₹{entry.result.performance.netRealisedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</dd></div>
                            <div><dt className="text-xs text-ink-muted">Win rate</dt><dd className="mt-1">{entry.result.performance.winRate === null ? 'Unavailable' : `${entry.result.performance.winRate}%`}</dd></div>
                        </dl>}
                        {entry.result.sources.length > 0 && <details className="mt-3 min-w-0" open={entry.result.mode === 'retrieval'}><summary className="min-h-11 cursor-pointer py-3 text-xs font-medium text-ink-muted">Sources ({entry.result.sources.length})</summary><div className="space-y-2">{entry.result.sources.map(source => <details key={source.citation} className="min-w-0 rounded-lg border border-line p-3" open={entry.result.mode === 'retrieval'}>
                            <summary className="cursor-pointer break-words text-sm font-medium leading-6">[{source.citation}] {source.title} <span className="text-xs font-normal text-ink-muted">· {source.scope === 'public' ? 'App help' : source.scope === 'education' ? 'Education' : source.scope === 'account' ? 'Your statistics' : 'Private document'}</span></summary>
                            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-ink-muted">{source.text}</p>
                            {source.url?.startsWith('/') && !source.url.startsWith('//') && <Link href={source.url} className="mt-2 inline-flex min-h-9 items-center text-xs text-primary">Open related page →</Link>}
                            {source.referenceUrl?.startsWith('https://investor.sebi.gov.in/') && <a href={source.referenceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-9 items-center text-xs text-primary">Read SEBI Investor reference ↗</a>}
                        </details>)}</div></details>}
                    </article>)}

                    <p role="status" className="sr-only">{busy ? 'Searching' : entries.length ? 'Answer and sources ready' : ''}</p>
                </section>
        </main>
    </div>;
}
