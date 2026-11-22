function executeFinancialMath(input) {
    if (!input || typeof input !== 'object') throw Error('Provide calculation inputs.');
    const finite = (name, min, max) => {
        const n = input[name];
        if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) throw Error(`Invalid ${name}`);
        return n;
    };
    let value, unit;
    if (input.operation === 'percentage_change') {
        const initial = finite('initial', .000001, 1e12), final = finite('final', 0, 1e12);
        value = (final - initial) / initial * 100; unit = 'percent';
    } else if (input.operation === 'cagr') {
        const initial = finite('initial', .000001, 1e12), final = finite('final', 0, 1e12), years = finite('years', .01, 100);
        value = (Math.pow(final / initial, 1 / years) - 1) * 100; unit = 'percent per year';
    } else if (input.operation === 'sip_projection') {
        const monthly = finite('monthly', 0, 1e8), annualRate = finite('annualRate', -99, 100), months = finite('months', 1, 600);
        if (!Number.isInteger(months)) throw Error('Months must be a whole number.');
        const rate = annualRate / 1200;
        value = 0;
        // End-of-month contribution, explicitly hypothetical and not an expected return.
        for (let i = 0; i < months; i++) value = value * (1 + rate) + monthly;
        unit = 'INR; hypothetical end-of-month contribution scenario, not a forecast';
    } else if (input.operation === 'xirr') {
        const flows = input.flows;
        if (!Array.isArray(flows) || flows.length < 2 || flows.length > 1000) throw Error('Provide 2–1,000 dated cash flows.');
        const rows = flows.map(f => ({ amount: f.amount, at: /^\d{4}-\d{2}-\d{2}$/.test(f.date || '') ? Date.parse(`${f.date}T00:00:00Z`) : NaN })).sort((a, b) => a.at - b.at);
        if (rows.some(f => !Number.isFinite(f.amount) || Math.abs(f.amount) > 1e12 || !Number.isFinite(f.at)) ||
            !rows.some(f => f.amount < 0) || !rows.some(f => f.amount > 0)) throw Error('Invalid dated cash flows.');
        if (flows.some(f => new Date(`${f.date}T00:00:00Z`).toISOString().slice(0, 10) !== f.date)) throw Error('Invalid calendar date.');
        const daily = new Map();
        rows.forEach(f => daily.set(f.at, (daily.get(f.at) || 0) + f.amount));
        const signs = [...daily.values()].filter(n => n !== 0).map(Math.sign);
        if (signs.slice(1).filter((sign, i) => sign !== signs[i]).length !== 1) throw Error('Cash flows may have multiple XIRR roots; no reliable result is available.');
        const first = Math.min(...rows.map(f => f.at));
        if (Math.max(...rows.map(f => f.at)) - first < 86400000) throw Error('At least one day of history is required.');
        const npv = r => rows.reduce((sum, f) => sum + f.amount / Math.pow(1 + r, (f.at - first) / 31536000000), 0);
        let low = -.9999, high = 1;
        while (npv(low) * npv(high) > 0 && high < 1e6) high *= 2;
        if (!Number.isFinite(npv(low)) || npv(low) * npv(high) > 0) throw Error('No reliable XIRR solution.');
        for (let i = 0; i < 160; i++) { const mid = (low + high) / 2; if (npv(low) * npv(mid) <= 0) high = mid; else low = mid; }
        value = (low + high) / 2 * 100; unit = 'percent annualised using actual/365 calendar dates';
    } else throw Error('Unsupported calculation. Tax calculations require verified, effective-dated tax rules and are not available.');
    if (!Number.isFinite(value)) throw Error('Calculation is outside the supported range.');
    return { operation: input.operation, inputs: input, value: Number(value.toFixed(4)), unit, calculatedAt: new Date().toISOString() };
}
function parseCalculation(question) {
    const clean = question.replaceAll(',', '');
    const cagr = /\bcagr\b.*?\bfrom\s+(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s+(?:over|in)\s+(\d+(?:\.\d+)?)\s+years?/i.exec(clean);
    if (cagr) return { operation: 'cagr', initial: +cagr[1], final: +cagr[2], years: +cagr[3] };
    const change = /\b(?:percentage|percent)\s+change\b.*?\bfrom\s+(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)/i.exec(clean);
    if (change) return { operation: 'percentage_change', initial: +change[1], final: +change[2] };
    const sip = /\bsip\b\s*(?:of\s*)?(?:rs\.?\s*|inr\s*|₹\s*)?(\d+(?:\.\d+)?)\s*(?:per\s*month|monthly)\s*(?:at\s*)?(\d+(?:\.\d+)?)\s*%\s*(?:annual(?:ly)?\s*)?(?:for|over)\s*(\d+(?:\.\d+)?)\s*(years?|months?)/i.exec(clean);
    if (sip) return { operation: 'sip_projection', monthly: +sip[1], annualRate: +sip[2], months: +sip[3] * (/year/i.test(sip[4]) ? 12 : 1) };
    return null;
}
module.exports = { executeFinancialMath, parseCalculation };
