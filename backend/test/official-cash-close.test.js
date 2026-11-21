const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSnapshot, quote } = require('../src/services/OfficialCashClose');
const csv = 'SYMBOL, SERIES, DATE1, PREV_CLOSE, LAST_PRICE, CLOSE_PRICE\nGOLDBEES, EQ, 20-Nov-2026, 106.30, 101.57, 102.21\nIRCTC, EQ, 20-Nov-2026, 449.90, 448.80, 448.05\nIRCTC, BE, 20-Nov-2026, 1, 2, 2';
test('official closing price takes precedence over last trade with exact session and series', () => {
    const snapshot = parseSnapshot(csv, '2026-11-20', 'official');
    assert.equal(snapshot.GOLDBEES.price, 102.21);
    assert.equal(snapshot.GOLDBEES.change, -4.09);
    assert.equal(snapshot.IRCTC.price, 448.05);
    assert.equal(snapshot.IRCTC.change, -1.85);
    assert.equal(+snapshot.IRCTC.timestamp, Date.parse('2026-11-20T10:00:00Z'));
    assert.deepEqual(parseSnapshot(csv, '2026-11-19', 'old'), {});
    assert.deepEqual(parseSnapshot('<html>unavailable</html>', '2026-11-20'), {});
});
test('BSE securities and indices never borrow an NSE cash closing price', async () => {
    assert.equal(await quote('ITC.BO', '2026-11-20'), null);
    assert.equal(await quote('^BSESN', '2026-11-20'), null);
});
