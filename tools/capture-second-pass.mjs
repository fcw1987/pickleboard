import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const url=process.env.PREVIEW_URL||'http://127.0.0.1:4173';
const output=process.env.CAPTURE_OUTPUT||'docs/second-pass/after';
mkdirSync(output,{recursive:true});
const browser=await chromium.launch();const meta=[];
for(const [name,width,height] of [['phone',390,844],['landscape',844,390],['desktop',1440,900],['narrow',320,568]]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,...(name==='desktop'?{recordVideo:{dir:output+'/clips',size:{width:1440,height:900}}}:{})});
 const page=await context.newPage();await page.goto(url);await page.waitForFunction(()=>window.pickleboard?.threeD);
 const initial=await page.evaluate(()=>({bytes:performance.getEntriesByType('resource').reduce((sum,r)=>sum+r.decodedBodySize,0),loadMs:performance.getEntriesByType('navigation')[0].loadEventEnd}));
 await page.screenshot({path:`${output}/${name}-board.png`});
 await page.evaluate(()=>pickleboard.plays.load('third-shot-drop'));
 await page.screenshot({path:`${output}/${name}-guided.png`});
 if(name==='desktop'){await page.locator('#play3dView').screenshot({path:`${output}/3d-button.png`});await page.locator('#play3dView').hover();await page.locator('#play3dView').screenshot({path:`${output}/3d-button-hover.png`});}
 if(name==='desktop'){await page.locator('#playPlayPause').click();await page.waitForFunction(()=>!pickleboard.plays.getState().playing);await page.locator('#playRestart').click();}
 await page.locator('#play3dView').click();await page.locator('#threeDCanvas canvas').waitFor();
 await page.screenshot({path:`${output}/${name}-replay.png`});
 meta.push(await page.evaluate(({name})=>{const v=pickleboard.threeD,c=v.renderer.domElement,b=c.getBoundingClientRect();return{name,dpr:devicePixelRatio,canvasCSS:[b.width,b.height],buffer:[c.width,c.height],pixelScale:v.pixelScale,pixelRatio:v.renderer.getPixelRatio(),postprocessingTargets:'none',camera:v.cameraPreset,userAgent:navigator.userAgent};},{name}));meta[meta.length-1].initial=initial;
 if(name==='desktop'){
  await page.locator('#threeDPlayPause').click();
  await page.waitForFunction(()=>pickleboard.threeD.clock.elapsed>=Math.min(5,pickleboard.threeD.timeline.duration));
  await page.locator('#threeDPlayPause').click();
  for(const camera of ['overhead','sideline','behind-green','behind-orange']){
   await page.locator('#threeDCamera').selectOption(camera);
   for(const [phase,offset]of[['prepare',-.18],['contact',0],['follow',.12],['recover',.4]]){
    await page.evaluate(offset=>{const v=pickleboard.threeD,s=v.timeline.segments.find(s=>s.step.id==='third-drop');v.clock.elapsed=s.startTime+s.contactTime+offset;v.applyAtTime(v.clock.elapsed);v.renderer.render(v.scene,v.camera);},offset);
    await page.screenshot({path:`${output}/${camera}-${phase}.png`});
   }
  }
 }
 await page.locator('#threeDExit').click();await page.locator('#playExit').click();
 await page.evaluate(()=>pickleboard.toggleTheme());await page.screenshot({path:`${output}/${name}-night.png`});
 await context.close();
}
await browser.close();writeFileSync(`${output}/capture-metadata.json`,JSON.stringify({url,note:'DPR2 screenshots and Playwright video for motion review. Export FPS is not runtime cadence evidence.',views:meta},null,2));
