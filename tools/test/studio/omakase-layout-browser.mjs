// おまかせ 文字の配置: lines no longer all sit in the middle and words have different sizes ("私"大 "は"小 "元気"大 "です"小); 真ん中に揃える brings
// everything back; ここだけ変える 配置・大小 re-rolls the places and sizes only (motions, colours and backgrounds stay); the sizes show in the project's runs.
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async page=>{
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  const root=document.createElement('main');document.body.replaceChildren(root);const css=document.createElement('link');css.rel='stylesheet';css.href='/studio.css';document.head.append(css);const lc=document.createElement('link');lc.rel='stylesheet';lc.href='/lyric-controls.css';document.head.append(lc);
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-omakase-layout'})});mountStudio(root,c);await c.ready;
  const T=['私は元気です','かたちをほどいて自由に。','君と見た夏の終わりの空は今でも覚えているよ','走り出せ、夜明けまで','ありがとう','もっと強く、もっと高く','今日も明日もずっと','夜に溶けていく'];
  const lyric=(i)=>({id:'L'+i,text:T[i],runs:[{id:'r'+i,text:T[i]}],startUs:i*3.5e6,endUs:i*3.5e6+3e6,motion:{font:'gothic',color:'#ffffff'},timingSource:'manual',opacity:1});
  await c.dispatch({type:'batch',commands:[{type:'setLock',track:'lyrics',locked:false},{type:'replaceLyrics',lyrics:T.map((_,i)=>lyric(i))},{type:'insertScene',scene:{id:'A',startUs:0,endUs:30e6,originUs:0}}]});
  window.places=()=>c.get().project.lyrics.map(l=>{const v=c.get().project.views.wide.layout[l.id];return [v.x,v.y,v.scale,v.rotation].join('/');});
  window.tallPlaces=()=>c.get().project.lyrics.map(l=>{const v=c.get().project.views.tall.layout[l.id];return [v.x,v.y,v.scale,v.rotation].join('/');});
  window.sized=()=>c.get().project.lyrics.map(l=>l.runs.filter(r=>r.scale).length);
  window.codes=()=>c.get().project.lyrics.map(l=>l.motion.code?.source?.length||0).join(',');
  window.keysOf=()=>c.get().project.lyrics.map(l=>l.motion.code?.source||'').join('|');
  window.texts=()=>JSON.stringify(c.get().project.lyrics.map(l=>[l.id,l.text,l.runs.map(r=>r.text).join(''),l.startUs,l.endUs]));
  window.before=texts();
 });
 const panel=page.getByTestId('omakase-panel');await panel.waitFor({state:'visible'});
 assert.equal(await page.getByTestId('omakase-layout').inputValue(),'spread','spread is the default');
 await page.getByLabel('雰囲気').selectOption('pop');
 await page.getByTestId('omakase-create').click();
 await page.waitForFunction(()=>codes().split(',').every(n=>Number(n)>0)&&sized().some(n=>n>0));
 // places differ, inside the picture, in both views; some words have sizes; the lyric text and timing are untouched (the runs only got split)
 const wide=await page.evaluate(()=>places()),tall=await page.evaluate(()=>tallPlaces());
 assert.ok(new Set(wide).size>=5,'the lines sit in different places: '+wide.join(' '));
 assert.ok(new Set(tall).size>=5,'and in the tall view too');
 assert.ok(wide.some(p=>p!=='0.5/0.5/1/0'),'not everything in the middle');
 for(const p of [...wide,...tall]){const [x,y,s]=p.split('/').map(Number);assert.ok(x>=.04&&x<=.96&&y>=.04&&y<=.96&&s>0&&s<=1,'inside: '+p);}
 assert.ok((await page.evaluate(()=>sized())).filter(n=>n>0).length>=4,'words have sizes');
 assert.equal(await page.evaluate(()=>texts()),await page.evaluate(()=>before),'text, timing and the glyph text are untouched');
 await page.getByTestId('omakase-summary').filter({hasText:'位置と語の大小をばらけさせる'}).waitFor({timeout:8000});
 // ここだけ変える 配置・大小: only the places and sizes change
 const keep={codes:await page.evaluate(()=>keysOf()),places:wide.join()};
 for(let i=0;i<6&&(await page.evaluate(()=>places())).join()===keep.places;i++){await page.getByTestId('omakase-only-layout').click();await page.waitForTimeout(600);}
 assert.notEqual((await page.evaluate(()=>places())).join(),keep.places,'the places changed');
 assert.equal(await page.evaluate(()=>keysOf()),keep.codes,'the motions did not change');
 // 真ん中に揃える: everything back in the middle, no sizes
 await page.getByTestId('omakase-layout').selectOption('center');
 await page.getByTestId('omakase-next').click();
 await page.waitForFunction(()=>places().every(p=>p==='0.5/0.5/1/0')&&sized().every(n=>n===0));
 assert.equal(await page.evaluate(()=>texts()),await page.evaluate(()=>before),'text and timing still untouched');
 // Undo takes the last おまかせ step back in one go
 await page.keyboard.press('Control+z').catch(()=>{});
 console.log('PASS おまかせ 文字の配置: spread places and word sizes in both views, 配置・大小 only, 真ん中に揃える', JSON.stringify({places:wide.slice(0,4)}));
});
