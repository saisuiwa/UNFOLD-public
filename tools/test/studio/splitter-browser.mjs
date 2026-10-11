// The border between the picture and the timeline can be dragged (or moved with the arrow keys); it is remembered and double click puts it back.
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async page=>{
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  localStorage.removeItem('unfold-studio-timeline-h');
  const root=document.createElement('main');document.body.replaceChildren(root);const css=document.createElement('link');css.rel='stylesheet';css.href='/studio.css';document.head.append(css);
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-splitter'})});mountStudio(root,c);await c.ready;
 });
 const heights=()=>page.evaluate(()=>({timeline:document.querySelector('.timeline-panel').getBoundingClientRect().height,stage:document.querySelector('.canvas-stage').getBoundingClientRect().height,stored:localStorage.getItem('unfold-studio-timeline-h')}));
 const start=await heights();
 const box=await page.locator('.splitter').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
 // drag up 120px: the timeline grows and the picture shrinks by about the same
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y-60,{steps:4});await page.mouse.move(x,y-120,{steps:4});await page.mouse.up();
 const up=await heights();
 assert.ok(Math.abs(up.timeline-start.timeline-120)<=3,'the timeline grew by the drag: '+(up.timeline-start.timeline));
 assert.ok(up.stage<start.stage-80,'the picture got smaller: '+start.stage+' -> '+up.stage);
 assert.equal(Math.round(Number(up.stored)),Math.round(up.timeline),'remembered');
 // drag down far: the picture grows, the timeline keeps a minimum
 const box2=await page.locator('.splitter').boundingBox();
 await page.mouse.move(x,box2.y+6);await page.mouse.down();await page.mouse.move(x,box2.y+700,{steps:6});await page.mouse.up();
 const down=await heights();assert.ok(down.timeline>=119&&down.timeline<up.timeline,'the timeline keeps a minimum: '+down.timeline);assert.ok(down.stage>up.stage,'the picture is bigger');
 // keyboard
 await page.locator('.splitter').focus();const before=(await heights()).timeline;await page.keyboard.press('ArrowUp');
 const key=(await heights()).timeline;assert.ok(Math.abs(key-before-24)<=2,'arrow up: '+(key-before));
 // double click puts it back
 await page.locator('.splitter').dblclick();
 const reset=await heights();assert.equal(reset.stored,null);assert.ok(Math.abs(reset.timeline-start.timeline)<=2,'back to the start: '+reset.timeline+' vs '+start.timeline);
 await page.evaluate(()=>c.dispose());
 console.log('PASS splitter: drag, minimum, keyboard, remembered, reset',{start:Math.round(start.timeline),up:Math.round(up.timeline)});
});
