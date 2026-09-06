// Independent of browser offline emulation: stop only this owned local server.
import {createServer} from 'node:http';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium,webkit,expect} from '@playwright/test';
const results=[];
for(const [name,type]of[['chromium',chromium],['webkit',webkit]]){
 const server=createServer((request,response)=>{
  const pathname=new URL(request.url,'http://local').pathname;
  const file=pathname==='/'?'index.html':decodeURIComponent(pathname.slice(1));
  if(file.includes('..'))return response.writeHead(403).end();
  try{response.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.json':'application/json'})[extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(readFileSync(resolve(file)));}catch{response.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${server.address().port}`;
 const browser=await type.launch(),page=await browser.newPage();
 let stopped=false;
 try{
  await page.goto(url);await page.waitForFunction(()=>navigator.serviceWorker.controller&&window.pickleboard?.plays);
  server.closeAllConnections();await new Promise(r=>server.close(r));stopped=true;
  await page.reload();await page.waitForFunction(()=>window.pickleboard?.plays);
  const ids=await page.evaluate(()=>pickleboard.plays.list().map(p=>p.id));
  for(const id of ids){await page.evaluate(id=>pickleboard.plays.load(id),id);await page.locator('#play3dView').click();await page.waitForFunction(()=>pickleboard.threeD.active);await page.locator('#threeDExit').click();await page.locator('#playExit').click();}
  await expect(page.locator('#threeDCanvas canvas')).toHaveCount(0);
  results.push({browser:name,result:'PASS',lessons:ids.length,method:'owned HTTP server closed; browser setOffline not used'});
 }catch(error){results.push({browser:name,result:'FAIL',error:error.message,method:'owned HTTP server closed'});}
 finally{await browser.close();if(!stopped){server.closeAllConnections();await new Promise(r=>server.close(r));}}
}
writeFileSync(process.env.VERIFY_OUTPUT || 'docs/rebrand/network-offline.json',JSON.stringify(results,null,2));console.log(results);
if(results.some(r=>r.result==='FAIL'))process.exitCode=1;
