import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(new URL('../../.worktrees/method-workshop/tools/image-code-build/.test-deps/node_modules/playwright-core/index.mjs',import.meta.url));
const base=(process.env.UNFOLD_BASE_URL||'http://127.0.0.1:8780/').replace(/\/?$/,'/');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const out=(process.env.UNFOLD_TEST_OUT||new URL('../out/workshop-collection/integration/',import.meta.url).pathname).replace(/\/?$/,'/');await mkdir(out,{recursive:true});
const errors=[],checks=[];
try{
 const context=await browser.newContext({viewport:{width:1360,height:960}});
 await context.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
 await context.addInitScript(()=>{window.returnedFrames=0;const Original=MessageChannel;window.MessageChannel=class extends Original{constructor(){super();this.port1.addEventListener('message',e=>{if(e.data?.bitmap instanceof ImageBitmap)window.returnedFrames++})}}});
 const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('crash',()=>errors.push('page crash'));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())})};
 const p=await context.newPage();watch(p);await p.goto(base+'workshop.html');await p.waitForFunction(()=>document.querySelector('main')&&!document.querySelector('main').inert);
 await p.locator('[data-kind="image"]').click();assert.equal(await p.locator('[data-card^="sample:image:"] img').count(),8);
 await p.locator('[data-card="sample:image:3"] img').evaluate(i=>i.decode());
 const items=await p.evaluate(async()=>{const {WORKSHOP_EXAMPLES}=await import('./workshop-examples.js'),{addWorkshopItem}=await import('./workshop-library.js');const out=[];for(const d of WORKSHOP_EXAMPLES.filter(d=>d.kind==='image')){const r=await addWorkshopItem(d);out.push({id:r.id,name:d.name})}return out});
 // Confirm selecting actual saved blocks in the single-image application uses the surface renderer.
 for(const item of items){
  const main=await context.newPage();watch(main);await main.goto(base+'?workshopMethod='+item.id);await main.waitForFunction(()=>window.unfold);
  await main.locator('#workshop-apply').click();await main.waitForFunction(id=>unfold.state.method===id,item.id);
  assert.equal(await main.locator('#image-solid').isChecked(),false);const frames=await main.evaluate(()=>{unfold.state.playing=false;return returnedFrames});await main.evaluate(()=>unfold.setTime(.3));await main.waitForFunction(n=>returnedFrames>n,frames,{timeout:30000});checks.push('single:'+item.name);await main.close();
 }
 // All eight methods also run in sequence transitions with the same shape-none setting.
 const seq=await context.newPage();watch(seq);await seq.goto(base+'sequence.html?empty&workshopMethod='+items[0].id);await seq.waitForFunction(()=>window.unfoldSeq);
 await seq.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=180;const x=c.getContext('2d');x.fillStyle='#78ddff';x.fillRect(0,0,320,180);x.fillStyle='#d9f878';x.fillRect(0,0,160,90);unfoldSeq.addSlide(c,'A');unfoldSeq.addSlide(c,'B');unfoldSeq.seq.slides.forEach(s=>s.hold=0);unfoldSeq.seq.bpm=120;const tr=unfoldSeq.seq.transitions[0];tr.shape='sphere';tr.beats=12;tr.flow='return';unfoldSeq.timelineApi.select({kind:'tr',i:0});});
 for(const item of items){
  await seq.evaluate(id=>{const c=new BroadcastChannel('unfold-workshop-library-v1');c.postMessage({kind:'image',id});c.close()},item.id);
  await seq.locator('#workshop-apply').click();await seq.waitForFunction(id=>unfoldSeq.seq.transitions[0].method===id,item.id);
  const frames=await seq.evaluate(()=>returnedFrames);await seq.evaluate(()=>unfoldSeq.renderAt(1.8));await seq.waitForFunction(n=>returnedFrames>n,frames,{timeout:30000});assert.equal(await seq.evaluate(()=>unfoldSeq.seq.transitions[0].shape),'none');checks.push('sequence:'+item.name);
 }
 await seq.close();await p.bringToFront();await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:out+'mobile.png'});
 assert.deepEqual(errors,[]);await writeFile(out+'integration.json',JSON.stringify({checks,errors},null,2));console.log(checks.join('\n'));console.log('8 application handoffs / worker renders, static previews and mobile layout PASS');
}finally{await browser.close()}
