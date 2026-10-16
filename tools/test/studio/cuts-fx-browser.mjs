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
 console.log('PASS 透明な絵での画面効果・つなぎ: 全面を塗りつぶさない',JSON.stringify(Object.fromEntries(Object.entries(res.fx).map(([k,v])=>[k,v.worst]))));
});
