// 「新しいMV」の押し間違いから戻れる: 中身のある作品では確認が出る（やめれば何も変わらない）。作る時は今の作品の名前を変えられ、
// 作った後は「↩ さっきの作品に戻る」で前の作品に戻れる。「保存した作品」は、保存した日時・長さ・歌詞の数・最初の歌詞つきで、新しい順。
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  const root=document.createElement('main');document.body.replaceChildren(root);for(const href of ['/studio.css','/lyric-controls.css?v=3']){const css=document.createElement('link');css.rel='stylesheet';css.href=href;document.head.append(css);}
  const store=await openStudioStore({dbName:'unfold-studio-newproject'});for(const p of await store.listProjects())await new Promise(r=>{const q=indexedDB.open('unfold-studio-newproject');q.onsuccess=()=>{const tx=q.result.transaction('projects','readwrite');tx.objectStore('projects').delete(p.id);tx.oncomplete=()=>{q.result.close();r();};};});
  try{localStorage.removeItem('unfold-studio-saved-at');localStorage.removeItem('unfold-studio-current');}catch{}
  window.c=createController({store});mountStudio(root,c);await c.ready;
  const T=['ひとりでも 空はひらくから','折り目が光に変わっていく'];
  const lyric=i=>({id:'L'+i,text:T[i],runs:[{id:'r'+i,text:T[i]}],startUs:Math.round((1+i*3)*1e6),endUs:Math.round((1+i*3+2.6)*1e6),motion:{font:'gothic',color:'#ffffff'},timingSource:'manual',opacity:1});
  await c.dispatch({type:'batch',commands:[{type:'setLock',track:'lyrics',locked:false},{type:'replaceLyrics',lyrics:T.map((_,i)=>lyric(i))},{type:'setLock',track:'lyrics',locked:true}]});
  await c.saveBrowser();
 },null);
 const first=await page.evaluate(()=>c.get().project.id);
 // 1) cancel: nothing changes
 await page.getByTestId('new-project').click();
 const dlg=page.locator('dialog.confirm-new');await dlg.waitFor();
 assert.match(await dlg.innerText(),/新しいMVを作りますか/);assert.match(await dlg.innerText(),/歌詞2行/);assert.match(await dlg.innerText(),/ひとりでも/);
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.testid),'new-project-cancel','やめる has the focus (Enter does not throw the work away)');
 await page.getByTestId('new-project-cancel').click();await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>c.get().project.id),first,'cancel keeps the work open');
 assert.equal(await page.locator('dialog').count(),0);
 // Escape also cancels
 await page.getByTestId('new-project').click();await dlg.waitFor();await page.keyboard.press('Escape');await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>c.get().project.id),first,'Escape keeps the work open');
 // 2) rename the old work and make a new one
 await page.getByTestId('new-project').click();await dlg.waitFor();
 await page.getByTestId('new-project-old-name').fill('ひとりでも（本番）');await page.screenshot({path:'tools/out/studio/new-project-confirm.png'});await page.getByTestId('new-project-ok').click();
 // then the window for the song, lyric file and pictures (new-mv-materials-browser.mjs): this time nothing is put in
 await page.locator('dialog.fill-new').waitFor();await page.getByTestId('new-fill-later').click();
 await page.waitForFunction(id=>c.get().project.id!==id&&c.get().project.lyrics.length===0,first,{timeout:10000});
 const back=page.getByTestId('back-to-previous');assert.equal(await back.isVisible(),true,'the way back is offered');
 assert.match(await page.locator('.notice').innerText(),/ひとりでも（本番）/);await page.screenshot({path:'tools/out/studio/new-project-back.png'});
 // 3) the saved list: newest first, with time and contents; the open one is marked and cannot be clicked
 await page.getByTestId('saved-projects').click();const list=page.locator('dialog.saved-dialog');await list.waitFor();
 await page.screenshot({path:'tools/out/studio/saved-projects.png'});
 const items=await page.getByTestId('saved-item').allInnerTexts();
 assert.equal(items.length,2,JSON.stringify(items));
 assert.match(items[0],/いま開いている作品/);assert.match(items[1],/ひとりでも（本番）/);assert.match(items[1],/に保存/);assert.match(items[1],/歌詞2行/);assert.match(items[1],/「ひとりでも 空はひらくから」/);
 assert.equal(await page.getByTestId('saved-item').first().isDisabled(),true);
 await list.getByRole('button',{name:'閉じる'}).click();
 // 4) back: the old work opens with its new name, the button goes away
 await back.click();
 await page.waitForFunction(id=>c.get().project.id===id,first,{timeout:10000});
 const p=await page.evaluate(()=>({name:c.get().project.name,lyrics:c.get().project.lyrics.length}));
 assert.deepEqual(p,{name:'ひとりでも（本番）',lyrics:2});
 assert.equal(await back.isVisible(),false);
 // 5) an empty work: no question
 await page.evaluate(()=>c.newProject());await page.waitForFunction(id=>c.get().project.id!==id,first);
 const emptyId=await page.evaluate(()=>c.get().project.id);
 await page.getByTestId('new-project').click();await page.waitForFunction(id=>c.get().project.id!==id,emptyId,{timeout:10000});
 await page.locator('dialog.fill-new').waitFor();assert.equal(await page.locator('dialog.confirm-new').count(),0,'no question for an empty work (only the materials window)');
 await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});assert.deepEqual(await page.evaluate(()=>{const p=c.get().project;return [p.audio.length,p.lyrics.length,p.scenes.length];}),[0,0,0],'Escape is あとで入れる');
 assert.deepEqual(errors,[]);
 console.log('new-project-browser: ok');
},{mode:null});
