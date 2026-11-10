const INDEX_ALIASES = new Set(['NIFTY', 'NIFTY 50', 'SENSEX', 'BANKNIFTY', 'BANK NIFTY', 'MIDCPNIFTY', 'FINNIFTY', 'BANKEX', 'BSE-BANK.BO']);
function isMarketIndex(symbol) {
    const value = String(symbol || '').trim().toUpperCase();
    return value.startsWith('^') || INDEX_ALIASES.has(value) || INDEX_ALIASES.has(value.replace(/\.(NS|BO)$/, '')) || value === 'BSE-BANK';
}
function assertTradable(symbol) {
    if (isMarketIndex(symbol)) throw new Error('Market indices are view-only and cannot be bought or sold.');
}
module.exports = { isMarketIndex, assertTradable };
