const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 900 }, hasTouch: true });
        let mode = 'ready';
        await page.route('**/socket.io/**', r => r.abort());
        await page.route('**/api/**', async route => {
            const url = new URL(route.request().url()), path = url.pathname;
            let data = {};
            if (path.endsWith('/history')) {
                if (mode === 'failure') return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
                const count = mode === 'empty' ? 0 : url.searchParams.get('period') === '1w' ? 7 : 25;
                data = { data: Array.from({ length: count }, (_, i) => ({ date: new Date(Date.UTC(2026, 10, i + 1)).toISOString(), close: 100 + i })), source: 'test candles', resolution: 'daily' };
            } else if (path === '/api/portfolio') data = { balance: 100000, holdings: [] };
            else if (path === '/api/orders') data = { orders: [] };
            else if (path === '/api/transactions') data = { transactions: [] };
            else if (path.endsWith('/realtime')) data = { price: 124, timestamp: new Date().toISOString() };
            else if (/\/api\/stock\/[^/]+$/.test(path)) data = { shortName: 'Chart Check', exchange: 'NSE' };
            return route.fulfill({ json: data });
        });
        await page.addInitScript(() => {
            localStorage.setItem('ptx_token', 'isolated-loading-check');
            localStorage.setItem('ptx_user', JSON.stringify({ id: 0, name: 'Chart Check', balance: 100000 }));
        });
        await page.goto('http://localhost:3014/stock/RELIANCE.NS');
        await page.getByText(/25 points/).waitFor();
        mode = 'empty'; await page.getByRole('button', { name: 'Refresh chart', exact: true }).click();
        await page.getByText('Chart refresh unavailable. Showing saved candles.').waitFor();
        assert(await page.locator('canvas').first().isVisible());
        assert(await page.getByText(/25 points/).isVisible());
        mode = 'failure'; await page.getByRole('button', { name: '1W', exact: true }).click();
        await page.getByText('Failed to load chart data').waitFor();
        mode = 'ready'; await page.getByRole('button', { name: 'Retry', exact: true }).first().click();
        await page.getByText(/7 points/).waitFor();
        const canvas = page.locator('canvas').first(), box = await canvas.boundingBox();
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * .5, y: box.y + box.height * .4 }] });
        await page.getByTestId('chart-cursor-label').waitFor();
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.getByTestId('chart-cursor-label').waitFor({ state: 'hidden' });
        console.log('PASS: empty refresh retains candles; failed uncached period retries; touch hold shows cursor and release clears it');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
