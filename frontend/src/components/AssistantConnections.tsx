'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/backend';
import { API_URL } from '@/lib/config';

type Connection = { _id: string; label: string; expiresAt: string };
async function connectionRequest(path = '', init: RequestInit = {}) {
    const token = localStorage.getItem('ptx_token') || localStorage.getItem('token');
    const response = await apiFetch(`${API_URL}/api/assistant/connections${path}`, { ...init, cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Unable to update assistant connections.');
    return data;
}
export default function AssistantConnections() {
    const dialog = useRef<HTMLDialogElement>(null);
    const [open, setOpen] = useState(false);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [label, setLabel] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [issued, setIssued] = useState<{ token: string; mcpUrl: string; expiresAt: string } | null>(null);
    const [url, setUrl] = useState('');
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!open) return;
        dialog.current?.showModal();
        const controller = new AbortController();
        connectionRequest('', { signal: controller.signal }).then(data => { if (!controller.signal.aborted) { setConnections(data.connections); setUrl(data.mcpUrl); } })
            .catch(e => { if (!controller.signal.aborted) setError(e.message); });
        return () => controller.abort();
    }, [open]);
    function close() { dialog.current?.close(); setOpen(false); setIssued(null); setError(''); setCopied(false); }
    async function create() {
        if (busy || !label.trim()) return;
        setBusy(true); setError('');
        try {
            const data = await connectionRequest('', { method: 'POST', body: JSON.stringify({ label: label.trim() }) });
            setIssued(data); setUrl(data.mcpUrl); setCopied(false);
            setConnections(previous => [...previous, { _id: data.id, label: label.trim(), expiresAt: data.expiresAt }]);
        } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create a connection.'); }
        finally { setBusy(false); }
    }
    async function revoke(id: string) {
        setBusy(true); setError('');
        try { await connectionRequest(`/${id}`, { method: 'DELETE' }); setConnections(previous => previous.filter(c => c._id !== id)); setIssued(null); }
        catch (e) { setError(e instanceof Error ? e.message : 'Unable to revoke this connection.'); }
        finally { setBusy(false); }
    }
    return <>
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 text-left text-xs font-medium text-primary">Connect an external AI assistant →</button>
        <dialog ref={dialog} style={{ width: 'calc(100% - 24px)' }} onCancel={event => { event.preventDefault(); if (!busy) close(); }} onClose={() => { setOpen(false); setIssued(null); }} className="max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl border border-line bg-surface p-5 text-ink backdrop:bg-black/60">
            <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Read-only AI connection</h2><button type="button" disabled={busy} onClick={close} aria-label="Close assistant connections" className="h-11 w-11 text-xl">×</button></div>
            <p className="mt-3 text-sm leading-6 text-ink-muted">Connect a trusted MCP client to your holdings, balance, returns, synced watchlist, verified documents and calculation tools. It cannot buy, sell, or change your account. Access expires after one hour and can be revoked here.</p>
            <p className="mt-2 text-xs leading-5 text-ink-muted">The assistant you connect can read and process that data under its own policies. Only share the key with an assistant you trust. This uses Streamable HTTP with a Bearer header, not automatic OAuth sign-in.</p>
            <label className="mt-4 block text-sm" htmlFor="assistant-label">Assistant name</label>
            <input id="assistant-label" value={label} onChange={event => setLabel(event.target.value)} maxLength={80} placeholder="e.g. My Cursor assistant" className="mt-2 min-h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-base" />
            <button type="button" disabled={busy || !label.trim()} onClick={() => void create()} className="mt-3 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-black disabled:opacity-50">{busy ? 'Please wait…' : 'Create one-hour read-only key'}</button>
            {issued && <section aria-label="New assistant key" className="mt-4 rounded-lg border border-line p-3">
                <p className="text-xs leading-5 text-ink-muted">Shown once. Expires {new Date(issued.expiresAt).toLocaleTimeString()}.</p>
                <input aria-label="Private assistant key" type="password" value={issued.token} readOnly className="mt-2 w-full min-h-11 rounded border border-line bg-surface-2 px-2" />
                <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(issued.token); setCopied(true); } catch { setError('Unable to copy. Select the key privately.'); } }} className="mt-2 min-h-11 text-sm text-primary">{copied ? 'Key copied' : 'Copy key privately'}</button>
            </section>}
            {url && <div className="mt-4 text-xs leading-5 text-ink-muted"><p>MCP server URL</p><p className="break-all select-all text-ink">{url}</p><p className="mt-2">In an MCP client supporting HTTP headers, use <code>Authorization: Bearer YOUR_PRIVATE_KEY</code>. Keep the key out of shared configuration and repositories.</p></div>}
            {!!connections.length && <ul aria-label="Active assistant connections" className="mt-4 space-y-2">{connections.map(c => <li key={c._id} className="flex min-w-0 items-center justify-between gap-3 border-t border-line pt-2"><span className="min-w-0 break-words text-sm">{c.label}<span className="block text-xs text-ink-muted">Expires {new Date(c.expiresAt).toLocaleTimeString()}</span></span><button type="button" disabled={busy} onClick={() => void revoke(c._id)} className="min-h-11 shrink-0 text-sm text-primary">Revoke</button></li>)}</ul>}
            {error && <p role="alert" className="mt-3 text-sm text-down">{error}</p>}
        </dialog>
    </>;
}
