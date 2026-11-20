const ExcelJS = require('exceljs');
const TEAL = 'FF007F78';
const moneyFormat = '"₹"#,##0.00;[Red]("₹"#,##0.00);"—"';

async function buildPnlWorkbook(report) {
    const book = new ExcelJS.Workbook();
    book.creator = 'PaperTradeX'; book.created = new Date(report.generatedAt);
    function style(row, header = false) {
        row.height = header ? 36 : 26;
        row.eachCell({ includeEmpty: true }, cell => {
            cell.font = { name: 'Calibri', size: 11, bold: header, color: { argb: header ? 'FFFFFFFF' : 'FF20343B' } };
            cell.alignment = { vertical: 'middle', wrapText: header, indent: 1 };
            if (header || row.number % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: header ? TEAL : 'FFF1F7F6' } };
        });
    }
    function sheet(name, title, widths) {
        const ws = book.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 5, showGridLines: false }] });
        ws.columns = widths.map(width => ({ width })); ws.properties.defaultRowHeight = 24;
        ws.mergeCells(1, 1, 2, widths.length);
        const cell = ws.getCell('A1'); cell.value = title;
        cell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
        cell.alignment = { vertical: 'middle', indent: 1 };
        ws.getCell('A3').value = 'Paper trading · INR · All time';
        ws.getCell('A3').font = { name: 'Calibri', size: 10, color: { argb: 'FF62767E' } };
        ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
        return ws;
    }
    const summary = sheet('Summary', 'PaperTradeX | Profit & Loss', [44, 28, 20, 20]);
    summary.getRow(4).values = ['Period', 'All time']; style(summary.getRow(4));
    summary.getCell('A5').value = 'Generated at (UTC)'; summary.mergeCells('B5:D5'); summary.getCell('B5').value = report.generatedAt; style(summary.getRow(5));
    summary.getRow(7).values = ['Metric', 'Amount (INR)']; style(summary.getRow(7), true);
    const s = report.summary;
    [['Realised P&L', s.realised], ['Unrealised P&L', s.unrealised],
        ['Combined P&L', s.unrealised == null ? null : Number((s.realised + s.unrealised).toFixed(2))],
        ['Open position cost', s.invested], ['Open position value', s.currentValue]].forEach((values, index) => {
        const row = summary.getRow(8 + index); row.values = values; style(row);
        row.getCell(2).numFmt = moneyFormat;
        row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
        if (values[1] === null) row.getCell(2).value = 'Unavailable';
        if (index === 2) row.font = { name: 'Calibri', size: 12, bold: true, color: { argb: TEAL } };
    });
    summary.getCell('A14').value = 'Valuation status'; summary.mergeCells('B14:D15');
    summary.getCell('B14').value = !s.complete ? 'Incomplete: some quotes unavailable. Combined totals are unavailable.' : report.holdings.some(p => p.status.startsWith('Delayed')) ? 'Includes delayed quotes. See Holdings for source times.' : 'Complete: latest available quotes.';
    summary.getCell('B14').alignment = { wrapText: true, vertical: 'middle' };
    ['Weighted-average recorded purchase cost. Partial-sale cost is allocated to paise; full exits use the remaining cost.',
        'Virtual funds only. Cash and pending/cancelled orders are excluded. No additional fees or taxes assumed.',
        'This is not a tax statement. Quotes can have different source times; unavailable prices are never treated as zero.'].forEach((text, i) => {
        summary.mergeCells(18 + i * 2, 1, 19 + i * 2, 4);
        const cell = summary.getCell(18 + i * 2, 1); cell.value = text;
        cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF62767E' } };
        cell.alignment = { wrapText: true, vertical: 'middle', indent: 1 };
    });
    function details(name, title, widths, headers, rows, moneyColumns, pnlColumn) {
        const ws = sheet(name, title, widths);
        ws.getRow(5).values = headers; style(ws.getRow(5), true);
        for (const values of rows) {
            const row = ws.addRow(values); style(row);
            for (const col of moneyColumns) {
                row.getCell(col).numFmt = moneyFormat;
                row.getCell(col).alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
            }
            const pnl = row.getCell(pnlColumn);
            if (typeof pnl.value === 'number') pnl.font = { name: 'Calibri', size: 11, color: { argb: pnl.value < 0 ? 'FFBC3A36' : TEAL } };
        }
        ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: Math.max(5, ws.rowCount), column: headers.length } };
    }
    details('Completed sales', 'Completed sales | Realised P&L', [28, 24, 14, 25, 25, 25, 25],
        ['Sold at (UTC)', 'Symbol', 'Quantity', 'Execution price (INR)', 'Cost basis (INR)', 'Proceeds (INR)', 'Realised P&L (INR)'],
        report.sales.map(sale => [sale.closedAt, sale.symbol, sale.quantity, sale.price, sale.costBasis, sale.proceeds, sale.pnl]), [4, 5, 6, 7], 7);
    details('Holdings', 'Open positions | Unrealised P&L', [24, 14, 25, 25, 27, 27, 28, 38],
        ['Symbol', 'Quantity', 'Cost (INR)', 'Quote price (INR)', 'Current value (INR)', 'Unrealised P&L (INR)', 'Quote time (UTC)', 'Quote status'],
        report.holdings.map(p => [p.symbol, p.quantity, p.invested, p.price, p.currentValue, p.pnl, p.quoteAt, p.status]), [3, 4, 5, 6], 6);
    return book.xlsx.writeBuffer();
}
module.exports = { buildPnlWorkbook };

