const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const OUT_DIR = path.join(process.cwd(), 'tmp', 'acceptance_form_switch_square_ball_narrow_fix');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureForm(page, form) {
  for (let i = 0; i < 12; i += 1) {
    const snap = await page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
    if (snap.form === form) return true;
    await page.keyboard.press('KeyE');
    await sleep(220);
  }
  return false;
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const report = { startedAt: new Date().toISOString(), samples: [] };

  await page.goto('http://127.0.0.1:8081/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
  await page.evaluate(() => window.__THE_FORM_DEBUG__.teleportPlayer(700, 790));
  await sleep(220);
  await ensureForm(page, 'square');
  await sleep(300);

  async function capture(tag) {
    const payload = await page.evaluate(() => ({
      runtime: window.__THE_FORM_DEBUG__.getPlayerSnapshot(),
      visual: window.__THE_FORM_DEBUG__.getPlayerVisualSnapshot()
    }));
    const x = payload.runtime.x;
    const y = payload.runtime.y;
    const clip = {
      x: Math.max(0, x - 140),
      y: Math.max(0, y - 160),
      width: 280,
      height: 280
    };
    await page.screenshot({ path: path.join(OUT_DIR, `${tag}.png`), clip });
    report.samples.push({ tag, ...payload });
  }

  await capture('00_before');
  await page.keyboard.press('KeyE');

  const marks = [16, 34, 54, 76, 96, 118, 136, 154, 176];
  let previous = 0;
  for (const mark of marks) {
    await sleep(mark - previous);
    previous = mark;
    await capture(`t${mark}`);
  }

  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
