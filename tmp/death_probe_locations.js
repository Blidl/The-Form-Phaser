const { chromium } = require('playwright');

const URL = 'http://127.0.0.1:8082/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hidden(vis) {
  return !vis.ball.visible && !vis.triangle.visible && !vis.square.visible;
}

async function getDebug(page) {
  return page.evaluate(() => ({
    snap: window.__THE_FORM_DEBUG__.getPlayerSnapshot(),
    vis: window.__THE_FORM_DEBUG__.getPlayerVisualSnapshot()
  }));
}

async function ensureBall(page) {
  for (let i = 0; i < 12; i += 1) {
    const d = await getDebug(page);
    if (d.snap.form === 'ball') return true;
    await page.keyboard.press('KeyE');
    await sleep(180);
  }
  return false;
}

async function tryCase(page, c) {
  await page.evaluate(({ x, y }) => window.__THE_FORM_DEBUG__.teleportPlayer(x, y), c);
  await sleep(80);
  await ensureBall(page);
  await sleep(80);
  await page.keyboard.down(c.key);
  await sleep(c.hold);
  await page.keyboard.up(c.key);

  let death = false;
  const start = Date.now();
  while (Date.now() - start < 500) {
    const d = await getDebug(page);
    if (hidden(d.vis)) {
      death = true;
      break;
    }
    await sleep(16);
  }

  await sleep(360);
  const after = await getDebug(page);
  return {
    ...c,
    death,
    afterHidden: hidden(after.vis),
    afterForm: after.snap.form,
    afterY: after.snap.y
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
  await sleep(500);

  const cases = [
    { x: 560, y: 532, key: 'ArrowRight', hold: 240 },
    { x: 545, y: 532, key: 'ArrowRight', hold: 220 },
    { x: 530, y: 532, key: 'ArrowRight', hold: 220 },
    { x: 620, y: 520, key: 'ArrowLeft', hold: 240 },
    { x: 640, y: 520, key: 'ArrowLeft', hold: 260 },
    { x: 680, y: 790, key: 'ArrowLeft', hold: 700 },
    { x: 680, y: 790, key: 'ArrowRight', hold: 700 },
    { x: 680, y: 790, key: 'ArrowUp', hold: 120 },
    { x: 620, y: 680, key: 'ArrowUp', hold: 120 },
    { x: 620, y: 680, key: 'ArrowRight', hold: 260 }
  ];

  for (const c of cases) {
    const r = await tryCase(page, c);
    console.log(JSON.stringify(r));
    await sleep(200);
  }

  await browser.close();
})();
