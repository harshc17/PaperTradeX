'use client';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { API_URL } from '@/lib/config';
import { apiFetch } from '@/lib/backend';

declare global {
    interface Window {
        google?: { accounts: { id: {
            initialize: (config: object) => void;
            renderButton: (element: HTMLElement, config: object) => void;
        } } };
    }
}
type Config = { enabled: boolean; clientId?: string; nonce?: string; challenge?: string };
export default function GoogleSignInButton({ disabled, onCredential }: {
    disabled: boolean; onCredential: (credential: string, challenge: string) => Promise<void>;
}) {
    const [config, setConfig] = useState<Config | null>(null);
    const [scriptReady, setScriptReady] = useState(false);
    const [scriptError, setScriptError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const host = useRef<HTMLDivElement>(null);
    const callback = useRef(onCredential);
    const busy = useRef(false);
    useEffect(() => { callback.current = onCredential; }, [onCredential]);
    useEffect(() => {
        const controller = new AbortController();
        apiFetch(`${API_URL}/api/auth/google/config`, { cache: 'no-store', signal: controller.signal })
            .then(response => response.ok ? response.json() : null)
            .then(value => { if (!controller.signal.aborted) setConfig(value); })
            .catch(() => { /* email sign-in remains available if Google is not configured */ });
        return () => controller.abort();
    }, [attempt]);
    useEffect(() => {
        const node = host.current, google = window.google?.accounts.id;
        if (!node || !google || !scriptReady || !config?.clientId || !config.nonce || !config.challenge) return;
        let active = true, width = 0;
        const challenge = config.challenge;
        google.initialize({ client_id: config.clientId, nonce: config.nonce, auto_select: false,
            callback: async (response: { credential?: string }) => {
                if (!active || !response.credential || busy.current) return;
                busy.current = true;
                try { await callback.current(response.credential, challenge); }
                finally { busy.current = false; if (active) setAttempt(value => value + 1); }
            } });
        const render = () => {
            const nextWidth = Math.max(200, Math.min(400, Math.floor(node.getBoundingClientRect().width)));
            if (nextWidth === width) return;
            width = nextWidth;
            node.replaceChildren();
            google.renderButton(node, { theme: 'outline', size: 'large', text: 'continue_with', width });
        };
        render();
        const observer = new ResizeObserver(render);
        observer.observe(node);
        return () => { active = false; observer.disconnect(); node.replaceChildren(); };
    }, [config, scriptReady]);
    if (!config?.enabled) return null;
    return <div className="my-5" aria-busy={disabled}>
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive"
            onReady={() => { setScriptReady(true); setScriptError(false); }} onError={() => setScriptError(true)} />
        <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-line" /><span className="text-xs text-ink-faint">or</span><div className="flex-1 h-px bg-line" />
        </div>
        {scriptError ? <p className="text-sm text-ink-muted" role="status">Google sign-in couldn’t load. Use email sign-in or reload this page.</p>
            : <div className="mx-auto w-full max-w-[400px] min-h-11" style={{ pointerEvents: disabled ? 'none' : undefined, opacity: disabled ? .6 : 1 }}>
                {!scriptReady && <p className="text-sm text-ink-muted" role="status">Loading Google sign-in…</p>}
                <div ref={host} className="w-full" />
            </div>}
    </div>;
}
