const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const NSE = require('../src/services/NSEClient');

test('regular session boundaries, midnight, weekends and holidays use IST', () => {
    for (const [time, open] of [
        ['2026-11-06T00:30:00+05:30', false],
        ['2026-11-06T09:14:59+05:30', false],
        ['2026-11-06T09:15:00+05:30', true],
        ['2026-11-06T15:29:59+05:30', true],
        ['2026-11-06T15:30:00+05:30', false],
        ['2026-11-07T11:00:00+05:30', false],
        ['2026-11-24T11:00:00+05:30', false],
    ]) assert.equal(NSE.getMarketStatus(new Date(time)).isOpen, open, time);
    assert.equal(NSE.getMarketStatus(new Date('2026-11-06T00:30:00+05:30')).nextOpenTime,
        '2026-11-06T03:45:00.000Z');
});

function engine(open) {
    let reads = 0;
    const context = { module: { exports: {} }, console, require(name) {
        if (name === 'mongoose') return { connection: { transaction: callback => callback({}) } };
        if (name === './NSEClient') return {
            getMarketStatus: () => ({ isOpen: open, nextOpenFormatted: 'next session' }),
            isMarketHours: () => open,
        };
        return {
            User: { findById: () => ({ session: async () => { reads++; return { balance: 100000 }; } }) },
            Order: { find: async () => { reads++; return []; } },
        };
    } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../src/services/TradeEngine'), 'utf8'), context);
    return { service: context.module.exports, reads: () => reads };
}

test('closed market rejects buy/sell and market/limit orders without database mutations', async () => {
    const e = engine(false);
    for (const side of ['BUY', 'SELL']) for (const type of ['MARKET', 'LIMIT']) {
        await assert.rejects(e.service.executeTrade('test', side, 'RELIANCE', 1, 100, type, 90), /Market closed/);
    }
    await e.service.processMarketTick('RELIANCE', 80);
    assert.equal(e.reads(), 0);
});

test('open market rejects fractional quantities and nonfinite prices', async () => {
    const e = engine(true);
    for (const qty of [1.5, '2abc', -1, 0, true, Infinity]) {
        await assert.rejects(e.service.executeTrade('test', 'BUY', 'RELIANCE', qty, 100), /whole number/);
    }
    await assert.rejects(e.service.executeTrade('test', 'BUY', 'RELIANCE', 1, Infinity), /Price/);
    await assert.rejects(e.service.executeTrade('test', 'BUY', 'RELIANCE', 1, 100, 'INVALID'), /Order type/);
});
