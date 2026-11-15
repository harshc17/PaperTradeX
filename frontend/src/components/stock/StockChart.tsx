'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useStockQuote } from '@/lib/useStockQuote';
import { API_URL } from '@/lib/config';
import { useTheme } from '@/context/ThemeContext';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Tooltip,
    Filler,
    ChartOptions,
    ChartData,
    Plugin,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { RefreshCw, WifiOff } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Filler);

const priceCursor: Plugin<'line'> = {
    id: 'priceCursor',
    afterDatasetsDraw(chart) {
        const active = chart.getActiveElements()[0];
        if (!active) return;
        const { ctx, chartArea } = chart;
        ctx.save();
        ctx.strokeStyle = '#8b929b';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(active.element.x, chartArea.top);
        ctx.lineTo(active.element.x, chartArea.bottom);
        ctx.stroke();
        ctx.restore();
    },
};

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type HistoryPoint = {
    date: string;
    close: number;
    open?: number;
    high?: number;
    low?: number;
    volume?: number;
};

type Period = {
    label: string;
    value: string;
    fmt: 'time' | 'dayTime' | 'date' | 'monthYear' | 'year';
    maxTicks: number;
};

/* ─── Period Config ──────────────────────────────────────────────────────────── */
const PERIODS: Period[] = [
    { label: '1D', value: '1d', fmt: 'time', maxTicks: 8 },
    { label: '1W', value: '1w', fmt: 'dayTime', maxTicks: 7 },
    { label: '1M', value: '1mo', fmt: 'date', maxTicks: 8 },
    { label: '6M', value: '6mo', fmt: 'date', maxTicks: 6 },
    { label: '1Y', value: '1y', fmt: 'date', maxTicks: 6 },
    { label: '5Y', value: '5y', fmt: 'monthYear', maxTicks: 5 },
    { label: 'ALL', value: 'max', fmt: 'year', maxTicks: 6 },
];

/* ─── Formatters ─────────────────────────────────────────────────────────────── */
function formatLabel(dateStr: string, fmt: Period['fmt']): string {
    const d = new Date(dateStr);
    switch (fmt) {
        case 'time':
            return d.toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata', hour12: false,
            });
        case 'dayTime':
            return d.toLocaleDateString('en-IN', {
                weekday: 'short', timeZone: 'Asia/Kolkata',
            }) + ' ' + d.toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
            });
        case 'date':
            return d.toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata',
            });
        case 'monthYear':
            return d.toLocaleDateString('en-IN', {
                month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata',
            });
        case 'year':
            return d.getFullYear().toString();
        default:
            return d.toLocaleDateString('en-IN');
    }
}

function formatINR(v: number, decimals = 2): string {
    return '₹' + v.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

function formatVol(v: number): string {
    if (!v) return '—';
    if (v >= 1e7) return `${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `${(v / 1e5).toFixed(2)} L`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)} K`;
    return String(v);
}

/* ─── Component ──────────────────────────────────────────────────────────────── */
type ChartFeed = { source?: string; resolution?: string; note?: string; delayed?: boolean; session?: string };
const chartCache = new Map<string, { data: HistoryPoint[]; prevClose: number | null; fetchedAt: number; feed: ChartFeed }>();
export default function StockChart({ symbol }: { symbol: string }) {
    const { theme } = useTheme();
    const [history, setHistory] = useState<HistoryPoint[]>([]);
    const [activePeriod, setActivePeriod] = useState<Period>(PERIODS[2]); // default 1M
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [refreshError, setRefreshError] = useState(false);
    const [feed, setFeed] = useState<ChartFeed>({});
    const requestRef = useRef<AbortController | null>(null);
    const quote = useStockQuote(symbol);
    const livePrice = quote.price;
    const isLive = !!quote.marketOpen && !quote.stale;
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    const [compactPlot, setCompactPlot] = useState(false);
    // prevClose = yesterday's closing price, used as the 1D return anchor.
    // Comes from the /history API response (Yahoo chart meta or NSE cache).
    const [prevClose, setPrevClose] = useState<number | null>(null);
    const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();

    /* ─── Fetch chart data ─────────────────────────────────────────────────────── */
    const fetchHistory = useCallback((period: Period, force = false) => {
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        const key = `${symbol.toUpperCase()}:${period.value}`;
        const cached = chartCache.get(key);
        setLoading(!cached);
        setError(false);
        setRefreshError(false);
        setHistory(cached?.data || []);
        setFeed(cached?.feed || {});
        setPrevClose(cached?.prevClose ?? null);
        setHoverIdx(null);
        if (!force && cached && Date.now() - cached.fetchedAt < 30000) return;
        const deadline = setTimeout(() => controller.abort(), 15000);

        fetch(
            `${API_URL}/api/stock/${encodeURIComponent(symbol)}/history?period=${period.value}`, { signal: controller.signal }
        )
            .then(r => r.ok ? r.json() : Promise.reject('bad response'))
            .then(data => {
                if (controller !== requestRef.current || controller.signal.aborted) return;
                const pts: HistoryPoint[] = (data.data || [])
                    .filter((h: any) => h.close && h.close > 0)
                    .map((h: any) => ({
                        date: h.date,
                        close: h.close,
                        open: h.open,
                        high: h.high,
                        low: h.low,
                        volume: h.volume ?? 0,
                    }));
                setHistory(pts);
                const nextFeed = { source: data.source, resolution: data.resolution, note: data.note, delayed: data.delayed, session: data.session };
                setFeed(nextFeed);
                if (pts.length) {
                    chartCache.set(key, { data: pts, prevClose: data.prevClose ?? null, fetchedAt: Date.now(), feed: nextFeed });
                    if (chartCache.size > 64) chartCache.delete(chartCache.keys().next().value!);
                }
                // Capture prevClose for 1D — the true anchor for 1D return calculation.
                if (typeof data.prevClose === 'number' && data.prevClose > 0) {
                    setPrevClose(data.prevClose);
                }
            })
            .catch(() => {
                if (controller !== requestRef.current) return;
                if (cached) setRefreshError(true); else setError(true);
            })
            .finally(() => { clearTimeout(deadline); if (controller === requestRef.current) setLoading(false); });
    }, [symbol]);

    /* ─── Period change ─────────────────────────────────────────────────────────── */
    useEffect(() => {
        fetchHistory(activePeriod);

        // Auto-refresh chart data every 60s when on 1D
        if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
        if (activePeriod.value === '1d') {
            refreshTimerRef.current = setInterval(() => fetchHistory(activePeriod, true), 60_000);
        }
        return () => {
            requestRef.current?.abort();
            if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
        };
    }, [activePeriod, fetchHistory]);

    /* ─── Derived values ─────────────────────────────────────────────────────────── */
    const displayHistory = history;
    const firstClose = displayHistory.length > 0 ? displayHistory[0].close : null;
    const lastClose = displayHistory.length > 0 ? displayHistory[displayHistory.length - 1].close : null;
    const currentDisp = (activePeriod.value === '1d' && livePrice) ? livePrice : lastClose;

    // For 1D: use prevClose (yesterday's session close) as the return baseline — NOT the
    // first intraday bar — so the figure matches what broker apps show.
    // For all other periods: use the first data point in the series.
    const baseline = (activePeriod.value === '1d' && prevClose != null && prevClose > 0)
        ? prevClose
        : firstClose;

    const priceChange = (baseline && currentDisp) ? currentDisp - baseline : 0;
    const pctChange = (baseline && baseline > 0 && currentDisp)
        ? ((currentDisp - baseline) / baseline) * 100
        : 0;
    const isPositive = priceChange >= 0;

    const light = theme === 'light';
    const color = isPositive ? (light ? '#007b5e' : '#00d09c') : (light ? '#ca394b' : '#ff6b6b');
    const axisColor = light ? '#6d7485' : '#9a9ea8';

    const labels = displayHistory.map(h => formatLabel(h.date, feed.resolution === 'daily' ? 'date' : activePeriod.fmt));
    const closes = displayHistory.map(h => h.close);
    const volumes = displayHistory.map(h => h.volume ?? 0);
    const hasVolume = volumes.some(v => v > 0);

    // If on 1D and we have livePrice, extend chart with current live point
    const chartLabels = [...labels];
    const chartCloses = [...closes];
    if (activePeriod.value === '1d' && isLive && !feed.delayed && feed.resolution !== 'daily' && livePrice && quote.timestamp && displayHistory.length > 0 && quote.timestamp >= Date.parse(displayHistory[displayHistory.length - 1].date)) {
        const liveFmt = formatLabel(new Date(quote.timestamp).toISOString(), 'time');
        if (chartLabels[chartLabels.length - 1] !== liveFmt) {
            chartLabels.push(liveFmt);
            chartCloses.push(livePrice);
        } else {
            chartCloses[chartCloses.length - 1] = livePrice;
        }
    }

    /* ─── Chart.js datasets ────────────────────────────────────────────────────── */
    const lineData: ChartData<'line'> = {
        labels: chartLabels,
        datasets: [{
            label: 'Price',
            data: chartCloses,
            borderColor: color,
            fill: false,
            tension: 0,
            pointRadius: displayHistory.length === 1 ? 4 : 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: color,
            pointHoverBorderColor: light ? '#fff' : '#181818',
            pointHoverBorderWidth: 2,
            borderWidth: 2,
        }],
    };

    const lineOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        onResize: (_chart, size) => setCompactPlot(size.width < 480),
        interaction: { mode: 'index', intersect: false },
        onHover: (_: any, elements: any[]) => {
            setHoverIdx(elements.length > 0 ? elements[0].index : null);
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: light ? '#ffffff' : '#222222',
                titleColor: light ? '#61697b' : '#b5b7be',
                bodyColor: light ? '#363b4d' : '#ecedef',
                padding: 14,
                borderColor: light ? '#e8e9ec' : '#383838',
                borderWidth: 1,
                cornerRadius: 10,
                displayColors: false,
                callbacks: {
                    title: (items: any[]) => items[0]?.label || '',
                    label: (ctx: any) => {
                        const i = ctx.dataIndex;
                        const p = displayHistory[i];
                        if (!p) return `Close: ${formatINR(ctx.raw)}`;
                        const lines = [`Close:  ${formatINR(p.close)}`];
                        if (p.open != null) lines.push(`Open:   ${formatINR(p.open)}`);
                        if (p.high != null) lines.push(`High:   ${formatINR(p.high)}`);
                        if (p.low != null) lines.push(`Low:    ${formatINR(p.low)}`);
                        if (p.volume) lines.push(`Vol:    ${formatVol(p.volume)}`);
                        return lines;
                    },
                },
            },
        },
        scales: {
            x: {
                display: true,
                grid: { display: false },
                ticks: {
                    color: axisColor,
                    font: { size: 11 },
                    maxTicksLimit: compactPlot ? 4 : activePeriod.maxTicks,
                    maxRotation: 0,
                    autoSkip: true,
                },
                border: { display: false },
            },
            y: {
                display: true,
                position: 'right' as const,
                grid: { display: false },
                ticks: {
                    color: axisColor,
                    font: { size: 11 },
                    padding: 8,
                    callback: (v: any) => formatINR(Number(v), 0),
                },
                border: { display: false },
            },
        },
        animation: { duration: 0 },
    };

    const volData: ChartData<'bar'> = {
        labels: chartLabels,
        datasets: [{
            label: 'Volume',
            data: volumes,
            backgroundColor: volumes.map((_, i) => {
                const isGreen = i === 0 || closes[i] >= closes[i - 1];
                return light ? (isGreen ? 'rgba(82,82,91,0.35)' : 'rgba(82,82,91,0.20)') : (isGreen ? 'rgba(177,177,183,0.30)' : 'rgba(177,177,183,0.18)');
            }),
            borderRadius: 2,
            borderSkipped: false,
        }],
    };

    const volOptions: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
            x: { display: false, grid: { display: false } },
            y: {
                display: false,
                grid: { display: false },
                border: { display: false },
            },
        },
        animation: { duration: 200 },
    };

    /* ─── Hover tooltip ──────────────────────────────────────────────────────────── */
    const hoverPt = hoverIdx != null ? displayHistory[hoverIdx] : null;
    const selectedPrice = hoverPt?.close ?? lastClose;
    const selectedChange = selectedPrice != null && baseline != null ? selectedPrice - baseline : null;
    const selectedPercent = selectedChange != null && baseline ? selectedChange / baseline * 100 : null;

    /* ─── Render ──────────────────────────────────────────────────────────────────── */
    return (
        <div className="bg-transparent">
            <div className="min-h-16 mb-3 flex flex-wrap items-end justify-between gap-2" data-testid="chart-readout">
                <div>
                    <p className="text-xs text-ink-faint mb-1">{hoverPt ? new Date(hoverPt.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : `${activePeriod.label} performance`}</p>
                    <p className="text-lg font-medium text-ink-heading font-num tabular-nums">{selectedPrice != null ? formatINR(selectedPrice) : '—'}</p>
                </div>
                {selectedChange != null && selectedPercent != null && <p className={`text-sm font-num tabular-nums ${selectedChange >= 0 ? 'text-up' : 'text-down'}`}>{selectedChange >= 0 ? '+' : '−'}{formatINR(Math.abs(selectedChange))} ({Math.abs(selectedPercent).toFixed(2)}%)</p>}
            </div>
            {feed.note && <p className="text-xs text-ink-muted mb-2" role="status">{feed.note}</p>}
            {refreshError && <p className="text-xs text-[var(--warning)] mb-2" role="status">Chart refresh unavailable. Showing saved candles.</p>}
            <div className="relative h-[300px] sm:h-[390px]">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-ink-muted">Loading chart...</p>
                    </div>
                ) : error ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2">
                        <WifiOff className="w-8 h-8 text-ink-faint" />
                        <p className="text-sm text-ink-muted">Failed to load chart data</p>
                        <button
                            onClick={() => fetchHistory(activePeriod, true)}
                            className="text-xs text-primary hover:underline font-medium"
                        >
                            Retry
                        </button>
                    </div>
                ) : displayHistory.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <p className="text-sm text-ink-muted">No data for this period</p>
                    </div>
                ) : (
                    <>
                        <div className="h-[235px] sm:h-[320px] relative" onMouseLeave={() => setHoverIdx(null)}>
                            <Line data={lineData} options={lineOptions} plugins={[priceCursor]} aria-label={`${symbol} ${activePeriod.label} price chart`} role="img" />
                        </div>
                        {hasVolume && (
                            <div className="h-10 mt-1 relative opacity-70">
                                <Bar data={volData} options={volOptions} />
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                {PERIODS.map((p) => (
                    <button
                        key={p.value}
                        aria-pressed={activePeriod.value === p.value}
                        onClick={() => setActivePeriod(p)}
                        className={`h-10 min-w-[44px] px-3 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                            activePeriod.value === p.value
                                ? 'bg-primary/10 text-primary'
                                : 'text-ink-muted hover:text-ink hover:bg-surface-2'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}

                <button
                    onClick={() => fetchHistory(activePeriod, true)}
                    disabled={loading}
                    className="h-9 w-9 rounded-full border border-line bg-surface-2 grid place-items-center text-ink-muted hover:text-primary hover:border-line disabled:opacity-50"
                    title="Refresh chart"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {hoverPt && (
                <div className="mt-2 text-xs text-ink-muted flex items-center gap-2.5 flex-wrap">
                    <span>O {formatINR(hoverPt.open ?? hoverPt.close)}</span>
                    <span>H {formatINR(hoverPt.high ?? hoverPt.close)}</span>
                    <span>L {formatINR(hoverPt.low ?? hoverPt.close)}</span>
                    <span>C {formatINR(hoverPt.close)}</span>
                    {(hoverPt.volume ?? 0) > 0 && <span>Vol {formatVol(hoverPt.volume!)}</span>}
                </div>
            )}

            <div className="mt-1 text-xs text-ink-faint">
                {feed.resolution === 'daily' ? 'Daily history' : feed.delayed ? 'Delayed intraday' : isLive ? 'Chart feed connected' : 'Chart feed delayed'} · {displayHistory.length} points · {feed.source || 'Historical OHLCV'}
            </div>
        </div>
    );
}
