// かんたん / 詳細: the same STUDIO screen with the rarely needed controls folded away. かんたん is the default, the choice is remembered,
// nothing but the display changes (the controls are still there in 詳細, the project is untouched).
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
const FOLDED_IN_EASY=['開く','ファイル保存','別名で保存','UNFOLD作品を配置','UNFOLD変形を追加','主曲を読み込む','歌詞を入力・同期','再生位置で分割','配置を複製','シーンを追加'];
const KEPT_IN_EASY=['おまかせ','新しいMV','元に戻す','やり直す','ブラウザに保存','MP4を書き出す','保存した作品','＋ 画像・動画','効果音を追加','文字を追加','光の演出を追加','選択を削除','縦も並べる'];
await withStudioPage(async page=>{
 const mount=dbName=>page.evaluate(async dbName=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  const root=document.createElement('main');document.body.replaceChildren(root);
  for(const href of ['/studio.css','/lyric-controls.css?v=3']){const css=document.createElement('link');css.rel='stylesheet';css.href=href;document.head.append(css);}
  window.c=createController({store:await openStudioStore({dbName})});mountStudio(root,c);await c.ready;
  const lyric=i=>({id:'L'+i,text:'歌詞その'+(i+1),runs:[{id:'r'+i,text:'歌詞その'+(i+1)}],startUs:i*3.5e6,endUs:i*3.5e6+3e6,motion:{font:'gothic',color:'#ffffff'},timingSource:'manual',opacity:1});
  await c.dispatch({type:'batch',commands:[{type:'setLock',track:'lyrics',locked:false},{type:'replaceLyrics',lyrics:Array.from({length:3},(_,i)=>lyric(i))},{type:'insertScene',scene:{id:'A',startUs:0,endUs:20e6,originUs:0}}]});
 },dbName);
 const visible=async name=>{const b=page.getByRole('button',{name,exact:true});return (await b.count())>0&&await b.first().isVisible();};
 await mount('unfold-studio-easy-mode-1');
 // かんたん is the default
 assert.equal(await page.locator('.studio-root').getAttribute('data-mode'),'easy');
 assert.equal(await page.getByTestId('mode-easy').getAttribute('aria-pressed'),'true');
 for(const name of KEPT_IN_EASY)assert.ok(await visible(name),'still there in かんたん: '+name);
 for(const name of FOLDED_IN_EASY)assert.equal(await visible(name),false,'folded away in かんたん: '+name);
 assert.equal(await page.locator('.lock-controls').isVisible(),false,'the lock buttons are folded away');
 assert.equal(await page.getByTestId('short-panel').isVisible(),false,'the shorts window starts closed');assert.equal(await page.getByTestId('short-open').isVisible(),true,'the shorts button is in the top bar');
 assert.equal(await page.locator('.easy-only').isVisible(),true,'the hint about where the song and lyrics come from');
 // a lyric: the lyric panel and the text stay, the timing and layout numbers fold away
 await page.evaluate(()=>c.select({kind:'lyric',id:'L0'}));
 await page.locator('.studio-lyric-edit').waitFor({state:'visible'});
 assert.equal(await page.getByLabel('文字本文').isVisible(),true);
 for(const label of ['開始秒','終了秒','配置 X','文字の幅'])assert.equal(await page.getByLabel(label,{exact:true}).first().isVisible(),false,'folded away: '+label);
 // 詳細: everything is back, and it is remembered
 await page.getByTestId('mode-full').click();
 assert.equal(await page.locator('.studio-root').getAttribute('data-mode'),'full');
 assert.equal(await page.getByTestId('mode-full').getAttribute('aria-pressed'),'true');
 for(const name of [...KEPT_IN_EASY,...FOLDED_IN_EASY])assert.ok(await visible(name),'in 詳細: '+name);
 assert.equal(await page.locator('.lock-controls').isVisible(),true);
 assert.equal(await page.locator('.easy-only').isVisible(),false);
 for(const label of ['開始秒','終了秒','配置 X','文字の幅'])assert.equal(await page.getByLabel(label,{exact:true}).first().isVisible(),true,'in 詳細: '+label);
 assert.equal(await page.evaluate(()=>localStorage.getItem('unfold-studio-mode')),'full');
 await page.reload();await mount('unfold-studio-easy-mode-2');
 assert.equal(await page.locator('.studio-root').getAttribute('data-mode'),'full','the choice survives a reload');
 // switching does not touch the project
 const content=()=>page.evaluate(()=>{const {revision,...p}=c.get().project;return JSON.stringify(p);}),before=await content();
 await page.getByTestId('mode-easy').click();await page.getByTestId('mode-full').click();await page.getByTestId('mode-easy').click();
 assert.equal(await content(),before);
 assert.equal(await page.evaluate(()=>c.get().history.canUndo),true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('unfold-studio-mode')),'easy');
 // an easy-mode user can still do the main thing: おまかせ
 await page.getByTestId('omakase-create').click();
 await page.waitForFunction(()=>c.get().project.lyrics.every(l=>l.motion.code?.source));
 await page.evaluate(()=>c.dispose());
 console.log('PASS かんたん/詳細: default かんたん, controls folded and back, remembered, project untouched, おまかせ works in かんたん');
},{mode:null});
