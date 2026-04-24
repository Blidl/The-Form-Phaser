const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8082/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function snap(page) {
  return page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
  await sleep(500);
  await page.evaluate(() => window.__THE_FORM_DEBUG__.teleportPlayer(680, 790));
  await sleep(200);
  for (const key of ['KeyA','KeyD','KeyW','KeyS','ArrowLeft']) {
    const before = await snap(page);
    await page.keyboard.down(key);
    await sleep(350);
    await page.keyboard.up(key);
    await sleep(80);
    const after = await snap(page);
    console.log(JSON.stringify({ key, before, after }));
  }
  await browser.close();
})();
