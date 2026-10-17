// ショートは上のバーの「ショート」から開く窓（右のパネルの一番下に埋もれない）。開いたまま再生位置を動かせて、「いまの位置を開始に／終了に」で区間を決められる。
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  const root=document.createElement('main');document.body.replaceChildren(root);for(const href of ['/studio.css','/lyric-controls.css?v=3']){const css=document.createElement('link');css.rel='stylesheet';css.href=href;document.head.append(css);}
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-shortpanel'})});mountStudio(root,c);await c.ready;
 });
 const open=page.getByTestId('short-open'),panel=page.getByTestId('short-panel');
 assert.equal(await open.isVisible(),true);assert.equal(await panel.isVisible(),false);
 await open.click();assert.equal(await panel.isVisible(),true);assert.equal(await open.getAttribute('aria-pressed'),'true');
 // not modal: the playhead can move while it is open
 await page.getByRole('button',{name:'ショートを追加',exact:true}).click();
 await page.evaluate(()=>c.seek(4e6));await page.waitForFunction(()=>c.get().position===4e6);
 await page.getByTestId('short-start-here').click();assert.equal(await page.getByLabel('ショート開始秒').inputValue(),'4.000');
 await page.evaluate(()=>c.seek(19e6));await page.waitForFunction(()=>c.get().position===19e6);
 await page.getByTestId('short-end-here').click();assert.equal(await page.getByLabel('ショート終了秒').inputValue(),'19.000');
 await page.getByRole('button',{name:'区間を確定',exact:true}).click();
 await page.getByTestId('short-summary').filter({hasText:'15.000秒'}).waitFor();
 await open.filter({hasText:'ショート（1）'}).waitFor();
 await page.screenshot({path:'tools/out/studio/short-panel.png'});
 await page.getByRole('button',{name:'ショートの窓を閉じる'}).click();assert.equal(await panel.isVisible(),false);assert.equal(await open.getAttribute('aria-pressed'),'false');
 assert.deepEqual(errors,[]);
 console.log('short-panel-browser: ok');
},{mode:null});
