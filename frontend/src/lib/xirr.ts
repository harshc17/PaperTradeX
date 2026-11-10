export type XirrResult = { rate: number | null; days: number; reason?: string };
export type CashFlow = { amount: number; date: string };
const DAY = 86400000;
function dayNumber(value: string) {
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return NaN;
    // Execution timestamps use IST calendar dates; date-only valuation inputs
    // are already calendar dates. Like Excel XIRR, intraday times are ignored.
    return Math.floor((time + (/^\d{4}-\d{2}-\d{2}$/.test(value) ? 0 : 330 * 60000)) / DAY);
}

/** Irregular cash-flow IRR, actual days / 365, with the standard 10% guess.
 * https://support.microsoft.com/en-us/office/xirr-function-de1242ec-6477-445b-b11b-a303ad9adc9d
 */
export function calculateXirr(flows: CashFlow[]): XirrResult {
    const grouped = new Map<number, number>();
    for (const flow of flows) {
        const day = dayNumber(flow.date);
        if (!Number.isFinite(day) || !Number.isFinite(flow.amount)) return { rate: null, days: 0, reason: 'Invalid cash-flow data' };
        grouped.set(day, (grouped.get(day) || 0) + flow.amount);
    }
    const entries = [...grouped].filter(([, value]) => Math.abs(value) > 1e-9).sort((a, b) => a[0] - b[0]);
    const days = entries.length > 1 ? entries[entries.length - 1][0] - entries[0][0] : 0;
    const unavailable = (reason: string): XirrResult => ({ rate: null, days, reason });
    if (days <= 0 || !entries.some(([, v]) => v < 0) || !entries.some(([, v]) => v > 0)) return unavailable('Needs investment and valuation or sale on different dates');
    const scale = Math.max(...entries.map(([, amount]) => Math.abs(amount)));
    const terms = entries.map(([date, amount]) => ({ time: (date - entries[0][0]) / 365, amount: amount / scale }));
    // Solve in log(1 + rate), keeping rates above -100%. Scaling the
    // exponentials avoids overflow for long histories or extreme returns.
    const evaluate = (y: number) => {
        const shift = Math.max(...terms.map(t => -y * t.time));
        let value = 0, derivative = 0, magnitude = 0;
        for (const t of terms) {
            const v = t.amount * Math.exp(-y * t.time - shift);
            value += v; derivative -= t.time * v; magnitude += Math.abs(v);
        }
        return { value, derivative, magnitude };
    };
    const result = (y: number): XirrResult => {
        const rate = Math.expm1(y);
        return Number.isFinite(rate) && Number.isFinite(rate * 100) && rate > -1 ? { rate: Math.abs(rate) < 1e-10 ? 0 : rate, days } : unavailable('No stable annualised rate');
    };
    let y = Math.log1p(0.1);
    for (let i = 0; i < 100; i++) {
        const f = evaluate(y);
        if (Math.abs(f.value) <= 1e-12 * f.magnitude) return result(y);
        if (!Number.isFinite(f.derivative) || Math.abs(f.derivative) < 1e-15) break;
        const next = Math.max(-36, Math.min(640, y - Math.max(-4, Math.min(4, f.value / f.derivative))));
        if (Math.abs(next - y) < 1e-13) break;
        y = next;
    }
    const points = [-36, -20, -10, -5, -3, -2, -1, -.5, -.1, 0, Math.log1p(.1), .25, .5, 1, 2, 3, 5, 10, 20, 40, 80, 160, 320, 640];
    const brackets: Array<[number, number]> = [];
    for (let i = 1; i < points.length; i++) {
        const left = evaluate(points[i - 1]).value, right = evaluate(points[i]).value;
        if (left === 0) return result(points[i - 1]);
        if (right === 0) return result(points[i]);
        if (Math.sign(left) !== Math.sign(right)) brackets.push([points[i - 1], points[i]]);
    }
    if (!brackets.length) return unavailable('No stable annualised rate for these cash flows');
    // As with Excel's guess parameter, choose the bracket nearest 10% if
    // unconventional cash flows admit more than one solution.
    brackets.sort((a, b) => Math.abs((a[0] + a[1]) / 2 - Math.log1p(.1)) - Math.abs((b[0] + b[1]) / 2 - Math.log1p(.1)));
    let [low, high] = brackets[0];
    let sign = Math.sign(evaluate(low).value);
    for (let i = 0; i < 220; i++) {
        const mid = (low + high) / 2, f = evaluate(mid);
        if (Math.abs(f.value) <= 1e-12 * f.magnitude || high - low < 1e-12) return result(mid);
        if (Math.sign(f.value) === sign) low = mid; else high = mid;
    }
    return unavailable('No stable annualised rate');
}

type Trade = { symbol: string; type: 'BUY' | 'SELL'; totalAmount: number; createdAt: string };
type Holding = { symbol: string; quantity: number };
const symbolOf = (symbol: string) => symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
export function calculatePortfolioXirr(holdings: Holding[], trades: Trade[], prices: Record<string, number>, valuationDate: string) {
    const groups = new Map<string, CashFlow[]>();
    const group = (symbol: string) => {
        const key = symbolOf(symbol);
        if (!groups.has(key)) groups.set(key, []);
        return groups.get(key)!;
    };
    trades.forEach(t => group(t.symbol).push({ amount: t.type === 'BUY' ? -t.totalAmount : t.totalAmount, date: t.createdAt }));
    const missing = new Set<string>();
    holdings.forEach(h => {
        if (!h.quantity) return;
        const symbol = symbolOf(h.symbol), price = prices[symbol];
        if (!Number.isFinite(price) || price <= 0) { missing.add(symbol); group(symbol); return; }
        group(symbol).push({ amount: h.quantity * price, date: valuationDate });
    });
    const bySymbol: Record<string, XirrResult> = {};
    groups.forEach((flows, symbol) => { bySymbol[symbol] = missing.has(symbol) ? { rate: null, days: 0, reason: 'Waiting for current market price' } : calculateXirr(flows); });
    const portfolio = missing.size ? { rate: null, days: 0, reason: 'Waiting for current market prices' } : calculateXirr([...groups.values()].flat());
    return { portfolio, bySymbol };
}

export function formatXirr(rate: number) {
    const percent = rate * 100;
    const magnitude = Math.abs(percent);
    const number = magnitude >= 1000000 ? magnitude.toExponential(2) : magnitude.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${percent < 0 ? '−' : '+'}${number}%`;
}
