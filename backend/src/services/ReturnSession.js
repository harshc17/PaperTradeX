// Return the latest regular trading session that has started, in IST.
module.exports = function returnSessionDate(now = new Date(), holidays = {}) {
    const ist = new Date(+now + 330 * 60000);
    const minute = ist.getUTCHours() * 60 + ist.getUTCMinutes();
    ist.setUTCHours(0, 0, 0, 0);
    if (minute < 555) ist.setUTCDate(ist.getUTCDate() - 1);
    while ([0, 6].includes(ist.getUTCDay()) || holidays[ist.toISOString().slice(0, 10)]) {
        ist.setUTCDate(ist.getUTCDate() - 1);
    }
    return ist.toISOString().slice(0, 10);
};
