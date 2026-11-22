const UNVERIFIED = 'I do not have verified information to answer this based on the available documents.';
const DISCLAIMER = 'Disclaimer: This information is for educational and informational purposes only and does not constitute regulated investment, tax, or legal advice.';
function withDisclaimer(answer) {
    const text = String(answer).replace(/\n*>\s*\*?Disclaimer:[\s\S]*$/i, '').trim();
    return `${text}\n\n> *${DISCLAIMER}*`;
}
function adviceQuestion(question) {
    return /\bshould\s+(i|we)\s+(buy|sell|hold|switch|invest)\b|\b(which|what)\b.{0,45}\b(stock|fund|security|asset|share)s?\b.{0,30}\b(buy|sell|invest|choose|pick)\b|\brecommend\b.{0,50}\b(stock|fund|security|asset|share|investment)s?\b|\bbest\s+(stock|fund|share)s?\s+to\s+(buy|invest)\b/i.test(question);
}
function currentVersions(sources) {
    const latest = new Map();
    for (const s of sources) {
        if (!s.topicKey || !s.effectiveDate || !Number.isFinite(Date.parse(s.effectiveDate))) continue;
        const key = `${s.topicKey}:${s.section || ''}`;
        if (!latest.has(key) || Date.parse(s.effectiveDate) > latest.get(key)) latest.set(key, Date.parse(s.effectiveDate));
    }
    return sources.filter(s => !s.topicKey || !latest.has(`${s.topicKey}:${s.section || ''}`) ||
        (s.effectiveDate && Date.parse(s.effectiveDate) === latest.get(`${s.topicKey}:${s.section || ''}`)));
}
function sourceLabel(source) {
    if (source.scope === 'account' || source.scope === 'market' || source.scope === 'calculation') {
        return `Live Feed: ${source.observedAt || 'timestamp unavailable'}`;
    }
    return `${source.title}, ${source.section || 'Summary'}, ${source.effectiveDate || 'Effective date not supplied'}${!source.effectiveDate && source.reviewedAt ? `; reviewed ${source.reviewedAt}` : ''}`;
}
function expandCitations(answer, sources) {
    const labels = new Map(sources.map(s => [s.citation, sourceLabel(s)]));
    return answer.replace(/\[(S\d+)\]/g, (_, id) => `[${labels.get(id) || 'Source unavailable'}]`);
}
function hasUnsupportedNumbers(answer, sources) {
    const numbers = text => (String(text).replace(/\[(?:S\d+)\]/g, '').match(/(?<![a-zA-Z])[-+]?\d[\d,]*(?:\.\d+)?/g) || []).map(n => Number(n.replaceAll(',', '')));
    const allowed = new Set(numbers(JSON.stringify(sources)));
    return numbers(answer).some(n => !allowed.has(n));
}
function missingSentenceCitations(answer) {
    const lines = answer.split('\n').map(line => line.trim()).filter(Boolean);
    return lines.some((line, i) => {
        if (/^#|^\|?[\s|:-]+\|?$/.test(line) || (line.startsWith('|') && /^\|?[\s|:-]+\|?$/.test(lines[i + 1] || ''))) return false;
        return line.split(/(?<=[.!?])\s+(?=[A-Z])/).some(sentence => !/\[S\d+\]/.test(sentence));
    });
}
module.exports = { UNVERIFIED, DISCLAIMER, withDisclaimer, adviceQuestion, currentVersions, sourceLabel, expandCitations, hasUnsupportedNumbers, missingSentenceCitations };
