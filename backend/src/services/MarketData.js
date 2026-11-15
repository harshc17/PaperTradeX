/**
 * MarketData.js — Real-time market dataadd this project to https://github.com/harshc17/PapertTradeX repo with readme service using NSE India's API
 *
 * Strategy:
 *   Market OPEN (Mon–Fri, 9:15–15:30 IST):
 *     - Every 3s:  fetch ALL Nifty 50 stocks from NSE's index endpoint (single call)
 *     - Every 3s:  fetch individual quotes for extra + priority stocks
 *     - Every 1s:  broadcast cached data via WebSocket → UI feels live/1s
 *
 *   Market CLOSED:
 *     - Every 60s: attempt NSE refresh (will hit backoff, mostly serves cached data)
 *     - Every 5s:  broadcast cached prices (still useful for limit order engine)
 *
 * price_tick: lightweight event { symbol, price, change, timestamp } on each update
 */

const NSEClient = require('./NSEClient');
const HistoricalClient = require('./HistoricalClient');
const TradeEngine = require('./TradeEngine');
const { quoteKey, quoteTime, isFreshQuote, nseQuoteTime } = require('./QuoteIdentity');
const OfficialIndexSnapshot = require('./OfficialIndexSnapshot');
const PublicReadCache = require('./PublicReadCache');

// We use NSEClient.constructor.isMarketHours() instead.

const NSE_POLL_OPEN   = 3000;  // 3s during market hours
const NSE_POLL_CLOSED = 60000; // 60s when market is closed
const BROADCAST_OPEN  = 1000;  // 1s broadcast when live
const BROADCAST_CLOSED = 5000; // 5s broadcast when closed
const NSE_ALL_INDICES_TIMEOUT = 2500;

// Stocks to always track beyond Nifty 50
const EXTRA_STOCKS = [
    'ETERNAL', 'PAYTM', 'NYKAA', 'POLICYBZR',
    'IRFC', 'HAL', 'BEL', 'IRCTC', 'TATAPOWER',
    'TRENT', 'SHRIRAMFIN', 'JIOFIN', 'SUZLON', 'RVNL',
];

// Index names for the header ticker
// yahooSymbol: override if Yahoo Finance uses a different ticker than `key`
const TRACKED_INDICES = [
    { key: '^NSEI',       name: 'NIFTY 50',    yahooSymbol: '^NSEI'       },
    { key: '^BSESN',      name: 'SENSEX',       yahooSymbol: '^BSESN'      },
    { key: '^NSEBANK',    name: 'BANK NIFTY',   yahooSymbol: '^NSEBANK'    },
    // Those Yahoo symbols identify different indices; use exact NSE names only.
    { key: '^MIDCPNIFTY', name: 'MIDCPNIFTY',  yahooSymbol: null          },
    { key: '^FINNIFTY',   name: 'FINNIFTY',    yahooSymbol: null          },
    { key: '^BANKEX',     name: 'BANKEX',      yahooSymbol: 'BSE-BANK.BO' },
];

// Map from NSE index API name → our key
// NSE's allIndices lists SENSEX under several possible names depending on the day:
const NSE_INDEX_MAP = {
    'NIFTY 50':           '^NSEI',
    'NIFTY BANK':         '^NSEBANK',
    'NIFTY MIDCAP SELECT': '^MIDCPNIFTY',
    'NIFTY FINANCIAL SERVICES': '^FINNIFTY',
    // SENSEX variants (BSE index, NSE sometimes lists it under these names)
    'S&P BSE SENSEX':     '^BSESN',
    'S&P BSE Sensex':     '^BSESN',
    'BSE SENSEX':         '^BSESN',
    'SENSEX':             '^BSESN',
};

class MarketDataService {
    constructor(io) {
        this.io = io;
        this.subscribers = new Set();
        this.prioritySymbols = new Set(); // actively viewed — fetched every cycle
        this.cache = {};
        this.quoteRequests = new Map();
        this.lastFallbackAttempt = new Map();
        this.indexReads = new PublicReadCache(1);
        this._broadcastInterval = null;
        this._lastAllIndicesErrorLogTs = 0;
        this._allIndicesCooldownUntil = 0;

        // Pre-subscribe to common stocks
        const defaults = [
            'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN',
            'TMPV', 'ITC', 'ETERNAL', 'AXISBANK', 'WIPRO', 'BAJFINANCE',
        ];
        defaults.forEach(s => this.subscribers.add(s));
    }

    /** Subscribe to live updates for a symbol (bare NSE symbol, no .NS suffix) */
    subscribe(symbol) {
        if (!symbol) return null;
        const bare = quoteKey(symbol);
        this.subscribers.add(bare);
        this.prioritySymbols.add(bare);
        return this.cache[bare] || null;
    }

    /** Unmark a symbol from priority when user navigates away */
    deprioritize(symbol) {
        if (!symbol) return;
        const bare = quoteKey(symbol);
        this.prioritySymbols.delete(bare);
    }

    _updateCache(bare, price, change, dayChange, shortname, timestamp = null, source = 'nse') {
        bare = quoteKey(bare);
        const prev = this.cache[bare];
        const at = quoteTime(timestamp);
        if (!(price > 0) || !Number.isFinite(at)) return prev || null;
        if (prev && quoteTime(prev.timestamp) > at) return prev;
        const data = {
            symbol:    bare,
            shortname: shortname || bare,
            price:     price,
            prevPrice: prev?.price ?? price,
            change:    parseFloat((change || 0).toFixed(2)),
            dayChange: parseFloat((dayChange || 0).toFixed(2)),
            timestamp: new Date(at),
            receivedAt: new Date(),
            source,
        };
        this.cache[bare] = data;
        if (isFreshQuote(data)) TradeEngine.processMarketTick(bare, price).catch(() => {});
        if (!bare.endsWith('.BO')) this.cache[bare + '.NS'] = data;

        // Emit lightweight price_tick for priority symbols
        if (this.prioritySymbols.has(bare)) {
            this.io.emit('price_tick', {
                symbol:    bare,
                price:     price,
                prevPrice: prev?.price ?? price,
                change:    data.change,
                dayChange: data.dayChange,
                timestamp: data.timestamp,
                source: data.source,
            });
        }
        return data;
    }

    /** Fetch all Nifty 50 constituents in one NSE call */
    async _fetchNifty50() {
        const data = await NSEClient.indexConstituents('NIFTY 50');
        const stocks = data?.data || [];
        const updates = {};
        for (const s of stocks) {
            if (!s.symbol || !s.lastPrice) continue;
            const d = this._updateCache(
                s.symbol,
                s.lastPrice,
                s.change      ?? 0,
                s.pChange     ?? 0,
                s.companyName || s.symbol,
                nseQuoteTime(data.timestamp),
            );
            if (!d) continue;
            updates[s.symbol]          = d;
            updates[s.symbol + '.NS']  = d;
        }
        return updates;
    }

    /** Fetch all major indices in one call (NSE) + SENSEX fallback via Yahoo */
    async _fetchIndices() {
        return this.indexReads.load('indices', NSEClient.constructor.isMarketHours() ? 3000 : 60000, () => this._loadIndices());
    }

    async _loadIndices() {
        const updates = {};

        const now = Date.now();

        // ── 1. NSE allIndices (covers Nifty 50, Bank Nifty, sometimes SENSEX) ──
        if (now >= this._allIndicesCooldownUntil) {
            try {
                const data = await Promise.race([
                    NSEClient.allIndices(),
                    new Promise(resolve => setTimeout(() => resolve(null), NSE_ALL_INDICES_TIMEOUT)),
                ]);

                if (!data) {
                    throw new Error(`allIndices timed out after ${NSE_ALL_INDICES_TIMEOUT}ms`);
                }

                const indices = data?.data || [];
                for (const idx of indices) {
                    const key = NSE_INDEX_MAP[idx.index];
                    if (!key) continue;
                    const d = {
                        symbol:    key,
                        shortname: idx.index,
                        price:     idx.last           ?? 0,
                        prevPrice: this.cache[key]?.price ?? (idx.last ?? 0),
                        change:    idx.variation       ?? 0,
                        dayChange: idx.percentChange   ?? 0,
                        timestamp: new Date(),
                    };
                    this.cache[key] = d;
                    updates[key]    = d;
                }
            } catch (e) {
                this._allIndicesCooldownUntil = Date.now() + 5 * 60 * 1000;
                if (now - this._lastAllIndicesErrorLogTs > 60000) {
                    console.warn('[MarketData] allIndices unavailable, cooling down for 5m:', e.message);
                    this._lastAllIndicesErrorLogTs = now;
                }
            }
        }

        // ── 2. Yahoo fallback for all tracked indices ─────────────────────────
        // Keeps index points live even when NSE omits an index or blocks requests.
        await Promise.allSettled(
            TRACKED_INDICES.map(async ({ key, name, yahooSymbol }) => {
                if (updates[key] || !yahooSymbol) return;
                try {
                    const q = await HistoricalClient.indexQuote(yahooSymbol || key);
                    if (!q) return;
                    const prev = this.cache[key];
                    const d = {
                        symbol:    key,
                        shortname: name,
                        price:     q.price,
                        prevPrice: prev?.price ?? q.prevClose,
                        change:    q.change,
                        dayChange: q.dayChange,
                        timestamp: q.timestamp,
                        source: q.source,
                    };
                    this.cache[key] = d;
                    updates[key] = d;
                } catch {
                    // silent fallback failure
                }
            })
        );

        if (!updates['^MIDCPNIFTY'] || !updates['^FINNIFTY'] || !NSEClient.constructor.isMarketHours()) {
            const closes = await OfficialIndexSnapshot.latest();
            for (const [key, quote] of Object.entries(closes)) {
                if (NSEClient.constructor.isMarketHours() && updates[key]) continue;
                if (NSEClient.constructor.isMarketHours() && this.cache[key] && quoteTime(this.cache[key].timestamp) > quoteTime(quote.timestamp)) continue;
                this.cache[key] = quote;
                updates[key] = quote;
            }
        }

        return updates;
    }

    /** Fetch individual quotes for extras + priority symbols */
    async refreshSymbol(bare, skipNse = false) {
        bare = quoteKey(bare);
        if (this.quoteRequests.has(bare)) return this.quoteRequests.get(bare);
        const request = (async () => {
            const cached = this.cache[bare];
            if (cached && Date.now() - new Date(cached.timestamp).getTime() < 3000) return cached;
            if (!skipNse && !bare.endsWith('.BO')) {
                try {
                    const ns = await NSEClient.equityQuote(bare);
                    if (ns?.priceInfo?.lastPrice > 0) {
                        const pi = ns.priceInfo;
                        const rawTime = ns.metadata?.lastUpdateTime;
                        const at = nseQuoteTime(rawTime);
                        if (Number.isFinite(at)) return this._updateCache(bare, pi.lastPrice, pi.change, pi.pChange, ns.info?.companyName, at);
                    }
                } catch { /* use the shared fallback below */ }
            }
            if (Date.now() - (this.lastFallbackAttempt.get(bare) || 0) < 15000) return cached;
            this.lastFallbackAttempt.set(bare, Date.now());
            try {
                const q = await HistoricalClient.quoteDetail(bare);
                if (q?.regularMarketPrice > 0) {
                    const data = this._updateCache(bare, q.regularMarketPrice, q.regularMarketChange,
                        q.regularMarketChangePercent, q.shortName, q.regularMarketTime, 'yahoo-fallback');
                    return data;
                }
            } catch { /* preserve last known quote without inventing a price */ }
            return cached;
        })();
        this.quoteRequests.set(bare, request);
        try { return await request; } finally { this.quoteRequests.delete(bare); }
    }

    async _fetchExtras(skipNse = false) {
        const updates = {};
        const toFetch = [...new Set([
            ...EXTRA_STOCKS,
            ...Array.from(this.subscribers),
            ...Array.from(this.prioritySymbols),
        ])].filter(s => !s.startsWith('^'));

        await Promise.allSettled(
            toFetch.map(async (bare) => {
                // Skip if we have a very fresh price (< 1s old from Nifty50 fetch)
                const cached = this.cache[bare];
                if (cached && (Date.now() - new Date(cached.timestamp).getTime()) < 1000) return;

                try {
                    const d = await this.refreshSymbol(bare, skipNse);
                    if (!d) return;
                    updates[bare]         = d;
                    if (!bare.endsWith('.BO')) updates[bare + '.NS'] = d;
                } catch {
                    // silent — stock might not exist or NSE unavailable
                }
            })
        );
        return updates;
    }

    startPolling() {
        const isOpen = NSEClient.constructor.isMarketHours();

        console.log(
            `[MarketData] Starting — NSE India API\n` +
            `  Market: ${isOpen ? '🟢 OPEN' : '🔴 CLOSED'}\n` +
            `  Poll: ${isOpen ? NSE_POLL_OPEN / 1000 : NSE_POLL_CLOSED / 1000}s | Broadcast: ${isOpen ? BROADCAST_OPEN / 1000 : BROADCAST_CLOSED / 1000}s`
        );

        let consecutiveErrors = 0;

        const fetchLoop = async () => {
            const marketOpen = NSEClient.constructor.isMarketHours();
            const pollMs = marketOpen ? NSE_POLL_OPEN : NSE_POLL_CLOSED;

            if (!marketOpen) {
                setTimeout(fetchLoop, pollMs);
                return;
            }

            // If NSE client is in backoff, skip this cycle entirely
            if (NSEClient._inBackoff) {
                // Keep indices alive through Yahoo fallback while NSE is rate-limited/blocked.
                try {
                    const [indexUpdates, stockUpdates] = await Promise.all([
                        this._fetchIndices(), this._fetchExtras(true),
                    ]);
                    if (Object.keys(indexUpdates).length > 0) {
                        this.io.emit('market_update', { ...stockUpdates, ...indexUpdates });
                    } else if (Object.keys(stockUpdates).length > 0) {
                        this.io.emit('market_update', stockUpdates);
                    }
                } catch {
                    // silent
                }
                setTimeout(fetchLoop, Math.min(pollMs, 5000));
                return;
            }

            // FREEZE PRICES: If market is closed, do not fetch new ticks.
            // The REST realtime route serves a per-day closing snapshot for newly viewed symbols.
            if (!marketOpen) {
                setTimeout(fetchLoop, pollMs);
                return;
            }

            try {
                const [niftyRes, indexRes, extraRes] = await Promise.allSettled([
                    this._fetchNifty50(),
                    this._fetchIndices(),
                    this._fetchExtras(),
                ]);

                const allUpdates = {
                    ...(niftyRes.value || {}),
                    ...(indexRes.value || {}),
                    ...(extraRes.value || {}),
                };
                // The cache contains the newest accepted quote, regardless of
                // which concurrent provider request finished first.
                for (const key of Object.keys(allUpdates)) allUpdates[key] = this.cache[key] || allUpdates[key];

                if (Object.keys(allUpdates).length > 0) {
                    this.io.emit('market_update', allUpdates);
                    consecutiveErrors = 0;
                } else if (!marketOpen) {
                    // Market closed — normal to get empty updates
                    consecutiveErrors = 0;
                }
            } catch (e) {
                consecutiveErrors++;
                if (consecutiveErrors <= 3) {
                    console.error('[MarketData] Poll error:', e.message);
                }
            }

            setTimeout(fetchLoop, pollMs);
        };

        // First fetch shortly after startup
        setTimeout(fetchLoop, 1000);

        // Broadcast loop — adapts to market hours
        const startBroadcast = () => {
            if (this._broadcastInterval) clearInterval(this._broadcastInterval);
            const marketOpen = NSEClient.constructor.isMarketHours();
            const intervalMs = marketOpen ? BROADCAST_OPEN : BROADCAST_CLOSED;

            this._broadcastInterval = setInterval(() => {
                const cached = { ...this.cache };
                if (Object.keys(cached).length > 0) {
                    this.io.emit('market_update', cached);
                }
            }, intervalMs);
        };

        startBroadcast();

        // Re-evaluate broadcast interval every 5 minutes in case market opens/closes
        setInterval(startBroadcast, 5 * 60 * 1000);
    }
}

module.exports = MarketDataService;
