// Real worker upgrade: same origin, old committed shell -> current files -> offline.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
const checkpoint = process.env.BASELINE_REVISION || 'd5ccf88';
const root = process.cwd();
let phase = 'old';
const server = createServer((request,response) => {
 const path = new URL(request.url,'http://local').pathname === '/' ? 'index.html' : decodeURIComponent(new URL(request.url,'http://local').pathname.slice(1));
 if(path.includes('..')) {response.writeHead(403).end();return;}
 try {
  const data = phase === 'old' ? execFileSync('git',['show',`${checkpoint}:${path}`],{stdio:['ignore','pipe','ignore'],maxBuffer:8*1024*1024}) : readFileSync(resolve(root,path));
  response.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.json':'application/json'})[extname(path)] || 'application/octet-stream','Cache-Control':'no-store'}).end(data);
 } catch { response.writeHead(404).end(); }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();
try {
 const context=await browser.newContext();const page=await context.newPage();
 await page.goto(origin);await page.waitForFunction(()=>navigator.serviceWorker.controller);
 const before=await page.evaluate(()=>caches.keys());
 if(!before.includes('pickleboard-static-v13'))throw Error(`Expected actual v13 install, got ${before}`);
 await page.evaluate(async()=>{const other=await caches.open('unrelated-application-cache');await other.put('/keep',new Response('preserve'));});
 phase='new';
 await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;await r.update();});
 // An async waitForFunction predicate can finish with false without re-polling
 // in the installed runtime. Poll resolved cache state before inspecting hashes.
 await expect.poll(()=>page.evaluate(()=>caches.keys()),{timeout:10000}).toEqual(expect.arrayContaining(['pickleboard-static-v14']));
 await expect.poll(()=>page.evaluate(()=>caches.keys()),{timeout:10000}).not.toEqual(expect.arrayContaining(['pickleboard-static-v13']));
 const files=['three-d-core.js','three-d-presentation.js','guided-plays.js','coaching-ui.js','park-layout.js','play-catalog.js','court-geometry.js','coaching-session.js','guided-pixel-actors.js','pixel-actor-assets.js','park-scene.js','assets/park/tree.png','assets/park/quiet-court.png','visual-theme.js','board-projection.js','three-d-pixel-actors.js','three-d-ball.js','assets/replay/metadata.json','assets/replay/green-right-front-body.png','styles.css','three-d-loader.js','three-d-playback.js','assets/players/green-right-handed.png'];
 await expect.poll(()=>page.evaluate(async files=>{const cache=await caches.open('pickleboard-static-v14');return (await Promise.all(files.map(file=>cache.match(new URL('/'+file,location.origin).href)))).filter(Boolean).length;},files),{timeout:10000}).toBe(files.length);
 await page.reload();await page.waitForFunction(()=>window.PICKLEBOARD_VISUAL&&window.pickleboard?.threeD);
 const hashes=await page.evaluate(async files=>{const cache=await caches.open('pickleboard-static-v14');return Object.fromEntries(await Promise.all(files.map(async file=>{const response=await cache.match(new URL('/'+file, location.origin).href);if(!response)throw Error('Missing '+file+' at '+location.href+' base '+document.baseURI+'; keys '+JSON.stringify((await cache.keys()).map(r=>r.url)));return [file,Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await response.arrayBuffer())))];})));},files);
 for(const [file,bytes] of Object.entries(hashes)){const actual=Buffer.from(bytes).toString('hex');const expected=createHash('sha256').update(readFileSync(file)).digest('hex');if(actual!==expected)throw Error(`Mixed stale asset: ${file}`);}
 await context.setOffline(true);await page.reload();await page.waitForFunction(()=>pickleboard?.threeD);
 for(const id of await page.evaluate(()=>pickleboard.plays.list().map(p=>p.id))){
  await page.evaluate(id=>pickleboard.plays.load(id),id);await page.locator('#play3dView').click();await page.locator('#threeDCanvas canvas').waitFor();
  await page.locator('#threeDLoop').click();await page.locator('#threeDExit').click();await page.locator('#playExit').click();
 }
 const unrelated=await page.evaluate(async()=>{const c=await caches.open('unrelated-application-cache');return (await c.match('/keep')).text();});
 if(unrelated!=='preserve')throw Error('Unrelated cache changed');
 const result={checkpoint,origin,result:'PASS: actual v13 worker upgraded to v14; current visual asset hashes match; offline editor and 3D round trip succeeded; unrelated cache preserved'};
 writeFileSync('docs/park-coaching/upgrade.json',JSON.stringify(result,null,2));console.log(result);
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
