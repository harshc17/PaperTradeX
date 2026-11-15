const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSnapshot, latest } = require('../src/services/OfficialIndexSnapshot');
const headers = 'Index Name,Index Date,Closing Index Value,Points Change,Change(%)';
const report = `${headers}\nNifty Midcap Select,13-11-2026,14346.45,23.7,.17\nNifty Financial Services,13-11-2026,27855.5,-201.65,-.72\nNifty Financial Services 25/50,13-11-2026,29863.6,-235.95,-.78\nNifty Next 50,13-11-2026,72874.7,-611.5,-.83`;

test('official fallback selects exact index names and keeps the report timestamp', () => {
    const quotes = parseSnapshot(report, '2026-11-13', 'official-report');
    assert.deepEqual(Object.keys(quotes).sort(), ['^FINNIFTY', '^MIDCPNIFTY']);
    assert.equal(quotes['^MIDCPNIFTY'].price, 14346.45);
    assert.equal(quotes['^FINNIFTY'].price, 27855.5);
    assert.equal(quotes['^FINNIFTY'].prevClose, 28057.15);
    assert.equal(+quotes['^FINNIFTY'].timestamp, Date.parse('2026-11-13T10:00:00Z'));
    assert.equal(quotes['^FINNIFTY'].source, 'official-nse-close');
    assert.deepEqual(parseSnapshot(report, '2026-11-12', 'old-report'), {});
    assert.deepEqual(parseSnapshot('<html>blocked</html>', '2026-11-13', 'bad-report'), {});
});

test('before opening uses the previous completed session and coalesces report requests', async () => {
    const saved = global.fetch;
    const urls = [];
    global.fetch = async url => { urls.push(url); return { ok: true, text: async () => report }; };
    try {
        const [a, b] = await Promise.all([latest(new Date('2026-11-16T08:00:00+05:30')), latest(new Date('2026-11-15T18:00:00+05:30'))]);
        assert.equal(a, b);
        assert.equal(urls.length, 1);
        assert(urls[0].endsWith('ind_close_all_13112026.csv'));
        assert.equal(a['^FINNIFTY'].asOf, '2026-11-13');
    } finally { global.fetch = saved; }
});

test('blocked NSE recovers both exact indices without using misleading Yahoo symbols', async () => {
    const nse = require('../src/services/NSEClient');
    const history = require('../src/services/HistoricalClient');
    const official = require('../src/services/OfficialIndexSnapshot');
    const MarketData = require('../src/services/MarketData');
    const original = { allIndices: nse.allIndices, indexQuote: history.indexQuote, latest: official.latest };
    const seen = [];
    nse.allIndices = async () => { throw new Error('NSE blocked'); };
    history.indexQuote = async symbol => { seen.push(symbol); return null; };
    official.latest = async () => parseSnapshot(report, '2026-11-13', 'official-report');
    try {
        const service = new MarketData({ emit() {} });
        await Promise.all([service._fetchIndices(), service._fetchIndices()]);
        assert.equal(service.cache['^MIDCPNIFTY'].price, 14346.45);
        assert.equal(service.cache['^FINNIFTY'].price, 27855.5);
        assert(!seen.includes('^NSMIDCP') && !seen.includes('^CNXFIN'));
        assert.equal(seen.length, 4);
    } finally {
        nse.allIndices = original.allIndices;
        history.indexQuote = original.indexQuote;
        official.latest = original.latest;
    }
});
