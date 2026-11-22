'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUp, MessageCircle, Plus, Settings2, Loader2 } from 'lucide-react';
import { BrandIcon } from '@/components/BrandLogo';
import ThemeToggle from '@/components/ThemeToggle';
import RagPortfolioSnapshot, { type PortfolioSnapshot } from '@/components/RagPortfolioSnapshot';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/backend';
import { API_URL } from '@/lib/config';

type Source = { citation: string; id: string; title: string; url?: string; referenceUrl?: string; scope: string; text: string };
type Result = { mode: 'generated' | 'retrieval' | 'no_sources'; answer: string; sources: Source[];
    basis?: string; retrieval?: string;
    portfolio?: PortfolioSnapshot | null;
    performance: { completedSales: number; netRealisedPnl: number; winRate: number | null } | null };
type Entry = { id: number; question: string; result?: Result; error?: string };
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
    const [options, setOptions] = useState(false);
    const [entries, setEntries] = useState<Entry[]>([]);
    const active = useRef<AbortController | null>(null);
    const sequence = useRef(0);
    const shell = useRef<HTMLDivElement>(null);
    const followLatest = useRef(true);
    const transcript = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        const viewport = window.visualViewport;
        let frame = 0;
        const fitViewport = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const height = viewport?.height ?? window.innerHeight;
                if (shell.current) {
                    shell.current.style.height = `${height}px`;
                    shell.current.style.top = `${viewport?.offsetTop ?? 0}px`;
                    shell.current.style.setProperty('--chat-viewport-height', `${height}px`);
                }
                if (followLatest.current && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
            });
        };
        fitViewport();
        viewport?.addEventListener('resize', fitViewport);
        viewport?.addEventListener('scroll', fitViewport);
        window.addEventListener('resize', fitViewport);
        return () => {
            cancelAnimationFrame(frame);
            viewport?.removeEventListener('resize', fitViewport);
            viewport?.removeEventListener('scroll', fitViewport);
            window.removeEventListener('resize', fitViewport);
        };
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        request('/config', { signal: controller.signal }).then(data => {
            setGeneration(data.generationAvailable); setProvider(data.provider === 'openai' ? 'OpenAI' : 'Gemini'); setReady(true);
        }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
        return () => { controller.abort(); active.current?.abort(); };
    }, []);
    useEffect(() => {
        const area = transcript.current;
        if (area && followLatest.current) area.scrollTop = area.scrollHeight;
    }, [entries]);
    useEffect(() => {
        if (!input.current) return;
        input.current.style.height = 'auto';
        input.current.style.height = `${Math.min(input.current.scrollHeight, 120)}px`;
    }, [question]);
    async function send(text = question.trim(), retryId?: number) {
        if (active.current || !ready || !text.trim()) return;
        const id = retryId ?? ++sequence.current;
        const controller = new AbortController();
        followLatest.current = true;
        active.current = controller; setBusy(true); setError(''); setOptions(false);
        setEntries(previous => retryId
            ? previous.map(entry => entry.id === id ? { id, question: text } : entry)
            : [...previous, { id, question: text }]);
        setQuestion('');
        try {
            const result: Result = await request('/ask', { method: 'POST', signal: controller.signal,
                body: JSON.stringify({ question: text, includePerformance: performance, includePortfolio,
                    history: entries.slice(0, retryId ? entries.findIndex(entry => entry.id === retryId) : entries.length)
                        .filter(entry => entry.result && !entry.error).slice(-4).flatMap(entry => [
                            { role: 'user', content: entry.question.slice(0, 1000) },
                            { role: 'assistant', content: entry.result?.portfolio || entry.result?.performance
                                ? 'An account snapshot was shown; fetch current account facts again.'
                                : withoutCitationMarkers(entry.result!.answer).slice(0, 1000) },
                        ]) }) });
            if (!controller.signal.aborted) setEntries(previous => previous.map(entry => entry.id === id ? { ...entry, result } : entry));
        } catch (e) {
            if (!controller.signal.aborted) setEntries(previous => previous.map(entry => entry.id === id
                ? { ...entry, error: e instanceof Error ? e.message : 'Unable to answer. Please try again.' } : entry));
        } finally {
            if (active.current === controller) { active.current = null; setBusy(false); }
        }
    }
    function newChat() {
        active.current?.abort(); active.current = null; setBusy(false);
        setEntries([]); setQuestion(''); setError(''); input.current?.focus();
    }
    return <div ref={shell} className="fixed inset-x-0 top-0 flex h-dvh min-h-0 flex-col overflow-hidden bg-page text-ink">
        <header className="shrink-0 border-b border-line bg-page px-3 sm:px-6">
            <div className="mx-auto flex min-h-16 max-w-4xl items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                    <Link href="/dashboard" aria-label="Back to Explore" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-surface-2"><ArrowLeft className="h-5 w-5" /></Link>
                    <BrandIcon className="hidden h-8 w-8 sm:block" />
                    <div className="min-w-0"><h1 className="text-base font-semibold sm:text-lg">Ask AI</h1><p className="text-xs text-ink-muted">PaperTradeX assistant</p></div>
                </div>
                <div className="flex shrink-0 items-center gap-2"><ThemeToggle /><button type="button" onClick={newChat} aria-label="New chat" title="New chat" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm hover:bg-surface-2"><Plus className="h-4 w-4" /><span className="hidden sm:inline">New chat</span></button></div>
            </div>
        </header>
        <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col">
            <div ref={transcript} role="region" aria-label="Conversation" tabIndex={0} onScroll={event => { const area = event.currentTarget; followLatest.current = area.scrollHeight - area.scrollTop - area.clientHeight < 60; }} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5 sm:px-6 sm:py-8">
                {!entries.length && <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center py-6">
                    <MessageCircle className="mb-4 h-9 w-9 text-primary" />
                    <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">What’s on your mind?</h2>
                    <p className="mt-3 text-sm leading-6 text-ink-muted">Understand your portfolio, explore the markets, or learn something new about investing.</p>
                    <div className="mt-6 grid gap-2 sm:grid-cols-2">
                        {['What is my current portfolio value, balance and returns?', 'Explain diversification in simple terms.', 'How do ETFs work?', 'What does a stock’s P/E ratio mean?'].map(text => <button key={text} type="button" disabled={!ready || busy} onClick={() => { if (text.includes('my current')) setIncludePortfolio(true); setQuestion(text); input.current?.focus(); }} className="min-h-14 rounded-xl border border-line bg-surface p-3 text-left text-sm leading-5 transition-colors hover:border-primary disabled:opacity-50">{text}</button>)}
                    </div>
                </div>}
                <div className="space-y-6">
                    {entries.map(entry => <article key={entry.id} aria-label={`Question: ${entry.question}`} className="min-w-0 space-y-4">
                        <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-sm bg-surface-2 px-4 py-3 sm:max-w-[80%]"><p className="mb-1 text-xs font-medium text-ink-muted">You</p><p className="whitespace-pre-wrap break-words text-sm leading-6">{entry.question}</p></div>
                        <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                            <BrandIcon className="mt-1 h-7 w-7 shrink-0" />
                            <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-line bg-surface px-3 py-3 sm:px-5 sm:py-4">
                                <p className="text-xs font-semibold text-primary">PaperTradeX AI</p>
                                {entry.result ? <Answer result={entry.result} /> : entry.error ? <div role="alert"><p className="mt-2 break-words text-sm leading-6 text-down">{entry.error}</p><button type="button" disabled={busy} onClick={() => void send(entry.question, entry.id)} className="mt-2 min-h-11 text-sm text-primary disabled:opacity-50">Try again</button></div> : <p className="mt-3 flex items-center gap-2 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Thinking…</p>}
                            </div>
                        </div>
                    </article>)}
                </div>
            </div>
            <div className="shrink-0 border-t border-line bg-page px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-6">
                {error && <p role="alert" className="mb-2 break-words text-sm text-down">{error}</p>}
                <form onSubmit={event => { event.preventDefault(); void send(); }} className="rounded-2xl border border-line bg-surface p-3 focus-within:border-primary">
                    <div className="flex items-center justify-between gap-2">
                        <label htmlFor="rag-question" className="text-xs font-medium text-ink-muted">Ask question</label>
                        <button type="button" aria-label="Answer options and privacy" aria-expanded={options} aria-controls="chat-options" onClick={() => setOptions(!options)} className="-my-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2"><Settings2 className="h-4 w-4" /></button>
                    </div>
                    {options && <div id="chat-options" style={{ maxHeight: 'calc(var(--chat-viewport-height, 100dvh) * 0.25)' }} className="mb-2 overflow-y-auto overscroll-contain border-b border-line pb-2">
                        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs leading-5 text-ink-muted"><input type="checkbox" checked={includePortfolio} onChange={e => setIncludePortfolio(e.target.checked)} className="h-4 w-4 shrink-0 accent-primary" />Use my holdings, balance and returns for portfolio questions</label>
                        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs leading-5 text-ink-muted"><input type="checkbox" checked={performance} onChange={e => setPerformance(e.target.checked)} className="h-4 w-4 shrink-0 accent-primary" />Include my completed-trade statistics</label>
                        <p className="text-xs leading-5 text-ink-muted">{generation ? `Questions, relevant passages and selected account data go to ${provider}.` : 'AI generation is unavailable; portfolio snapshots and source search remain available.'} Semantic retrieval uses Gemini. Up to four earlier exchanges are used for follow-up questions. Portfolio follow-ups fetch a fresh snapshot; earlier account figures are not reused. Chat stays on this page and clears when you leave or start a new chat. Never share passwords, OTPs or API keys. Quotes can be delayed. This assistant cannot place orders.</p>
                    </div>}
                    <div className="mt-2 flex items-end gap-2">
                        <textarea ref={input} id="rag-question" style={{ maxHeight: 'min(120px, calc(var(--chat-viewport-height, 100dvh) * 0.18))' }} value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} maxLength={2000} rows={1} placeholder="Message Ask AI…" className="min-h-11 min-w-0 flex-1 resize-none overflow-y-auto overscroll-contain bg-transparent py-2 text-base leading-6 outline-none" />
                        <button type="submit" aria-label={busy ? 'Waiting for reply' : !ready ? 'Connecting' : 'Send message'} disabled={busy || !ready || !question.trim()} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-black disabled:opacity-40">{busy || !ready ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" /> : <ArrowUp className="h-5 w-5" />}</button>
                    </div>
                </form>
                <p className="mt-2 text-center text-[11px] leading-4 text-ink-muted">AI can make mistakes. Verify figures and references. <span className="hidden sm:inline">Enter to send · Shift + Enter for a new line.</span></p>
            </div>
            <p role="status" className="sr-only">{busy ? 'AI is thinking' : entries.length ? 'Reply ready' : ready ? 'Ready for your question' : 'Connecting'}</p>
        </main>
    </div>;
}

function Answer({ result }: { result: Result }) {
    return <>
                        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-ink-muted">{result.mode === 'generated' ? 'AI answer' : result.mode === 'no_sources' ? 'No supporting sources' : 'Source passages'}</p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{withoutCitationMarkers(result.answer)}</p>
                        {result.sources.length > 0 && <p className="mt-2 text-xs text-ink-muted">{result.retrieval === 'hybrid' ? 'Semantic + keyword retrieval' : 'Keyword retrieval'} · {result.sources.length} sources</p>}
                        {result.basis === 'general_education' && <p className="mt-2 text-xs leading-5 text-ink-muted">Includes general model knowledge, not verified live market research. Sources below support only the claims they address.</p>}
                        {result.portfolio && <RagPortfolioSnapshot snapshot={result.portfolio} />}
                        {result.performance && <dl className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-surface-2 p-3 text-sm sm:grid-cols-3">
                            <div><dt className="text-xs text-ink-muted">Completed sales</dt><dd className="mt-1">{result.performance.completedSales}</dd></div>
                            <div><dt className="text-xs text-ink-muted">Realised P&L</dt><dd className="mt-1 break-words">₹{result.performance.netRealisedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</dd></div>
                            <div><dt className="text-xs text-ink-muted">Win rate</dt><dd className="mt-1">{result.performance.winRate === null ? 'Unavailable' : `${result.performance.winRate}%`}</dd></div>
                        </dl>}
                        {result.sources.length > 0 && <details className="mt-3 min-w-0" open={result.mode === 'retrieval'}><summary className="min-h-11 cursor-pointer py-3 text-xs font-medium text-ink-muted">Sources ({result.sources.length})</summary><div className="space-y-2">{result.sources.map(source => <details key={source.citation} className="min-w-0 rounded-lg border border-line p-3" open={result.mode === 'retrieval'}>
                            <summary className="cursor-pointer break-words text-sm font-medium leading-6">{source.title} <span className="text-xs font-normal text-ink-muted">· {source.scope === 'public' ? 'App help' : source.scope === 'education' ? 'Education' : source.scope === 'account' ? 'Your statistics' : 'Private document'}</span></summary>
                            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-ink-muted">{source.text}</p>
                            {source.url?.startsWith('/') && !source.url.startsWith('//') && <Link href={source.url} className="mt-2 inline-flex min-h-9 items-center text-xs text-primary">Open related page →</Link>}
                            {source.referenceUrl?.startsWith('https://investor.sebi.gov.in/') && <a href={source.referenceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-9 items-center text-xs text-primary">Read SEBI Investor reference ↗</a>}
                        </details>)}</div></details>}
    </>;
}

function withoutCitationMarkers(answer: string) {
    return answer.replace(/[ \t]*\[S\d+(?:\s*[,;]\s*S?\d+)*\]/gi, '');
}
