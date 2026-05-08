import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out = 'output/playwright/authoring-eval';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 768 }, acceptDownloads: true });
const consoleMessages = [];
page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
page.on('pageerror', err => consoleMessages.push({ type: 'pageerror', text: err.message }));
await page.goto('http://127.0.0.1:8080/?levelId=test_world_level_01&editorOpen=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const shellVisible = await page.locator('[data-editor-shell="true"]').evaluate(el => getComputedStyle(el).display !== 'none').catch(() => false);
if (!shellVisible) {
  await page.keyboard.press('F2');
  await page.waitForTimeout(500);
}
const tabs = ['Level','Player','Objects','Background','NPC','Cutscenes','Logic'];
const report = { url: page.url(), tabs: {}, consoleMessages };
for (const tab of tabs) {
  await page.getByRole('button', { name: tab, exact: true }).click().catch(async () => {});
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${out}/${tab.toLowerCase()}.png`, fullPage: true });
  const text = await page.locator('[data-editor-shell="true"]').innerText().catch(async () => 'NO_EDITOR_SHELL_TEXT');
  report.tabs[tab] = {
    textSample: text.slice(0, 5000),
    hasPlaceholder: /placeholder|Future:|No gameplay tuning persistence/i.test(text),
    buttonTexts: await page.locator('[data-editor-shell="true"] button').evaluateAll(btns => btns.map(b => b.textContent?.trim()).filter(Boolean)).catch(() => []),
    inputCount: await page.locator('[data-editor-shell="true"] input').count().catch(() => -1),
    selectCount: await page.locator('[data-editor-shell="true"] select').count().catch(() => -1)
  };
}
await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));
