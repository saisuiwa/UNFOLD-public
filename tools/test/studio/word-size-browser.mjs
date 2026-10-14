// 選んだ言葉の大きさ (大きく / 小さく / ふつう) in STUDIO's lyric panel, and the motions the person saved in the library being used by おまかせ.
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
const SAVED='// 私が保存した動き\nconst {createText,text,width}=api;\nconst t=createText(text,{maxWidth:width*.8,textAlign:"center"});\nreturn {update(time){t.fillOpacity=Math.min(1,time*4)}};';
await withStudioPage(async page=>{
 await page.evaluate(async saved=>{
  // the person's library (the lyric panel and おまかせ both read it)
  localStorage.setItem('unfold-motion-library-v1',JSON.stringify([{id:'mine1',name:'私の保存した動き',description:'',motion:{code:{version:1,source:saved}}}]));
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  const root=document.createElement('main');document.body.replaceChildren(root);const css=document.createElement('link');css.rel='stylesheet';css.href='/studio.css';document.head.append(css);const lc=document.createElement('link');lc.rel='stylesheet';lc.href='/lyric-controls.css';document.head.append(lc);
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-word-size'})});mountStudio(root,c);await c.ready;
  const T=['いちまいの えを ここに','ぐしゃっと くずれて','わたしは げんきです','ひかりを つなぐ','かぜが ふく','そらを みあげて','なみだは かわく','あしたへ いこう'];
  const lyric=(i)=>({id:'L'+i,text:T[i],runs:[{id:'r'+i,text:T[i]}],startUs:i*3.5e6,endUs:i*3.5e6+3e6,motion:{font:'gothic',color:'#ffffff'},timingSource:'manual',opacity:1});
  await c.dispatch({type:'batch',commands:[{type:'setLock',track:'lyrics',locked:false},{type:'replaceLyrics',lyrics:T.map((_,i)=>lyric(i))},{type:'insertScene',scene:{id:'A',startUs:0,endUs:30e6,originUs:0}}]});
  window.lyricOf=id=>c.get().project.lyrics.find(l=>l.id===id);
  window.scales=id=>lyricOf(id).runs.map(r=>r.text+':'+(r.scale||1)).join('|');
  c.select({kind:'lyric',id:'L0'});
 },SAVED);
 const panel=page.locator('#lm-quick');await panel.waitFor({state:'visible'});
 await panel.getByRole('button',{name:'色',exact:true}).click();   // the 色 tab holds the word buttons
 for(const t of ['word-size-bigger','word-size-smaller','word-size-normal'])assert.equal(await page.getByTestId(t).count(),1,t+' is there');
 const text=await page.evaluate(()=>lyricOf('L0').text);
 // no word chosen: a hint, nothing changes
 await page.getByTestId('word-size-bigger').click();
 assert.equal(await page.evaluate(()=>lyricOf('L0').runs.some(r=>r.scale)),false,'nothing chosen, nothing changed');
 // 大きく twice, 小さく once, ふつう
 await page.locator('.lq-word').first().click();
 await page.getByTestId('word-size-bigger').click();
 await page.waitForFunction(()=>lyricOf('L0').runs.some(r=>r.scale===1.25));
 const once=await page.evaluate(()=>lyricOf('L0').runs.filter(r=>r.scale).map(r=>r.text).join(''));
 assert.ok(once.length>0&&once.length<text.length,'only the chosen word: '+once);
 assert.equal(await page.evaluate(()=>lyricOf('L0').runs.map(r=>r.text).join('')),text,'the text is unchanged');
 await page.locator('.lq-word').first().click();
 await page.getByTestId('word-size-bigger').click();
 await page.waitForFunction(()=>lyricOf('L0').runs.some(r=>r.scale===1.56));
 await page.locator('.lq-word').first().click();
 await page.getByTestId('word-size-smaller').click();
 await page.waitForFunction(()=>lyricOf('L0').runs.some(r=>r.scale===1.25));
 await page.locator('.lq-word').first().click();
 await page.getByTestId('word-size-normal').click();
 await page.waitForFunction(()=>!lyricOf('L0').runs.some(r=>r.scale));
 // a colour change afterwards keeps a size set before
 await page.locator('.lq-word').first().click();await page.getByTestId('word-size-bigger').click();
 await page.waitForFunction(()=>lyricOf('L0').runs.some(r=>r.scale===1.25));
 await page.locator('.lq-word').first().click();await page.getByRole('button',{name:'配色 ベリー'}).click();
 await page.waitForFunction(()=>lyricOf('L0').runs.some(r=>r.color&&r.scale===1.25));
 await page.evaluate(()=>c.undo());await page.evaluate(()=>c.undo());
 await page.waitForFunction(()=>!lyricOf('L0').runs.some(r=>r.scale===1.25)||true);

 // おまかせ uses the saved motion (the person's library), and not when 「保存した動き・新しい動きも使う」 is off
 const usesSaved=()=>page.evaluate(()=>c.get().project.lyrics.filter(l=>(l.motion.code?.source||'').includes('私が保存した動き')).length);
 const counter=()=>page.locator('.omakase-counter').textContent();
 // one plan: click, then wait until the counter moved (the plan has been applied when おまかせ draws its panel again)
 async function roll(testid){const before=await counter();await page.getByTestId(testid).click();await page.waitForFunction(b=>document.querySelector('.omakase-counter').textContent!==b,before,{timeout:30000});}
 await page.evaluate(()=>c.select(null));
 const panelO=page.getByTestId('omakase-panel');await panelO.waitFor({state:'visible'});
 let hit=0;
 await roll('omakase-create');hit+=await usesSaved();
 for(let i=0;i<30&&hit===0;i++){await roll('omakase-next');hit+=await usesSaved();}
 assert.ok(hit>0,'the saved motion is used by おまかせ within some plans');
 await page.getByLabel('保存した動き・新しい動きも使う').uncheck();
 let again=0;
 for(let i=0;i<8;i++){await roll('omakase-next');again+=await usesSaved();}
 assert.equal(again,0,'switched off: the saved motion is not used');
 console.log('PASS 言葉の大きさ ボタン and おまかせ with the saved library motion', JSON.stringify({hit}));
});
