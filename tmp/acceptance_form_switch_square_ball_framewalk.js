const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const OUT_DIR = path.join(process.cwd(), 'tmp', 'acceptance_form_switch_square_ball_framewalk');

async function ensureForm(page, form) {
  for (let i = 0; i < 12; i += 1) {
    const snap = await page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
    if (snap.form === form) return true;
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(220);
  }
  return false;
}

(async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto('http://127.0.0.1:8081/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
  await page.evaluate(() => window.__THE_FORM_DEBUG__.teleportPlayer(700, 790));
  await page.waitForTimeout(300);
  await ensureForm(page, 'square');
  await page.waitForTimeout(280);

  const report = [];
  const capture = async (name) => {
    const payload = await page.evaluate(() => ({ r: window.__THE_FORM_DEBUG__.getPlayerSnapshot(), v: window.__THE_FORM_DEBUG__.getPlayerVisualSnapshot() }));
    const x = payload.r.x;
    const y = payload.r.y;
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), clip: { x: Math.max(0, x - 140), y: Math.max(0, y - 160), width: 280, height: 280 } });
    report.push({ name, ...payload });
  };

  await capture('00_before');
  await page.keyboard.press('KeyE');
  for (let i = 1; i <= 12; i += 1) {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
    await capture(`f${String(i).padStart(2, '0')}`);
  }

  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  await browser.close();
})();
