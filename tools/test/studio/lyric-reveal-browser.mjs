// The timeline keeps a newly chosen lyric in view when it is zoomed in, and the 歌詞 lane is the first one.
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async page=>{
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  const root=document.createElement('main');document.body.replaceChildren(root);
  for(const href of ['/studio.css','/lyric-controls.css?v=3']){const css=document.createElement('link');css.rel='stylesheet';css.href=href;document.head.append(css);}
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-lyric-reveal'})});mountStudio(root,c);await c.ready;
  const lyric=i=>({id:'L'+i,text:'歌詞その'+(i+1),runs:[{id:'r'+i,text:'歌詞その'+(i+1)}],startUs:i*9e6,endUs:i*9e6+6e6,motion:{font:'gothic',color:'#ffffff'},timingSource:'manual',opacity:1});
  await c.dispatch({type:'setDuration',durationUs:100e6});
  await c.dispatch({type:'batch',commands:[{type:'setLock',track:'lyrics',locked:false},{type:'replaceLyrics',lyrics:Array.from({length:10},(_,i)=>lyric(i))},{type:'insertScene',scene:{id:'A',startUs:0,endUs:100e6,originUs:0}}]});
 });
 // the lane order
 assert.deepEqual(await page.locator('.timeline-lane > .lane-title').allTextContents(),['歌詞','画像','演出','音声']);
 // zoom in (拡大), then choose the last lyric from elsewhere: its block scrolls into the visible part of the timeline
 // 拡大 is a slider (1-8, ×N shown next to it); it zooms while it is dragged and keeps the middle of the visible part
 assert.equal(await page.getByTestId('timeline-zoom').getAttribute('type'),'range');
 const setZoom=v=>page.getByTestId('timeline-zoom').evaluate((i,v)=>{i.value=String(v);i.dispatchEvent(new Event('input',{bubbles:true}));},v);
 const width1=await page.evaluate(()=>document.querySelector('.timeline-scroll').scrollWidth);
 assert.equal(await page.getByTestId('timeline-pan').isDisabled(),true,'nothing to move while the whole song is in view');
 await setZoom(4);
 await page.waitForFunction(w=>document.querySelector('.timeline-scroll').scrollWidth>w*2,width1);
 assert.equal(await page.locator('.zoom-field:not(.pan-field) output').textContent(),'×4');
 // 移動: a slider under 拡大 that scrolls the zoomed timeline sideways, and follows the scrolling
 assert.equal(await page.getByTestId('timeline-pan').isDisabled(),false,'enabled when zoomed in');
 await page.getByTestId('timeline-pan').evaluate(i=>{i.value='500';i.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.waitForFunction(()=>{const s=document.querySelector('.timeline-scroll'),room=s.scrollWidth-s.clientWidth;return Math.abs(s.scrollLeft/room-.5)<.02;});
 assert.equal(await page.locator('.pan-field output').textContent(),'50%');
 await page.evaluate(()=>{const s=document.querySelector('.timeline-scroll');s.scrollLeft=0;});
 await page.waitForFunction(()=>document.querySelector('[data-testid="timeline-pan"]').value==='0');
 // the middle of the visible part stays: scroll to the middle at ×4, zoom to ×8, the same moment is still in the middle
 const midAt=()=>page.evaluate(()=>{const s=document.querySelector('.timeline-scroll'),t=document.querySelector('.timeline-tracks');return (s.scrollLeft+s.clientWidth/2)/t.scrollWidth;});
 await page.evaluate(()=>{const s=document.querySelector('.timeline-scroll');s.scrollLeft=(s.scrollWidth-s.clientWidth)/2;});
 const before=await midAt();
 await setZoom(8);
 await page.waitForFunction(w=>document.querySelector('.timeline-scroll').scrollWidth>w*3,width1);
 assert.ok(Math.abs(await midAt()-before)<.02,'the middle stays: '+before+' -> '+await midAt());
 await page.waitForFunction(()=>document.querySelector('.timeline-scroll').scrollWidth>document.querySelector('.timeline-scroll').clientWidth*3);
 const inView=id=>page.evaluate(id=>{const n=document.querySelector(`.timeline-block.lyric[data-id="${id}"]`),r=n.getBoundingClientRect(),s=document.querySelector('.timeline-scroll').getBoundingClientRect();return r.left>=s.left&&r.right<=s.right+1;},id);
 assert.equal(await inView('L9'),false,'far away to begin with');
 await page.evaluate(()=>c.select({kind:'lyric',id:'L9'}));
 await page.waitForFunction(id=>{const n=document.querySelector(`.timeline-block.lyric[data-id="${id}"]`),r=n.getBoundingClientRect(),s=document.querySelector('.timeline-scroll').getBoundingClientRect();return r.left>=s.left&&r.right<=s.right+1;},'L9');
 await page.evaluate(()=>c.select({kind:'lyric',id:'L0'}));
 await page.waitForFunction(id=>{const n=document.querySelector(`.timeline-block.lyric[data-id="${id}"]`),r=n.getBoundingClientRect(),s=document.querySelector('.timeline-scroll').getBoundingClientRect();return r.left>=s.left&&r.right<=s.right+1;},'L0');
 await page.evaluate(()=>c.dispose());
 console.log('PASS timeline: 歌詞 lane first, a chosen lyric is scrolled into view when zoomed in');
});
