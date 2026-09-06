import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const output='docs/pixel-replay/motion';mkdirSync(output,{recursive:true});
const browser=await chromium.launch();const records=[];
for(const play of ['serve-and-return','third-shot-drop','third-shot-drive','fifth-shot-drop']) {
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2,recordVideo:{dir:output,size:{width:1440,height:900}}});
 const page=await context.newPage();await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.pickleboard?.threeD);
 await page.evaluate(play=>pickleboard.plays.load(play),play);await page.locator('#play3dView').click();await page.locator('#threeDCanvas canvas').waitFor();
 await page.locator('#threeDPlayPause').click();await page.waitForFunction(()=>pickleboard.threeD.clock.elapsed>=pickleboard.threeD.timeline.duration,{},{timeout:60000});
 const duration=await page.evaluate(()=>pickleboard.threeD.timeline.duration);
 for(const hand of ['right','left']) {
  await page.evaluate(hand=>{const v=pickleboard.threeD;for(const actor of v.playerObjects.values())actor.userData.handedness=hand;},hand);
  const shots=await page.evaluate(()=>pickleboard.threeD.timeline.segments.filter(s=>s.trajectory).map(s=>({id:s.step.id,time:s.startTime+s.contactTime})));
  for(const shot of shots)for(const [phase,offset] of [['prepare',-.12],['contact',0],['follow',.12]]) {
   await page.evaluate(t=>{const v=pickleboard.threeD;v.clock.elapsed=t;v.applyAtTime(t);v.renderer.render(v.scene,v.camera);},shot.time+offset);
   await page.screenshot({path:`${output}/${play}-${shot.id}-${hand}-${phase}.png`});
  }
 }
 const video=page.video();await context.close();await video.saveAs(`${output}/${play}.webm`);records.push({play,duration,clip:`${play}.webm`,note:'Actual browser recording at normal 1x, then diagnostic contact samples. Export FPS is not displayed FPS.'});
}
await browser.close();writeFileSync(`${output}/index.json`,JSON.stringify(records,null,2));
