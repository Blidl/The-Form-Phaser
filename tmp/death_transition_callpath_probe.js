const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const URL='http://127.0.0.1:8082/';
const OUT=path.join(process.cwd(),'tmp','death_transition_debug','callpath_probe.json');
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  await page.goto(URL,{waitUntil:'networkidle'});
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>typeof window.__THE_FORM_DEBUG__==='object',null,{timeout:15000});
  await sleep(500);
  await page.evaluate(()=>window.__THE_FORM_DEBUG__.setDeathDebugOverlay(false,null));
  await page.evaluate(()=>window.__THE_FORM_DEBUG__.teleportPlayer(680,790));
  await sleep(150);
  await page.evaluate(()=>window.__THE_FORM_DEBUG__.teleportPlayer(600,520));

  const samples=[];
  for (const t of [0,40,90,150]) {
    if (t>0) await sleep(t - (samples.length? [0,40,90,150][samples.length-1]:0));
    const snap=await page.evaluate(()=>window.__THE_FORM_DEBUG__.getDeathDebugSnapshot());
    samples.push({t,snap});
  }

  await fs.writeFile(OUT,JSON.stringify({capturedAt:new Date().toISOString(),samples},null,2),'utf8');
  await browser.close();
})();
