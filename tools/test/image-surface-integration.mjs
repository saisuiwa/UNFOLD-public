import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(new URL('../../.worktrees/method-workshop/tools/image-code-build/.test-deps/node_modules/playwright-core/index.mjs',import.meta.url));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[],checks=[];
try{
 const context=await browser.newContext({viewport:{width:1360,height:960}});
 await context.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
 await context.addInitScript(()=>{window.returnedFrames=0;const Original=MessageChannel;window.MessageChannel=class extends Original{constructor(){super();this.port1.addEventListener('message',e=>{if(e.data?.bitmap instanceof ImageBitmap)window.returnedFrames++})}}});
 const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('crash',()=>errors.push('page crash'));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())})};
 const p=await context.newPage();watch(p);await p.goto('http://127.0.0.1:8779/workshop.html');await p.waitForFunction(()=>document.querySelector('main')&&!document.querySelector('main').inert);
 await p.locator('[data-kind="image"]').click();assert.equal(await p.locator('[data-card^="sample:image:"] img').count(),8);
 await p.locator('[data-card="sample:image:3"] img').evaluate(i=>i.decode());
 const items=await p.evaluate(async()=>{const {SURFACE_METHOD_PRESETS}=await import('./image-surface-presets.js'),{addWorkshopItem}=await import('./workshop-library.js');const out=[];for(const x of SURFACE_METHOD_PRESETS){const r=await addWorkshopItem({kind:'image',name:x.name,source:x.code.source,params:x.code.params});out.push({id:r.id,name:x.name})}return out});
 // Confirm selecting actual saved blocks in the single-image application uses the surface renderer.
 for(const item of items){
  const main=await context.newPage();watch(main);await main.goto('http://127.0.0.1:8779/?workshopMethod='+item.id);await main.waitForFunction(()=>window.unfold);
  await main.locator('#workshop-apply').click();await main.waitForFunction(id=>unfold.state.method===id,item.id);
  await main.locator('#image-solid').uncheck();const frames=await main.evaluate(()=>{unfold.state.playing=false;return returnedFrames});await main.evaluate(()=>unfold.setTime(.3));await main.waitForFunction(n=>returnedFrames>n,frames,{timeout:30000});checks.push('single:'+item.name);await main.close();
 }
 // All eight methods also run in sequence transitions with the same shape-none setting.
 const seq=await context.newPage();watch(seq);await seq.goto('http://127.0.0.1:8779/sequence.html?empty&workshopMethod='+items[0].id);await seq.waitForFunction(()=>window.unfoldSeq);
 await seq.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=180;const x=c.getContext('2d');x.fillStyle='#78ddff';x.fillRect(0,0,320,180);x.fillStyle='#d9f878';x.fillRect(0,0,160,90);unfoldSeq.addSlide(c,'A');unfoldSeq.addSlide(c,'B');unfoldSeq.seq.slides.forEach(s=>s.hold=0);unfoldSeq.seq.bpm=120;const tr=unfoldSeq.seq.transitions[0];tr.shape='none';tr.beats=12;tr.flow='return';unfoldSeq.timelineApi.select({kind:'tr',i:0});});
 for(const item of items){
  await seq.evaluate(id=>{const c=new BroadcastChannel('unfold-workshop-library-v1');c.postMessage({kind:'image',id});c.close()},item.id);
  await seq.locator('#workshop-apply').click();await seq.waitForFunction(id=>unfoldSeq.seq.transitions[0].method===id,item.id);
  const frames=await seq.evaluate(()=>returnedFrames);await seq.evaluate(()=>unfoldSeq.renderAt(1.8));await seq.waitForFunction(n=>returnedFrames>n,frames,{timeout:30000});assert.equal(await seq.evaluate(()=>unfoldSeq.seq.transitions[0].shape),'none');checks.push('sequence:'+item.name);
 }
 await seq.close();await p.bringToFront();await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:new URL('../out/surface-study/mobile.png',import.meta.url).pathname});
 assert.deepEqual(errors,[]);await writeFile(new URL('../out/surface-study/integration.json',import.meta.url),JSON.stringify({checks,errors},null,2));console.log(checks.join('\n'));console.log('16 application handoffs / worker renders, static previews and mobile layout PASS');
}finally{await browser.close()}
