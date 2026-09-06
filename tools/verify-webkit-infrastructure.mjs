// Isolated browser diagnostics. Serves no application code and deletes no caches.
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { webkit, expect } from '@playwright/test';
const worker = `self.addEventListener('install',event=>event.waitUntil((async()=>{const c=await caches.open('diagnostic-offline');await c.add('/offline');await self.skipWaiting()})()));self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));self.addEventListener('fetch',event=>event.respondWith(caches.match(event.request).then(r=>r||fetch(event.request))));`;
const server = createServer((req,res) => { const isWorker=req.url==='/diagnostic-sw.js';res.writeHead(200, {'Content-Type':isWorker?'text/javascript':'text/html','Cache-Control':'no-store'}).end(isWorker?worker:'<!doctype html><title>Isolated browser diagnostic</title>'); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await webkit.launch();let stopped=false;
const evidence={playwright:JSON.parse(readFileSync('node_modules/@playwright/test/package.json')).version,platform:process.platform,browserVersion:browser.version(),appCodeServed:false,cacheDeletionCodeServed:false};
try {
 const cacheContext=await browser.newContext(),cachePage=await cacheContext.newPage();
 await cachePage.goto(`${base}/seed`);
 await cachePage.evaluate(async()=>{const c=await caches.open('unrelated-application-cache');await c.put('/saved',new Response('keep me'));});
 const read=()=>cachePage.evaluate(async()=>{const r=await(await caches.open('unrelated-application-cache')).match('/saved');return r?await r.text():null});
 evidence.cacheSeed=await read();expect(evidence.cacheSeed).toBe('keep me');
 await cachePage.goto(`${base}/target`);evidence.cacheAfterNavigation=await read();await cacheContext.close();
 const offlineContext=await browser.newContext(),page=await offlineContext.newPage();await page.goto(`${base}/offline`);
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/diagnostic-sw.js');await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
 await offlineContext.setOffline(true);
 try {await page.reload();evidence.offlineSignature='unexpected pass';}catch(e){evidence.offlineSignature=e.message.split('\n')[0];}
 await offlineContext.setOffline(false);await page.goto(`${base}/offline`);
 server.closeAllConnections();await new Promise(r=>server.close(r));stopped=true;
 await page.reload();await expect(page).toHaveTitle('Isolated browser diagnostic');evidence.realOfflineWithoutEmulation=true;
 await offlineContext.close();
 evidence.result=evidence.cacheAfterNavigation===null&&evidence.offlineSignature==='page.reload: WebKit encountered an internal error'?'confirmed':'review required';
 mkdirSync('release-results',{recursive:true});writeFileSync('release-results/webkit-infrastructure.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
 if(evidence.result!=='confirmed')throw Error('WebKit infrastructure signature changed; review the exception instead of accepting it');
}finally{await browser.close();if(!stopped){server.closeAllConnections();await new Promise(r=>server.close(r))}}
