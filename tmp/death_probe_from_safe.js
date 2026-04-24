const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8082/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hidden(vis) { return !vis.ball.visible && !vis.triangle.visible && !vis.square.visible; }
async function getDebug(page) {
  return page.evaluate(() => ({
    snap: window.__THE_FORM_DEBUG__.getPlayerSnapshot(),
    vis: window.__THE_FORM_DEBUG__.getPlayerVisualSnapshot()
  }));
}
async function runSeq(page, seq) {
  await page.evaluate(() => window.__THE_FORM_DEBUG__.teleportPlayer(680, 790));
  await sleep(200);
  for (const step of seq) {
    await page.keyboard.down(step.key);
    await sleep(step.ms);
    await page.keyboard.up(step.key);
    await sleep(step.pause || 40);
    const d = await getDebug(page);
    if (hidden(d.vis)) return { death: true, at: d.snap, vis: d.vis };
  }
  const start = Date.now();
  while (Date.now() - start < 700) {
    const d = await getDebug(page);
    if (hidden(d.vis)) return { death: true, at: d.snap, vis: d.vis };
    await sleep(20);
  }
  return { death: false, at: (await getDebug(page)).snap };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => typeof window.__THE_FORM_DEBUG__ === 'object', null, { timeout: 15000 });
  await sleep(500);

  const seqs = [
    [{key:'ArrowLeft',ms:1800}],
    [{key:'ArrowLeft',ms:1200},{key:'ArrowUp',ms:120}],
    [{key:'ArrowLeft',ms:1200},{key:'ArrowRight',ms:300},{key:'ArrowLeft',ms:900}],
    [{key:'ArrowUp',ms:120},{key:'ArrowLeft',ms:1800}],
    [{key:'ArrowRight',ms:900},{key:'ArrowLeft',ms:2200}],
    [{key:'ArrowLeft',ms:1400},{key:'ArrowUp',ms:120},{key:'ArrowLeft',ms:900}],
    [{key:'ArrowLeft',ms:2200}],
    [{key:'ArrowLeft',ms:2600}],
    [{key:'ArrowLeft',ms:1400},{key:'ArrowDown',ms:200},{key:'ArrowLeft',ms:1200}],
  ];

  for (const seq of seqs) {
    const r = await runSeq(page, seq);
    console.log(JSON.stringify({ seq, ...r }));
    await sleep(250);
  }

  await browser.close();
})();
