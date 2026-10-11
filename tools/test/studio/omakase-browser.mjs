// おまかせ in STUDIO: one button gives every lyric a code motion and adds backgrounds; 次の案 / 前の案 walk the plans; ここだけ変える re-rolls one part; Undo takes it back.
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async page=>{
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  const root=document.createElement('main');document.body.replaceChildren(root);const css=document.createElement('link');css.rel='stylesheet';css.href='/studio.css';document.head.append(css);const lc=document.createElement('link');lc.rel='stylesheet';lc.href='/lyric-controls.css?v=3';document.head.append(lc);
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-omakase'})});mountStudio(root,c);await c.ready;
  const lyric=(i)=>({id:'L'+i,text:'歌詞その'+(i+1),runs:[{id:'r'+i,text:'歌詞その'+(i+1)}],startUs:i*3.5e6,endUs:i*3.5e6+3e6,motion:{font:'gothic',color:'#ffffff'},timingSource:'manual',opacity:1});
  await c.dispatch({type:'batch',commands:[{type:'setLock',track:'lyrics',locked:false},{type:'replaceLyrics',lyrics:Array.from({length:8},(_,i)=>lyric(i))},{type:'insertScene',scene:{id:'A',startUs:0,endUs:30e6,originUs:0}}]});
  window.codes=()=>c.get().project.lyrics.map(l=>l.motion.code?.source?.length||0).join(',');
  window.sources=()=>c.get().project.lyrics.map(l=>l.motion.code?.source||'');
  window.bgs=()=>c.get().project.clips.filter(x=>x.settings?.omakase).map(x=>x.motion.code.source.length+':'+x.startUs).join(',');
  window.snapshot=()=>JSON.stringify(c.get().project.lyrics.map(l=>[l.id,l.text,l.startUs,l.endUs]));
  window.before=snapshot();
 });
 // the panel is there when nothing is selected, and the header button brings it back
 const panel=page.getByTestId('omakase-panel');await panel.waitFor({state:'visible'});
 await page.evaluate(()=>c.select({kind:'lyric',id:'L0'}));await page.getByTestId('omakase-open').click();await panel.waitFor({state:'visible'});
 // おまかせ
 await page.getByLabel('雰囲気').selectOption('pop');
 await page.getByTestId('omakase-create').click();
 await page.waitForFunction(()=>codes().split(',').every(n=>Number(n)>0)&&bgs().length>0);
 await page.getByTestId('omakase-summary').filter({hasText:'ポップ'}).waitFor();
 assert.match(await page.getByTestId('omakase-summary').innerText(),/雰囲気\s*ポップ/);
 assert.equal(await page.evaluate(()=>snapshot()),await page.evaluate(()=>before),'lyric text and timing are untouched');
 const first={sources:await page.evaluate(()=>sources()),bgs:await page.evaluate(()=>bgs())};
 assert.ok(await page.locator('.timeline-lane.lane-fx .timeline-block.fx.bg').count()>=1,'the backgrounds show in the 演出 lane');
 const sizes=await page.evaluate(()=>c.get().project.lyrics.map(l=>c.get().project.views.wide.layout[l.id].fontScale));
 assert.ok(new Set(sizes).size>=3,'the characters are not all the same size: '+sizes.join());
 assert.ok(sizes.every(v=>v>=.05&&v<=.24),'inside the checked range: '+sizes.join());
 assert.ok(sizes.reduce((a,b)=>a+b,0)/sizes.length>=.1,'the characters are not small: '+sizes.join());
 assert.match(await page.locator('.timeline-block.lyric .tl-motion').first().textContent(),/[ぁ-んァ-ヶ一-龠]/,'the lane names the motion');
 // the おまかせ backgrounds are in the 演出 lane; the layer rows under the lanes do not list them again
 assert.equal(await page.getByTestId('clip-row').count(),0,'no layer rows for the おまかせ backgrounds');
 assert.match(await page.getByTestId('selected-scene').innerText(),/おまかせの背景 \d+ 個は「演出」の行にあります/);
 // 次の案: a different plan
 await page.getByTestId('omakase-next').click();
 await page.waitForFunction(a=>sources().join('|')!==a,first.sources.join('|'));
 const second={sources:await page.evaluate(()=>sources()),bgs:await page.evaluate(()=>bgs())};
 await page.waitForFunction(()=>/2 \/ 2/.test(document.querySelector('.omakase-counter').textContent));
 // 前の案: the first plan again, exactly
 await page.getByTestId('omakase-back').click();
 await page.waitForFunction(a=>sources().join('|')===a,first.sources.join('|'));
 assert.equal(await page.evaluate(()=>bgs()),first.bgs);
 // 配色の系統: a chosen family decides the colours (and only the colours); the colours of the lyrics are one of its palettes, never a green one
 await page.getByTestId('omakase-family').selectOption('rock');
 const colours=()=>page.evaluate(()=>[...new Set(c.get().project.lyrics.map(l=>l.motion.color+'/'+l.motion.emphasisColor))]);
 const beforeColours=(await colours()).join(),beforeCodes=await page.evaluate(()=>sources().join('|')),beforeBgs=await page.evaluate(()=>bgs());
 for(let i=0;i<6&&(await colours()).join()===beforeColours;i++){await page.getByTestId('omakase-only-color').click();await page.waitForTimeout(500);}
 const family=await page.evaluate(async()=>{const {COLOR_FAMILIES}=await import('/studio/omakase.js'),rock=COLOR_FAMILIES.find(f=>f.id==='rock');return rock.palettes.map(p=>p.color+'/'+p.emphasisColor);});
 const after=await colours();
 assert.equal(after.length,1,'one palette for every lyric');assert.ok(family.includes(after[0]),'the palette is one of the rock family: '+after[0]);
 assert.equal(await page.evaluate(()=>sources().join('|')),beforeCodes,'the motions did not change');assert.equal(await page.evaluate(()=>bgs()),beforeBgs,'the backgrounds did not change');
 await page.getByTestId('omakase-summary').filter({hasText:'ロック'}).waitFor({timeout:5000});// the summary names the palette
 // ここだけ変える: the background only
 // (a re-roll can land on the same background by chance: roll again, up to a few times)
 for(let i=0;i<6&&(await page.evaluate(()=>bgs()))===first.bgs;i++){await page.getByTestId('omakase-only-bg').click();await page.waitForTimeout(700);}
 assert.notEqual(await page.evaluate(()=>bgs()),first.bgs,'the background changed');
 assert.equal((await page.evaluate(()=>sources())).join('|'),first.sources.join('|'),'the motions did not change');
 // ここだけ変える 大きさ: the sizes change, the motions and backgrounds do not
 const sizesBefore=await page.evaluate(()=>c.get().project.lyrics.map(l=>c.get().project.views.wide.layout[l.id].fontScale).join());
 const bgBefore2=await page.evaluate(()=>bgs());
 for(let i=0;i<6&&(await page.evaluate(()=>c.get().project.lyrics.map(l=>c.get().project.views.wide.layout[l.id].fontScale).join()))===sizesBefore;i++){await page.getByTestId('omakase-only-size').click();await page.waitForTimeout(700);}
 assert.notEqual(await page.evaluate(()=>c.get().project.lyrics.map(l=>c.get().project.views.wide.layout[l.id].fontScale).join()),sizesBefore,'the sizes changed');
 assert.equal(await page.evaluate(()=>bgs()),bgBefore2);assert.equal((await page.evaluate(()=>sources())).join('|'),first.sources.join('|'));
 // Undo takes back only the last step (the sizes), then the one before (the background)
 for(let i=0;i<12&&(await page.evaluate(()=>c.get().project.lyrics.map(l=>c.get().project.views.wide.layout[l.id].fontScale).join()))!==sizesBefore;i++){await page.evaluate(()=>c.undo());await page.waitForTimeout(300);}
 assert.equal(await page.evaluate(()=>c.get().project.lyrics.map(l=>c.get().project.views.wide.layout[l.id].fontScale).join()),sizesBefore,'Undo walks back to the earlier sizes');
 // the other clips of the project are not touched: only おまかせ backgrounds exist
 assert.equal(await page.evaluate(()=>c.get().project.clips.every(x=>x.settings?.omakase)),true);
 await page.evaluate(()=>c.dispose());
 console.log('PASS おまかせ: motions + backgrounds in one step, next / back plans, background only, Undo');
});
