// Capture matching actual browser views of the accepted baseline and local candidate.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const browser = await chromium.launch();
const records = [];
try {
  for (const [name, url, revision] of [['before', 'http://127.0.0.1:4175', 'dd0c3fa'], ['after', 'http://127.0.0.1:4173', execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()]]) {
    const context = await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2,serviceWorkers:'block'});
    try {
      const page = await context.newPage();
      const output = `docs/rebrand/${name}`; mkdirSync(output,{recursive:true});
      await page.goto(url); await page.waitForFunction(()=>window.pickleboard?.threeD);
      await page.screenshot({animations:'disabled',path:`${output}/board.png`});
      await page.locator('#menuToggle').click(); await page.screenshot({animations:'disabled',path:`${output}/menu.png`});
      await page.locator('#menuClose').click(); await page.locator('#infoToggle').click();
      await page.screenshot({animations:'disabled',path:`${output}/help.png`}); await page.locator('#infoClose').click();
      await page.evaluate(()=>pickleboard.plays.load('serve-and-return'));
      await page.waitForFunction(()=>!document.querySelector('#playbackControls').hidden);
      await page.screenshot({animations:'disabled',path:`${output}/guided.png`});
      await page.locator('#play3dView').click();await page.waitForFunction(()=>pickleboard.threeD.active);
      await page.screenshot({animations:'disabled',path:`${output}/replay.png`});
      records.push({name,url,revision,actual:await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,title:document.title,time:pickleboard.threeD.clock.elapsed,camera:document.querySelector('#threeDCamera').value})),serviceWorkers:'blocked for fresh asset capture'});
    } finally {await context.close();}
  }
} finally {await browser.close();}
writeFileSync('docs/rebrand/capture-metadata.json',JSON.stringify({records,workingDiff:execFileSync('git',['diff','--stat'],{encoding:'utf8'})},null,2));
console.log(records);
