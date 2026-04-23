const fsp = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'tmp', 'npc_carry_smoke');
const NPC_X = 1248;
const NPC_Y = 324;
const NPC_ID = 'npc_passive_lookout';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureDir(dir) { await fsp.mkdir(dir, { recursive: true }); }

async function run() {
  await ensureDir(OUT_DIR);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  const report = { startedAt: new Date().toISOString(), scenarios: {} };

  const getPlayer = () => page.evaluate(() => window.__THE_FORM_DEBUG__.getPlayerSnapshot());
  const getNpc = () => page.evaluate((npcId) => {
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
    await teleport(NPC_X, NPC_Y - 54);
    await sleep(200);
    const teleported = await getPlayer();
    await sleep(1200);

    const samples = [];
    for (let i = 0; i < 18; i += 1) {
      const player = await getPlayer();
      const npc = await getNpc();
      samples.push({ t: i * 120, player, npc });
      await sleep(120);
    }

    const first = samples[0];
    const last = samples[samples.length - 1];
    const landedOnNpc = samples.some((entry) => Math.abs(entry.player.x - NPC_X) <= 40 && entry.player.y < 320);
    const playerTravel = last.player.x - first.player.x;
    const maxPlayerDrift = Math.max(...samples.map((entry) => Math.abs(entry.player.x - first.player.x)));

    await page.screenshot({ path: path.join(OUT_DIR, `${form}_npc_ride.png`), fullPage: true });

    return {
      formReady,
      teleported,
      landedOnNpc,
      playerTravel,
      maxPlayerDrift,
      npcStateSamples: samples.map((entry) => entry.npc?.state ?? null),
      samples
    };
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

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
