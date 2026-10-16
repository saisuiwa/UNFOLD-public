// カット演出の文字エンジン: 字ごとの登場・保持・退場・加工の部品と、それを動かす小さな「文字アイテム」。短いカット（0.5〜1.5秒）向け。
// 既存のコードモーション（Worker で描いたビットマップ）とは別に、文字を1字ずつ Canvas2D で描く。DOM には触らない（node でテストできる。描く関数は ctx を受け取る）。
//
// 文字アイテムの契約（参考ツール の charFns と同じ考え方を、純関数で書き直したもの）:
//   登場/保持/退場の部品は、アイテムの「字ごとの変形」を返すだけ。どのレイアウトにも掛けられる。
//     glyph(g, i, n, p, E, P) → {dx,dy,sx,sy,rot,a,blur,hide}   足し算・掛け算（blur は最大）で合成される。blur は px。i は見える字の番号、n は見える字の数
//     item(it, p, E, P)       → アイテム全体の {blur,sx,sy,a,clip,bar} を書き換える（ワイプ・ブラー・伸縮など）
//   p は、登場なら 0→1（登場の間）、退場なら 0→1（退場の間）、保持なら動きの強さ 0→1。
//   inDur(D,n,P) / outDur(D,n,P) は、登場・退場にかける秒数（カットの長さ D から決める。短いカットでは短い）。
//   加工（TREAT）は、字の描き方（縁取り・影・押し出し・光）と、行の後ろに敷く図形（蛍光ペン・下線・箱）を返す。
// E = {size,W,H,r(i,k),nWords,n,bbox,lt,D,seed}
export const DEG=Math.PI/180,TAU=Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,u)=>a+(b-a)*u;
const fract=x=>x-Math.floor(x);
const outCubic=x=>1-(1-clamp(x))**3;
const inCubic=x=>clamp(x)**3;
const inOutCubic=x=>{x=clamp(x);return x<.5?4*x*x*x:1-(-2*x+2)**3/2;};
const outExpo=x=>x>=1?1:1-2**(-10*clamp(x));
const outBack=(x,s=1.70158)=>{x=clamp(x)-1;return 1+(s+1)*x*x*x+s*x*x;};
const bounceOut=x=>{x=clamp(x);const n=7.5625,d=2.75;return x<1/d?n*x*x:x<2/d?n*(x-=1.5/d)*x+.75:x<2.5/d?n*(x-=2.25/d)*x+.9375:n*(x-=2.625/d)*x+.984375;};
const hash=(a,b=0,c=0)=>fract(Math.sin(a*127.1+b*311.7+c*74.7)*43758.5453);
const pickW=(r,items,weights)=>{let x=r()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<items.length;i++){x-=weights[i];if(x<=0)return items[i];}return items.at(-1);};
const sign=r=>r()<.5?-1:1;
/** 字 i の、登場の間の進み具合。spread は先頭と最後の字のずれ（登場全体に対する割合） */
const local=(p,i,n,spread)=>clamp((p-(n>1?i/(n-1)*spread:0))/Math.max(.05,1-spread));
const ALL=['calm','pop','glitch','graphic','emotional','impact'];

// ---- 登場（短いカット向け。fast=短くても成り立つ） --------------------------------------------------------------------------------------------
export const ENTER={
 cut:{name:'カット',tags:ALL,w:.5,fast:true,inDur:()=>0},
 pop:{name:'ポップ',tags:['pop','impact','glitch','emotional'],w:1.4,fast:true,inDur:D=>clamp(D*.3,.13,.38),plan:r=>({spread:.35+r()*.2,amp:2+r()*1.6}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread);if(q<=0)return {hide:true};const s=outBack(q,P.amp);return {sx:s,sy:s,rot:(1-outCubic(q))*(E.r(i,1)-.5)*30};}},
 slide:{name:'すべり込み',tags:['calm','emotional','graphic','pop'],w:1.4,fast:true,inDur:D=>clamp(D*.32,.14,.4),plan:r=>({dir:pickW(r,['up','down','left','right'],[3,1,1.2,1.2]),spread:.4}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread);if(q<=0)return {hide:true};const d=E.size*1.3*(1-outCubic(q));
   return {dx:P.dir==='left'?-d:P.dir==='right'?d:0,dy:P.dir==='up'?d:P.dir==='down'?-d:0,a:clamp(q*2)};}},
 drop:{name:'落ちてバウンド',tags:['pop','impact','calm'],w:1,inDur:D=>clamp(D*.38,.2,.5),plan:r=>({spread:.45+r()*.15}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread);if(q<=0)return {hide:true};return {dy:-(1-bounceOut(q))*E.size*2.2,sy:1+(1-q)*.3,sx:1-(1-q)*.12};}},
 type:{name:'タイプ',tags:['glitch','graphic','calm'],w:.9,maxChars:14,inDur:(D,n)=>clamp(n*.045+.08,.14,D*.5),plan:()=>({}),
  glyph:(g,i,n,p)=>i>=Math.floor(p*(n+.999))?{hide:true}:null},
 wipe:{name:'ワイプ',tags:['graphic','glitch','editorial','calm'],w:1,minDur:.6,inDur:D=>clamp(D*.3,.18,.45),plan:r=>({dir:sign(r)}),
  item(it,p,E,P){const e=inOutCubic(p),x0=E.bbox.x0-8,x1=E.bbox.x1+8;it.clip=P.dir>0?{x0:-1e9,x1:lerp(x0,x1,e)}:{x0:lerp(x1,x0,e),x1:1e9};it.bar={x:P.dir>0?it.clip.x1:it.clip.x0};}},
 blur:{name:'ブラー',tags:['emotional','calm','pop'],w:1,fast:true,inDur:D=>clamp(D*.32,.15,.4),plan:()=>({}),
  item(it,p,E){const e=outCubic(p);it.blur=(1-e)*E.size*.3;it.a*=Math.pow(e,.7);it.sx*=1+.12*(1-e);it.sy*=1+.12*(1-e);}},
 scatter:{name:'散らばって集まる',tags:['pop','emotional','impact'],w:1,minDur:.7,inDur:D=>clamp(D*.4,.2,.55),plan:r=>({k:2.4+r()*1.4}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,.25);if(q<=0)return {hide:true};const k=1-outExpo(q),ang=E.r(i,2)*TAU,dist=E.size*P.k*(.4+.6*E.r(i,3));
   return {dx:Math.cos(ang)*dist*k,dy:Math.sin(ang)*dist*k,rot:(E.r(i,4)-.5)*180*k,sx:1+(E.r(i,5)*1.4-.2)*k,sy:1+(E.r(i,5)*1.4-.2)*k,a:clamp(q*3)};}},
 stretch:{name:'横に伸びて戻る',tags:['impact','glitch','graphic','pop'],w:.9,fast:true,inDur:D=>clamp(D*.28,.13,.35),plan:()=>({}),
  item(it,p){it.sx*=lerp(3.2,1,outExpo(p));it.a*=clamp(p*3);}},
 slam:{name:'語ごとにドン',tags:['impact','pop','graphic'],w:1.4,fast:true,inDur:D=>clamp(D*.34,.16,.42),plan:()=>({}),
  glyph(g,i,n,p,E){const q=local(p,g.word??0,Math.max(1,E.nWords),.5);if(q<=0)return {hide:true};const s=1+1.5*(1-outExpo(q));
   return {dx:(g.cx-g.wcx)*(s-1),dy:(g.cy-g.wcy)*(s-1),sx:s,sy:s,a:clamp(q*4)};}},
 spin:{name:'回って現れる',tags:['pop','emotional','impact'],w:.9,fast:true,inDur:D=>clamp(D*.32,.15,.4),plan:()=>({}),
  glyph(g,i,n,p,E){const q=local(p,i,n,.3);if(q<=0)return {hide:true};const s=.3+.7*outBack(q);return {rot:(1-outCubic(q))*(E.r(i,6)<.5?-1:1)*120,sx:s,sy:s,a:clamp(q*3)};}},
 flicker:{name:'点滅して現れる',tags:['glitch','graphic','impact'],w:1,fast:true,inDur:D=>clamp(D*.3,.14,.36),plan:()=>({}),
  glyph(g,i,n,p,E){const on=E.r(i,7)<p*1.3&&hash(i,Math.floor(p*12),E.seed%97)<.35+p*.8;return on?null:{hide:true};}},
 blurStep:{name:'ブラー段差',tags:['emotional','calm','pop','glitch'],w:1.1,fast:true,inDur:D=>clamp(D*.36,.16,.45),plan:()=>({}),
  glyph(g,i,n,p,E){const q=local(p,i,n,.5),k=1-q;return {blur:(1-outCubic(q))*E.size*.28,a:Math.pow(clamp(q*1.6),.8),sx:1+.12*k,sy:1+.12*k};}},
 focusZoom:{name:'ぼやけながら寄る',tags:['emotional','calm','impact'],w:.9,fast:true,inDur:D=>clamp(D*.34,.16,.42),plan:()=>({}),
  item(it,p,E){const e=outCubic(p),k=1-e;it.blur=k*E.size*.35;it.sx*=1+.35*k;it.sy*=1+.35*k;it.a*=Math.pow(clamp(p*1.5),.8);}},
 glitch:{name:'ずれながら現れる',tags:['glitch','graphic','impact'],w:1,fast:true,inDur:D=>clamp(D*.28,.13,.34),plan:()=>({}),
  glyph(g,i,n,p,E){const q=local(p,i,n,.3);if(q<=0)return {hide:true};const f=Math.floor(p*14);
   return {dx:(E.r(i,f)-.5)*E.size*1.2*(1-q),a:q<.5?(E.r(i,Math.floor(p*20))<.5?1:0):1};}}
};

// ---- 保持（読んでいる間の小さな動き。強さ p はいつも小さく） -----------------------------------------------------------------------------------
export const HOLD={
 still:{name:'静止',tags:ALL,w:1.2,plan:()=>({})},
 drift:{name:'ゆっくりドリフト',tags:['calm','emotional','graphic'],w:1.2,plan:r=>({ax:r()*2-1,ay:r()*2-1,ph:r()*TAU}),
  glyph:(g,i,n,p,E,P)=>({dx:Math.sin(E.lt*.9+P.ph)*E.size*.035*p*P.ax,dy:Math.cos(E.lt*.8+P.ph)*E.size*.035*p*P.ay})},
 breathe:{name:'呼吸',tags:['calm','emotional','pop'],w:1.1,plan:r=>({ph:r()*TAU}),
  item(it,p,E,P){const s=1+Math.sin(E.lt*TAU*1.1+P.ph)*.025*p;it.sx*=s;it.sy*=s;}},
 wave:{name:'字送りの波',tags:['pop','emotional','calm'],w:1,plan:()=>({}),glyph:(g,i,n,p,E)=>({dy:Math.sin(E.lt*5-i*.7)*E.size*.07*p})},
 jitter:{name:'細かい震え',tags:['glitch','impact','graphic'],w:.9,plan:()=>({}),
  glyph:(g,i,n,p,E)=>{const f=Math.floor(E.lt*12);return {dx:(hash(i,f,1)-.5)*E.size*.05*p,dy:(hash(i,f,2)-.5)*E.size*.05*p};}},
 tilt:{name:'ゆらぎ',tags:['calm','emotional','pop'],w:1,plan:()=>({}),glyph:(g,i,n,p,E)=>({rot:Math.sin(E.lt*1.6+i*.5)*2.2*p})},
 glitchtick:{name:'ときどきずれる',tags:['glitch','graphic','impact'],w:.9,plan:()=>({}),
  glyph:(g,i,n,p,E)=>{if(fract(E.lt*2.2)>.12)return null;const f=Math.floor(E.lt*24);return E.r(i,f)<.5?{dx:(E.r(i,f+7)-.5)*E.size*.4*p}:null;}},
 float:{name:'ふわふわ',tags:['calm','emotional'],w:1,plan:()=>({}),glyph:(g,i,n,p,E)=>({dy:Math.sin(E.lt*2.2+i*.5)*E.size*.05*p,dx:Math.cos(E.lt*1.7+i*.4)*E.size*.02*p})},
 focusPull:{name:'ピント送り',tags:['emotional','calm','pop','graphic'],w:1,plan:r=>({sp:.8+r()*.8,ph:r()*3}),
  glyph:(g,i,n,p,E,P)=>{const f=((E.lt*P.sp*3+P.ph)%(n+3))-1.5;return {blur:E.size*.075*p*clamp(Math.abs(i-f)/2.5)};}},
 softBreath:{name:'ピンぼけ呼吸',tags:['emotional','calm','glitch'],w:.9,plan:r=>({ph:r()*TAU}),
  item(it,p,E,P){it.blur=Math.max(it.blur,(.5+.5*Math.sin(E.lt*2.2+P.ph))*E.size*.05*p);}}
};

// ---- 退場（カットの最後の短い間。途中のカットでは cut が出やすい） -------------------------------------------------------------------------------
export const EXIT={
 cut:{name:'カット',tags:ALL,w:1,outDur:()=>0},
 fade:{name:'フェード',tags:['calm','emotional','graphic','pop'],w:1.4,outDur:D=>clamp(D*.2,.1,.3),plan:()=>({}),glyph:(g,i,n,p)=>({a:1-local(p,i,n,.4)})},
 slideOut:{name:'すべり出る',tags:['calm','graphic','pop','emotional'],w:1.1,outDur:D=>clamp(D*.22,.12,.32),plan:r=>({dir:sign(r)}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,.35);return {dy:P.dir*inCubic(q)*E.size*1.2,a:1-q};}},
 explode:{name:'飛び散る',tags:['impact','pop','glitch'],w:1,outDur:D=>clamp(D*.28,.18,.4),plan:r=>({k:2+r()*1.4}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,.2),ang=E.r(i,2)*TAU,d=E.size*P.k*inCubic(q);return {dx:Math.cos(ang)*d,dy:Math.sin(ang)*d,rot:(E.r(i,4)-.5)*240*q,a:1-Math.pow(q,1.5)};}},
 fall:{name:'落ちて消える',tags:['pop','impact','calm'],w:1,outDur:D=>clamp(D*.3,.18,.42),plan:()=>({}),
  glyph(g,i,n,p,E){const q=local(p,i,n,.45);return {dy:inCubic(q)*E.size*3,rot:(E.r(i,3)-.5)*60*q,a:1-clamp(q*1.3)};}},
 shrink:{name:'縮んで消える',tags:['pop','emotional','calm'],w:1,outDur:D=>clamp(D*.24,.13,.34),plan:()=>({}),
  glyph(g,i,n,p){const q=local(p,i,n,.4),s=Math.max(.001,1-inCubic(q));return {sx:s,sy:s,a:1-q};}},
 blurOut:{name:'ぼけて消える',tags:['emotional','calm','pop'],w:1,outDur:D=>clamp(D*.24,.13,.34),plan:()=>({}),
  item(it,p,E){it.blur=outCubic(p)*E.size*.3;it.a*=1-p*.9;}},
 wipeOut:{name:'ワイプで消える',tags:['graphic','glitch','calm'],w:.9,minDur:.6,outDur:D=>clamp(D*.24,.15,.36),plan:r=>({dir:sign(r)}),
  item(it,p,E,P){const e=inOutCubic(p),x0=E.bbox.x0-8,x1=E.bbox.x1+8;it.clip=P.dir>0?{x0:lerp(x0,x1,e),x1:1e9}:{x0:-1e9,x1:lerp(x1,x0,e)};}},
 zoomPast:{name:'手前へ抜ける',tags:['impact','pop','graphic'],w:1,outDur:D=>clamp(D*.22,.12,.3),plan:()=>({}),
  item(it,p){it.sx*=1+inCubic(p)*1.8;it.sy*=1+inCubic(p)*1.8;it.a*=1-p*p;}},
 collapse:{name:'線につぶれる',tags:['graphic','glitch','impact'],w:.9,outDur:D=>clamp(D*.22,.12,.3),plan:()=>({}),
  item(it,p){it.sy*=lerp(1,.02,inCubic(p));it.a*=1-p*.6;}},
 blurEach:{name:'字ごとボケ',tags:['emotional','calm','pop','glitch'],w:1,outDur:D=>clamp(D*.26,.14,.34),plan:()=>({}),
  glyph(g,i,n,p,E){const q=local(p,i,n,.5);return {blur:inCubic(q)*E.size*.3,a:1-clamp(q*1.1)};}},
 glitchOut:{name:'ずれて消える',tags:['glitch','graphic','impact'],w:1,outDur:D=>clamp(D*.22,.12,.3),plan:()=>({}),
  glyph(g,i,n,p,E){const f=Math.floor(p*14);return {dx:(E.r(i,f)-.5)*E.size*1.4*p,a:p>.5&&E.r(i,Math.floor(p*20))<p?0:1-p*.5};}}
};

// ---- 加工（字の描き方と、行の後ろに敷く図形） -------------------------------------------------------------------------------------------------
const luma=hex=>{const n=parseInt(String(hex).slice(1,7),16)||0;return (.2126*(n>>16&255)+.7152*(n>>8&255)+.0722*(n&255))/255;};
const contrast=hex=>luma(hex)>.55?'#101018':'#ffffff';
const rgbaOf=(hex,a)=>{const n=parseInt(String(hex).slice(1,7),16)||0;return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;};
export const TREAT={
 none:{name:'なし',tags:ALL,w:2.2,style:()=>({})},
 outline:{name:'縁取り',tags:['pop','impact','graphic','emotional'],w:1.2,style:(P,c)=>({stroke:{w:.085,color:contrast(c.color)}})},
 hollow:{name:'中抜き',tags:['graphic','glitch','impact'],w:.9,style:(P,c)=>({fill:false,stroke:{w:.04,color:c.color}})},
 shadow:{name:'ずらし影',tags:['pop','impact','graphic'],w:1,style:()=>({shadow:{dx:.06,dy:.06,blur:0,color:'rgba(0,0,0,.75)'}})},
 extrude:{name:'押し出し',tags:['impact','pop','graphic'],w:.9,style:(P,c)=>({extrude:{n:12,dx:.011,dy:.011,color:c.accent}})},
 glow:{name:'光る',tags:['emotional','calm','glitch'],w:1,style:(P,c)=>({shadow:{dx:0,dy:0,blur:.3,color:c.accent}})},
 marker:{name:'蛍光ペン',tags:['pop','graphic','impact'],w:.9,style:(P,c)=>({textColor:contrast(c.accent),deco:'marker'})},
 underline:{name:'下線',tags:['calm','graphic','emotional','pop'],w:1,style:()=>({deco:'underline'})},
 box:{name:'箱',tags:['graphic','glitch','impact'],w:.8,style:()=>({deco:'box'})},
 soft:{name:'ぼけた字',tags:['emotional','calm','glitch'],w:.9,style:()=>({blur:.055})},
 softShadow:{name:'ぼかし影',tags:['emotional','calm','pop','graphic'],w:1,
  // 暗い背景では黒い影が見えないので、アクセント色のやわらかい影にする
  style:(P,c)=>({shadow:{dx:.05,dy:.06,blur:.3,color:luma(c.bg)<.5?rgbaOf(c.accent,.6):'rgba(0,0,0,.55)'}})},
 blurTrail:{name:'ぼかし送り',tags:['pop','glitch','emotional','impact'],w:.9,style:()=>({trail:{n:5,dx:-.075,dy:0,a:.5}})}
};
export const GLYPH_GROUPS={enter:ENTER,hold:HOLD,exit:EXIT,treat:TREAT};
export const GLYPH_GROUP_NAMES={enter:'登場',hold:'保持',exit:'退場',treat:'加工'};

// ---- 配置（折り返し・縦書き）。measure(ch,fontKey,px) は呼ぶ側が渡す（ブラウザでは Canvas の measureText） --------------------------------------------
const KINSOKU_START=new Set([...'、。，．,.!?！？）」』】〕〉》］｝ー〜～…‥っゃゅょぁぃぅぇぉッャュョァィゥェォ']);
const KINSOKU_END=new Set([...'（「『【〔〈《［｛']);
/**
 * 文字を字ごとの箱に並べる。返す glyphs の cx,cy は絵の中心(W/2,H/2)を基準にした絶対座標。
 * runs: [{text,scale?,emphasis?,color?}]、pieces: [{from,to}]（語の区切り。word 番号を付けるため）
 */
export function layoutText({text,runs,pieces,W,H,size,font,measure,vertical=false,maxWidth=.86,mode='wrap',cols=0,curve=null,align='center'}){
 const chars=[];let off=0;
 for(const r of (runs&&runs.length?runs:[{text}]))for(const ch of Array.from(r.text||'')){
  if(ch==='\n'){chars.push({ch,br:true});off+=1;continue;}
  const s=r.scale>0?r.scale:1;
  chars.push({ch,s,emphasis:!!r.emphasis,color:r.color,off,space:/\s/.test(ch)});off+=ch.length;
 }
 const wordOf=o=>{if(!pieces)return 0;const k=pieces.findIndex(p=>o>=p.from&&o<p.to);return k<0?0:k;};
 for(const c of chars){if(c.br)continue;c.size=size*c.s;c.w=c.space?size*.3*c.s:measure(c.ch,font,c.size);c.word=wordOf(c.off);}
 const body=chars.filter(c=>!c.br);
 const glyphs=[],lines=[];
 let effSize=null;
 if(mode==='grid'&&!vertical){
  // 升目: 1字ずつ同じ大きさの升に入れる。lines は行（升の並び）
  const n=body.length,cc=Math.max(1,Math.min(cols||n,n)),rr=Math.ceil(n/cc),cell=Math.min(W*.96/cc,H*.92/rr),px=cell*.78;
  effSize=px;
  body.forEach((c,idx)=>{const r=Math.floor(idx/cc),k=idx%cc,cx=W/2+(k-(cc-1)/2)*cell,cy=H/2+(r-(rr-1)/2)*cell;
   if(!c.space)glyphs.push({ch:c.ch,cx,cy,w:cell,size:px,s:1,color:c.color,emphasis:c.emphasis,word:c.word,line:r,cell:{x:cx-cell/2,y:cy-cell/2,w:cell}});});
  for(let r=0;r<rr;r++)lines.push({x0:W/2-cc*cell/2,x1:W/2+cc*cell/2,cy:H/2+(r-(rr-1)/2)*cell,h:cell});
  var scale=1;
 }else if(!vertical){
  const total=body.reduce((a,c)=>a+c.w,0),maxW=W*maxWidth,nLines=mode==='path'?1:Math.max(1,Math.ceil(total/maxW)),target=total/nLines;
  const rows=[];let cur=[],curW=0;
  for(const c of chars){
   if(c.br){rows.push(cur);cur=[];curW=0;continue;}
   if(cur.length&&curW+c.w/2>target&&rows.length<nLines-1){
    if(KINSOKU_START.has(c.ch)){cur.push(c);curW+=c.w;continue;}
    if(KINSOKU_END.has(cur.at(-1).ch)){const m=cur.pop();rows.push(cur);cur=[m,c];curW=m.w+c.w;continue;}
    rows.push(cur);cur=[];curW=0;
   }
   cur.push(c);curW+=c.w;
  }
  if(cur.length)rows.push(cur);
  const info=rows.map(row=>({row,w:row.reduce((a,c)=>a+c.w,0),h:Math.max(1,...row.map(c=>c.size||0))}));
  const pitch=info.map(l=>l.h*1.28),totalH=pitch.reduce((a,b)=>a+b,0),maxLine=Math.max(1,...info.map(l=>l.w));
  const k=Math.min(1,W*.92/maxLine,H*.82/Math.max(1,totalH));
  let y=-totalH*k/2;
  info.forEach((l,li)=>{
   const ph=pitch[li]*k;let x=align==='left'?-W*maxWidth/2:-l.w*k/2;const cy=y+ph/2;
   for(const c of l.row){const w=c.w*k;if(!c.space)glyphs.push({ch:c.ch,cx:W/2+x+w/2,cy:H/2+cy,w,size:c.size*k,s:c.s,color:c.color,emphasis:c.emphasis,word:c.word,line:li});x+=w;}
   lines.push({x0:W/2+(align==='left'?-W*maxWidth/2:-l.w*k/2),x1:W/2+(align==='left'?-W*maxWidth/2:-l.w*k/2)+l.w*k,cy:H/2+cy,h:l.h*k*1.1});y+=ph;
  });
  var scale=k;
  if(mode==='path'&&curve){
   // 曲線に沿わせる: 基準線を sin 波にして、字を接線の向きに傾ける
   const L=Math.max(1,maxLine*k);
   for(const g of glyphs){const u=g.cx-W/2,ph=u/L*TAU*curve.k+curve.ph;g.cy+=curve.amp*Math.sin(ph);g.rot0=Math.atan(curve.amp*Math.cos(ph)*TAU*curve.k/L)/DEG;}
  }
 }else{
  const n=body.length,perCol=n<=6?n:Math.ceil(n/Math.ceil(n/6)),cols=Math.ceil(n/perCol),colPitch=size*1.35;
  const k=Math.min(1,H*.82/(perCol*size*1.08),W*.8/(cols*colPitch));
  let idx=0;
  for(let c=0;c<cols;c++){
   const members=body.slice(idx,idx+perCol);idx+=perCol;
   const colH=members.reduce((a,m)=>a+m.size*1.08,0)*k;let y=-colH/2;
   const cx=W/2+((cols-1)/2-c)*colPitch*k;
   for(const m of members){const h=m.size*1.08*k;if(!m.space)glyphs.push({ch:m.ch,cx,cy:H/2+y+h/2,w:m.size*k,size:m.size*k,s:m.s,color:m.color,emphasis:m.emphasis,word:m.word,line:c});y+=h;}
   lines.push({x0:cx-size*k*.6,x1:cx+size*k*.6,cy:H/2,h:colH,vertical:true});
  }
  var scale=k;
 }
 glyphs.forEach((g,i)=>{g.i=i;});
 // 語の中心（語ごとの動きの基準）
 const words=new Map();
 for(const g of glyphs){const w=words.get(g.word)||{sx:0,sy:0,n:0};w.sx+=g.cx;w.sy+=g.cy;w.n++;words.set(g.word,w);}
 for(const g of glyphs){const w=words.get(g.word);g.wcx=w.sx/w.n;g.wcy=w.sy/w.n;}
 const xs=glyphs.map(g=>g.cx),ys=glyphs.map(g=>g.cy),hs=glyphs.map(g=>g.size);
 const bbox=glyphs.length?{x0:Math.min(...glyphs.map(g=>g.cx-g.w/2)),x1:Math.max(...glyphs.map(g=>g.cx+g.w/2)),y0:Math.min(...ys.map((y,i)=>y-hs[i]/2)),y1:Math.max(...ys.map((y,i)=>y+hs[i]/2))}:{x0:W/2,x1:W/2,y0:H/2,y1:H/2};
 return {glyphs,lines,bbox,nWords:new Set(glyphs.map(g=>g.word)).size,fit:scale,size:effSize};
}

// ---- アイテム: 配置 + 選んだ部品 + 時間割 ----------------------------------------------------------------------------------------------------
/** 登場・退場にかける秒数。合わせて カットの60% までに収める（読める時間を残す） */
export function timingsOf(D,enter,exit,n,PE,PX){
 let a=ENTER[enter]?.inDur?.(D,n,PE)??0,b=EXIT[exit]?.outDur?.(D,n,PX)??0;
 const lim=.6*D;
 if(a+b>lim){const f=lim/(a+b);a*=f;b*=f;}
 return {inDur:a,outDur:b};
}
/**
 * cut: {text,runs,start,end,color,emphasisColor,bg,fontScale,seed,
 *       enter,enterP,hold,holdP,exit,exitP,treat,treatP,gFont,gVertical}
 */
export function buildItem(cut,{W,H,measure,pieces,fontFamily=key=>`"U-${key}", sans-serif`,frame=null}){
 // frame（世界が決める文字の領域）があれば、その箱の中だけで折り返す。大きさの基準は絵全体（fontScale）のまま。
 const LW=frame?frame.box.w:W,LH=frame?frame.box.h:H;
 const size=Math.min(W,H)*cut.fontScale,font=cut.gFont||'gothic';
 const lay=layoutText({text:cut.text,runs:cut.runs,pieces,W:LW,H:LH,size,font,measure,vertical:!!cut.gVertical&&!frame,mode:frame?.mode,cols:frame?.cols,curve:frame?.curve,align:frame?.align,maxWidth:frame?.maxWidth});
 const delay=frame?.delay||0,D=cut.end-cut.start-delay,n=lay.glyphs.length;
 const tm=timingsOf(D,cut.enter,cut.exit,n,cut.enterP,cut.exitP);
 const style=(TREAT[cut.treat]||TREAT.none).style(cut.treatP,{color:cut.color,accent:cut.emphasisColor,bg:cut.bg});
 return {...lay,n,D,delay,seed:cut.seed|0,W:LW,H:LH,size:lay.size??size*lay.fit,font,family:fontFamily(font),fontFamily,color:style.textColor||cut.color,accent:cut.emphasisColor,bg:cut.bg,style,
  enter:cut.enter,enterP:cut.enterP,hold:cut.hold,holdP:cut.holdP,exit:cut.exit,exitP:cut.exitP,timing:tm};
}

const IDENT=()=>({dx:0,dy:0,sx:1,sy:1,rot:0,a:1,blur:0,hide:false});
const merge=(st,d)=>{if(!d)return;if(d.hide)st.hide=true;st.dx+=d.dx||0;st.dy+=d.dy||0;st.sx*=d.sx??1;st.sy*=d.sy??1;st.rot+=d.rot||0;st.a*=d.a??1;st.blur=Math.max(st.blur,d.blur||0);};
/** カット内の時刻 lt での、字ごとの状態とアイテム全体の状態（純関数） */
export function stateAt(item,lt){
 const {D,timing:{inDur,outDur}}=item,n=item.n;
 const pIn=inDur>0?clamp(lt/inDur):1,pOut=outDur>0?clamp((lt-(D-outDur))/outDur):0,amt=clamp((lt-inDur*.85)/.25)*(1-pOut);
 const E={size:item.size,W:item.W,H:item.H,r:(i,k)=>hash(i,k,item.seed%977),nWords:item.nWords,n,bbox:item.bbox,lt,D,seed:item.seed};
 const en=ENTER[item.enter],ho=HOLD[item.hold],ex=EXIT[item.exit];
 const it={blur:0,sx:1,sy:1,a:1,clip:null,bar:null,pIn,pOut};
 if(en&&pIn<1)en.item?.(it,pIn,E,item.enterP);
 if(ho&&amt>0)ho.item?.(it,amt,E,item.holdP);
 if(ex&&pOut>0)ex.item?.(it,pOut,E,item.exitP);
 const glyphs=item.glyphs.map((g,i)=>{
  const st=IDENT();
  if(en&&pIn<1)merge(st,en.glyph?.(g,i,n,pIn,E,item.enterP));
  if(ho&&amt>0)merge(st,ho.glyph?.(g,i,n,amt,E,item.holdP));
  if(ex&&pOut>0)merge(st,ex.glyph?.(g,i,n,pOut,E,item.exitP));
  return st;
 });
 return {glyphs,it};
}
/** 読める状態か: 全部の字が見えていて、ほぼ元の位置・大きさ・濃さ */
export function readableAt(item,lt){
 const {glyphs,it}=stateAt(item,lt),s=item.size;
 if(it.blur>s*.06||it.clip||it.sx<.85||it.sx>1.2||it.sy<.85||it.sy>1.2||it.a<.9)return false;
 return glyphs.every(g=>!g.hide&&(g.blur||0)<=s*.08&&g.a>=.9&&Math.abs(g.dx)<s*.15&&Math.abs(g.dy)<s*.15&&g.sx>.8&&g.sx<1.25&&g.sy>.8&&g.sy<1.25&&Math.abs(g.rot)<12);
}
/** カットのうち、読める状態にある時間の割合（0.04秒きざみ） */
export function readableShare(item,step=.04){
 let ok=0,all=0;
 for(let t=0;t<item.D;t+=step){all++;if(readableAt(item,t))ok++;}
 return all?ok/all:0;
}

// ---- 描画 ---------------------------------------------------------------------------------------------------------------------------------
function decoDraw(c,item,it){
 const T=item.style.deco;if(!T)return;
 const e=outCubic(it.pIn);
 for(const l of item.lines){
  if(l.vertical)continue;
  const w=(l.x1-l.x0),pad=l.h*.14;
  if(T==='marker'){c.fillStyle=item.accent;c.globalAlpha=.92*it.a;c.fillRect(l.x0-pad,l.cy-l.h*.46,(w+pad*2)*e,l.h*.92);}
  else if(T==='underline'){c.fillStyle=item.accent;c.globalAlpha=it.a;c.fillRect(l.x0,l.cy+l.h*.5,w*e,Math.max(2,l.h*.07));}
  else if(T==='box'){c.globalAlpha=it.a;c.fillStyle=`rgba(255,255,255,.1)`;c.fillRect(l.x0-pad,l.cy-l.h*.55,(w+pad*2)*e,l.h*1.1);c.strokeStyle=item.accent;c.lineWidth=Math.max(2,l.h*.05);c.strokeRect(l.x0-pad,l.cy-l.h*.55,(w+pad*2)*e,l.h*1.1);}
 }
 c.globalAlpha=1;
}
const canFilter=c=>typeof c.filter==='string';
/** canvas の filter が使えない時の代わり: ずらした薄いコピーを重ねる */
function fakeBlur(c,paint,r,base){
 for(let k=0;k<8;k++){const a=k/8*TAU;c.save();c.translate(Math.cos(a)*r*.7,Math.sin(a)*r*.7);c.globalAlpha=base*.16;paint();c.restore();}
 c.globalAlpha=base*.45;paint();
}
function glyphDraw(c,item,g,s,it,tint){
 const T=item.style,px=g.size,bl=Math.max(s.blur||0,(T.blur||0)*px),base=clamp(s.a)*it.a;
 c.save();c.translate(g.cx+s.dx,g.cy+s.dy);if(g.rot0||s.rot)c.rotate(((g.rot0||0)+s.rot)*DEG);c.scale(s.sx,s.sy);
 c.font=`${px}px ${g.fontKey?item.fontFamily(g.fontKey):item.family}`;c.textAlign='center';c.textBaseline='middle';
 const col=tint||g.color||(g.emphasis?item.accent:item.color);
 const paint=tint?()=>{c.globalAlpha=base;c.fillStyle=tint;c.fillText(g.ch,0,0);}:()=>{   // tint: ゴーストの層。影・縁・押し出しは付けず、色だけで塗った形にする
  c.globalAlpha=base;
  if(T.extrude){c.fillStyle=T.extrude.color;for(let k=T.extrude.n;k>=1;k--)c.fillText(g.ch,k*T.extrude.dx*px,k*T.extrude.dy*px);}
  if(T.trail){c.fillStyle=col;for(let k=T.trail.n;k>=1;k--){c.globalAlpha=base*T.trail.a*(1-(k-1)/T.trail.n);c.fillText(g.ch,k*T.trail.dx*px,k*(T.trail.dy||0)*px);}c.globalAlpha=base;}
  if(T.shadow){c.shadowColor=T.shadow.color;c.shadowBlur=T.shadow.blur*px;c.shadowOffsetX=T.shadow.dx*px;c.shadowOffsetY=T.shadow.dy*px;}
  if(T.stroke){c.lineJoin='round';c.lineWidth=T.stroke.w*px;c.strokeStyle=T.stroke.color;c.strokeText(g.ch,0,0);c.shadowColor='transparent';}
  if(T.fill!==false){c.fillStyle=T.textColor&&!g.emphasis?T.textColor:col;c.fillText(g.ch,0,0);}
 };
 if(bl>.5&&!tint){if(canFilter(c)){c.filter=`blur(${bl.toFixed(1)}px)`;paint();}else fakeBlur(c,paint,bl,base);}
 else paint();
 c.restore();
}
/**
 * ctx（W×H。透明に消してから呼ぶ）に、カット内の時刻 lt の文字を描く。
 * layer() は、ぼかし用に W×H の透明な 2D コンテキストを返す関数（ぼかしを使わないなら要らない）。
 */
export function renderText(ctx,item,lt,{layer,tint}={}){
 lt-=item.delay||0;   // 世界が先に出てくる間は、文字はまだ出さない
 if(lt<0)return;
 const {glyphs,it}=stateAt(item,lt);
 const useLayer=it.blur>.4&&layer,c=useLayer?layer():ctx;
 c.save();
 // アイテム全体の伸縮は、文字全体の中心を基準にする
 const cx=(item.bbox.x0+item.bbox.x1)/2,cy=(item.bbox.y0+item.bbox.y1)/2;
 c.translate(cx,cy);c.scale(it.sx,it.sy);c.translate(-cx,-cy);
 if(it.clip){c.beginPath();c.rect(it.clip.x0,-1e5,it.clip.x1-it.clip.x0,2e5);c.clip();}
 if(!tint)decoDraw(c,item,it);
 for(let i=0;i<glyphs.length;i++){
  const s=glyphs[i];if(s.hide||s.a<=0)continue;
  glyphDraw(c,item,item.glyphs[i],s,it,tint);
 }
 c.restore();
 if(it.bar&&it.pIn<1){ctx.fillStyle=item.accent;ctx.globalAlpha=.9;ctx.fillRect(it.bar.x-Math.max(3,item.size*.04),item.bbox.y0-item.size*.1,Math.max(6,item.size*.08),item.bbox.y1-item.bbox.y0+item.size*.2);ctx.globalAlpha=1;}
 if(useLayer){ctx.save();ctx.filter=`blur(${it.blur.toFixed(1)}px)`;ctx.drawImage(c.canvas,0,0);ctx.restore();}
}
