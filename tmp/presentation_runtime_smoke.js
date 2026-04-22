const fsp = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'tmp', 'presentation_runtime_smoke');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureDir(dir) { await fsp.mkdir(dir, { recursive: true }); }

function axisFromRotation(rotationRad) {
  const a = rotationRad + (Math.PI * 0.5);
  return { x: Math.cos(a), y: Math.sin(a) };
}

function norm(x, y) {
  const m = Math.hypot(x, y);
  if (m <= 1e-5) return null;
  return { x: x / m, y: y / m };
}

async function run() {
  await ensureDir(OUT_DIR);
  const report = { startedAt: new Date().toISOString(), checks: {}, samples: {} };
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  const getSnap = () => page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
  const getVis = () => page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerVisualSnapshot());
  const tp = (x, y) => page.evaluate(({ x, y }) => window.__THE_FORM_DEBUG__.teleportPlayer(x, y), { x, y });

  const ensureForm = async (form) => {
    for (let i = 0; i < 12; i += 1) {
      const s = await getSnap();
      if (s.form === form) return true;
      await page.keyboard.press('KeyE');
      await sleep(180);
    }
    return false;
  };

  const waitGrounded = async (timeoutMs = 2000) => {
    const t0 = Date.now();
    let prev = await getSnap();
    while (Date.now() - t0 < timeoutMs) {
      await sleep(20);
      const cur = await getSnap();
      const dy = Math.abs(cur.y - prev.y);
      if (dy < 0.15) {
        await sleep(60);
        const c2 = await getSnap();
        if (Math.abs(c2.y - cur.y) < 0.2) return true;
      }
      prev = cur;
    }
    return false;
  };

  const measureJumpDelay = async (label) => {
    const start = await getSnap();
    const t0 = Date.now();
    await page.keyboard.down('Space');
    await sleep(24);
    await page.keyboard.up('Space');
    let firstRiseMs = null;
    let prev = start;
    for (let i = 0; i < 120; i += 1) {
      await sleep(16);
      const cur = await getSnap();
      if (firstRiseMs === null && cur.y < prev.y - 0.2) {
        firstRiseMs = Date.now() - t0;
        break;
      }
      prev = cur;
    }
    report.checks[`${label}_jump_delay_ms`] = firstRiseMs;
    report.checks[`${label}_jump_no_delay`] = firstRiseMs !== null && firstRiseMs <= 80;
  };

  try {
    await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
    await sleep(700);
    await page.click('canvas');

    // Ball baseline + delay
    report.checks.ball_form_ready = await ensureForm('ball');
    await tp(320, 790);
    await sleep(250);
    await measureJumpDelay('ball');

    // Ball rebound-type jump stretch visible (buffer jump on landing after fall)
    await tp(320, 520);
    await sleep(140);
    await page.keyboard.down('Space');
    await sleep(26);
    await page.keyboard.up('Space');
    let reboundStretchMax = 0;
    for (let i = 0; i < 110; i += 1) {
      await sleep(16);
      const vis = await getVis();
      const anisotropy = Math.abs(vis.ball.scaleY - vis.ball.scaleX);
      reboundStretchMax = Math.max(reboundStretchMax, anisotropy);
    }
    report.checks.ball_rebound_jump_stretch_visible = reboundStretchMax >= 0.06;
    report.samples.ball_rebound_jump_stretch_max = reboundStretchMax;

    // Wall rebound alignment with launch direction
    let wallAligned = false;
    let wallTriggered = false;
    let wallDot = null;
    const candidates = [
      { x: 28, y: 640 },
      { x: 32, y: 580 },
      { x: 1248, y: 620 },
      { x: 1244, y: 560 }
    ];
    for (const c of candidates) {
      await tp(c.x, c.y);
      await sleep(120);
      await page.keyboard.down('Space');
      await sleep(24);
      await page.keyboard.up('Space');
      for (let i = 0; i < 24; i += 1) {
        await sleep(16);
        const vis = await getVis();
        const v = norm(vis.velocityX, vis.velocityY);
        const a = axisFromRotation(vis.ball.rotationRad);
        if (v && Math.hypot(vis.velocityX, vis.velocityY) > 120 && Math.abs(vis.velocityX) > 80) {
          wallTriggered = true;
          wallDot = (a.x * v.x) + (a.y * v.y);
          wallAligned = wallDot >= 0.72;
          break;
        }
      }
      if (wallTriggered) break;
    }
    report.checks.wall_rebound_launch_detected = wallTriggered;
    report.checks.wall_jump_stretch_aligned_with_launch = wallAligned;
    report.samples.wall_alignment_dot = wallDot;

    // Ball apex returns close to circle
    await tp(420, 790);
    await sleep(220);
    await page.keyboard.down('Space');
    await sleep(28);
    await page.keyboard.up('Space');
    let apexCircleOk = false;
    let apexSample = null;
    for (let i = 0; i < 90; i += 1) {
      await sleep(16);
      const vis = await getVis();
      if (Math.abs(vis.velocityY) <= 24) {
        const dx = Math.abs(vis.ball.scaleX - 1);
        const dy = Math.abs(vis.ball.scaleY - 1);
        apexCircleOk = dx <= 0.06 && dy <= 0.06;
        apexSample = { scaleX: vis.ball.scaleX, scaleY: vis.ball.scaleY, velocityY: vis.velocityY };
        break;
      }
    }
    report.checks.ball_apex_returns_to_circle = apexCircleOk;
    report.samples.ball_apex_sample = apexSample;

    // Ground boost on K deformation readable and mostly horizontal
    await tp(560, 790);
    await sleep(220);
    await page.keyboard.down('KeyD');
    await sleep(60);
    await page.keyboard.press('KeyK');
    let boostStretchMax = 0;
    let boostHorizontalAligned = false;
    for (let i = 0; i < 20; i += 1) {
      await sleep(16);
      const vis = await getVis();
      const anisotropy = Math.abs(vis.ball.scaleY - vis.ball.scaleX);
      boostStretchMax = Math.max(boostStretchMax, anisotropy);
      const axis = axisFromRotation(vis.ball.rotationRad);
      if (Math.abs(axis.x) > Math.abs(axis.y)) boostHorizontalAligned = true;
    }
    await page.keyboard.up('KeyD');
    report.checks.ball_ground_boost_has_readable_deformation = boostStretchMax >= 0.06;
    report.checks.ball_ground_boost_axis_horizontal_bias = boostHorizontalAligned;
    report.samples.ball_boost_stretch_max = boostStretchMax;

    // Square no continuous fall stretch + delay check
    report.checks.square_form_ready = await ensureForm('square');
    await tp(760, 790);
    await sleep(240);
    await measureJumpDelay('square');
    await page.keyboard.down('Space');
    await sleep(24);
    await page.keyboard.up('Space');
    let lateFallAnisotropyMax = 0;
    for (let i = 0; i < 150; i += 1) {
      await sleep(16);
      const vis = await getVis();
      if (vis.velocityY > 140) {
        lateFallAnisotropyMax = Math.max(lateFallAnisotropyMax, Math.abs(vis.square.scaleY - vis.square.scaleX));
      }
    }
    report.checks.square_no_fall_stretch = lateFallAnisotropyMax <= 0.03;
    report.samples.square_late_fall_anisotropy_max = lateFallAnisotropyMax;

    // Overall no gameplay delay added
    report.checks.no_gameplay_delay_added = Boolean(report.checks.ball_jump_no_delay) && Boolean(report.checks.square_jump_no_delay);

    await page.screenshot({ path: path.join(OUT_DIR, 'presentation_smoke_final.png'), fullPage: true });
    report.finishedAt = new Date().toISOString();
    await fsp.writeFile(path.join(OUT_DIR, 'presentation_smoke_report.json'), JSON.stringify(report, null, 2), 'utf8');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
