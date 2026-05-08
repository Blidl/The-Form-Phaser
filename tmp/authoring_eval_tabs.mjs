import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out = 'output/playwright/authoring-eval3';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
const messages=[];
page.on('console', m=>messages.push({type:m.type(), text:m.text()}));
page.on('pageerror', e=>messages.push({type:'pageerror', text:e.message}));
await page.goto('http://127.0.0.1:8080/?levelId=test-world-02&editorOpen=true', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(3000);
let shell = await page.locator('[data-editor-shell="true"]').count();
if (!shell) { await page.keyboard.press('F2'); await page.waitForTimeout(1000); }
const tabs = ['Level','Player','Objects','Background','NPC','Cutscenes','Logic'];
const report = { tabs: {}, messages };
for (const tab of tabs) {
  await page.getByRole('button', { name: tab, exact: true }).click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${tab.toLowerCase()}.png`, fullPage: true });
  const text = await page.locator('[data-editor-shell="true"]').innerText().catch(() => 'NO_EDITOR_SHELL_TEXT');
  report.tabs[tab] = { textSample: text.slice(0, 2500), hasPlaceholder: /placeholder|Future:|No gameplay tuning persistence/i.test(text) };
}
await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
