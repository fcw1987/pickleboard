import {test,expect} from '@playwright/test';
async function open(page){await page.goto('/?workspace=planner');await page.waitForFunction(()=>window.pickleboard?.plays);await page.evaluate(()=>pickleboard.plays.load('third-shot-drop'));await page.locator('#play3dView').click();await page.waitForFunction(()=>pickleboard.threeD.active);}

test('rendered paddle geometry and opaque artwork meet the unchanged ball at contact',async({page})=>{
 await open(page);
 const result=await page.evaluate(()=>{
  const v=pickleboard.threeD,errors=[],alphas=[];
  for(const [key,atlas]of Object.entries(v.pixelAssets.metadata.atlases)){
   const image=v.pixelAssets.images[key][1],canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   for(const frame of atlas.frames){const x=frame.rect[0]+frame.paddleFace[0],y=frame.rect[1]+frame.paddleFace[1];alphas.push(data[(y*canvas.width+x)*4+3]);}
  }
  for(const handedness of ['left','right']){
   for(const actor of v.playerObjects.values())actor.userData.handedness=handedness;
  for(const camera of ['overhead','sideline','behind-green','behind-orange']){
   v.setCamera(camera);
   for(const segment of v.timeline.segments.filter(s=>s.trajectory)){
    const time=segment.startTime+segment.contactTime;v.clock.elapsed=time;v.applyAtTime(time);
    const actor=v.playerObjects.get(segment.shotSemantics.playerId),d=actor.userData;
    const frameName=d.animation.frame,key=`${d.team==='team1'?'green':'orange'}/${d.handedness}/${d.animation.viewDirection}`;
    const frame=v.pixelAssets.metadata.atlases[key].frames.find(f=>f.action===frameName);
    const gx=frame.paddleFace[0]/frame.rect[2]*16,gy=frame.paddleFace[1]/frame.rect[3]*16;
    const x=Math.floor(gx),y=Math.floor(gy),fx=gx-x,fy=gy-y,p=d.arm.geometry.attributes.position;
    const point=d.paddleFaceWorld.clone().set(0,0,0);
    for(const [xx,yy,w]of[[x,y,(1-fx)*(1-fy)],[x+1,y,fx*(1-fy)],[x,y+1,(1-fx)*fy],[x+1,y+1,fx*fy]]){
     const index=yy*17+xx;point.x+=p.getX(index)*w;point.y+=p.getY(index)*w;point.z+=p.getZ(index)*w;
    }
    d.arm.updateWorldMatrix(true,false);point.applyMatrix4(d.arm.matrixWorld);
    errors.push(point.distanceTo(v.ballObject.position));
   }
  }
  }
  return {maxError:Math.max(...errors),minAlpha:Math.min(...alphas),frames:alphas.length,samples:errors.length};
 });
 expect(result.frames).toBe(1120);expect(result.samples).toBe(24);expect(result.minAlpha).toBe(255);expect(result.maxError).toBeLessThan(0.01);
});

test('ball stays at least ten CSS pixels and its surface keeps the logical projected center',async({page})=>{
 await open(page);
 const sizes=await page.evaluate(()=>{
  const v=pickleboard.threeD,result=[];
  for(const camera of ['overhead','sideline','behind-green','behind-orange']){
   v.setCamera(camera);
   for(const segment of v.timeline.segments.filter(s=>s.trajectory))for(const fraction of [0,0.25,0.5,1]){
    v.clock.elapsed=segment.startTime+segment.contactTime+segment.trajectory.totalDuration*fraction;v.applyAtTime(v.clock.elapsed);
    const center=v.ballObject.position.clone(),surface=v.readableBall.sprite.getWorldPosition(center.clone());
    const projected=center.clone().project(v.camera),surfaceProjected=surface.clone().project(v.camera);
    const depth=-center.clone().applyMatrix4(v.camera.matrixWorldInverse).z;
    const worldPerPixel=2*depth*Math.tan(v.camera.fov*Math.PI/360)/v.elements.canvas.clientHeight;
    result.push({diameter:v.readableBall.sprite.scale.x*12/16/worldPerPixel,drift:Math.hypot(projected.x-surfaceProjected.x,projected.y-surfaceProjected.y),x:projected.x,y:projected.y});
   }
  }return result;
 });
 for(const s of sizes){expect(s.diameter).toBeGreaterThanOrEqual(9.99);expect(s.drift).toBeLessThan(1e-9);expect(Math.abs(s.x)).toBeLessThan(1);expect(Math.abs(s.y)).toBeLessThan(1);/* Depth changes on the same ray; x/y remain fixed. */}
});

test('malformed pixel metadata fails before a canvas is allocated and retry succeeds',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 await page.route('**/assets/replay/metadata.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({version:2,directions:[],atlases:{}})}));
 await page.goto('/?workspace=planner');await page.waitForFunction(()=>window.pickleboard?.plays);await page.evaluate(()=>pickleboard.plays.load('third-shot-drop'));await page.locator('#play3dView').click();
 await expect(page.locator('#threeDLoadStatus')).toContainText('Your board is safe');await expect(page.locator('#threeDCanvas canvas')).toHaveCount(0);await expect(page.locator('#play3dView')).toBeEnabled();
 await page.unroute('**/assets/replay/metadata.json');await page.locator('#play3dView').click();await page.waitForFunction(()=>pickleboard.threeD.active);await expect(page.locator('#threeDCanvas canvas')).toHaveCount(1);await context.close();
});

test('context loss exits safely and replay can be opened again',async({page})=>{
 await open(page);await page.evaluate(()=>pickleboard.threeD.renderer.domElement.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
 await expect(page.locator('#threeDCanvas canvas')).toHaveCount(0);await expect(page.locator('#threeDLoadStatus')).toContainText('Graphics were interrupted');
 await page.locator('#play3dView').click();await page.waitForFunction(()=>pickleboard.threeD.active);await expect(page.locator('#threeDCanvas canvas')).toHaveCount(1);
});

test('fresh cached installation opens all four pixel actors fully offline',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'allow'}),page=await context.newPage();
 await page.goto('/?workspace=planner');await page.waitForFunction(()=>navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();
 await page.waitForFunction(()=>window.pickleboard?.plays);await page.evaluate(()=>pickleboard.plays.load('third-shot-drop'));await page.locator('#play3dView').click();await page.waitForFunction(()=>pickleboard.threeD.active);
 expect(await page.evaluate(()=>[...pickleboard.threeD.playerObjects.values()].filter(a=>a.userData.pixelActor&&a.userData.body.material.map.image.complete).length)).toBe(4);
 await page.locator('#threeDExit').click();await page.locator('#playExit').click();await expect(page.locator('#threeDCanvas canvas')).toHaveCount(0);await context.close();
});
