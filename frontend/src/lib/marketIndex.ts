const INDEX_ALIASES = new Set(['NIFTY', 'NIFTY 50', 'SENSEX', 'BANKNIFTY', 'BANK NIFTY', 'MIDCPNIFTY', 'FINNIFTY', 'BANKEX', 'BSE-BANK.BO']);
export function isMarketIndex(symbol: string) {
    const value = symbol.trim().toUpperCase();
    return value.startsWith('^') || INDEX_ALIASES.has(value) || INDEX_ALIASES.has(value.replace(/\.(NS|BO)$/, '')) || value === 'BSE-BANK';
}
