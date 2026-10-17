// 説明書（app/guide/manual.html）の、注釈つきの画面写真を作る:  node tools/manual/shoot.mjs
// 本物の画面を開き、説明する所に番号つきの枠を重ねてから撮る。画面が変わったら、これを流し直せば写真も新しくなる。
// 中に置く絵: UNFOLD_MANUAL_IMAGES（カンマ区切りのパス）。なければ「画像置き場」の絵、それもなければ色のグラデーション。
import {pathToFileURL} from 'node:url';
import {readFile,mkdir,access} from 'node:fs/promises';
import {startStaticServer} from '../lib/static-server.mjs';

const OUT='app/guide/manual';
const W=1440,H=900;
const PLAYWRIGHT=process.env.UNFOLD_PLAYWRIGHT_PATH||'/Volumes/ORICO/UNFOLD/.worktrees/method-workshop/tools/image-code-build/.test-deps/node_modules/playwright-core/index.mjs';
const CHROME=process.env.UNFOLD_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PLACE='/Volumes/ORICO/UNFOLD/画像置き場/';
const IMAGES=(process.env.UNFOLD_MANUAL_IMAGES?.split(',')||['song-dawn.png','song-forest.png','song-nightlake.png','anime-sky.png'].map(f=>PLACE+f));

const {chromium}=await import(pathToFileURL(PLAYWRIGHT));
await mkdir(OUT,{recursive:true});
const images=[];for(const path of IMAGES){try{await access(path);images.push({name:path.split('/').pop().replace(/\.\w+$/,''),b64:(await readFile(path)).toString('base64'),type:path.endsWith('.jpg')?'image/jpeg':'image/png'});}catch{}}

// 番号つきの枠。marks: [{n, label, box:{x,y,width,height}, at:'tl'|'tr'|'bl'|'br'|'in'}]（box は画面の座標）
async function annotate(page,marks){
 await page.evaluate(({marks,W,H})=>{
  document.getElementById('manual-marks')?.remove();
  const layer=document.createElement('div');layer.id='manual-marks';layer.style.cssText='position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif';
  (document.querySelector('dialog[open]')||document.body).append(layer);   // 先に入れておく（ラベルの幅を測るため）。開いたダイアログは一番手前に出るので、その中に描く
  const tags=[];
  for(const m of marks){
   const b={x:Math.max(2,m.box.x),y:Math.max(2,m.box.y)};b.r=Math.min(W-2,m.box.x+m.box.width);b.b=Math.min(H-2,m.box.y+m.box.height);
   const box=document.createElement('div');box.style.cssText=`position:absolute;left:${b.x}px;top:${b.y}px;width:${b.r-b.x}px;height:${b.b-b.y}px;border:3px solid #ff4f7b;border-radius:9px;box-shadow:0 0 0 2px #0008,0 0 18px #ff4f7b88`;
   const tag=document.createElement('div'),num=document.createElement('b');num.textContent=String(m.n);num.style.cssText='display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#fff;color:#e8335f;font-size:15px;margin-right:6px';tag.append(num,m.label);
   tag.style.cssText='position:absolute;white-space:nowrap;background:#ff4f7b;color:#fff;font-weight:700;font-size:14px;line-height:24px;padding:3px 10px 3px 4px;border-radius:16px;box-shadow:0 3px 10px #0009';
   layer.append(box);tags.push({m,b,tag});
  }
  // ラベルは、全部の枠の上に重ねる（ほかの枠の線で隠れないように）
  for(const {m,b,tag} of tags){
   layer.append(tag);
   const tw=tag.offsetWidth,th=tag.offsetHeight,at=m.at||'tl';
   let x=at.endsWith('r')?b.r-tw:b.x,y=at.startsWith('b')?b.b+6:b.y-th-6;
   if(at==='in'){x=b.x+8;y=b.y+8;}
   if(y<4)y=b.y+8;if(y+th>H-4)y=b.b-th-8;x=Math.max(4,Math.min(W-tw-4,x));
   tag.style.left=x+'px';tag.style.top=y+'px';
  }
 },{marks,W,H});
}
// 見えている所だけの四角（スクロールする枠の中で隠れている部分は含めない）
const box=async(page,selector)=>{const l=typeof selector==='string'?page.locator(selector).first():selector;await l.waitFor({state:'visible',timeout:15000});
 return l.evaluate(el=>{let r=el.getBoundingClientRect(),x0=r.left,y0=r.top,x1=r.right,y1=r.bottom;for(let a=el.parentElement;a;a=a.parentElement){const st=getComputedStyle(a);if(/(auto|scroll|hidden)/.test(st.overflow+st.overflowX+st.overflowY)){const q=a.getBoundingClientRect();x0=Math.max(x0,q.left);y0=Math.max(y0,q.top);x1=Math.min(x1,q.right);y1=Math.min(y1,q.bottom);}}x1=Math.min(x1,innerWidth);y1=Math.min(y1,innerHeight);return {x:x0,y:y0,width:Math.max(0,x1-x0),height:Math.max(0,y1-y0)};});};
const union=(...bs)=>{const x=Math.min(...bs.map(b=>b.x)),y=Math.min(...bs.map(b=>b.y));return {x,y,width:Math.max(...bs.map(b=>b.x+b.width))-x,height:Math.max(...bs.map(b=>b.y+b.height))-y};};
const grow=(b,p=4)=>({x:b.x-p,y:b.y-p,width:b.width+p*2,height:b.height+p*2});
async function shot(page,name,marks,clip){await annotate(page,marks);await page.screenshot({path:`${OUT}/${name}.jpg`,type:'jpeg',quality:84,...(clip?{clip}:{})});await page.evaluate(()=>document.getElementById('manual-marks')?.remove());console.log('wrote',`${OUT}/${name}.jpg`);}
const blobIn=(page,img)=>page.evaluateHandle(({b64,type})=>{const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type});},img);

const server=await startStaticServer();
const browser=await chromium.launch({executablePath:CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1});
 await context.addInitScript(()=>{try{localStorage.setItem('unfold-studio-mode','easy');}catch{}});
 const page=await context.newPage();
 page.on('pageerror',e=>console.log('pageerror:',String(e).slice(0,200)));

 // ---------- 1枚モード ----------
 await page.goto(server.url+'/index.html');await page.locator('#scene').waitFor();
 if(images[3]){await page.setInputFiles('#image-input',{name:images[3].name+'.png',mimeType:images[3].type,buffer:Buffer.from(images[3].b64,'base64')});await page.waitForTimeout(2500);}
 await page.locator('#shapes button').filter({hasText:'ハート'}).first().click().catch(()=>{});
 await page.waitForTimeout(800);
 // 立体になった所で止める
 await page.getByText('立体化',{exact:true}).first().click().catch(()=>{});
 await page.waitForTimeout(2500);
 await shot(page,'single-1',[
  {n:1,label:'絵を入れる',box:grow(await box(page,'#dropzone')),at:'bl'},
  {n:2,label:'崩れ方を選ぶ',box:grow(union(await box(page,'#methods'),await box(page,'#methods-tag'))),at:'tr'},
  {n:3,label:'途中の形を見る（ドラッグで回る）',box:grow(await box(page,'#stage'),-6),at:'in'},
  {n:4,label:'再生と、4つの段階',box:grow(union(await box(page,'#play'),await box(page,'#timeline'),await box(page,page.getByText('元の画像',{exact:true}).first().locator('xpath=..')),await box(page,page.getByText('元どおり',{exact:true}).first().locator('xpath=..')))),at:'bl'},
  {n:5,label:'形・演出・保存の切り替え',box:grow(union(await box(page,'#tab-shape'),await box(page,'#tab-export'))),at:'tr'},
  {n:6,label:'立体の形を選ぶ',box:grow(await box(page,'#shapes')),at:'br'},
  {n:7,label:'動画にする',box:grow(await box(page,'#export-top')),at:'bl'},
 ]);

 // ---------- シーケンス ----------
 await page.goto(server.url+'/sequence.html?empty');await page.waitForFunction(()=>window.unfoldSeq,null,{timeout:30000});
 for(const img of images.slice(0,3)){const blob=await blobIn(page,img);await page.evaluate(([b,name])=>unfoldSeq.addImageBlob(b,name),[blob,img.name]);}
 await page.waitForTimeout(1500);
 await page.locator('.tl-bar').getByRole('button',{name:'全体'}).click().catch(()=>{});
 await page.waitForTimeout(800);
 await shot(page,'sequence-1',[
  {n:1,label:'絵を何枚も入れる',box:grow(await box(page,'#seq-drop'))},
  {n:2,label:'崩れ方（◆を選んでから）',box:grow(await box(page,'#seq-methods')),at:'tr'},
  {n:3,label:'できあがりを見る',box:grow(await box(page,'#seq-stage'),-6),at:'in'},
  {n:4,label:'並べる所（絵・音声・歌詞）',box:grow(await box(page,'.tl-body'),-2),at:'in'},
  {n:5,label:'◆＝絵と絵の間の変化',box:grow(await box(page,'.tl-trans')),at:'bl'},
  {n:6,label:'書き出し・読み込み・新規・保存先',box:grow(union(await box(page,page.locator('.tl-bar').getByRole('button',{name:'書き出し'})),await box(page,page.locator('.tl-bar').getByRole('button',{name:/保存先/})))),at:'tr'},
  {n:7,label:'STUDIOへ送る',box:grow(await box(page,'#studio-entry')),at:'tr'},
 ]);
 // ◆を選ぶと、右に設定が出る
 await page.locator('.tl-trans').first().click();await page.waitForTimeout(1200);
 {const scrub=page.locator('#seq-scrub');const t=await page.evaluate(()=>{const s=document.getElementById('seq-scrub');return Number(s.max)*.22;});await scrub.evaluate((s,v)=>{s.value=String(v);s.dispatchEvent(new Event('input',{bubbles:true}));},t);await page.waitForTimeout(1500);}
 await shot(page,'sequence-2',[
  {n:1,label:'選んだ◆',box:grow(await box(page,'.tl-trans')),at:'tr'},
  {n:2,label:'◆の設定（崩れ方・形・向き）',box:grow(await box(page,'#seq-inspector')),at:'bl'},
  {n:3,label:'選択中・見た目・曲と歌詞・保存',box:grow(await box(page,'.right .tabs')),at:'tr'},
 ]);

 // ---------- STUDIO ----------
 await page.goto(server.url+'/__tools/test/studio/host.html');
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  for(const n of ['unfold-studio-manual'])indexedDB.deleteDatabase(n);
  const root=document.createElement('main');root.id='studio';document.body.replaceChildren(root);for(const href of ['/studio.css','/lyric-controls.css?v=3']){const css=document.createElement('link');css.rel='stylesheet';css.href=href;document.head.append(css);}
  await new Promise(r=>setTimeout(r,300));
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-manual'})});mountStudio(root,c);await c.ready;
  const T=['折り目が光に変わっていく','ひとりでも 空はひらくから','小さな紙が風に飛んだ','ほら、もう一回ひろげよう'];
  const lyric=i=>({id:'L'+i,text:T[i],runs:[{id:'r'+i,text:T[i]}],startUs:Math.round((1+i*3.2)*1e6),endUs:Math.round((1+i*3.2+3)*1e6),motion:{font:'gothic',color:'#ffffff'},timingSource:'manual',opacity:1});
  await c.dispatch({type:'batch',commands:[{type:'setProjectName',name:'紙ひこうきの歌'},{type:'setLock',track:'lyrics',locked:false},{type:'replaceLyrics',lyrics:T.map((_,i)=>lyric(i))},{type:'insertScene',scene:{id:'A',startUs:0,endUs:14e6,originUs:0}},{type:'setLock',track:'lyrics',locked:true}]});
 });
 if(images[3]){const blob=await blobIn(page,images[3]);await page.evaluate(async b=>{await c.seek(0);await c.importMedia([new File([b],'sky.png',{type:'image/png'})],{role:'sfx'});},blob);}
 await page.evaluate(()=>c.select(null));
 await page.getByTestId('omakase-style-cut').click();
 await page.getByTestId('omakase-create').click();
 await page.waitForFunction(()=>c.get().project.lyrics.every(l=>l.cut),null,{timeout:60000});
 await page.evaluate(()=>c.seek(5.6e6));await page.waitForTimeout(2500);
 // 上のバーのアップ: ボタンの仲間ごとの色
 await shot(page,'studio-0',[
  {n:1,label:'横・縦／かんたん・詳細',box:grow(union(await box(page,'.view-switch'),await box(page,'.mode-switch'))),at:'bl'},
  {n:2,label:'作品（青）',box:grow(await box(page,'.g-file')),at:'bl'},
  {n:3,label:'編集（灰）',box:grow(await box(page,'.g-edit')),at:'bl'},
  {n:4,label:'演出（ミント）',box:grow(await box(page,'.g-make')),at:'bl'},
  {n:5,label:'書き出し（オレンジ）',box:grow(await box(page,'.g-out')),at:'br'},
 ],{x:0,y:0,width:W,height:96});
 await shot(page,'studio-1',[
  {n:1,label:'上のバー（色で仲間分け）',box:grow(await box(page,'.studio-header'),-3),at:'bl'},
  {n:2,label:'素材を足す',box:grow(await box(page,'.import-controls')),at:'bl'},
  {n:3,label:'画面と再生',box:grow(await box(page,'.preview'),-4),at:'in'},
  {n:4,label:'おまかせ',box:grow(await box(page,'[data-testid=omakase-panel]'),-2),at:'bl'},
  {n:5,label:'タイムライン（歌詞・画像・演出・音声）',box:grow(await box(page,'.timeline-panel'),-6),at:'in'},
 ]);
 // 歌詞を選ぶと「この歌詞を編集」。動きタブの一番上に、カット割りの箱
 await page.evaluate(()=>c.select({kind:'lyric',id:'L1'},{show:true}));await page.getByTestId('lyric-cut-box').waitFor();await page.waitForTimeout(2000);
 await shot(page,'studio-2',[
  {n:1,label:'選んだ歌詞',box:grow(await box(page,page.locator('[data-testid=lyric-row]').nth(1))),at:'tr'},
  {n:2,label:'おまかせに戻る',box:grow(await box(page,'[data-testid=inspector-to-omakase]')),at:'bl'},
  {n:3,label:'動き・色・書体',box:grow(await box(page,'.studio-lyric-edit .lq-tabs')),at:'tr'},
  {n:4,label:'この歌詞だけカット割り',box:grow(await box(page,'[data-testid=lyric-cut-box]')),at:'bl'},
 ]);
 // ショートの窓
 await page.evaluate(()=>c.select(null));
 await page.getByTestId('short-open').click();await page.getByRole('button',{name:'ショートを追加',exact:true}).click();
 await page.evaluate(()=>c.seek(4.2e6));await page.getByTestId('short-start-here').click();await page.evaluate(()=>c.seek(13.4e6));await page.getByTestId('short-end-here').click();
 await page.getByRole('button',{name:'区間を確定',exact:true}).click();await page.getByTestId('short-summary').filter({hasText:'秒'}).waitFor();await page.waitForTimeout(800);
 await shot(page,'studio-3',[
  {n:1,label:'ショートの窓を開く',box:grow(await box(page,'[data-testid=short-open]')),at:'bl'},
  {n:2,label:'いまの位置を開始・終了に',box:grow(union(await box(page,'[data-testid=short-start-here]'),await box(page,'[data-testid=short-end-here]'))),at:'bl'},
  {n:3,label:'縦の短い動画にする',box:grow(await box(page,'[data-testid=short-export]')),at:'bl'},
 ]);
 await page.getByRole('button',{name:'ショートの窓を閉じる'}).click();
 // 新しいMVの確認
 await page.getByTestId('new-project').click();await page.locator('dialog.confirm-new').waitFor();await page.waitForTimeout(400);
 await shot(page,'studio-4',[
  {n:1,label:'今の作品は保存されてから閉じる',box:grow(await box(page,'dialog.confirm-new'),2),at:'tl'},
  {n:2,label:'名前を変えておける',box:grow(await box(page,'[data-testid=new-project-old-name]')),at:'br'},
 ]);
}finally{await browser.close();await server.close();}
