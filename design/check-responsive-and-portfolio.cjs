const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.PTX_RESPONSIVE_TEST_URL || 'http://localhost:3014';
(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    try {
        const context = await browser.newContext();
        let mode = 'ready', releaseHoldings;
        const gate = new Promise(resolve => { releaseHoldings = resolve; });
        await context.route('**/socket.io/**', r => r.abort());
        await context.route('**/api/**', async route => {
            const path = new URL(route.request().url()).pathname;
            let data = {};
            if (path === '/api/portfolio') {
                if (mode === 'delayed') await gate;
                if (mode === 'failure') return route.fulfill({ status: 503, json: { error: 'unavailable' } });
                data = { balance: 720, holdings: [{ symbol: 'GOLDBEES', quantity: 850, averagePrice: 116.8 }] };
            } else if (path === '/api/orders') data = { orders: [] };
            else if (path === '/api/transactions') data = { transactions: [] };
            else if (path === '/api/market-status') data = { isOpen: true, session: 'REGULAR', returnSessionDate: '2026-11-13' };
            else if (path.endsWith('/realtime')) data = { price: path.includes('GOLDBEES') ? 112 : 127990, change: 100, timestamp: new Date().toISOString() };
            else if (path.endsWith('/history')) data = { data: Array.from({ length: 25 }, (_, i) => ({ date: new Date(Date.UTC(2026, 10, i + 1)).toISOString(), close: 127000 + i, volume: 10 })) };
            else if (/\/api\/stock\/[^/]+$/.test(path)) data = { symbol: 'MRF.NS', shortName: 'MRF Limited — Long company name layout check', exchange: 'NSE' };
            return route.fulfill({ json: data });
        });
        await context.addInitScript(() => {
            localStorage.setItem('ptx_token', 'isolated-fixture');
            localStorage.setItem('ptx_user', JSON.stringify({ id: 0, name: 'Responsive Check', balance: 720 }));
        });
        const page = await context.newPage();
        await page.goto(`${base}/stock/MRF.NS`);
        await page.getByRole('heading', { name: 'MRF Limited — Long company name layout check' }).waitFor();
        await page.locator('canvas').first().waitFor();
        for (const theme of ['light', 'dark']) {
            for (const width of [320, 390, 768, 1024, 1440, 1920]) {
                await page.setViewportSize({ width, height: 900 });
                await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
                const sizes = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth,
                    canvas: document.querySelector('canvas').getBoundingClientRect().width,
                    main: document.querySelector('main').getBoundingClientRect().width }));
                assert(sizes.page <= sizes.viewport, JSON.stringify({ width, theme, sizes }));
                assert(sizes.canvas > 0 && sizes.canvas <= sizes.main);
                assert(await page.locator('#place-order-btn').isVisible());
                if (['390', '768', '1440'].includes(String(width))) await page.screenshot({ path: `design/stock-responsive-${theme}-${width}.png`, fullPage: true });
            }
        }
        console.log('PASS: stock page at six mobile/tablet/desktop widths in both themes; no document overflow, chart fits, trading controls visible');
        mode = 'delayed';
        const dashboard = await context.newPage(); await dashboard.setViewportSize({ width: 390, height: 900 });
        await dashboard.goto(`${base}/dashboard`, { waitUntil: 'domcontentloaded' });
        await dashboard.getByText('Loading holdings…', { exact: true }).filter({ visible: true }).first().waitFor();
        assert.equal(await dashboard.getByText('No holdings yet', { exact: true }).filter({ visible: true }).count(), 0);
        assert.equal(await dashboard.getByRole('heading', { name: '₹0.00', exact: true }).count(), 0);
        releaseHoldings(); mode = 'ready';
        await dashboard.getByRole('heading', { name: '₹95,200.00', exact: true }).filter({ visible: true }).first().waitFor();
        mode = 'failure';
        const retry = await context.newPage(); await retry.setViewportSize({ width: 390, height: 900 });
        await retry.goto(`${base}/dashboard`);
        await retry.getByRole('button', { name: 'Retry holdings', exact: true }).filter({ visible: true }).first().waitFor();
        assert.equal(await retry.getByRole('heading', { name: '₹0.00', exact: true }).count(), 0);
        mode = 'ready'; await retry.getByRole('button', { name: 'Retry holdings', exact: true }).filter({ visible: true }).first().click();
        await retry.getByRole('heading', { name: '₹95,200.00', exact: true }).filter({ visible: true }).first().waitFor();
        console.log('PASS: delayed or failed holdings never show a false zero/empty portfolio; retry restores 850 × ₹112 = ₹95,200');
        await context.close();
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
