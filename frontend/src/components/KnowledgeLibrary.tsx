'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/backend';
import { API_URL } from '@/lib/config';
type Source = { id: string; title: string; scope: string; referenceUrl: string | null };
export default function KnowledgeLibrary({ enabled, vectors }: { enabled: boolean; vectors: boolean }) {
    const { user } = useAuth();
    const [sources, setSources] = useState<Source[]>([]);
    const [status, setStatus] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (!enabled) return;
        const controller = new AbortController();
        const token = localStorage.getItem('ptx_token') || localStorage.getItem('token');
        apiFetch(`${API_URL}/api/rag/sources`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
            .then(async response => { if (!response.ok) throw Error(); setSources((await response.json()).sources); })
            .catch(() => { if (!controller.signal.aborted) setStatus('Source list unavailable.'); });
        return () => controller.abort();
    }, [enabled]);
    async function index() {
        if (busy) return; setBusy(true); setStatus('');
        try {
            const token = localStorage.getItem('ptx_token') || localStorage.getItem('token');
            const response = await apiFetch(`${API_URL}/api/rag/index`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
            const data = await response.json(); if (!response.ok) throw Error(data.error);
            setStatus(`${data.indexed} of ${data.total} passages indexed.${data.remaining ? ' Run again to index the next batch.' : ' Semantic retrieval is ready.'}`);
        } catch (e) { setStatus(e instanceof Error ? e.message : 'Indexing unavailable.'); }
        finally { setBusy(false); }
    }
    return <aside className="min-w-0 self-start rounded-xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="font-semibold">Knowledge sources</h2>
        <p className="mt-2 text-xs leading-5 text-ink-muted">Managed by PaperTradeX: app help, finance lessons and original study notes linked to SEBI’s education booklet. Users cannot upload documents. Your account data is retrieved separately and never added to the shared vector index.</p>
        <details className="mt-3"><summary className="cursor-pointer py-3 text-sm text-primary">Browse included sources ({sources.length})</summary><ul className="space-y-3">{sources.map(source => <li key={source.id} className="border-t border-line pt-3 text-xs leading-5 break-words">{source.title}{source.referenceUrl?.startsWith('https://investor.sebi.gov.in/') && <a href={source.referenceUrl} target="_blank" rel="noopener noreferrer" className="block min-h-9 py-2 text-primary">Read reference ↗</a>}</li>)}</ul></details>
        {user?.role === 'ADMIN' && <button disabled={!vectors || busy} onClick={index} className="mt-3 min-h-11 w-full rounded-lg border border-line p-2 text-xs text-primary disabled:opacity-50">{busy ? 'Indexing…' : 'Build / refresh vector index'}</button>}
        {status && <p role="status" className="mt-2 text-xs leading-5 text-ink-muted">{status}</p>}
    </aside>;
}
