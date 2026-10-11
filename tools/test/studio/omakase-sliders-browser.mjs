// おまかせ panel: the size slider (average size of all lyrics, percent), the opacity slider, and the colour family select acting at once.
// Each is one undoable step; none of them touches the lyric text, timing or motions.
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async page=>{
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  const root=document.createElement('main');document.body.replaceChildren(root);
  for(const href of ['/studio.css','/lyric-controls.css?v=3']){const css=document.createElement('link');css.rel='stylesheet';css.href=href;document.head.append(css);}
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-omakase-sliders'})});mountStudio(root,c);await c.ready;
  const lyric=i=>({id:'L'+i,text:'歌詞その'+(i+1),runs:[{id:'r'+i,text:'歌詞その'+(i+1)}],startUs:i*3.5e6,endUs:i*3.5e6+3e6,motion:{font:'gothic',color:'#ffffff'},timingSource:'manual',opacity:1});
  await c.dispatch({type:'batch',commands:[{type:'setLock',track:'lyrics',locked:false},{type:'replaceLyrics',lyrics:Array.from({length:6},(_,i)=>lyric(i))},{type:'insertScene',scene:{id:'A',startUs:0,endUs:30e6,originUs:0}}]});
  window.sizes=view=>c.get().project.lyrics.map(l=>c.get().project.views[view].layout[l.id].fontScale);
  window.opacities=()=>c.get().project.lyrics.map(l=>l.opacity);
  window.sources=()=>c.get().project.lyrics.map(l=>l.motion.code?.source||'');
  window.colours=()=>[...new Set(c.get().project.lyrics.map(l=>l.motion.color+'/'+l.motion.emphasisColor))];
  window.snapshot=()=>JSON.stringify(c.get().project.lyrics.map(l=>[l.id,l.text,l.startUs,l.endUs]));
  window.before=snapshot();
  window.setRange=(testid,value)=>{const input=document.querySelector(`[data-testid="${testid}"]`);input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};
 });
 await page.getByTestId('omakase-panel').waitFor({state:'visible'});
 const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
 // the sliders are in the panel, with their numbers
 assert.equal(await page.getByTestId('omakase-size').getAttribute('aria-label'),'文字の大きさの目安（%）');
 assert.equal(await page.getByTestId('omakase-opacity').getAttribute('aria-label'),'文字の不透明度（%）');
 // 1. before any plan: the size slider gives every lyric that size, in both views, as one step
 await page.evaluate(()=>setRange('omakase-size',20));
 await page.waitForFunction(()=>sizes('wide').every(v=>v===.2));
 assert.deepEqual(await page.evaluate(()=>sizes('tall')),Array(6).fill(.2));
 assert.match(await page.locator('.omakase-slider output').first().innerText(),/20%/);
 await page.evaluate(()=>c.undo());
 await page.waitForFunction(()=>sizes('wide').every(v=>v!==.2));
 // 2. the opacity slider: every lyric, one step
 await page.evaluate(()=>setRange('omakase-opacity',50));
 await page.waitForFunction(()=>opacities().every(v=>v===.5));
 await page.evaluate(()=>c.undo());
 await page.waitForFunction(()=>opacities().every(v=>v===1));
 await page.evaluate(()=>setRange('omakase-opacity',50));
 await page.waitForFunction(()=>opacities().every(v=>v===.5));
 // 3. with a plan: the slider moves the average, motions / backgrounds / colours stay
 await page.getByTestId('omakase-create').click();
 await page.waitForFunction(()=>sources().every(s=>s.length>0));
 const planned={sources:await page.evaluate(()=>sources()),colours:await page.evaluate(()=>colours()),sizes:await page.evaluate(()=>sizes('wide'))};
 assert.ok(mean(planned.sizes)>=.1,'bigger than the old default: '+planned.sizes.join());
 assert.equal(await page.evaluate(()=>opacities().every(v=>v===.5)),true,'the opacity is kept by おまかせ');
 await page.evaluate(()=>setRange('omakase-size',8));
 await page.waitForFunction(m=>sizes('wide').reduce((x,y)=>x+y,0)/6<m*.8,mean(planned.sizes));
 assert.deepEqual(await page.evaluate(()=>sources()),planned.sources,'motions did not change');
 assert.deepEqual(await page.evaluate(()=>colours()),planned.colours,'colours did not change');
 assert.ok(mean(await page.evaluate(()=>sizes('wide')))<.1);
 assert.equal(await page.evaluate(()=>snapshot()),await page.evaluate(()=>before),'lyric text and timing untouched');
 await page.evaluate(()=>c.undo());
 await page.waitForFunction(s=>JSON.stringify(sizes('wide'))===s,JSON.stringify(planned.sizes));
 // the same slider position again gives the same sizes (the plan is replayable)
 await page.evaluate(()=>setRange('omakase-size',8));await page.waitForTimeout(300);
 const eight=await page.evaluate(()=>sizes('wide'));await page.evaluate(()=>c.undo());await page.evaluate(()=>setRange('omakase-size',8));await page.waitForTimeout(300);
 assert.deepEqual(await page.evaluate(()=>sizes('wide')),eight);
 // 4. choosing a colour family applies the colours at once
 await page.getByTestId('omakase-family').selectOption('rock');
 await page.waitForFunction(()=>colours().length===1&&/#ff3b3b|#ff4d4d|#ffd23f|#ffffff/i.test(colours()[0]));
 const rock=await page.evaluate(async()=>{const {COLOR_FAMILIES}=await import('/studio/omakase.js');return COLOR_FAMILIES.find(f=>f.id==='rock').palettes.map(p=>p.color+'/'+p.emphasisColor);});
 assert.ok(rock.includes((await page.evaluate(()=>colours()))[0]));
 assert.deepEqual(await page.evaluate(()=>sources()),planned.sources,'motions still the same');
 await page.evaluate(()=>c.dispose());
 console.log('PASS おまかせ sliders: size (before and after a plan), opacity, family at once; one Undo each');
});
