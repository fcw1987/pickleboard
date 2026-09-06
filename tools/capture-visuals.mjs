import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const baseURL = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const output = process.env.VISUAL_OUTPUT || 'docs/visual-evidence/after';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const results=[];
for (const [name,width,height] of [['narrow',320,568],['phone',390,844],['landscape',844,390],['desktop',1440,900]]) {
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
 await page.goto(baseURL); await page.waitForFunction(()=>window.pickleboard?.threeD);
 const perf=await page.evaluate(()=>({load:performance.getEntriesByType('navigation')[0].loadEventEnd,resources:performance.getEntriesByType('resource').map(r=>({name:r.name.split('/').pop(),bytes:r.decodedBodySize})),dpr:devicePixelRatio}));
 await page.screenshot({animations:'disabled',path:`${output}/${name}-board.png`});
 await page.locator('#menuToggle').click();await page.screenshot({animations:'disabled',path:`${output}/${name}-menu.png`});
 await page.locator('#menuClose').click();await page.locator('#menuOverlay').waitFor({state:'hidden'});
 await page.evaluate(()=>pickleboard.plays.load('third-shot-drop'));
 await page.screenshot({animations:'disabled',path:`${output}/${name}-2d.png`});
 await page.locator('#play3dView').click(); await page.locator('#threeDCanvas canvas').waitFor();
 await page.screenshot({animations:'disabled',path:`${output}/${name}-3d.png`});
 const render=await page.evaluate(async()=>{const v=pickleboard.threeD;v.togglePlay();let times=[],last=performance.now();await new Promise(resolve=>{const sample=now=>{times.push(now-last);last=now;if(times.length<90)requestAnimationFrame(sample);else resolve();};requestAnimationFrame(sample)});v.togglePlay();times.sort((a,b)=>a-b);return {median:times[45],p95:times[85],calls:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles,geometries:v.renderer.info.memory.geometries}});
 results.push({name,viewport:{width,height},...perf,render});
 await page.locator('#threeDRestart').click();
 await page.locator('#threeDCamera').selectOption('sideline');
 await page.screenshot({animations:'disabled',path:`${output}/${name}-sideline.png`});
 if(name==='desktop') {
  for(const scale of [1,2]) {
   for(const [phase,offset] of [['prepare',-.18],['contact',0],['follow',.12],['recover',.4]]) {
    await page.evaluate(({scale,offset})=>{const v=pickleboard.threeD;v.setPixelScale?.(scale);const s=v.timeline.segments.find(s=>s.step.id==='third-drop');v.clock.elapsed=s.startTime+s.contactTime+offset;v.applyAtTime(v.clock.elapsed);v.renderer.render(v.scene,v.camera);},{scale,offset});
    await page.screenshot({animations:'disabled',path:`${output}/density-${scale}-${phase}.png`});
   }
  }
 }
 await page.locator('#threeDExit').click();await page.locator('#playExit').click();
 await page.evaluate(()=>{if(document.body.dataset.theme!=='dark')pickleboard.toggleTheme();});
 await page.screenshot({animations:'disabled',path:`${output}/${name}-dark.png`});
 await page.locator('#infoToggle').click();await page.screenshot({animations:'disabled',path:`${output}/${name}-help.png`});
 await page.close();
}
await browser.close();
writeFileSync(`${output}/measurements.json`,JSON.stringify({baseURL,revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),note:'Working tree may contain documented integrated changes. Headless Chromium on host Mac, DPR1; local load durations and 90 rAF samples are not physical phone benchmarks.',results},null,2));
console.log(JSON.stringify(results.map(({name,load,render,resources})=>({name,load,render,bytes:resources.reduce((s,r)=>s+r.bytes,0),threeInitiallyLoaded:resources.some(r=>r.name.includes('three.module'))})),null,2));
