const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'tmp', 'acceptance_player_forms');
const TUNING_FILE = path.join(ROOT, 'src', 'game', 'player', 'tuning', 'player_tuning_persisted.generated.ts');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function waitForDebugBridge(page) {
  await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
}

async function getSnapshot(page) {
  return page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
}

async function teleport(page, x, y) {
  await page.evaluate(({x, y}) => window.__THE_FORM_DEBUG__.teleportPlayer(x, y), { x, y });
  await sleep(180);
}

async function ensureForm(page, form) {
  for (let i = 0; i < 6; i += 1) {
    const snap = await getSnapshot(page);
    if (snap.form === form) return true;
    await page.keyboard.press('KeyE');
    await sleep(120);
  }
  return false;
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
}

async function waitForLandingByY(page, timeoutMs = 2600) {
  const start = Date.now();
  let prev = (await getSnapshot(page)).y;
  let sawDescending = false;
  let stableCount = 0;
  while (Date.now() - start < timeoutMs) {
    await sleep(50);
    const cur = (await getSnapshot(page)).y;
    const dy = cur - prev;
    if (dy > 1) {
      sawDescending = true;
      stableCount = 0;
    } else if (sawDescending && Math.abs(dy) < 0.6) {
      stableCount += 1;
      if (stableCount >= 4) return true;
    } else {
      stableCount = 0;
    }
    prev = cur;
  }
  return false;
}

async function openPlayerDebugDock(page) {
  await page.keyboard.press('Digit9');
  await sleep(120);
  await page.keyboard.press('Digit3');
  await sleep(120);
}

async function readDebugDockPlayerText(page) {
  return page.locator('#test-debug-dock').innerText();
}

async function run() {
  await ensureDir(OUT_DIR);
  const originalTuningSource = await fsp.readFile(TUNING_FILE, 'utf8');

  const report = {
    timestamps: { startedAt: new Date().toISOString() },
    scenarios: {},
    tuning: {},
    artifactsDir: OUT_DIR
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:8081/', { waitUntil: 'networkidle' });
    await page.keyboard.press('Enter');
    await waitForDebugBridge(page);
    await sleep(800);
    await screenshot(page, '00_scene_booted');

    // Ball
    report.scenarios.ball = {};
    report.scenarios.ball.formReady = await ensureForm(page, 'ball');
    await teleport(page, 320, 790);
    await screenshot(page, '10_ball_idle_ground');

    await page.keyboard.press('Space');
    await sleep(40);
    await screenshot(page, '11_ball_jump_start');
    await sleep(180);
    await screenshot(page, '12_ball_airborne_follow_a');
    await sleep(180);
    await screenshot(page, '13_ball_airborne_follow_b');

    await teleport(page, 420, 780);
    await sleep(100);
    await screenshot(page, '14_ball_pre_weak_fall');
    await teleport(page, 420, 730);
    const weakLanded = await waitForLandingByY(page);
    await screenshot(page, '15_ball_weak_land_impact');

    await teleport(page, 520, 120);
    await screenshot(page, '16_ball_pre_strong_fall');
    const strongLanded = await waitForLandingByY(page, 4200);
    await screenshot(page, '17_ball_strong_land_impact');

    report.scenarios.ball.weakLanded = weakLanded;
    report.scenarios.ball.strongLanded = strongLanded;

    // Triangle
    report.scenarios.triangle = {};
    await teleport(page, 680, 790);
    await screenshot(page, '20_pre_triangle_switch_ball_idle');
    await page.keyboard.press('KeyE');
    await sleep(70);
    await screenshot(page, '21_triangle_switch_in');
    await sleep(260);
    await screenshot(page, '22_triangle_idle_after_switch');
    report.scenarios.triangle.formReady = (await getSnapshot(page)).form === 'triangle';

    await page.keyboard.press('Space');
    await sleep(40);
    await screenshot(page, '23_triangle_jump_start');
    await sleep(180);
    await screenshot(page, '24_triangle_airborne_a');
    await sleep(180);
    await screenshot(page, '25_triangle_airborne_b');

    await sleep(400);
    await screenshot(page, '26_triangle_idle_baseline');
    await page.keyboard.press('KeyE'); // triangle -> square
    await sleep(140);
    await page.keyboard.press('KeyQ'); // square -> triangle
    await sleep(260);
    await screenshot(page, '27_triangle_after_switch_out_in');

    // Square
    report.scenarios.square = {};
    await ensureForm(page, 'square');
    await teleport(page, 930, 790);
    await screenshot(page, '30_square_idle');

    await page.keyboard.press('Space');
    await sleep(40);
    await screenshot(page, '31_square_jump_start');

    await openPlayerDebugDock(page);
    await screenshot(page, '32_debug_dock_player_tab');

    // attach on vertical wall near rollover_wall
    await teleport(page, 1208, 240);
    await page.keyboard.down('KeyK');
    await sleep(420);
    const attachText = await readDebugDockPlayerText(page);
    await screenshot(page, '33_square_attach_hold');

    await page.keyboard.press('Space');
    await sleep(150);
    const attachJumpTextA = await readDebugDockPlayerText(page);
    await screenshot(page, '34_square_attach_jump_start');
    await sleep(500);
    const attachJumpTextB = await readDebugDockPlayerText(page);
    await screenshot(page, '35_square_attach_jump_follow');
    await page.keyboard.up('KeyK');

    await teleport(page, 1180, 240);
    await page.keyboard.down('KeyK');
    await page.keyboard.down('KeyD');
    await sleep(900);
    await page.keyboard.up('KeyD');
    await screenshot(page, '36_square_trail_spend_phase');
    await page.keyboard.press('KeyO');
    await sleep(450);
    await screenshot(page, '37_square_trail_regen_phase');
    await page.keyboard.up('KeyK');

    report.scenarios.square.attachDetected = /square attached:\s*yes/i.test(attachText);
    report.scenarios.square.attachJumpTransitionObserved = /square attached:\s*no/i.test(attachJumpTextA + '\n' + attachJumpTextB);
    report.scenarios.square.attachText = attachText;
    report.scenarios.square.attachJumpTextA = attachJumpTextA;
    report.scenarios.square.attachJumpTextB = attachJumpTextB;

    // Player tuning: live apply + save + reload persistence
    report.tuning = {};
    await page.keyboard.press('Digit0');
    await page.waitForSelector('#player-tuning-sidebar:not(.player-tuning--hidden)', { timeout: 5000 });
    await page.click('[data-tuning-tab-id="ball"]');

    const tuningField = page.locator('input[data-tuning-field-id="ball-anim-jump-squash-scale-x"]');
    const valueBeforeStr = await tuningField.inputValue();
    const valueBefore = Number(valueBeforeStr);
    const valueAfter = Number.isFinite(valueBefore) ? Number((valueBefore + 0.17).toFixed(2)) : 0.92;

    await tuningField.fill(String(valueAfter));
    await tuningField.dispatchEvent('change');
    await sleep(150);

    const sidebarTextAfterLiveApply = await page.locator('#player-tuning-sidebar').innerText();
    const liveApplyOk = /live draft applied/i.test(sidebarTextAfterLiveApply);
    await screenshot(page, '40_tuning_live_apply');

    await page.click('button[data-tuning-action="save"]');
    await page.waitForFunction(() => {
      const root = document.querySelector('#player-tuning-sidebar');
      return !!root && /saved player tuning to project/i.test(root.textContent || '');
    }, null, { timeout: 8000 });
    await screenshot(page, '41_tuning_saved_to_project');

    const savedSource = await fsp.readFile(TUNING_FILE, 'utf8');
    const savedContainsNewValue = savedSource.includes(`"jumpSquashScaleX": ${valueAfter}`);

    await page.reload({ waitUntil: 'networkidle' });
    await page.keyboard.press('Enter');
    await waitForDebugBridge(page);
    await sleep(600);
    await page.keyboard.press('Digit0');
    await page.waitForSelector('#player-tuning-sidebar:not(.player-tuning--hidden)', { timeout: 5000 });
    await page.click('[data-tuning-tab-id="ball"]');
    const valueAfterReload = Number(await page.locator('input[data-tuning-field-id="ball-anim-jump-squash-scale-x"]').inputValue());
    const reloadPersistenceOk = Math.abs(valueAfterReload - valueAfter) < 0.001;
    await screenshot(page, '42_tuning_reload_persistence');

    report.tuning.valueBefore = valueBefore;
    report.tuning.valueAfter = valueAfter;
    report.tuning.valueAfterReload = valueAfterReload;
    report.tuning.liveApplyStatusSeen = liveApplyOk;
    report.tuning.saveFileContainsValue = savedContainsNewValue;
    report.tuning.reloadPersistenceOk = reloadPersistenceOk;

    // Restore persisted file to avoid leaving acceptance-side edits in workspace.
    await fsp.writeFile(TUNING_FILE, originalTuningSource, 'utf8');
    report.tuning.restoredOriginalPersistedFile = true;

    report.timestamps.finishedAt = new Date().toISOString();
  } catch (error) {
    report.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
    await fsp.writeFile(path.join(OUT_DIR, 'acceptance_report.json'), JSON.stringify(report, null, 2), 'utf8');
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
