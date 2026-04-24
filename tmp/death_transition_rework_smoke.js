const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const OUT_DIR = path.join(process.cwd(), 'tmp', 'death_transition_rework_smoke');
const URL = 'http://127.0.0.1:8082/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SAFE_POINT = { x: 680, y: 790 };
const HAZARD_POINT = { x: 600, y: 520 };

async function ensureForm(page, target) {
  for (let i = 0; i < 14; i += 1) {
    const snap = await page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
    if (snap.form === target) return true;
    await page.keyboard.press('KeyE');
    await sleep(190);
  }
  return false;
}

function baseHidden(vis) {
  return !vis.ball.visible && !vis.triangle.visible && !vis.square.visible;
}

function baseVisibleMap(vis) {
  return {
    ball: !!vis.ball.visible,
    triangle: !!vis.triangle.visible,
    square: !!vis.square.visible
  };
}

async function getDebug(page) {
  return page.evaluate(() => ({
    snap: window.__THE_FORM_DEBUG__.getPlayerSnapshot(),
    vis: window.__THE_FORM_DEBUG__.getPlayerVisualSnapshot()
  }));
}

async function shotAroundPlayer(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
}

async function waitForDeathStart(page, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const { vis } = await getDebug(page);
    if (baseHidden(vis)) {
      return true;
    }
    await sleep(16);
  }
  return false;
}

async function captureDeathScenario(page, form) {
  const scenario = { form, success: false, samples: [], postRespawn: null, trigger: null };

  await page.evaluate(({ x, y }) => window.__THE_FORM_DEBUG__.teleportPlayer(x, y), SAFE_POINT);
  await sleep(180);
  if (!(await ensureForm(page, form))) {
    scenario.error = `failed_to_set_form:${form}`;
    return scenario;
  }
  await sleep(180);
  await shotAroundPlayer(page, `${form}_pre`);

  await page.evaluate(({ x, y }) => window.__THE_FORM_DEBUG__.teleportPlayer(x, y), HAZARD_POINT);
  const started = await waitForDeathStart(page, 350);
  scenario.trigger = { started };
  if (!started) {
    scenario.error = `failed_to_trigger_death:${form}`;
    return scenario;
  }

  const marks = [12, 25, 45, 60, 95, 140, 190, 245];
  let prev = 0;
  for (const mark of marks) {
    await sleep(mark - prev);
    prev = mark;
    const debug = await getDebug(page);
    await shotAroundPlayer(page, `${form}_t${mark}`);
    scenario.samples.push({
      tMs: mark,
      form: debug.snap.form,
      x: debug.snap.x,
      y: debug.snap.y,
      baseVisible: baseVisibleMap(debug.vis)
    });
  }

  await sleep(70);
  await page.evaluate(({ x, y }) => window.__THE_FORM_DEBUG__.teleportPlayer(x, y), SAFE_POINT);
  await sleep(60);
  await shotAroundPlayer(page, `${form}_post_respawn`);
  const post = await getDebug(page);
  scenario.postRespawn = {
    form: post.snap.form,
    baseVisible: baseVisibleMap(post.vis),
    hidden: baseHidden(post.vis)
  };
  scenario.success = true;
  return scenario;
}

async function captureSwitchRegression(page) {
  const marks = [0, 16, 32, 48, 72, 96, 128, 156, 186];
  const result = { samples: [] };

  await page.evaluate(() => window.__THE_FORM_DEBUG__.teleportPlayer(679, 812));
  await sleep(200);
  await ensureForm(page, 'ball');
  await sleep(180);

  await page.keyboard.press('KeyE');
  let prev = 0;
  for (const mark of marks) {
    await sleep(Math.max(0, mark - prev));
    prev = mark;
    const debug = await getDebug(page);
    await shotAroundPlayer(page, `switch_t${mark}`);
    result.samples.push({
      tMs: mark,
      form: debug.snap.form,
      baseVisible: baseVisibleMap(debug.vis)
    });
  }

  return result;
}

(async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const report = {
    startedAt: new Date().toISOString(),
    consoleErrors: [],
    deathScenarios: [],
    switchRegression: null
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      report.consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => report.consoleErrors.push(String(err)));

  try {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
    await sleep(650);

    for (const form of ['ball', 'triangle', 'square']) {
      const scenario = await captureDeathScenario(page, form);
      report.deathScenarios.push(scenario);
      await sleep(260);
    }

    report.switchRegression = await captureSwitchRegression(page);
    report.finishedAt = new Date().toISOString();
  } finally {
    await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
    await browser.close();
  }
})();
