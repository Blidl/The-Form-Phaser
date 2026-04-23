const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'tmp', 'acceptance_form_switch_all_pairs');
const BASE_URL = 'http://127.0.0.1:8082/';

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
}

async function ensureForm(page, form) {
  for (let i = 0; i < 14; i += 1) {
    const snap = await getSnapshot(page);
    if (snap.form === form) {
      return true;
    }
    await page.keyboard.press('KeyE');
    await sleep(190);
  }
  return false;
}

async function captureSwitchBurst(page, prefix, key) {
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

  await sleep(30);
  report.t72 = await getSnapshot(page);
  await shot(page, `${prefix}_03_t72`);

  await sleep(34);
  report.t106 = await getSnapshot(page);
  await shot(page, `${prefix}_04_t106`);

  await sleep(40);
  report.t146 = await getSnapshot(page);
  await shot(page, `${prefix}_05_t146`);

  await sleep(40);
  report.t186 = await getSnapshot(page);
  await shot(page, `${prefix}_06_t186`);

  return report;
}

async function runScenario(page, report, cfg) {
  const { name, from, to, key, x, y, afterTeleportMs } = cfg;
  await teleport(page, x, y);
  await sleep(afterTeleportMs);
  if (!(await ensureForm(page, from))) {
    report.failures.push(`failed_to_set_form:${name}:${from}`);
    return;
  }
  await sleep(180);
  report.scenarios[name] = await captureSwitchBurst(page, name, key);
  const after = await getSnapshot(page);
  report.scenarios[name].after = after;
  if (after.form !== to) {
    report.failures.push(`unexpected_after_form:${name}:expected_${to}:got_${after.form}`);
  }
}

async function run() {
  await ensureDir(OUT_DIR);
  const report = {
    startedAt: new Date().toISOString(),
    consoleErrors: [],
    failures: [],
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
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.keyboard.press('Enter');
    await waitForDebugBridge(page);
    await sleep(500);

    const scenarios = [
      { name: 'ground_triangle_to_ball', from: 'triangle', to: 'ball', key: 'KeyQ', x: 680, y: 790, afterTeleportMs: 220 },
      { name: 'ground_ball_to_triangle', from: 'ball', to: 'triangle', key: 'KeyE', x: 680, y: 790, afterTeleportMs: 220 },
      { name: 'ground_ball_to_square', from: 'ball', to: 'square', key: 'KeyQ', x: 680, y: 790, afterTeleportMs: 220 },
      { name: 'ground_square_to_ball', from: 'square', to: 'ball', key: 'KeyE', x: 680, y: 790, afterTeleportMs: 220 },
      { name: 'ground_triangle_to_square', from: 'triangle', to: 'square', key: 'KeyE', x: 680, y: 790, afterTeleportMs: 220 },
      { name: 'ground_square_to_triangle', from: 'square', to: 'triangle', key: 'KeyQ', x: 680, y: 790, afterTeleportMs: 220 },
      { name: 'air_triangle_to_ball', from: 'triangle', to: 'ball', key: 'KeyQ', x: 820, y: 160, afterTeleportMs: 20 },
      { name: 'air_ball_to_square', from: 'ball', to: 'square', key: 'KeyQ', x: 820, y: 160, afterTeleportMs: 20 },
      { name: 'air_square_to_triangle', from: 'square', to: 'triangle', key: 'KeyQ', x: 820, y: 160, afterTeleportMs: 20 }
    ];

    for (const scenario of scenarios) {
      await runScenario(page, report, scenario);
      await sleep(220);
    }

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
