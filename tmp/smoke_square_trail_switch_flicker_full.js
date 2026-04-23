const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const OUT_DIR = path.join(process.cwd(), 'tmp', 'smoke_square_trail_switch_flicker_full');
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

(async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const report = { startedAt: new Date().toISOString(), samples: [] };
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
  await sleep(700);

  await page.evaluate(() => window.__THE_FORM_DEBUG__.teleportPlayer(360, 300));
  await sleep(250);
  await ensureForm(page, 'square');
  await sleep(260);

  await page.keyboard.down('KeyK');
  await sleep(550);
  await page.keyboard.press('Space');
  await sleep(700);
  await page.keyboard.down('KeyD');
  await sleep(1400);
  await page.keyboard.up('KeyD');
  await sleep(120);

  report.samples.push({ tag: 'before_switch', snap: await page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot()) });
  await page.screenshot({ path: path.join(OUT_DIR, '00_before_switch.png'), fullPage: true });

  await page.keyboard.press('KeyE'); // square -> ball
  const marks = [8, 16, 24, 34, 48, 64, 82, 104, 128, 156];
  let prev = 0;
  for (let i = 0; i < marks.length; i += 1) {
    const mark = marks[i];
    await sleep(mark - prev);
    prev = mark;
    const tag = `t${mark}`;
    report.samples.push({ tag, snap: await page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot()) });
    await page.screenshot({ path: path.join(OUT_DIR, `${String(i + 1).padStart(2, '0')}_${tag}.png`), fullPage: true });
  }

  await sleep(220);
  report.samples.push({ tag: 'post_transition', snap: await page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot()) });
  await page.screenshot({ path: path.join(OUT_DIR, '99_post_transition.png'), fullPage: true });
  await page.keyboard.up('KeyK');

  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  await browser.close();
})();
