import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out = 'output/playwright/authoring-eval2';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
const messages=[];
page.on('console', m=>messages.push({type:m.type(), text:m.text()}));
page.on('pageerror', e=>messages.push({type:'pageerror', text:e.message}));
await page.goto('http://127.0.0.1:8080/?levelId=test_world_level_01&editorOpen=true', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(3000);
let state = await page.evaluate(() => ({
  bodyText: document.body.innerText,
  canvasCount: document.querySelectorAll('canvas').length,
  shell: !!document.querySelector('[data-editor-shell="true"]'),
  shellDisplay: document.querySelector('[data-editor-shell="true"]') ? getComputedStyle(document.querySelector('[data-editor-shell="true"]')).display : null,
  buttons: Array.from(document.querySelectorAll('button')).map(b=>b.textContent?.trim()),
  href: location.href
}));
if (!state.shell || state.shellDisplay === 'none') {
  await page.keyboard.press('F2');
  await page.waitForTimeout(1000);
}
state = await page.evaluate(() => ({
  bodyText: document.body.innerText,
  canvasCount: document.querySelectorAll('canvas').length,
  shell: !!document.querySelector('[data-editor-shell="true"]'),
  shellDisplay: document.querySelector('[data-editor-shell="true"]') ? getComputedStyle(document.querySelector('[data-editor-shell="true"]')).display : null,
  shellText: document.querySelector('[data-editor-shell="true"]')?.innerText ?? null,
  buttons: Array.from(document.querySelectorAll('button')).map(b=>b.textContent?.trim()),
  href: location.href
}));
await page.screenshot({ path: `${out}/state.png`, fullPage: true });
await fs.writeFile(`${out}/report.json`, JSON.stringify({state,messages}, null, 2));
console.log(JSON.stringify({state,messages}, null, 2));
await browser.close();
