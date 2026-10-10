import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(new URL('../../.worktrees/method-workshop/tools/image-code-build/.test-deps/node_modules/playwright-core/index.mjs',import.meta.url));
const base=process.env.UNFOLD_BASE_URL||'http://127.0.0.1:8780/';
const out=fileURLToPath(new URL('../out/workshop-collection/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1050}}),p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('crash',()=>errors.push('crash'));
 await p.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
 await p.goto(base+'workshop.html');await p.waitForFunction(()=>!document.querySelector('main').inert);
 await p.locator('#code').fill('vec3 userMethod(vec2 p,float amount){return vec3(p,amount);}');
 await p.locator('[data-kind=image]').click();assert.equal(await p.locator('[data-card^="sample:collection:"]').count(),4,'all four surface cards');
 const examples=await p.evaluate(async()=>(await import('./workshop-examples.js')).WORKSHOP_EXAMPLES);
 for(const item of examples){
  await p.locator('[data-kind='+item.kind+']').click();await p.locator('[data-card="'+item.key+'"]').click();
  await p.waitForFunction(()=>['ready','error'].includes(document.querySelector('#status').dataset.state),null,{timeout:60000});
  assert.equal(await p.locator('#status').getAttribute('data-state'),'ready',item.name+': '+await p.locator('#status').innerText());
  if(item===examples[0]){await p.locator('#strength').fill('0.4');assert.equal(await p.locator('#reset-sample').isVisible(),true,'strength-only edits can be reset');p.once('dialog',d=>d.accept());await p.locator('#reset-sample').click();await p.waitForFunction(()=>document.querySelector('#status').dataset.state==='ready');assert.equal(await p.locator('#strength').inputValue(),'0.8');}
  assert.equal(await p.locator('#name').inputValue(),item.name);if(item.kind==='image')assert.equal(await p.locator('#shape').inputValue(),'none');
  await p.locator('#time').fill('2.7');await p.waitForFunction(()=>document.querySelector('#clock').textContent.startsWith('2.70'));
  await p.locator('#preview-host').screenshot({path:out+item.key.split(':').at(-1)+'.png'});console.log('RENDER',item.name);
 }
 await p.locator('[data-kind=glsl]').click();assert.match(await p.locator('#code').inputValue(),/return vec3\(p,amount\)/);

 // Read failures and cancellation must leave the active revision untouched.
 const before=await p.locator('#code').inputValue();
 const upload=(name,text)=>p.locator('#file-import').setInputFiles({name,mimeType:'text/plain',buffer:Buffer.from(text)});
 await upload('manifest.json','{"checks":[]}');await p.waitForFunction(()=>document.querySelector('#status').dataset.state==='error');assert.match(await p.locator('#status').innerText(),/検証/);assert.equal(await p.locator('#code').inputValue(),before);
 await upload('壊れた.js','const = ;');await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('構文'));assert.equal(await p.locator('#code').inputValue(),before);
 await upload('未知の動き.js','return {update(t){}};');await p.locator('#js-import-dialog').waitFor();await p.getByRole('button',{name:'キャンセル',exact:true}).click();assert.equal(await p.locator('#code').inputValue(),before);
 await upload('未知の動き.js','return {update(t){}};');await p.locator('#js-import-kind').selectOption('text');await p.getByRole('button',{name:'下書きに読み込む',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#name').value==='未知の動き');assert.equal(await p.locator('#name').inputValue(),'未知の動き');assert.equal(await p.locator('iframe').count(),0);
 const first=examples.find(x=>x.kind==='image');await upload('renamed.js',first.source);await p.waitForFunction(name=>document.querySelector('#name').value===name,first.name);assert.equal(await p.locator('#name').inputValue(),first.name);assert.equal(await p.locator('#shape').inputValue(),'none');assert.equal(await p.locator('iframe').count(),0);
 const active=await p.evaluate(()=>JSON.parse(localStorage.getItem('unfold-workshop-drafts-v1')).active);
 await upload('again.js',first.source);await p.waitForFunction(name=>document.querySelector('#name').value===name,first.name);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('unfold-workshop-drafts-v1')).active),active);
 await p.locator('#name').fill('編集を残す');await upload('again.js',first.source);await p.waitForFunction(name=>document.querySelector('#name').value===name,first.name);assert.equal(await p.evaluate(key=>JSON.parse(localStorage.getItem('unfold-workshop-drafts-v1')).drafts[key].name,active),'編集を残す');
 await p.locator('#preview-run').click();await p.waitForFunction(()=>document.querySelector('#status').dataset.state==='ready');await p.locator('#add-unfold').click();await p.locator('#handoff').waitFor();
 const href=await p.locator('#open-single').getAttribute('href');
 const firstId=new URL(href,base).searchParams.get('workshopMethod');
 await upload('again.js',first.source);await p.waitForFunction(name=>document.querySelector('#name').value===name,first.name);await p.locator('#preview-run').click();await p.waitForFunction(()=>document.querySelector('#status').dataset.state==='ready');await p.locator('#add-unfold').click();await p.locator('#handoff').waitFor();assert.equal(new URL(await p.locator('#open-single').getAttribute('href'),base).searchParams.get('workshopMethod'),firstId,'repeat add reuses the same saved item');
 await p.locator('#code').fill(first.source+'\n// 保存前の編集');
 await p.locator('[data-card="'+first.key+'"]').click();await p.waitForFunction(()=>document.querySelector('#status').dataset.state==='ready');await p.locator('#add-unfold').click();await p.locator('#handoff').waitFor();
 assert.match(await p.evaluate(id=>JSON.parse(localStorage.getItem('unfold-workshop-drafts-v1')).drafts['saved:'+id].source,firstId),/保存前の編集/,'re-adding a sample must preserve independent edits on its saved card');
 const main=await p.context().newPage();await main.goto(new URL(href,base).href);await main.waitForFunction(()=>window.unfold);assert.equal(await main.evaluate(()=>unfold.state.imageSolid),true);await main.locator('#workshop-apply').click();await main.waitForFunction(()=>!unfold.state.imageSolid);assert.equal(await main.locator('#image-solid').isChecked(),false);await main.close();
 const seq=await p.context().newPage();await seq.goto(base+'sequence.html?empty&workshopMethod='+firstId);await seq.waitForFunction(()=>window.unfoldSeq);
 await seq.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=45;for(let i=0;i<3;i++)unfoldSeq.addSlide(c,String(i));unfoldSeq.seq.transitions.forEach(t=>t.shape='sphere');unfoldSeq.timelineApi.select({kind:'tr',i:0});});
 await seq.locator('#workshop-apply').click();await seq.waitForFunction(()=>unfoldSeq.seq.transitions[0].shape==='none');assert.equal(await seq.evaluate(()=>unfoldSeq.seq.transitions[1].shape),'sphere');await seq.evaluate(()=>unfoldSeq.undo());assert.equal(await seq.evaluate(()=>unfoldSeq.seq.transitions[0].shape),'sphere');await seq.close();
 await p.reload();await p.waitForFunction(()=>!document.querySelector('main').inert);assert.equal(await p.locator('#shape').inputValue(),'none');
 await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:out+'mobile.png'});
 console.log('imports, cancellation, edited drafts, deduplication, single/sequence surface handoff, undo, reload and mobile PASS');
 assert.deepEqual(errors,[]);await writeFile(out+'ui-results.json',JSON.stringify({cards:examples.map(d=>d.name),errors},null,2));
}finally{await browser.close()}
