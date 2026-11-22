const { test } = require('node:test');
const assert = require('node:assert/strict');
const createTools = require('../src/services/GroundedTools');
const exchangeDisclosures = require('../src/services/ExchangeDisclosures');
test('grounding uses exchange-specific shared quotes and the authenticated account; missing data is never zero', async () => {
    const calls = [], accounts = { alice: { balance: 500, holdings: [] }, bob: { balance: 900, holdings: [] } };
    const chain = value => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, async lean() { return value; } });
    const tools = createTools({ TransactionHistory: { find(query) { calls.push(query); return chain([]); } },
        getPortfolioAccount: async id => accounts[id], getMarketContext: () => ({ marketOpen: false, sessionDate: '2026-11-20' }),
        getQuote: async symbol => symbol === 'ITC.NS' ? { price: 110, prevClose: 100, timestamp: '2026-11-20T10:00:00Z' } : null,
        User: { findById(id) { calls.push(id); return chain({ watchlistSymbols: ['ITC.NS'] }); } }, catalogue: [{ symbol: 'ITC.NS', shortname: 'ITC Limited' }] });
    const data = await tools.fetchLiveMarketData(['ITC.NS', 'ITC.BO']);
    assert.equal(data.quotes[0].changePercent, 10); assert.equal(data.quotes[0].status, 'market_closed');
    assert.equal(data.quotes[1].price, null); assert.equal(data.quotes[1].symbol, 'ITC.BO');
    assert.deepEqual(tools.resolveSymbols('Compare ITC and NIFTY 50 prices'), ['ITC.NS', '^NSEI']);
    assert.equal((await tools.fetchUserPortfolio('alice')).portfolio.balance, 500);
    assert.deepEqual(calls[0], { user: 'alice' });
    assert.deepEqual((await tools.fetchUserWatchlist('bob')).symbols, ['ITC.NS']); assert.equal(calls.at(-1), 'bob');
    assert.equal((await tools.fetchCompanyDisclosures('ITC.BO')).available, false);
    await assert.rejects(tools.fetchLiveMarketData(['https://private-host']));
});
test('exchange disclosure lookup respects a blocked session and sanitises titles, dates and attachment hosts', async () => {
    let calls = 0;
    const blocked = exchangeDisclosures({ _sessionValid: false, _get: async () => { calls++; } });
    assert.equal((await blocked('ITC')).available, false); assert.equal(calls, 0);
    const available = exchangeDisclosures({ _sessionValid: true, _inBackoff: false, _get: async path => {
        assert.ok(path.startsWith('/api/corporate-announcements?'));
        calls++;
        return [{ symbol: 'ITC', desc: '<b>Results announcement</b>', an_dt: '20-Nov-2026 15:30:00', attchmntFile: 'https://nsearchives.nseindia.com/a.pdf' },
            { symbol: 'ITC', desc: 'Unsafe link', an_dt: '19-Nov-2026 15:30:00', attchmntFile: 'https://attacker.example/a.pdf' }];
    } });
    const result = await available('ITC'); assert.equal(result.available, true); assert.equal(result.announcements[0].title, 'Results announcement');
    assert.equal(result.announcements[1].url, null);
    await available('ITC'); assert.equal(calls, 1);
});
