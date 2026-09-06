import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
const url=process.env.PREVIEW_URL||'http://127.0.0.1:4173';
const output=process.env.MEASURE_OUTPUT||'docs/second-pass/after';
const duration=Number(process.env.SAMPLE_MS||30000), runs=Number(process.env.RUNS||2);
mkdirSync(output,{recursive:true});
const headed=process.env.HEADED==='1';
const browser=await chromium.launch({headless:!headed});
const results=[];
for(const [name,width,height,dpr] of [['desktop',1440,900,2],['phone',390,844,2]]) {
 for(let run=1;run<=runs;run++) {
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr});
  await page.goto(url);await page.waitForFunction(()=>window.pickleboard?.threeD);await page.bringToFront();
  const idleIntervals=await page.evaluate(()=>new Promise(resolve=>{const values=[];let last=null;function frame(now){if(last!==null)values.push(now-last);last=now;if(values.length>=120)resolve(values);else requestAnimationFrame(frame);}requestAnimationFrame(frame);}));
  idleIntervals.sort((a,b)=>a-b);const idleCadence=idleIntervals[Math.floor(idleIntervals.length/2)];
  await page.evaluate(()=>pickleboard.plays.load('third-shot-drive'));
  await page.locator('#play3dView').click();await page.locator('#threeDCanvas canvas').waitFor();
  const result=await page.evaluate(async ({duration,idleCadence})=>{
   const v=pickleboard.threeD;
   const renderTimes=[],updateTimes=[],intervals=[];
   const originalRender=v.renderer.render.bind(v.renderer),originalUpdate=v.applyAtTime.bind(v);
   let recording=false;
   v.renderer.render=(...args)=>{const t=performance.now();const r=originalRender(...args);if(recording)renderTimes.push(performance.now()-t);return r;};
   v.applyAtTime=(...args)=>{const t=performance.now();const r=originalUpdate(...args);if(recording)updateTimes.push(performance.now()-t);return r;};
   v.togglePlay();
   await new Promise(resolve=>{const start=performance.now();function warm(now){if(v.clock.elapsed>=v.timeline.duration){v.restart();v.togglePlay();}if(now-start>=3000)resolve();else requestAnimationFrame(warm);}requestAnimationFrame(warm);});
   recording=true;
   await new Promise(resolve=>{let last=null,start=null;function sample(now){start??=now;if(last!==null)intervals.push(now-last);last=now;if(v.clock.elapsed>=v.timeline.duration){v.restart();v.togglePlay();}if(now-start>=duration)resolve();else requestAnimationFrame(sample);}requestAnimationFrame(sample);});
   recording=false;v.clock.pause();v.renderer.render=originalRender;v.applyAtTime=originalUpdate;
   const stats=a=>{const s=[...a].sort((a,b)=>a-b);return {count:s.length,median:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],p99:s[Math.floor(s.length*.99)]};};
   const bins={};for(const dt of intervals){const bin=Math.round(dt*2)/2;bins[bin]=(bins[bin]||0)+1;}
   const cadence=Number(Object.entries(bins).sort((a,b)=>b[1]-a[1])[0][0]);
   const canvas=v.renderer.domElement,box=canvas.getBoundingClientRect();
   const gl=v.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
   return {gpuRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),idleCadenceMs:idleCadence,missedIdleCadenceFraction:intervals.filter(dt=>dt>idleCadence*1.5).length/intervals.length,over60HzBudgetFraction:intervals.filter(dt=>dt>18.34).length/intervals.length,visibility:document.visibilityState,userAgent:navigator.userAgent,dpr:devicePixelRatio,canvasCSS:{width:box.width,height:box.height},drawingBuffer:{width:canvas.width,height:canvas.height},postprocessingTargets:'none',quality:{pixelScale:v.pixelScale,pixelRatio:v.renderer.getPixelRatio(),antialias:v.renderer.getContext().getContextAttributes().antialias},camera:v.cameraPreset,callbackIntervals:stats(intervals),observedModalInterval:cadence,missedModalCadenceFraction:intervals.filter(dt=>dt>cadence*1.5).length/intervals.length,renderFunctionMs:stats(renderTimes),updateFunctionMs:stats(updateTimes),calls:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles};
  },{duration,idleCadence});
  results.push({name,run,...result});console.log(JSON.stringify({name,run,...result}));await page.close();
 }
}
await browser.close();
writeFileSync(`${output}/cadence.json`,JSON.stringify({url,environment:{platform:os.platform(),release:os.release(),arch:os.arch()},browser:`Playwright Chromium ${headed?'headed':'headless'}; brought to foreground, no video/profiler capture`,warmupMs:3000,sampleMs:duration,limitation:'rAF callback cadence and CPU-side function durations do not prove physical display presentation or GPU time.',results},null,2));
