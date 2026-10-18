// カット演出の文字エンジン: 字ごとの登場・保持・退場・加工の部品と、それを動かす小さな「文字アイテム」。短いカット（0.5〜1.5秒）向け。
// 既存のコードモーション（Worker で描いたビットマップ）とは別に、文字を1字ずつ Canvas2D で描く。DOM には触らない（node でテストできる。描く関数は ctx を受け取る）。
//
// 文字アイテムの契約（字ごとの変形を返す関数を、純関数で書いたもの）:
//   登場/保持/退場の部品は、アイテムの「字ごとの変形」を返すだけ。どのレイアウトにも掛けられる。
//     glyph(g, i, n, p, E, P) → {dx,dy,sx,sy,rot,a,blur,hide}   足し算・掛け算（blur は最大）で合成される。blur は px。i は見える字の番号、n は見える字の数
//       ほかに ch reel cell paint bold thin erode（字の描き替え・切り抜き・塗り・太さ・削れて消える。glyphDraw のコメント）
//     item(it, p, E, P)       → アイテム全体の {blur,sx,sy,a,clip,bar} を書き換える（ワイプ・ブラー・伸縮など）
//   p は、登場なら 0→1（登場の間）、退場なら 0→1（退場の間）、保持なら動きの強さ 0→1。
//   inDur(D,n,P) / outDur(D,n,P) は、登場・退場にかける秒数（カットの長さ D から決める。短いカットでは短い）。
//   加工（TREAT）は、字の描き方（縁取り・影・押し出し・光）と、行の後ろに敷く図形（蛍光ペン・下線・箱）を返す。
// E = {size,W,H,r(i,k),nWords,n,bbox,lt,D,seed}
import {addDailyParts} from './kit.js';
import {DAILY_CUT_PARTS} from './daily-parts.js';
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
/** 字 g が、文字全体の中心から長い向き（横組みなら横・縦組みなら縦）にどれだけ離れているか（-1..1）と、その向き。字間を動かす部品が使う */
function along(g,E){const b=E.bbox,w=b.x1-b.x0,h=b.y1-b.y0,horiz=w>=h,half=Math.max(1,(horiz?w:h)/2);return {u:horiz?(g.cx-(b.x0+b.x1)/2)/half:(g.cy-(b.y0+b.y1)/2)/half,horiz};}
// 字の置き換えの部品が、本物の字の代わりに描く記号の組（plan の sym で選ぶ）
const SYMS={mix:'#$%&@*+=<>/?アイウエオカキクケコサシス0123456789ABCDEFXZ',hex:'0123456789ABCDEF',kana:'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン',digit:'0123456789'};
const symOf=(set,u)=>{const S=SYMS[set]||SYMS.mix;return S[Math.floor(clamp(u,0,.999)*S.length)];};
/** 字 i が確定する順番（0 が最初、1 が最後）。left: 左から、center: 中央から外へ、random: ばらばら */
const lockOrder=(i,n,E,order)=>n<=1?0:order==='center'?Math.abs(i-(n-1)/2)/((n-1)/2):order==='random'?E.r(i,77):i/(n-1);
// 字ごとに違う色で弾む登場の色（はっきりした6色）
const POP_COLORS=['#ff5d73','#ffb020','#ffe14d','#3ddc84','#4da3ff','#b46bff'];
const spread=(g,E,d)=>{const {u,horiz}=along(g,E);return horiz?{dx:u*d}:{dy:u*d};};

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
   return {dx:(E.r(i,f)-.5)*E.size*1.2*(1-q),a:q<.5?(E.r(i,Math.floor(p*20))<.5?1:0):1};}},
 // ---- 字間（2026-10-17）: 字の形は変えず、文字全体の中心からの距離だけを動かす
 trackIn:{name:'字間が縮んで弾む',tags:['impact','graphic','pop'],w:1,fast:true,inDur:D=>clamp(D*.36,.18,.48),plan:r=>({k:3+r()*2.5,dip:.1+r()*.05}),
  // 画面の外まで広がった字間が一気に縮み、少しだけ詰まりすぎてから戻る（m は字間の倍率。詰まりすぎは 1 割5分まで）
  glyph(g,i,n,p,E,P){const half=Math.max(E.size,(E.bbox.x1-E.bbox.x0)/2,(E.bbox.y1-E.bbox.y0)/2),m=1+P.k*(1-outExpo(clamp(p*1.25)))-P.dip*Math.sin(Math.PI*clamp((p-.42)/.58));
   return {...spread(g,E,half*(m-1)),a:clamp(p*4)};}},
 // ---- 斜めの切れ目（2026-10-17）: 字を斜めの線で上下に分け、切れ目の向こうからそれぞれ逆向きにせり出す（renderText の it.split）
 // ---- 字の置き換え（2026-10-18）: 本物の字の代わりに別の字（記号・伏せ字・リール）を描き、順に本物へ確定する（glyphDraw の s.ch / s.reel）
 scramble:{name:'暗号から確定する',tags:['glitch','graphic','impact'],w:1,fast:true,inDur:D=>clamp(D*.42,.24,.6),plan:r=>({order:pickW(r,['left','center','random'],[2,1,1]),rate:14+r()*10,sym:pickW(r,['mix','hex','kana'],[2,1,1])}),
  glyph(g,i,n,p,E,P){const at=.18+.72*lockOrder(i,n,E,P.order);
   if(p<at)return {ch:symOf(P.sym,E.r(i,Math.floor(E.lt*P.rate)+31)),a:.85};
   const k=clamp((p-at)/.12);return k<1?{sx:1+.18*(1-k),sy:1+.18*(1-k)}:null;}},   // 確定した字は、少し大きくなってから戻る
 slotReel:{name:'スロットで止まる',tags:['pop','graphic','glitch'],w:.9,fast:true,inDur:D=>clamp(D*.45,.28,.65),plan:r=>({rate:12+r()*6,sym:pickW(r,['mix','kana','digit'],[2,1,1])}),
  glyph(g,i,n,p,E,P){const at=.3+.52*(n>1?i/(n-1):0),f=E.lt*P.rate*(1+.3*E.r(i,5)),fi=Math.floor(f);
   if(p<at)return {reel:{cur:symOf(P.sym,E.r(i,fi)),next:symOf(P.sym,E.r(i,fi+1)),u:f-fi}};
   const k=clamp((p-at)/.14);return k<1?{reel:{cur:symOf(P.sym,E.r(i,fi)),next:g.ch,u:outBack(k,2.2)}}:null;}},   // 左から順に、本物の字が上から入って少し行き過ぎて止まる
 maskReveal:{name:'伏せ字から替わる',tags:['graphic','calm','glitch'],w:.8,fast:true,inDur:(D,n)=>clamp(.12+n*.05,.2,D*.5),plan:r=>({mark:pickW(r,['■','●','＊'],[2,1,1])}),
  glyph(g,i,n,p,E,P){const at=.12+.8*(n>1?i/(n-1):0);if(p<at)return {ch:P.mark,a:.75};const k=clamp((p-at)/.1);return k<1?{a:.6+.4*k,sx:1.1-.1*k,sy:1.1-.1*k}:null;}},
 // ---- マスクの中から（2026-10-18）: 字を自分の枠で切り抜き（s.cell）、枠の外から入れる
 maskRise:{name:'切れ目からせり上がる',tags:['graphic','calm','emotional','pop'],w:1.1,fast:true,inDur:D=>clamp(D*.36,.18,.48),plan:r=>({unit:pickW(r,['char','line'],[1.4,1]),alt:r()<.4,spread:.35+r()*.2}),
  glyph(g,i,n,p,E,P){const ln=g.line??0,q=P.unit==='line'?local(p,ln,E.nLines,.4):local(p,i,n,P.spread);if(1-outExpo(q)<.002)return null;   // 止まり切ったら切り抜きもやめる
   const dir=P.alt&&ln%2?-1:1;return {cell:true,dy:dir*g.size*1.15*(1-outExpo(q))};}},   // 行ごとの時、alt なら奇数行は上から
 maskSlideX:{name:'枠の中で横から滑り込む',tags:['graphic','glitch','pop'],w:.9,fast:true,inDur:D=>clamp(D*.34,.16,.44),plan:r=>({dir:sign(r)}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,.5);if(1-outExpo(q)<.002)return null;return {cell:true,dx:P.dir*g.size*1.3*(1-outExpo(q))};}},
 // 太さ（2026-10-18）: 細い輪郭だけの字が順に出て、塗りが満ちながら一度太り、元の太さで止まる
 thinToBold:{name:'細い線から太く育つ',tags:['emotional','calm','impact'],w:.9,fast:true,inDur:D=>clamp(D*.4,.2,.55),plan:r=>({spread:.35+r()*.2}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread);if(q<=0)return {hide:true};if(q>=1)return null;return {thin:1-outCubic(clamp(q*1.4)),bold:Math.sin(Math.PI*q)*.08};}},
 // ---- 色と落下（2026-10-18）
 dropFocus:{name:'ぼけながら落ちて止まる',tags:['emotional','impact','calm'],w:.9,fast:true,inDur:D=>clamp(D*.36,.18,.46),plan:r=>({spread:.35+r()*.2,k:1.6+r()*.8}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread);if(q<=0)return {hide:true};return {dy:-(1-outBack(q,P.k))*E.size*1.2,blur:(1-outCubic(q))*E.size*.26,a:clamp(q*3)};}},   // 上からぼけて落ち、少し行き過ぎてから戻る
 colorPop:{name:'色とりどりに弾む',tags:['pop','emotional','impact'],w:.9,fast:true,inDur:D=>clamp(D*.36,.18,.46),plan:r=>({off:Math.floor(r()*6),spread:.4+r()*.15}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread);if(q<=0)return {hide:true};const s=outBack(q,2.4);
   return {sx:s,sy:s,dy:-Math.sin(Math.PI*clamp(q*1.3))*E.size*.25,paint:q<.75?{u:1,color:POP_COLORS[(i+P.off)%POP_COLORS.length]}:null};}},   // 字ごとに違う色で跳ねて出て、着いたら元の色に戻る
 splitIn:{name:'斜めの切れ目からせり出す',tags:['impact','graphic','glitch'],w:.9,fast:true,inDur:D=>clamp(D*.32,.16,.42),plan:r=>({ang:sign(r)*(28+r()*22),line:r()<.7}),
  item(it,p,E,P){const e=outExpo(p),h=(E.bbox.y1-E.bbox.y0)+E.size*.4;it.split={ang:P.ang*DEG,n:h*(1-e),t:0,dy:0,line:P.line?clamp(1.4-p*1.6):0};}}
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
  item(it,p,E,P){it.blur=Math.max(it.blur,(.5+.5*Math.sin(E.lt*2.2+P.ph))*E.size*.05*p);}},
 // 字間（2026-10-17）。端の字でも動きは字の大きさの1割4分まで（読める範囲は1割5分）
 trackBreathe:{name:'字間が息をする',tags:['calm','emotional'],w:.9,plan:r=>({ph:r()*TAU,sp:1.2+r()*.8}),
  glyph:(g,i,n,p,E,P)=>spread(g,E,Math.sin(E.lt*P.sp+P.ph)*E.size*.14*p)},
 // 字の置き換え（2026-10-18）: ときどき1字だけが一瞬（2〜3コマ）記号に化けて戻る。化けるのは同時に1字だけ（読める時間を減らしすぎない）
 glyphSwap:{name:'ときどき別の字に化ける',tags:['glitch','graphic'],w:.8,plan:r=>({rate:1.1+r()*.8,sym:pickW(r,['mix','hex','kana'],[2,1,1])}),
  glyph(g,i,n,p,E,P){if(p<.5)return null;const w=E.lt*P.rate,k=Math.floor(w);if(fract(w)>.08||Math.floor(hash(k,3,E.seed%89)*n)!==i)return null;const f=Math.floor(E.lt*24);return {ch:symOf(P.sym,E.r(i,f)),dx:(E.r(i,f+3)-.5)*E.size*.12};}},
 // 左から塗り替える（2026-10-18）: 読んでいる間に、字がアクセント色で左から（縦書きは上から）塗られていく。字の途中まで塗られることもある
 paintSweep:{name:'左から塗り替える',tags:['emotional','calm','pop','graphic'],w:.9,plan:r=>({end:.7+r()*.2}),
  glyph(g,i,n,p,E,P){if(p<=0)return null;const b=E.bbox,horiz=b.x1-b.x0>=b.y1-b.y0,a=horiz?b.x0:b.y0,len=(horiz?b.x1-b.x0:b.y1-b.y0)+E.size,
   x=a-E.size*.5+len*clamp(E.lt/Math.max(.3,E.D*P.end)),u=clamp((x-((horiz?g.cx:g.cy)-g.size*.62))/(g.size*1.24));return u>0?{paint:{u,color:'accent'}}:null;}},
 // 太さ（2026-10-18）: 字と同じ色の縁で太らせる
 weightBreathe:{name:'太さが呼吸する',tags:['calm','emotional','pop'],w:.9,plan:r=>({ph:r()*TAU,sp:1.6+r()*1.2}),
  glyph:(g,i,n,p,E,P)=>({bold:(.5+.5*Math.sin(E.lt*P.sp+P.ph))*.075*p})},
 weightWave:{name:'太さの波が通る',tags:['pop','graphic','calm'],w:.8,plan:r=>({sp:2.4+r()*1.6,gap:.55+r()*.3}),
  glyph:(g,i,n,p,E,P)=>({bold:Math.pow(Math.max(0,Math.cos(E.lt*P.sp-i*P.gap)),6)*.1*p})},
 // 傾き・大きさ・行の波（2026-10-18）。傾きは6度まで、大きさは1割まで（読める範囲）
 tiltDomino:{name:'傾きがドミノで伝わる',tags:['pop','calm','graphic'],w:.9,plan:r=>({sp:.55+r()*.35,dir:sign(r)}),
  glyph(g,i,n,p,E,P){const f=fract(E.lt*P.sp)*(n+5)-2.5,d=(P.dir>0?i:n-1-i)-f;if(Math.abs(d)>=2.2)return null;const k=Math.cos(d/2.2*Math.PI/2)**2,rot=P.dir*5.8*k*p;
   return {rot,dx:rot*DEG*g.size*.9,dy:-Math.abs(rot*DEG)*g.size*.3};}},   // 足元の角を軸に倒れかけて戻るのが、となりの字へ順に伝わる
 sizeBump:{name:'大きさのこぶが通る',tags:['pop','emotional','calm'],w:.9,plan:r=>({sp:.5+r()*.35,dir:sign(r)}),
  glyph(g,i,n,p,E,P){const f=fract(E.lt*P.sp)*(n+3)-1.5,d=(P.dir>0?i:n-1-i)-f,k=Math.exp(-d*d/1.4),s=1+.095*k*p;return k<.01?null:{sx:s,sy:s,dy:-(s-1)*g.size*.5-k*p*g.size*.06};}},   // 足元から上へふくらみ、少し持ち上がる
 sizeBreathe:{name:'字ごとに呼吸する',tags:['calm','emotional','pop'],w:.9,plan:r=>({sp:2+r()*1.2}),
  glyph(g,i,n,p,E,P){const s=1+.065*p*Math.sin(E.lt*P.sp*(.7+.6*E.r(i,51))+E.r(i,52)*TAU);return {sx:s,sy:s,dy:-(s-1)*g.size*.5};}},   // 字ごとに速さと始まりが違う。足元はそのまま
 lineShiver:{name:'行がざわつく',tags:['glitch','graphic','impact'],w:.8,plan:r=>({fps:10+Math.floor(r()*6)}),
  glyph(g,i,n,p,E,P){const f=Math.floor(E.lt*P.fps),ln=g.line??0;return {dx:(hash(ln,f,E.seed%71)-.5)*E.size*.07*p,dy:(hash(ln,f,E.seed%71+5)-.5)*E.size*.012*p};}},   // 行ごとに、横へ小刻みにずれ続ける
 trackOpen:{name:'字間が広がり続ける',tags:['calm','emotional','graphic'],w:.9,plan:r=>({k:.12+r()*.02}),
  glyph:(g,i,n,p,E,P)=>spread(g,E,clamp(E.lt/Math.max(.3,E.D))*E.size*P.k*p)}
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
  glyph(g,i,n,p,E){const f=Math.floor(p*14);return {dx:(E.r(i,f)-.5)*E.size*1.4*p,a:p>.5&&E.r(i,Math.floor(p*20))<p?0:1-p*.5};}},
 // 斜めの切れ目（2026-10-17）: 一太刀で斜めに切れ、上と下が切れ目に沿って逆へずれてから、落ちて消える
 // マスクの中へ（2026-10-18）: 字が自分の枠の中を、加速しながら上へ抜けて消える
 maskExitUp:{name:'切れ目の上へ抜ける',tags:['graphic','calm','emotional','pop'],w:1,outDur:D=>clamp(D*.24,.13,.34),plan:r=>({spread:.35+r()*.2}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread);return q<=0?null:{cell:true,dy:-inCubic(q)*g.size*1.2};}},
 // タイプの逆（2026-10-18）: 最後の字から順に消える
 eraseBack:{name:'末尾から消える',tags:['glitch','graphic','calm'],w:.9,maxChars:16,outDur:(D,n)=>clamp(n*.04+.06,.12,D*.4),plan:()=>({}),
  glyph:(g,i,n,p)=>i>=n-Math.floor(p*(n+.999))?{hide:true}:null},
 // ---- 削れて消える（2026-10-18）: 字が境目から削られて消え、削れた所が粒（砂・火の粉・消しかす）になって飛ぶ（glyphDraw の s.erode）。
 //  k は削れの進み（1 で字が全部削れる。1 を過ぎても粒は飛び続ける）。最後に全体が薄くなって消える
 sandAway:{name:'砂になって風化する',tags:['emotional','calm','glitch'],w:.9,outDur:D=>clamp(D*.34,.2,.48),plan:r=>({wind:.7+r()*.5,lift:.3+r()*.4}),
  glyph(g,i,n,p,E,P){const q=local(p,n-1-i,n,.55);if(q<=0)return null;return {erode:{kind:'sand',k:q*1.5,wind:P.wind,lift:P.lift},a:1-inOutCubic(clamp((p-.8)/.2))};}},   // 行の右端の字から
 burnAway:{name:'燃えて消える',tags:['emotional','impact','glitch'],w:.8,outDur:D=>clamp(D*.34,.2,.48),plan:r=>({spread:.3+r()*.25}),
  glyph(g,i,n,p,E,P){const q=clamp((p-E.r(i,41)*P.spread)/(1-P.spread));if(q<=0)return null;return {erode:{kind:'burn',k:q*1.35},a:1-inOutCubic(clamp((p-.82)/.18))};}},   // 字ごとにばらばらに火が付き、下から燃え上がる
 rubAway:{name:'消しゴムで消える',tags:['calm','graphic','emotional'],w:.8,outDur:D=>clamp(D*.36,.2,.5),plan:r=>({rows:3+Math.floor(r()*2)}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,.6);if(q<=0)return null;return {erode:{kind:'rub',k:q*1.25,rows:P.rows},a:1-inOutCubic(clamp((p-.85)/.15))};}},   // 上の段から、往復しながらこすって消す。こすった跡がうっすら残る
 splitDrop:{name:'斜めに切れてずれ落ちる',tags:['impact','graphic','glitch'],w:.9,outDur:D=>clamp(D*.26,.14,.36),plan:r=>({ang:sign(r)*(18+r()*24)}),
  item(it,p,E,P){const h=(E.bbox.y1-E.bbox.y0)+E.size*.4;it.split={ang:P.ang*DEG,n:0,t:outCubic(clamp(p*2.2))*E.size*.35,dy:inCubic(clamp((p-.3)/.7))*h*1.6,line:clamp(1-p*3)};it.a*=1-inCubic(clamp((p-.45)/.55));}}
};

// ---- 加工（字の描き方と、行の後ろに敷く図形） -------------------------------------------------------------------------------------------------
const luma=hex=>{const n=parseInt(String(hex).slice(1,7),16)||0;return (.2126*(n>>16&255)+.7152*(n>>8&255)+.0722*(n&255))/255;};
const contrast=hex=>luma(hex)>.55?'#101018':'#ffffff';
const mixHex=(a,b,u)=>{const x=parseInt(String(a).slice(1,7),16)||0,y=parseInt(String(b).slice(1,7),16)||0;return '#'+[16,8,0].map(k=>Math.round(lerp(x>>k&255,y>>k&255,u)).toString(16).padStart(2,'0')).join('');};
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
 blurTrail:{name:'ぼかし送り',tags:['pop','glitch','emotional','impact'],w:.9,style:()=>({trail:{n:5,dx:-.075,dy:0,a:.5}})},
 // ---- 字の中の色・模様（2026-10-18）: 字の塗りそのものが時間で動く（glyphDraw の fxFill）。字の位置で色をずらすので、行全体で流れて見える
 rainbowFill:{name:'虹色が流れる',tags:['pop','emotional','calm'],w:.8,plan:r=>({pal:pickW(r,['rainbow','aurora','sunset'],[1.2,1,1]),k:.8+r()*.8,v:sign(r)*(.18+r()*.2)}),
  style:P=>({fillFx:{kind:'rainbow',pal:P.pal||'rainbow',k:P.k??1,v:P.v??.25}})},
 shineSweep:{name:'光の帯が走る',tags:['graphic','impact','calm','emotional'],w:.8,plan:r=>({k:.6+r()*.6,v:.45+r()*.35}),
  style:P=>({fillFx:{kind:'shine',k:P.k??.8,v:P.v??.6}})},
 // ---- 影と縁（2026-10-18）
 longShadow:{name:'長い影',tags:['graphic','pop','impact','emotional'],w:.8,plan:r=>({ang:30+r()*30,swing:6+r()*12,v:.5+r()*.6,len:.7+r()*.4}),
  // 影の色は、アクセント色を背景色へ寄せた色（暗い背景では暗く、明るい背景では淡く）
  style:(P,c)=>({longShadow:{ang:P.ang??45,swing:P.swing??10,v:P.v??.8,len:P.len??.9,color:mixHex(c.accent||'#888888',c.bg||'#000000',luma(c.bg||'#000000')<.5?.62:.5)}})},
 echoOutline:{name:'輪郭の影が重なる',tags:['graphic','pop','glitch'],w:.8,plan:r=>({n:3+Math.floor(r()*2),dx:sign(r)*(.04+r()*.025),dy:.045+r()*.025}),
  style:(P,c)=>({echo:{n:P.n??3,dx:P.dx??.05,dy:P.dy??.05,color:c.accent||'#ffd34d'}})},
 doubleRim:{name:'二重のフチ',tags:['pop','impact','graphic'],w:.9,
  // 内側のフチは字の色の反対（白か黒）、外側はアクセント色。アクセント色が内側と近い時は、外側も白か黒
  style:(P,c)=>{const inner=luma(c.color)>.6?'#16161e':'#ffffff',outer=Math.abs(luma(c.accent)-luma(inner))<.3?(luma(inner)>.5?'#16161e':'#ffffff'):c.accent;return {rim:{w:.3,color:outer},stroke:{w:.15,color:inner}};}},
 stripeFill:{name:'縞が流れる',tags:['pop','graphic','glitch'],w:.7,plan:r=>({n:4+Math.floor(r()*3),v:sign(r)*(.5+r()*.5)}),
  style:P=>({fillFx:{kind:'stripes',n:P.n??5,v:P.v??.7}})}
};
// 毎日のルーティンで足した部品（daily-parts.js）を、表の末尾につなぐ
addDailyParts({enter:ENTER,hold:HOLD,exit:EXIT,treat:TREAT},DAILY_CUT_PARTS);
export const GLYPH_GROUPS={enter:ENTER,hold:HOLD,exit:EXIT,treat:TREAT};
export const GLYPH_GROUP_NAMES={enter:'IN',hold:'STAY',exit:'OUT',treat:'STYLE'};

// ---- 配置（折り返し・縦書き）。measure(ch,fontKey,px) は呼ぶ側が渡す（ブラウザでは Canvas の measureText） --------------------------------------------
const KINSOKU_START=new Set([...'、。，．,.!?！？）」』】〕〉》］｝ー〜～…‥っゃゅょぁぃぅぇぉッャュョァィゥェォ']);
const KINSOKU_END=new Set([...'（「『【〔〈《［｛']);
/**
 * 文字を字ごとの箱に並べる。返す glyphs の cx,cy は絵の中心(W/2,H/2)を基準にした絶対座標。
 * runs: [{text,scale?,emphasis?,color?}]、pieces: [{from,to}]（語の区切り。word 番号を付けるため）
 */
export function layoutText({text,runs,pieces,W,H,size,font,measure,vertical=false,maxWidth=.86,mode='wrap',cols=0,curve=null,align='center',fit=true}){
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
  const total=body.reduce((a,c)=>a+c.w,0),maxW=W*maxWidth,hMax=Math.max(1,...body.map(c=>c.size||0));
  // 行数: 幅に収まる行数が基本。ただ、低くて横に長い箱（字幕帯など）では、行を減らした方が字が大きくなるなら減らす（2行にして豆粒の字にならないように）
  const fitK=n=>Math.min(1,W*.92*n/Math.max(1,total),H*.82/(n*hMax*1.28));
  let nLines=mode==='path'?1:Math.max(1,Math.ceil(total/maxW));
  for(let n=nLines-1;n>=1;n--)if(fitK(n)>fitK(nLines)*1.08)nLines=n;
  const target=total/nLines;
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
  const k=fit?Math.min(1,W*.92/maxLine,H*.82/Math.max(1,totalH)):1;   // fit=false: 枠に収めない（超デカ文字。はみ出した所は絵の外で切れる）
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
 // ただし世界が frame.size（字の大きさ px）と frame.fit=false を返したら、その大きさで、枠に収めずに置く（超デカ文字）
 const LW=frame?frame.box.w:W,LH=frame?frame.box.h:H;
 const size=frame?.size||Math.min(W,H)*cut.fontScale,font=cut.gFont||'gothic';
 const lay=layoutText({text:cut.text,runs:cut.runs,pieces,W:LW,H:LH,size,font,measure,vertical:!!cut.gVertical&&!frame,mode:frame?.mode,cols:frame?.cols,curve:frame?.curve,align:frame?.align,maxWidth:frame?.maxWidth,fit:frame?.fit!==false});
 const delay=frame?.delay||0,D=cut.end-cut.start-delay,n=lay.glyphs.length;
 const tm=timingsOf(D,cut.enter,cut.exit,n,cut.enterP,cut.exitP);
 const style=(TREAT[cut.treat]||TREAT.none).style(cut.treatP,{color:cut.color,accent:cut.emphasisColor,bg:cut.bg});
 return {...lay,n,D,delay,seed:cut.seed|0,W:LW,H:LH,size:lay.size??size*lay.fit,font,family:fontFamily(font),fontFamily,color:style.textColor||cut.color,accent:cut.emphasisColor,bg:cut.bg,style,
  enter:cut.enter,enterP:cut.enterP,hold:cut.hold,holdP:cut.holdP,exit:cut.exit,exitP:cut.exitP,timing:tm};
}

const IDENT=()=>({dx:0,dy:0,sx:1,sy:1,rot:0,a:1,blur:0,hide:false,ch:null,reel:null,cell:false,paint:null,bold:0,thin:0,erode:null});
const merge=(st,d)=>{if(!d)return;if(d.hide)st.hide=true;if(d.ch!=null)st.ch=d.ch;if(d.reel)st.reel=d.reel;if(d.cell)st.cell=true;if(d.paint)st.paint=d.paint;if(d.erode)st.erode=d.erode;if(d.bold)st.bold=Math.max(st.bold,d.bold);if(d.thin)st.thin=Math.max(st.thin,d.thin);st.dx+=d.dx||0;st.dy+=d.dy||0;st.sx*=d.sx??1;st.sy*=d.sy??1;st.rot+=d.rot||0;st.a*=d.a??1;st.blur=Math.max(st.blur,d.blur||0);};
/** カット内の時刻 lt での、字ごとの状態とアイテム全体の状態（純関数） */
export function stateAt(item,lt){
 const {D,timing:{inDur,outDur}}=item,n=item.n;
 const pIn=inDur>0?clamp(lt/inDur):1,pOut=outDur>0?clamp((lt-(D-outDur))/outDur):0,amt=clamp((lt-inDur*.85)/.25)*(1-pOut);
 const E={size:item.size,W:item.W,H:item.H,r:(i,k)=>hash(i,k,item.seed%977),nWords:item.nWords,nLines:Math.max(1,item.lines?.length||1),n,bbox:item.bbox,lt,D,seed:item.seed};
 const en=ENTER[item.enter],ho=HOLD[item.hold],ex=EXIT[item.exit];
 const it={blur:0,sx:1,sy:1,a:1,clip:null,bar:null,split:null,pIn,pOut,lt};
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
 if(it.blur>s*.06||it.clip||(it.split&&(it.split.n>s*.05||it.split.t>s*.05||it.split.dy>s*.05))||it.sx<.85||it.sx>1.2||it.sy<.85||it.sy>1.2||it.a<.9)return false;
 return glyphs.every(g=>!g.hide&&g.ch==null&&!g.reel&&!(g.erode&&g.erode.k>.01)&&(g.blur||0)<=s*.08&&g.a>=.9&&Math.abs(g.dx)<s*.15&&Math.abs(g.dy)<s*.15&&g.sx>.8&&g.sx<1.25&&g.sy>.8&&g.sy<1.25&&Math.abs(g.rot)<12);
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
/** 字の中を動く塗り（STYLE の fillFx）。字の位置（g.cx）と時刻（lt）から、字ごとのグラデーションを作る。座標は字の中心が原点 */
function fxFill(c,F,g,px,lt,item,col){
 const u=g.cx/Math.max(1,item.W);
 if(F.kind==='rainbow'){
  const [h0,span]=F.pal==='aurora'?[150,140]:F.pal==='sunset'?[330,80]:[0,360],hue=k=>h0+(((u*F.k+lt*F.v+k)%1)+1)%1*span;
  const gr=c.createLinearGradient(-px*.6,0,px*.6,0);if(!gr?.addColorStop)return col;
  for(const k of [0,.5,1])gr.addColorStop(k,`hsl(${hue(k*.25).toFixed(1)},90%,${F.pal==='aurora'?68:64}%)`);return gr;}
 if(F.kind==='shine'){
  const ph=fract(lt*F.v+u*F.k)*1.6-.3,gr=c.createLinearGradient(-px*.6,-px*.5,px*.6,px*.5);if(!gr?.addColorStop)return col;
  const st=[[0,col],[ph-.16,col],[ph,'#ffffff'],[ph+.16,col],[1,col]].filter(([k])=>k>=0&&k<=1).sort((a,b)=>a[0]-b[0]);for(const [k,v] of st)gr.addColorStop(k,v);return gr;}
 if(F.kind==='stripes'){
  const gr=c.createLinearGradient(-px*.6,-px*.6,px*.6,px*.6);if(!gr?.addColorStop)return col;const n=F.n,off=fract(lt*F.v),a=item.accent&&item.accent.toLowerCase()!==String(col).toLowerCase()?item.accent:'#ffd34d';
  for(let j=-1;j<=n;j++){const k0=(j+off)/n,k1=(j+off+.5)/n,k2=(j+off+1)/n;for(const [k,v] of [[k0,a],[k1,a],[k1,col],[k2,col]])if(k>=0&&k<=1)gr.addColorStop(k,v);}return gr;}
 return col;
}
/**
 * 削れて消える字（s.erode = {kind,k,…}）。座標は字の中心が原点、px は字の大きさ。one(ch,oy,over,am) は字を1つ描く関数。k は削れの進み（1 で全部削れる。1 を過ぎても粒は飛ぶ）。
 * 残っている所だけを切り抜いて描き、削れた所から粒を飛ばす（ゴーストの層 ghost では粒は描かない）。粒は字の枠の中の決まった位置から出る（字の形は分からないので、枠の中に散らす）。
 *  sand: 右から左へ境目が進み、境目の手前はまだらに欠ける。粒は風で右上へ流れる
 *  burn: 下から上へ、波打つ境目が燃え上がる。境目のすぐ上は赤く光り、その上は焦げる。火の粉が昇る
 *  rub : 上の段から、段ごとに往復しながら消す。こすった跡がうっすら残り、消しかすが落ちる
 */
function erodeDraw(c,R,px,g,item,one,ch,col,base,ghost){
 const k=R.k,u=clamp(k),w=px*.62,h=px*.6,seed=((g.i??0)*7+(item.seed|0))%997;
 if(R.kind==='sand'){
  const xb=w-2.2*w*u,band=px*.18,cs=Math.max(1.5,px*.055),x0=xb-band;
  if(xb>-w){c.save();c.beginPath();if(x0>-w)c.rect(-w,-h,x0+w,2*h);
   for(let j=Math.floor((Math.max(-w,x0)+w)/cs);j*cs-w<xb;j++){const cx0=j*cs-w,f=clamp((cx0+cs/2-x0)/band);for(let m=0;m*cs<2*h;m++)if(hash(seed,j,m)>f)c.rect(cx0,m*cs-h,cs*1.02,cs*1.02);}
   c.clip();one(ch,0);c.restore();}
  if(ghost)return;
  c.fillStyle=col;
  for(let j=0;j<40;j++){const x=-w+2*w*hash(seed,j,1),y=(hash(seed,j,2)-.5)*1.6*h,age=k-(w-x)/(2.2*w),a=clamp(1-age/.55);if(age<=0||a<=0)continue;
   const r=px*(.018+.028*hash(seed,j,5))*(1-age*.6),X=x+age*px*(1+hash(seed,j,3))*R.wind*1.5,Y=y-age*px*R.lift*(.6+hash(seed,j,4))*1.4+Math.sin(age*7+j)*px*.05;
   c.globalAlpha=base*a*.9;c.fillRect(X-r/2,Y-r/2,r,r);}
  return;
 }
 if(R.kind==='burn'){
  const yb=x=>h*1.25-2.6*h*u+Math.sin(x/px*9+seed)*px*.05+Math.sin(x/px*23+seed*.7)*px*.022,st=w/10;
  if(u<1){
   c.save();c.beginPath();c.moveTo(-w,-h*1.3);c.lineTo(w,-h*1.3);for(let x=w;x>=-w-.1;x-=st)c.lineTo(x,yb(x));c.closePath();c.clip();one(ch,0);c.restore();
   // 境目の上の帯だけを、別の色で塗り直す（字の形の所だけが焦げて光る）
   const band=(o0,o1,color,am)=>{c.save();c.beginPath();for(let x=w;x>=-w-.1;x-=st)c.lineTo(x,yb(x)-o1);for(let x=-w;x<=w+.1;x+=st)c.lineTo(x,yb(x)-o0);c.closePath();c.clip();one(ch,0,color,am);c.restore();};
   if(!ghost){band(px*.09,px*.2,'#3a1a0c',.7);band(-px*.01,px*.09,'#ff8a2a',1);}
  }
  if(ghost)return;
  for(let j=0;j<18;j++){const rel=.1+.76*hash(seed,j,2),age=k-rel;if(age<=0||age>.6)continue;
   const X=-w+2*w*hash(seed,j,1)+Math.sin(age*8+j)*px*.07,Y=h*1.25-2.6*h*rel-age*px*(1+hash(seed,j,3))*1.3,r=px*(.012+.018*hash(seed,j,4));
   c.globalAlpha=base*clamp((1-age/.6)*(.6+.4*Math.sin(age*40+j)));c.fillStyle=j%3?'#ffb347':'#ff5a1f';c.beginPath();c.arc(X,Y,Math.max(.6,r),0,TAU);c.fill();}
  return;
 }
 // rub
 const rows=R.rows|0||3,bh=2*h/rows,e=u*rows;
 if(!ghost)one(ch,0,null,.14*(1-clamp((k-1)/.25)));   // こすった跡
 if(u<1){c.save();c.beginPath();
  for(let b=0;b<rows;b++){const y=-h+b*bh;if(e>=b+1)continue;if(e<=b){c.rect(-w,y,2*w,bh+.5);continue;}const f=e-b;if(b%2===0)c.rect(-w+2*w*f,y,2*w*(1-f),bh+.5);else c.rect(-w,y,2*w*(1-f),bh+.5);}
  c.clip();one(ch,0);c.restore();}
 if(ghost)return;
 c.fillStyle=col;
 for(let j=0;j<16;j++){const ej=hash(seed,j,1)*rows*.98,age=k-ej/rows;if(age<=0||age>.45)continue;const b=Math.floor(ej),f=ej-b,x=b%2===0?-w+2*w*f:w-2*w*f,y=-h+(b+.5)*bh;
  const X=x+(hash(seed,j,2)-.5)*px*.9*age,Y=y+age*age*px*5,r=px*(.02+.025*hash(seed,j,3));c.globalAlpha=base*.55*clamp(1-age/.45);c.fillRect(X-r/2,Y-r/2,r,r*.7);}
}
function glyphDraw(c,item,g,s,it,tint){
 const T=item.style,px=g.size,bl=Math.max(s.blur||0,(T.blur||0)*px),base=clamp(s.a)*it.a;
 c.save();
 // s.cell: 字の元の位置の枠（スロットのリールと同じ大きさ）で切り抜いてから動かす。枠の外へ出た所は見えない（マスクの中からせり上がる・抜ける）
 if(s.cell){const h=px*1.12;c.translate(g.cx,g.cy);c.beginPath();c.rect(-px*.62,-h/2,px*1.24,h);c.clip();c.translate(s.dx,s.dy);}
 else c.translate(g.cx+s.dx,g.cy+s.dy);
 if(g.rot0||s.rot)c.rotate(((g.rot0||0)+s.rot)*DEG);c.scale(s.sx,s.sy);
 c.font=`${px}px ${g.fontKey?item.fontFamily(g.fontKey):item.family}`;c.textAlign='center';c.textBaseline='middle';
 const col=tint||g.color||(g.emphasis?item.accent:item.color);
 const one=tint?(ch,oy,over,am=1)=>{c.globalAlpha=base*am;c.fillStyle=tint;c.fillText(ch,0,oy);}:(ch,oy,over,am=1)=>{   // tint: ゴーストの層。影・縁・押し出しは付けず、色だけで塗った形にする。over: 塗りの色を替える（左から塗り替える）。am: 濃さを掛ける
  const b=base*am;c.globalAlpha=b;
  // T.longShadow: 字から長く伸びる影。光の向き（ang）が時刻でゆっくり振れる。遠いコピーから順に重ね、先の方ほど薄い
  if(T.longShadow){const L=T.longShadow,a=(L.ang+Math.sin((it.lt||0)*L.v)*L.swing)*DEG,len=L.len*px,m=Math.round(clamp(len/2.2,10,48)),ux=Math.cos(a)*len/m,uy=Math.sin(a)*len/m;c.fillStyle=L.color;
   for(let k=m;k>=1;k--){c.globalAlpha=b*(1-.85*(k/m)**2);c.fillText(ch,k*ux,oy+k*uy);}c.globalAlpha=b;}
  if(T.extrude){c.fillStyle=T.extrude.color;for(let k=T.extrude.n;k>=1;k--)c.fillText(ch,k*T.extrude.dx*px,oy+k*T.extrude.dy*px);}
  // T.echo: 輪郭だけのコピーを、ずらして何枚も重ねる（昔の立体文字）。ずれは少しだけ息をする
  if(T.echo){const X=T.echo;c.lineJoin='round';c.lineWidth=Math.max(1,px*.028);c.strokeStyle=X.color;
   for(let k=X.n;k>=1;k--){const v=1+.18*Math.sin((it.lt||0)*2.6-k*.9);c.globalAlpha=b*(1-(k-1)/X.n*.55);c.strokeText(ch,k*X.dx*px*v,oy+k*X.dy*px*v);}c.globalAlpha=b;}
  if(T.trail){c.fillStyle=col;for(let k=T.trail.n;k>=1;k--){c.globalAlpha=b*T.trail.a*(1-(k-1)/T.trail.n);c.fillText(ch,k*T.trail.dx*px,oy+k*(T.trail.dy||0)*px);}c.globalAlpha=b;}
  if(T.shadow){c.shadowColor=T.shadow.color;c.shadowBlur=T.shadow.blur*px;c.shadowOffsetX=T.shadow.dx*px;c.shadowOffsetY=T.shadow.dy*px;}
  // T.rim: 外側の太いフチ（T.stroke の内側のフチと合わせて二重のフチ）
  if(T.rim){c.lineJoin='round';c.lineWidth=T.rim.w*px;c.strokeStyle=T.rim.color;c.strokeText(ch,0,oy);}
  if(T.stroke){c.lineJoin='round';c.lineWidth=T.stroke.w*px;c.strokeStyle=T.stroke.color;c.strokeText(ch,0,oy);c.shadowColor='transparent';}
  const fill=over||(T.fillFx?fxFill(c,T.fillFx,g,px,it.lt||0,item,col):T.textColor&&!g.emphasis?T.textColor:col);
  // s.bold: 字と同じ色の縁で太らせる（どの書体でも太さを変えられる）。s.thin: 細い輪郭だけで描き、塗りを薄くする（1 で輪郭だけ）
  if(s.bold>.001){c.lineJoin='round';c.lineWidth=s.bold*px;c.strokeStyle=fill;c.strokeText(ch,0,oy);c.shadowColor='transparent';}
  if(s.thin>.001){c.lineJoin='round';c.lineWidth=Math.max(.75,px*.022);c.strokeStyle=fill;c.strokeText(ch,0,oy);c.shadowColor='transparent';c.globalAlpha=b*(1-s.thin);}
  if(T.fill!==false){c.fillStyle=fill;c.fillText(ch,0,oy);}
 };
 // 字の置き換え: s.ch があれば、その字を描く。s.reel = {cur,next,u} なら、字の枠で切り抜いて、リールのように next を上から、cur を下へ u だけずらして描く
 const paint=()=>{
  if(s.erode){erodeDraw(c,s.erode,px,g,item,one,s.ch??g.ch,col,base,!!tint);return;}
  if(!s.reel){one(s.ch??g.ch,0);
   // s.paint = {u,color}: 字の左から u の割合だけ、別の色で塗り直す（字の途中まで塗られることもある）
   if(s.paint&&s.paint.u>0&&!tint){const pc=s.paint.color==='accent'?(item.accent&&item.accent.toLowerCase()!==String(col).toLowerCase()?item.accent:'#ffd34d'):s.paint.color;
    c.save();c.beginPath();c.rect(-px*.7,-px,px*1.4*s.paint.u,px*2);c.clip();one(s.ch??g.ch,0,pc);c.restore();}
   return;}
  const h=px*1.12,u=s.reel.u;c.save();c.beginPath();c.rect(-px*.62,-h/2,px*1.24,h);c.clip();one(s.reel.next,(u-1)*h);one(s.reel.cur,u*h);c.restore();
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
 const drawAll=()=>{for(let i=0;i<glyphs.length;i++){const s=glyphs[i];if(s.hide||s.a<=0)continue;glyphDraw(c,item,item.glyphs[i],s,it,tint);}};
 if(it.split){
  // 斜めの切れ目: 文字の中心を通る角度 ang の線で、上と下を別々に切り抜いて描く。n は切れ目から離す量（切れ目の向こうに隠れる向き）、t は切れ目に沿って逆へずらす量、dy は下へ落とす量
  const S=it.split;
  for(const side of [-1,1]){
   c.save();c.translate(cx,cy+S.dy);c.rotate(S.ang);
   c.beginPath();c.rect(-1e5,side<0?-1e5:0,2e5,1e5);c.clip();
   c.translate(side*S.t,-side*S.n);c.rotate(-S.ang);c.translate(-cx,-cy);drawAll();c.restore();
  }
  if(S.line>0&&!tint){const L=(item.bbox.x1-item.bbox.x0)/2+item.size*.6;c.save();c.translate(cx,cy+S.dy);c.rotate(S.ang);c.globalAlpha=clamp(S.line)*it.a;c.fillStyle=item.accent;c.fillRect(-L,-Math.max(.75,item.size*.008),L*2,Math.max(1.5,item.size*.016));c.restore();}
 }else drawAll();
 c.restore();
 if(it.bar&&it.pIn<1){ctx.fillStyle=item.accent;ctx.globalAlpha=.9;ctx.fillRect(it.bar.x-Math.max(3,item.size*.04),item.bbox.y0-item.size*.1,Math.max(6,item.size*.08),item.bbox.y1-item.bbox.y0+item.size*.2);ctx.globalAlpha=1;}
 if(useLayer){ctx.save();ctx.filter=`blur(${it.blur.toFixed(1)}px)`;ctx.drawImage(c.canvas,0,0);ctx.restore();}
}
