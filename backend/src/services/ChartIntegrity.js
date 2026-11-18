const time = value => value instanceof Date ? +value : Date.parse(value);
const day = value => new Date(time(value) + 330 * 60000).toISOString().slice(0, 10);

function validateCandles(points, now = new Date()) {
    let previous = -Infinity;
    for (const point of points) {
        const at = time(point.date);
        if (!Number.isFinite(at) || at > +now + 15000 || at <= previous ||
            !Number.isFinite(point.close) || point.close <= 0) throw Error('Invalid chart price or timestamp');
        for (const key of ['open', 'high', 'low']) {
            if (point[key] != null && (!Number.isFinite(point[key]) || point[key] <= 0)) throw Error('Invalid chart OHLC');
        }
        if ((point.high != null && point.close > point.high + .02) ||
            (point.low != null && point.close < point.low - .02) ||
            (point.high != null && point.low != null && point.high < point.low)) throw Error('Chart close conflicts with OHLC');
        previous = at;
    }
    return points;
}

function withinDailyRanges(points, daily) {
    const ranges = new Map(daily.map(p => [day(p.date), p]));
    return points.every(point => {
        const range = ranges.get(day(point.date));
        return !range || !(range.high > 0 && range.low > 0) ||
            (point.close >= range.low - .02 && point.close <= range.high + .02);
    });
}

function withLatestSession(series, intraday) {
    const data = series.data || [], points = intraday.data || [], last = points.at(-1);
    if (!last || !data.length || day(last.date) <= day(data.at(-1).date)) return series;
    validateCandles(points);
    const currentDay = day(last.date), session = points.filter(p => day(p.date) === currentDay);
    const latest = { date: last.date, open: session[0].open ?? session[0].close,
        high: Math.max(...session.map(p => p.high ?? p.close)), low: Math.min(...session.map(p => p.low ?? p.close)),
        close: last.close, volume: session.reduce((sum, p) => sum + (p.volume || 0), 0) };
    return { ...series, data: [...data, latest], asOf: last.date,
        source: series.source + ' + latest delayed session',
        note: 'Historical series with latest session from delayed intraday observations' };
}
module.exports = { validateCandles, withinDailyRanges, withLatestSession };
