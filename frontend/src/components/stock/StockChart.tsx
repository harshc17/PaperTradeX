'use client';
import { apiFetch as fetch } from '@/lib/backend';


import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStockQuote } from '@/lib/useStockQuote';
import { API_URL } from '@/lib/config';
import { useTheme } from '@/context/ThemeContext';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Filler,
    ChartOptions,
    ChartData,
    Plugin,
    ChartType,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Maximize2, RefreshCw, WifiOff, X } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

type PriceCursorOptions = { previousClose: number | null; light: boolean; cursorVisible: boolean };
declare module 'chart.js' {
    interface PluginOptionsByType<TType extends ChartType> { priceCursor: PriceCursorOptions }
}
const priceCursor: Plugin<'line', PriceCursorOptions> = {
    id: 'priceCursor',
    beforeDatasetsDraw(chart, _args, { previousClose, light }) {
        if (!(previousClose && previousClose > 0)) return;
        const referenceY = chart.scales.y.getPixelForValue(previousClose);
        const { ctx, chartArea } = chart;
        const y = Math.max(chartArea.top, Math.min(chartArea.bottom, referenceY));
        ctx.save(); ctx.strokeStyle = light ? 'rgba(83,91,99,0.3)' : 'rgba(190,195,201,0.3)';
        ctx.lineWidth = 1; ctx.setLineDash([4.5, 2.5]); ctx.beginPath();
        ctx.moveTo(chartArea.left, y); ctx.lineTo(chartArea.right, y); ctx.stroke(); ctx.restore();
    },
    afterDatasetsDraw(chart, _args, { light, cursorVisible }) {
        const { ctx, chartArea } = chart;
        const latest = chart.getDatasetMeta(0).data.at(-1);
        const color = String(chart.data.datasets[0].borderColor);
        if (latest && Number.isFinite(latest.x) && Number.isFinite(latest.y) && latest.x >= chartArea.left && latest.x <= chartArea.right) {
            ctx.save(); ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(latest.x, latest.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
        if (!cursorVisible) return;
        const active = chart.getActiveElements()[0];
        if (!active || !Number.isFinite(active.element.x) || !Number.isFinite(active.element.y)) return;
        ctx.save();
        ctx.strokeStyle = light ? '#e0e3e7' : '#34373b';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(active.element.x, chartArea.top);
        ctx.lineTo(active.element.x, chartArea.bottom);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(active.element.x, active.element.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = light ? '#ffffff' : '#101010'; ctx.lineWidth = 3; ctx.stroke();
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
    { label: '3M', value: '3mo', fmt: 'date', maxTicks: 6 },
    { label: '6M', value: '6mo', fmt: 'date', maxTicks: 6 },
    { label: '1Y', value: '1y', fmt: 'date', maxTicks: 6 },
    { label: '3Y', value: '3y', fmt: 'monthYear', maxTicks: 6 },
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

/* ─── Component ──────────────────────────────────────────────────────────────── */
type ChartFeed = { source?: string; resolution?: string; note?: string; delayed?: boolean; session?: string };
const chartCache = new Map<string, { data: HistoryPoint[]; prevClose: number | null; fetchedAt: number; feed: ChartFeed }>();
export default function StockChart({ symbol }: { symbol: string }) {
    const { theme } = useTheme();
    const [fullScreen, setFullScreen] = useState(false);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const expandRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (!fullScreen) return;
        const dialog = dialogRef.current;
        dialog?.showModal();
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            dialog?.close();
            document.body.style.overflow = overflow;
            expandRef.current?.focus({ preventScroll: true });
        };
    }, [fullScreen]);
    const [history, setHistory] = useState<HistoryPoint[]>([]);
    const [activePeriod, setActivePeriod] = useState<Period>(PERIODS[0]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [refreshError, setRefreshError] = useState(false);
    const [feed, setFeed] = useState<ChartFeed>({});
    const requestRef = useRef<AbortController | null>(null);
    const quote = useStockQuote(symbol);
    const livePrice = quote.price;
    const isLive = !!quote.marketOpen && !quote.stale;
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    const [hoverX, setHoverX] = useState(0);
    const chartRef = useRef<ChartJS<'line'>>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const canvasFrameRef = useRef<HTMLDivElement>(null);
    const touchEndedAt = useRef(0);
    // prevClose = yesterday's closing price, used as the 1D return anchor.
    // Comes from the /history API response (Yahoo chart meta or NSE cache).
    const [prevClose, setPrevClose] = useState<number | null>(null);
    const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
    const plotSize = bare.startsWith('^')
        ? 'h-[clamp(180px,52vw,230px)] sm:h-[350px] lg:h-auto lg:aspect-[2.35/1]'
        : 'h-[clamp(180px,52vw,230px)] sm:h-[350px]';
    const placeholderSize = bare.startsWith('^') ? plotSize : 'h-[clamp(180px,52vw,230px)] sm:h-full';
    useEffect(() => {
        if (fullScreen || loading || error) return;
        const content = contentRef.current, canvas = canvasFrameRef.current;
        if (!content || !canvas) return;
        let animationFrame = 0;
        const measure = () => {
            const bounds = canvas.getBoundingClientRect();
            const tail = content.getBoundingClientRect().bottom - bounds.bottom;
            const viewport = window.visualViewport?.height || window.innerHeight;
            const preferred = window.innerWidth < 640 ? Math.max(180, Math.min(230, window.innerWidth * .52))
                : bare.startsWith('^') && window.innerWidth >= 1024 ? bounds.width / 2.35 : 350;
            const height = Math.max(96, Math.min(preferred, viewport - (bounds.top + window.scrollY) - tail - 12));
            const value = `${Math.floor(height)}px`;
            if (content.style.getPropertyValue('--chart-fit-height') !== value) content.style.setProperty('--chart-fit-height', value);
        };
        const schedule = () => { cancelAnimationFrame(animationFrame); animationFrame = requestAnimationFrame(measure); };
        const observer = new ResizeObserver(schedule);
        observer.observe(content);
        observer.observe(document.body);
        window.addEventListener('resize', schedule);
        window.visualViewport?.addEventListener('resize', schedule);
        schedule();
        return () => {
            cancelAnimationFrame(animationFrame); observer.disconnect();
            window.removeEventListener('resize', schedule);
            window.visualViewport?.removeEventListener('resize', schedule);
        };
    }, [fullScreen, loading, error, activePeriod.value, history.length, bare]);
    const formatChartPrice = (value: number) => bare.startsWith('^')
        ? value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : formatINR(value);

    /* ─── Fetch chart data ─────────────────────────────────────────────────────── */
    const fetchHistory = useCallback((period: Period, force = false) => {
        requestRef.current?.abort();
        chartRef.current?.setActiveElements([]);
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
                const pts: HistoryPoint[] = (Array.isArray(data.data) ? data.data : [])
                    .filter((h: any) => Number.isFinite(h.close) && h.close > 0 && Number.isFinite(Date.parse(h.date)))
                    .map((h: any) => ({
                        date: h.date,
                        close: h.close,
                        open: h.open,
                        high: h.high,
                        low: h.low,
                        volume: h.volume ?? 0,
                    })).sort((a: HistoryPoint, b: HistoryPoint) => Date.parse(a.date) - Date.parse(b.date));
                if (!pts.length) throw new Error('No valid chart candles');
                const prior = typeof data.prevClose === 'number' && data.prevClose > 0 ? data.prevClose : null;
                setHistory(pts);
                const nextFeed = { source: data.source, resolution: data.resolution, note: data.note, delayed: data.delayed, session: data.session };
                setFeed(nextFeed);
                if (pts.length) {
                    chartCache.set(key, { data: pts, prevClose: prior, fetchedAt: Date.now(), feed: nextFeed });
                    if (chartCache.size > 64) chartCache.delete(chartCache.keys().next().value!);
                }
                // Capture prevClose for 1D — the true anchor for 1D return calculation.
                setPrevClose(prior);
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
    const color = isPositive ? (light ? '#00b386' : '#00d09c') : '#ff5b35';
    const axisColor = light ? '#6d7485' : '#9a9ea8';

    const labels = displayHistory.map(h => formatLabel(h.date, feed.resolution === 'daily' ? 'date' : activePeriod.fmt));
    const closes = displayHistory.map(h => h.close);

    // If on 1D and we have livePrice, extend chart with current live point
    const chartLabels = [...labels];
    const chartCloses = [...closes];
    const plotPoints = [...displayHistory];
    if (activePeriod.value === '1d' && isLive && !feed.delayed && feed.resolution !== 'daily' && livePrice && quote.timestamp && displayHistory.length > 0 && quote.timestamp >= Date.parse(displayHistory[displayHistory.length - 1].date)) {
        const liveFmt = formatLabel(new Date(quote.timestamp).toISOString(), 'time');
        if (chartLabels[chartLabels.length - 1] !== liveFmt) {
            chartLabels.push(liveFmt);
            chartCloses.push(livePrice);
            plotPoints.push({ date: new Date(quote.timestamp).toISOString(), close: livePrice });
        } else {
            chartCloses[chartCloses.length - 1] = livePrice;
            plotPoints[plotPoints.length - 1] = { ...plotPoints[plotPoints.length - 1], date: new Date(quote.timestamp).toISOString(), close: livePrice };
        }
    }

    // Reserve the complete 09:15–15:30 IST session without filling future time with prices.
    const sessionDate = plotPoints[0]?.date ? new Date(plotPoints[0].date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : null;
    const sessionStart = sessionDate ? Date.parse(`${sessionDate}T09:15:00+05:30`) : 0;
    const sessionEnd = sessionDate ? Date.parse(`${sessionDate}T15:30:00+05:30`) : 0;
    const sessionTimeline = activePeriod.value === '1d' && feed.resolution !== 'daily' && plotPoints.length > 0
        && plotPoints.every(point => Date.parse(point.date) >= sessionStart && Date.parse(point.date) <= sessionEnd);

    /* ─── Chart.js datasets ────────────────────────────────────────────────────── */
    const lineData: ChartData<'line'> = {
        labels: chartLabels,
        datasets: [{
            label: 'Price',
            data: sessionTimeline ? plotPoints.map(point => ({ x: Date.parse(point.date), y: point.close })) : chartCloses,
            borderColor: color,
            fill: false,
            tension: 0,
            pointRadius: displayHistory.length === 1 ? 4 : 0,
            pointHoverRadius: 0,
            pointHoverBackgroundColor: color,
            pointHoverBorderColor: light ? '#fff' : '#181818',
            pointHoverBorderWidth: 2,
            borderWidth: 3,
        }],
    };

    const lineOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { left: 7, right: 8, top: 8, bottom: 8 } },
        interaction: { mode: 'index', axis: 'x', intersect: false },
        onHover: (event, elements, chart) => {
            // Mobile browsers can emit a mouse event after touch release.
            if (Date.now() - touchEndedAt.current < 800) { chart.setActiveElements([]); return; }
            if (sessionTimeline && event.x != null && Number(chart.scales.x.getValueForPixel(event.x)) > Date.parse(plotPoints[plotPoints.length - 1].date) + 30000) {
                chart.setActiveElements([]); setHoverIdx(null); return;
            }
            setHoverIdx(elements.length > 0 ? elements[0].index : null);
            setHoverX(elements[0]?.element.x ?? 0);
        },
        plugins: {
            priceCursor: { previousClose: activePeriod.value === '1d' ? prevClose : null, light, cursorVisible: hoverIdx != null },
            legend: { display: false },
            tooltip: {
                enabled: false,
            },
        },
        scales: {
            x: {
                type: sessionTimeline ? 'linear' : 'category',
                min: sessionTimeline ? sessionStart : undefined,
                max: sessionTimeline ? sessionEnd : undefined,
                display: false,
                grid: { display: false },
                ticks: {
                    color: axisColor,
                    font: { size: 11 },
                    maxTicksLimit: activePeriod.maxTicks,
                    maxRotation: 0,
                    autoSkip: true,
                },
                border: { display: false },
            },
            y: {
                grace: '5%',
                display: false,
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

    /* ─── Hover tooltip ──────────────────────────────────────────────────────────── */
    const hoverPt = hoverIdx != null ? plotPoints[hoverIdx] : null;
    const selectedPrice = chartCloses.at(-1) ?? null;
    const selectedChange = selectedPrice != null && baseline != null ? selectedPrice - baseline : null;
    const selectedPercent = selectedChange != null && baseline ? selectedChange / baseline * 100 : null;
    const clearCursor = () => { setHoverIdx(null); chartRef.current?.setActiveElements([]); chartRef.current?.draw(); };
    const endTouch = () => { touchEndedAt.current = Date.now(); clearCursor(); };
    const inspectWithKey = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') { clearCursor(); return; }
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !plotPoints.length) return;
        event.preventDefault();
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? plotPoints.length - 1
            : Math.max(0, Math.min(plotPoints.length - 1, (hoverIdx ?? 0) + (event.key === 'ArrowLeft' ? -1 : 1)));
        const chart = chartRef.current; if (!chart) return;
        chart.setActiveElements([{ datasetIndex: 0, index }]); chart.draw();
        setHoverIdx(index); setHoverX(chart.getDatasetMeta(0).data[index].x);
    };

    /* ─── Render ──────────────────────────────────────────────────────────────────── */
    const content = (
        <div ref={contentRef} className={fullScreen ? 'h-full min-h-0 flex flex-col' : 'bg-transparent'}>
            {fullScreen && <div className="shrink-0 mb-2 flex items-center justify-between gap-3">
                <h2 id="full-chart-title" className="text-base sm:text-lg font-semibold text-ink-heading">{symbol.replace(/^\^/, '').replace(/\.(NS|BO)$/, '')} chart</h2>
                <button type="button" onClick={() => { clearCursor(); setFullScreen(false); }} aria-label="Close full-screen chart" className="w-11 h-11 shrink-0 grid place-items-center rounded-full border border-line text-ink-muted hover:text-primary">
                    <X className="w-5 h-5" />
                </button>
            </div>}
            {activePeriod.value !== '1d' && <div className="min-h-6 mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint" data-testid="chart-readout">
                <><span>{activePeriod.label} return</span>
                {selectedChange != null && selectedPercent != null && <span className={`font-num tabular-nums ${selectedChange >= 0 ? 'text-up' : 'text-down'}`}>{selectedChange >= 0 ? '+' : '−'}{formatChartPrice(Math.abs(selectedChange))} ({Math.abs(selectedPercent).toFixed(2)}%)</span>}</>
            </div>}
            {feed.note && <p className="text-xs text-ink-muted mb-2" role="status">{feed.note}</p>}
            {refreshError && <p className="text-xs text-[var(--warning)] mb-2" role="status">Chart refresh unavailable. Showing saved candles.</p>}
            <div className={fullScreen ? 'relative flex-1 min-h-0 flex flex-col pt-6' : 'relative pt-6'} data-testid="price-plot">
                {hoverPt && <div data-testid="chart-cursor-label" className="absolute top-0 w-[180px] max-w-full text-center text-[11px] text-ink-heading whitespace-nowrap pointer-events-none" style={{ left: `clamp(0px, ${hoverX - 90}px, max(0px, 100% - 180px))` }}>
                    {formatChartPrice(hoverPt.close)} <span className="text-ink-faint">|</span> {activePeriod.value === '1d' ? new Date(hoverPt.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : new Date(hoverPt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: ['1y', '3y', '5y', 'max'].includes(activePeriod.value) ? 'numeric' : undefined, timeZone: 'Asia/Kolkata' })}
                </div>}
                {loading ? (
                    <div className={`${fullScreen ? 'flex-1 min-h-0' : placeholderSize} flex flex-col items-center justify-center gap-3`}>
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-ink-muted">Loading chart...</p>
                    </div>
                ) : error ? (
                    <div className={`${fullScreen ? 'flex-1 min-h-0' : placeholderSize} flex flex-col items-center justify-center gap-2`}>
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
                    <div className={`${fullScreen ? 'flex-1 min-h-0' : placeholderSize} flex items-center justify-center`}>
                        <p className="text-sm text-ink-muted">No data for this period</p>
                    </div>
                ) : (
                    <>
                        <div ref={canvasFrameRef} style={fullScreen ? undefined : { height: 'var(--chart-fit-height, 200px)' }} className={`${fullScreen ? 'flex-1 min-h-0' : 'min-h-24'} relative cursor-crosshair touch-pan-y`} onMouseLeave={clearCursor} onTouchStartCapture={() => { touchEndedAt.current = 0; }} onTouchEnd={endTouch} onTouchCancel={endTouch}>
                            <Line ref={chartRef} data={lineData} options={lineOptions} plugins={[priceCursor]} aria-label={`${symbol} ${activePeriod.label} price chart. Use arrow keys to inspect prices; Escape clears selection.`} role="img" tabIndex={0} onKeyDown={inspectWithKey} onBlur={clearCursor} />
                        </div>
                    </>
                )}
            </div>

            <div className="shrink-0 mt-2 flex items-center gap-2 pb-1 border-t border-line pt-2">
                <div className="min-w-0 flex-1 flex items-center gap-2 overflow-x-auto">
                {PERIODS.map((p) => (
                    <button
                        key={p.value}
                        aria-pressed={activePeriod.value === p.value}
                        onClick={() => setActivePeriod(p)}
                        className={`h-11 min-w-[44px] shrink-0 px-3 rounded-full border text-xs sm:text-sm font-medium transition-colors ${
                            activePeriod.value === p.value
                                ? 'bg-surface-3 border-ink-heading text-ink-heading'
                                : 'border-line text-ink-muted hover:text-ink hover:bg-surface-2'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}

                <button
                    onClick={() => fetchHistory(activePeriod, true)}
                    disabled={loading}
                    className="h-11 w-11 shrink-0 rounded-full border border-line bg-surface-2 grid place-items-center text-ink-muted hover:text-primary hover:border-line disabled:opacity-50"
                    aria-label="Refresh chart"
                    title="Refresh chart"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                </div>
                {!fullScreen && <button ref={expandRef} type="button" onClick={() => { clearCursor(); setFullScreen(true); }} aria-label="Open full-screen chart" title="Full view" className="h-11 w-11 sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 rounded-lg border border-line sm:px-3 text-xs font-medium text-ink-muted hover:text-primary hover:bg-surface-2">
                    <Maximize2 className="w-4 h-4" /><span className="hidden sm:inline">Full view</span>
                </button>}
            </div>

            <div className="shrink-0 mt-1 text-xs text-ink-faint">
                {feed.resolution === 'daily' ? 'Daily history' : feed.delayed ? 'Delayed intraday' : isLive ? 'Chart feed connected' : 'Chart feed delayed'} · {displayHistory.length} points · {feed.source || 'Historical OHLCV'}
            </div>
        </div>
    );
    return fullScreen ? createPortal(
        <dialog ref={dialogRef} aria-labelledby="full-chart-title" onCancel={() => { clearCursor(); setFullScreen(false); }} onClose={() => setFullScreen(false)} className="fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none border-0 bg-surface p-3 sm:p-[clamp(12px,3dvh,24px)] text-ink backdrop:bg-black/60">
            {content}
        </dialog>, document.body,
    ) : content;
}
