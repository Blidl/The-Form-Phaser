const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const OUT_DIR = path.join(process.cwd(), 'tmp', 'smoke_square_trail_switch_flicker');
const URL = 'http://127.0.0.1:8082/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureForm(page, target) {
  for (let i = 0; i < 12; i += 1) {
    const snap = await page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
    if (snap.form === target) return true;
    await page.keyboard.press('KeyE');
    await sleep(180);
  }
  return false;
}

async function captureAroundPlayer(page, fileName) {
  const snap = await page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
  const clip = {
    x: Math.max(0, Math.floor(snap.x - 220)),
    y: Math.max(0, Math.floor(snap.y - 220)),
    width: 440,
    height: 440
  };
  await page.screenshot({ path: path.join(OUT_DIR, fileName), clip });
  return snap;
}

(async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const report = { startedAt: new Date().toISOString(), samples: [] };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
  await sleep(600);

  await page.evaluate(() => window.__THE_FORM_DEBUG__.teleportPlayer(360, 300));
  await sleep(250);
  await ensureForm(page, 'square');
  await sleep(220);

  // Build visible trail segment before switch.
  await page.keyboard.down('KeyK');
  await sleep(550);
  await page.keyboard.press('Space');
  await sleep(650);
  await page.keyboard.down('KeyD');
  await sleep(900);
  await page.keyboard.up('KeyD');
  await sleep(120);

  report.samples.push({ tag: 'before_switch', snap: await captureAroundPlayer(page, '00_before_switch.png') });

  await page.keyboard.press('KeyE'); // square -> ball
  for (let i = 1; i <= 12; i += 1) {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
    report.samples.push({
      tag: `f${String(i).padStart(2, '0')}`,
      snap: await captureAroundPlayer(page, `f${String(i).padStart(2, '0')}.png`)
    });
  }

  await sleep(220);
  report.samples.push({ tag: 'post_transition', snap: await captureAroundPlayer(page, '99_post_transition.png') });

  await page.keyboard.up('KeyK');
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

  await browser.close();
})();
