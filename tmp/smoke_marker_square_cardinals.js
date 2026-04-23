const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const OUT_DIR = path.join(process.cwd(), 'tmp', 'smoke_marker_square_cardinals');
const URL = 'http://127.0.0.1:8082/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureForm(page, target) {
  for (let i = 0; i < 12; i += 1) {
    const s = await page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
    if (s.form === target) return true;
    await page.keyboard.press('KeyE');
    await sleep(180);
  }
  return false;
}

async function shotAround(page, name) {
  const snap = await page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
  const clip = {
    x: Math.max(0, Math.floor(snap.x - 150)),
    y: Math.max(0, Math.floor(snap.y - 170)),
    width: 300,
    height: 300
  };
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), clip });
}

(async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
  await sleep(700);

  await page.evaluate(() => window.__THE_FORM_DEBUG__.teleportPlayer(680, 790));
  await sleep(220);
  await ensureForm(page, 'square');
  await sleep(260);

  await shotAround(page, '00_idle');

  const dirs = [
    { key: 'KeyD', tag: 'right' },
    { key: 'KeyA', tag: 'left' },
    { key: 'KeyW', tag: 'up' },
    { key: 'KeyS', tag: 'down' }
  ];

  for (const dir of dirs) {
    await page.keyboard.down(dir.key);
    await sleep(260);
    await shotAround(page, `10_${dir.tag}`);
    await page.keyboard.up(dir.key);
    await sleep(120);
  }

  await browser.close();
})();
