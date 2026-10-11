// STUDIO's lyric panel: select a lyric, change its motion (a code motion card), colour (palette and one word), font and scope; Undo works.
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async page=>{
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  const root=document.createElement('main');document.body.replaceChildren(root);const css=document.createElement('link');css.rel='stylesheet';css.href='/studio.css';document.head.append(css);const lc=document.createElement('link');lc.rel='stylesheet';lc.href='/lyric-controls.css?v=3';document.head.append(lc);
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-lyric-edit'})});mountStudio(root,c);await c.ready;
  const lyric=(id,text,s,e)=>({id,text,runs:[{id:id+'r',text,emphasis:false}],startUs:s,endUs:e,motion:{font:'gothic',color:'#ffffff'},timingSource:'manual',opacity:1});
  await c.dispatch({type:'batch',commands:[{type:'setLock',track:'lyrics',locked:false},{type:'replaceLyrics',lyrics:[lyric('L1','いちまいの えを ここに',0,8e6),lyric('L2','ぐしゃっと くずれて',10e6,18e6)]},{type:'insertScene',scene:{id:'A',startUs:0,endUs:30e6,originUs:0}}]});
  window.lyricOf=id=>c.get().project.lyrics.find(l=>l.id===id);
  c.select({kind:'lyric',id:'L1'});
 });
 const panel=page.locator('#lm-quick');await panel.waitFor({state:'visible'});
 assert.match(await panel.locator('h3').textContent(),/この歌詞を編集/);
 // 1) a code motion card sets the lyric's code motion and the lane names it
 await page.locator('.lq-code-card[data-key="kn-slam"]').click();
 await page.waitForFunction(()=>!!lyricOf('L1').motion.code?.source);
 assert.equal(await page.evaluate(()=>lyricOf('L2').motion.code??null),null,'only the selected lyric changed');
 await page.waitForFunction(()=>/語ごとにドンと落ちる/.test(document.querySelector('.timeline-block.lyric[data-id=L1] .tl-motion')?.textContent||''));
 assert.match(await page.getByTestId('timeline-chips').innerText(),/文字の動き\s*語ごとにドンと落ちる/);
 // 2) a palette
 await page.locator('.lq-tabs button',{hasText:'色'}).click();
 await page.getByRole('button',{name:'配色 ミント'}).click();
 await page.waitForFunction(()=>lyricOf('L1').motion.color==='#c5f57b');
 // 3) one word only: the first word chip, then a palette (the runs are re-split, the text and grapheme ids stay)
 const before=await page.evaluate(()=>({text:lyricOf('L1').text,ids:lyricOf('L1').runs.flatMap(r=>r.glyphIds||[])}));
 await page.locator('.lq-word').first().click();
 await page.getByRole('button',{name:'配色 ベリー'}).click();
 await page.waitForFunction(()=>lyricOf('L1').runs.some(r=>r.color==='#ff91c7'));
 const after=await page.evaluate(()=>({text:lyricOf('L1').runs.map(r=>r.text).join(''),ids:lyricOf('L1').runs.flatMap(r=>r.glyphIds||[]),colored:lyricOf('L1').runs.filter(r=>r.color).map(r=>r.text).join('')}));
 assert.equal(after.text,before.text,'the words are unchanged');assert.ok(after.colored.length>0&&after.colored.length<before.text.length,'only a part is coloured: '+after.colored);
 assert.equal(after.ids.length,[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(before.text)].length,'every character keeps an id');
 // 4) the font for ALL lyrics
 await page.locator('.lq-tabs button',{hasText:'書体'}).click();
 await page.getByLabel('色・書体を適用する範囲').selectOption('all');
 await page.getByLabel('その場で書体').selectOption('mincho');
 await page.waitForFunction(()=>lyricOf('L1').motion.font==='mincho'&&lyricOf('L2').motion.font==='mincho');
 // 5) PC fonts and font files are offered here too (lyric-font-browser covers choosing one)
 assert.equal(await page.getByRole('button',{name:'PCのフォント'}).isVisible(),true);
 assert.equal(await page.locator('.lq-code-motions').count(),1);
 // 6) Undo takes back the last change (the font of both lyrics) in one step
 await page.evaluate(()=>c.undo());
 await page.waitForFunction(()=>lyricOf('L1').motion.font==='gothic'&&lyricOf('L2').motion.font==='gothic');
 // 6b) the old recipe cards are gone from the 動き tab; the code motions are the 動き tab now, with the size of the characters
 await page.locator('.lq-tabs button',{hasText:'動き'}).click();
 assert.equal(await page.locator('#lm-quick .lq-motion').count(),0,'no recipe cards');
 assert.equal(await page.locator('.lq-code-card[data-key="kn-slam"]').isVisible(),true);
 const sizeOf=id=>page.evaluate(i=>({wide:c.get().project.views.wide.layout[i].fontScale,tall:c.get().project.views.tall.layout[i].fontScale}),id);
 const size0=await sizeOf('L1');
 await page.getByTestId('lyric-size').fill('0.12');
 await page.waitForFunction(()=>c.get().project.views.wide.layout.L1.fontScale===0.12&&c.get().project.views.tall.layout.L1.fontScale===0.12);
 assert.deepEqual(await sizeOf('L2'),size0,'only the selected lyric changed size');
 await page.getByLabel('全歌詞に適用',{exact:false}).first().check();
 await page.getByTestId('lyric-size').fill('0.09');
 await page.waitForFunction(()=>c.get().project.lyrics.every(l=>c.get().project.views.wide.layout[l.id].fontScale===0.09));
 await page.evaluate(()=>c.undo());
 await page.waitForFunction(()=>c.get().project.views.wide.layout.L1.fontScale===0.12&&c.get().project.views.wide.layout.L2.fontScale!==0.09);
 // 7) code that is not the workshop's own is asked about; declining stops it, allowing lets it run
 const trust=await page.evaluate(async()=>{
  const m=await import('/studio/lyric-edit.js'),{isStudioCodeApproved}=await import('/studio/code-trust.js'),src='return {update(){},dispose(){}}; /* mine '+Math.random()+' */';
  let declined=null;try{m.trustSource(src,{ask:()=>false});}catch(e){declined=e.name;}
  const stillUntrusted=!isStudioCodeApproved(src);let asked=0;m.trustSource(src,{ask:()=>{asked++;return true;}});
  const approved=isStudioCodeApproved(src);m.trustSource(src,{ask:()=>{asked++;return true;}});
  const {DAILY_CODE_MOTIONS}=await import('/code-motion-daily.js');let bundledAsked=0;m.trustSource(DAILY_CODE_MOTIONS[5].source,{ask:()=>{bundledAsked++;return false;}});
  return {declined,stillUntrusted,asked,approved,bundledAsked};
 });
 assert.deepEqual(trust,{declined:'AbortError',stillUntrusted:true,asked:1,approved:true,bundledAsked:0},'foreign code is asked once; bundled code is not asked');
 // the right column is wide enough for the panel
 const w=await page.evaluate(()=>document.querySelector('.inspector').getBoundingClientRect().width);assert.ok(w>=340,'the inspector is widened for the panel: '+w);
 await page.evaluate(()=>c.dispose());
 console.log('PASS STUDIO lyric panel: code motion card, palette, one word, all-lyrics font, Undo',{inspectorWidth:Math.round(w)});
});
