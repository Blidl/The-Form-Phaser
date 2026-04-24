const { chromium } = require('playwright');
const URL='http://127.0.0.1:8082/';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
function hidden(vis){return !vis.ball.visible&&!vis.triangle.visible&&!vis.square.visible;}
async function dbg(page){return page.evaluate(()=>({snap:window.__THE_FORM_DEBUG__.getPlayerSnapshot(),vis:window.__THE_FORM_DEBUG__.getPlayerVisualSnapshot()}));}
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 await page.goto(URL,{waitUntil:'networkidle'}); await page.keyboard.press('Enter');
 await page.waitForFunction(()=>typeof window.__THE_FORM_DEBUG__==='object',null,{timeout:15000}); await sleep(600);
 await page.evaluate(()=>window.__THE_FORM_DEBUG__.teleportPlayer(680,790)); await sleep(200);
 for (const hold of [800,1200,1600,2000,2400,3000]) {
   await page.evaluate(()=>window.__THE_FORM_DEBUG__.teleportPlayer(680,790)); await sleep(120);
   await page.keyboard.down('KeyA'); await sleep(hold); await page.keyboard.up('KeyA');
   let death=false; let hit=null;
   for (let i=0;i<45;i++){ const d=await dbg(page); if(hidden(d.vis)){death=true; hit=d.snap; break;} await sleep(20);}
   await sleep(340); const after=await dbg(page);
   console.log(JSON.stringify({hold,death,hit,afterHidden:hidden(after.vis),after:after.snap}));
 }
 await browser.close();
})();
