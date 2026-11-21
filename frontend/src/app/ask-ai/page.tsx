'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Send, Loader2 } from 'lucide-react';
import Header from '@/components/dashboard/Header';
import KnowledgeLibrary from '@/components/KnowledgeLibrary';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/backend';
import { API_URL } from '@/lib/config';

type Source = { citation: string; id: string; title: string; url?: string; scope: string; text: string };
type Result = { mode: 'generated' | 'retrieval' | 'no_sources'; answer: string; sources: Source[];
    performance: { completedSales: number; netRealisedPnl: number; winRate: number | null } | null };
type Entry = { question: string; result: Result };
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
    const [question, setQuestion] = useState('');
    const [performance, setPerformance] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [entries, setEntries] = useState<Entry[]>([]);
    const active = useRef<AbortController | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        request('/config', { signal: controller.signal }).then(data => {
            setGeneration(data.generationAvailable); setReady(true);
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
                body: JSON.stringify({ question: text, includePerformance: performance }) });
            setEntries(previous => [...previous.slice(-9), { question: text, result }]); setQuestion('');
        } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to search.'); }
        finally { if (!controller.signal.aborted) setBusy(false); }
    }
    return <div className="min-h-screen bg-page text-ink">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-9">
            <Link href="/dashboard" className="inline-flex min-h-11 items-center text-sm text-primary">← Explore</Link>
            <div className="mb-6 flex items-start gap-3">
                <BookOpen className="mt-1 h-6 w-6 shrink-0 text-primary" />
                <div className="min-w-0"><h1 className="text-2xl font-semibold tracking-tight">Ask AI</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">Answers from PaperTradeX help and your own documents, with passages you can check.</p></div>
            </div>
            <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <section className="min-w-0 space-y-5" aria-label="Knowledge questions">
                    <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
                        <p className="text-sm font-medium">{!ready ? 'Connecting to your knowledge library…' : generation ? 'AI answers with sources' : 'Source search is ready · AI answers coming soon'}</p>
                        <p className="mt-2 text-xs leading-5 text-ink-muted">{generation ? 'Sending a question shares it and matching passages with Groq. Statistics are included only if you select the option below.' : 'Search works without an AI provider. You’ll see matching passages, without a generated answer.'} Do not include passwords, OTPs or API keys. Questions are independent; earlier messages are not sent as context.</p>
                    </div>
                    {entries.map((entry, index) => <article key={index} className="min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-5">
                        <h2 className="break-words text-base font-semibold">{entry.question}</h2>
                        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-ink-muted">{entry.result.mode === 'generated' ? 'AI answer' : entry.result.mode === 'no_sources' ? 'No supporting sources' : 'Source passages'}</p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{entry.result.answer}</p>
                        {entry.result.performance && <dl className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-surface-2 p-3 text-sm sm:grid-cols-3">
                            <div><dt className="text-xs text-ink-muted">Completed sales</dt><dd className="mt-1">{entry.result.performance.completedSales}</dd></div>
                            <div><dt className="text-xs text-ink-muted">Realised P&L</dt><dd className="mt-1 break-words">₹{entry.result.performance.netRealisedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</dd></div>
                            <div><dt className="text-xs text-ink-muted">Win rate</dt><dd className="mt-1">{entry.result.performance.winRate === null ? 'Unavailable' : `${entry.result.performance.winRate}%`}</dd></div>
                        </dl>}
                        <div className="mt-4 space-y-3">{entry.result.sources.map(source => <details key={source.citation} className="min-w-0 rounded-lg border border-line p-3" open={entry.result.mode === 'retrieval'}>
                            <summary className="cursor-pointer break-words text-sm font-medium leading-6">[{source.citation}] {source.title} <span className="text-xs font-normal text-ink-muted">· {source.scope === 'public' ? 'App help' : source.scope === 'account' ? 'Your statistics' : 'Private document'}</span></summary>
                            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-ink-muted">{source.text}</p>
                            {source.url?.startsWith('/') && !source.url.startsWith('//') && <Link href={source.url} className="mt-2 inline-flex min-h-9 items-center text-xs text-primary">Open related page →</Link>}
                        </details>)}</div>
                    </article>)}
                    <form onSubmit={ask} className="rounded-xl border border-line bg-surface p-4 sm:p-5">
                        <label htmlFor="rag-question" className="text-sm font-medium">Your question</label>
                        <textarea id="rag-question" value={question} disabled={busy} onChange={e => setQuestion(e.target.value)} maxLength={2000} rows={3} placeholder="How is realised P&L calculated?" required className="mt-2 w-full resize-y rounded-lg border border-line bg-page p-3 text-sm outline-none focus:border-primary" />
                        <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-xs leading-5 text-ink-muted"><input type="checkbox" checked={performance} onChange={e => setPerformance(e.target.checked)} className="h-4 w-4 shrink-0 accent-primary" />Include my completed-trade statistics</label>
                        <p className="mb-3 text-xs leading-5 text-ink-muted">Educational support. This assistant cannot place orders or provide live prices. Check generated answers against the sources.</p>
                        <button disabled={busy || !ready || !question.trim()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-black disabled:opacity-50 sm:w-auto">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{busy ? 'Searching sources…' : generation ? 'Ask with sources' : 'Search sources'}</button>
                    </form>
                    {error && <p role="alert" className="break-words text-sm text-down">{error}</p>}
                    <p role="status" className="sr-only">{busy ? 'Searching' : entries.length ? 'Answer and sources ready' : ''}</p>
                </section>
                <KnowledgeLibrary enabled={ready} />
            </div>
        </main>
    </div>;
}
