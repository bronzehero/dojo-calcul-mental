// Escribe en JSON todo lo que el Dojo puede decir en voz alta (window.__textosVeu). Lo usa veu/genera.sh.
const path = require('path');
const { chromium } = require('@playwright/test');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.route('**/*.supabase.co/**', r => r.fulfill({ status: 200, body: '[]' }));
    await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    process.stdout.write(JSON.stringify(await page.evaluate(() => window.__textosVeu()), null, 1));
    await browser.close();
})();
