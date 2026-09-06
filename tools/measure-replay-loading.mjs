import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const browser=await chromium.launch();const results=[];
for(const [label,url] of [['before','http://127.0.0.1:4175'],['after','http://127.0.0.1:4173']])for(let run=1;run<=3;run++){
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2,serviceWorkers:'block'});const page=await context.newPage();
 await page.goto(url);await page.waitForFunction(()=>window.pickleboard?.threeD);
 const initial=await page.evaluate(()=>({loadMs:performance.getEntriesByType('navigation')[0].loadEventEnd,resourceBytes:performance.getEntriesByType('resource').reduce((n,r)=>n+r.decodedBodySize,0),threeLoaded:performance.getEntriesByType('resource').some(r=>r.name.includes('three.module'))}));
 await page.evaluate(()=>pickleboard.plays.load('third-shot-drive'));
 const entries=[];
 for(let i=0;i<4;i++){
  const start=performance.now();await page.locator('#play3dView').click();await page.locator('#threeDCanvas canvas').waitFor();
  const readyMs=performance.now()-start;const resources=await page.evaluate(()=>{const v=pickleboard.threeD;v.renderer.render(v.scene,v.camera);return {memory:v.renderer.info.memory,calls:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles,resourceBytes:performance.getEntriesByType('resource').reduce((n,r)=>n+r.decodedBodySize,0)};});entries.push({kind:i?'warm':'cold',readyMs,...resources});await page.locator('#threeDExit').click();
 }
 results.push({label,run,initial,entries});await context.close();
}
await browser.close();writeFileSync(process.env.MEASURE_OUTPUT || 'docs/pixel-replay/loading.json',JSON.stringify({conditions:'Headless Chromium, 1440x900 DPR2, local HTTP, isolated context per run, service workers blocked to isolate on-demand resource requests; timings include Playwright click/wait overhead. 3 cold and 9 warm entries per revision.',results},null,2));
