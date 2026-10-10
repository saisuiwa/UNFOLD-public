// "もう一方の構図": the other composition opens beside the monitor, follows the playhead and edits, shows which composition it is, and closes.
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async page=>{
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  const root=document.createElement('main');document.body.replaceChildren(root);const css=document.createElement('link');css.rel='stylesheet';css.href='/studio.css';document.head.append(css);
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-compare'})});mountStudio(root,c);await c.ready;
  await c.dispatch({type:'batch',commands:[{type:'setLock',track:'lyrics',locked:false},{type:'replaceLyrics',lyrics:[{id:'L',text:'ひかり',runs:[],startUs:0,endUs:20e6,motion:{font:'gothic',color:'#ffffff'},timingSource:'manual',opacity:1}]},{type:'insertScene',scene:{id:'A',startUs:0,endUs:20e6,originUs:0}}]});
  window.calls=0;const original=c.compare;c.compare=async(...a)=>{window.calls++;return original(...a);};
 });
 const panel=page.getByTestId('comparison-panel'),toggle=page.getByTestId('comparison-toggle');
 assert.equal(await panel.isHidden(),true);assert.equal((await toggle.textContent()).trim(),'縦も並べる');
 await toggle.click();await panel.waitFor({state:'visible'});
 await page.waitForFunction(()=>window.calls>=1&&document.querySelector('.comparison').width===270);
 const size=await page.evaluate(()=>({w:document.querySelector('.comparison').width,h:document.querySelector('.comparison').height}));assert.deepEqual(size,{w:270,h:480},'the tall composition is drawn at 270x480');
 assert.match(await page.locator('.comparison-title').textContent(),/縦 9:16/);assert.equal((await toggle.textContent()).trim(),'もう一方を閉じる');
 // it follows the playhead
 const before=await page.evaluate(()=>window.calls);await page.evaluate(()=>c.seek(3e6));await page.waitForFunction(b=>window.calls>b,before);
 // it follows an edit
 const afterSeek=await page.evaluate(()=>window.calls);await page.evaluate(()=>c.dispatch({type:'setLyricAppearance',id:'L',patch:{motion:{font:'gothic',color:'#ff0000'}}}));await page.waitForFunction(b=>window.calls>b,afterSeek);
 // switching the main view flips which one is "the other"
 await page.evaluate(()=>c.setView('tall'));await page.waitForFunction(()=>/横 16:9/.test(document.querySelector('.comparison-title').textContent));
 await page.waitForFunction(()=>document.querySelector('.comparison').width===480);
 // close: hidden, and the playhead no longer renders it
 await page.getByRole('button',{name:'もう一方の構図を閉じる'}).click();assert.equal(await panel.isHidden(),true);
 const closed=await page.evaluate(()=>window.calls);await page.evaluate(()=>c.seek(5e6));await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.calls),closed,'no rendering while closed');
 assert.equal((await toggle.textContent()).trim(),'横も並べる');
 // and it opens again
 await toggle.click();await panel.waitFor({state:'visible'});await page.waitForFunction(b=>window.calls>b,closed);
 await page.evaluate(()=>c.dispose());console.log('PASS comparison: follows playhead and edits, names the composition, closes and reopens');
});
