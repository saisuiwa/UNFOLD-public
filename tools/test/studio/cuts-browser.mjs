// カット演出 in STUDIO（実ブラウザ）: おまかせの「カット割り」で全歌詞に計画が入り、合成器が本物の絵を描く（横長・縦長）、
// つなぎ・引き継ぎの境目も描ける、時刻を飛んでも同じ絵、手で別の動きを選ぶと普通の描き方に戻る、元に戻せる、書き出しの道（同じ合成器）で通る。
// 絵は tools/out/studio/cuts-*.png に保存する（目で見るため）。
import assert from 'node:assert/strict';import {writeFile,mkdir} from 'node:fs/promises';import {withStudioPage} from './browser-helper.mjs';
await mkdir('tools/out/studio',{recursive:true});
await withStudioPage(async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  const root=document.createElement('main');document.body.replaceChildren(root);const css=document.createElement('link');css.rel='stylesheet';css.href='/studio.css';document.head.append(css);const lc=document.createElement('link');lc.rel='stylesheet';lc.href='/lyric-controls.css?v=3';document.head.append(lc);
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-cuts'})});mountStudio(root,c);await c.ready;
  const T=['折り目が光に変わっていく','小さな紙が風に飛んだ','ほら、もう一回ひろげよう','紙の翼でどこまでも'];
  const lyric=(i)=>({id:'L'+i,text:T[i],runs:[{id:'r'+i,text:T[i]}],startUs:Math.round((.4+i*2.8)*1e6),endUs:Math.round((.4+i*2.8+2.6)*1e6),motion:{font:'gothic',color:'#ffffff'},timingSource:'manual',opacity:1});
  await c.dispatch({type:'batch',commands:[{type:'setLock',track:'lyrics',locked:false},{type:'replaceLyrics',lyrics:T.map((_,i)=>lyric(i))},{type:'insertScene',scene:{id:'A',startUs:0,endUs:12e6,originUs:0}}]});
  window.cutState=()=>c.get().project.lyrics.map(l=>l.cut?l.cut.cuts.length:0).join(',');
  window.snapshot=()=>JSON.stringify(c.get().project.lyrics.map(l=>[l.id,l.text,l.startUs,l.endUs]));window.before=snapshot();
  window.frame=async(us,viewId='wide',w=960,h=540)=>{const {createCompositor}=await import('/studio/compositor.js');window._comp??=createCompositor({assets:{get:async()=>null}});const p=c.get().project;if(window._compV!==c.get().editVersion+':'+p.revision){await _comp.prepare(p);window._compV=c.get().editVersion+':'+p.revision;}
   const f=await _comp.render({projectUs:us,viewId,width:w,height:h,epoch:1});const cv=new OffscreenCanvas(w,h),x=cv.getContext('2d');x.drawImage(f.bitmap,0,0);f.close();const d=x.getImageData(0,0,w,h).data;let ink=0,opaque=0;for(let i=0;i<d.length;i+=4){if(d[i+3]===255)opaque++;if(d[i]+d[i+1]+d[i+2]>450)ink++;}
   const blob=await cv.convertToBlob({type:'image/png'}),buf=new Uint8Array(await blob.arrayBuffer());let s='';for(const b of buf)s+=String.fromCharCode(b);return {ink,opaque:opaque/(w*h),png:btoa(s)};};
 });
 const save=async(name,r)=>writeFile('tools/out/studio/'+name+'.png',Buffer.from(r.png,'base64'));
 // ---- 演出を「カット割り」にして、おまかせで作る
 const panel=page.getByTestId('omakase-panel');await panel.waitFor({state:'visible'});
 await page.getByTestId('omakase-style-cut').click();
 assert.equal(await page.getByTestId('omakase-cut-box').isVisible(),true,'the cut settings show in cut mode');
 // 案がない間は、設定だけだと分かる説明と「この設定で作る」が出ている。そのボタンで作る
 assert.match(await page.getByTestId('omakase-cut-hint').innerText(),/設定だけ/);
 assert.equal(await page.getByTestId('omakase-cut-create').isVisible(),true);
 await page.getByTestId('omakase-cut-create').click();
 await page.waitForFunction(()=>cutState().split(',').every(n=>Number(n)>0),null,{timeout:60000});
 const counts=(await page.evaluate(()=>cutState())).split(',').map(Number);
 assert.ok(counts.every(n=>n>=2&&n<=5),'every lyric is cut into a few cuts: '+counts);
 assert.equal(await page.evaluate(()=>snapshot()),await page.evaluate(()=>before),'lyric text and timing are untouched');
 assert.match(await page.getByTestId('omakase-summary').innerText(),/カット\s*\d+個/);
 assert.equal(await page.getByTestId('omakase-cut-create').isVisible(),false,'once there is a plan, the sliders act at once and the button is gone');
 assert.match(await page.getByTestId('omakase-cut-hint').innerText(),/その場で作り直/);
 assert.ok(await page.locator('.timeline-block.lyric .tl-motion').first().textContent().then(t=>/カット演出（\d+カット）/.test(t)),'the lane names the cut style');
 const colours=await page.evaluate(()=>[...new Set(c.get().project.lyrics.map(l=>l.motion.color+'/'+l.motion.emphasisColor))]);assert.equal(colours.length,1,'one palette');
 // ---- 合成器が描く: 歌詞の中ほど（横長・縦長）
 const mid=i=>Math.round((.4+i*2.8+1.3)*1e6);
 for(const [i,name] of [[0,'a'],[1,'b'],[2,'c'],[3,'d']]){
  const w=await page.evaluate(t=>frame(t),mid(i)),t=await page.evaluate(t=>frame(t,'tall',540,960),mid(i));
  await save(`cuts-${name}-wide`,w);await save(`cuts-${name}-tall`,t);
  assert.ok(w.opaque>.999,'the picture is opaque (wide) '+w.opaque);assert.ok(t.opaque>.999,'opaque (tall)');assert.ok(w.ink>100,`there is text (wide) lyric ${i}: ${w.ink}`);assert.ok(t.ink>60,`there is text (tall) lyric ${i}: ${t.ink}`);
 }
 // ---- 境目（つなぎ・引き継ぎ）を含めて、0.05秒刻みで全部描ける。同じ時刻は同じ絵（飛んで戻っても）
 const run=await page.evaluate(async()=>{let n=0,bad=[],maxMs=0;const t0=performance.now();for(let t=.4e6;t<11e6;t+=.05e6){const s=performance.now();try{const r=await frame(Math.round(t));if(r.opaque<.999)bad.push(['opaque',t]);}catch(e){bad.push([String(e),t]);}maxMs=Math.max(maxMs,performance.now()-s);n++;}return {n,bad:bad.slice(0,5),total:performance.now()-t0,maxMs};});
 assert.equal(run.bad.length,0,'no failed frame: '+JSON.stringify(run.bad));console.log(`frames ${run.n}, ${Math.round(run.total/run.n)} ms/frame avg, ${Math.round(run.maxMs)} ms max (960x540, headless swiftshader)`);
 // 描く速さ。1度目（書体の読み込み・文字の測り込み・作業用キャンバスの用意を含む）と、2度目（温まった後）を分けて測る。GPUの仕事が終わるまで待つため、1画素だけ読み戻す。
 // ソフトウェア描画のヘッドレスなので、実機のGPUよりずっと遅い数字。重さの目安と、極端に遅くなっていないことの確認だけ。
 const perf=await page.evaluate(async()=>{const {createCompositor}=await import('/studio/compositor.js'),comp=createCompositor({assets:{get:async()=>null}});await comp.prepare(c.get().project);const probe=new OffscreenCanvas(1,1).getContext('2d',{willReadFrequently:true});
  const pass=async(w)=>{const times=[];for(let t=.4e6;t<11e6;t+=.1e6){const s=performance.now(),f=await comp.render({projectUs:Math.round(t),viewId:'wide',width:w[0],height:w[1],epoch:1});probe.drawImage(f.bitmap,0,0,1,1);probe.getImageData(0,0,1,1);f.close();times.push(performance.now()-s);}times.sort((a,b)=>a-b);return {size:w.join('x'),avg:Math.round(times.reduce((a,b)=>a+b,0)/times.length),median:Math.round(times[times.length>>1]),p90:Math.round(times[Math.floor(times.length*.9)]),max:Math.round(times.at(-1))};};
  const out={};out.cold=await pass([960,540]);out.warm=await pass([960,540]);out.warmFull=await pass([1920,1080]);comp.dispose();return out;});
 console.log('render ms (software GL):',JSON.stringify(perf));assert.ok(perf.warm.median<1500,'960x540 warm median is sane: '+JSON.stringify(perf));
 const x1=await page.evaluate(t=>frame(t),mid(1)),away=await page.evaluate(()=>frame(11e6)),x2=await page.evaluate(t=>frame(t),mid(1));
 assert.equal(x1.png,x2.png,'the same time gives the same picture after jumping away');
 // ---- 同じ時刻の絵は、普通の描き方（カット演出なし）とは違う
 // ---- 次の案 / 前の案: 計画が変わり、前の案はそのまま戻る
 const planOf=()=>page.evaluate(()=>JSON.stringify(c.get().project.lyrics.map(l=>l.cut)));
 const first=await planOf();
 await page.getByTestId('omakase-next').click();await page.waitForFunction(a=>JSON.stringify(c.get().project.lyrics.map(l=>l.cut))!==a,first,{timeout:60000});
 const second=await planOf();assert.notEqual(second,first);
 await page.getByTestId('omakase-back').click();await page.waitForFunction(a=>JSON.stringify(c.get().project.lyrics.map(l=>l.cut))===a,first,{timeout:60000});
 // ---- 物の濃さ: 物の世界を100%にして、濃さを30%にすると、世界のあるカットは全部 worldA=0.3（文字は薄くならない）
 for(const [k,v] of [['worldAmount','100'],['worldOpacity','30']]){await page.getByTestId('omakase-cut-'+k).fill(v);await page.getByTestId('omakase-cut-'+k).dispatchEvent('change');await page.waitForTimeout(400);}
 await page.waitForFunction(()=>{const cuts=c.get().project.lyrics.flatMap(l=>l.cut.cuts);return cuts.some(x=>x.world)&&cuts.filter(x=>x.world).every(x=>x.worldA===.3);},null,{timeout:60000});
 // ---- 設定のスライダー: カメラ0・画面効果0・つなぎ0・世界0・引き継ぎ0・ゴースト0 なら、その部品は使われない
 for(const k of ['camAmount','fxAmount','transAmount','worldAmount','carryAmount','ghostAmount']){await page.getByTestId('omakase-cut-'+k).fill('0');await page.getByTestId('omakase-cut-'+k).dispatchEvent('change');await page.waitForTimeout(400);}
 await page.waitForFunction(()=>c.get().project.lyrics.every(l=>l.cut.cuts.every(x=>!x.cam&&!x.fx&&!x.trans&&!x.world&&!x.carry&&x.ghost===0)),null,{timeout:60000});
 // ---- カットの細かさ: 細かくすると、カットが増える
 const before=(await page.evaluate(()=>cutState())).split(',').map(Number).reduce((a,b)=>a+b,0);
 await page.getByTestId('omakase-cut-density').fill('100');await page.getByTestId('omakase-cut-density').dispatchEvent('change');
 await page.waitForFunction(b=>c.get().project.lyrics.reduce((a,l)=>a+l.cut.cuts.length,0)>b,before,{timeout:60000});
 // ---- 書き出し: 実際の書き出し処理（本物の合成器）で、カット演出つきの1秒がMP4になる
 const ex=await page.evaluate(async()=>{const {exportStudio}=await import('/studio/export.js'),m=await import('/vendor/studio-media.js'),{createCompositor}=await import('/studio/compositor.js');
  const p=structuredClone(c.get().project);p.views.wide.width=640;p.views.wide.height=360;const compositor=createCompositor({assets:{get:async()=>null}}),chunks=[],sink={write:async d=>chunks.push(d.slice()),close:async()=>{},abort:async()=>{}};
  const media={audioBlock:async(id,track,start,n)=>({sampleRate:48000,channels:[new Float32Array(n),new Float32Array(n)]})};
  const result=await exportStudio({project:p,viewId:'wide',range:{startUs:4.2e6,endUs:5.2e6,fadeInUs:0,fadeOutUs:0},format:'mp4',compositor,media,sink});
  const blob=new Blob(chunks),input=new m.Input({source:new m.BlobSource(blob),formats:m.ALL_FORMATS}),v=await input.getPrimaryVideoTrack();
  const probe={width:await v.getDisplayWidth(),height:await v.getDisplayHeight(),duration:await v.computeDuration(),bytes:blob.size};input.dispose();compositor.dispose();return {frames:result.frames,probe};});
 assert.equal(ex.frames,30);assert.equal(ex.probe.width,640);assert.equal(ex.probe.height,360);assert.ok(Math.abs(ex.probe.duration-1)<1/30,'one second: '+ex.probe.duration);assert.ok(ex.probe.bytes>30000,'the exported video is not blank: '+ex.probe.bytes+' bytes');
 console.log('export (640x360, 1 s):',JSON.stringify(ex));
 // ---- 手で別の動きを選ぶと、その歌詞は普通の描き方に戻る（カット演出のデータは残っても使われない）
 const withCut=await page.evaluate(t=>frame(t),mid(0));
 await page.evaluate(async()=>{const {DAILY_CODE_MOTIONS}=await import('/code-motion-daily.js'),{approveStudioCode}=await import('/studio/code-trust.js'),m=DAILY_CODE_MOTIONS.find(x=>x.shelf!=='effect'&&!x.key.startsWith('bg-'));approveStudioCode(m.source);const l=c.get().project.lyrics[0];await c.dispatch({type:'setLyricAppearance',id:l.id,patch:{motion:{...l.motion,code:{version:1,source:m.source}}}});});
 const plain=await page.evaluate(t=>frame(t),mid(0));assert.notEqual(plain.png,withCut.png,'a hand-picked motion draws the plain way');
 await save('cuts-plain-after-handpick',plain);
 await page.evaluate(()=>c.undo());await page.waitForTimeout(300);
 const back=await page.evaluate(t=>frame(t),mid(0));assert.equal(back.png,withCut.png,'Undo brings the cut picture back exactly');
 // ---- 演出を「歌詞ごと」に戻す: カット演出は外れ、背景のクリップが戻る
 await page.getByTestId('omakase-style-line').click();
 await page.waitForFunction(()=>c.get().project.lyrics.every(l=>!l.cut)&&c.get().project.lyrics.every(l=>l.motion.code?.source),null,{timeout:60000});
 assert.ok(await page.evaluate(()=>c.get().project.clips.some(x=>x.settings?.omakase)),'the おまかせ backgrounds are back');
 assert.deepEqual(errors,[],'no page errors: '+errors.join(' | '));
 // (the lyric panel loads sample pictures that the test host does not serve, so the page errors are checked before it opens)
 // ---- 歌詞を選んでいる時も、右のパネルの一番上のボタンで、おまかせのパネルに戻れる
 await page.evaluate(()=>c.select({kind:'lyric',id:'L1'}));
 await page.getByTestId('omakase-panel').waitFor({state:'hidden'});
 await page.getByTestId('inspector-to-omakase').click();
 await page.getByTestId('omakase-panel').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>c.get().selection),null,'nothing is selected any more');
 await page.evaluate(()=>{c.dispose();_comp?.dispose();});
 console.log('PASS カット演出: おまかせ(カット割り)で全歌詞に計画、横長・縦長・境目を描く、案の行き来、設定、手で選ぶと普通に戻る、Undo、歌詞ごとに戻す');
});
