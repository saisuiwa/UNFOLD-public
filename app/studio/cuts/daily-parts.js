// 毎日のルーティンで足す、カット割りの部品（手順書 docs/daily-samples-routine.md の ③）。
// ここに足した部品は、手で作った部品の表（glyphs.js の登場・保持・退場・加工、parts.js の背景・カメラ・画面効果・つなぎ、worlds.js の物の世界）の
// 末尾に自動でつながり、STUDIO のおまかせ「✂ カット割り」が、ほかの部品と同じように選ぶ。サンプル集の「カット割りの部品」の棚にも出る。
//
// 1つの部品 = { axis, key, name, desc, added, tags, w, ...その軸の形 }
//   axis   'enter' | 'hold' | 'exit' | 'treat' | 'bg' | 'cam' | 'fx' | 'trans' | 'world'
//   key    英字で始まる英数字（camelCase）。同じ軸のほかの部品と重ならない
//   name   日本語の名前（2〜12文字。サンプル集のプレビューでは、この名前が、この部品で動く）
//   desc   10〜60文字で「。」で終わる1文      added  足した日（日本時間 YYYY-MM-DD）
//   tags   合う雰囲気（calm pop glitch graphic emotional impact から1つ以上）      w  出やすさ（手で作った部品は 0.8〜1.4）
// 軸ごとの形（くわしくは手順書。手で作った部品が手本）:
//   enter / exit  inDur(D,n,P) / outDur(D,n,P) → 秒、plan(r) → P、glyph(g,i,n,p,E,P) → {dx,dy,sx,sy,rot,a,blur,hide} か item(it,p,E,P)
//   hold          plan(r) → P、glyph(g,i,n,p,E,P)（p は動きの強さ。いつも小さく）
//   treat         style(P,c) → {stroke,fill,shadow,extrude,textColor,deco,blur,trail}
//   bg            plan(r) → P、draw(ctx,e,P)（半透明で。下に絵がある時も塗りつぶさない）
//   cam           plan(r) → P、get(e,P) → {s,x,y,rot}
//   fx            dur、plan(r) → P、apply(ctx,e,P,k)（e.opaque===false の時は透明な所を塗らない）
//   trans         dur、plan(r) → P、draw(ctx,A,B,p,e,P)
//   world         worlds.js の形（fits / frame / plan / back / front …）
// 決まり: 同じ時刻なら同じ絵（Math.random・Date.now は使わない。乱数は plan(r) の r か、kit.js の hash）。plan は JSON にできる値だけ返す。
import {TAU,clamp,lerp,fract,outCubic,inCubic,inOutCubic,outBack,smooth,hash,sign,local,rgba} from './kit.js';

export const DAILY_CUT_PARTS=[
 // ---- 2026-10-17（最初の8個。手順書を作り直した日に、Claude が手本として足した）
 {axis:'enter',key:'centerOut',name:'真ん中から広がる',desc:'全部の字が行の真ん中に重なって現れ、元の位置へ広がります。',added:'2026-10-17',
  tags:['pop','graphic','impact','emotional'],w:1,fast:true,inDur:D=>clamp(D*.32,.15,.4),plan:r=>({k:.6+r()*.4}),
  glyph(g,i,n,p,E,P){const e=inOutCubic(p),mid=(E.bbox.x0+E.bbox.x1)/2,s=lerp(.6,1,outBack(p,1.4));return {dx:(mid-g.cx)*(1-e)*P.k,sx:s,sy:s,a:clamp(p*3)};}},
 {axis:'enter',key:'flipIn',name:'パタパタめくれる',desc:'駅の案内板のように、字が1つずつ上から下へめくれて現れます。',added:'2026-10-17',
  tags:['graphic','pop','calm','glitch'],w:1,fast:true,inDur:(D,n)=>clamp(.12+n*.03,.15,D*.5),plan:()=>({}),
  glyph(g,i,n,p,E){const q=local(p,i,n,.55);if(q<=0)return {hide:true};return {sy:Math.max(.04,Math.abs(Math.cos((1-q)*Math.PI*1.5))*(.3+.7*q)),dy:-(1-q)*E.size*.12};}},
 {axis:'exit',key:'gatherOut',name:'真ん中へ吸い込まれる',desc:'字が行の真ん中へ寄りながら小さくなって、吸い込まれるように消えます。',added:'2026-10-17',
  tags:['pop','graphic','impact','emotional'],w:1,outDur:D=>clamp(D*.26,.14,.36),plan:()=>({}),
  glyph(g,i,n,p,E){const e=smooth(p),mid=(E.bbox.x0+E.bbox.x1)/2,s=Math.max(.02,1-inCubic(p));return {dx:(mid-g.cx)*e,sx:s,sy:s,a:1-clamp((p-.6)/.4)};}},
 {axis:'exit',key:'riseAway',name:'ふわっと昇って消える',desc:'字が少しずつ時間をずらして上へ昇り、ゆれながら薄くなって消えます。',added:'2026-10-17',
  tags:['emotional','calm','pop'],w:1,outDur:D=>clamp(D*.3,.16,.42),plan:r=>({sway:sign(r)}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,.5);return {dy:-smooth(q)*E.size*1.1,dx:Math.sin(q*TAU*.75+i)*E.size*.12*q*P.sway,rot:(E.r(i,8)-.5)*16*q,a:1-smooth(q)};}},
 {axis:'hold',key:'wordPulse',name:'語ごとに脈打つ',desc:'語ごとに順番に、心臓の鼓動のように小さく大きくなります。',added:'2026-10-17',
  tags:['pop','impact','emotional'],w:1,plan:r=>({bpm:1.4+r()*.6}),
  glyph(g,i,n,p,E,P){const k=Math.max(1,E.nWords),ph=fract(E.lt*P.bpm-(g.word??0)/k),beat=Math.exp(-ph*9);const s=1+.07*p*beat;return {sx:s,sy:s,dy:-beat*p*E.size*.04};}},
 {axis:'bg',key:'confetti',name:'紙吹雪',desc:'色の小さな紙が、ひらひらと回りながら上から降ってきます。',added:'2026-10-17',
  tags:['pop','emotional','impact'],w:.9,plan:r=>({n:28+Math.floor(r()*18),seed:Math.floor(r()*1000),drift:sign(r)}),
  // 紙は作業用のキャンバスに濃く描いてから、まとめて半透明で重ねる（紙が重なっても濃くなりすぎない）
  draw(c,e,P){const S=Math.min(e.W,e.H),got=e.tmp?.('confetti',e.W,e.H),sheet=got&&got!==c.canvas?got:null,x=sheet?sheet.getContext('2d'):c;if(sheet)x.clearRect(0,0,e.W,e.H);
   for(let j=0;j<P.n;j++){const h1=hash(P.seed,j,1),h2=hash(P.seed,j,2),h3=hash(P.seed,j,3),fall=.12+h2*.18;
    const y=((h1+e.t*fall)%1.1-.05)*e.H,px=(h3*e.W+Math.sin(e.t*1.7+j)*S*.03*P.drift+e.W)%e.W,rot=e.t*(1.5+h2*3)*(j%2?1:-1)+j,w=S*(.03+h1*.025),hh=w*.55,flip=Math.abs(Math.cos(e.t*3+j));
    x.save();x.translate(px,y);x.rotate(rot);x.scale(1,Math.max(.15,flip));x.fillStyle=sheet?(j%3?e.accent:e.fg):rgba(j%3?e.accent:e.fg,.3);x.fillRect(-w/2,-hh/2,w,hh);x.restore();}
   if(sheet){c.save();c.globalAlpha=.42;c.drawImage(sheet,0,0);c.restore();}}},
 {axis:'cam',key:'orbit',name:'円を描いて回る',desc:'文字全体が、小さな円を描くように画面の中をゆっくり回ります。',added:'2026-10-17',
  tags:['calm','emotional','pop','graphic'],w:1,plan:r=>({dir:sign(r),ph:r()*TAU}),
  get:(e,P)=>{const a=P.ph+P.dir*e.p*TAU*.5;return {s:1.04,x:Math.cos(a)*e.W*.014,y:Math.sin(a)*e.H*.02};}},
 {axis:'trans',key:'zoomThrough',name:'ズームで抜ける',desc:'前の絵が手前へ大きく抜けていき、その奥から次の絵が近づいてきます。',added:'2026-10-17',
  tags:['impact','pop','graphic','emotional'],w:1,dur:.4,plan:()=>({}),
  draw(c,A,B,p,e){const k=inOutCubic(p),sa=1+k*.6,sb=lerp(1.18,1,k);
   c.drawImage(A,e.W*(1-sa)/2,e.H*(1-sa)/2,e.W*sa,e.H*sa);
   c.globalAlpha=smooth(k*1.15);c.drawImage(B,e.W*(1-sb)/2,e.H*(1-sb)/2,e.W*sb,e.H*sb);c.globalAlpha=1;}},
];
