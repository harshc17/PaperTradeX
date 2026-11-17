import { API_URL, BACKUP_API_URL } from './config';

type Listener = (url: string) => void;
const listeners = new Set<Listener>();
let active = API_URL;
let lastCheck = 0;
let checking: Promise<string> | null = null;
let started = false;
const rawFetch = (...args: Parameters<typeof fetch>) => globalThis.fetch(...args);

export function getBackend() { return active; }
export function onBackendChange(listener: Listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
function select(url: string) {
    if (active === url) return;
    active = url;
    listeners.forEach(listener => listener(url));
}
async function healthy(url: string) {
    try {
        const response = await rawFetch(`${url}/health`, {
            cache: 'no-store', signal: AbortSignal.timeout(3500),
        });
        return response.ok && (await response.json()).status === 'ok';
    } catch { return false; }
}

// Coalesce checks across screens; auth and validation failures are not outages.
export function checkBackend(force = false): Promise<string> {
    if (!BACKUP_API_URL || BACKUP_API_URL === API_URL) return Promise.resolve(active);
    if (checking) return checking;
    if (!force && Date.now() - lastCheck < 5000) return Promise.resolve(active);
    checking = (async () => {
        const [primary, backup] = await Promise.all([healthy(API_URL), healthy(BACKUP_API_URL)]);
        lastCheck = Date.now();
        if (primary) select(API_URL);
        else if (backup) select(BACKUP_API_URL);
        // Retain selection and account state when neither server is reachable.
        return active;
    })().finally(() => { checking = null; });
    return checking;
}
function startChecks() {
    if (started || typeof window === 'undefined' || !BACKUP_API_URL) return;
    started = true;
    void checkBackend();
    // Warm the standby while the app is open. A sleeping free instance can still take time to wake.
    window.setInterval(() => { void checkBackend(true); }, 15000);
    window.addEventListener('online', () => { void checkBackend(true); });
    window.addEventListener('focus', () => { void checkBackend(true); });
}

export async function apiFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
    const url = String(input);
    if (!url.startsWith(`${API_URL}/`)) return rawFetch(input, init);
    startChecks();
    const method = (init.method || 'GET').toUpperCase();
    const path = url.slice(API_URL.length);
    const headers = new Headers(init.headers);
    const trade = method === 'POST' && path === '/api/trade';
    if (trade && !headers.has('Idempotency-Key')) headers.set('Idempotency-Key', crypto.randomUUID());
    const safeReplay = method === 'GET' || method === 'HEAD' || trade;
    if (method !== 'GET' && method !== 'HEAD') await checkBackend();
    const target = active;
    const send = async (base: string) => {
        const controller = new AbortController();
        const abort = () => controller.abort(init.signal?.reason);
        if (init.signal?.aborted) abort();
        else init.signal?.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(() => controller.abort(), method === 'GET' ? 20000 : 30000);
        try { return await rawFetch(base + path, { ...init, headers, signal: controller.signal }); }
        finally { clearTimeout(timer); init.signal?.removeEventListener('abort', abort); }
    };
    let response: Response | undefined;
    try {
        response = await send(target);
        if (![502, 503, 504].includes(response.status)) return response;
        // Provider outages can produce a 503 from an otherwise healthy backend.
        if (await healthy(target)) return response;
    } catch (error) {
        if (init.signal?.aborted) throw error;
    }
    const next = await checkBackend(true);
    if (safeReplay && next !== target && !init.signal?.aborted) return send(next);
    if (response) return response;
    throw new Error(trade
        ? 'Order confirmation is unavailable. Check order history before placing another order.'
        : 'Connection interrupted. Please check the result before trying again.');
}
