// 毎日のルーティンで足す、カット割りの部品（手順書 docs/daily-samples-routine.md の ③）。
// ここに足した部品は、手で作った部品の表（glyphs.js の登場・保持・退場・加工、parts.js の背景・カメラ・画面効果・つなぎ、worlds.js の物の世界）の
// 末尾に自動でつながり（装飾は decos.js）、STUDIO のおまかせ「✂ カット割り」が、ほかの部品と同じように選ぶ。サンプル集の「カット割りの部品」の棚にも出る。
//
// 1つの部品 = { axis, key, name, desc, added, tags, w, ...その軸の形 }
//   axis   'enter' | 'hold' | 'exit' | 'treat' | 'bg' | 'cam' | 'fx' | 'trans' | 'world' | 'deco'
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
//   deco          plan(r) → P、draw(c,d,P)、back?（decos.js の形。文字のまわりの線・小さな形だけで、文字を隠さない）
// 決まり: 同じ時刻なら同じ絵（Math.random・Date.now は使わない。乱数は plan(r) の r か、kit.js の hash）。plan は JSON にできる値だけ返す。
import {TAU,clamp,lerp,fract,outCubic,inCubic,inOutCubic,outBack,smooth,bell,hash,sign,local,rgba} from './kit.js';

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
 // ---- 2026-10-17（2回目。作者の依頼「カット割りの素材を埋めていきたい」で、少ない軸（背景・つなぎ・保持）を中心に20個）
 // 背景
 {axis:'bg',key:'twinkleStars',name:'またたく星',desc:'小さな星が画面のあちこちで、ゆっくりまたたきます。',added:'2026-10-17',
  tags:['calm','emotional','pop'],w:1,plan:r=>({n:36+Math.floor(r()*24),seed:Math.floor(r()*1000),sp:.6+r()*.6}),
  draw(c,e,P){const S=Math.min(e.W,e.H);
   for(let j=0;j<P.n;j++){const h1=hash(P.seed,j,1),h2=hash(P.seed,j,2),h3=hash(P.seed,j,3),tw=Math.pow(.5+.5*Math.sin(e.t*P.sp*(1.5+h3*2.5)+h1*TAU),3);
    const x=h1*e.W,y=h2*e.H,r=S*(.004+h3*.006)*(.6+.4*tw);c.fillStyle=rgba(j%4?e.fg:e.accent,.08+.34*tw);
    c.beginPath();c.moveTo(x,y-r*2.6);c.lineTo(x+r*.5,y-r*.5);c.lineTo(x+r*2.6,y);c.lineTo(x+r*.5,y+r*.5);c.lineTo(x,y+r*2.6);c.lineTo(x-r*.5,y+r*.5);c.lineTo(x-r*2.6,y);c.lineTo(x-r*.5,y-r*.5);c.closePath();c.fill();}}},
 {axis:'bg',key:'risingBubbles',name:'昇る泡',desc:'輪だけの泡が、ゆれながら下から上へゆっくり昇っていきます。',added:'2026-10-17',
  tags:['calm','emotional','pop'],w:1,plan:r=>({n:14+Math.floor(r()*10),seed:Math.floor(r()*1000)}),
  draw(c,e,P){const S=Math.min(e.W,e.H);c.lineWidth=Math.max(1,S*.004);
   for(let j=0;j<P.n;j++){const h1=hash(P.seed,j,1),h2=hash(P.seed,j,2),h3=hash(P.seed,j,3),sp=.05+h2*.07,y=(1.15-fract(h1+e.t*sp)*1.3)*e.H,r=S*(.02+h3*.05);
    const x=h3*e.W+Math.sin(e.t*(.8+h1)+j)*S*.025;c.strokeStyle=rgba(j%3?e.fg:e.accent,.16+.1*h2);c.beginPath();c.arc(x,y,r,0,TAU);c.stroke();
    c.fillStyle=rgba(e.fg,.14);c.beginPath();c.arc(x-r*.35,y-r*.35,r*.16,0,TAU);c.fill();}}},
 {axis:'bg',key:'spinSquares',name:'回る四角',desc:'入れ子になった四角の線が、少しずつ角度を変えながら回ります。',added:'2026-10-17',
  tags:['graphic','calm','glitch'],w:1,plan:r=>({n:7+Math.floor(r()*4),sp:sign(r)*(.04+r()*.05),tw:.05+r()*.07,cx:.5+(r()-.5)*.3,cy:.5+(r()-.5)*.2}),
  draw(c,e,P){const R=Math.hypot(e.W,e.H)*.5;c.save();c.translate(e.W*P.cx,e.H*P.cy);c.lineWidth=Math.max(1,e.H*.003);
   for(let j=0;j<P.n;j++){const s=R*(j+1)/P.n;c.save();c.rotate(e.t*P.sp*TAU+j*P.tw);c.strokeStyle=rgba(j%2?e.fg:e.accent,.1+.06*(j%3));c.strokeRect(-s/2,-s/2,s,s);c.restore();}
   c.restore();}},
 {axis:'bg',key:'flickerGrain',name:'ちらつく粒',desc:'古いフィルムのような小さな粒が、こまかく場所を変えてちらつきます。',added:'2026-10-17',
  tags:['glitch','graphic','emotional'],w:.9,plan:r=>({n:90+Math.floor(r()*60),seed:Math.floor(r()*1000),fps:10+Math.floor(r()*6)}),
  // 粒は作業用のキャンバスに濃く描いてから、まとめて半透明で重ねる（粒が重なっても濃くなりすぎない）
  draw(c,e,P){const f=Math.floor(e.t*P.fps),S=Math.min(e.W,e.H),got=e.tmp?.('flickerGrain',e.W,e.H),sheet=got&&got!==c.canvas?got:null,x=sheet?sheet.getContext('2d'):c;if(sheet)x.clearRect(0,0,e.W,e.H);
   for(let j=0;j<P.n;j++){const h1=hash(P.seed+f,j,1),h2=hash(P.seed+f,j,2),h3=hash(P.seed+f,j,3),w=S*(.003+h3*.008);
    x.fillStyle=sheet?(h3<.15?e.accent:e.fg):rgba(h3<.15?e.accent:e.fg,.2);x.globalAlpha=sheet?.45+.55*h1:1;x.fillRect(h1*e.W,h2*e.H,w,w*(h3<.08?6:1));}
   if(sheet){x.globalAlpha=1;c.save();c.globalAlpha=.42;c.drawImage(sheet,0,0);c.restore();}}},
 {axis:'bg',key:'waveLines',name:'流れる波線',desc:'何本かの細い波線が、ゆるやかに形を変えながら横へ流れます。',added:'2026-10-17',
  tags:['calm','emotional','graphic'],w:1,plan:r=>({n:4+Math.floor(r()*3),k:1.2+r()*1.6,v:sign(r)*(.3+r()*.4),amp:.04+r()*.04}),
  draw(c,e,P){c.lineWidth=Math.max(1.5,e.H*.0045);
   for(let j=0;j<P.n;j++){const y0=e.H*(j+1)/(P.n+1);c.strokeStyle=rgba(j%2?e.accent:e.fg,.16);c.beginPath();
    for(let x=0;x<=e.W;x+=Math.max(4,e.W/120)){const u=x/e.W,y=y0+Math.sin(u*TAU*P.k+e.t*P.v*TAU*.25+j*1.3)*e.H*P.amp*(1+.4*Math.sin(e.t*.7+j));x?c.lineTo(x,y):c.moveTo(x,y);}
    c.stroke();}}},
 // つなぎ
 {axis:'trans',key:'splitOpen',name:'上下に開く',desc:'前の絵が真ん中で上下に割れて開き、その間から次の絵が見えてきます。',added:'2026-10-17',
  tags:['impact','graphic','pop','emotional'],w:1,dur:.4,plan:r=>({y:.5+(r()-.5)*.16}),
  draw(c,A,B,p,e,P){const q=inOutCubic(p),m=e.H*P.y,up=q*m,dn=q*(e.H-m);
   c.save();c.beginPath();c.rect(0,m-up,e.W,up+dn);c.clip();c.drawImage(B,0,0);c.restore();
   if(q<1){c.drawImage(A,0,0,e.W,m,0,-up,e.W,m);c.drawImage(A,0,m,e.W,e.H-m,0,m+dn,e.W,e.H-m);}
   c.globalAlpha=Math.pow(bell(p),.7);c.fillStyle=e.accent;const t=Math.max(2,e.H*.006);c.fillRect(0,m-up-t,e.W,t);c.fillRect(0,m+dn,e.W,t);c.globalAlpha=1;}},
 {axis:'trans',key:'quadSplit',name:'四つに割れる',desc:'前の絵が四つに割れて四隅へ飛んでいき、奥から次の絵が現れます。',added:'2026-10-17',
  tags:['impact','pop','graphic'],w:.9,dur:.42,plan:r=>({x:.5+(r()-.5)*.2,y:.5+(r()-.5)*.2}),
  draw(c,A,B,p,e,P){const q=inCubic(p)*.6+inOutCubic(p)*.4,cx=e.W*P.x,cy=e.H*P.y;
   const quads=[[0,0,cx,cy,-1,-1],[cx,0,e.W-cx,cy,1,-1],[0,cy,cx,e.H-cy,-1,1],[cx,cy,e.W-cx,e.H-cy,1,1]].map(([x,y,w,h,sx,sy])=>[x,y,w,h,x+sx*q*w,y+sy*q*h]);
   c.save();c.beginPath();c.rect(0,0,e.W,e.H);for(const [,,w,h,X,Y] of quads)c.rect(X,Y,w,h);c.clip('evenodd');c.drawImage(B,0,0);c.restore();
   if(q<1)for(const [x,y,w,h,X,Y] of quads)c.drawImage(A,x,y,w,h,X,Y,w,h);}},
 {axis:'trans',key:'pixelSwap',name:'ピクセル転換',desc:'前の絵が粗いピクセルに崩れ、粗いままの次の絵が細かく戻ってきます。',added:'2026-10-17',
  tags:['glitch','graphic','pop'],w:.9,dur:.4,plan:r=>({k:18+Math.floor(r()*14)}),
  draw(c,A,B,p,e,P){const src=p<.5?A:B,u=p<.5?smooth(p*2):smooth((1-p)*2),cells=Math.max(1,Math.round(lerp(e.W,P.k,u))),w=cells,h=Math.max(1,Math.round(cells*e.H/e.W));
   if(cells>=e.W||!e.tmp){c.drawImage(src,0,0);return;}
   const t=e.tmp('pixelSwap',w,h),x=t.getContext('2d');x.clearRect(0,0,w,h);x.imageSmoothingEnabled=true;x.drawImage(src,0,0,w,h);
   const old=c.imageSmoothingEnabled;c.imageSmoothingEnabled=false;c.drawImage(t,0,0,w,h,0,0,e.W,e.H);c.imageSmoothingEnabled=old;}},
 {axis:'trans',key:'glitchSlices',name:'グリッチ転換',desc:'横に細く切れた帯が、ずれながら少しずつ次の絵に入れ替わります。',added:'2026-10-17',
  tags:['glitch','impact','graphic'],w:1,dur:.38,plan:r=>({n:12+Math.floor(r()*10),seed:Math.floor(r()*1000)}),
  draw(c,A,B,p,e,P){c.drawImage(A,0,0);const sh=e.H/P.n;
   for(let i=0;i<P.n;i++){const at=hash(P.seed,i,1)*.8,u=clamp((p-at)/.2);if(u<=0)continue;const y=Math.floor(i*sh),h=Math.ceil(sh),dx=(1-u)*(hash(P.seed,i,2)-.5)*e.W*.3;
    c.clearRect(0,y,e.W,h);c.drawImage(B,0,y,e.W,h,dx,y,e.W,h);if(dx)c.drawImage(B,0,y,e.W,h,dx>0?dx-e.W:dx+e.W,y,e.W,h);}}},   // the part pushed off one side comes back on the other (no gap)
 {axis:'trans',key:'slideSlices',name:'帯がすべり込む',desc:'太い帯が左右から交互にすべり込んで、次の絵に入れ替わります。',added:'2026-10-17',
  tags:['graphic','pop','impact','calm'],w:1,dur:.42,plan:r=>({n:4+Math.floor(r()*4),dir:sign(r)}),
  draw(c,A,B,p,e,P){c.drawImage(A,0,0);const sh=e.H/P.n;
   for(let i=0;i<P.n;i++){const u=inOutCubic(clamp(p*1.4-i/P.n*.4));if(u<=0)continue;const y=Math.floor(i*sh),h=Math.ceil(sh),side=(i%2?1:-1)*P.dir,off=Math.round((1-u)*e.W)*side;
    const x0=Math.max(0,off),x1=Math.min(e.W,e.W+off);if(x1<=x0)continue;c.clearRect(x0,y,x1-x0,h);c.drawImage(B,x0-off,y,x1-x0,h,x0,y,x1-x0,h);}}},
 // 保持
 {axis:'hold',key:'pendulum',name:'振り子',desc:'字が1つずつ少し遅れて、振り子のように左右に小さく揺れます。',added:'2026-10-17',
  tags:['calm','emotional','pop'],w:1,plan:r=>({sp:2+r()*1.2,lag:.35+r()*.25}),
  glyph:(g,i,n,p,E,P)=>({rot:Math.sin(E.lt*P.sp-i*P.lag)*4.5*p,dx:Math.sin(E.lt*P.sp-i*P.lag)*E.size*.03*p})},
 {axis:'hold',key:'seesaw',name:'シーソー',desc:'となり合う語が、シーソーのように交互に上がったり下がったりします。',added:'2026-10-17',
  tags:['pop','calm','emotional'],w:1,plan:r=>({sp:2.4+r()*1.2,ph:r()*TAU}),
  glyph:(g,i,n,p,E,P)=>{const k=Math.sin(E.lt*P.sp+P.ph+((g.word??0)%2)*Math.PI);return {dy:k*E.size*.06*p,rot:k*2*p};}},
 {axis:'hold',key:'hopAlong',name:'順番に跳ねる',desc:'字が左から1つずつ順番に、ぴょんと小さく跳ねていきます。',added:'2026-10-17',
  tags:['pop','emotional','calm'],w:1,plan:r=>({sp:.9+r()*.6}),
  glyph:(g,i,n,p,E,P)=>{const f=fract(E.lt*P.sp)*(n+2)-1,d=Math.abs(i-f),hop=d<1?Math.sin((1-d)*Math.PI/2):0;return {dy:-hop*E.size*.16*p,rot:(i-f)*hop*1.5*p};}},
 {axis:'hold',key:'windSway',name:'風になびく',desc:'行が風に吹かれたように、字を少しずつ遅らせて横にゆらぎます。',added:'2026-10-17',
  tags:['calm','emotional'],w:1,plan:r=>({sp:1.4+r()*.8,dir:sign(r)}),
  glyph:(g,i,n,p,E,P)=>{const a=E.lt*P.sp-i*.32*P.dir;return {dx:Math.sin(a)*E.size*.07*p,rot:Math.sin(a-.6)*3*p};}},
 // 登場
 {axis:'enter',key:'alternateSides',name:'左右から交互に',desc:'字が左右から交互に飛び込んできて、元の位置に並びます。',added:'2026-10-17',
  tags:['pop','graphic','impact'],w:1,fast:true,inDur:D=>clamp(D*.32,.15,.4),plan:r=>({spread:.4+r()*.15,dist:1.8+r()*.8}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread);if(q<=0)return {hide:true};const side=i%2?1:-1;return {dx:side*E.size*P.dist*(1-outCubic(q)),a:clamp(q*2.5)};}},
 {axis:'enter',key:'swingIn',name:'揺れて止まる',desc:'字が斜めに傾いて現れ、振り子のように揺れながら止まります。',added:'2026-10-17',
  tags:['pop','emotional','calm'],w:1,inDur:D=>clamp(D*.36,.18,.45),plan:r=>({spread:.35+r()*.15,amp:28+r()*16}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread);if(q<=0)return {hide:true};const side=E.r(i,7)<.5?-1:1;
   return {rot:side*P.amp*(1-q)*(1-q)*Math.cos(q*TAU*1.25),dy:-(1-outCubic(q))*E.size*.35,a:clamp(q*3)};}},
 // 退場
 {axis:'exit',key:'splitUpDown',name:'上下に散る',desc:'となり合う字が上と下に分かれて、すっと離れながら消えます。',added:'2026-10-17',
  tags:['impact','graphic','pop'],w:1,outDur:D=>clamp(D*.26,.14,.36),plan:r=>({spread:.25+r()*.15}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread),dir=i%2?1:-1;return {dy:dir*inCubic(q)*E.size*2.4,a:1-clamp(q*1.2)};}},
 {axis:'exit',key:'spinOut',name:'回りながら消える',desc:'字がくるくると回りながら小さくなって、順に消えていきます。',added:'2026-10-17',
  tags:['pop','impact','emotional'],w:1,outDur:D=>clamp(D*.28,.15,.38),plan:r=>({turns:.8+r()*.7}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,.35),dir=E.r(i,6)<.5?-1:1,s=Math.max(.001,1-inCubic(q)*.85);return {rot:dir*inCubic(q)*360*P.turns,sx:s,sy:s,a:1-smooth(q)};}},
 // カメラ
 {axis:'cam',key:'heartbeat',name:'鼓動ズーム',desc:'文字全体が、心臓の鼓動のように二度ずつ小さく寄っては戻ります。',added:'2026-10-17',
  tags:['impact','emotional','pop'],w:1,plan:r=>({bpm:1.1+r()*.5,a:.03+r()*.02}),
  get:(e,P)=>{const ph=fract(e.t*P.bpm),beat=Math.exp(-ph*14)+.6*Math.exp(-Math.max(0,ph-.18)*14)*(ph>.18?1:0);return {s:1.02+P.a*clamp(beat)};}},
 // 画面効果
 {axis:'fx',key:'stretchX',name:'横に伸びる',desc:'カットの頭で絵全体が横にぐっと伸び、すぐに元の形へ戻ります。',added:'2026-10-17',
  tags:['impact','glitch','pop'],w:1,dur:.3,poster:.08,plan:r=>({s:.12+r()*.1}),
  apply(c,e,P,k){if(k<=.001||!e.tmp)return;const t=e.tmp('stretchX',e.W,e.H),x=t.getContext('2d');x.clearRect(0,0,e.W,e.H);x.drawImage(c.canvas,0,0);
   const sx=1+P.s*k,sy=1-P.s*k*.25;c.save();c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,e.W,e.H);c.drawImage(t,e.W*(1-sx)/2,e.H*(1-sy)/2,e.W*sx,e.H*sy);c.restore();}},

 // ---- 2026-10-18（軸の違う動きを追加）
 // 輪郭の線が走ってから、中の塗りが閃く
 {axis:'enter',key:'outlineFlash',name:'輪郭から閃く',desc:'字ごとに細い輪郭が現れ、中がアクセント色に閃いて元の色へ戻ります。',added:'2026-10-18',
  tags:['graphic','impact','pop'],w:1,fast:true,inDur:D=>clamp(D*.3,.14,.38),plan:r=>({spread:.16+r()*.08}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread);if(q<=0)return {hide:true};const trace=clamp(q/.46),flash=clamp(1-Math.abs(q-.62)/.14);return {thin:1-trace,paint:flash>.08?{u:1,color:'accent'}:null,a:clamp(q*5)};}},
 // 保持中、選ばれた1字だけが明滅する
 {axis:'hold',key:'singleBlink',name:'一字だけ点滅',desc:'ほとんど静かな行の中で、選ばれた一字だけが小さく明滅します。',added:'2026-10-18',
  tags:['glitch','graphic','calm'],w:.9,plan:r=>({at:r(),speed:2.2+r()*.8,phase:r()*TAU}),
  glyph(g,i,n,p,E,P){if(Math.floor(P.at*n)!==i)return null;const b=.5+.5*Math.sin(E.lt*P.speed*TAU+P.phase);return {a:.92+.08*b,bold:.065*(b>.68?1:.1)*p,dy:Math.sin(E.lt*P.speed*TAU+P.phase)*E.size*.018*p};}},
 // 文字を縦に伸ばして滴らせる
 {axis:'exit',key:'dripAway',name:'雨だれに溶ける',desc:'字の下が伸びて雨だれのように垂れ、ぼけながら消えていきます。',added:'2026-10-18',
  tags:['emotional','glitch','impact'],w:1,outDur:D=>clamp(D*.28,.16,.4),plan:r=>({spread:.15+r()*.12}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread),fall=inCubic(q);return {dy:fall*g.size*1.05,sy:1+fall*.62,sx:1+fall*.08,blur:fall*g.size*.075,a:1-clamp((q-.52)/.48)};}},
 // 小さな跳ねを重ねて、字ごとに外へ去る
 {axis:'exit',key:'hopAway',name:'小さく跳ね去る',desc:'字が小さな跳ねを二度重ねながら、少し横へ進んで消えていきます。',added:'2026-10-18',
  tags:['pop','impact','graphic'],w:.9,outDur:D=>clamp(D*.27,.15,.38),plan:r=>({spread:.2+r()*.1}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread),hop=Math.abs(Math.sin(q*TAU*2))*(1-q),dir=E.r(i,8)<.5?-1:1;return {dx:dir*g.size*.42*outCubic(q),dy:g.size*(.42*outCubic(q)-.3*hop),rot:dir*5*hop,a:1-smooth(q/.96)};}},
 // 文字の後ろに照準が近づく
 {axis:'deco',key:'crosshair',name:'照準',desc:'細い輪と十字が文字の外から近づき、行の中心で静かに止まります。',added:'2026-10-18',
  tags:['graphic','impact','glitch'],w:1,back:true,plan:r=>({side:sign(r),size:.34+r()*.12}),
  draw(c,d,P){const u=outCubic(d.a),cx=d.cx+P.side*(1-u)*d.w*.34,cy=d.cy-(1-u)*d.h*.18,r=d.size*P.size*(.25+.75*u);c.save();c.globalAlpha=d.z*.48;c.strokeStyle=d.accent;c.lineWidth=Math.max(1,d.size*.018);c.beginPath();c.arc(cx,cy,r,0,TAU);c.stroke();const gap=r*.32,reach=r*1.55;c.beginPath();c.moveTo(cx-reach,cy);c.lineTo(cx-gap,cy);c.moveTo(cx+gap,cy);c.lineTo(cx+reach,cy);c.moveTo(cx,cy-reach);c.lineTo(cx,cy-gap);c.moveTo(cx,cy+gap);c.lineTo(cx,cy+reach);c.stroke();c.restore();}},
 // 震える縦線の列を中央から左右へ分ける
 {axis:'bg',key:'splitColumns',name:'真ん中が割れる縦線',desc:'細い縦線が細かく震え、中央のすき間がゆっくり広がって戻ります。',added:'2026-10-18',
  tags:['graphic','glitch','calm'],w:.9,plan:r=>({n:30+Math.floor(r()*11),seed:Math.floor(r()*1000),speed:.8+r()*.5}),
  draw(c,e,P){const gap=e.W*(.025+.055*(.5+.5*Math.sin(e.t*P.speed*TAU*.2)));c.save();c.lineWidth=Math.max(.8,e.W/P.n*.12);
   for(let i=0;i<P.n;i++){const base=((i+.5)/P.n-.5)*e.W,side=Math.sign(base);if(Math.abs(base)<gap*.5)continue;const jitter=Math.sin(e.t*P.speed*TAU+hash(P.seed,i,1)*TAU)*e.W*.004,x=e.W*.5+base+side*gap*.5+jitter;c.strokeStyle=rgba(i%3?e.fg:e.accent,.17);c.beginPath();c.moveTo(x,0);c.lineTo(x,e.H);c.stroke();}
   c.restore();}},
 // 星形の窓が広がって次の絵に切り替わる
 {axis:'trans',key:'starWindow',name:'星窓で切り替わる',desc:'前の絵の上に星形の窓が広がり、窓の向こうから次の絵へ切り替わります。',added:'2026-10-18',
  tags:['pop','impact','graphic'],w:1,dur:.4,plan:r=>({rot:r()*TAU/10}),
  draw(c,A,B,p,e,P){c.drawImage(A,0,0);const q=inCubic(p),R=Math.hypot(e.W,e.H)*2.25*q,cx=e.W*.5,cy=e.H*.5;c.save();c.beginPath();for(let i=0;i<20;i++){const a=P.rot+i*TAU/20,r=i%2?R*.52:R,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.clip();c.drawImage(B,0,0);c.restore();}},
];
