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
 // 0) choosing a lyric moves the picture to it (a little way in, so its text is on screen): by its block and by the panel's arrows
 const startOf=id=>page.evaluate(id=>{const l=lyricOf(id);return l.startUs+Math.min(Math.round((l.endUs-l.startUs)/2),1200000);},id);
 await page.locator('.timeline-block.lyric[data-id="L2"]').click();
 const want2=await startOf('L2');
 await page.waitForFunction(w=>Math.abs(c.get().position-w)<40000,want2);
 await page.getByRole('button',{name:'← 前の歌詞'}).click();
 const want1=await startOf('L1');
 await page.waitForFunction(w=>Math.abs(c.get().position-w)<40000,want1);
 assert.equal(await page.evaluate(()=>c.get().selection.id),'L1');
 await page.getByRole('button',{name:'次の歌詞 →'}).click();
 await page.waitForFunction(w=>Math.abs(c.get().position-w)<40000,want2);
 await page.locator('.timeline-block.lyric[data-id="L1"]').click();
 await page.waitForFunction(w=>Math.abs(c.get().position-w)<40000,want1);
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
 // 3b) 縁取り / 中抜き on the chosen word only: they exclude each other, the colour and ids stay, 飾りを外す removes them, one Undo each
 const deco=()=>page.evaluate(()=>lyricOf('L1').runs.filter(r=>r.outline||r.hollow).map(r=>(r.outline?'o:':'h:')+r.text+':'+(r.color||'')).join('|'));
 await page.locator('.lq-word').first().click();
 await page.getByTestId('word-outline').click();
 await page.waitForFunction(()=>lyricOf('L1').runs.some(r=>r.outline));
 const outlined=await deco();assert.match(outlined,/^o:.+:#ff91c7$/,'the outlined word keeps its colour: '+outlined);
 assert.equal(await page.evaluate(()=>lyricOf('L1').runs.map(r=>r.text).join('')),before.text,'text unchanged');
 await page.locator('.lq-word').first().click();
 await page.getByTestId('word-hollow').click();
 await page.waitForFunction(()=>lyricOf('L1').runs.some(r=>r.hollow));
 assert.match(await deco(),/^h:/,'hollow replaces outline: '+await deco());
 await page.locator('.lq-word').first().click();
 await page.getByTestId('word-plain').click();
 await page.waitForFunction(()=>!lyricOf('L1').runs.some(r=>r.outline||r.hollow));
 await page.evaluate(()=>c.undo());await page.waitForFunction(()=>lyricOf('L1').runs.some(r=>r.hollow));
 await page.evaluate(()=>c.undo());await page.waitForFunction(()=>lyricOf('L1').runs.some(r=>r.outline)&&!lyricOf('L1').runs.some(r=>r.hollow));
 await page.evaluate(()=>c.undo());await page.waitForFunction(()=>!lyricOf('L1').runs.some(r=>r.outline||r.hollow));
 // 3c) the colour of the outline: chosen with the colour input (applies to the chosen word at once, keeps the outline), 自動 puts it back
 await page.locator('.lq-word').first().click();
 await page.getByTestId('word-outline-color').evaluate(i=>{i.value='#ff0000';i.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.waitForFunction(()=>lyricOf('L1').runs.some(r=>r.outline&&r.outlineColor==='#ff0000'));
 await page.locator('.lq-word').first().click();
 await page.getByTestId('word-outline-auto').click();
 await page.waitForFunction(()=>lyricOf('L1').runs.some(r=>r.outline&&!r.outlineColor));
 await page.evaluate(()=>c.undo());await page.waitForFunction(()=>lyricOf('L1').runs.some(r=>r.outline&&r.outlineColor==='#ff0000'));
 await page.evaluate(()=>c.undo());await page.waitForFunction(()=>!lyricOf('L1').runs.some(r=>r.outline));
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
