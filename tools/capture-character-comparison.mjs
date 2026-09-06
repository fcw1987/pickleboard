import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const browser=await chromium.launch();const records=[];
for(const [label,url] of [['before','http://127.0.0.1:4175'],['after','http://127.0.0.1:4173']]){
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2});const page=await context.newPage();await page.goto(url);await page.waitForFunction(()=>window.pickleboard?.threeD);await page.evaluate(()=>pickleboard.plays.load('third-shot-drop'));await page.locator('#play3dView').click();await page.locator('#threeDCanvas canvas').waitFor();
 const clip=await page.evaluate(async()=>{const THREE=await import('./vendor/three.module.min.js'),v=pickleboard.threeD,a=v.playerObjects.get('player1');v.scene.updateMatrixWorld(true);const foot=a.position.clone().project(v.camera),head=a.position.clone().add(new THREE.Vector3(0,2.4,0)).project(v.camera),c=v.renderer.domElement.getBoundingClientRect();const x=(foot.x+1)*c.width/2,y=(1-head.y)*c.height/2,bottom=(1-foot.y)*c.height/2;return{x:Math.floor(x-55),y:Math.floor(y-8),width:110,height:Math.ceil(bottom-y+20)};});
 await page.screenshot({path:`docs/pixel-replay/${label}-character.png`,clip});records.push({label,clip,dpr:2,play:'third-shot-drop',camera:'overhead',state:'ready',note:'Actual in-app crop, no repainting; view direction/framing changed intentionally.'});await context.close();
}
await browser.close();writeFileSync('docs/pixel-replay/character-comparison.json',JSON.stringify(records,null,2));
