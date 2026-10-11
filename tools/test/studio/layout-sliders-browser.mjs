// The inspector's numbers (opacity, position, scale, rotation ...) have a slider next to them; both stay in step and each change is one step.
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async page=>{
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  const root=document.createElement('main');document.body.replaceChildren(root);
  for(const href of ['/studio.css','/lyric-controls.css?v=3']){const css=document.createElement('link');css.rel='stylesheet';css.href=href;document.head.append(css);}
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-layout-sliders'})});mountStudio(root,c);await c.ready;
  await c.addText();
  window.clip=()=>c.get().project.clips[0];
  window.layout=()=>c.get().project.views.wide.layout[clip().id];
  c.select({kind:'clip',id:clip().id});
 });
 const range=title=>page.locator(`input.slider-range[title="${title}"]`);
 const number=label=>page.getByLabel(label,{exact:true});
 const move=(title,value)=>range(title).evaluate((i,v)=>{i.value=String(v);i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));},value);
 for(const title of ['不透明度','配置 X','配置 Y','拡大率','回転'])await range(title).waitFor({state:'attached'});
 // the number follows the slider while it moves, and the value is stored when it is let go
 await range('配置 X').evaluate(i=>{i.value='0.2';i.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await number('配置 X').inputValue(),'0.2');
 await move('配置 X',0.2);
 await page.waitForFunction(()=>layout().x===0.2);
 await move('配置 Y',0.7);await page.waitForFunction(()=>layout().y===0.7);
 await move('拡大率',1.5);await page.waitForFunction(()=>layout().scale===1.5);
 await move('回転',-30);await page.waitForFunction(()=>layout().rotation===-30);
 await move('不透明度',0.5);await page.waitForFunction(()=>clip().opacity===0.5);
 // typing a number moves the slider
 await number('配置 X').fill('0.9');await number('配置 X').dispatchEvent('change');
 await page.waitForFunction(()=>layout().x===0.9);
 assert.equal(await range('配置 X').inputValue(),'0.9');
 // each change is one Undo step
 await page.evaluate(()=>c.undo());await page.waitForFunction(()=>layout().x===0.2);
 await page.evaluate(()=>c.dispose());
 console.log('PASS inspector sliders: opacity, position, scale, rotation; number and slider in step; one Undo each');
});
