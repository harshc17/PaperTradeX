// Quote lookup aliases only. Historical positions and transactions are not
// rewritten: corporate-action quantities and cost bases require a separate
// reconciliation. Catalogue entries use the current ticker directly.
const aliases = Object.freeze({
    ZOMATO: 'ETERNAL', LTIM: 'LTM', TATAMOTORS: 'TMPV',
    SETFNIF50: 'SBINIFTY50', SETFNN50: 'SBINEXT50', SETFGOLD: 'SBIGOLD',
    SETFNIFBK: 'SBIBANKNIF', SETFBANK: 'SBIBANKNIF',
    ICICINIFTY: 'NIFTYIETF', ICICIBANKP: 'PVTBANIETF', ICICITECH: 'ITIETF',
    HDFCNIFETF: 'HDFCNIFTY', HDFCMFGETF: 'HDFCGOLD', HBANKETF: 'HDFCNIFBAN', HDFCBANKET: 'HDFCNIFBAN',
    KOTAKNIFTY: 'NIFTY1', KOTAKBKETF: 'BANKNIFTY1', BHARAT22: 'ICICIB22',
});
function providerSymbol(symbol) {
    const upper = String(symbol).trim().toUpperCase();
    if (upper.endsWith('.BO') || upper.startsWith('^')) return upper;
    const bare = upper.replace(/\.NS$/, '');
    return (aliases[bare] || bare) + (upper.endsWith('.NS') ? '.NS' : '');
}
module.exports = { aliases, providerSymbol };
