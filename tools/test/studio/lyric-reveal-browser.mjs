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
 await page.getByLabel('拡大').fill('8');await page.getByLabel('拡大').dispatchEvent('change');
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
