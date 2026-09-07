import { expect, test } from '@playwright/test';

const viewports=[[1440,900],[768,1024],[1024,768],[390,844],[844,390]];
const polygonArea=points=>Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0)/2);

async function audit(page){return page.evaluate(()=>{
 const svg=document.querySelector('#court'),matrix=svg.getScreenCTM(),p=PickleboardProjection;
 const screen=point=>{const v=p.courtToView(point);const q=new DOMPoint(v.x,v.y).matrixTransform(matrix);return{x:q.x,y:q.y};};
 const court=[[0,0],[20,0],[20,44],[0,44]].map(([x,y])=>screen({x,y}));
 const apron=[[-8,-8],[28,-8],[28,52],[-8,52]].map(([x,y])=>screen({x,y}));
 const box=id=>{const r=document.getElementById(id).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 return {name:p.name,court,apron,menu:box('menuToggle'),help:box('infoToggle'),svg:box('court')};
});}

for(const [width,height] of viewports)test(`court-first layout ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});await page.goto('/');await page.waitForFunction(()=>window.pickleboard?.plays);
 const a=await audit(page);expect(polygonArea(a.court)).toBeGreaterThan(width===1440?200000:1000);
 for(const point of a.apron){expect(point.x).toBeGreaterThanOrEqual(a.svg.x-1);expect(point.x).toBeLessThanOrEqual(a.svg.right+1);expect(point.y).toBeGreaterThanOrEqual(a.svg.y-1);expect(point.y).toBeLessThanOrEqual(a.svg.bottom+1);}
 for(const control of[a.menu,a.help]){expect(control.width).toBeGreaterThanOrEqual(44);expect(control.height).toBeGreaterThanOrEqual(44);expect(control.x).toBeGreaterThanOrEqual(0);expect(control.right).toBeLessThanOrEqual(width);expect(control.y).toBeGreaterThanOrEqual(0);expect(control.bottom).toBeLessThanOrEqual(height);}
});

test('resize preserves guided playback while controls remain operable',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.waitForFunction(()=>window.pickleboard?.plays);
 await page.evaluate(()=>{pickleboard.plays.load('serve-and-return');pickleboard.plays.session.seek(.5);pickleboard.plays.applyAtTime(.5);});
 const before=await page.evaluate(()=>({elapsed:pickleboard.plays.clock.elapsed,play:pickleboard.plays.activePlay.id}));
 await page.setViewportSize({width:844,height:390});await expect.poll(()=>page.evaluate(()=>PickleboardProjection.name)).toBe('wide');
 expect(await page.evaluate(()=>({elapsed:pickleboard.plays.clock.elapsed,play:pickleboard.plays.activePlay.id}))).toEqual(before);
 await page.locator('#infoToggle').click();await expect(page.locator('#infoClose')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#infoToggle')).toBeFocused();
 await page.locator('#menuToggle').click();await expect(page.locator('#menuClose')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#menuToggle')).toBeFocused();
});

test('200 percent text keeps border controls and help reachable',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.addStyleTag({content:'html{font-size:200%}'});
 for(const id of['menuToggle','infoToggle']){const r=await page.locator(`#${id}`).boundingBox();expect(r.width).toBeGreaterThanOrEqual(44);expect(r.height).toBeGreaterThanOrEqual(44);}
 await page.locator('#infoToggle').click();await expect(page.locator('#infoClose')).toBeVisible();
});
