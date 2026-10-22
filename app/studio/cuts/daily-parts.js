// 毎日のルーティンで足す、カット割りの部品（手順書 docs/daily-samples-routine.md の ③）。
// ここに足した部品は、手で作った部品の表（glyphs.js の登場・保持・退場・加工、parts.js の背景・カメラ・画面効果・つなぎ、worlds.js の物の世界）の
// 末尾に自動でつながり（装飾は decos.js）、STUDIO のおまかせ「✂ カット割り」が、ほかの部品と同じように選ぶ。サンプル集の「カット割りの部品」の棚にも出る。
//
// 1つの部品 = { axis, key, name, desc, added, words, tags, w, ...その軸の形 }
//   axis   'enter' | 'hold' | 'exit' | 'treat' | 'bg' | 'cam' | 'fx' | 'trans' | 'world' | 'deco'
//   key    英字で始まる英数字（camelCase）。同じ軸のほかの部品と重ならない
//   name   日本語の名前（2〜12文字。サンプル集のプレビューでは、この名前が、この部品で動く）
//   desc   10〜60文字で「。」で終わる1文      added  足した日（日本時間 YYYY-MM-DD）
//   words  言い方（1〜4個、1つ12文字まで）。人がこの動きを頼む時の言い方（例 ['ブラインド','降りる']）。部品ラボの言葉辞典が、この言い方で部品を引く
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
import {TAU,clamp,lerp,fract,outCubic,inCubic,inOutCubic,outBack,outExpo,smooth,bell,hash,sign,local,rgba} from './kit.js';

function depthPoint(x,y,z,e,scale){const S=Math.min(e.W,e.H),k=3.2/(3.2-z);return {x:e.W/2+x*S*scale*k,y:e.H/2+y*S*scale*k,z};}
function depthEdge(c,a,b,e,col,alpha){const S=Math.min(e.W,e.H),z=(a.z+b.z)*.5,d=clamp((z+.8)/1.6);c.lineWidth=Math.max(1,S*(.0025+.006*d));c.strokeStyle=rgba(col,alpha*(.55+.55*d));c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}
// 奥行きの線（depthEdge）を奥から順に、作業用のキャンバスにまとめて描いてから、決まった薄さ（veil）で一度だけ重ねる。線が何本重なっても下の絵を塗りつぶさず、1本だけの所の濃さは前と同じ（作業用のキャンバスが無い時は、その場で1枚作る）
function depthEdges(c,e,slot,edges,veil=.45){edges.sort((a,b)=>(a[0].z+a[1].z)-(b[0].z+b[1].z));const got=e.tmp?.(slot,e.W,e.H),sheet=got&&got!==c.canvas?got:typeof OffscreenCanvas==='function'?new OffscreenCanvas(e.W,e.H):null;if(!sheet){c.save();for(const [a,b,col,alpha] of edges)depthEdge(c,a,b,e,col,alpha);c.restore();return;}const x=sheet.getContext('2d');x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.globalCompositeOperation='source-over';x.clearRect(0,0,e.W,e.H);for(const [a,b,col,alpha] of edges)depthEdge(x,a,b,e,col,Math.min(1,alpha/veil));c.save();c.globalAlpha*=veil;c.drawImage(sheet,0,0);c.restore();}
function dailyStar(c,x,y,r,rot){c.save();c.translate(x,y);c.rotate(rot);c.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,q=i%2?.28:1;c.lineTo(Math.cos(a)*r*q,Math.sin(a)*r*q);}c.closePath();c.fill();c.restore();}

export const DAILY_CUT_PARTS=[
 // ---- 2026-10-17（最初の8個。手順書を作り直した日に、Claude が手本として足した）
 {axis:'enter',key:'centerOut',name:'真ん中から広がる',desc:'全部の字が行の真ん中に重なって現れ、元の位置へ広がります。',added:'2026-10-17',words:['広がる','真ん中から','中央から出る'],
  tags:['pop','graphic','impact','emotional'],w:1,fast:true,inDur:D=>clamp(D*.32,.15,.4),plan:r=>({k:.6+r()*.4}),
  glyph(g,i,n,p,E,P){const e=inOutCubic(p),mid=(E.bbox.x0+E.bbox.x1)/2,s=lerp(.6,1,outBack(p,1.4));return {dx:(mid-g.cx)*(1-e)*P.k,sx:s,sy:s,a:clamp(p*3)};}},
 {axis:'enter',key:'flipIn',name:'パタパタめくれる',desc:'駅の案内板のように、字が1つずつ上から下へめくれて現れます。',added:'2026-10-17',words:['パタパタ','フラップ','めくれる','案内板'],
  tags:['graphic','pop','calm','glitch'],w:1,fast:true,inDur:(D,n)=>clamp(.12+n*.03,.15,D*.5),plan:()=>({}),
  glyph(g,i,n,p,E){const q=local(p,i,n,.55);if(q<=0)return {hide:true};return {sy:Math.max(.04,Math.abs(Math.cos((1-q)*Math.PI*1.5))*(.3+.7*q)),dy:-(1-q)*E.size*.12};}},
 {axis:'exit',key:'gatherOut',name:'真ん中へ吸い込まれる',desc:'字が行の真ん中へ寄りながら小さくなって、吸い込まれるように消えます。',added:'2026-10-17',words:['吸い込まれる','集まって消える','中央へ消える'],
  tags:['pop','graphic','impact','emotional'],w:1,outDur:D=>clamp(D*.26,.14,.36),plan:()=>({}),
  glyph(g,i,n,p,E){const e=smooth(p),mid=(E.bbox.x0+E.bbox.x1)/2,s=Math.max(.02,1-inCubic(p));return {dx:(mid-g.cx)*e,sx:s,sy:s,a:1-clamp((p-.6)/.4)};}},
 {axis:'exit',key:'riseAway',name:'ふわっと昇って消える',desc:'字が少しずつ時間をずらして上へ昇り、ゆれながら薄くなって消えます。',added:'2026-10-17',words:['ふわっと消える','昇って消える','浮かんで消える'],
  tags:['emotional','calm','pop'],w:1,outDur:D=>clamp(D*.3,.16,.42),plan:r=>({sway:sign(r)}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,.5);return {dy:-smooth(q)*E.size*1.1,dx:Math.sin(q*TAU*.75+i)*E.size*.12*q*P.sway,rot:(E.r(i,8)-.5)*16*q,a:1-smooth(q)};}},
 {axis:'hold',key:'wordPulse',name:'語ごとに脈打つ',desc:'語ごとに順番に、心臓の鼓動のように小さく大きくなります。',added:'2026-10-17',words:['脈打つ','鼓動','ドクドク'],
  tags:['pop','impact','emotional'],w:1,plan:r=>({bpm:1.4+r()*.6}),
  glyph(g,i,n,p,E,P){const k=Math.max(1,E.nWords),ph=fract(E.lt*P.bpm-(g.word??0)/k),beat=Math.exp(-ph*9);const s=1+.07*p*beat;return {sx:s,sy:s,dy:-beat*p*E.size*.04};}},
 {axis:'bg',key:'confetti',name:'紙吹雪',desc:'色の小さな紙が、ひらひらと回りながら上から降ってきます。',added:'2026-10-17',words:['紙吹雪','コンフェッティ','お祝い'],
  tags:['pop','emotional','impact'],w:.9,plan:r=>({n:28+Math.floor(r()*18),seed:Math.floor(r()*1000),drift:sign(r)}),
  // 紙は作業用のキャンバスに濃く描いてから、まとめて半透明で重ねる（紙が重なっても濃くなりすぎない）
  draw(c,e,P){const S=Math.min(e.W,e.H),got=e.tmp?.('confetti',e.W,e.H),sheet=got&&got!==c.canvas?got:null,x=sheet?sheet.getContext('2d'):c;if(sheet)x.clearRect(0,0,e.W,e.H);
   for(let j=0;j<P.n;j++){const h1=hash(P.seed,j,1),h2=hash(P.seed,j,2),h3=hash(P.seed,j,3),fall=.12+h2*.18;
    const y=((h1+e.t*fall)%1.1-.05)*e.H,px=(h3*e.W+Math.sin(e.t*1.7+j)*S*.03*P.drift+e.W)%e.W,rot=e.t*(1.5+h2*3)*(j%2?1:-1)+j,w=S*(.03+h1*.025),hh=w*.55,flip=Math.abs(Math.cos(e.t*3+j));
    x.save();x.translate(px,y);x.rotate(rot);x.scale(1,Math.max(.15,flip));x.fillStyle=sheet?(j%3?e.accent:e.fg):rgba(j%3?e.accent:e.fg,.3);x.fillRect(-w/2,-hh/2,w,hh);x.restore();}
   if(sheet){c.save();c.globalAlpha=.42;c.drawImage(sheet,0,0);c.restore();}}},
 {axis:'cam',key:'orbit',name:'円を描いて回る',desc:'文字全体が、小さな円を描くように画面の中をゆっくり回ります。',added:'2026-10-17',words:['円を描く','回るカメラ','ぐるぐる'],
  tags:['calm','emotional','pop','graphic'],w:1,plan:r=>({dir:sign(r),ph:r()*TAU}),
  get:(e,P)=>{const a=P.ph+P.dir*e.p*TAU*.5;return {s:1.04,x:Math.cos(a)*e.W*.014,y:Math.sin(a)*e.H*.02};}},
 {axis:'trans',key:'zoomThrough',name:'ズームで抜ける',desc:'前の絵が手前へ大きく抜けていき、その奥から次の絵が近づいてきます。',added:'2026-10-17',words:['ズームで抜ける','ズーム転換','突き抜ける'],
  tags:['impact','pop','graphic','emotional'],w:1,dur:.4,plan:()=>({}),
  draw(c,A,B,p,e){const k=inOutCubic(p),sa=1+k*.6,sb=lerp(1.18,1,k);
   c.drawImage(A,e.W*(1-sa)/2,e.H*(1-sa)/2,e.W*sa,e.H*sa);
   c.globalAlpha=smooth(k*1.15);c.drawImage(B,e.W*(1-sb)/2,e.H*(1-sb)/2,e.W*sb,e.H*sb);c.globalAlpha=1;}},
 // ---- 2026-10-17（2回目。作者の依頼「カット割りの素材を埋めていきたい」で、少ない軸（背景・つなぎ・保持）を中心に20個）
 // 背景
 {axis:'bg',key:'twinkleStars',name:'またたく星',desc:'小さな星が画面のあちこちで、ゆっくりまたたきます。',added:'2026-10-17',words:['星','きらきら','またたく'],
  tags:['calm','emotional','pop'],w:1,plan:r=>({n:36+Math.floor(r()*24),seed:Math.floor(r()*1000),sp:.6+r()*.6}),
  draw(c,e,P){const S=Math.min(e.W,e.H);
   for(let j=0;j<P.n;j++){const h1=hash(P.seed,j,1),h2=hash(P.seed,j,2),h3=hash(P.seed,j,3),tw=Math.pow(.5+.5*Math.sin(e.t*P.sp*(1.5+h3*2.5)+h1*TAU),3);
    const x=h1*e.W,y=h2*e.H,r=S*(.004+h3*.006)*(.6+.4*tw);c.fillStyle=rgba(j%4?e.fg:e.accent,.08+.34*tw);
    c.beginPath();c.moveTo(x,y-r*2.6);c.lineTo(x+r*.5,y-r*.5);c.lineTo(x+r*2.6,y);c.lineTo(x+r*.5,y+r*.5);c.lineTo(x,y+r*2.6);c.lineTo(x-r*.5,y+r*.5);c.lineTo(x-r*2.6,y);c.lineTo(x-r*.5,y-r*.5);c.closePath();c.fill();}}},
 {axis:'bg',key:'risingBubbles',name:'昇る泡',desc:'輪だけの泡が、ゆれながら下から上へゆっくり昇っていきます。',added:'2026-10-17',words:['泡','バブル','昇る泡'],
  tags:['calm','emotional','pop'],w:1,plan:r=>({n:14+Math.floor(r()*10),seed:Math.floor(r()*1000)}),
  draw(c,e,P){const S=Math.min(e.W,e.H);c.lineWidth=Math.max(1,S*.004);
   for(let j=0;j<P.n;j++){const h1=hash(P.seed,j,1),h2=hash(P.seed,j,2),h3=hash(P.seed,j,3),sp=.05+h2*.07,y=(1.15-fract(h1+e.t*sp)*1.3)*e.H,r=S*(.02+h3*.05);
    const x=h3*e.W+Math.sin(e.t*(.8+h1)+j)*S*.025;c.strokeStyle=rgba(j%3?e.fg:e.accent,.16+.1*h2);c.beginPath();c.arc(x,y,r,0,TAU);c.stroke();
    c.fillStyle=rgba(e.fg,.14);c.beginPath();c.arc(x-r*.35,y-r*.35,r*.16,0,TAU);c.fill();}}},
 {axis:'bg',key:'spinSquares',name:'回る四角',desc:'入れ子になった四角の線が、少しずつ角度を変えながら回ります。',added:'2026-10-17',words:['回る四角','入れ子の四角'],
  tags:['graphic','calm','glitch'],w:1,plan:r=>({n:7+Math.floor(r()*4),sp:sign(r)*(.04+r()*.05),tw:.05+r()*.07,cx:.5+(r()-.5)*.3,cy:.5+(r()-.5)*.2}),
  draw(c,e,P){const R=Math.hypot(e.W,e.H)*.5;c.save();c.translate(e.W*P.cx,e.H*P.cy);c.lineWidth=Math.max(1,e.H*.003);
   for(let j=0;j<P.n;j++){const s=R*(j+1)/P.n;c.save();c.rotate(e.t*P.sp*TAU+j*P.tw);c.strokeStyle=rgba(j%2?e.fg:e.accent,.1+.06*(j%3));c.strokeRect(-s/2,-s/2,s,s);c.restore();}
   c.restore();}},
 {axis:'bg',key:'flickerGrain',name:'ちらつく粒',desc:'古いフィルムのような小さな粒が、こまかく場所を変えてちらつきます。',added:'2026-10-17',words:['フィルムノイズ','粒','ちらつき','古いフィルム'],
  tags:['glitch','graphic','emotional'],w:.9,plan:r=>({n:90+Math.floor(r()*60),seed:Math.floor(r()*1000),fps:10+Math.floor(r()*6)}),
  // 粒は作業用のキャンバスに濃く描いてから、まとめて半透明で重ねる（粒が重なっても濃くなりすぎない）
  draw(c,e,P){const f=Math.floor(e.t*P.fps),S=Math.min(e.W,e.H),got=e.tmp?.('flickerGrain',e.W,e.H),sheet=got&&got!==c.canvas?got:null,x=sheet?sheet.getContext('2d'):c;if(sheet)x.clearRect(0,0,e.W,e.H);
   for(let j=0;j<P.n;j++){const h1=hash(P.seed+f,j,1),h2=hash(P.seed+f,j,2),h3=hash(P.seed+f,j,3),w=S*(.003+h3*.008);
    x.fillStyle=sheet?(h3<.15?e.accent:e.fg):rgba(h3<.15?e.accent:e.fg,.2);x.globalAlpha=sheet?.45+.55*h1:1;x.fillRect(h1*e.W,h2*e.H,w,w*(h3<.08?6:1));}
   if(sheet){x.globalAlpha=1;c.save();c.globalAlpha=.42;c.drawImage(sheet,0,0);c.restore();}}},
 {axis:'bg',key:'waveLines',name:'流れる波線',desc:'何本かの細い波線が、ゆるやかに形を変えながら横へ流れます。',added:'2026-10-17',words:['波線','流れる線','ウェーブ'],
  tags:['calm','emotional','graphic'],w:1,plan:r=>({n:4+Math.floor(r()*3),k:1.2+r()*1.6,v:sign(r)*(.3+r()*.4),amp:.04+r()*.04}),
  draw(c,e,P){c.lineWidth=Math.max(1.5,e.H*.0045);
   for(let j=0;j<P.n;j++){const y0=e.H*(j+1)/(P.n+1);c.strokeStyle=rgba(j%2?e.accent:e.fg,.16);c.beginPath();
    for(let x=0;x<=e.W;x+=Math.max(4,e.W/120)){const u=x/e.W,y=y0+Math.sin(u*TAU*P.k+e.t*P.v*TAU*.25+j*1.3)*e.H*P.amp*(1+.4*Math.sin(e.t*.7+j));x?c.lineTo(x,y):c.moveTo(x,y);}
    c.stroke();}}},
 // つなぎ
 {axis:'trans',key:'splitOpen',name:'上下に開く',desc:'前の絵が真ん中で上下に割れて開き、その間から次の絵が見えてきます。',added:'2026-10-17',words:['上下に開く','割れて開く','扉が開く'],
  tags:['impact','graphic','pop','emotional'],w:1,dur:.4,plan:r=>({y:.5+(r()-.5)*.16}),
  draw(c,A,B,p,e,P){const q=inOutCubic(p),m=e.H*P.y,up=q*m,dn=q*(e.H-m);
   c.save();c.beginPath();c.rect(0,m-up,e.W,up+dn);c.clip();c.drawImage(B,0,0);c.restore();
   if(q<1){c.drawImage(A,0,0,e.W,m,0,-up,e.W,m);c.drawImage(A,0,m,e.W,e.H-m,0,m+dn,e.W,e.H-m);}
   c.globalAlpha=Math.pow(bell(p),.7);c.fillStyle=e.accent;const t=Math.max(2,e.H*.006);c.fillRect(0,m-up-t,e.W,t);c.fillRect(0,m+dn,e.W,t);c.globalAlpha=1;}},
 {axis:'trans',key:'quadSplit',name:'四つに割れる',desc:'前の絵が四つに割れて四隅へ飛んでいき、奥から次の絵が現れます。',added:'2026-10-17',words:['四分割','四つに割れる'],
  tags:['impact','pop','graphic'],w:.9,dur:.42,plan:r=>({x:.5+(r()-.5)*.2,y:.5+(r()-.5)*.2}),
  draw(c,A,B,p,e,P){const q=inCubic(p)*.6+inOutCubic(p)*.4,cx=e.W*P.x,cy=e.H*P.y;
   const quads=[[0,0,cx,cy,-1,-1],[cx,0,e.W-cx,cy,1,-1],[0,cy,cx,e.H-cy,-1,1],[cx,cy,e.W-cx,e.H-cy,1,1]].map(([x,y,w,h,sx,sy])=>[x,y,w,h,x+sx*q*w,y+sy*q*h]);
   c.save();c.beginPath();c.rect(0,0,e.W,e.H);for(const [,,w,h,X,Y] of quads)c.rect(X,Y,w,h);c.clip('evenodd');c.drawImage(B,0,0);c.restore();
   if(q<1)for(const [x,y,w,h,X,Y] of quads)c.drawImage(A,x,y,w,h,X,Y,w,h);}},
 {axis:'trans',key:'pixelSwap',name:'ピクセル転換',desc:'前の絵が粗いピクセルに崩れ、粗いままの次の絵が細かく戻ってきます。',added:'2026-10-17',words:['ピクセル','モザイク転換','ドット絵'],
  tags:['glitch','graphic','pop'],w:.9,dur:.4,plan:r=>({k:18+Math.floor(r()*14)}),
  draw(c,A,B,p,e,P){const src=p<.5?A:B,u=p<.5?smooth(p*2):smooth((1-p)*2),cells=Math.max(1,Math.round(lerp(e.W,P.k,u))),w=cells,h=Math.max(1,Math.round(cells*e.H/e.W));
   if(cells>=e.W||!e.tmp){c.drawImage(src,0,0);return;}
   const t=e.tmp('pixelSwap',w,h),x=t.getContext('2d');x.clearRect(0,0,w,h);x.imageSmoothingEnabled=true;x.drawImage(src,0,0,w,h);
   const old=c.imageSmoothingEnabled;c.imageSmoothingEnabled=false;c.drawImage(t,0,0,w,h,0,0,e.W,e.H);c.imageSmoothingEnabled=old;}},
 {axis:'trans',key:'glitchSlices',name:'グリッチ転換',desc:'横に細く切れた帯が、ずれながら少しずつ次の絵に入れ替わります。',added:'2026-10-17',words:['グリッチ','ノイズ転換','ずれる'],
  tags:['glitch','impact','graphic'],w:1,dur:.38,plan:r=>({n:12+Math.floor(r()*10),seed:Math.floor(r()*1000)}),
  draw(c,A,B,p,e,P){c.drawImage(A,0,0);const sh=e.H/P.n;
   for(let i=0;i<P.n;i++){const at=hash(P.seed,i,1)*.8,u=clamp((p-at)/.2);if(u<=0)continue;const y=Math.floor(i*sh),h=Math.ceil(sh),dx=(1-u)*(hash(P.seed,i,2)-.5)*e.W*.3;
    c.clearRect(0,y,e.W,h);c.drawImage(B,0,y,e.W,h,dx,y,e.W,h);if(dx)c.drawImage(B,0,y,e.W,h,dx>0?dx-e.W:dx+e.W,y,e.W,h);}}},   // the part pushed off one side comes back on the other (no gap)
 {axis:'trans',key:'slideSlices',name:'帯がすべり込む',desc:'太い帯が左右から交互にすべり込んで、次の絵に入れ替わります。',added:'2026-10-17',words:['スライド','帯','すべり込む'],
  tags:['graphic','pop','impact','calm'],w:1,dur:.42,plan:r=>({n:4+Math.floor(r()*4),dir:sign(r)}),
  draw(c,A,B,p,e,P){c.drawImage(A,0,0);const sh=e.H/P.n;
   for(let i=0;i<P.n;i++){const u=inOutCubic(clamp(p*1.4-i/P.n*.4));if(u<=0)continue;const y=Math.floor(i*sh),h=Math.ceil(sh),side=(i%2?1:-1)*P.dir,off=Math.round((1-u)*e.W)*side;
    const x0=Math.max(0,off),x1=Math.min(e.W,e.W+off);if(x1<=x0)continue;c.clearRect(x0,y,x1-x0,h);c.drawImage(B,x0-off,y,x1-x0,h,x0,y,x1-x0,h);}}},
 // 保持
 {axis:'hold',key:'pendulum',name:'振り子',desc:'字が1つずつ少し遅れて、振り子のように左右に小さく揺れます。',added:'2026-10-17',words:['振り子','揺れる','ゆらゆら'],
  tags:['calm','emotional','pop'],w:1,plan:r=>({sp:2+r()*1.2,lag:.35+r()*.25}),
  glyph:(g,i,n,p,E,P)=>({rot:Math.sin(E.lt*P.sp-i*P.lag)*4.5*p,dx:Math.sin(E.lt*P.sp-i*P.lag)*E.size*.03*p})},
 {axis:'hold',key:'seesaw',name:'シーソー',desc:'となり合う語が、シーソーのように交互に上がったり下がったりします。',added:'2026-10-17',words:['シーソー','交互に上下'],
  tags:['pop','calm','emotional'],w:1,plan:r=>({sp:2.4+r()*1.2,ph:r()*TAU}),
  glyph:(g,i,n,p,E,P)=>{const k=Math.sin(E.lt*P.sp+P.ph+((g.word??0)%2)*Math.PI);return {dy:k*E.size*.06*p,rot:k*2*p};}},
 {axis:'hold',key:'hopAlong',name:'順番に跳ねる',desc:'字が左から1つずつ順番に、ぴょんと小さく跳ねていきます。',added:'2026-10-17',words:['跳ねる','ぴょんぴょん','バウンド'],
  tags:['pop','emotional','calm'],w:1,plan:r=>({sp:.9+r()*.6}),
  glyph:(g,i,n,p,E,P)=>{const f=fract(E.lt*P.sp)*(n+2)-1,d=Math.abs(i-f),hop=d<1?Math.sin((1-d)*Math.PI/2):0;return {dy:-hop*E.size*.16*p,rot:(i-f)*hop*1.5*p};}},
 {axis:'hold',key:'windSway',name:'風になびく',desc:'行が風に吹かれたように、字を少しずつ遅らせて横にゆらぎます。',added:'2026-10-17',words:['なびく','風','そよぐ'],
  tags:['calm','emotional'],w:1,plan:r=>({sp:1.4+r()*.8,dir:sign(r)}),
  glyph:(g,i,n,p,E,P)=>{const a=E.lt*P.sp-i*.32*P.dir;return {dx:Math.sin(a)*E.size*.07*p,rot:Math.sin(a-.6)*3*p};}},
 // 登場
 {axis:'enter',key:'alternateSides',name:'左右から交互に',desc:'字が左右から交互に飛び込んできて、元の位置に並びます。',added:'2026-10-17',words:['左右から','交互に入る','飛び込む'],
  tags:['pop','graphic','impact'],w:1,fast:true,inDur:D=>clamp(D*.32,.15,.4),plan:r=>({spread:.4+r()*.15,dist:1.8+r()*.8}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread);if(q<=0)return {hide:true};const side=i%2?1:-1;return {dx:side*E.size*P.dist*(1-outCubic(q)),a:clamp(q*2.5)};}},
 {axis:'enter',key:'swingIn',name:'揺れて止まる',desc:'字が斜めに傾いて現れ、振り子のように揺れながら止まります。',added:'2026-10-17',words:['揺れて止まる','ぶら下がる','スイング'],
  tags:['pop','emotional','calm'],w:1,inDur:D=>clamp(D*.36,.18,.45),plan:r=>({spread:.35+r()*.15,amp:28+r()*16}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread);if(q<=0)return {hide:true};const side=E.r(i,7)<.5?-1:1;
   return {rot:side*P.amp*(1-q)*(1-q)*Math.cos(q*TAU*1.25),dy:-(1-outCubic(q))*E.size*.35,a:clamp(q*3)};}},
 // 退場
 {axis:'exit',key:'splitUpDown',name:'上下に散る',desc:'となり合う字が上と下に分かれて、すっと離れながら消えます。',added:'2026-10-17',words:['上下に散る','分かれて消える'],
  tags:['impact','graphic','pop'],w:1,outDur:D=>clamp(D*.26,.14,.36),plan:r=>({spread:.25+r()*.15}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread),dir=i%2?1:-1;return {dy:dir*inCubic(q)*E.size*2.4,a:1-clamp(q*1.2)};}},
 {axis:'exit',key:'spinOut',name:'回りながら消える',desc:'字がくるくると回りながら小さくなって、順に消えていきます。',added:'2026-10-17',words:['回って消える','くるくる','スピン'],
  tags:['pop','impact','emotional'],w:1,outDur:D=>clamp(D*.28,.15,.38),plan:r=>({turns:.8+r()*.7}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,.35),dir=E.r(i,6)<.5?-1:1,s=Math.max(.001,1-inCubic(q)*.85);return {rot:dir*inCubic(q)*360*P.turns,sx:s,sy:s,a:1-smooth(q)};}},
 // カメラ
 {axis:'cam',key:'heartbeat',name:'鼓動ズーム',desc:'文字全体が、心臓の鼓動のように二度ずつ小さく寄っては戻ります。',added:'2026-10-17',words:['鼓動ズーム','ドキドキ','ズームパルス'],
  tags:['impact','emotional','pop'],w:1,plan:r=>({bpm:1.1+r()*.5,a:.03+r()*.02}),
  get:(e,P)=>{const ph=fract(e.t*P.bpm),beat=Math.exp(-ph*14)+.6*Math.exp(-Math.max(0,ph-.18)*14)*(ph>.18?1:0);return {s:1.02+P.a*clamp(beat)};}},
 // 画面効果
 {axis:'fx',key:'stretchX',name:'横に伸びる',desc:'カットの頭で絵全体が横にぐっと伸び、すぐに元の形へ戻ります。',added:'2026-10-17',words:['伸びる','横に伸びる','ストレッチ'],
  tags:['impact','glitch','pop'],w:1,dur:.3,poster:.08,plan:r=>({s:.12+r()*.1}),
  apply(c,e,P,k){if(k<=.001||!e.tmp)return;const t=e.tmp('stretchX',e.W,e.H),x=t.getContext('2d');x.clearRect(0,0,e.W,e.H);x.drawImage(c.canvas,0,0);
   const sx=1+P.s*k,sy=1-P.s*k*.25;c.save();c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,e.W,e.H);c.drawImage(t,e.W*(1-sx)/2,e.H*(1-sy)/2,e.W*sx,e.H*sy);c.restore();}},

 // ---- 2026-10-18（軸の違う動きを追加）
 // 輪郭の線が走ってから、中の塗りが閃く
 {axis:'enter',key:'outlineFlash',name:'輪郭から閃く',desc:'字ごとに細い輪郭が現れ、中がアクセント色に閃いて元の色へ戻ります。',added:'2026-10-18',words:['輪郭','閃く','フラッシュ'],
  tags:['graphic','impact','pop'],w:1,fast:true,inDur:D=>clamp(D*.3,.14,.38),plan:r=>({spread:.16+r()*.08}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread);if(q<=0)return {hide:true};const trace=clamp(q/.46),flash=clamp(1-Math.abs(q-.62)/.14);return {thin:1-trace,paint:flash>.08?{u:1,color:'accent'}:null,a:clamp(q*5)};}},
 // 保持中、選ばれた1字だけが明滅する
 {axis:'hold',key:'singleBlink',name:'一字だけ点滅',desc:'ほとんど静かな行の中で、選ばれた一字だけが小さく明滅します。',added:'2026-10-18',words:['点滅','一字だけ','チカチカ'],
  tags:['glitch','graphic','calm'],w:.9,plan:r=>({at:r(),speed:2.2+r()*.8,phase:r()*TAU}),
  glyph(g,i,n,p,E,P){if(Math.floor(P.at*n)!==i)return null;const b=.5+.5*Math.sin(E.lt*P.speed*TAU+P.phase);return {a:.92+.08*b,bold:.065*(b>.68?1:.1)*p,dy:Math.sin(E.lt*P.speed*TAU+P.phase)*E.size*.018*p};}},
 // 文字を縦に伸ばして滴らせる
 {axis:'exit',key:'dripAway',name:'雨だれに溶ける',desc:'字の下が伸びて雨だれのように垂れ、ぼけながら消えていきます。',added:'2026-10-18',words:['垂れる','溶ける','したたる','雨だれ'],
  tags:['emotional','glitch','impact'],w:1,outDur:D=>clamp(D*.28,.16,.4),plan:r=>({spread:.15+r()*.12}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread),fall=inCubic(q);return {dy:fall*g.size*1.05,sy:1+fall*.62,sx:1+fall*.08,blur:fall*g.size*.075,a:1-clamp((q-.52)/.48)};}},
 // 小さな跳ねを重ねて、字ごとに外へ去る
 {axis:'exit',key:'hopAway',name:'小さく跳ね去る',desc:'字が小さな跳ねを二度重ねながら、少し横へ進んで消えていきます。',added:'2026-10-18',words:['跳ねて消える','ぴょんと去る'],
  tags:['pop','impact','graphic'],w:.9,outDur:D=>clamp(D*.27,.15,.38),plan:r=>({spread:.2+r()*.1}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread),hop=Math.abs(Math.sin(q*TAU*2))*(1-q),dir=E.r(i,8)<.5?-1:1;return {dx:dir*g.size*.42*outCubic(q),dy:g.size*(.42*outCubic(q)-.3*hop),rot:dir*5*hop,a:1-smooth(q/.96)};}},
 // 文字の後ろに照準が近づく
 {axis:'deco',key:'crosshair',name:'照準',desc:'細い輪と十字が文字の外から近づき、行の中心で静かに止まります。',added:'2026-10-18',words:['照準','ターゲット','十字'],
  tags:['graphic','impact','glitch'],w:1,back:true,plan:r=>({side:sign(r),size:.34+r()*.12}),
  draw(c,d,P){const u=outCubic(d.a),cx=d.cx+P.side*(1-u)*d.w*.34,cy=d.cy-(1-u)*d.h*.18,r=d.size*P.size*(.25+.75*u);c.save();c.globalAlpha=d.z*.48;c.strokeStyle=d.accent;c.lineWidth=Math.max(1,d.size*.018);c.beginPath();c.arc(cx,cy,r,0,TAU);c.stroke();const gap=r*.32,reach=r*1.55;c.beginPath();c.moveTo(cx-reach,cy);c.lineTo(cx-gap,cy);c.moveTo(cx+gap,cy);c.lineTo(cx+reach,cy);c.moveTo(cx,cy-reach);c.lineTo(cx,cy-gap);c.moveTo(cx,cy+gap);c.lineTo(cx,cy+reach);c.stroke();c.restore();}},
 // 震える縦線の列を中央から左右へ分ける
 {axis:'bg',key:'splitColumns',name:'真ん中が割れる縦線',desc:'細い縦線が細かく震え、中央のすき間がゆっくり広がって戻ります。',added:'2026-10-18',words:['縦線','すき間','ストライプ'],
  tags:['graphic','glitch','calm'],w:.9,plan:r=>({n:30+Math.floor(r()*11),seed:Math.floor(r()*1000),speed:.8+r()*.5}),
  draw(c,e,P){const gap=e.W*(.025+.055*(.5+.5*Math.sin(e.t*P.speed*TAU*.2)));c.save();c.lineWidth=Math.max(.8,e.W/P.n*.12);
   for(let i=0;i<P.n;i++){const base=((i+.5)/P.n-.5)*e.W,side=Math.sign(base);if(Math.abs(base)<gap*.5)continue;const jitter=Math.sin(e.t*P.speed*TAU+hash(P.seed,i,1)*TAU)*e.W*.004,x=e.W*.5+base+side*gap*.5+jitter;c.strokeStyle=rgba(i%3?e.fg:e.accent,.17);c.beginPath();c.moveTo(x,0);c.lineTo(x,e.H);c.stroke();}
   c.restore();}},
 // 星形の窓が広がって次の絵に切り替わる
 {axis:'trans',key:'starWindow',name:'星窓で切り替わる',desc:'前の絵の上に星形の窓が広がり、窓の向こうから次の絵へ切り替わります。',added:'2026-10-18',words:['星形','星の窓','アイリス'],
  tags:['pop','impact','graphic'],w:1,dur:.4,plan:r=>({rot:r()*TAU/10}),
  draw(c,A,B,p,e,P){c.drawImage(A,0,0);const q=inCubic(p),R=Math.hypot(e.W,e.H)*2.25*q,cx=e.W*.5,cy=e.H*.5;c.save();c.beginPath();for(let i=0;i<20;i++){const a=P.rot+i*TAU/20,r=i%2?R*.52:R,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.clip();c.drawImage(B,0,0);c.restore();}},
 // ---- 2026-10-19
 // 字が上の細い線から、ブラインドを下ろすように下へ開く
 {axis:'enter',key:'blindDown',name:'ブラインドが降りる',desc:'字が上の細い線から、ブラインドを下ろすように下へ向かって開いていきます。',added:'2026-10-19',words:['ブラインド','降りる','シャッター'],
  tags:['graphic','calm','pop','emotional'],w:1,fast:true,inDur:D=>clamp(D*.32,.16,.42),plan:r=>({spread:.3+r()*.2}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread);if(q<=0)return {hide:true};const u=outExpo(q);if(1-u<.002)return null;const sy=Math.max(.03,u);return {cell:true,sy,dy:-(1-sy)*g.size*.5,a:clamp(q*8)};}},
 // 看板の電球のように、字が交互に明るくなる
 {axis:'hold',key:'neonFlicker',name:'電光看板のように光る',desc:'字が看板の電球のように、順にずれながら明るく太くなったり戻ったりします。',added:'2026-10-19',words:['ネオン','電光看板','電球'],
  tags:['glitch','graphic','pop'],w:.9,plan:r=>({sp:1.1+r()*.6,ph:r()*TAU}),
  glyph(g,i,n,p,E,P){const on=Math.sin(E.lt*P.sp*TAU*.5+i*1.7+P.ph)>.15?1:0;return {bold:.06*on*p,a:.94+.06*on,dy:Math.sin(E.lt*P.sp*TAU+i)*E.size*.02*p};}},
 // 1字だけがその場に残り、ほかは両側へ離れて消える
 {axis:'exit',key:'soloStay',name:'ひと文字だけ残る',desc:'一字だけがその場に残り、ほかの字は左右へ離れて消え、最後にその字も消えます。',added:'2026-10-19',words:['一字だけ残る','残る'],
  tags:['emotional','graphic','calm','impact'],w:.9,outDur:D=>clamp(D*.3,.16,.42),plan:r=>({at:r(),spread:.15+r()*.1}),
  glyph(g,i,n,p,E,P){const keep=Math.min(n-1,Math.floor(P.at*n));if(i===keep)return {a:1-clamp((p-.72)/.28)};const q=local(p,i,n,P.spread),dir=i<keep?-1:1;return {dx:dir*inCubic(q)*E.size*(.9+.15*Math.abs(i-keep)),a:1-smooth(q)};}},
 // 縦につぶれて1本の線になり、横へ流れて消える
 {axis:'exit',key:'lineStream',name:'線にほどけて流れる',desc:'字が縦に細くつぶれて一本の線になり、横へ流れながら消えていきます。',added:'2026-10-19',words:['線になる','ほどける','流れて消える'],
  tags:['graphic','glitch','impact','calm'],w:.9,outDur:D=>clamp(D*.28,.15,.4),plan:r=>({spread:.2+r()*.1,dir:sign(r)}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,P.spread),squash=smooth(clamp(q/.5)),flow=inCubic(clamp((q-.35)/.65));return {sy:Math.max(.02,1-squash*.96),sx:1+squash*.25,dx:P.dir*flow*E.size*3.2,a:1-clamp((q-.7)/.3)};}},
 // 文字の下に弦を張って弾く
 {axis:'deco',key:'stringPluck',name:'弾かれる弦',desc:'文字の下に細い弦が張られ、弾かれて波になって震え、やがて静まります。',added:'2026-10-19',words:['弦','振動','波打つ線'],poster:.2,
  tags:['graphic','calm','emotional','pop'],w:1,plan:r=>({k:1+Math.floor(r()*3),y:.28+r()*.1}),
  draw(c,d,P){const y0=d.y1+d.size*P.y,x0=d.x0-d.size*.3,x1=d.x1+d.size*.3,len=x1-x0,u=outCubic(clamp(d.a*1.5)),steps=48,end=Math.max(2,Math.round(steps*u)),amp=d.size*.18*Math.exp(-d.lt*4)*Math.cos(d.lt*30);
   c.save();c.globalAlpha=d.z*.8;c.strokeStyle=d.accent;c.lineWidth=Math.max(1.2,d.size*.025);c.lineCap='round';c.beginPath();
   for(let i=0;i<=end;i++){const t=i/steps,x=x0+len*t,y=y0+Math.sin(t*Math.PI*P.k)*amp;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
   if(u>.98){c.fillStyle=d.fg;for(const x of [x0,x1]){c.beginPath();c.arc(x,y0,d.size*.035,0,TAU);c.fill();}}
   c.restore();}},
 // 細い縦のバーが、音の波形のように揺れる（音は使わない。時刻から決まった揺れ）
 {axis:'bg',key:'eqBars',name:'ゆれるイコライザ',desc:'細い縦のバーが、音の波形のように決まった揺れで高さを変えながら並びます。',added:'2026-10-19',words:['イコライザ','波形','音のバー'],
  tags:['graphic','pop','calm','glitch'],w:.9,plan:r=>({n:36+Math.floor(r()*17),seed:Math.floor(r()*1000),sp:.7+r()*.5,mid:.5+(r()-.5)*.1}),
  draw(c,e,P){const w=e.W/P.n,bw=Math.max(1,w*.46);for(let i=0;i<P.n;i++){const h1=hash(P.seed,i,1),h2=hash(P.seed,i,2),env=.35+.65*Math.sin((i+.5)/P.n*Math.PI),k=.5+.5*Math.sin(e.t*P.sp*(2.2+h1*2.6)+h2*TAU),hh=e.H*(.04+.3*env*k)*(.6+.4*h1);c.fillStyle=rgba(i%5?e.fg:e.accent,.13+.07*k);c.fillRect(i*w+(w-bw)/2,e.H*P.mid-hh/2,bw,hh);}}},
 // 画面の下から駆け上がって、ふっと止まる
 {axis:'cam',key:'riseSettle',name:'下から駆け上がる',desc:'文字全体が画面の下から勢いよく駆け上がり、ふっと止まります。',added:'2026-10-19',words:['駆け上がる','下から上へ','せり上がる'],
  tags:['impact','pop','emotional','graphic'],w:1,plan:r=>({amp:.7+r()*.3}),get:(e,P)=>({s:1.03,y:e.H*.028*P.amp*(1-outExpo(e.lt/.28))})},
 // ハートの形の窓が広がって、次の絵へ切り替わる
 {axis:'trans',key:'heartWindow',name:'ハートの窓で切り替わる',desc:'前の絵の上にハート形の窓が広がり、窓の向こうから次の絵へ切り替わります。',added:'2026-10-19',words:['ハート','ハートの窓'],
  tags:['pop','emotional','graphic'],w:.9,dur:.4,plan:()=>({}),
  draw(c,A,B,p,e){c.drawImage(A,0,0);const k=Math.hypot(e.W,e.H)/2/5*1.15*inCubic(p);if(k<.5)return;const cx=e.W*.5,cy=e.H*.5;c.save();c.beginPath();
   for(let i=0;i<=60;i++){const t=i/60*TAU,x=16*Math.sin(t)**3,y=13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t),X=cx+x*k,Y=cy-(y-2)*k;i?c.lineTo(X,Y):c.moveTo(X,Y);}c.closePath();c.clip();c.drawImage(B,0,0);c.restore();}},
 // 星を順に細い線で結ぶ
 {axis:'deco',key:'starLinks',name:'星をつなぐ線',desc:'文字の上に小さな星が順に現れ、細い線で結ばれて静かに消えます。',added:'2026-10-19',words:['星座','星をつなぐ','線でつなぐ'],
  tags:['graphic','calm','emotional'],w:.9,back:true,plan:r=>({n:4+Math.floor(r()*3),seed:Math.floor(r()*1000)}),
  draw(c,d,P){const pts=Array.from({length:P.n},(_,i)=>({x:d.x0-d.size*.16+(d.w+d.size*.32)*i/(P.n-1),y:d.y0-d.size*(.14+hash(P.seed,i,1)*.22)}));
   c.save();c.strokeStyle=d.accent;c.lineWidth=Math.max(1,d.size*.012);c.lineCap='round';
   for(let i=0;i<pts.length-1;i++){const u=clamp(d.a*(pts.length-1)-i);if(u<=0)continue;c.globalAlpha=d.z*.5;c.beginPath();c.moveTo(pts[i].x,pts[i].y);c.lineTo(lerp(pts[i].x,pts[i+1].x,u),lerp(pts[i].y,pts[i+1].y,u));c.stroke();}
   for(let i=0;i<pts.length;i++){const u=clamp(d.a*pts.length-i);if(u<=0)continue;const {x,y}=pts[i],r=d.size*.055,q=r*.42;c.globalAlpha=d.z*(.3+.35*u);c.beginPath();c.moveTo(x,y-r);c.lineTo(x+q,y-q);c.lineTo(x+r,y);c.lineTo(x+q,y+q);c.lineTo(x,y+r);c.lineTo(x-q,y+q);c.lineTo(x-r,y);c.lineTo(x-q,y-q);c.closePath();c.stroke();}
   c.restore();}},
 // やわらかなスポット光が画面を横切る
 {axis:'bg',key:'spotlightSweep',name:'横切るスポット光',desc:'やわらかな光の輪が画面を横切り、絵の色を残したまま通り過ぎます。',added:'2026-10-19',words:['スポットライト','光が横切る','サーチライト'],
  tags:['calm','emotional','graphic'],w:.9,plan:r=>({speed:.16+r()*.08,phase:r(),y:.32+r()*.36,r:.28+r()*.08}),
  draw(c,e,P){const u=fract(e.t*P.speed+P.phase),x=(u*1.8-.4)*e.W,y=e.H*P.y,r=Math.min(e.W,e.H)*P.r,g=c.createRadialGradient(x,y,0,x,y,r);
   g.addColorStop(0,rgba(e.accent,.24));g.addColorStop(.46,rgba(e.accent,.12));g.addColorStop(1,rgba(e.accent,0));c.save();c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}},
 // 4行3列のマスを、順に淡く点灯させる
 {axis:'bg',key:'gridPulse12',name:'順に光る十二マス',desc:'4行3列の小さな区画が順に淡く光り、次の区画へ移ります。',added:'2026-10-19',words:['マス目','グリッド','順に光る'],
  tags:['graphic','glitch','calm'],w:.9,plan:r=>({speed:.2+r()*.08,phase:r()}),
  draw(c,e,P){const cols=4,rows=3,cw=e.W/cols,ch=e.H/rows,t=fract(e.t*P.speed+P.phase)*cols*rows,step=Math.max(1,Math.min(e.W,e.H)*.003);
   for(let i=0;i<cols*rows;i++){const d=Math.abs(i-t),dist=Math.min(d,cols*rows-d),pulse=Math.max(0,1-dist),x=(i%cols)*cw,y=Math.floor(i/cols)*ch,gapX=cw*.1,gapY=ch*.1;
    c.fillStyle=rgba(i%3?e.fg:e.accent,.035+.24*pulse);c.fillRect(x+gapX,y+gapY,cw-gapX*2,ch-gapY*2);c.strokeStyle=rgba(e.fg,.13);c.lineWidth=step;c.strokeRect(x+gapX,y+gapY,cw-gapX*2,ch-gapY*2);}
  }},
 // ---- 2026-10-20（字の入れ替わり・渦・稲妻・図形反転）
 // 字が互いの場所を通り、元の並びへ戻る
 {axis:'enter',key:'wordShuffle',name:'字が入れ替わる',desc:'字が近くの字と場所を入れ替えるように動き、元の並びへ戻ります。',added:'2026-10-20',words:['シャッフル','入れ替わる','並び替え'],poster:.055,
  tags:['glitch','graphic','pop'],w:.8,fast:true,inDur:D=>clamp(D*.36,.2,.4),plan:r=>({dir:sign(r),spread:.9+r()*.08}),
  glyph(g,i,n,p,E,P){if(p<=0)return {hide:true};if(p>=1)return null;const q=clamp(p/P.spread),move=smooth(clamp(q/.28))*(1-smooth(clamp((q-.66)/.34))),dir=(i%2?1:-1)*P.dir;return {dx:dir*g.w*2.5*move,dy:Math.sin(q*TAU*1.5+i*.8)*g.size*.15*move,rot:dir*13*Math.sin(q*Math.PI)*move};}},
 // 行の中心へ向かって、渦を描きながら消える
 {axis:'exit',key:'spiralGather',name:'渦へ巻き込まれる',desc:'字が行の中心へ渦を描いて寄り、小さくなりながら消えていきます。',added:'2026-10-20',words:['渦','巻き込まれる','スパイラル'],
  tags:['impact','graphic','emotional'],w:.8,outDur:D=>clamp(D*.28,.15,.38),plan:r=>({dir:sign(r),turns:.55+r()*.35}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,.18),u=inCubic(q),cx=(E.bbox.x0+E.bbox.x1)/2,cy=(E.bbox.y0+E.bbox.y1)/2,dx=g.cx-cx,dy=g.cy-cy,a=P.dir*TAU*P.turns*u,co=Math.cos(a),si=Math.sin(a),s=Math.max(.01,1-u*.92);return {dx:u*(dx*co-dy*si-dx),dy:u*(dx*si+dy*co-dy),sx:s,sy:s,a:1-smooth(q)};}},
 // 震える手描きの矢印を数コマごとに描き替える
 {axis:'deco',key:'jitterArrow',name:'震える手描き矢印',desc:'文字の下に手描きの矢印が現れ、数コマごとに線を描き替えて震えます。',added:'2026-10-20',words:['矢印','手描き','震える線'],poster:.32,
  tags:['graphic','glitch','pop'],w:.8,back:true,plan:r=>({dir:sign(r),seed:Math.floor(r()*1000)}),
  draw(c,d,P){const f=Math.floor(d.lt*12),h=(j,k)=>(hash(P.seed,f,j,k)-.5)*d.size*.035,x0=d.cx-P.dir*d.w*.22,x1=d.cx+P.dir*d.w*.22,y=d.y1+d.size*.13+h(0,0),tip=x1+h(1,0);c.save();c.globalAlpha=d.z*.48;c.strokeStyle=d.accent;c.lineWidth=Math.max(1,d.size*.025);c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(x0,y+h(2,1));c.lineTo(d.cx+h(2,2),y+h(2,3));c.lineTo(tip,y+h(2,4));c.moveTo(tip-P.dir*d.size*.16,y-d.size*.1+h(3,1));c.lineTo(tip,y+h(3,2));c.lineTo(tip-P.dir*d.size*.16,y+d.size*.1+h(3,3));c.stroke();c.restore();}},
 // 稲妻が上から字の近くへ落ちる
 {axis:'deco',key:'lightningDrop',name:'字へ落ちる稲妻',desc:'細い稲妻が上から字の近くへ落ち、短く光って消えます。',added:'2026-10-20',words:['稲妻','雷','いなずま'],poster:.18,
  tags:['impact','graphic','glitch'],w:.8,plan:r=>({x:.3+r()*.4,seed:Math.floor(r()*1000)}),
  draw(c,d,P){const q=outCubic(clamp(d.a*1.8)),x=d.x0+d.w*P.x,y0=d.y0-d.size*.72,y1=d.y0+d.size*.06,steps=7,pts=[];for(let i=0;i<=steps;i++)pts.push([x+(i===0||i===steps?0:(hash(P.seed,i,1)-.5)*d.size*.18),lerp(y0,y1,i/steps)]);c.save();c.globalAlpha=d.z*.58*q;c.strokeStyle=d.accent;c.lineWidth=Math.max(1,d.size*.022);c.lineJoin='miter';c.beginPath();pts.forEach(([xx,yy],i)=>i?c.lineTo(xx,yy):c.moveTo(xx,yy));c.stroke();c.restore();}},
 // 黒い球を、細い光の軌道が巡る
 {axis:'bg',key:'orbSwirl',name:'球を巡る光の渦',desc:'半透明の黒い球を細い光の軌道が巡り、下の絵を残したまま回ります。',added:'2026-10-20',words:['光の渦','球','軌道'],poster:.42,
  tags:['emotional','graphic','calm'],w:.8,plan:r=>({x:.5+(r()-.5)*.24,y:.5+(r()-.5)*.2,r:.18+r()*.04,phase:r()*TAU,dir:sign(r)}),
  // 球と軌道は作業用のキャンバスに描いてから、まとめて半透明で重ねる（作業用のキャンバスが無い時は、1つずつ同じ薄さで描く。下の絵を塗りつぶさない）
  draw(c,e,P){const S=Math.min(e.W,e.H),got=e.tmp?.('orbSwirl',e.W,e.H),sheet=got&&got!==c.canvas?got:null,xctx=sheet?sheet.getContext('2d'):c;if(sheet)xctx.clearRect(0,0,e.W,e.H);const x=e.W*P.x,y=e.H*P.y,r=S*P.r,g=xctx.createRadialGradient(x-r*.35,y-r*.4,r*.06,x,y,r);g.addColorStop(0,'rgba(0,0,0,.42)');g.addColorStop(.72,'rgba(0,0,0,.28)');g.addColorStop(1,'rgba(0,0,0,0)');xctx.save();if(!sheet)xctx.globalAlpha=.42;xctx.fillStyle=g;xctx.beginPath();xctx.arc(x,y,r,0,TAU);xctx.fill();xctx.strokeStyle=rgba(e.fg,.28);xctx.lineWidth=Math.max(1,S*.003);xctx.beginPath();xctx.ellipse(x-r*.03,y,r*.72,r*.7,-.2,.7,4.65);xctx.stroke();xctx.fillStyle=rgba(e.fg,.34);xctx.beginPath();xctx.ellipse(x-r*.28,y-r*.32,r*.12,r*.045,-.45,0,TAU);xctx.fill();xctx.translate(x,y);xctx.rotate(e.t*.45*P.dir+P.phase);xctx.strokeStyle=rgba(e.accent,.27);xctx.lineWidth=Math.max(1,S*.004);xctx.beginPath();xctx.ellipse(0,0,r*1.35,r*.42,.12,0,TAU);xctx.stroke();xctx.rotate(-e.t*.8*P.dir-P.phase*1.7);xctx.strokeStyle=rgba(e.fg,.18);xctx.beginPath();xctx.ellipse(0,0,r*1.16,r*.3,-.24,0,TAU);xctx.stroke();xctx.restore();if(sheet){c.save();c.globalAlpha=.42;c.drawImage(sheet,0,0);c.restore();}}},
 // 星形かハート形の輪の内側だけ色を反転する
 {axis:'fx',key:'shapeInvert',name:'星窓の色反転',desc:'星形かハート形の窓が広がり、その輪の中だけ画面の色を反転します。',added:'2026-10-20',words:['色反転','反転','ネガ'],
  tags:['impact','graphic','glitch'],w:1.4,dur:.42,plan:r=>({shape:r()<.5?'star':'heart',x:.5+(r()-.5)*.18,y:.5+(r()-.5)*.14,rot:r()*TAU}),
  apply(c,e,P,k){const u=1-clamp(k),R=Math.hypot(e.W,e.H)*.8,ro=R*outCubic(clamp(u*1.22)),ri=R*outCubic(clamp((u-.3)/.7));if(ro<=ri+.5)return;const cx=e.W*P.x,cy=e.H*P.y,path=(r)=>{c.beginPath();if(P.shape==='star'){for(let i=0;i<10;i++){const a=P.rot+i*TAU/10,rr=r*(i%2?.46:1),x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();}else{for(let i=0;i<=60;i++){const t=i/60*TAU,x=16*Math.sin(t)**3,y=13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t),X=cx+x*r/18,Y=cy-(y-2)*r/18;i?c.lineTo(X,Y):c.moveTo(X,Y);}c.closePath();}};const snap=e.opaque===false?e.tmp(0,e.W,e.H):null;if(snap){const x=snap.getContext('2d');x.globalCompositeOperation='copy';x.drawImage(c.canvas,0,0);x.globalCompositeOperation='source-over';}c.save();path(ro);path(ri);c.clip('evenodd');c.globalCompositeOperation='difference';c.fillStyle='#fff';c.fillRect(0,0,e.W,e.H);if(snap){c.globalCompositeOperation='destination-in';c.drawImage(snap,0,0);}c.restore();}},
 // ---- 2026-10-20 幾何学模様の背景
 {axis:'bg',key:'honeyWave',name:'波打つ蜂の巣',desc:'六角形の線が蜂の巣のように並び、波が渡るように濃淡がゆれます。',added:'2026-10-20',words:['六角形','蜂の巣','ハニカム'],
  tags:['graphic','calm','pop'],w:1,plan:r=>({R:.05+r()*.03,sp:.6+r()*.5,ph:r()*TAU}),
  draw(c,e,P){const S=Math.min(e.W,e.H),R=S*P.R,dx=R*1.7320508,dy=R*1.5;c.lineWidth=Math.max(1,S*.0025);for(let j=-1;j*dy<e.H+R*2;j++)for(let i=-1;i*dx<e.W+dx;i++){const cx=i*dx+(j&1?dx/2:0),cy=j*dy,k=.5+.5*Math.sin((cx+cy)/S*5-e.t*P.sp*3+P.ph);c.strokeStyle=rgba((i+j)%7?e.fg:e.accent,.07+.16*k);c.beginPath();for(let q=0;q<6;q++){const a=TAU*(q/6+1/12),x=cx+R*.94*Math.cos(a),y=cy+R*.94*Math.sin(a);q?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.stroke();}}},
 {axis:'bg',key:'triPulse',name:'明滅する三角タイル',desc:'三角形のタイルが敷き詰められ、ところどころが順に淡く光ります。',added:'2026-10-20',words:['三角形','トライアングル','タイル'],
  tags:['graphic','pop','glitch'],w:1,plan:r=>({s:.09+r()*.05,seed:Math.floor(r()*1000),sp:.8+r()*.8}),
  draw(c,e,P){const S=Math.min(e.W,e.H),a=S*P.s,h=a*.8660254,rows=Math.ceil(e.H/h)+1,cols=Math.ceil(e.W/a)+2;for(let j=0;j<rows;j++)for(let i=-1;i<cols;i++)for(let u=0;u<2;u++){const x=i*a+(j&1?a/2:0),y=j*h,hs=hash(P.seed,i+j*57,u),k=Math.max(0,Math.sin(e.t*P.sp*(1.2+hs*1.6)+hs*TAU));if(k<.25)continue;c.fillStyle=rgba(hs>.85?e.accent:e.fg,.04+.14*k);c.beginPath();if(u){c.moveTo(x,y);c.lineTo(x+a,y);c.lineTo(x+a/2,y+h);}else{c.moveTo(x+a/2,y+h);c.lineTo(x+a*1.5,y+h);c.lineTo(x+a,y);}c.closePath();c.fill();}}},
 {axis:'bg',key:'ringMoire',name:'重なる円のモアレ',desc:'二組の同心円が逆向きにゆっくり動いて、重なりに縞模様が生まれます。',added:'2026-10-20',words:['モアレ','同心円','縞模様'],
  tags:['graphic','calm','emotional'],w:1,plan:r=>({gap:.022+r()*.01,ax:.2+r()*.15,sp:.4+r()*.4,ph:r()*TAU}),
  draw(c,e,P){const S=Math.min(e.W,e.H),g=S*P.gap,mx=Math.hypot(e.W,e.H);c.lineWidth=Math.max(1,S*.002);for(let s=0;s<2;s++){const d=(s?1:-1)*S*P.ax*.5*Math.sin(e.t*P.sp+P.ph),cx=e.W/2+d,cy=e.H/2+(s?1:-1)*S*.05*Math.cos(e.t*P.sp*.7+P.ph);c.strokeStyle=rgba(s?e.accent:e.fg,.2);c.beginPath();for(let r=g;r<mx;r+=g){c.moveTo(cx+r,cy);c.arc(cx,cy,r,0,TAU);}c.stroke();}}},
 {axis:'bg',key:'seigaiha',name:'青海波の模様',desc:'半円のうろこを重ねた和柄が、波のきらめきのように淡く明るさを変えます。',added:'2026-10-20',words:['青海波','和柄','うろこ'],
  tags:['calm','graphic','emotional'],w:1,plan:r=>({R:.07+r()*.03,sp:.5+r()*.4,ph:r()*TAU}),
  draw(c,e,P){const S=Math.min(e.W,e.H),R=S*P.R,dy=R/2;c.lineWidth=Math.max(1,S*.002);for(let j=Math.ceil(e.H/dy)+1;j>=-1;j--)for(let i=-1;i*R*2<e.W+R*2;i++){const cx=i*R*2+(j&1?R:0),cy=j*dy,k=.5+.5*Math.sin(e.t*P.sp*2+(i+j*.7)*.9+P.ph);for(let n=3;n>=1;n--){c.strokeStyle=rgba(n===3?e.accent:e.fg,(.07+.12*k)*(n===3?.8:1));c.beginPath();c.arc(cx,cy,R*n/3,Math.PI,0);c.stroke();}}}},
 {axis:'bg',key:'sunflowerSpiral',name:'ひまわりの螺旋',desc:'小さな点が黄金角でうずを巻いて並び、ゆっくり回りながら呼吸します。',added:'2026-10-20',words:['螺旋','ひまわり','黄金角'],
  tags:['graphic','emotional','calm'],w:1,plan:r=>({n:260+Math.floor(r()*120),sp:.12+r()*.1,dir:r()<.5?-1:1}),
  draw(c,e,P){const S=Math.min(e.W,e.H),mx=Math.hypot(e.W,e.H)/2,cx=e.W/2,cy=e.H/2,k0=mx/Math.sqrt(P.n);for(let i=1;i<P.n;i++){const a=i*2.3999632+e.t*P.sp*P.dir,r=k0*Math.sqrt(i),sz=S*.004+S*.012*(i/P.n)*(.75+.25*Math.sin(e.t*2+i*.1));c.fillStyle=rgba(i%13?e.fg:e.accent,.1+.14*(i/P.n));c.beginPath();c.arc(cx+r*Math.cos(a),cy+r*Math.sin(a),sz,0,TAU);c.fill();}}},
 {axis:'bg',key:'diamondLattice',name:'流れるひし形格子',desc:'斜めの細い線が交差してひし形の格子をつくり、ゆるやかに流れていきます。',added:'2026-10-20',words:['ひし形','格子','ダイヤ柄'],
  tags:['graphic','calm','pop'],w:1,plan:r=>({gap:.07+r()*.04,sp:.03+r()*.03,ang:.8+r()*.4}),
  draw(c,e,P){const S=Math.min(e.W,e.H),g=S*P.gap,mx=Math.hypot(e.W,e.H);c.lineWidth=Math.max(1,S*.002);for(let s=0;s<2;s++){const a=s?P.ang:-P.ang,ca=Math.cos(a),sa=Math.sin(a),off=(e.t*S*P.sp*(s?1:-1))%g;c.strokeStyle=rgba(s?e.accent:e.fg,s?.16:.2);c.beginPath();for(let d=-mx;d<mx;d+=g){const o=d+off,px=e.W/2-sa*o,py=e.H/2+ca*o;c.moveTo(px-ca*mx,py-sa*mx);c.lineTo(px+ca*mx,py+sa*mx);}c.stroke();}}},
 // ---- 2026-10-21（幾何模様の背景を中心に、線の構造・描き替え・光柱を追加）
 {axis:'bg',key:'orthogonalWeave',name:'交差する織り目',desc:'縦横の細線が交互にくぐり、織物のような格子をゆっくり組み替えます。',added:'2026-10-21',words:['織り目','格子','チェック'],
  tags:['graphic','calm','glitch'],w:1,plan:r=>({gap:.11+r()*.035,phase:r()*TAU,dir:sign(r)}),
  draw(c,e,P){const S=Math.min(e.W,e.H),g=S*P.gap,off=((e.t*S*.012*P.dir)%g+g)%g,cols=Math.ceil(e.W/g)+3,rows=Math.ceil(e.H/g)+3;c.lineWidth=Math.max(1,S*.0022);c.strokeStyle=rgba(e.fg,.17);c.beginPath();
   for(let j=-1;j<rows;j++){const y=j*g+off;for(let i=-1;i<cols;i++){const x=i*g+off,k=(i+j)&1,skip=g*.16;c.moveTo(x+(k?skip:0),y);c.lineTo(x+g-(k?0:skip),y);}}c.stroke();
   c.strokeStyle=rgba(e.accent,.12);c.beginPath();for(let i=-1;i<cols;i++){const x=i*g+off;for(let j=-1;j<rows;j++){const y=j*g+off,k=(i+j)&1,skip=g*.16;c.moveTo(x,y+(k?skip:0));c.lineTo(x,y+g-(k?0:skip));}}c.stroke();
   c.strokeStyle=rgba(e.fg,.19);for(let j=-1;j<rows;j++)for(let i=-1;i<cols;i++){const x=i*g+off,y=j*g+off,skip=g*.16;c.beginPath();if(((i+j)&1)===0){c.moveTo(x-skip,y);c.quadraticCurveTo(x,y-skip*1.4,x+skip,y);}else{c.moveTo(x,y-skip);c.quadraticCurveTo(x+skip*1.4,y,x,y+skip);}c.stroke();}}},
 {axis:'bg',key:'stepFrames',name:'広がる段枠',desc:'四角い段枠が中心から順に広がり、線の間隔を保って流れていきます。',added:'2026-10-21',words:['四角い枠','段枠','トンネル'],
  tags:['graphic','calm','impact'],w:1,plan:r=>({n:7+Math.floor(r()*3),speed:.22+r()*.12,phase:r()}),
  draw(c,e,P){const S=Math.min(e.W,e.H),mx=Math.hypot(e.W,e.H)*.55;c.save();c.lineWidth=Math.max(1,S*.003);for(let i=0;i<P.n;i++){const q=fract(e.t*P.speed+P.phase+i/P.n),r=mx*(.08+.92*q),cut=r*.22,x=e.W/2,y=e.H/2;c.strokeStyle=rgba(i%3?e.fg:e.accent,.18+.08*(1-q));c.beginPath();c.moveTo(x-r+cut,y-r);c.lineTo(x+r-cut,y-r);c.moveTo(x+r,y-r+cut);c.lineTo(x+r,y+r-cut);c.moveTo(x+r-cut,y+r);c.lineTo(x-r+cut,y+r);c.moveTo(x-r,y+r-cut);c.lineTo(x-r,y-r+cut);c.stroke();}c.restore();}},
 {axis:'bg',key:'chevronPassage',name:'奥へ走る山形',desc:'山形の輪郭が重なって奥へ進み、遠近のリズムをゆっくり描きます。',added:'2026-10-21',words:['山形','シェブロン','奥へ進む'],
  tags:['graphic','impact','calm'],w:1,plan:r=>({gap:.09+r()*.04,phase:r()}),
  draw(c,e,P){const S=Math.min(e.W,e.H),g=S*P.gap,shift=fract(e.t*.11+P.phase)*g;c.save();c.lineWidth=Math.max(1,S*.0025);for(let j=-1;j<Math.ceil(e.H/g)+2;j++){const y=j*g+shift,depth=fract(e.t*.1+P.phase+j*.09),w=e.W*(.24+.72*depth),x=e.W/2;c.strokeStyle=rgba(j%4?e.fg:e.accent,.11+.07*depth);c.beginPath();c.moveTo(x-w,y-g*.48);c.lineTo(x,y+g*.48);c.lineTo(x+w,y-g*.48);c.stroke();}c.restore();}},
 {axis:'bg',key:'handStripes',name:'描き替わる幾何縞',desc:'斜めの手描き線が数コマごとに描き替わり、細かな揺れをつくります。',added:'2026-10-21',words:['手描き線','斜線','ゆれる線'],poster:.3,
  tags:['graphic','glitch','calm'],w:1,plan:r=>({n:15+Math.floor(r()*8),seed:Math.floor(r()*1000),angle:.48+r()*.18}),
  draw(c,e,P){const S=Math.min(e.W,e.H),frame=Math.floor(e.t*7),ca=Math.cos(P.angle),sa=Math.sin(P.angle),span=Math.hypot(e.W,e.H);c.save();c.lineWidth=Math.max(1,S*.0025);for(let j=-P.n;j<=P.n;j++){const d=(j/P.n)*span*.65,wig=k=>(hash(P.seed,frame,j,k)-.5)*S*.05,x=e.W/2-sa*d,y=e.H/2+ca*d;c.strokeStyle=rgba(j%5?e.fg:e.accent,.12+.05*hash(P.seed,j,1));c.beginPath();for(let k=0;k<=12;k++){const t=k/12*span*1.25,px=x+ca*(t-span*.6)+wig(k),py=y+sa*(t-span*.6)+wig(k+20);k?c.lineTo(px,py):c.moveTo(px,py);}c.stroke();}c.restore();}},
 {axis:'bg',key:'lightColumns',name:'泡立つ光柱',desc:'透ける光の柱の間を、小さな泡がゆっくり昇っていきます。',added:'2026-10-21',words:['光の柱','光柱','泡'],poster:.5,
  tags:['calm','emotional','graphic'],w:1,plan:r=>({n:4+Math.floor(r()*3),seed:Math.floor(r()*1000),speed:.055+r()*.035}),
  draw(c,e,P){const S=Math.min(e.W,e.H),seed=P.seed;c.save();for(let j=0;j<P.n;j++){const x=e.W*(j+.5)/P.n+Math.sin(e.t*.35+j*1.7)*S*.035,w=S*(.035+.025*hash(seed,j,1)),g=c.createLinearGradient(x-w,0,x+w,0);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,rgba(j%3?e.accent:e.fg,.13));g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(x-w,0,w*2,e.H);}
   c.lineWidth=Math.max(1,S*.0025);for(let j=0;j<13;j++){const h1=hash(seed,j,1),h2=hash(seed,j,2),r=S*(.012+.018*h2),y=(1.1-fract(h1+e.t*P.speed*(.6+h2))*1.25)*e.H,x=e.W*(.08+.84*hash(seed,j,3))+Math.sin(e.t*.8+j)*S*.018;c.strokeStyle=rgba(j%3?e.fg:e.accent,.18);c.beginPath();c.arc(x,y,r,0,TAU);c.stroke();c.fillStyle=rgba(e.fg,.1);c.beginPath();c.arc(x-r*.3,y-r*.3,r*.18,0,TAU);c.fill();}c.restore();}},
 {axis:'deco',key:'measureDots',name:'走る測点',desc:'文字の外側に小さな四角い点が並び、端から順に静かに現れます。',added:'2026-10-21',words:['点線','測点','並ぶ点'],
  tags:['graphic','calm','pop'],w:1,back:true,plan:r=>({n:5+Math.floor(r()*3)}),
  draw(c,d,P){const count=P.n*2,limit=clamp(d.a*1.5)*count,S=d.size,step=Math.max(S*.18,d.w/(P.n+1));c.save();c.lineWidth=Math.max(1,S*.018);for(let j=0;j<count;j++){const u=clamp(limit-j),x=d.cx+(j<P.n?-1:1)*(d.w*.5+S*.22+(j%P.n)*step*.08),y=d.cy+(j%P.n-(P.n-1)/2)*step*.48,r=S*(.035+.012*(j%2));if(u<=0)continue;c.globalAlpha=d.z*.45*u;c.strokeStyle=j%3?d.accent:d.fg;c.strokeRect(x-r,y-r,2*r,2*r);}c.restore();}},
 {axis:'cam',key:'pendulumRail',name:'左右に往復する',desc:'文字の層が浅い弧を描いて左右へ往復し、中央で向きを切り替えます。',added:'2026-10-21',words:['左右に往復','振り子カメラ','往復'],
  tags:['calm','graphic','emotional'],w:1,plan:r=>({phase:r()*TAU,cycles:1.5+r()*.5}),
  get(e,P){const a=e.p*P.cycles*TAU+P.phase,x=Math.sin(a),y=(1-Math.cos(a))*.5-.5;return {s:1.04,x:x*e.W*.023,y:y*e.H*.012,rot:x*.02};}},
 {axis:'trans',key:'checkerMosaic',name:'市松の小窓',desc:'市松模様の小窓が順に開き、次の絵へすき間なく切り替わります。',added:'2026-10-21',words:['市松','チェッカー','小窓'],
  tags:['graphic','impact','pop'],w:1,dur:.42,plan:()=>({cols:10,rows:6}),
  draw(c,A,B,p,e,P){c.drawImage(A,0,0,e.W,e.H);const u=smooth(p),cw=e.W/P.cols,ch=e.H/P.rows;c.save();for(let y=0;y<P.rows;y++)for(let x=0;x<P.cols;x++){const order=((x+y)&1)*.16+((x+y)/(P.cols+P.rows))*.38,alpha=clamp((u-order)/.28);if(alpha<=0)continue;c.globalAlpha=alpha;c.drawImage(B,x*e.W/P.cols,y*e.H/P.rows,cw+1,ch+1,x*cw,y*ch,cw+1,ch+1);}c.restore();}},
 // ---- 2026-10-22
 {axis:'enter',key:'looseType',name:'間をずらして登場',desc:'文字が少しずつ違う間をあけながら順に現れます。',added:'2026-10-22',words:['不規則','まばらに','間をあけて'],
  tags:['graphic','calm','glitch'],w:1,inDur:D=>clamp(D*.44,.25,.5),plan:r=>({phase:r()*TAU,jitter:.18+r()*.12}),
  glyph(g,i,n,p,E,P){const base=n>1?i/(n-1):0,wave=Math.sin(i*2.399+P.phase)-Math.sin(P.phase),at=.08+.82*clamp(base+P.jitter*wave/Math.max(1,n-1)),q=clamp((p-at)/.09);return q<=0?{hide:true}:{a:clamp(q*3)};}},
 {axis:'hold',key:'centerTintPulse',name:'一字に色が差す',desc:'行の中央の一字だけがアクセント色に染まり、静かに明滅します。',added:'2026-10-22',words:['一字が光る','色が差す','中央が明滅'],
  tags:['graphic','calm','emotional'],w:.9,plan:r=>({rate:.42+r()*.22,phase:r()*TAU}),
  glyph(g,i,n,p,E,P){if(i!==Math.floor((n-1)/2))return null;const u=.5-.5*Math.cos(E.lt*P.rate*TAU+P.phase);return u>.06?{paint:{u,color:'accent'}}:null;}},
 {axis:'exit',key:'lineUnzip',name:'両端へほどける',desc:'行の中央から字が左右へほどけて、端へ向かって薄く消えます。',added:'2026-10-22',words:['左右へほどける','中央から消える','端へ散る'],
  tags:['graphic','impact','glitch'],w:1,outDur:D=>clamp(D*.3,.18,.4),plan:r=>({distance:.7+r()*.45}),
  glyph(g,i,n,p,E,P){const q=local(p,i,n,.42),mid=(E.bbox.x0+E.bbox.x1)/2,side=g.cx<mid?-1:1,edge=Math.abs(g.cx-mid)/Math.max(1,(E.bbox.x1-E.bbox.x0)*.5);return {dx:side*E.size*P.distance*(.16+.5*edge)*inCubic(q),dy:Math.sin(i*1.7)*E.size*.08*q,rot:side*4*q,a:1-smooth(q)};}},
 {axis:'deco',key:'dialTicks',name:'二重の目盛り輪',desc:'字の外側に細い二重の輪と目盛りが回り、計器のような気配を添えます。',added:'2026-10-22',words:['目盛り輪','二重の輪','計器の輪'],
  tags:['graphic','calm','emotional'],w:1,back:true,plan:r=>({count:32,phase:r()*TAU,dir:sign(r)}),
  draw(c,d,P){const rx=Math.max(d.w*.53,d.h*.78),ry=d.h*.72,turn=d.lt*.24*P.dir+P.phase;c.save();c.globalAlpha*=d.a*d.z*.34;c.lineWidth=Math.max(1,d.size*.012);c.strokeStyle=d.accent;c.beginPath();c.ellipse(d.cx,d.cy,rx,ry,0,.12,TAU*.84);c.stroke();c.globalAlpha*=.72;c.beginPath();c.ellipse(d.cx,d.cy,rx+d.size*.12,ry+d.size*.12,0,Math.PI*.98,Math.PI*1.98);c.stroke();for(let i=0;i<P.count;i++){const a=turn+i/P.count*TAU,major=i%4===0,r0=1,r1=major?1.14:1.07;c.globalAlpha=d.a*d.z*(major?.32:.19);c.beginPath();c.moveTo(d.cx+Math.cos(a)*rx*r0,d.cy+Math.sin(a)*ry*r0);c.lineTo(d.cx+Math.cos(a)*rx*r1,d.cy+Math.sin(a)*ry*r1);c.stroke();}c.restore();}},
 {axis:'cam',key:'verticalSway',name:'縦にゆれる視点',desc:'画面全体が縦に小さくゆれ、ゆっくり元の高さへ戻ります。',added:'2026-10-22',words:['縦にゆれる','視点が上下','小さく往復'],
  tags:['calm','emotional','graphic'],w:1,plan:r=>({phase:r()*TAU,speed:.55+r()*.3}),
  get(e,P){const a=e.p*TAU*P.speed+P.phase;return {s:1.025,x:Math.sin(a*.5)*e.W*.004,y:Math.sin(a)*e.H*.018,rot:0};}},
 {axis:'world',key:'twoLineRead',name:'二段に分けて読む',desc:'言葉を上段と下段へ分け、細い枠で順番に読み進められるようにします。',added:'2026-10-22',words:['二段','二行で','上下に分ける'],
  tags:['graphic','calm','emotional'],w:.9,fits:n=>n<=36,plan:r=>({phase:r()*TAU}),
  frame(P,{W,H,D,exitOK}){return {box:{cx:W/2,cy:H/2,w:W*.84,h:H*.72},mode:'wrap',maxWidth:.96,delay:clamp(D*.06,0,.08)};},
  arrange(item){const F=item.worldFrame,gs=item.glyphs,n=gs.length;if(!n)return;const preferred=new Set(['、','。','，','．','！','？','は','が','を','に','へ','で','と','も','の','や']),target=Math.max(1,Math.min(n-1,Math.round(n*.4))),choices=Array.from({length:Math.max(0,n-1)},(_,i)=>i+1),split=choices.reduce((best,i)=>{const score=Math.abs(i-target)-(preferred.has(gs[i-1].ch) ? 1 : 0);return score<best.score?{i,score}:best;},{i:target,score:Infinity}).i,rows=[gs.slice(0,split),gs.slice(split)].filter(row=>row.length),shift=rows.length>1?Math.min(item.size*.9,F.box.h*.24):0;item.alternation=[];
   rows.forEach((row,ri)=>{const w=row.reduce((a,g)=>a+g.w,0),scale=Math.min(1,(F.box.w*.88)/Math.max(1,w)),actual=w*scale;let x=(F.box.w-actual)/2;const y=F.box.h/2+(ri?1:-1)*shift;for(const g of row){const gw=g.w*scale;g.cx=x+gw/2;g.cy=y;g.w=gw;g.size*=scale;g.cell=null;g.rot0=0;x+=gw;}item.alternation.push({y,w:actual});});
   item.bbox={x0:Math.min(...gs.map(g=>g.cx-g.w/2)),x1:Math.max(...gs.map(g=>g.cx+g.w/2)),y0:Math.min(...gs.map(g=>g.cy-g.size/2)),y1:Math.max(...gs.map(g=>g.cy+g.size/2))};},
  xform(c,e,P,F){const s=1+.008*Math.sin(e.lt*TAU*.55+P.phase);c.translate(F.box.cx,F.box.cy);c.scale(s,s);c.translate(-F.box.cx,-F.box.cy);},
  back(c,e,P,F,item){const rows=item.alternation||[],mid=F.box.cy;c.save();c.lineWidth=Math.max(1,e.H*.003);rows.forEach((r,i)=>{const w=Math.min(F.box.w*.92,r.w+item.size*.56),x=F.box.cx-w/2,y=mid+(r.y-F.box.h/2)-item.size*.56;c.strokeStyle=rgba(i?e.accent:e.fg,.22);c.strokeRect(x,y,w,item.size*1.12);c.fillStyle=rgba(e.accent,.58);const mark=item.size*.22,mx=x+fract(e.lt*.31+P.phase+i*.5)*(w-mark);c.fillRect(mx,y,mark,Math.max(2,item.size*.045));});c.restore();}},
 // ---- 2026-10-22 画面効果
 {axis:'fx',key:'rgbSplit',name:'色ずれ',desc:'カットの頭で赤と青緑の像が左右にずれ、すぐに重なって元の色へ戻ります。',added:'2026-10-22',words:['色ずれ','RGBずれ','色収差'],
  tags:['glitch','impact','pop'],w:1.2,dur:.32,poster:.08,plan:r=>({d:.012+r()*.014,dy:(r()-.5)*.006,dir:r()<.5?-1:1}),
  apply(c,e,P,k){if(k<=.001||!e.tmp)return;const W=e.W,H=e.H,t=e.tmp('rgbSrc',W,H),x=t.getContext('2d');x.globalCompositeOperation='copy';x.drawImage(c.canvas,0,0);x.globalCompositeOperation='source-over';
   const tint=(n,col)=>{const u=e.tmp(n,W,H),g=u.getContext('2d');g.globalCompositeOperation='copy';g.drawImage(t,0,0);g.globalCompositeOperation='multiply';g.fillStyle=col;g.fillRect(0,0,W,H);g.globalCompositeOperation='destination-in';g.drawImage(t,0,0);g.globalCompositeOperation='source-over';return u;};
   const R=tint('rgbR','#ff0000'),B=tint('rgbC','#00ffff'),d=Math.min(W,H)*P.d*k*P.dir,dy=Math.min(W,H)*P.dy*k;
   c.save();c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);c.globalCompositeOperation='lighter';c.drawImage(R,-d,-dy);c.drawImage(B,d,dy);c.restore();}},
 {axis:'fx',key:'sliceShift',name:'横にずれる帯',desc:'カットの頭で絵が横長の帯に切れ、帯ごとに左右へずれてから元の位置へ戻ります。',added:'2026-10-22',words:['帯ずれ','グリッチ','横ずれ'],
  tags:['glitch','impact'],w:1.2,dur:.36,poster:.1,plan:r=>({n:7+Math.floor(r()*7),seed:Math.floor(r()*1000),amp:.05+r()*.05}),
  apply(c,e,P,k){if(k<=.001||!e.tmp)return;const W=e.W,H=e.H,t=e.tmp('sliceSrc',W,H),x=t.getContext('2d');x.globalCompositeOperation='copy';x.drawImage(c.canvas,0,0);x.globalCompositeOperation='source-over';
   const step=Math.floor(e.t*18);c.save();c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);let y=0;for(let i=0;i<P.n;i++){const h=H*(.5+hash(P.seed,i,1))/P.n*(P.n/(P.n*.5+.25*P.n+.0001))*.667,hh=i===P.n-1?H-y:Math.min(h,H-y);if(hh<=0)break;const off=(hash(P.seed+step,i,2)-.5)*2*W*P.amp*k;c.drawImage(t,0,y,W,hh,off,y,W,hh);y+=hh;}if(y<H)c.drawImage(t,0,y,W,H-y,0,y,W,H-y);c.restore();}},
 {axis:'fx',key:'zoomGhost',name:'ズームの残像',desc:'カットの頭で絵の拡大した残像が重なって広がり、すっと元の大きさへ収まります。',added:'2026-10-22',words:['ズームブラー','残像','ズーム'],
  tags:['impact','pop','graphic'],w:1.1,dur:.34,poster:.1,plan:r=>({s:.07+r()*.06,n:4}),
  apply(c,e,P,k){if(k<=.001||!e.tmp)return;const W=e.W,H=e.H,t=e.tmp('zoomSrc',W,H),x=t.getContext('2d');x.globalCompositeOperation='copy';x.drawImage(c.canvas,0,0);x.globalCompositeOperation='source-over';
   c.save();c.setTransform(1,0,0,1,0,0);for(let i=P.n;i>=1;i--){const s=1+P.s*k*i/P.n;c.globalAlpha=.22*k;c.drawImage(t,W*(1-s)/2,H*(1-s)/2,W*s,H*s);}c.restore();}},
 {axis:'fx',key:'scanBeam',name:'走る光の帯',desc:'カットの頭で、細い光の帯が画面を上から下へ走り、通ったあとに淡い明るさが残ります。',added:'2026-10-22',words:['光の帯','スキャン','走査線'],
  tags:['graphic','calm','impact'],w:1,dur:.45,poster:.15,plan:r=>({w:.05+r()*.04,up:r()<.3}),
  apply(c,e,P,k){if(k<=.001)return;const W=e.W,H=e.H,u=1-clamp(k),bw=H*P.w,pos=-bw+(P.up?1-outCubic(u):outCubic(u))*(H+bw*2),a=.16*clamp(k*1.6);c.save();c.setTransform(1,0,0,1,0,0);const g=c.createLinearGradient(0,pos-bw,0,pos+bw);g.addColorStop(0,rgba(e.fg,0));g.addColorStop(.5,rgba(e.fg,a));g.addColorStop(1,rgba(e.fg,0));c.fillStyle=g;c.fillRect(0,pos-bw,W,bw*2);c.fillStyle=rgba(e.accent,a*.9);c.fillRect(0,pos-Math.max(1,H*.003),W,Math.max(2,H*.006));c.restore();}},
 {axis:'deco',key:'brokenOrbits',name:'ほどける三輪',desc:'欠けた三つの不揃いな輪が、文字のまわりを別々の速さで巡ります。',added:'2026-10-22',words:['不揃いの輪','欠けた輪','三つの輪'],poster:1.25,
  tags:['graphic','calm','emotional'],w:.9,back:true,plan:r=>({seed:Math.floor(r()*1000),dir:sign(r),speed:.12+r()*.08}),
  draw(c,d,P){const S=d.size;c.save();c.translate(d.cx,d.cy);for(let j=0;j<3;j++){const phase=hash(P.seed,j,1)*TAU+d.lt*P.speed*TAU*P.dir*(.65+j*.22),pulse=1+.035*Math.sin(d.lt*.8+j*1.7+P.seed),rx=(d.w*.5+S*(.2+j*.055))*pulse,ry=(d.h*.5+S*(.16+j*.05))*pulse,span=TAU*(.62+.08*hash(P.seed,j,2)),steps=28;c.globalAlpha=d.z*.26*clamp(d.a*3);c.strokeStyle=j===1?d.accent:d.fg;c.lineWidth=Math.max(1,S*(.012+j*.001));c.lineCap='round';c.beginPath();for(let i=0;i<=steps;i++){const u=i/steps,a=phase+u*span,rough=1+.035*Math.sin(a*3+P.seed+j)+.018*Math.sin(a*7-d.lt*.5+j),x=Math.cos(a)*rx*rough+Math.sin(j*2.1)*S*.018,y=Math.sin(a)*ry*rough+Math.cos(j*1.8)*S*.014;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}c.restore();}},
 {axis:'deco',key:'orbitingGlints',name:'軌道の星粒',desc:'小さな星が文字の外周を巡り、近づくたびに大きく瞬きます。',added:'2026-10-22',words:['星粒','回る星','軌道の光'],poster:1.1,
  tags:['pop','emotional','graphic'],w:.9,plan:r=>({n:4+Math.floor(r()*3),seed:Math.floor(r()*1000),speed:.16+r()*.1,dir:sign(r)}),
  draw(c,d,P){const S=d.size;c.save();for(let j=0;j<P.n;j++){const ph=hash(P.seed,j,1)*TAU,ang=ph+d.lt*P.speed*TAU*P.dir*(.65+.12*(j%3)),rx=d.w*.5+S*(.28+.16*hash(P.seed,j,2)),ry=d.h*.5+S*(.25+.16*hash(P.seed,j,3)),x=d.cx+Math.cos(ang)*rx,y=d.cy+Math.sin(ang)*ry,tw=.5+.5*Math.sin(d.lt*(7+hash(P.seed,j,4)*3)+ph),r=S*(.065+.095*tw),rot=ang*.35+d.lt*(j%2?1:-1)*.7;c.globalAlpha=d.z*(.24+.38*tw)*clamp(d.a*3);c.fillStyle=j%3?d.accent:d.fg;dailyStar(c,x,y,r,rot);const tx=Math.cos(ang-0.08*P.dir),ty=Math.sin(ang-0.08*P.dir);c.globalAlpha*=.28;c.beginPath();c.arc(x-tx*r*1.7,y-ty*r*1.7,Math.max(1,r*.22),0,TAU);c.fill();}c.restore();}},
 {axis:'bg',key:'depthTorus',name:'厚みが回る輪',desc:'輪状の細い線が傾いて回り、脈動しながら手前を太く奥を細く見せます。',added:'2026-10-22',words:['擬似3D','奥行きの輪','厚みが回る'],poster:.7,
  tags:['graphic','impact','calm'],w:.9,plan:r=>({phase:r()*TAU,dir:sign(r),speed:.45+r()*.25}),
  draw(c,e,P){const M=18,N=7,S=Math.min(e.W,e.H),breath=.48+.055*Math.sin(e.t*.72+P.phase),ax=e.t*P.speed*P.dir+P.phase,ay=e.t*P.speed*.71*P.dir+P.phase*.6,az=e.t*P.speed*.38*P.dir,pts=[];for(let i=0;i<=M;i++){pts[i]=[];const u=i/M*TAU;for(let j=0;j<=N;j++){const v=j/N*TAU,R=.54,r=.16,x=(R+r*Math.cos(v))*Math.cos(u),y=(R+r*Math.cos(v))*Math.sin(u),z=r*Math.sin(v),y1=y*Math.cos(ax)-z*Math.sin(ax),z1=y*Math.sin(ax)+z*Math.cos(ax),x2=x*Math.cos(ay)+z1*Math.sin(ay),z2=-x*Math.sin(ay)+z1*Math.cos(ay),x3=x2*Math.cos(az)-y1*Math.sin(az),y3=x2*Math.sin(az)+y1*Math.cos(az);pts[i][j]=depthPoint(x3,y3,z2*2.8,e,breath);}}const edges=[];for(let i=0;i<M;i++)for(let j=0;j<N;j++){edges.push([pts[i][j],pts[i+1][j],j%3?e.fg:e.accent,.18]);edges.push([pts[i][j],pts[i][j+1],i%5?e.fg:e.accent,.15]);}depthEdges(c,e,'depthTorus',edges);}},
 {axis:'bg',key:'depthCoil',name:'奥へ進む螺旋',desc:'輪のらせんが奥から手前へ進み、遠近に合わせて細さと大きさを変えます。',added:'2026-10-22',words:['遠近の螺旋','輪のトンネル','奥から手前へ'],poster:.8,
  tags:['graphic','calm','impact'],w:.9,plan:r=>({phase:r(),speed:.09+r()*.05,rings:6+Math.floor(r()*2),dir:sign(r)}),
  draw(c,e,P){const S=Math.min(e.W,e.H),edges=[];for(let j=0;j<P.rings;j++){const q=fract(e.t*P.speed*P.dir+P.phase+j/P.rings),z0=(q-.5)*1.38,fade=smooth(clamp(q*8))*smooth(clamp((1-q)*8)),tilt=.48+.12*Math.sin(e.t*.25+j),spin=e.t*.55*P.dir+j*.28+P.phase,radius=.3*(1+.045*Math.sin(e.t*.7+j)),pts=[];for(let i=0;i<=32;i++){const a=i/32*TAU,x0=radius*Math.cos(a),y0=radius*Math.sin(a)*Math.cos(tilt),zLocal=radius*Math.sin(a)*Math.sin(tilt)*.45,x=x0*Math.cos(spin)+zLocal*Math.sin(spin),z=-x0*Math.sin(spin)+zLocal*Math.cos(spin)+z0;pts.push(depthPoint(x,y0,z,e,1));}for(let i=0;i<32;i++)edges.push([pts[i],pts[i+1],i%6===0?e.accent:e.fg,(.13+.14*clamp((z0+.72)/1.44))*fade]);}depthEdges(c,e,'depthCoil',edges);}},
];
