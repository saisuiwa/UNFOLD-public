// A font file chosen in STUDIO's lyric panel becomes an asset of the project, draws the lyric, is reused for the same file, and a built-in font drops it again.
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
const FONT=new URL('../../../app/vendor/motion-fonts/dot.ttf',import.meta.url).pathname;
await withStudioPage(async page=>{
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  const root=document.createElement('main');document.body.replaceChildren(root);const css=document.createElement('link');css.rel='stylesheet';css.href='/studio.css';document.head.append(css);const lc=document.createElement('link');lc.rel='stylesheet';lc.href='/lyric-controls.css?v=3';document.head.append(lc);
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-lyric-font'})});mountStudio(root,c);await c.ready;
  const lyric=(id,text,s,e)=>({id,text,runs:[{id:id+'r',text,emphasis:false}],startUs:s,endUs:e,motion:{font:'gothic',color:'#ffffff'},timingSource:'manual',opacity:1});
  await c.dispatch({type:'batch',commands:[{type:'setLock',track:'lyrics',locked:false},{type:'replaceLyrics',lyrics:[lyric('L1','いちまいの えを ここに',0,8e6),lyric('L2','ぐしゃっと くずれて',10e6,18e6)]},{type:'insertScene',scene:{id:'A',startUs:0,endUs:30e6,originUs:0}}]});
  window.lyricOf=id=>c.get().project.lyrics.find(l=>l.id===id);window.fonts=()=>Object.values(c.get().project.assets).filter(a=>a.type==='font/ttf');
  c.select({kind:'lyric',id:'L1'});
 });
 await page.locator('#lm-quick').waitFor({state:'visible'});
 await page.locator('.lq-tabs button',{hasText:'書体'}).click();
 // PC font / font file buttons are offered here now
 assert.equal(await page.getByRole('button',{name:'フォントファイル'}).isVisible(),true);assert.equal(await page.getByRole('button',{name:'PCのフォント'}).isVisible(),true);
 const input=page.locator('#lm-quick input[type=file][accept*=".ttf"]');
 await input.setInputFiles(FONT);
 await page.waitForFunction(()=>/^file:/.test(lyricOf('L1').motion.font)&&!!lyricOf('L1').motion.fontAssetId,null,{timeout:30000});
 const first=await page.evaluate(()=>({id:lyricOf('L1').motion.fontAssetId,fonts:fonts().length,type:c.get().project.assets[lyricOf('L1').motion.fontAssetId]?.type,other:lyricOf('L2').motion.font}));
 assert.equal(first.fonts,1);assert.equal(first.type,'font/ttf');assert.equal(first.other,'gothic','only the selected lyric changed');
 // it draws: the monitor shows text and the engine reports no problem
 await page.evaluate(()=>c.seek(2e6));await page.waitForFunction(()=>document.querySelector('[data-testid="studio-time"]').textContent.startsWith('00:02'));
 const pixels=await page.evaluate(async()=>{await new Promise(r=>setTimeout(r,800));const cv=document.querySelector('canvas[aria-label="作品プレビュー"]'),x=cv.getContext('2d'),d=x.getImageData(0,0,cv.width,cv.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]>200&&d[i+2]>200)n++;return {n,message:c.get().message};});
 assert.ok(pixels.n>300,'the lyric is drawn with the chosen font: '+pixels.n);assert.equal(pixels.message,'');
 // the same file for the other lyric reuses the asset
 await page.evaluate(()=>c.select({kind:'lyric',id:'L2'}));await page.locator('.lq-tabs button',{hasText:'書体'}).click();
 await page.locator('#lm-quick input[type=file][accept*=".ttf"]').setInputFiles(FONT);
 await page.waitForFunction(()=>/^file:/.test(lyricOf('L2').motion.font));
 assert.equal(await page.evaluate(()=>fonts().length),1,'one asset for the same file');assert.equal(await page.evaluate(()=>lyricOf('L2').motion.fontAssetId),first.id);
 // a built-in font drops the asset reference again
 await page.getByLabel('その場で書体').selectOption('mincho');
 await page.waitForFunction(()=>lyricOf('L2').motion.font==='mincho'&&!lyricOf('L2').motion.fontAssetId);
 assert.equal(await page.evaluate(()=>lyricOf('L1').motion.fontAssetId),first.id,'the other lyric keeps its font');
 await page.evaluate(()=>c.dispose());
 console.log('PASS STUDIO font file: stored as a project asset, drawn, reused, dropped for a built-in font');
});
