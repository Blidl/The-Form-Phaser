const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const OUT_DIR = path.join(process.cwd(), 'tmp', 'smoke_marker_switch_direction');
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

async function shotAround(page, name) {
  const snap = await page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
  const clip = {
    x: Math.max(0, Math.floor(snap.x - 140)),
    y: Math.max(0, Math.floor(snap.y - 170)),
    width: 280,
    height: 280
  };
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), clip });
  return snap;
}

async function captureTransitionWindow(page, prefix, switchKey) {
  await page.keyboard.press(switchKey);
  const marks = [12, 24, 40, 60, 90, 120, 170, 220];
  let prev = 0;
  const samples = [];
  for (const mark of marks) {
    await sleep(mark - prev);
    prev = mark;
    const snap = await shotAround(page, `${prefix}_t${mark}`);
    samples.push({ tag: `t${mark}`, snap });
  }
  return samples;
}

(async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const report = { startedAt: new Date().toISOString(), scenarios: {} };
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
  await sleep(700);

  // Scenario A: hold input direction during switch.
  await page.evaluate(() => window.__THE_FORM_DEBUG__.teleportPlayer(680, 790));
  await sleep(220);
  await ensureForm(page, 'ball');
  await sleep(220);
  await page.keyboard.down('KeyW');
  await sleep(260);
  report.scenarios.hold_input = { before: await shotAround(page, 'hold_before') };
  report.scenarios.hold_input.samples = await captureTransitionWindow(page, 'hold', 'KeyE');
  await page.keyboard.up('KeyW');

  // Scenario B: input drops to zero briefly before switch; direction should persist.
  await page.evaluate(() => window.__THE_FORM_DEBUG__.teleportPlayer(680, 790));
  await sleep(220);
  await ensureForm(page, 'ball');
  await sleep(220);
  await page.keyboard.down('KeyW');
  await sleep(220);
  await page.keyboard.up('KeyW');
  await sleep(40);
  report.scenarios.zero_frame = { before: await shotAround(page, 'zero_before') };
  report.scenarios.zero_frame.samples = await captureTransitionWindow(page, 'zero', 'KeyE');

  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  await browser.close();
})();
