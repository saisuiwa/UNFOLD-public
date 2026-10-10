// The timeline reads like the sequence editor: four lanes (画像 / 演出 / 音声 / 歌詞), every lyric says which text motion it uses,
// and the selected lyric lists what is inside it (text motion, backgrounds, effects) as chips.
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async page=>{
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js'),{approveStudioCode}=await import('/studio/code-trust.js'),{DAILY_CODE_MOTIONS}=await import('/code-motion-daily.js');
  const src=k=>DAILY_CODE_MOTIONS.find(m=>m.key===k).source,bg=src('bg-square-tunnel'),word=src('kn-slam');approveStudioCode(bg);approveStudioCode(word);
  const root=document.createElement('main');document.body.replaceChildren(root);const css=document.createElement('link');css.rel='stylesheet';css.href='/studio.css';document.head.append(css);
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-timeline-lanes'})});mountStudio(root,c);await c.ready;
  const text=(id,sceneId,name,body,code)=>({id,name,kind:'text',sceneId,startUs:0,endUs:10e6,sourceInUs:0,effectOriginUs:0,z:0,opacity:1,seed:7,text:body,motion:{font:'gothic',color:'#ffffff',...(code?{code:{version:1,source:code}}:{})}});
  await c.dispatch({type:'batch',commands:[{type:'setLock',track:'lyrics',locked:false},
   {type:'replaceLyrics',lyrics:[{id:'L1',text:'いちまいの えを',runs:[],startUs:0,endUs:8e6,motion:{font:'gothic',color:'#ffffff',code:{version:1,source:word}},timingSource:'manual',opacity:1},{id:'L2',text:'ぐしゃっと くずれて',runs:[],startUs:10e6,endUs:18e6,motion:{font:'mincho',color:'#d9f878'},timingSource:'manual',opacity:1}]},
   {type:'insertScene',scene:{id:'A',startUs:0,endUs:10e6,originUs:0}},{type:'insertScene',scene:{id:'B',startUs:10e6,endUs:20e6,originUs:10e6}},
   {type:'insertClip',clip:text('bgA','A','背景','',bg)},{type:'insertClip',clip:text('wordB','B','飾り','光','')}]});
  c.select({kind:'lyric',id:'L1'});
 });
 const names=await page.locator('.timeline-lane > .lane-title').allTextContents();assert.deepEqual(names,['画像','演出','音声','歌詞'],'four lanes in this order');
 assert.equal(await page.locator('.timeline-lane.lane-scenes').count(),1,'all scenes share one lane');assert.equal(await page.locator('.timeline-lane.lane-scenes .timeline-block.scene').count(),2);
 assert.equal(await page.locator('.timeline-lane.lane-lyrics').count(),1,'all lyrics share one lane');assert.equal(await page.getByTestId('lyric-row').count(),2);
 assert.match(await page.locator('.timeline-block.lyric[data-id=L1] .tl-motion').textContent(),/語ごとにドンと落ちる/,'a lyric block names its text motion');
 assert.match(await page.locator('.timeline-block.lyric[data-id=L2] .tl-motion').textContent(),/ふわっと/,'the default motion has a name too');
 // the effect lane shows the background of scene A and the decorative text of scene B, on the song's time
 const fx=await page.locator('.timeline-lane.lane-fx .timeline-block.fx').evaluateAll(n=>n.map(x=>({id:x.dataset.id,bg:x.classList.contains('bg'),title:x.title})));
 assert.deepEqual(fx.map(x=>x.id).sort(),['bgA','wordB']);assert.equal(fx.find(x=>x.id==='bgA').bg,true);assert.match(fx.find(x=>x.id==='bgA').title,/四角トンネルの背景/);
 assert.equal(await page.locator('.timeline-block.clip').count(),1,'the layers of the selected scene are still rows below the lanes');
 // chips of the selected lyric
 const chips=async()=>page.getByTestId('timeline-chips').innerText();
 let text=await chips();assert.match(text,/文字の動き\s*語ごとにドンと落ちる/);assert.match(text,/背景\s*四角トンネルの背景/);assert.match(text,/書体・色\s*ゴシック/);
 await page.evaluate(()=>c.select({kind:'lyric',id:'L2'}));text=await chips();assert.match(text,/文字の動き\s*ふわっと/);assert.doesNotMatch(text,/四角トンネル/);assert.match(text,/書体・色\s*明朝/);
 await page.evaluate(()=>c.select({kind:'scene',id:'A'}));assert.match(await chips(),/背景\s*四角トンネルの背景/);
 await page.evaluate(()=>c.select(null));assert.match(await chips(),/選ぶと/);
 // one lane height each: the four lanes plus two layer rows fit in a short band
 const height=await page.evaluate(()=>document.querySelector('.timeline-tracks').getBoundingClientRect().height);assert.ok(height<330,'the lanes stay compact: '+height);
 await page.evaluate(()=>c.dispose());console.log('PASS sequence-style lanes: one lane each, text motion named on every lyric, chips for the selection',{height:Math.round(height)});
});
