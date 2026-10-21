// Lance tests/index.html dans un vrai Chromium (utilisé par GitHub Actions) : node tests/run-browser.mjs
// Prérequis : npm i playwright && npx playwright install --with-deps chromium ; un serveur statique sur le port 8765.
import { chromium } from 'playwright';
const url = process.env.TEST_URL || 'http://localhost:8765/tests/index.html';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto(url);
await page.waitForFunction(() => window.__result, null, { timeout: 240000 });
const r = await page.evaluate(() => window.__result);
await browser.close();
for (const t of r.results) console.log(`${t.ok ? '✓' : '✗'} ${t.name}${t.ok ? '' : '\n    ' + t.err}`);
console.log(`\n${r.passed} réussis, ${r.failed} en échec`);
process.exit(r.failed || !r.results.length ? 1 : 0);
