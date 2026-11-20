'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/backend';
import { API_URL } from '@/lib/config';

export default function PnlReportDownload() {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const download = async () => {
        if (busy) return;
        setBusy(true); setError('');
        try {
            const token = localStorage.getItem('ptx_token') || localStorage.getItem('token');
            if (!token) throw new Error('Sign in to download your report.');
            const response = await apiFetch(`${API_URL}/api/reports/pnl`, { headers: { Authorization: `Bearer ${token}` } });
            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.error || 'Report unavailable. Please try again.');
            }
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement('a');
            link.href = url;
            link.download = `PaperTradeX-PnL-all-time-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) { setError(e instanceof Error ? e.message : 'Unable to download report.'); }
        finally { setBusy(false); }
    };
    return <div className="min-w-0 max-w-full">
        <button type="button" onClick={download} disabled={busy} title="All-time P&L report (CSV)"
            className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs font-medium text-ink-heading hover:bg-surface-3 disabled:opacity-60">
            {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" /> : <Download className="h-3.5 w-3.5 shrink-0 text-primary" />}
            <span>{busy ? 'Preparing report…' : 'Download P&L report'}</span>
        </button>
        {error && <p role="alert" className="mt-2 max-w-64 text-xs text-down break-words">{error}</p>}
    </div>;
}
