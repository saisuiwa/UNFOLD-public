// 画面効果とつなぎは、透明な絵（下に別の絵がある時）でも、全面を白や色で塗りつぶさない。文字や図形の形のまま、動く。
// （色を掛けて足し合わせる作り方は、透明な所まで色で塗ってしまい、画面が真っ白になっていた）
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async page=>{
 const res=await page.evaluate(async()=>{
  const {FX,TRANS}=await import('/studio/cuts/parts.js'),{rng}=await import('/studio/omakase.js');
  const W=320,H=180,pool=new Map(),tmp=(slot,w=W,h=H)=>{let c=pool.get(slot+':'+w+'x'+h);if(!c){c=new OffscreenCanvas(w,h);pool.set(slot+':'+w+'x'+h,c);}return c;};
  const env=(k)=>({W,H,opaque:false,t:1.2,lt:.05,dur:1,p:.05,fg:'#ffffff',accent:'#b69cff',bg:'#101018',step:28,tmp,k});
  const shape=ctx=>{ctx.clearRect(0,0,W,H);ctx.fillStyle='#ffffff';ctx.fillRect(110,60,100,60);ctx.fillStyle='rgba(180,150,255,.2)';ctx.beginPath();ctx.arc(60,90,30,0,7);ctx.fill();};
  const stat=ctx=>{const d=ctx.getImageData(0,0,W,H).data;let solid=0;for(let i=3;i<d.length;i+=4)if(d[i]>128)solid++;return {solid:solid/(W*H),corner:d[3],content:d[((90*W)+160)*4+3]};};
  const out={fx:{},trans:{}};
  for(const [key,F] of Object.entries(FX)){
   const cv=new OffscreenCanvas(W,H),ctx=cv.getContext('2d',{willReadFrequently:true});let worst=0,corner=0;
   for(const k of [1,.5,.1]){shape(ctx);F.apply(ctx,env(),F.plan(rng('fx:'+key)),k);const s=stat(ctx);worst=Math.max(worst,s.solid);corner=Math.max(corner,s.corner);}
   out.fx[key]={worst:+worst.toFixed(2),corner};
  }
  for(const [key,T] of Object.entries(TRANS)){
   const A=new OffscreenCanvas(W,H),B=new OffscreenCanvas(W,H),a=A.getContext('2d'),b=B.getContext('2d'),cv=new OffscreenCanvas(W,H),ctx=cv.getContext('2d',{willReadFrequently:true});
   shape(a);shape(b);let worst=0,corner=0;
   for(const p of [.1,.5,.9]){ctx.clearRect(0,0,W,H);T.draw(ctx,A,B,p,env(),T.plan(rng('tr:'+key)));const s=stat(ctx);worst=Math.max(worst,s.solid);corner=Math.max(corner,s.corner);}
   out.trans[key]={worst:+worst.toFixed(2),corner};
  }
  return out;
 });
 // the shape is about 25% of the picture; nothing may paint the whole picture
 for(const [key,v] of Object.entries(res.fx)){
  const allowed=key==='flash'?150:key==='tracking'?80:30;   // flash is a veil by design (and off by default); tracking lays faint dark scanlines
  if(key!=='flash')assert.ok(v.worst<.55,`fx ${key}: ${Math.round(v.worst*100)}% of the picture is solid`);
  assert.ok(v.corner<=allowed,`fx ${key}: the empty corner became solid (alpha ${v.corner})`);
 }
 // transitions draw seam lines in the accent colour (a part of the look), so only the share of the picture that turns solid is checked
 for(const [key,v] of Object.entries(res.trans)){
  if(key==='flash')continue;   // a veil by design (and off by default)
  assert.ok(v.worst<.7,`transition ${key}: ${Math.round(v.worst*100)}% of the picture is solid`);
 }
 // ---- 背景の絵は、下に絵があるとき、半透明の重ねだけ（下の絵を塗りつぶさない）
 const bgs=await page.evaluate(async()=>{
  const {BG}=await import('/studio/cuts/parts.js'),{rng}=await import('/studio/omakase.js');const W=320,H=180,out={};
  for(const [key,B] of Object.entries(BG)){let max=0;for(const seed of ['a','b','c','d'])for(const t of [.2,1.7,3.1]){const cv=new OffscreenCanvas(W,H),x=cv.getContext('2d',{willReadFrequently:true});
    B.draw(x,{W,H,opaque:false,t,lt:t,dur:4,p:.3,fg:'#ffffff',accent:'#b69cff',bg:'#101018',step:Math.floor(t*24),tmp:()=>cv},B.plan(rng('bg'+key+seed)));
    const d=x.getImageData(0,0,W,H).data;for(let i=3;i<d.length;i+=4)max=Math.max(max,d[i]);}
   out[key]=max;}
  return out;});
 for(const [key,max] of Object.entries(bgs))assert.ok(max<=130,`background ${key}: it paints solid over the picture below (alpha ${max})`);
 // ---- 物の濃さ（worldA）: 物だけが薄くなり、文字は薄くならない
 const thin=await page.evaluate(async()=>{
  const {renderWorld,buildWorldItem,WORLD}=await import('/studio/cuts/worlds.js'),{wordPieces}=await import('/studio/word-size.js'),{rng}=await import('/studio/omakase.js');
  const W=480,H=270,layerCanvas=new OffscreenCanvas(W,H),layer=()=>{const x=layerCanvas.getContext('2d',{willReadFrequently:true});x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,W,H);return x;};
  const out={};
  for(const world of ['window','ticket','card','bands']){
   const cut={text:'私たち',runs:[{text:'私たち'}],start:0,end:1.2,color:'#ffffff',emphasisColor:'#b69cff',bg:'#101018',fontScale:.12,seed:7,enter:'cut',enterP:{},hold:'still',holdP:{},exit:'cut',exitP:{},treat:'none',treatP:{},gFont:'gothic',gVertical:false,world,worldExit:false};
   cut.worldP=WORLD[world].plan(rng('w'+world),cut);
   const item=buildWorldItem(cut,{W,H,measure:(ch,font,px)=>px,pieces:wordPieces(cut.text)});
   const alphaSum=(a,props=true)=>{const cv=new OffscreenCanvas(W,H),x=cv.getContext('2d',{willReadFrequently:true});renderWorld(x,{...cut,worldA:a},item,.6,{layer,W,H,props});const d=x.getImageData(0,0,W,H).data;let s=0;for(let i=3;i<d.length;i+=4)s+=d[i];return s/255/(W*H);};
   const text=alphaSum(1,false),full=alphaSum(1),half=alphaSum(.5),low=alphaSum(.2),zero=alphaSum(0);
   out[world]={text:+text.toFixed(3),full:+full.toFixed(3),ratioHalf:+((half-text)/(full-text)).toFixed(2),ratioLow:+((low-text)/(full-text)).toFixed(2),zero:+zero.toFixed(3)};
  }
  return out;});
 for(const [world,v] of Object.entries(thin)){
  assert.ok(v.full>v.text+.05,`${world}: the world covers more than the text alone (${v.full} vs ${v.text})`);
  assert.ok(Math.abs(v.ratioHalf-.5)<.12,`${world}: 50% → about half of the props are left (${v.ratioHalf})`);
  assert.ok(Math.abs(v.ratioLow-.2)<.1,`${world}: 20% → about a fifth (${v.ratioLow})`);
  assert.ok(Math.abs(v.zero-v.text)<.01,`${world}: 0% → only the text is left (${v.zero} vs ${v.text})`);
 }
 console.log('PASS 透明な絵での画面効果・つなぎ: 全面を塗りつぶさない',JSON.stringify(Object.fromEntries(Object.entries(res.fx).map(([k,v])=>[k,v.worst]))));
});
