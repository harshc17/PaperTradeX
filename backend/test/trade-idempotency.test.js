const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function engine() {
    const orders = [];
    const user = { _id: 'user', balance: 1000, async save() {} };
    let quantity = 0;
    let transactions = 0;
    let open = true;
    let queue = Promise.resolve();
    const query = value => ({ session: async () => value });
    class Order {
        constructor(data) { Object.assign(this, data); }
        async save() { this.orderId = `M-${orders.length + 1}`; orders.push(this); }
        static findOne(filter) { return query(orders.find(o => o.user === filter.user && o.requestKey === filter.requestKey)); }
    }
    const models = { Order, User: { findById: () => query(user) },
        Portfolio: { findOne: () => query(quantity ? { quantity, averagePrice: 100,
            async save() { quantity = this.quantity; }, async deleteOne() { quantity = 0; } } : null),
            async create(rows) { quantity = rows[0].quantity; } },
        TransactionHistory: { async create() { transactions++; } } };
    const context = { module: { exports: {} }, console, require(name) {
        if (name === '../models') return models;
        if (name === 'mongoose') return { connection: { transaction(callback) {
            const result = queue.then(() => callback({})); queue = result.catch(() => {}); return result;
        } } };
        if (name === './NSEClient') return { getMarketStatus: () => ({ isOpen: open }) };
        if (name === './MarketIndex') return require('../src/services/MarketIndex');
        if (name === './QuoteIdentity') return require('../src/services/QuoteIdentity');
        throw Error(name);
    } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../src/services/TradeEngine'), 'utf8'), context);
    return { service: context.module.exports, orders, user, quantity: () => quantity,
        transactions: () => transactions, close: () => { open = false; } };
}

test('a lost buy response retried on another server creates one debit, holding and order', async () => {
    const e = engine();
    const args = ['user', 'BUY', 'ITC', 1, 100, 'MARKET', null, 'request-one'];
    const [first, retry] = await Promise.all([e.service.executeTrade(...args), e.service.executeTrade(...args)]);
    assert.equal(first.orderId, retry.orderId);
    assert.equal(e.user.balance, 900); assert.equal(e.quantity(), 1);
    assert.equal(e.orders.length, 1); assert.equal(e.transactions(), 1);
    await assert.rejects(e.service.executeTrade('user', 'BUY', 'ITC', 2, 100, 'MARKET', null, 'request-one'), /different trade/);
    e.close();
    assert.equal((await e.service.executeTrade(...args)).orderId, first.orderId);
});

test('selling once and retrying preserves balance and removes only the bought position', async () => {
    const e = engine();
    await e.service.executeTrade('user', 'BUY', 'ITC', 1, 100, 'MARKET', null, 'buy-one');
    const args = ['user', 'SELL', 'ITC', 1, 110, 'MARKET', null, 'sell-one'];
    await e.service.executeTrade(...args); await e.service.executeTrade(...args);
    assert.equal(e.user.balance, 1010); assert.equal(e.quantity(), 0);
    assert.equal(e.orders.length, 2); assert.equal(e.transactions(), 2);
});

test('queued limit-order replay does not create a second open order', async () => {
    const e = engine();
    const args = ['user', 'BUY', 'ITC', 1, 100, 'LIMIT', 90, 'limit-one'];
    const a = await e.service.executeTrade(...args); const b = await e.service.executeTrade(...args);
    assert.equal(a.orderId, b.orderId); assert.equal(b.status, 'OPEN');
    assert.equal(e.orders.length, 1); assert.equal(e.user.balance, 1000);
    assert.equal(e.transactions(), 0);
});
