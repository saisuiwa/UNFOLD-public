// かんたん表示でも、選んだものを消せる。おまかせの背景は、そのまま消える。位置固定中の歌詞は、確かめてから（固定はそのままで）消える。断れば何も変わらない。Undo は1回。
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async page=>{
 const dialogs=[];let answer=true;page.on('dialog',d=>{dialogs.push(d.message());answer?d.accept():d.dismiss();});
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  const root=document.createElement('main');document.body.replaceChildren(root);for(const href of ['/studio.css','/lyric-controls.css?v=3']){const css=document.createElement('link');css.rel='stylesheet';css.href=href;document.head.append(css);}
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-deleteeasy'})});mountStudio(root,c);await c.ready;
  const T=['折り目が光に変わっていく','小さな紙が風に飛んだ','ほら、もう一回ひろげよう'];
  const lyric=i=>({id:'L'+i,text:T[i],runs:[{id:'r'+i,text:T[i]}],startUs:Math.round((.4+i*2.8)*1e6),endUs:Math.round((.4+i*2.8+2.6)*1e6),motion:{font:'gothic',color:'#ffffff'},timingSource:'manual',opacity:1});
  await c.dispatch({type:'batch',commands:[{type:'setLock',track:'lyrics',locked:false},{type:'replaceLyrics',lyrics:T.map((_,i)=>lyric(i))},{type:'insertScene',scene:{id:'A',startUs:0,endUs:12e6,originUs:0}},{type:'setLock',track:'lyrics',locked:true}]});
  window.state=()=>({lyrics:c.get().project.lyrics.map(l=>l.id).join(),locked:c.get().project.locks.lyrics,clips:c.get().project.clips.length});
 });
 await page.getByTestId('mode-easy').click();
 assert.equal(await page.locator('.studio-root').getAttribute('data-mode'),'easy');
 const del=page.getByRole('button',{name:'選択を削除'});
 assert.equal(await del.isVisible(),true,'the delete button is there in かんたん');
 // an おまかせ background: deleted at once
 await page.getByTestId('omakase-create').click();
 await page.waitForFunction(()=>c.get().project.clips.some(x=>x.settings?.omakase),null,{timeout:30000});
 const bg=await page.evaluate(()=>c.get().project.clips.find(x=>x.settings?.omakase).id),n0=await page.evaluate(()=>c.get().project.clips.length);
 await page.evaluate(id=>c.select({kind:'clip',id}),bg);await del.click();
 await page.waitForFunction(n=>c.get().project.clips.length===n-1,n0,{timeout:5000});assert.equal(dialogs.length,0,'no question for a background');
 // a locked lyric: decline → nothing changes
 assert.equal((await page.evaluate(()=>state())).locked,true);
 answer=false;await page.evaluate(()=>c.select({kind:'lyric',id:'L1'}));await del.click();await page.waitForTimeout(500);
 assert.equal(dialogs.length,1);assert.match(dialogs[0],/歌詞の位置が固定されています/);
 assert.equal((await page.evaluate(()=>state())).lyrics,'L0,L1,L2','declined: the lyric is still there');
 // accept → that lyric goes, the lock stays on
 answer=true;await del.click();await page.waitForFunction(()=>state().lyrics==='L0,L2',null,{timeout:5000});
 assert.equal((await page.evaluate(()=>state())).locked,true,'the lock is still on');
 // one Undo brings the lyric back, with the lock as it was
 await page.evaluate(()=>c.undo());await page.waitForFunction(()=>state().lyrics==='L0,L1,L2',null,{timeout:5000});assert.equal((await page.evaluate(()=>state())).locked,true);
 // the Delete key does the same
 await page.evaluate(()=>c.select({kind:'lyric',id:'L2'}));await page.locator('.timeline-panel').focus();await page.keyboard.press('Delete');
 await page.waitForFunction(()=>state().lyrics==='L0,L1',null,{timeout:5000});assert.equal(dialogs.length,3);
 await page.evaluate(()=>c.dispose());
 console.log('PASS かんたんで削除: 背景はそのまま、位置固定の歌詞は確かめてから、断れば変わらない、固定はそのまま、Undo、Deleteキー');
});
