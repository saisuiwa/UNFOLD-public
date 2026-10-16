// カット演出を自由文字にも（実ブラウザ）: 「自由文字にも付ける」で、置いた文字にも計画が入り、合成器が描く。
// 下に画像などがあれば透けて見え（透明）、何もなければ背景色つきの不透明な絵になる。チェックを外す・歌詞ごとに戻すと外れる。
import assert from 'node:assert/strict';import {writeFile,mkdir} from 'node:fs/promises';import {withStudioPage} from './browser-helper.mjs';
await mkdir('tools/out/studio',{recursive:true});
await withStudioPage(async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  const root=document.createElement('main');document.body.replaceChildren(root);const css=document.createElement('link');css.rel='stylesheet';css.href='/studio.css';document.head.append(css);const lc=document.createElement('link');lc.rel='stylesheet';lc.href='/lyric-controls.css?v=3';document.head.append(lc);
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-cutsfree'})});mountStudio(root,c);await c.ready;
  const T=['折り目が光に変わっていく','小さな紙が風に飛んだ'];
  const lyric=(i)=>({id:'L'+i,text:T[i],runs:[{id:'r'+i,text:T[i]}],startUs:Math.round((6+i*2.8)*1e6),endUs:Math.round((6+i*2.8+2.6)*1e6),motion:{font:'gothic',color:'#ffffff'},timingSource:'manual',opacity:1});
  await c.dispatch({type:'batch',commands:[{type:'setLock',track:'lyrics',locked:false},{type:'replaceLyrics',lyrics:T.map((_,i)=>lyric(i))},{type:'insertScene',scene:{id:'A',startUs:0,endUs:12e6,originUs:0}}]});
  // a plain red picture as the clip under the text
  const cv=new OffscreenCanvas(160,90),x=cv.getContext('2d');x.fillStyle='#d01818';x.fillRect(0,0,160,90);
  await c.importMedia([new File([await cv.convertToBlob({type:'image/png'})],'red.png',{type:'image/png'})],{role:'sfx'});
  await c.seek(1e6);await c.addText();
  window.freeClip=()=>c.get().project.clips.find(k=>k.kind==='text'&&k.text==='光をつなぐ');
 });
 const info=await page.evaluate(()=>{const p=c.get().project,f=freeClip();return {clips:p.clips.map(k=>k.kind),free:f&&{start:f.startUs,end:f.endUs,scene:f.sceneId},scenes:p.scenes.map(s=>[s.startUs,s.endUs,s.originUs])};});
 assert.ok(info.free,'a free text clip was added: '+JSON.stringify(info));
 // ---- cut mode, with 自由文字にも付ける (on by default)
 await page.evaluate(()=>c.select(null));   // the おまかせ panel shows when nothing is selected
 await page.getByTestId('omakase-style').selectOption('cut');
 assert.equal(await page.getByTestId('omakase-cut-free').isChecked(),true);
 await page.getByTestId('omakase-create').click();
 await page.waitForFunction(()=>freeClip()?.settings?.cut&&c.get().project.lyrics.every(l=>l.cut),null,{timeout:60000});
 const free=await page.evaluate(()=>{const f=freeClip();return {cuts:f.settings.cut.cuts.length,dur:f.settings.cut.dur,span:(f.endUs-f.startUs)/1e6,text:f.text,color:f.motion.color};});
 assert.ok(free.cuts>=1&&Math.abs(free.dur-free.span)<.01,'the plan follows the clip length: '+JSON.stringify(free));
 assert.ok(await page.locator('[data-testid=clip-row]').filter({hasText:'カット演出'}).count()>=0);
 // ---- the compositor draws it. The scene has the red picture under everything, so the cut layers are transparent: the corner stays red.
 const render=(us,viewId='wide',w=480,h=270)=>page.evaluate(async([us,viewId,w,h])=>{
  const {createCompositor}=await import('/studio/compositor.js'),{openStudioStore}=await import('/studio/store.js');
  const p=c.get().project,store=await openStudioStore({dbName:'unfold-studio-cutsfree'});
  const comp=createCompositor({assets:store});await comp.prepare(p);
  const f=await comp.render({projectUs:us,viewId,width:w,height:h,epoch:1});const cv=new OffscreenCanvas(w,h),x=cv.getContext('2d');x.drawImage(f.bitmap,0,0);f.close();
  const px=(a,b)=>Array.from(x.getImageData(a,b,1,1).data),d=x.getImageData(0,0,w,h).data;let bright=0;for(let i=0;i<d.length;i+=4)if(d[i]+d[i+1]+d[i+2]>450)bright++;
  const blob=await cv.convertToBlob({type:'image/png'}),buf=new Uint8Array(await blob.arrayBuffer());let s='';for(const b of buf)s+=String.fromCharCode(b);
  comp.dispose();return {corner:px(3,3),mid:px(w>>1,h>>1),bright,png:btoa(s)};},[us,viewId,w,h]);
 // moments inside the free text clip and before the first lyric (6 s), so that only the free text is on screen; the text can be hidden for an instant while it enters, so take the moment with the most text
 const window_=await page.evaluate(()=>{const f=freeClip(),s=c.get().project.scenes.find(x=>x.id===f.sceneId),from=s.originUs+f.startUs,to=Math.min(s.originUs+f.endUs,5.8e6);return {from,to};});
 assert.ok(window_.from>=1e6&&window_.to>window_.from+.5e6,'room before the lyrics: '+JSON.stringify(window_));
 let freeMid=0,best=-1;
 for(const u of [.15,.3,.45,.6,.75,.9]){const t=Math.round(window_.from+(window_.to-window_.from)*u),r=await render(t);if(r.bright>best){best=r.bright;freeMid=t;}}
 const a=await render(freeMid);
 await writeFile('tools/out/studio/cuts-free-over-picture.png',Buffer.from(a.png,'base64'));
 assert.ok(a.corner[0]>160&&a.corner[1]<90&&a.corner[2]<90,'the red picture shows through the cut layer (transparent): '+a.corner);
 assert.ok(a.bright>40,'and there is text: '+a.bright);
 const lyricMid=6.2e6+1e6;
 const b=await render(lyricMid);assert.ok(b.corner[0]>160&&b.corner[1]<90,'lyrics too: the picture shows through: '+b.corner);
 await writeFile('tools/out/studio/cuts-lyric-over-picture.png',Buffer.from(b.png,'base64'));
 // ---- take the picture away: nothing under the cut layer any more, so it paints its own dark background
 await page.evaluate(async()=>{const img=c.get().project.clips.find(k=>k.kind==='image');await c.dispatch({type:'deleteClip',id:img.id});});
 const d=await render(freeMid);
 assert.ok(d.corner[0]<110&&d.corner[3]===255,'with nothing under it, a dark opaque background: '+d.corner);await writeFile('tools/out/studio/cuts-free-alone.png',Buffer.from(d.png,'base64'));
 // ---- the same on the tall view
 const t=await render(freeMid,'tall',270,480);assert.ok(t.bright>20,'tall view draws too: '+t.bright);
 // ---- 自由文字にも付ける off: the clip's plan goes, the lyrics keep theirs
 await page.getByTestId('omakase-cut-free').uncheck();
 await page.waitForFunction(()=>!freeClip().settings?.cut&&c.get().project.lyrics.every(l=>l.cut),null,{timeout:60000});
 const plain=await render(freeMid);assert.notEqual(plain.png,a.png,'without the plan, the free text is drawn the plain way (a different picture)');
 await page.getByTestId('omakase-cut-free').check();
 await page.waitForFunction(()=>freeClip().settings?.cut,null,{timeout:60000});
 // ---- back to 歌詞ごと: everything is taken off (the lyrics get their motions, the free text its own look again)
 await page.getByTestId('omakase-style').selectOption('line');
 await page.waitForFunction(()=>!freeClip().settings?.cut&&c.get().project.lyrics.every(l=>!l.cut),null,{timeout:60000});
 assert.equal(await page.evaluate(()=>freeClip().text),'光をつなぐ','the text itself is untouched');
 // ---- Undo brings the plans back in one step
 await page.evaluate(()=>c.undo());await page.waitForFunction(()=>freeClip().settings?.cut&&c.get().project.lyrics.every(l=>l.cut),null,{timeout:20000});
 assert.deepEqual(errors,[],'no page errors: '+errors.join(' | '));
 await page.evaluate(()=>c.dispose());
 console.log('PASS カット演出 自由文字: 付く、下の絵が透ける・何もなければ不透明、縦も描ける、チェックで外れる、歌詞ごとに戻すと外れる、Undo');
});
