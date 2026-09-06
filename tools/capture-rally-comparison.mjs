import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='docs/park-coaching/rally-comparison';mkdirSync(out,{recursive:true});
const browser=await chromium.launch(),results=[];
try{for(const [label,url]of[['before','http://127.0.0.1:4175'],['after','http://127.0.0.1:4173']]){
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,recordVideo:{dir:out,size:{width:1440,height:900}}}),page=await context.newPage();
 await page.goto(url);await page.waitForFunction(()=>window.pickleboard?.threeD);await page.evaluate(()=>pickleboard.plays.load('serve-and-return'));await page.locator('#play3dView').click();await page.locator('#threeDCanvas canvas').waitFor();await page.locator('#threeDCamera').selectOption('sideline');
 const data=await page.evaluate(()=>{const v=pickleboard.threeD,segments=v.timeline.segments,points=[];for(const s of segments.slice(0,-1)){const t=s.endTime;const before=v.sampleBall(Math.max(0,t-1e-6)),after=v.sampleBall(t+1e-6);points.push({step:s.step.id,time:t,before:{x:before.x,y:before.y,z:before.z},after:{x:after.x,y:after.y,z:after.z},jumpMeters:Math.hypot(before.x-after.x,before.y-after.y,before.z-after.z)});}return{duration:v.timeline.duration,boundaries:points,camera:v.cameraPreset};});
 await page.screenshot({path:`${out}/${label}-sideline-ready.png`});await page.locator('#threeDPlayPause').click();await page.waitForFunction(()=>pickleboard.threeD.clock.elapsed>=pickleboard.threeD.timeline.duration&&!pickleboard.threeD.clock.playing,{},{timeout:30000});
 await page.screenshot({path:`${out}/${label}-sideline-complete.png`});const video=page.video();await context.close();await video.saveAs(`${out}/${label}-serve-return-sideline.webm`);results.push({label,url,viewport:[1440,900],dpr:1,play:'serve-and-return',playbackRate:1,recordingFps:25,...data});
}}finally{await browser.close();}
writeFileSync(`${out}/evidence.json`,JSON.stringify(results,null,2));
