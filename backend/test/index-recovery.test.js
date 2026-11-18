const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSnapshot, latest } = require('../src/services/OfficialIndexSnapshot');
const headers = 'Index Name,Index Date,Closing Index Value,Points Change,Change(%)';

test('delayed intraday indices continue recovering after close without an older report rolling them back', async () => {
    const nse = require('../src/services/NSEClient');
    const history = require('../src/services/HistoricalClient');
    const official = require('../src/services/OfficialIndexSnapshot');
    const intraday = require('../src/services/IndexIntraday');
    const MarketData = require('../src/services/MarketData');
    const saved = { open: nse.constructor.isMarketHours, all: nse.allIndices, index: history.indexQuote,
        history: history.historical, latest: official.latest, intraday: intraday.historical };
    const at = Date.now() - 60000;
    try {
        nse.constructor.isMarketHours = () => false;
        nse.allIndices = async () => ({ data: [] });
        history.indexQuote = async () => null;
        history.historical = async () => ({ data: [] });
        official.latest = async () => ({ '^FINNIFTY': { price: 90, timestamp: new Date(at - 86400000) } });
        intraday.historical = async () => ({ data: [{ date: new Date(at).toISOString(), close: 105 }], prevClose: 100 });
        const service = new MarketData({ emit() {} });
        for (const key of ['^MIDCPNIFTY', '^FINNIFTY']) {
            service._updateCache(key, 101, 1, 1, key, at - 1800000);
        }
        await service._fetchIndices();
        for (const key of ['^MIDCPNIFTY', '^FINNIFTY']) {
            assert.equal(service.cache[key].price, 105);
            assert.equal(service.cache[key].prevClose, 100);
            assert.equal(+service.cache[key].timestamp, at);
        }
    } finally {
        nse.constructor.isMarketHours = saved.open; nse.allIndices = saved.all;
        history.indexQuote = saved.index; history.historical = saved.history;
        official.latest = saved.latest; intraday.historical = saved.intraday;
    }
});
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

test('live intraday recovery replaces an old close and older index replies cannot roll it back', async () => {
    const nse = require('../src/services/NSEClient');
    const history = require('../src/services/HistoricalClient');
    const official = require('../src/services/OfficialIndexSnapshot');
    const intraday = require('../src/services/IndexIntraday');
    const MarketData = require('../src/services/MarketData');
    const saved = { open: nse.constructor.isMarketHours, all: nse.allIndices, index: history.indexQuote, latest: official.latest, intraday: intraday.historical };
    const at = Date.now() - 120000;
    try {
        nse.constructor.isMarketHours = () => true;
        nse.allIndices = async () => { throw new Error('blocked'); };
        history.indexQuote = async () => null;
        official.latest = async () => parseSnapshot(report, '2026-11-13', 'official-report');
        intraday.historical = async key => ({ data: [{ date: new Date(at).toISOString(), close: key === '^MIDCPNIFTY' ? 14500 : 28000 }], prevClose: 14000 });
        const service = new MarketData({ emit() {} });
        await service._fetchIndices();
        assert.equal(service.cache['^MIDCPNIFTY'].price, 14500);
        assert.equal(service.cache['^FINNIFTY'].price, 28000);
        assert.equal(+service.cache['^FINNIFTY'].timestamp, at);
        service._allIndicesCooldownUntil = 0;
        nse.allIndices = async () => ({ timestamp: '13-Nov-2026 15:30:00', data: [{ index: 'NIFTY FINANCIAL SERVICES', last: 27000, variation: 100, percentChange: .3 }] });
        await service._loadIndices();
        assert.equal(service.cache['^FINNIFTY'].price, 28000);
        assert(!service.cache['^FINNIFTY.NS']);
    } finally {
        nse.constructor.isMarketHours = saved.open; nse.allIndices = saved.all;
        history.indexQuote = saved.index; official.latest = saved.latest; intraday.historical = saved.intraday;
    }
});

test('NIFTY previous close is derived from the official session change', () => {
    const quotes = parseSnapshot(`${headers}\nNifty 50,13-11-2026,25144.3,-155.05,-.61`, '2026-11-13', 'official-report');
    assert.equal(quotes['^NSEI'].prevClose, 25299.35);
    assert.equal(quotes['^NSEI'].change, -155.05);
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
    const intraday = require('../src/services/IndexIntraday');
    const original = { allIndices: nse.allIndices, indexQuote: history.indexQuote, latest: official.latest, intraday: intraday.historical };
    intraday.historical = async () => { throw new Error('Intraday unavailable in this fixture'); };
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
        intraday.historical = original.intraday;
        nse.allIndices = original.allIndices;
        history.indexQuote = original.indexQuote;
        official.latest = original.latest;
    }
});
