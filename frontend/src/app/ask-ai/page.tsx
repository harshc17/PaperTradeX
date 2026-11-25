'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUp, MessageCircle, Plus, Settings2, Loader2, PenSquare, RotateCcw } from 'lucide-react';
import { BrandIcon } from '@/components/BrandLogo';
import ThemeToggle from '@/components/ThemeToggle';
import RagPortfolioSnapshot, { type PortfolioSnapshot } from '@/components/RagPortfolioSnapshot';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/backend';
import { API_URL } from '@/lib/config';
import { buildChatRequest, type ChatPayload } from '@/lib/ragChatRequest';
import dynamic from 'next/dynamic';

const AnswerMarkdown = dynamic(() => import('@/components/AnswerMarkdown'));
const AssistantConnections = dynamic(() => import('@/components/AssistantConnections'));

type Result = { mode: 'generated' | 'retrieval' | 'no_sources' | 'unavailable'; retryable?: boolean; answer: string;
    portfolio?: PortfolioSnapshot | null;
    performance: { completedSales: number; netRealisedPnl: number; winRate: number | null } | null };
type Entry = { id: number; question: string; payload: ChatPayload; result?: Result; error?: string; pending?: boolean; retrying?: boolean };
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
    const { user } = useAuth();
    const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';
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
    }, [question, entries.length === 0]);
    async function send(text = question.trim(), retryId?: number) {
        if (active.current || !ready || !text.trim()) return;
        const original = retryId ? entries.find(entry => entry.id === retryId) : undefined;
        if (retryId && !original) return;
        const id = retryId ?? ++sequence.current;
        const payload = buildChatRequest(text, { includePerformance: performance, includePortfolio }, entries, original?.payload);
        const controller = new AbortController();
        followLatest.current = true;
        active.current = controller; setBusy(true); setError(''); setOptions(false);
        setEntries(previous => retryId
            ? previous.map(entry => entry.id === id ? { ...entry, pending: true, retrying: true, error: undefined } : entry)
            : [...previous, { id, question: text, payload, pending: true }]);
        if (!retryId) setQuestion('');
        try {
            const result: Result = await request('/ask', { method: 'POST', signal: controller.signal,
                body: JSON.stringify(payload) });
            if (!controller.signal.aborted) setEntries(previous => previous.map(entry => entry.id === id ? { ...entry, result, pending: false } : entry));
        } catch (e) {
            if (!controller.signal.aborted) setEntries(previous => previous.map(entry => entry.id === id
                ? { ...entry, pending: false, result: undefined, error: e instanceof Error ? e.message : 'Unable to answer. Please try again.' } : entry));
        } finally {
            if (active.current === controller) { active.current = null; setBusy(false); }
        }
    }
    function newChat() {
        active.current?.abort(); active.current = null; setBusy(false);
        setEntries([]); setQuestion(''); setError(''); input.current?.focus();
    }
    return <div ref={shell} className="fixed inset-x-0 top-0 flex h-dvh min-h-0 overflow-hidden bg-surface-2 text-ink">
        <aside aria-label="Chat navigation" className="hidden w-[72px] shrink-0 flex-col items-center gap-4 py-5 md:flex">
            <Link href="/dashboard" aria-label="Back to Explore" className="mb-5 inline-flex h-11 w-11 items-center justify-center"><BrandIcon className="h-9 w-9" /></Link>
            <button type="button" onClick={newChat} aria-label="New chat" title="New chat" className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-muted hover:bg-surface"><PenSquare className="h-5 w-5" /></button>
            <button type="button" aria-label="Current conversation" title="Current conversation" onClick={() => { transcript.current?.scrollTo({ top: transcript.current.scrollHeight }); transcript.current?.focus(); }} className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-muted hover:bg-surface"><MessageCircle className="h-5 w-5" /></button>
            <div className="mt-auto flex flex-col items-center gap-3"><ThemeToggle /><span title={user?.name || 'Your account'} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-black">{firstName.slice(0, 1).toUpperCase()}</span></div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg)] md:my-3 md:mr-3 md:rounded-3xl">
        <header className="shrink-0 border-b border-line bg-[var(--bg)] px-3 sm:px-6 md:hidden">
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
            <div ref={transcript} role="region" aria-label="Conversation" tabIndex={0} onScroll={event => { const area = event.currentTarget; followLatest.current = area.scrollHeight - area.scrollTop - area.clientHeight < 60; }} className={`min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-6 ${entries.length ? 'flex-1 py-5 sm:py-8' : 'shrink py-4 md:pt-[min(18vh,160px)]'}`}>
                {!entries.length && <div className="mx-auto flex max-w-2xl flex-col items-center pt-7 text-center sm:pt-12 md:pt-6 [@media(max-height:500px)]:hidden">
                    <BrandIcon className="mb-5 h-12 w-12 sm:h-14 sm:w-14" />
                    <p className="text-lg font-medium text-ink-muted sm:text-2xl">Hey {firstName}</p>
                    <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">Less noise. More understanding.</h2>
                    <p className="mt-3 max-w-md text-sm leading-6 text-ink-muted">Your portfolio, the markets, and everything you want to understand.</p>
                </div>}
                <div className="space-y-6">
                    {entries.map(entry => <article key={entry.id} aria-label={`Question: ${entry.question}`} className="min-w-0 space-y-4">
                        <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-sm bg-surface-2 px-4 py-3 sm:max-w-[80%]"><p className="mb-1 text-xs font-medium text-ink-muted">You</p><p className="whitespace-pre-wrap break-words text-sm leading-6">{entry.question}</p></div>
                        <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                            <BrandIcon className="mt-1 h-7 w-7 shrink-0" />
                            <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-line bg-surface px-3 py-3 sm:px-5 sm:py-4">
                                <p className="text-xs font-semibold text-primary">PaperTradeX AI</p>
                                {entry.pending ? <p role="status" className="mt-3 flex items-center gap-2 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />{entry.retrying ? 'Retrying…' : 'Thinking…'}</p>
                                    : entry.error ? <div role="alert"><p className="mt-3 break-words text-sm leading-6 text-ink-muted">{entry.error}</p><RetryButton busy={busy} onRetry={() => void send(entry.question, entry.id)} /></div>
                                    : entry.result ? <><Answer result={entry.result} />{(entry.result.mode === 'unavailable' || entry.result.mode === 'retrieval') && <RetryButton busy={busy} onRetry={() => void send(entry.question, entry.id)} />}</> : null}

                            </div>
                        </div>
                    </article>)}
                </div>
            </div>
            <div className={`shrink-0 bg-[var(--bg)] px-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6 ${entries.length ? 'border-t border-line pt-3' : 'mt-5 sm:mt-8'}`}>
                {error && <p role="alert" className="mb-2 break-words text-sm text-down">{error}</p>}
                <form onSubmit={event => { event.preventDefault(); void send(); }} className="rounded-2xl border border-line bg-surface p-3 transition-colors focus-within:border-[var(--text-faint)] sm:p-4">
                    <div className="flex items-center justify-between gap-2">
                        <label htmlFor="rag-question" className="text-xs font-medium text-ink-muted">Ask question</label>
                        <button type="button" aria-label="Answer options and privacy" aria-expanded={options} aria-controls="chat-options" onClick={() => setOptions(!options)} className="-my-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2"><Settings2 className="h-4 w-4" /></button>
                    </div>
                    {options && <div id="chat-options" style={{ maxHeight: 'calc(var(--chat-viewport-height, 100dvh) * 0.25)' }} className="mb-2 overflow-y-auto overscroll-contain border-b border-line pb-2">
                        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs leading-5 text-ink-muted"><input type="checkbox" checked={includePortfolio} onChange={e => setIncludePortfolio(e.target.checked)} className="h-4 w-4 shrink-0 accent-primary" />Use my holdings, balance, returns and synced watchlist for account questions</label>
                        <AssistantConnections />
                        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs leading-5 text-ink-muted"><input type="checkbox" checked={performance} onChange={e => setPerformance(e.target.checked)} className="h-4 w-4 shrink-0 accent-primary" />Include my completed-trade statistics</label>
                        <p className="text-xs leading-5 text-ink-muted">{generation ? `Questions, relevant passages and selected account data go to ${provider}.` : 'AI generation is unavailable; verified portfolio snapshots remain available.'} Semantic retrieval uses Gemini. Answers use verified documents and tool data only. Up to four earlier exchanges are used for follow-up questions. Portfolio follow-ups fetch a fresh snapshot; earlier account figures are not reused. Chat stays on this page and clears when you leave or start a new chat. Never share passwords, OTPs or API keys. Quotes can be delayed. This assistant cannot place orders.</p>
                    </div>}
                    <div className="mt-2 flex items-end gap-2">
                        <textarea ref={input} id="rag-question" style={{ maxHeight: 'min(120px, calc(var(--chat-viewport-height, 100dvh) * 0.18))' }} value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} maxLength={2000} rows={entries.length ? 1 : 3} placeholder="Ask about your portfolio or the market..." className="min-h-11 min-w-0 flex-1 resize-none overflow-y-auto overscroll-contain bg-transparent py-2 text-base leading-6 outline-none" />
                        <button type="submit" aria-label={busy ? 'Waiting for reply' : !ready ? 'Connecting' : 'Send message'} disabled={busy || !ready || !question.trim()} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-black disabled:opacity-40">{busy || !ready ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" /> : <ArrowUp className="h-5 w-5" />}</button>
                    </div>
                </form>
                <p className="mt-2 text-center text-[11px] leading-4 text-ink-muted">AI can make mistakes. Verify figures and references. <span className="hidden sm:inline">Enter to send · Shift + Enter for a new line.</span></p>
            </div>
            {!entries.length && <div className="mt-4 flex shrink-0 flex-wrap justify-center gap-2 px-3 pb-4 [@media(max-height:600px)]:hidden">
                {['My portfolio', 'How ETFs work', 'Market risk'].map((label, i) => <button key={label} type="button" disabled={!ready} onClick={() => { setQuestion(['What is my current portfolio value, balance and returns?', 'How do ETFs work?', 'Explain market risk in simple terms.'][i]); if (!i) setIncludePortfolio(true); input.current?.focus(); }} className="min-h-10 rounded-full border border-line px-3 text-xs text-ink-muted hover:border-primary">{label}</button>)}
            </div>}
            <p role="status" className="sr-only">{busy ? 'AI is thinking' : entries.length ? 'Reply ready' : ready ? 'Ready for your question' : 'Connecting'}</p>
        </main>
        </div>
    </div>;
}

function Answer({ result }: { result: Result }) {
    return <>
                        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-ink-muted">{result.mode === 'generated' ? 'AI answer' : result.mode === 'unavailable' || result.mode === 'retrieval' ? 'Unable to finish the answer' : 'Reply'}</p>
                        <div className="mt-2 min-w-0 break-words text-sm leading-6 [&_p]:mb-3 [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-xs [&_blockquote]:text-ink-muted [&_ul]:list-disc [&_ul]:pl-5 [&_table]:w-full [&_th]:border-b [&_th]:border-line [&_th]:p-2 [&_td]:border-b [&_td]:border-line [&_td]:p-2"><AnswerMarkdown text={result.mode === 'retrieval' ? 'I could not finish the answer. Please retry; your conversation is still here.' : result.answer} /></div>
                        {result.portfolio && <RagPortfolioSnapshot snapshot={result.portfolio} />}
                        {result.performance && <dl className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-surface-2 p-3 text-sm sm:grid-cols-3">
                            <div><dt className="text-xs text-ink-muted">Completed sales</dt><dd className="mt-1">{result.performance.completedSales}</dd></div>
                            <div><dt className="text-xs text-ink-muted">Realised P&L</dt><dd className="mt-1 break-words">₹{result.performance.netRealisedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</dd></div>
                            <div><dt className="text-xs text-ink-muted">Win rate</dt><dd className="mt-1">{result.performance.winRate === null ? 'Unavailable' : `${result.performance.winRate}%`}</dd></div>
                        </dl>}
    </>;
}

function RetryButton({ busy, onRetry }: { busy: boolean; onRetry: () => void }) {
    return <button type="button" disabled={busy} onClick={onRetry} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-primary hover:bg-surface-2 disabled:opacity-50"><RotateCcw className="h-4 w-4" />Retry answer</button>;
}
