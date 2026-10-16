// The left edge of the right panel can be dragged (or moved with the arrow keys) to make the panel wider or narrower; it is remembered, double click puts it back.
// The おまかせ panel fits its column (no sideways scroll at the default width) and uses the room when the panel is made wider.
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async page=>{
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  localStorage.removeItem('unfold-studio-inspector-w');
  const root=document.createElement('main');document.body.replaceChildren(root);const css=document.createElement('link');css.rel='stylesheet';css.href='/studio.css';document.head.append(css);const lc=document.createElement('link');lc.rel='stylesheet';lc.href='/lyric-controls.css?v=3';document.head.append(lc);
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-colsplit'})});mountStudio(root,c);await c.ready;
 });
 const widths=()=>page.evaluate(()=>({aside:document.querySelector('.inspector').getBoundingClientRect().width,preview:document.querySelector('.preview').getBoundingClientRect().width,stored:localStorage.getItem('unfold-studio-inspector-w'),slotOverflow:document.querySelector('.inspector-slot').scrollWidth-document.querySelector('.inspector-slot').clientWidth}));
 const start=await widths();
 assert.ok(Math.abs(start.aside-262)<=2,'default width '+start.aside);
 assert.ok(start.slotOverflow<=1,'the おまかせ panel does not scroll sideways at the default width: '+start.slotOverflow);
 const box=await page.locator('.col-splitter').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
 // drag left 120px: the right panel grows by about that much, the picture shrinks
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-60,y,{steps:4});await page.mouse.move(x-120,y,{steps:4});await page.mouse.up();
 const wide=await widths();
 assert.ok(Math.abs(wide.aside-start.aside-120)<=3,'the panel grew by the drag: '+(wide.aside-start.aside));
 assert.ok(wide.preview<start.preview-80,'the picture got narrower');
 assert.equal(Math.round(Number(wide.stored)),Math.round(wide.aside),'remembered');
 assert.ok(wide.slotOverflow<=1,'no sideways scroll when wider');
 // drag right far: the panel keeps a minimum
 const box2=await page.locator('.col-splitter').boundingBox();
 await page.mouse.move(box2.x+4,box2.y+box2.height/2);await page.mouse.down();await page.mouse.move(box2.x+500,box2.y+box2.height/2,{steps:6});await page.mouse.up();
 const narrow=await widths();assert.ok(narrow.aside>=239&&narrow.aside<wide.aside,'the minimum holds: '+narrow.aside);
 // drag left far: it keeps a maximum (at most 60% of the window, 760px) and the picture keeps room
 const box3=await page.locator('.col-splitter').boundingBox();
 await page.mouse.move(box3.x+4,box3.y+box3.height/2);await page.mouse.down();await page.mouse.move(2,box3.y+box3.height/2,{steps:8});await page.mouse.up();
 const max=await widths();assert.ok(max.aside<=761&&max.aside>wide.aside,'the maximum holds: '+max.aside);assert.ok(max.preview>=250,'the picture keeps room: '+max.preview);
 // keyboard
 await page.locator('.col-splitter').dblclick();
 await page.locator('.col-splitter').focus();const before=(await widths()).aside;await page.keyboard.press('ArrowLeft');
 const key=(await widths()).aside;assert.ok(Math.abs(key-before-24)<=2,'arrow left widens: '+(key-before));
 await page.keyboard.press('ArrowRight');assert.ok(Math.abs((await widths()).aside-before)<=2,'arrow right narrows back');
 // a reload keeps the width
 await page.evaluate(()=>{localStorage.setItem('unfold-studio-inspector-w','400');});
 await page.evaluate(async()=>{const {mountStudio}=await import('/studio/view.js');const root=document.createElement('main');document.body.replaceChildren(root);mountStudio(root,c);});
 await page.waitForTimeout(300);
 assert.ok(Math.abs((await widths()).aside-400)<=2,'the saved width is used: '+(await widths()).aside);
 // double click puts it back
 await page.locator('.col-splitter').dblclick();
 const reset=await widths();assert.equal(reset.stored,null);assert.ok(Math.abs(reset.aside-start.aside)<=2,'back to the start: '+reset.aside);
 await page.evaluate(()=>c.dispose());
 console.log('PASS right panel width: drag, limits, keys, remembered, double click resets; おまかせ fits its column');
});
