const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const URL = 'http://127.0.0.1:8082/';
const OUT_DIR = path.join(process.cwd(), 'tmp', 'death_transition_debug');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TARGETS = [0.08, 0.28, 0.55];
const SAFE = { x: 680, y: 790 };
const HAZARD = { x: 600, y: 520 };

async function ensureBall(page) {
  for (let i = 0; i < 12; i += 1) {
    const snap = await page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
    if (snap.form === 'ball') return true;
    await page.keyboard.press('KeyE');
    await sleep(170);
  }
  return false;
}

async function waitForDeath(page, timeoutMs = 400) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const death = await page.evaluate(() => window.__THE_FORM_DEBUG__.getDeathDebugSnapshot());
    if (death.isActive) return death;
    await sleep(10);
  }
  return null;
}

async function setOverlay(page, enabled, progressOverride) {
  await page.evaluate(({ enabled, progressOverride }) => {
    window.__THE_FORM_DEBUG__.setDeathDebugOverlay(enabled, progressOverride);
  }, { enabled, progressOverride });
}

async function captureFrame(page, mode, p) {
  const overlayEnabled = mode === 'overlay';
  await setOverlay(page, overlayEnabled, null);
  await page.evaluate(({ x, y }) => window.__THE_FORM_DEBUG__.teleportPlayer(x, y), SAFE);
  await sleep(180);
  await ensureBall(page);
  await sleep(120);
  await page.evaluate(({ x, y }) => window.__THE_FORM_DEBUG__.teleportPlayer(x, y), HAZARD);

  const deathAtStart = await waitForDeath(page);
  if (deathAtStart === null) {
    return { mode, p, ok: false, error: 'death_not_started' };
  }

  await setOverlay(page, overlayEnabled, p);
  await sleep(34);
  const debugState = await page.evaluate(() => window.__THE_FORM_DEBUG__.getDeathDebugSnapshot());
  const visualState = await page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerVisualSnapshot());

  const tag = `${mode}_p${Math.round(p * 100).toString().padStart(2, '0')}`;
  const pngPath = path.join(OUT_DIR, `${tag}.png`);
  await page.screenshot({ path: pngPath, fullPage: true });

  return {
    mode,
    p,
    ok: true,
    png: `${tag}.png`,
    debugState,
    visualState
  };
}

(async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const report = {
    startedAt: new Date().toISOString(),
    targets: TARGETS,
    captures: [],
    consoleErrors: []
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') report.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => report.consoleErrors.push(String(err)));

  try {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
    await sleep(600);

    for (const p of TARGETS) {
      report.captures.push(await captureFrame(page, 'normal', p));
      await sleep(160);
      report.captures.push(await captureFrame(page, 'overlay', p));
      await sleep(200);
    }

    await setOverlay(page, false, null);
    report.finishedAt = new Date().toISOString();
  } finally {
    await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
    await browser.close();
  }
})();
