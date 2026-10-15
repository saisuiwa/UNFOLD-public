// Sequence page: the timeline's 拡大 / 移動 sliders (the same two as STUDIO's), the GLB library in the 「動画保存・GLB追加」 tab,
// and the 変形 panel at the bottom of 「04 見た目」 for the ◆ under the playhead (shape / 崩れ方 can be changed right there).
import assert from 'node:assert/strict';
import {startStaticServer} from '../lib/static-server.mjs';
import {launchBrowser} from '../lib/browser.mjs';
const server=await startStaticServer(),browser=await launchBrowser();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),problems=[];
 page.on('pageerror',e=>problems.push(String(e).slice(0,300)));
 await page.goto(server.url+'/sequence.html?empty',{waitUntil:'load'});await page.waitForFunction(()=>window.unfoldSeq,null,{timeout:60000});
 await page.evaluate(async()=>{const u=unfoldSeq;
  for(let i=0;i<6;i++){const c=document.createElement('canvas');c.width=320;c.height=180;const g=c.getContext('2d');g.fillStyle=`hsl(${i*55},70%,50%)`;g.fillRect(0,0,320,180);u.addSlide(c,'テスト '+(i+1));}
  await u.prepareShapes();u.refreshUI();});

 // where things live
 assert.deepEqual((await page.locator('.tabs [data-tab]').allTextContents()).map(t=>t.trim()),['03 選択中','04 見た目','05 曲・歌詞','動画保存・GLB追加']);
 assert.equal(await page.locator('#pane-export .model-library #seq-model-add').count(),1,'the GLB library is in the 動画保存・GLB追加 tab');
 assert.equal(await page.locator('#pane-look .model-library').count(),0,'and no longer in 04 見た目');
 assert.equal(await page.locator('#pane-look #seq-look-trans').count(),1,'the 変形 panel has its place in 04 見た目');

 // 拡大 / 移動
 const zoom=page.locator('[data-testid="timeline-zoom"]'),pan=page.locator('[data-testid="timeline-pan"]');
 const read=()=>page.evaluate(()=>{const z=document.querySelector('[data-testid="timeline-zoom"]'),p=document.querySelector('[data-testid="timeline-pan"]'),sc=document.querySelector('.tl-scroll');
  return {zoom:Number(z.value),zoomOut:z.parentElement.querySelector('output').textContent,pan:Number(p.value),panOut:p.parentElement.querySelector('output').textContent,panDisabled:p.disabled,left:sc.scrollLeft,width:sc.scrollWidth,view:sc.clientWidth};});
 const setRange=(loc,v)=>loc.evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},v);
 await page.locator('.tl-bar button',{hasText:'全体'}).click();
 let t=await read();assert.equal(t.zoomOut,'×1');assert.equal(t.zoom,1);
 await setRange(zoom,4);t=await read();
 assert.equal(t.zoomOut,'×4');assert.ok(t.width>t.view*2,'the timeline is wider than the view');assert.equal(t.panDisabled,false,'移動 works once zoomed in');
 await setRange(pan,1000);t=await read();
 assert.equal(t.panOut,'100%');assert.ok(Math.abs(t.left-(t.width-t.view))<2,'移動 at the right end scrolls to the end');
 await setRange(pan,500);t=await read();
 assert.equal(t.panOut,'50%');assert.ok(Math.abs(t.left-(t.width-t.view)/2)<2);
 await page.evaluate(()=>new Promise(r=>{document.querySelector('.tl-scroll').scrollLeft=0;requestAnimationFrame(()=>requestAnimationFrame(r));}));
 t=await read();assert.equal(t.panOut,'0%','scrolling the timeline moves the 移動 slider');
 await page.locator('.tl-bar button',{hasText:'＋'}).click();t=await read();
 assert.equal(t.zoomOut,'×5.6');assert.equal(t.zoom,5.5,'the ＋ button moves the 拡大 slider too');
 await page.locator('.tl-bar button',{hasText:'全体'}).click();assert.equal((await read()).zoomOut,'×1');

 // 04 見た目: the 変形 panel follows the playhead
 await page.locator('.tabs [data-tab="look"]').click();
 const goTo=sec=>page.evaluate(s=>{unfoldSeq.seq.t=s;unfoldSeq.renderAt(s);},sec);
 const state=()=>page.evaluate(()=>{const box=document.querySelector('#seq-look-trans');return {view:document.querySelector('#pane-look').dataset.view,visible:getComputedStyle(box).display!=='none',title:box.querySelector('.insp-title')?.textContent||'',shapes:box.querySelectorAll('.shape-grid button').length,pressed:box.querySelector('.shape-grid button[aria-pressed="true"]')?.title||'',method:!!box.querySelector('select')};});
 await goTo(.2);let s=await state();
 assert.equal(s.view,'image');assert.equal(s.visible,false,'a still picture shows no 変形 panel (自動)');
 const times=await page.evaluate(()=>{const u=unfoldSeq,total=u.totalSeconds(),found={};
  for(let i=0;i<=400;i++){const x=total*i/400;u.seq.t=x;u.renderAt(x);const chip=document.querySelector('#seq-phase .phase-chip')?.textContent||'';if(chip&&!found[chip]&&/^1 → 2/.test(document.querySelector('#seq-phase').textContent))found[chip]=x;}
  return found;});
 assert.ok(times['ぐちゃぐちゃ']&&times['立体化'],'◆ 1→2 has a ぐちゃぐちゃ part and a 立体化 part');
 await goTo(times['ぐちゃぐちゃ']);s=await state();
 assert.equal(s.view,'chaos');assert.ok(s.visible&&s.method&&/変形 1 → 2/.test(s.title));
 await goTo(times['立体化']);s=await state();
 assert.equal(s.view,'form');assert.ok(s.visible&&s.shapes>5&&/変形 1 → 2/.test(s.title),'the shape menu is in the tab');
 const want=await page.evaluate(()=>{const b=[...document.querySelectorAll('#seq-look-trans .shape-grid button')].find(x=>x.getAttribute('aria-pressed')==='false'&&!x.className.includes('added'));b.dataset.pick='1';return b.title;});
 await page.locator('#seq-look-trans .shape-grid button[data-pick="1"]').click();
 s=await state();assert.equal(s.pressed,want,'picking a shape here changes the ◆');assert.ok(s.visible);
 const before=await page.evaluate(()=>unfoldSeq.seq.transitions[0].method);
 const next=await page.evaluate(()=>{const sel=document.querySelector('#seq-look-trans select');return [...sel.options].map(o=>o.value).find(v=>v!==sel.value);});
 await page.locator('#seq-look-trans select').first().selectOption(next);
 assert.equal(await page.evaluate(()=>unfoldSeq.seq.transitions[0].method),next);assert.notEqual(next,before);
 // the next ◆
 const second=await page.evaluate(()=>{const u=unfoldSeq,total=u.totalSeconds();
  for(let i=0;i<=600;i++){const x=total*i/600;u.seq.t=x;u.renderAt(x);if(/^2 → 3/.test(document.querySelector('#seq-phase').textContent)&&document.querySelector('#seq-phase .phase-chip'))return x;}return null;});
 assert.ok(second!==null);assert.match((await state()).title,/変形 2 → 3/,'the panel follows the playhead to the next ◆');
 // すべて: the ◆ is offered on a still picture too
 await goTo(.2);await page.locator('#look-mode [data-mode="all"]').click();s=await state();
 assert.ok(s.visible&&/変形/.test(s.title));
 await page.locator('#look-mode [data-mode="auto"]').click();

 // 03 選択中 is unchanged for a selected ◆
 await page.evaluate(()=>unfoldSeq.timelineApi.select({kind:'tr',i:0}));
 await page.locator('.tabs [data-tab="edit"]').click();
 assert.ok(await page.locator('#seq-inspector .shape-grid button').count()>5);
 // the GLB tab
 await page.locator('.tabs [data-tab="export"]').click();
 assert.ok(await page.locator('#seq-export').isVisible()&&await page.locator('#seq-model-add').isVisible()&&await page.locator('#seq-model-status').isVisible());
 assert.deepEqual(problems,[],'no page errors');
 console.log('PASS sequence: 拡大/移動 sliders, GLB in 動画保存・GLB追加, 変形 panel in 04 見た目');
}finally{await browser.close();await server.close();}
