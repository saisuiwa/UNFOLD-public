// カット割りに迷わずたどり着ける: 歌詞を選ぶと「動き」の一番上に「この歌詞をカット割りにする」があり、その歌詞だけがカット演出になる（ほかの歌詞はそのまま）。
// 「別の案」で引き直し、「普通の動きに戻す」で外れる。おまかせの「演出のしかた」は、見えるボタン2つで切り替わる。
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  const root=document.createElement('main');document.body.replaceChildren(root);for(const href of ['/studio.css','/lyric-controls.css?v=3']){const css=document.createElement('link');css.rel='stylesheet';css.href=href;document.head.append(css);}
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-lyriccut'})});mountStudio(root,c);await c.ready;
  const T=['折り目が光に変わっていく','ひとりでも 空はひらくから','ほら、もう一回ひろげよう'];
  const lyric=i=>({id:'L'+i,text:T[i],runs:[{id:'r'+i,text:T[i]}],startUs:Math.round((.4+i*3)*1e6),endUs:Math.round((.4+i*3+2.8)*1e6),motion:{font:'gothic',color:'#ffffff'},timingSource:'manual',opacity:1});
  await c.dispatch({type:'batch',commands:[{type:'setLock',track:'lyrics',locked:false},{type:'replaceLyrics',lyrics:T.map((_,i)=>lyric(i))},{type:'setLock',track:'lyrics',locked:true}]});
  window.cuts=()=>c.get().project.lyrics.map(l=>l.cut?l.cut.cuts.length+':'+l.cut.seed:'-');
 });
 // ---- one lyric
 await page.evaluate(()=>c.select({kind:'lyric',id:'L1'}));
 const box=page.getByTestId('lyric-cut-box');await box.waitFor();
 assert.equal(await page.getByTestId('lyric-cut-state').innerText(),'歌詞ごとの動き');
 assert.equal(await page.getByTestId('lyric-cut-make').isVisible(),true,'the button is visible without scrolling or opening anything');
 await page.getByTestId('lyric-cut-make').click();
 await page.waitForFunction(()=>cuts()[1]!=='-',null,{timeout:30000});
 let now=await page.evaluate(()=>cuts());
 assert.equal(now[0],'-');assert.equal(now[2],'-','only the chosen lyric changes: '+now);
 await page.waitForFunction(()=>/カット割り（\d+カット）/.test(document.querySelector('[data-testid=lyric-cut-state]').textContent));
 assert.equal(await page.getByTestId('lyric-cut-again').isVisible(),true);assert.equal(await page.getByTestId('lyric-cut-make').isVisible(),false);
 await page.screenshot({path:'tools/out/studio/lyric-cut-box.png'});
 // it is drawn as a cut layer
 const kind=await page.evaluate(async()=>{const {cutActive}=await import('/studio/cuts/plan.js');return c.get().project.lyrics.map(l=>cutActive(l));});
 assert.deepEqual(kind,[false,true,false]);
 // 別の案: a new seed, one undo step
 const before=now[1];await page.getByTestId('lyric-cut-again').click();
 await page.waitForFunction(b=>cuts()[1]!==b&&cuts()[1]!=='-',before,{timeout:30000});
 await page.evaluate(()=>c.undo());await page.waitForFunction(b=>cuts()[1]===b,before,{timeout:5000});
 // 普通の動きに戻す
 await page.getByTestId('lyric-cut-off').click();
 await page.waitForFunction(()=>cuts()[1]==='-',null,{timeout:5000});
 await page.waitForFunction(()=>document.querySelector('[data-testid=lyric-cut-state]').textContent==='歌詞ごとの動き');
 // ---- おまかせ: two visible buttons
 await page.getByTestId('inspector-to-omakase').click();
 const line=page.getByTestId('omakase-style-line'),cut=page.getByTestId('omakase-style-cut');await cut.waitFor();
 assert.equal(await line.getAttribute('aria-pressed'),'true');assert.equal(await cut.getAttribute('aria-pressed'),'false');
 assert.equal(await page.getByTestId('omakase-cut-box').isVisible(),false);
 await cut.click();
 assert.equal(await cut.getAttribute('aria-pressed'),'true');assert.equal(await line.getAttribute('aria-pressed'),'false');
 assert.equal(await page.getByTestId('omakase-cut-box').isVisible(),true);
 await page.screenshot({path:'tools/out/studio/omakase-style-switch.png'});
 await line.click();assert.equal(await page.getByTestId('omakase-cut-box').isVisible(),false);
 assert.deepEqual(errors,[]);
 console.log('lyric-cut-browser: ok');
},{mode:null});
