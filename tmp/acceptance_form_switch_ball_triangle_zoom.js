const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const OUT_DIR = path.join(process.cwd(), 'tmp', 'acceptance_form_switch_ball_triangle_zoom');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto('http://127.0.0.1:8081/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
  await sleep(400);
  await page.evaluate(() => window.__THE_FORM_DEBUG__.teleportPlayer(680, 790));
  await sleep(180);

  const snap0 = await page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
  const capture = async (name) => {
    const snap = await page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
    const clip = { x: Math.max(0, snap.x - 120), y: Math.max(0, snap.y - 140), width: 240, height: 240 };
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), clip });
    return snap;
  };

  const report = {};
  report.before = snap0;
  report.beforeCap = await capture('00_before');
  await page.keyboard.press('KeyE');

  const times = [12, 24, 36, 52, 70, 90, 110, 140];
  for (let i = 0; i < times.length; i += 1) {
    await sleep(i === 0 ? times[i] : (times[i] - times[i - 1]));
    report[`t${times[i]}`] = await capture(`${String(i + 1).padStart(2, '0')}_t${times[i]}`);
  }

  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
