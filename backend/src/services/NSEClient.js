/**
 * NSEClient.js — Wraps NSE India's unofficial public API
 *
 * NSE requires a valid browser session (cookie) obtained by hitting the homepage first.
 * This client handles that automatically and refreshes the session every 20 minutes.
 *
 * Backoff: if session init fails 3 consecutive times, backoff for up to 2 minutes
 * before retrying. This prevents hammering NSE when it returns 403.
 *
 * All data is sourced directly from NSE servers — most accurate source for Indian equities.
 * No API key required. No rate limits documented (but 3-5s polling is safe).
 */

const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const BASE_HEADERS = {
    'User-Agent':               UA,
    'Accept-Language':          'en-US,en;q=0.9',
    'Accept-Encoding':          'gzip, deflate, br',
    'Connection':               'keep-alive',
    'Cache-Control':            'max-age=0',
    'Upgrade-Insecure-Requests':'1',
    'sec-fetch-dest':           'document',
    'sec-fetch-mode':           'navigate',
    'sec-fetch-site':           'none',
    'sec-fetch-user':           '?1',
};

// Backoff schedule (ms): 5s, 15s, 30s, 60s, 120s, then stay at 120s
const BACKOFF_SCHEDULE = [5000, 15000, 30000, 60000, 120000];

class NSEClient {
    constructor() {
        this._cookies      = '';
        this._cookieTs     = 0;
        this._failCount    = 0;      // consecutive session-init failures
        this._backoffUntil = 0;      // timestamp until which we do NOT retry session init
        this._initPromise  = null;   // deduplication: in-flight session init
        this._http = axios.create({ timeout: 12000 });
    }

    get _sessionValid() {
        return this._cookies && (Date.now() - this._cookieTs < 20 * 60 * 1000);
    }

    get _inBackoff() {
        return Date.now() < this._backoffUntil;
    }

    /** True once the backoff window just expired and we're about to retry */
    get _backoffJustExpired() {
        return this._failCount > 0 && !this._inBackoff && this._cookies === '';
    }

    async _initSession() {
        if (this._sessionValid) return;
        if (this._inBackoff) {
            return; // silently wait — backoff status was logged on entry
        }

        // Deduplicate: if another caller is already fetching the session, wait for theirs
        if (this._initPromise) return this._initPromise;

        this._initPromise = this._doInit().finally(() => {
            this._initPromise = null;
        });
        return this._initPromise;
    }

    async _doInit() {
        try {
            const r = await this._http.get('https://www.nseindia.com', {
                headers: {
                    ...BASE_HEADERS,
                    Accept: 'text/html,application/xhtml+xml,*/*;q=0.9',
                },
                maxRedirects: 5,
            });
            const raw = r.headers['set-cookie'] || [];
            this._cookies   = (Array.isArray(raw) ? raw : [raw])
                .map(c => c.split(';')[0])
                .join('; ');
            this._cookieTs  = Date.now();
            this._failCount = 0;
            this._backoffUntil = 0;
            console.log('[NSE] Session initialized ✓');
        } catch (e) {
            this._failCount++;
            const backoffMs = BACKOFF_SCHEDULE[Math.min(this._failCount - 1, BACKOFF_SCHEDULE.length - 1)];
            this._backoffUntil = Date.now() + backoffMs;
            const status = e.response?.status || 'ECONNREFUSED';
            console.warn(`[NSE] Session init failed (${status}) — backoff ${backoffMs / 1000}s (attempt #${this._failCount})`);
        }
    }

    async _get(path, retries = 1) {
        await this._initSession();
        if (!this._cookies) throw new Error('NSE session not available');

        const url = `https://www.nseindia.com${path}`;
        try {
            const r = await this._http.get(url, {
                headers: {
                    ...BASE_HEADERS,
                    Accept:             'application/json, text/plain, */*',
                    Referer:            'https://www.nseindia.com/',
                    Cookie:             this._cookies,
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });
            return r.data;
        } catch (e) {
            // Transient network timeout: retry once.
            if (retries > 0 && (e.code === 'ECONNABORTED' || String(e.message || '').includes('timeout'))) {
                return this._get(path, retries - 1);
            }
            // Session expired — refresh and retry once
            if (retries > 0 && (e.response?.status === 401 || e.response?.status === 403 || e.response?.status === 429)) {
                if (Date.now() - (this._lastAuthRefresh || 0) > 5000) {
                    this._lastAuthRefresh = Date.now();
                    console.warn('[NSE] Auth error, refreshing session...');
                    this._cookieTs = 0;
                    this._cookies  = '';
                }
                await this._initSession();
                return this._get(path, retries - 1);
            }
            throw e;
        }
    }

    // ──────────────── Public Methods ────────────────

    /**
     * Real-time quote for a single NSE equity.
     * @param {string} symbol  e.g. "HDFCBANK" or "HDFCBANK.NS"
     */
    async equityQuote(symbol) {
        const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
        return this._get(`/api/quote-equity?symbol=${encodeURIComponent(bare)}`);
    }

    /**
     * All constituent quotes for an NSE index.
     * e.g. "NIFTY 50", "NIFTY BANK", "NIFTY NEXT 50"
     */
    async indexConstituents(indexName) {
        return this._get(`/api/equity-stockIndices?index=${encodeURIComponent(indexName)}`);
    }

    /**
     * All major indices (includes Sensex, Nifty 50, Bank Nifty, etc.)
     */
    async allIndices() {
        return this._get('/api/allIndices');
    }

    /**
     * Intraday chart data for an NSE equity (5-min candles, current day).
     * @param {string} symbol  e.g. "HDFCBANK"
     */
    async intradayChart(symbol) {
        const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
        return this._get(`/api/chart-databyindex?index=${bare}EQ&indices=false`);
    }

    /**
     * Known NSE/BSE Trading Holidays (2025 - 2026).
     */
    static get HOLIDAYS() {
        return {
            // 2025
            '2025-01-26': 'Republic Day',
            '2025-02-26': 'Mahashivratri',
            '2025-03-14': 'Holi',
            '2025-03-31': 'Id-Ul-Fitr',
            '2025-04-10': 'Mahavir Jayanti',
            '2025-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
            '2025-04-18': 'Good Friday',
            '2025-05-01': 'Maharashtra Day',
            '2025-08-15': 'Independence Day',
            '2025-08-27': 'Ganesh Chaturthi',
            '2025-10-02': 'Mahatma Gandhi Jayanti',
            '2025-10-21': 'Diwali Laxmi Pujan',
            '2025-11-05': 'Guru Nanak Jayanti',
            '2025-12-25': 'Christmas',

            // 2026
            '2026-01-26': 'Republic Day',
            '2026-02-17': 'Mahashivratri',
            '2026-03-03': 'Holi',
            '2026-03-20': 'Id-Ul-Fitr',
            '2026-04-03': 'Good Friday',
            '2026-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
            '2026-05-01': 'Maharashtra Day',
            '2026-05-28': 'Bakri Id / Eid ul-Adha',
            '2026-08-15': 'Independence Day',
            '2026-09-14': 'Ganesh Chaturthi',
            '2026-10-02': 'Mahatma Gandhi Jayanti',
            '2026-10-20': 'Dussehra',
            '2026-11-08': 'Diwali Laxmi Pujan',
            '2026-11-24': 'Guru Nanak Jayanti',
            '2026-12-25': 'Christmas'
        };
    }

    /** Helper to format remaining duration into human-readable text */
    static _formatDuration(diffSeconds) {
        const days = Math.floor(diffSeconds / 86400);
        const hours = Math.floor((diffSeconds % 86400) / 3600);
        const minutes = Math.floor((diffSeconds % 3600) / 60);
        const seconds = diffSeconds % 60;

        if (days > 0) return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${seconds}s`;
        return `${seconds}s`;
    }

    /**
     * Complete NSE/BSE Trading Schedule & Market Status.
     * Computes session tracking (PRE_MARKET, REGULAR, POST_MARKET, CLOSED/AMO),
     * countdown to next session or next market open, weekend & holiday detection.
     */
    static getMarketStatus(date = new Date()) {
        const istFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            weekday: 'short'
        });

        const parts = istFormatter.formatToParts(date);
        const map = {};
        for (const p of parts) map[p.type] = p.value;

        const year = parseInt(map.year, 10);
        const month = parseInt(map.month, 10);
        const day = parseInt(map.day, 10);
        const hour = parseInt(map.hour, 10);
        const minute = parseInt(map.minute, 10);
        const second = parseInt(map.second, 10);
        const weekday = map.weekday;
        const dateString = `${map.year}-${map.month}-${map.day}`;
        const totalMin = hour * 60 + minute;

        const holidays = NSEClient.HOLIDAYS;
        const isWeekend = weekday === 'Sat' || weekday === 'Sun';
        const holidayName = holidays[dateString] || null;
        const isHoliday = !!holidayName;
        const isTradingDayToday = !isWeekend && !isHoliday;

        // Session classification (IST):
        // Pre-Market:  09:00 - 09:15
        // Regular:     09:15 - 15:30 (Continuous live trading)
        // Post-Market: 15:30 - 16:00 (Closing run)
        // Closed:      16:00 - 09:00 (After-Market Orders / Weekend / Holiday)
        let session = 'CLOSED';
        let sessionName = 'Market Closed';
        let isOpen = false;

        if (isTradingDayToday) {
            if (totalMin >= 9 * 60 && totalMin < 9 * 60 + 15) {
                session = 'PRE_MARKET';
                sessionName = 'Pre-Market Session';
                isOpen = false;
            } else if (totalMin >= 9 * 60 + 15 && totalMin < 15 * 60 + 30) {
                session = 'REGULAR';
                sessionName = 'Regular Trading';
                isOpen = true;
            } else if (totalMin >= 15 * 60 + 30 && totalMin < 16 * 60) {
                session = 'POST_MARKET';
                sessionName = 'Post-Market Closing';
                isOpen = false;
            } else {
                session = 'CLOSED';
                sessionName = totalMin < 9 * 60 ? 'Pre-Open (AMO Active)' : 'After-Market (AMO Active)';
                isOpen = false;
            }
        } else {
            session = 'CLOSED';
            sessionName = isWeekend ? 'Weekend Closed' : `Holiday (${holidayName})`;
            isOpen = false;
        }

        const pad = (n) => String(n).padStart(2, '0');
        const makeISTDate = (y, m, d, h = 9, min = 15, s = 0) =>
            new Date(`${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:${pad(s)}+05:30`);

        let nextOpen = makeISTDate(year, month, day, 9, 15, 0);

        if (!isTradingDayToday || date.getTime() >= nextOpen.getTime()) {
            let nextCandidate = new Date(makeISTDate(year, month, day, 12, 0, 0).getTime() + 24 * 3600 * 1000);
            while (true) {
                const cParts = istFormatter.formatToParts(nextCandidate);
                const cMap = {};
                for (const p of cParts) cMap[p.type] = p.value;
                const cY = parseInt(cMap.year, 10);
                const cM = parseInt(cMap.month, 10);
                const cD = parseInt(cMap.day, 10);
                const cWeekday = cMap.weekday;
                const cDateString = `${cMap.year}-${cMap.month}-${cMap.day}`;
                const cIsWeekend = cWeekday === 'Sat' || cWeekday === 'Sun';
                const cIsHoliday = !!holidays[cDateString];

                if (!cIsWeekend && !cIsHoliday) {
                    nextOpen = makeISTDate(cY, cM, cD, 9, 15, 0);
                    break;
                }
                nextCandidate = new Date(nextCandidate.getTime() + 24 * 3600 * 1000);
            }
        }

        const nowMs = date.getTime();
        let regularCloseTime = null;
        let countdown = '';

        if (session === 'REGULAR') {
            regularCloseTime = makeISTDate(year, month, day, 15, 30, 0);
            const secondsRemaining = Math.max(0, Math.floor((regularCloseTime.getTime() - nowMs) / 1000));
            countdown = NSEClient._formatDuration(secondsRemaining);
        } else {
            const secondsRemaining = Math.max(0, Math.floor((nextOpen.getTime() - nowMs) / 1000));
            countdown = NSEClient._formatDuration(secondsRemaining);
        }

        const nextOpenFormatter = new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        const nextOpenFormatted = nextOpenFormatter.format(nextOpen);

        let statusMessage = '';
        if (session === 'REGULAR') {
            statusMessage = `Live regular trading active • Closes in ${countdown} (03:30 PM IST)`;
        } else if (session === 'PRE_MARKET') {
            statusMessage = `Pre-market order discovery active • Opens in ${countdown} (09:15 AM IST)`;
        } else if (session === 'POST_MARKET') {
            statusMessage = `Post-market closing session active until 04:00 PM IST • Opens ${nextOpenFormatted} IST`;
        } else if (isWeekend) {
            statusMessage = `Weekend break • Regular market opens ${nextOpenFormatted} IST (${countdown})`;
        } else if (isHoliday) {
            statusMessage = `Closed for ${holidayName} • Regular market opens ${nextOpenFormatted} IST (${countdown})`;
        } else {
            statusMessage = `Market closed • Regular market opens ${nextOpenFormatted} IST (${countdown})`;
        }

        return {
            isOpen,
            session, // 'REGULAR' | 'PRE_MARKET' | 'POST_MARKET' | 'CLOSED'
            sessionName,
            isWeekend,
            isHoliday,
            holidayName,
            currentTimeIST: `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second} IST`,
            nextOpenTime: nextOpen.toISOString(),
            nextOpenFormatted: `${nextOpenFormatted} IST`,
            closeTime: regularCloseTime ? regularCloseTime.toISOString() : null,
            secondsUntilOpen: Math.max(0, Math.floor((nextOpen.getTime() - nowMs) / 1000)),
            secondsUntilClose: regularCloseTime ? Math.max(0, Math.floor((regularCloseTime.getTime() - nowMs) / 1000)) : 0,
            countdown,
            statusMessage,
            exchange: 'NSE'
        };
    }

    /** Returns true if NSE market is likely open (Mon–Fri, 9:15–15:30 IST) */
    static isMarketHours() {
        return NSEClient.getMarketStatus().isOpen;
    }

    /** Instance alias for getMarketStatus */
    getMarketStatus(date) {
        return NSEClient.getMarketStatus(date);
    }

    /** Instance alias for isMarketHours */
    isMarketHours() {
        return NSEClient.isMarketHours();
    }

    // ──────────────── Data Normalizer ────────────────

    /**
     * Normalize NSE's equityQuote response into our standard quote format.
     */
    static normalizeQuote(nsData, symbolWithSuffix) {
        const pi   = nsData?.priceInfo      || {};
        const info = nsData?.info           || {};
        const meta = nsData?.metadata       || {};
        const whl  = pi?.weekHighLow        || {};

        const mcapCr = parseFloat((meta.pdMarketCapFull || '').replace(/,/g, '')) || null;

        return {
            symbol:                     symbolWithSuffix,
            shortName:                  info.companyName || meta.companyName || symbolWithSuffix,
            regularMarketPrice:         pi.lastPrice      ?? 0,
            regularMarketChange:        pi.change         ?? 0,
            regularMarketChangePercent: pi.pChange        ?? 0,
            regularMarketPreviousClose: pi.previousClose  ?? 0,
            regularMarketOpen:          pi.open           ?? 0,
            regularMarketDayHigh:       pi.intraDayHighLow?.max ?? pi.dayHigh ?? 0,
            regularMarketDayLow:        pi.intraDayHighLow?.min ?? pi.dayLow  ?? 0,
            regularMarketVolume:        meta.totalTradedVolume  ?? 0,
            marketCap:                  mcapCr,
            marketCapUnit:              'Cr',
            fiftyTwoWeekHigh:           whl.max ?? null,
            fiftyTwoWeekLow:            whl.min ?? null,
            pe:                         parseFloat(meta.pdSymbolPe) || null,
            industry:                   meta.industry || info.industry || null,
            sector:                     nsData?.industryInfo?.sector || null,
            currency:                   'INR',
            exchange:                   'NSE',
            quoteType:                  'EQUITY',
            profile:                    null,
        };
    }
}

module.exports = new NSEClient();
