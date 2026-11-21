'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/backend';
import { API_URL } from '@/lib/config';

type Document = { id: string; title: string; characters: number };
async function request(path: string, init: RequestInit = {}) {
    const token = localStorage.getItem('ptx_token') || localStorage.getItem('token');
    if (!token) throw new Error('Please sign in again.');
    const response = await apiFetch(`${API_URL}/api/rag/documents${path}`, { ...init, cache: 'no-store', headers: {
        'Content-Type': 'application/json', Authorization: `Bearer ${token}`,
    } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Library unavailable.');
    return data;
}
export default function KnowledgeLibrary({ enabled }: { enabled: boolean }) {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [remove, setRemove] = useState('');
    useEffect(() => {
        if (!enabled) return;
        const controller = new AbortController();
        request('', { signal: controller.signal }).then(data => setDocuments(data.documents))
            .catch(e => { if (!controller.signal.aborted) setError(e.message); });
        return () => controller.abort();
    }, [enabled]);
    async function save(event: React.FormEvent) {
        event.preventDefault(); if (busy) return;
        setBusy(true); setError(''); setNotice('');
        try {
            const data = await request('', { method: 'POST', body: JSON.stringify({ title, content }) });
            setDocuments(previous => [data.document, ...previous]); setTitle(''); setContent('');
            setNotice('Document added. Ask a question to search it.');
        } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save.'); }
        finally { setBusy(false); }
    }
    async function removeDocument(id: string) {
        setBusy(true); setError(''); setNotice('');
        try { await request(`/${id}`, { method: 'DELETE' }); setDocuments(previous => previous.filter(d => d.id !== id)); setRemove(''); setNotice('Document removed from future searches. Earlier results remain visible until you leave this page.'); }
        catch (e) { setError(e instanceof Error ? e.message : 'Unable to remove.'); }
        finally { setBusy(false); }
    }
    return <aside className="min-w-0 self-start rounded-xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="font-semibold">Your knowledge library</h2>
        <p className="mt-2 text-xs leading-5 text-ink-muted">PaperTradeX help is included. Add your own notes or educational material. Your documents are private to your account.</p>
        <details className="mt-4">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm text-primary">+ Add a document</summary>
            <form onSubmit={save} className="mt-2 space-y-3">
                <label className="block text-xs">Title<input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-line bg-page p-3 text-sm" /></label>
                <label className="block text-xs">Text or Markdown file<input type="file" accept=".txt,.md,text/plain,text/markdown" disabled={busy} className="mt-2 block min-h-11 w-full min-w-0 max-w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-surface-2 file:p-2 file:text-ink" onChange={async e => {
                    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
                    setError('');
                    if (!/\.(txt|md)$/i.test(file.name) || file.size > 120000) { setError('Choose a .txt or .md file under 120 KB.'); return; }
                    try { const text = await file.text(); if (text.length > 30000 || text.includes('\u0000')) throw new Error('Use up to 30,000 characters of plain text.'); setContent(text); if (!title) setTitle(file.name.slice(0, 120)); }
                    catch (e) { setError(e instanceof Error ? e.message : 'Unable to read this file.'); }
                }} /></label>
                <label className="block text-xs">Or paste text<textarea required minLength={40} maxLength={30000} rows={6} value={content} onChange={e => setContent(e.target.value)} className="mt-2 w-full resize-y rounded-lg border border-line bg-page p-3 text-sm" /></label>
                <p className="text-xs leading-5 text-ink-muted">40–30,000 characters per document, up to 25 documents. Avoid secrets and personal information. Matching passages can be sent to the AI provider when generation is enabled.</p>
                <button disabled={busy || !enabled} className="min-h-11 w-full rounded-lg border border-line px-3 text-sm text-primary disabled:opacity-50">{busy ? 'Saving…' : 'Add to library'}</button>
            </form>
        </details>
        <ul className="mt-4 space-y-3">{documents.map(document => <li key={document.id} className="min-w-0 border-t border-line pt-3">
            <p className="break-words text-sm">{document.title}</p><p className="mt-1 text-xs text-ink-muted">{document.characters.toLocaleString()} characters</p>
            {remove === document.id ? <div className="mt-2 flex flex-wrap gap-2"><button disabled={busy} onClick={() => removeDocument(document.id)} className="min-h-11 rounded-lg border border-line px-3 text-xs text-down">Confirm removal</button><button disabled={busy} onClick={() => setRemove('')} className="min-h-11 px-3 text-xs">Cancel</button></div> : <button disabled={busy} onClick={() => setRemove(document.id)} className="min-h-11 text-xs text-ink-muted underline">Remove</button>}
        </li>)}</ul>
        {notice && <p role="status" className="mt-3 break-words text-xs leading-5 text-primary">{notice}</p>}
        {error && <p role="alert" className="mt-3 break-words text-xs text-down">{error}</p>}
    </aside>;
}
