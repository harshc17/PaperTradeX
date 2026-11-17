import { io, Socket } from 'socket.io-client';
import { checkBackend, getBackend, onBackendChange } from './backend';

type Handler = (...args: any[]) => void;
// A stable handle keeps every screen's listeners when the physical connection switches hosts.
export class MarketSocket {
    private socket: Socket | null = null;
    private handlers = new Map<string, Set<Handler>>();
    private symbols = new Set<string>();
    constructor() {
        this.connect(getBackend());
        onBackendChange(url => this.connect(url));
        void checkBackend();
    }
    get connected() { return !!this.socket?.connected; }
    private dispatch(event: string, ...args: any[]) {
        this.handlers.get(event)?.forEach(handler => handler(...args));
    }
    private connect(url: string) {
        const previous = this.socket;
        this.socket = null;
        previous?.removeAllListeners();
        previous?.disconnect();
        const socket = io(url, { transports: ['websocket', 'polling'], reconnection: true,
            timeout: 7000, forceNew: true, autoConnect: false });
        this.socket = socket;
        socket.on('connect', () => {
            this.symbols.forEach(symbol => socket.emit('subscribe', symbol));
            this.dispatch('connect');
        });
        socket.onAny((event, ...args) => this.dispatch(event, ...args));
        socket.on('disconnect', (...args) => { this.dispatch('disconnect', ...args); void checkBackend(true); });
        socket.on('connect_error', error => { this.dispatch('connect_error', error); void checkBackend(true); });
        socket.connect();
    }
    on(event: string, handler: Handler) {
        if (!this.handlers.has(event)) this.handlers.set(event, new Set());
        this.handlers.get(event)!.add(handler);
        return this;
    }
    off(event: string, handler: Handler) { this.handlers.get(event)?.delete(handler); return this; }
    emit(event: string, ...args: any[]) {
        if (event === 'subscribe') this.symbols.add(args[0]);
        if (event === 'deprioritize') this.symbols.delete(args[0]);
        if (this.socket?.connected) this.socket.emit(event, ...args);
        return this;
    }
}
let socket: MarketSocket | null = null;
export function getSocket(): MarketSocket {
    if (!socket) socket = new MarketSocket();
    return socket;
}
