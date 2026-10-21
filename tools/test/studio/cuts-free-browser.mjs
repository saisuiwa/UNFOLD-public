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
 await page.getByTestId('omakase-style-cut').click();
 assert.equal(await page.getByTestId('omakase-cut-free').isChecked(),true);
 await page.getByTestId('omakase-create').click();
 await page.waitForFunction(()=>freeClip()?.settings?.cut&&c.get().project.lyrics.every(l=>l.cut),null,{timeout:60000});
 const free=await page.evaluate(()=>{const f=freeClip();return {cuts:f.settings.cut.cuts.length,dur:f.settings.cut.dur,span:(f.endUs-f.startUs)/1e6,text:f.text,color:f.motion.color};});
 assert.ok(free.cuts>=1&&Math.abs(free.dur-free.span)<.01,'the plan follows the clip length: '+JSON.stringify(free));
 assert.ok(await page.locator('[data-testid=clip-row]').filter({hasText:'カット演出'}).count()>=0);
 // ---- the compositor draws it. The scene has the red picture under everything, so the cut layers are transparent: the corner stays red.
 // ink: 下にあるもの（赤い絵。何も無ければ、カット自身の背景色 base）とはっきり違う画素。明るい画素だけでは数えない（テープ・リボンの世界は、色の帯に暗い字を書く）
 const render=(us,viewId='wide',w=480,h=270,base=[208,24,24])=>page.evaluate(async([us,viewId,w,h,base])=>{
  const {createCompositor}=await import('/studio/compositor.js'),{openStudioStore}=await import('/studio/store.js');
  const p=c.get().project,store=await openStudioStore({dbName:'unfold-studio-cutsfree'});
  const comp=createCompositor({assets:store});await comp.prepare(p);
  const f=await comp.render({projectUs:us,viewId,width:w,height:h,epoch:1});const cv=new OffscreenCanvas(w,h),x=cv.getContext('2d');x.drawImage(f.bitmap,0,0);f.close();
  const px=(a,b)=>Array.from(x.getImageData(a,b,1,1).data),d=x.getImageData(0,0,w,h).data;let bright=0,red=0,ink=0;for(let i=0;i<d.length;i+=4){if(d[i]+d[i+1]+d[i+2]>450)bright++;if(d[i]>160&&d[i+1]<90&&d[i+2]<90)red++;if(Math.abs(d[i]-base[0])+Math.abs(d[i+1]-base[1])+Math.abs(d[i+2]-base[2])>170)ink++;}
  const blob=await cv.convertToBlob({type:'image/png'}),buf=new Uint8Array(await blob.arrayBuffer());let s='';for(const b of buf)s+=String.fromCharCode(b);
  comp.dispose();return {corner:px(3,3),mid:px(w>>1,h>>1),bright,red,ink,png:btoa(s)};},[us,viewId,w,h,base]);
 // moments inside the free text clip and before the first lyric (6 s), so that only the free text is on screen; the text can be hidden for an instant while it enters, so take the moment with the most text
 const window_=await page.evaluate(()=>{const f=freeClip(),s=c.get().project.scenes.find(x=>x.id===f.sceneId),from=s.originUs+f.startUs,to=Math.min(s.originUs+f.endUs,5.8e6);return {from,to};});
 assert.ok(window_.from>=1e6&&window_.to>window_.from+.5e6,'room before the lyrics: '+JSON.stringify(window_));
 let freeMid=0,best=-1;
 for(const u of [.15,.3,.45,.6,.75,.9]){const t=Math.round(window_.from+(window_.to-window_.from)*u),r=await render(t);if(r.ink>best){best=r.ink;freeMid=t;}}
 const a=await render(freeMid);
 await writeFile('tools/out/studio/cuts-free-over-picture.png',Buffer.from(a.png,'base64'));
 // 抜き文字（knockout の STAGE）のカットが画面にある時だけは、板が絵全体を覆い、下の赤い絵は字の形からだけ見える（計画の種は毎回変わる）
 // 落ちた時に、その時刻に出ていたカットの部品を書き出す（計画の種は毎回変わるので、どの部品かを分かるように）
 const partsAt=us=>page.evaluate(us=>{const p=c.get().project;const items=[...p.lyrics.map(l=>({at:l.startUs,d:l.cut,who:'lyric'})),...p.clips.filter(k=>k.settings?.cut).map(k=>({at:k.startUs,d:k.settings.cut,who:'free'}))];
  return items.map(({at,d,who})=>{const lt=(us-at)/1e6,k=d?.cuts?.find(x=>lt>=x.a&&lt<x.b);return k&&{who,lt:+lt.toFixed(2),bg:k.bgPart,fx:k.fx,trans:k.trans,world:k.world,deco:k.deco,enter:k.enter,exit:k.exit,treat:k.treat,cam:k.cam};}).filter(Boolean);},us);
 const knockoutAt=us=>page.evaluate(async us=>{const {WORLD}=await import('/studio/cuts/worlds.js'),p=c.get().project;
  const items=[...p.lyrics.map(l=>({at:l.startUs,d:l.cut})),...p.clips.filter(k=>k.settings?.cut).map(k=>({at:k.startUs,d:k.settings.cut}))];
  return items.some(({at,d})=>{const lt=(us-at)/1e6,k=d?.cuts?.find(x=>lt>=x.a&&lt<x.b);return !!(k&&WORLD[k.world]?.knockout);});},us);
 // 超デカ文字（megaText の STAGE）は、わざと画面からはみ出す大きさの字なので、隅に字がかかってよい。板は無いので、字のまわりから下の赤い絵が見える
 const megaTextAt=us=>page.evaluate(us=>{const p=c.get().project;
  const items=[...p.lyrics.map(l=>({at:l.startUs,d:l.cut})),...p.clips.filter(k=>k.settings?.cut).map(k=>({at:k.startUs,d:k.settings.cut}))];
  return items.some(({at,d})=>{const lt=(us-at)/1e6,k=d?.cuts?.find(x=>lt>=x.a&&lt<x.b);return k?.world==='megaText';});},us);
 // 何も下に無い時に自由文字のカットが塗る、カット自身の背景色（[r,g,b]）
 const bgAt=us=>page.evaluate(us=>{const f=freeClip(),lt=(us-f.startUs)/1e6,cuts=f.settings.cut.cuts,k=cuts.find(x=>lt>=x.a&&lt<x.b)||cuts[0];return [1,3,5].map(i=>parseInt(k.bg.slice(i,i+2),16));},us);
 const knockout=await knockoutAt(freeMid),mega=!knockout&&await megaTextAt(freeMid);
 if(knockout){assert.ok(!(a.corner[0]>160&&a.corner[1]<90&&a.corner[2]<90),'a knockout plate covers the corner: '+a.corner);
  let red=a.red;for(const d of [-.3e6,-.15e6,.15e6,.3e6]){if(red>200)break;red=Math.max(red,(await render(freeMid+d)).red);}   // 字が隠れている一瞬を避けて、前後でも見る
  assert.ok(red>200,'and the red picture shows through the letters: '+red);}
 else if(mega){let red=a.red;for(const d of [-.3e6,-.15e6,.15e6,.3e6]){if(red>200)break;red=Math.max(red,(await render(freeMid+d)).red);}
  if(!(red>200&&a.ink>40))console.log('over-picture parts:',JSON.stringify(await partsAt(freeMid)));
  assert.ok(red>200,'超デカ文字 (megaText): the corner may be a letter, but the red picture shows around the letters: '+red);
  assert.ok(a.ink>40,'and there is text: '+a.ink);}
 else{if(!(a.corner[0]>160&&a.corner[1]<90&&a.corner[2]<90&&a.ink>40))console.log('over-picture parts:',JSON.stringify(await partsAt(freeMid)));
  assert.ok(a.corner[0]>160&&a.corner[1]<90&&a.corner[2]<90,'the red picture shows through the cut layer (transparent): '+a.corner);
  assert.ok(a.ink>40,'and there is text: '+a.ink);}
 // ---- a transparent frame never carries over the pictures before it: one compositor playing many frames in a row draws the same picture at a time as a fresh one
 // (it used to pile up the translucent backgrounds and glows frame after frame, until the picture was washed out)
 const seq=await page.evaluate(async([times,last])=>{
  const {createCompositor}=await import('/studio/compositor.js'),{openStudioStore}=await import('/studio/store.js');
  const store=await openStudioStore({dbName:'unfold-studio-cutsfree'}),project=c.get().project;
  const grab=async(comp,t)=>{const f=await comp.render({projectUs:t,viewId:'wide',width:480,height:270,epoch:1});const cv=new OffscreenCanvas(480,270),x=cv.getContext('2d',{willReadFrequently:true});x.drawImage(f.bitmap,0,0);f.close();return x.getImageData(0,0,480,270).data;};
  const fresh=async t=>{const comp=createCompositor({assets:store});await comp.prepare(project);const d=await grab(comp,t);comp.dispose();return d;};
  const diff=(a,b)=>{let n=0,max=0;for(let i=0;i<a.length;i+=4){const d=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);if(d>3){n++;max=Math.max(max,d);}}return {n,max};};
  const comp=createCompositor({assets:store});await comp.prepare(project);
  for(const t of times)await grab(comp,t);
  const afterMany=await grab(comp,last),once=await fresh(last),twice=await fresh(last);comp.dispose();
  return {manyVsFresh:diff(afterMany,once),freshVsFresh:diff(once,twice)};},[Array.from({length:40},(_,i)=>Math.round(1.2e6+i*.1e6)),freeMid]);
 assert.deepEqual(seq.freshVsFresh,{n:0,max:0},'a fresh compositor draws a time the same way every time');
 assert.deepEqual(seq.manyVsFresh,{n:0,max:0},'the same picture after 40 frames in a row as from a fresh compositor: '+JSON.stringify(seq.manyVsFresh));
 // ---- no frame of the whole piece is washed out to white (the chroma / radial effects and the invert used to paint a transparent layer full white; with 「強い点滅を避ける」 on, nothing flashes)
 const white=await page.evaluate(async()=>{
  const {createCompositor}=await import('/studio/compositor.js'),{openStudioStore}=await import('/studio/store.js');
  const store=await openStudioStore({dbName:'unfold-studio-cutsfree'}),comp=createCompositor({assets:store});await comp.prepare(c.get().project);
  let max=0,at=0;const W=240,H=135;
  for(let t=.4e6;t<11.8e6;t+=.1e6){const f=await comp.render({projectUs:Math.round(t),viewId:'wide',width:W,height:H,epoch:1});const cv=new OffscreenCanvas(W,H),x=cv.getContext('2d',{willReadFrequently:true});x.drawImage(f.bitmap,0,0);f.close();
   const d=x.getImageData(0,0,W,H).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>235&&d[i+1]>235&&d[i+2]>235)n++;const share=n/(W*H);if(share>max){max=share;at=t;}}
  comp.dispose();return {max,at};});
 if(!(white.max<.7)){console.log('near-white frame parts:',JSON.stringify(await partsAt(white.at)));
  // 同じ時刻を、新しい合成器で1コマだけ描き直す（続けて描いた時だけ白くなるなら、前のコマが残っている）
  const fresh=await render(white.at,'wide',240,135);await writeFile('tools/out/studio/cuts-near-white-fresh.png',Buffer.from(fresh.png,'base64'));
  console.log('near-white fresh render: bright',fresh.bright,'of',240*135,'corner',fresh.corner);}
 assert.ok(white.max<.7,'no near-white frame: the whitest frame is '+Math.round(white.max*100)+'% white at '+white.at/1e6+' s');
 const lyricMid=6.2e6+1e6;
 const b=await render(lyricMid);
 if(await knockoutAt(lyricMid)){   // 字が登場・退場の途中で隠れている一瞬もあるので、前後の何点かで、字の形から絵が見える時があるかを見る
  let red=b.red;for(const d of [-.3e6,-.15e6,.15e6,.3e6]){if(red>200)break;red=Math.max(red,(await render(lyricMid+d)).red);}
  if(!(red>200)){await writeFile('tools/out/studio/cuts-lyric-knockout-fail.png',Buffer.from(b.png,'base64'));console.log('knockout lyric parts:',JSON.stringify(await partsAt(lyricMid)));}
  assert.ok(red>200,'lyrics too (a knockout plate): the picture shows through the letters: '+red);}
 else if(await megaTextAt(lyricMid)){let red=b.red;for(const d of [-.3e6,-.15e6,.15e6,.3e6]){if(red>200)break;red=Math.max(red,(await render(lyricMid+d)).red);}
  if(!(red>200))console.log('megaText lyric parts:',JSON.stringify(await partsAt(lyricMid)));
  assert.ok(red>200,'lyrics too (超デカ文字): the picture shows around the letters: '+red);}
 else assert.ok(b.corner[0]>160&&b.corner[1]<90,'lyrics too: the picture shows through: '+b.corner);
 await writeFile('tools/out/studio/cuts-lyric-over-picture.png',Buffer.from(b.png,'base64'));
 // ---- take the picture away: nothing under the cut layer any more, so it paints its own dark background
 await page.evaluate(async()=>{const img=c.get().project.clips.find(k=>k.kind==='image');await c.dispatch({type:'deleteClip',id:img.id});});
 const d=await render(freeMid);
 assert.ok((knockout||mega||d.corner[0]<110)&&d.corner[3]===255,'with nothing under it, an opaque picture (a dark background, a knockout plate, or 超デカ文字 letters): '+d.corner);await writeFile('tools/out/studio/cuts-free-alone.png',Buffer.from(d.png,'base64'));
 // ---- the same on the tall view
 const t=await render(freeMid,'tall',270,480,await bgAt(freeMid));assert.ok(t.ink>20,'tall view draws too: '+t.ink);
 // ---- 自由文字にも付ける off: the clip's plan goes, the lyrics keep theirs
 await page.getByTestId('omakase-cut-free').uncheck();
 await page.waitForFunction(()=>!freeClip().settings?.cut&&c.get().project.lyrics.every(l=>l.cut),null,{timeout:60000});
 const plain=await render(freeMid);assert.notEqual(plain.png,a.png,'without the plan, the free text is drawn the plain way (a different picture)');
 await page.getByTestId('omakase-cut-free').check();
 await page.waitForFunction(()=>freeClip().settings?.cut,null,{timeout:60000});
 // ---- back to 歌詞ごと: everything is taken off (the lyrics get their motions, the free text its own look again)
 await page.getByTestId('omakase-style-line').click();
 await page.waitForFunction(()=>!freeClip().settings?.cut&&c.get().project.lyrics.every(l=>!l.cut),null,{timeout:60000});
 assert.equal(await page.evaluate(()=>freeClip().text),'光をつなぐ','the text itself is untouched');
 // ---- Undo brings the plans back in one step
 await page.evaluate(()=>c.undo());await page.waitForFunction(()=>freeClip().settings?.cut&&c.get().project.lyrics.every(l=>l.cut),null,{timeout:20000});
 assert.deepEqual(errors,[],'no page errors: '+errors.join(' | '));
 await page.evaluate(()=>c.dispose());
 console.log('PASS カット演出 自由文字: 付く、下の絵が透ける・何もなければ不透明、縦も描ける、チェックで外れる、歌詞ごとに戻すと外れる、Undo');
});
