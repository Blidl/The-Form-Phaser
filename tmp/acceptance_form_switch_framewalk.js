const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const OUT_DIR = path.join(process.cwd(), 'tmp', 'acceptance_form_switch_framewalk');
const BASE_URL = 'http://127.0.0.1:8082/';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureForm(page, target) {
  for (let i = 0; i < 14; i += 1) {
    const form = await page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot().form);
    if (form === target) {
      return true;
    }
    await page.keyboard.press('KeyE');
    await sleep(190);
  }
  return false;
}

async function capturePair(page, pairName, from, key) {
  await page.evaluate(() => window.__THE_FORM_DEBUG__.teleportPlayer(680, 790));
  await sleep(220);
  await ensureForm(page, from);
  await sleep(180);

  await page.screenshot({ path: path.join(OUT_DIR, `${pairName}_00_before.png`), fullPage: true });
  await page.keyboard.press(key);

  for (let i = 1; i <= 10; i += 1) {
    await sleep(12);
    await page.screenshot({ path: path.join(OUT_DIR, `${pairName}_${String(i).padStart(2, '0')}.png`), fullPage: true });
  }
}

(async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
  await sleep(500);

  await capturePair(page, 'triangle_to_ball', 'triangle', 'KeyQ');
  await capturePair(page, 'ball_to_square', 'ball', 'KeyQ');
  await capturePair(page, 'square_to_triangle', 'square', 'KeyQ');

  await browser.close();
})();
