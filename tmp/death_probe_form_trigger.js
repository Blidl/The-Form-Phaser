const { chromium } = require('playwright');
const URL='http://127.0.0.1:8082/';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
function hidden(vis){return !vis.ball.visible&&!vis.triangle.visible&&!vis.square.visible;}
async function dbg(page){return page.evaluate(()=>({snap:window.__THE_FORM_DEBUG__.getPlayerSnapshot(),vis:window.__THE_FORM_DEBUG__.getPlayerVisualSnapshot()}));}
async function ensureForm(page,target){for(let i=0;i<14;i++){const s=await page.evaluate(()=>window.__THE_FORM_DEBUG__.getPlayerSnapshot()); if(s.form===target)return true; await page.keyboard.press('KeyE'); await sleep(180);} return false;}

(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 await page.goto(URL,{waitUntil:'networkidle'}); await page.keyboard.press('Enter');
 await page.waitForFunction(()=>typeof window.__THE_FORM_DEBUG__==='object',null,{timeout:15000}); await sleep(500);
 for (const form of ['ball','triangle','square']) {
   await page.evaluate(()=>window.__THE_FORM_DEBUG__.teleportPlayer(640,520));
   await sleep(120);
   await ensureForm(page,form);
   await sleep(120);
   const before=await dbg(page);
   await page.keyboard.down('KeyA'); await sleep(600); await page.keyboard.up('KeyA');
   let death=false; let dSnap=null;
   for (let i=0;i<45;i++){const d=await dbg(page); if(hidden(d.vis)){death=true; dSnap=d.snap; break;} await sleep(20);} 
   await sleep(120); const after=await dbg(page);
   console.log(JSON.stringify({form,before:before.snap,after:after.snap,death,dSnap,afterHidden:hidden(after.vis)}));
 }
 await browser.close();
})();
