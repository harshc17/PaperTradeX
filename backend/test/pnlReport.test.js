const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildPnlReport, csvCell } = require('../src/services/PnlReport');
const { buildPnlWorkbook } = require('../src/services/PnlWorkbook');
const now = Date.parse('2026-11-20T09:00:00Z');
const trade = (type, quantity, totalAmount, symbol = 'ABC.NS') => ({ type, quantity, totalAmount, symbol,
    price: totalAmount / quantity, createdAt: '2026-11-19T05:00:00Z' });

test('partial sales and re-entry reconcile realised, open cost and combined P&L', async () => {
    const report = await buildPnlReport([trade('BUY', 3, 100), trade('SELL', 1, 40, 'ABC'), trade('BUY', 1, 40)],
        { now, marketOpen: true, getQuote: async symbol => { assert.equal(symbol, 'ABC'); return { price: 50, timestamp: now }; } });
    assert.deepEqual(report.summary, { realised: 6.67, unrealised: 43.33, invested: 106.67, currentValue: 150, complete: true });
    assert.match(report.csv, /"Combined P&L","50"/);
    assert.match(report.csv, /"ABC","3","106.67","50","150","43.33"/);
});

test('a full exit includes every sale and exact remaining cost, with no quote requests', async () => {
    const trades = [];
    for (let i = 0; i < 12; i++) trades.push(trade('BUY', 1, 10), trade('SELL', 1, 11));
    const report = await buildPnlReport(trades, { now, marketOpen: true, getQuote: () => { throw Error('No open holdings'); } });
    assert.equal(report.summary.realised, 12);
    assert.equal(report.summary.unrealised, 0);
    assert.equal(report.holdings.length, 0);
    assert.equal((report.csv.match(/"11","10","11","1"/g) || []).length, 12);
});

test('unavailable and future quotes leave valuations blank, while delayed quotes are labelled', async () => {
    const report = await buildPnlReport([trade('BUY', 1, 10, 'ABC'), trade('BUY', 1, 15, 'ABC.BO'), trade('BUY', 1, 20, 'MISSING')], {
        now, marketOpen: true, getQuote: async symbol => symbol === 'ABC' ? { price: 12, timestamp: now - 61000 } : symbol === 'ABC.BO' ? { price: 17, timestamp: now + 60000 } : null,
    });
    assert.equal(report.holdings[0].status, 'Delayed - last known quote');
    assert.equal(report.holdings[1].currentValue, null);
    assert.equal(report.summary.currentValue, null);
    assert.equal(report.summary.unrealised, null);
    assert.match(report.csv, /"Combined P&L",""/);
    assert.equal(report.summary.invested, 45);
});

test('empty accounts, invalid history and CSV spreadsheet formulas are handled safely', async () => {
    const report = await buildPnlReport([], { now, marketOpen: false, getQuote: async () => null });
    assert.equal(report.summary.realised, 0);
    assert.equal(report.summary.currentValue, 0);
    await assert.rejects(buildPnlReport([trade('SELL', 1, 10)], { now }), /missing purchases/);
    await assert.rejects(buildPnlReport([{ ...trade('BUY', 1, 10), symbol: null }], { now }), /incomplete/);
    assert.equal(csvCell('=SUM(A1)'), '"\'=SUM(A1)"');
    assert.equal(csvCell('ABC,"LTD"'), '"ABC,""LTD"""');
    assert.equal(csvCell(-5), '"-5"');
});

test('Excel file has readable column widths, numeric currency cells, separate sheets and filters', async () => {
    const report = await buildPnlReport([trade('BUY', 2, 100), trade('SELL', 1, 70)], {
        now, marketOpen: true, getQuote: async () => ({ price: 80, timestamp: now }),
    });
    const ExcelJS = require('exceljs');
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await buildPnlWorkbook(report));
    assert.deepEqual(book.worksheets.map(ws => ws.name), ['Summary', 'Completed sales', 'Holdings']);
    assert.equal(book.getWorksheet('Summary').getCell('B8').value, 20);
    assert.equal(book.getWorksheet('Summary').getCell('B9').value, 30);
    assert.equal(book.getWorksheet('Summary').getCell('B10').value, 50);
    const holdings = book.getWorksheet('Holdings');
    assert.equal(holdings.getCell('F6').value, 30);
    assert.match(holdings.getCell('F6').numFmt, /#,##0.00/);
    assert(holdings.getColumn(8).width >= 38);
    assert(holdings.getColumn(7).width >= 28);
    assert.equal(holdings.views[0].ySplit, 5);
    assert(holdings.autoFilter);
    assert.equal(holdings.getRow(5).height, 36);
    assert.equal(holdings.getCell('F5').alignment.wrapText, true);
});

test('Excel keeps unavailable valuations blank and security names as plain text', async () => {
    const report = await buildPnlReport([trade('BUY', 1, 10, '=HYPERLINK("invalid")')], { now, marketOpen: true, getQuote: async () => null });
    const book = new (require('exceljs').Workbook)();
    await book.xlsx.load(await buildPnlWorkbook(report));
    assert.equal(book.getWorksheet('Summary').getCell('B10').value, 'Unavailable');
    assert.equal(book.getWorksheet('Holdings').getCell('A6').value, '=HYPERLINK("INVALID")');
    assert.equal(book.getWorksheet('Holdings').getCell('E6').value, null);
});
