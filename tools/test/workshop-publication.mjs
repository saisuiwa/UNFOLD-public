// Publication verification uses an isolated browser profile and only synthetic inputs.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dependency=new URL('../../.worktrees/method-workshop/tools/image-code-build/.test-deps/node_modules/playwright-core/index.mjs',import.meta.url);
const {chromium}=await import(dependency);
const base=process.env.UNFOLD_BASE_URL||'https://unfold.saisuiwa.com/';
const out=(process.env.UNFOLD_RELEASE_DIR||new URL('../../releases/unfold-workshop-2026-10-06/',import.meta.url).pathname).replace(/\/?$/,'/');
const manifest=JSON.parse(await readFile(out+'manifest.json','utf8'));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const report={url:base,commit:manifest.commit,errors:[],renderers:[],handoff:[]};
try{
 const context=await browser.newContext({viewport:{width:1500,height:1000}});
 await context.addInitScript(()=>{window.returnedFrames=0;const Original=MessageChannel;window.MessageChannel=class extends Original{constructor(){super();this.port1.addEventListener('message',e=>{if(e.data?.bitmap instanceof ImageBitmap)window.returnedFrames++})}}});
 const watch=p=>{p.on('pageerror',e=>report.errors.push(e.message));p.on('crash',()=>report.errors.push('Page crashed'))};
 const p=await context.newPage();watch(p);await p.goto(new URL('workshop.html',base).href);await p.waitForFunction(()=>document.querySelector('#code')?.value);
 report.workshopURL=p.url();
 const files=await p.evaluate(async entries=>{
  let cursor=0;const results=[];
  await Promise.all(Array.from({length:8},async()=>{while(cursor<entries.length){const [path,expected]=entries[cursor++];try{const response=await fetch(new URL(path,location.origin+'/'),{cache:'reload'}),data=await response.arrayBuffer();const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(v=>v.toString(16).padStart(2,'0')).join(''),type=response.headers.get('content-type')||'';const mimeOK=path.endsWith('.js')?/javascript/.test(type):path.endsWith('.css')?/text\/css/.test(type):path.endsWith('.html')?/text\/html/.test(type):true;results.push({path,status:response.status,bytes:data.byteLength,sha256,content_type:type,ok:response.ok&&sha256===expected.sha256&&mimeOK});}catch(e){results.push({path,ok:false,error:e.message})}}}));return results;
 },Object.entries(manifest.files).filter(([path])=>path!=='_headers'));
 const delivery={url:base,commit:manifest.commit,transport:'Chrome fetch',checked:files.length,passed:files.filter(x=>x.ok).length,failed:files.filter(x=>!x.ok),files};
 await writeFile(out+'published-verification.json',JSON.stringify(delivery,null,2));assert.deepEqual(delivery.failed,[]);console.log('Public assets match: '+delivery.passed);
 const ready=async()=>{await p.waitForFunction(()=>['ready','error'].includes(document.querySelector('#status')?.dataset.state),null,{timeout:60000});assert.equal(await p.locator('#status').getAttribute('data-state'),'ready',await p.locator('#status').innerText())};
 const pixelHash=()=>p.locator('#preview-host canvas').evaluate(canvas=>{const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;const x=c.getContext('2d');x.drawImage(canvas,0,0);let h=0,visible=0;const bytes=x.getImageData(0,0,c.width,c.height).data;for(let i=0;i<bytes.length;i++){h=Math.imul(h^bytes[i],16777619);if(i%4===0&&bytes[i]+bytes[i+1]+bytes[i+2]>180)visible++;}return {h,visible}});
 const ids={};
 for(const kind of ['glsl','image','text']){
  await p.locator('[data-kind='+kind+']').click();assert.equal(await p.locator('iframe').count(),0);
  await p.locator('[data-card^="sample:'+kind+':"]').first().click();await ready();await p.locator('#preview-play').click();
  await p.locator('#time').fill('0');await p.waitForFunction(()=>document.querySelector('#clock').textContent.startsWith('0.00'));const start=await pixelHash();
  await p.locator('#time').fill('3');await p.waitForFunction(()=>document.querySelector('#clock').textContent.startsWith('3.00'));const end=await pixelHash();assert.notEqual(start.h,end.h);assert.ok(start.visible>50||end.visible>50);
  await p.locator('#name').fill('公開確認 '+kind);await p.locator('#add-unfold').click();await p.locator('#handoff').waitFor();
  const href=await p.locator('#open-sequence').getAttribute('href');ids[kind]=new URL(href,base).searchParams.get(kind==='text'?'workshopMotion':'workshopMethod');assert.ok(ids[kind]);
  report.renderers.push({kind,thumbnail:await p.locator('[data-card="saved:'+ids[kind]+'"] img').count()===1,actualMovement:true,saved:true});
  await p.screenshot({path:out+'published-'+kind+'.png'});await p.reload();await p.waitForFunction(()=>document.querySelector('#code')?.value);assert.equal(await p.locator('#name').inputValue(),'公開確認 '+kind);assert.equal(await p.locator('iframe').count(),0);
 }
 report.persisted=await p.evaluate(async()=>{const {openStore}=await import('./method-library.js'),{createMotionLibrary}=await import('./lyric-library.js');return {methods:(await openStore().list()).length,motions:createMotionLibrary().list().length}});assert.deepEqual(report.persisted,{methods:2,motions:1});
 console.log('Three renderers, thumbnails and saved drafts PASS');
 const main=await context.newPage();watch(main);
 for(const kind of ['glsl','image']){
  await main.goto(new URL('?workshopMethod='+ids[kind],base).href);await main.waitForFunction(()=>window.unfold);await main.locator('#workshop-apply').click();await main.waitForFunction(id=>unfold.state.method===id,ids[kind]);
  await main.evaluate(()=>{unfold.state.playing=false;unfold.setTime(.5)});if(kind==='image')await main.waitForFunction(()=>returnedFrames>0,null,{timeout:60000});report.handoff.push('single:'+kind);
 }
 await main.screenshot({path:out+'published-single.png'});await main.close();
 const seq=await context.newPage();watch(seq);await seq.goto(new URL('sequence.html?empty&workshopMethod='+ids.image,base).href);await seq.waitForFunction(()=>window.unfoldSeq);
 await seq.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=180;const x=c.getContext('2d');x.fillStyle='#78ddff';x.fillRect(0,0,320,180);x.fillStyle='#d9f878';x.fillRect(0,0,160,90);unfoldSeq.addSlide(c,'確認A');unfoldSeq.addSlide(c,'確認B');unfoldSeq.seq.slides.forEach(s=>s.hold=0);unfoldSeq.seq.bpm=120;unfoldSeq.timelineApi.select({kind:'tr',i:0});});
 const before=await seq.evaluate(()=>unfoldSeq.seq.transitions[0].method);await seq.locator('#workshop-apply').click();await seq.waitForFunction(id=>unfoldSeq.seq.transitions[0].method===id,ids.image);await seq.evaluate(()=>unfoldSeq.renderAt(2));await seq.waitForFunction(()=>returnedFrames>0,null,{timeout:60000});await seq.evaluate(()=>unfoldSeq.undo());assert.equal(await seq.evaluate(()=>unfoldSeq.seq.transitions[0].method),before);report.handoff.push('sequence:image:undo');
 await seq.evaluate(async id=>{await unfoldSeq.lyricAction({type:'text',value:'かたちをほどいて\n自由に。'});unfoldSeq.timelineApi.select({kind:'lyric',i:0});const c=new BroadcastChannel('unfold-workshop-library-v1');c.postMessage({kind:'text',id});c.close()},ids.text);
 await seq.locator('#workshop-apply').click();await seq.waitForFunction(()=>unfoldSeq.seq.lyricDocument.events.find(e=>e.kind==='line')?.motion?.code);const frames=await seq.evaluate(()=>returnedFrames);await seq.evaluate(()=>unfoldSeq.renderAt(1));await seq.waitForFunction(n=>returnedFrames>n,frames,{timeout:60000});await seq.screenshot({path:out+'published-sequence-text.png'});await seq.evaluate(()=>unfoldSeq.undo());assert.ok(!await seq.evaluate(()=>unfoldSeq.seq.lyricDocument.events.find(e=>e.kind==='line')?.motion?.code));report.handoff.push('sequence:text:undo');
 await seq.close();await p.bringToFront();await p.setViewportSize({width:390,height:844});await p.locator('[data-kind=glsl]').click();await p.locator('[data-card^="sample:glsl:"]').first().click();await ready();await p.locator('#preview-play').click();await p.locator('.stage').scrollIntoViewIfNeeded();await p.screenshot({path:out+'published-mobile-preview.png'});await p.locator('.editor').scrollIntoViewIfNeeded();await p.screenshot({path:out+'published-mobile-editor.png'});
 report.mobile=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert.ok(report.mobile.scrollWidth<=report.mobile.width);assert.deepEqual(report.errors,[]);
 report.ids=ids;await writeFile(out+'published-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){report.failure=e.message;await writeFile(out+'published-browser.json',JSON.stringify(report,null,2));throw e}finally{await browser.close()}
