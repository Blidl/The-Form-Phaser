const fsp = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'tmp', 'npc_carry_smoke_dynamic');
const NPC_ID = 'npc_passive_lookout';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureDir(dir) { await fsp.mkdir(dir, { recursive: true }); }

async function run() {
  await ensureDir(OUT_DIR);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const report = { startedAt: new Date().toISOString(), scenarios: {} };

  const getPlayer = () => page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
  const getNpcBody = () => page.evaluate((npcId) => window.__THE_FORM_DEBUG__.getNpcBodySnapshot(npcId), NPC_ID);
  const getNpcEntry = () => page.evaluate((npcId) => {
    const entry = window.__THE_FORM_DEBUG__.getNpcDebugEntries().find((item) => item.id === npcId);
    return entry ?? null;
  }, NPC_ID);
  const teleport = (x, y) => page.evaluate(({ x: px, y: py }) => window.__THE_FORM_DEBUG__.teleportPlayer(px, py), { x, y });

  async function ensureForm(form) {
    for (let i = 0; i < 6; i += 1) {
      const snap = await getPlayer();
      if (snap.form === form) return true;
      await page.keyboard.press('KeyE');
      await sleep(180);
    }
    return false;
  }

  async function sampleRide(form) {
    const formReady = await ensureForm(form);
    const npc0 = await getNpcBody();
    if (!npc0) return { formReady, error: 'npc body missing' };

    await teleport(npc0.x, npc0.y - 54);
    await sleep(300);

    const samples = [];
    for (let i = 0; i < 24; i += 1) {
      const player = await getPlayer();
      const npc = await getNpcBody();
      const npcEntry = await getNpcEntry();
      samples.push({ t: i * 120, player, npc, touching: npcEntry?.touchingPlayer ?? null });
      await sleep(120);
    }

    const yValues = samples.map((s) => s.player.y);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    const yOsc = maxY - minY;
    const touchCount = samples.filter((s) => s.touching === true).length;

    await page.screenshot({ path: path.join(OUT_DIR, `${form}.png`), fullPage: true });
    return { formReady, yOsc, minY, maxY, touchCount, samples };
  }

  try {
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
    await sleep(800);
    await page.click('canvas');

    report.scenarios.ball = await sampleRide('ball');
    report.scenarios.square = await sampleRide('square');
    report.finishedAt = new Date().toISOString();
    await fsp.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  } finally {
    await browser.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
