const fsp = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'tmp', 'acceptance_player_forms_retest');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureDir(dir) { await fsp.mkdir(dir, { recursive: true }); }

async function run() {
  await ensureDir(OUT_DIR);
  const report = {};
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  try {
    await page.goto('http://localhost:8081/', { waitUntil: 'networkidle' });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
    await sleep(700);

    const snap = () => page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
    const tp = (x, y) => page.evaluate(({x, y}) => window.__THE_FORM_DEBUG__.teleportPlayer(x, y), {x, y});

    const ensureForm = async (target) => {
      for (let i = 0; i < 8; i += 1) {
        const s = await snap();
        if (s.form === target) return true;
        await page.keyboard.press('KeyE');
        await sleep(120);
      }
      return false;
    };

    await page.keyboard.press('Digit9');
    await sleep(80);
    await page.keyboard.press('Digit3');
    await sleep(80);

    report.squareFormReady = await ensureForm('square');
    report.squareFormAfterEnsure = (await snap()).form;

    await tp(360, 300);
    await sleep(250);
    await page.screenshot({ path: path.join(OUT_DIR, '01_square_near_left_face.png'), fullPage: true });

    await page.keyboard.down('KeyK');
    await sleep(550);
    const attachedText = await page.locator('#test-debug-dock').innerText();
    await page.screenshot({ path: path.join(OUT_DIR, '02_square_attach_hold.png'), fullPage: true });

    await page.keyboard.press('Space');
    await sleep(120);
    const attachJumpA = await page.locator('#test-debug-dock').innerText();
    await page.screenshot({ path: path.join(OUT_DIR, '03_square_attach_jump_start.png'), fullPage: true });

    await sleep(700);
    const attachJumpB = await page.locator('#test-debug-dock').innerText();
    await page.screenshot({ path: path.join(OUT_DIR, '04_square_attach_jump_follow.png'), fullPage: true });

    await page.keyboard.down('KeyD');
    await sleep(1400);
    await page.keyboard.up('KeyD');
    await page.screenshot({ path: path.join(OUT_DIR, '05_square_trail_after_spend.png'), fullPage: true });

    await page.keyboard.press('KeyO');
    await sleep(650);
    await page.screenshot({ path: path.join(OUT_DIR, '06_square_trail_after_regen.png'), fullPage: true });
    await page.keyboard.up('KeyK');

    report.attachText = attachedText;
    report.attachJumpA = attachJumpA;
    report.attachJumpB = attachJumpB;
    report.attachDetected = /form:\s*square/i.test(attachedText) && /square attached:\s*yes/i.test(attachedText);
    report.attachJumpDetected = /form:\s*square/i.test(attachJumpA + '\n' + attachJumpB) && /square attached:\s*no/i.test(attachJumpA + '\n' + attachJumpB);

    // tuning live apply status exact check
    await page.keyboard.press('Digit0');
    await page.waitForSelector('#player-tuning-sidebar:not(.player-tuning--hidden)', { timeout: 5000 });
    await page.click('[data-tuning-tab-id="ball"]');
    const field = page.locator('input[data-tuning-field-id="ball-anim-jump-squash-scale-x"]');
    const before = Number(await field.inputValue());
    const next = Number((before + 0.11).toFixed(2));
    await field.fill(String(next));
    await field.dispatchEvent('change');
    await sleep(220);
    const statuses = await page.locator('.player-tuning__status').allInnerTexts();
    report.tuningStatusesAfterChange = statuses;
    report.liveApplyStatusSeen = statuses.some((s) => /live draft applied/i.test(s));
    await page.screenshot({ path: path.join(OUT_DIR, '07_tuning_status_after_change.png'), fullPage: true });

    await page.click('button[data-tuning-action="revert"]');
    await sleep(220);
    await page.screenshot({ path: path.join(OUT_DIR, '08_tuning_after_revert.png'), fullPage: true });

    await fsp.writeFile(path.join(OUT_DIR, 'retest_report.json'), JSON.stringify(report, null, 2), 'utf8');
  } finally {
    await browser.close();
  }
}

run().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
