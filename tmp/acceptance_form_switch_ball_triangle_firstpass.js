const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'tmp', 'acceptance_form_switch_ball_triangle_firstpass');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
}

async function waitForDebugBridge(page) {
  await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
}

async function getSnapshot(page) {
  return page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
}

async function teleport(page, x, y) {
  await page.evaluate(({ x, y }) => window.__THE_FORM_DEBUG__.teleportPlayer(x, y), { x, y });
  await sleep(160);
}

async function ensureForm(page, form) {
  for (let i = 0; i < 8; i += 1) {
    const snap = await getSnapshot(page);
    if (snap.form === form) {
      return true;
    }
    await page.keyboard.press('KeyQ');
    await sleep(120);
  }
  return false;
}

async function captureSwitchBurst(page, prefix, key = 'KeyE') {
  const report = {};
  report.before = await getSnapshot(page);
  await shot(page, `${prefix}_00_before`);

  await page.keyboard.press(key);
  await sleep(18);
  report.t18 = await getSnapshot(page);
  await shot(page, `${prefix}_01_t18`);

  await sleep(24);
  report.t42 = await getSnapshot(page);
  await shot(page, `${prefix}_02_t42`);

  await sleep(28);
  report.t70 = await getSnapshot(page);
  await shot(page, `${prefix}_03_t70`);

  await sleep(35);
  report.t105 = await getSnapshot(page);
  await shot(page, `${prefix}_04_t105`);

  await sleep(45);
  report.t150 = await getSnapshot(page);
  await shot(page, `${prefix}_05_t150`);

  return report;
}

async function run() {
  await ensureDir(OUT_DIR);
  const report = {
    startedAt: new Date().toISOString(),
    consoleErrors: [],
    scenarios: {}
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      report.consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    report.consoleErrors.push(String(err));
  });

  try {
    await page.goto('http://127.0.0.1:8081/', { waitUntil: 'networkidle' });
    await page.keyboard.press('Enter');
    await waitForDebugBridge(page);
    await sleep(500);

    await ensureForm(page, 'ball');
    await teleport(page, 680, 790);
    report.scenarios.groundBallToTriangle = await captureSwitchBurst(page, 'ground_ball_to_triangle', 'KeyE');

    await ensureForm(page, 'ball');
    await teleport(page, 820, 280);
    await sleep(80);
    report.scenarios.airBallToTriangle = await captureSwitchBurst(page, 'air_ball_to_triangle', 'KeyE');

    await sleep(120);
    report.finalSnapshot = await getSnapshot(page);
    report.finishedAt = new Date().toISOString();
  } finally {
    await context.close();
    await browser.close();
    await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
