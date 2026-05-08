import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out = 'output/playwright/authoring-active-eval';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
const messages=[];
page.on('console', m=>messages.push({type:m.type(), text:m.text()}));
page.on('pageerror', e=>messages.push({type:'pageerror', text:e.message}));
await page.goto('http://127.0.0.1:8080/?levelId=test-world-02', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(2000);
await page.keyboard.press('F2');
await page.waitForTimeout(700);
const tabs = ['Level','Player','Objects','Background','NPC','Cutscenes','Logic'];
const report = { tabs: {}, messages };
for (const tab of tabs) {
  await page.evaluate((label) => {
    const buttons = Array.from(document.querySelectorAll('[data-editor-shell="true"] button'));
    const b = buttons.find((el) => (el.textContent || '').trim() === label);
    b?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }, tab);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${tab.toLowerCase()}.png`, fullPage: true });
  const state = await page.evaluate(() => {
    const shell = document.querySelector('[data-editor-shell="true"]');
    return {
      display: shell ? getComputedStyle(shell).display : null,
      text: shell?.innerText ?? null,
      activeGreenButtons: Array.from(document.querySelectorAll('[data-editor-shell="true"] button')).filter((b) => getComputedStyle(b).backgroundColor.includes('112, 222, 99')).map((b)=>b.textContent?.trim())
    };
  });
  report.tabs[tab] = { display: state.display, textSample: (state.text || '').slice(0, 2500), activeGreenButtons: state.activeGreenButtons, hasPlaceholder: /placeholder|Future:|No gameplay tuning persistence/i.test(state.text || '') };
}
await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
