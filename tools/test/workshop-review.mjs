import {chromium} from '../image-code-build/.test-deps/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const context=await browser.newContext(),p=await context.newPage();
 await p.goto('http://127.0.0.1:8778/workshop.html');await p.waitForFunction(()=>document.querySelector('#code')?.value);
 await p.locator('#name').fill('保存中のA');await p.locator('#preview-run').click();await p.waitForFunction(()=>document.querySelector('#status')?.dataset.state==='ready');
 await p.evaluate(()=>{const digest=crypto.subtle.digest.bind(crypto.subtle);crypto.subtle.digest=async(...args)=>{await new Promise(r=>window.releaseDigest=()=>{crypto.subtle.digest=digest;r()});return digest(...args)}});
 await p.locator('#add-unfold').click();await p.waitForFunction(()=>window.releaseDigest);
 await p.locator('#new-draft').click();await p.locator('#name').fill('別の下書きB');
 const selected=await p.evaluate(()=>JSON.parse(localStorage.getItem('unfold-workshop-drafts-v1')).active);
 await p.evaluate(()=>{window.releaseDigest()});await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('追加しました'));
 const after=await p.evaluate(()=>JSON.parse(localStorage.getItem('unfold-workshop-drafts-v1')));
 assert.equal(after.active,selected,'pending save must not replace selected draft identity');assert.equal(after.drafts[selected].savedId,undefined);assert.equal(after.drafts[selected].name,'別の下書きB');
 console.log('save switch race PASS');
 const seq=await context.newPage();await seq.goto('http://127.0.0.1:8778/sequence.html?empty');await seq.waitForFunction(()=>window.unfoldSeq);
 await seq.evaluate(async()=>{
  const c=document.createElement('canvas');c.width=80;c.height=45;for(let i=0;i<3;i++)unfoldSeq.addSlide(c,String(i));
  const id='cm-workshop-collision',vertex='vec3 userMethod(vec2 p,float amount){return vec3(p,0.);}',old={id,name:'旧コード',vertex,status:'ok'};
  unfoldMethods.registerCustom(old);await unfoldMethods.persistence.flush();unfoldSeq.seq.transitions.forEach(t=>t.method=id);
  const {openStore}=await import('./method-library.js');await openStore().put({...old,vertex:'vec3 userMethod(vec2 p,float amount){return vec3(p,amount);}',createdAt:1});
  unfoldSeq.timelineApi.select({kind:'slide',i:0});const ch=new BroadcastChannel('unfold-workshop-library-v1');ch.postMessage({kind:'glsl',id});ch.close();
 });
 await seq.locator('#workshop-apply').click();assert.match(await seq.locator('#workshop-invitation').innerText(),/◆/);
 const original=await seq.evaluate(()=>unfoldMethods.listCustom().find(m=>m.id==='cm-workshop-collision').vertex);assert.ok(original.includes('0.'));
 await seq.evaluate(()=>unfoldSeq.timelineApi.select({kind:'tr',i:0}));await seq.locator('#workshop-apply').click();await seq.locator('#workshop-invitation').waitFor({state:'detached'});
 const result=await seq.evaluate(()=>({ids:unfoldSeq.seq.transitions.map(t=>t.method),methods:unfoldMethods.listCustom()}));
 assert.notEqual(result.ids[0],result.ids[1],'updated method must get an isolated identity');assert.equal(result.methods.find(m=>m.id===result.ids[1]).vertex,original);
 await seq.evaluate(()=>unfoldSeq.undo());assert.equal(await seq.evaluate(()=>unfoldSeq.seq.transitions[0].method),'cm-workshop-collision');
 console.log('method collision, invalid selection and undo PASS');
 const versions=await p.evaluate(async()=>{
  const {addWorkshopItem}=await import('./workshop-library.js'),{openStore}=await import('./method-library.js');
  const a=await addWorkshopItem({kind:'glsl',name:'versioned',source:'vec3 userMethod(vec2 p,float amount){return vec3(p,0.);}'});
  const b=await addWorkshopItem({kind:'glsl',savedId:a.id,name:'versioned',source:'vec3 userMethod(vec2 p,float amount){return vec3(p,amount);}'});
  const records=await openStore().list();return {a,b,old:records.find(m=>m.id===a.id),fresh:records.find(m=>m.id===b.id)};
 });
 assert.notEqual(versions.a.id,versions.b.id,'editing source must preserve old persisted definitions');
 assert.ok(versions.old.vertex.includes('0.'));assert.ok(versions.fresh.vertex.includes('amount);'));
 console.log('immutable saved method versions PASS');
 await p.locator('#preview-run').click();await p.waitForFunction(()=>document.querySelector('#status')?.dataset.state==='ready');
 const activeBeforeFailure=await p.evaluate(()=>JSON.parse(localStorage.getItem('unfold-workshop-drafts-v1')).active);
 await p.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='methods')throw new DOMException('Storage full','QuotaExceededError');return put.apply(this,args)}});
 await p.locator('#add-unfold').click();await p.waitForFunction(()=>document.querySelector('#status')?.dataset.state==='error');
 assert.match(await p.locator('#status').innerText(),/Storage full/);assert.equal(await p.locator('#handoff').isVisible(),false);
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('unfold-workshop-drafts-v1')).active),activeBeforeFailure);
 console.log('storage failure preserves draft and does not claim success PASS');
}finally{await browser.close()}
