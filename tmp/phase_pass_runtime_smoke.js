const fsp = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'tmp', 'acceptance_phase_pass_runtime');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureDir(dir) { await fsp.mkdir(dir, { recursive: true }); }

async function run() {
  await ensureDir(OUT_DIR);
  const report = { startedAt: new Date().toISOString(), checks: {} };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  const getSnap = () => page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
  const tp = (x, y) => page.evaluate(({ x, y }) => window.__THE_FORM_DEBUG__.teleportPlayer(x, y), { x, y });

  const ensureForm = async (form) => {
    for (let i = 0; i < 10; i += 1) {
      const s = await getSnap();
      if (s.form === form) return true;
      await page.keyboard.press('KeyE');
      await sleep(220);
    }
    return false;
  };

  const prepFormAt = async (form, x, y, settleMs = 300) => {
    await tp(x, y);
    await sleep(settleMs);
    const ok = await ensureForm(form);
    await sleep(260);
    return ok;
  };

  const openPlayerDock = async () => {
    await page.keyboard.press('Digit9');
    await sleep(80);
    await page.keyboard.press('Digit3');
    await sleep(100);
  };

  const readPlayerDock = async () => page.locator('#test-debug-dock').innerText();

  const measureJumpAndArc = async (label) => {
    const start = await getSnap();
    await page.keyboard.down('Space');
    await sleep(28);
    await page.keyboard.up('Space');
    const t0 = Date.now();

    let firstRiseMs = null;
    let prevY = start.y;
    let minY = start.y;
    let apexDetected = false;
    let fallDetected = false;
    let landDetected = false;
    let descendingCount = 0;

    for (let i = 0; i < 170; i += 1) {
      await sleep(16);
      const cur = await getSnap();
      const dy = cur.y - prevY;

      if (firstRiseMs === null && dy < -0.2) firstRiseMs = Date.now() - t0;
      if (cur.y < minY - 0.15) minY = cur.y;
      if (!apexDetected && firstRiseMs !== null && cur.y >= minY - 0.25) apexDetected = true;
      if (apexDetected) {
        descendingCount = dy > 0.25 ? descendingCount + 1 : 0;
        if (descendingCount >= 3) fallDetected = true;
      }
      if (fallDetected && Math.abs(cur.y - start.y) <= 2.5 && Math.abs(dy) < 0.2) {
        landDetected = true;
        break;
      }

      prevY = cur.y;
    }

    report.checks[`${label}_jump_commit_delay_ms`] = firstRiseMs;
    report.checks[`${label}_jump_commit_no_delay`] = firstRiseMs !== null && firstRiseMs <= 80;
    report.checks[`${label}_apex_detected`] = apexDetected;
    report.checks[`${label}_fall_detected`] = fallDetected;
    report.checks[`${label}_land_detected`] = landDetected;
  };

  try {
    await page.goto('http://localhost:8081/', { waitUntil: 'networkidle' });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
    await sleep(700);
    await page.click('canvas');

    // Ball
    report.checks.ball_form_ready = await prepFormAt('ball', 320, 790);
    await measureJumpAndArc('ball');
    await page.screenshot({ path: path.join(OUT_DIR, 'ball_jump_apex_fall_land.png'), fullPage: true });

    // Triangle
    report.checks.triangle_form_ready = await prepFormAt('triangle', 520, 790);
    await measureJumpAndArc('triangle');

    await prepFormAt('triangle', 520, 790);
    await page.keyboard.press('Space');
    await sleep(90);
    const triBeforeFlight = await getSnap();
    await page.keyboard.down('KeyD');
    await page.keyboard.down('KeyK');
    await sleep(260);
    const triDuringFlight = await getSnap();
    await page.keyboard.up('KeyK');
    await page.keyboard.up('KeyD');
    await sleep(320);
    const triAfterFlight = await getSnap();

    report.checks.triangle_flight_start_observed = triBeforeFlight.form === 'triangle' && triDuringFlight.form === 'triangle' && triDuringFlight.y < triBeforeFlight.y - 1.0;
    report.checks.triangle_flight_end_observed = triAfterFlight.form === 'triangle' && triAfterFlight.y > triDuringFlight.y + 1.0;
    report.checks.triangle_flight_samples = { triBeforeFlight, triDuringFlight, triAfterFlight };
    await page.screenshot({ path: path.join(OUT_DIR, 'triangle_jump_flight_start_end.png'), fullPage: true });

    // Square
    report.checks.square_form_ready = await prepFormAt('square', 720, 790);
    await measureJumpAndArc('square');

    await prepFormAt('square', 1208, 240);
    await openPlayerDock();
    await page.keyboard.down('KeyK');
    await page.keyboard.down('KeyD');
    await sleep(620);
    const attachEnterText = await readPlayerDock();

    await page.keyboard.press('Space');
    await sleep(160);
    const attachJumpText = await readPlayerDock();

    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyK');
    await sleep(420);
    const attachExitText = await readPlayerDock();

    report.checks.square_attach_enter_detected = /form:\s*square/i.test(attachEnterText) && /square attached:\s*yes/i.test(attachEnterText);
    report.checks.square_attach_jump_commit_transition = /form:\s*square/i.test(attachJumpText) && /square attached:\s*no/i.test(attachJumpText);
    report.checks.square_attach_exit_detected = /form:\s*square/i.test(attachExitText) && /square attached:\s*no/i.test(attachExitText);
    report.checks.square_attach_text_enter = attachEnterText;
    report.checks.square_attach_text_jump = attachJumpText;
    report.checks.square_attach_text_exit = attachExitText;
    await page.screenshot({ path: path.join(OUT_DIR, 'square_attach_enter_exit_attach_jump.png'), fullPage: true });

    // Form switch carry-over
    await prepFormAt('ball', 520, 760);
    const preSwitch = await getSnap();
    await page.keyboard.down('Space');
    await sleep(28);
    await page.keyboard.up('Space');
    await sleep(70);
    const midAirBeforeSwitch = await getSnap();
    await page.keyboard.press('KeyE');
    await sleep(120);
    const postSwitch = await getSnap();
    await sleep(220);
    const postSwitchRecover = await getSnap();

    report.checks.form_switch_mid_air_form_changed = midAirBeforeSwitch.form !== postSwitch.form;
    report.checks.form_switch_no_position_teleport = Math.abs(postSwitch.y - midAirBeforeSwitch.y) < 28;
    report.checks.form_switch_continues_motion = Math.abs(postSwitchRecover.y - postSwitch.y) > 0.5;
    report.checks.form_switch_samples = { preSwitch, midAirBeforeSwitch, postSwitch, postSwitchRecover };
    await page.screenshot({ path: path.join(OUT_DIR, 'form_switch_midair_carryover.png'), fullPage: true });

    report.finishedAt = new Date().toISOString();
    await fsp.writeFile(path.join(OUT_DIR, 'phase_runtime_smoke_report.json'), JSON.stringify(report, null, 2), 'utf8');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
