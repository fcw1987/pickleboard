import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
test.use({launchOptions:process.env.IPHONE_RECORD?{slowMo:120}:{}});
const open=async page=>{await page.goto('/');await page.waitForFunction(()=>window.playBuilder&&!playBuilder.busy&&playBuilder.courtTools.THREE);};
const edit=async page=>{const b=page.getByRole('button',{name:'Edit shot',exact:true});if(await b.isVisible())await b.click();};
const details=async page=>{await edit(page);const summary=page.locator('.builder-shot-details > summary');if(!await summary.evaluate(n=>n.parentElement.open))await summary.click();};
const finish=async page=>{await page.locator('[data-action=collapse-inspector]').click();};
const field=async(page,name,value)=>{await page.getByLabel(name,{exact:true}).fill(String(value));await page.getByLabel(name,{exact:true}).press('Enter');};
const menu=async(page,label)=>page.locator('.builder-menu summary').filter({hasText:new RegExp(`^${label}$`)}).click();

test('complete portrait custom rally and detailed movement survive views, reload, lessons and planner',async({browser})=>{
 const record=process.env.IPHONE_RECORD; if(record)await mkdir(record,{recursive:true});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:2,...(record?{recordVideo:{dir:record,size:{width:390,height:844}}}:{})});
 const page=await context.newPage();await open(page);await field(page,'Play title','Phone custom rally');
 await edit(page);await page.getByRole('button',{name:'Place target on court',exact:true}).click();
 const target=await page.evaluate(()=>playBuilder.courtTools.project({x:6,y:37}));await page.touchscreen.tap(target.x,target.y);const exactTarget=await page.evaluate(()=>structuredClone(playBuilder.selectedShot.target));
 await page.getByRole('button',{name:'2. Return',exact:true}).click();await page.getByLabel('Flight',{exact:true}).selectOption('high/soft');
 await page.getByRole('button',{name:'3. Drop',exact:true}).click();await page.getByLabel('Shot family',{exact:true}).selectOption('drive');
 await page.getByRole('button',{name:'+ Add shot',exact:true}).click();await page.getByLabel('Shot family',{exact:true}).selectOption('drop');
 expect(await page.evaluate(()=>playBuilder.compiled.validShotCount)).toBe(4);
 await finish(page);await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(()=>page.evaluate(()=>playBuilder.session.clock.elapsed)).toBeGreaterThan(.7);await page.getByRole('button',{name:'Pause',exact:true}).click();
 const paused=await page.evaluate(()=>playBuilder.session.clock.elapsed);await page.getByRole('button',{name:'2D',exact:true}).click();expect(await page.evaluate(()=>playBuilder.session.clock.elapsed)).toBe(paused);
 await page.getByRole('button',{name:'3D',exact:true}).click();await page.waitForFunction(()=>!playBuilder.busy);
 await page.getByRole('button',{name:'1. Serve',exact:true}).click();await details(page);
 await page.getByLabel('Moving player',{exact:true}).selectOption('player2');await field(page,'Manual X',7.25);await field(page,'Manual Y',4);
 expect(await page.evaluate(()=>playBuilder.selectedShot.playerMovement.player2.target)).toEqual({x:7.25,y:4});
 await page.getByRole('button',{name:'Place movement on court',exact:true}).click();await expect(page.getByRole('button',{name:'Cancel movement',exact:true})).toBeVisible();
 const pin=await page.evaluate(()=>playBuilder.courtTools.project({x:7,y:4}));await page.touchscreen.tap(pin.x,pin.y);
 const exactPin=await page.evaluate(()=>structuredClone(playBuilder.selectedShot.playerMovement.player2));
 await page.getByRole('checkbox',{name:'Auto Shading',exact:true}).check();await page.getByRole('checkbox',{name:'Coverage Guides',exact:true}).check();
 await page.getByRole('button',{name:'Undo authored edit',exact:true}).click();await page.getByRole('button',{name:'Redo authored edit',exact:true}).click();
 const saved=await page.evaluate(()=>structuredClone(playBuilder.document));expect(saved.shots[0].target).toEqual(exactTarget);expect(saved.shots[0].playerMovement.player2).toEqual(exactPin);expect(saved.shots.length).toBe(4);
 if(record){await page.screenshot({path:`${record}/custom-phone.png`});await import('node:fs/promises').then(fs=>fs.writeFile(`${record}/custom-play.json`,JSON.stringify(saved,null,2)+'\n'));}
 await page.reload();await page.waitForFunction(()=>window.playBuilder&&!playBuilder.busy);expect(await page.evaluate(()=>playBuilder.document)).toEqual(saved);
 await menu(page,'Plays');await page.getByRole('button',{name:'Learn',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Serve & Return',exact:true}).click();
 await menu(page,'File');await page.getByRole('button',{name:'Open',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Phone custom rally',exact:true}).click();expect(await page.evaluate(()=>playBuilder.document)).toEqual(saved);
 await menu(page,'Plays');await page.getByRole('button',{name:'Planner',exact:true}).click();await page.getByRole('button',{name:'Return to builder',exact:true}).click();await page.waitForFunction(()=>!playBuilder.busy);expect(await page.evaluate(()=>playBuilder.document)).toEqual(saved);
 const video=page.video();await context.close();if(record)await video.saveAs(`${record}/phone-authoring.webm`);
});

test('invalid numeric edits and import remain recoverable inside the phone controls',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);await details(page);const target=await page.evaluate(()=>structuredClone(playBuilder.selectedShot.target));
 await field(page,'Target width','');expect(await page.evaluate(()=>playBuilder.selectedShot.target)).toEqual(target);await expect(page.getByLabel('Target width',{exact:true})).toHaveAttribute('aria-invalid','true');await page.getByLabel('Target width',{exact:true}).press('Escape');await expect(page.getByLabel('Target width',{exact:true})).toHaveValue(String(target.x));
 await field(page,'Target width',6.125);expect(await page.evaluate(()=>playBuilder.selectedShot.target.x)).toBe(6.125);
 await finish(page);await menu(page,'File');await page.getByRole('button',{name:'Import / Export',exact:true}).click();await page.getByLabel('JSON backup').fill('{broken');await page.getByRole('button',{name:'Import JSON',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByLabel('JSON backup')).toHaveValue('{broken');await expect(page.locator('.builder-import-status')).toContainText('malformed');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export current play',exact:true}).click();await download;await expect(page.getByLabel('JSON backup')).toHaveValue(/schemaVersion/);await page.getByRole('button',{name:'Close',exact:true}).click();
});

test('resizing, themes and keyboard-height simulation preserve detailed authored values',async({page})=>{
 await open(page);await page.evaluate(()=>playBuilder.action('editMovement',{player:'player2',field:'target',value:{x:7.25,y:4}}));const before=await page.evaluate(()=>JSON.stringify(playBuilder.document));
 for(const [width,height]of [[390,844],[390,470],[844,390],[768,1024],[1024,768],[680,900],[1440,900]]){await page.setViewportSize({width,height});await page.evaluate(()=>{document.body.dataset.theme='dark';});await details(page);await field(page,'Target width',5);await finish(page);await page.getByRole('button',{name:'2D',exact:true}).click();await page.getByRole('button',{name:'3D',exact:true}).click();await page.waitForFunction(()=>!playBuilder.busy);expect(await page.evaluate(()=>JSON.stringify(playBuilder.document))).toBe(before);}
});
