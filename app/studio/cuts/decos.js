// カット割りの「装飾」: 文字のまわりに付く小さな飾り（手描きの丸囲み・キラキラ・矢印・効果線…）と、文字の後ろに淡く重ねる透ける飾り（付箋・すりガラス・薄紙…）。
// 文字のキャンバスに、文字と同じ座標で描く（layer.js の textCanvas）。だからカメラ・置き場所・引き継ぎの変形は文字と一緒に掛かり、
// 色ずれ（ゴースト）の層には入らない。物の世界のあるカットには付けない（世界が飾りの役をする。plan.js の assignDecos）。
//
// 1つの装飾 = {name, tags, w, back?, plan(r) → P, draw(c,d,P)}
//   back  true なら文字の後ろに描く（それ以外は文字の上）
//   d     {x0,y0,x1,y1,w,h,cx,cy}: 文字の外接矩形（文字のキャンバスの px）、size: 字の大きさ、W,H: 画面、lt: カットの中の時刻、dur: カットの長さ、
//         a: 出てくる進み 0→1（カットの頭）、z: 残っている度合い 1→0（カットの終わり）、fg: 文字色、accent: アクセント色、seed: カットごとの種
// 決まり: 同じ時刻なら同じ絵（Math.random・Date.now は使わない。乱数は plan(r) の r か hash）。文字を隠さない（文字の上に描くものは線・小さな形だけ。面で覆うものは back にして淡く）。
import {TAU,clamp,lerp,fract,smooth,outCubic,outBack,hash,sign,rgba,addDailyParts} from './kit.js';
import {DAILY_CUT_PARTS} from './daily-parts.js';

/** 中心 (cx,cy)、半径 (rx,ry) の、手で描いたように少しゆがんだ輪の点。turns 周ぶん（1 より大きいと描き始めと終わりが重なる） */
function wobblyLoop(cx,cy,rx,ry,seed,turns=1.12,jit=.06,start=-2.2){
 const n=Math.max(24,Math.round(64*turns)),pts=[];
 for(let i=0;i<=n;i++){const u=i/n,a=start+u*turns*TAU,k=1+(hash(seed,Math.floor(u*7),1)-.5)*jit*2+Math.sin(u*TAU*3+seed)*jit*.5+u*jit*.6;pts.push([cx+Math.cos(a)*rx*k,cy+Math.sin(a)*ry*k]);}
 return pts;
}
/** 点の列の、頭から u（0..1）の割合までを線で引く（描いていくように見せる） */
function strokePart(c,pts,u){
 if(u<=0||pts.length<2)return;
 const last=Math.max(1,Math.min(pts.length-1,Math.floor(u*(pts.length-1))));
 c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<=last;i++)c.lineTo(pts[i][0],pts[i][1]);c.stroke();
}
function star4(c,x,y,r,rot=0){c.save();c.translate(x,y);c.rotate(rot);c.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rr=i%2?r*.28:r;c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fill();c.restore();}
function heart(c,x,y,s){c.beginPath();c.moveTo(x,y+s*.35);c.bezierCurveTo(x-s*.9,y-s*.2,x-s*.45,y-s*.95,x,y-s*.4);c.bezierCurveTo(x+s*.45,y-s*.95,x+s*.9,y-s*.2,x,y+s*.35);c.closePath();c.fill();}
function note(c,x,y,s){c.beginPath();c.ellipse(x,y,s*.32,s*.24,-.4,0,TAU);c.fill();c.fillRect(x+s*.24,y-s*1.05,s*.09,s*1.05);c.beginPath();c.moveTo(x+s*.33,y-s*1.05);c.quadraticCurveTo(x+s*.75,y-s*.85,x+s*.62,y-s*.45);c.lineWidth=s*.09;c.stroke();}
// 透ける装飾（付箋・ガラス・薄紙…）の色。文字の後ろに薄く重ねるので、淡い色だけ
// 心電図の1拍の形（拍の中の位置 0..1 → 高さ。1 が一番高い）
const ECG=[[0,0],[.38,0],[.41,.1],[.44,0],[.46,-.15],[.49,1],[.52,-.35],[.55,0],[.62,0],[.66,.16],[.7,0],[1,0]];
const PALE=['#ffe27a','#ffb3cf','#a8e6ff','#c4f0a8','#d9c2ff'];
const RAINBOW=['#ff6b6b','#ffb347','#ffe66d','#7bed9f','#70a1ff','#c56cf0'];
/** 角の1つが折れた付箋の形（side 1: 右下が折れる、-1: 左下） */
function stickyPath(c,x,y,w,h,f,side){
 c.beginPath();
 if(side>0){c.moveTo(x,y);c.lineTo(x+w,y);c.lineTo(x+w,y+h-f);c.lineTo(x+w-f,y+h);c.lineTo(x,y+h);}
 else{c.moveTo(x,y);c.lineTo(x+w,y);c.lineTo(x+w,y+h);c.lineTo(x+f,y+h);c.lineTo(x,y+h-f);}
 c.closePath();
}
/** 中心 (cx,cy)・幅 w・高さ h の、薄い付箋を1枚。u: 貼られる進み 0→1、alpha: 色の濃さ */
function drawSticky(c,d,cx,cy,w,h,tilt,col,alpha,u,side){
 if(u<=0)return;
 const k=lerp(1.14,1,outCubic(u)),f=Math.min(w,h)*.16,x=-w/2,y=-h/2;
 c.save();c.globalAlpha*=clamp(u*2.2);c.translate(cx,cy);c.rotate(tilt+(1-outCubic(u))*.12*side);c.scale(k,k);
 c.save();c.translate(d.size*.05,d.size*.07);stickyPath(c,x,y,w,h,f,side);c.fillStyle='rgba(0,0,0,0.10)';c.fill();c.restore();
 stickyPath(c,x,y,w,h,f,side);c.fillStyle=rgba(col,alpha);c.fill();
 c.fillStyle=rgba(col,alpha*.7);c.fillRect(x,y,w,h*.14);
 c.beginPath();if(side>0){c.moveTo(x+w,y+h-f);c.lineTo(x+w-f,y+h);c.lineTo(x+w-f,y+h-f);}else{c.moveTo(x,y+h-f);c.lineTo(x+f,y+h);c.lineTo(x+f,y+h-f);}c.closePath();c.fillStyle=rgba('#ffffff',.24);c.fill();
 stickyPath(c,x,y,w,h,f,side);c.strokeStyle=rgba(col,Math.min(1,alpha*1.8));c.lineWidth=Math.max(1,d.size*.02);c.stroke();
 c.restore();
}
/** 角の丸い四角の道筋（roundRect がないブラウザでは角の丸くない四角） */
function roundBox(c,x,y,w,h,r){c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);}

export const DECO={
 scribbleCircle:{name:'手描きの丸囲み',tags:['pop','emotional','graphic'],w:1.3,plan:r=>({turns:1.08+r()*.14,tilt:(r()-.5)*.2,col:r()<.7?'accent':'fg'}),
  draw(c,d,P){c.save();c.translate(d.cx,d.cy);c.rotate(P.tilt);c.strokeStyle=P.col==='fg'?d.fg:d.accent;c.lineWidth=Math.max(2,d.size*.07);c.lineCap=c.lineJoin='round';c.globalAlpha=d.z;
   strokePart(c,wobblyLoop(0,0,d.w/2+d.size*.42,d.h/2+d.size*.34,d.seed,P.turns),outCubic(d.a));c.restore();}},
 sparkles:{name:'キラキラ',tags:['pop','emotional','calm'],w:1.2,plan:r=>({n:4+Math.floor(r()*3),seed:Math.floor(r()*1000)}),
  draw(c,d,P){c.save();c.globalAlpha=d.z;
   for(let j=0;j<P.n;j++){const ang=hash(P.seed,j,1)*TAU,rx=d.w/2+d.size*(.35+hash(P.seed,j,2)*.4),ry=d.h/2+d.size*(.3+hash(P.seed,j,3)*.35),pop=outBack(clamp(d.a*1.6-j*.12),2.2);
    if(pop<=0)continue;const tw=.65+.35*Math.sin(d.lt*7+j*2.1),r=d.size*(.17+hash(P.seed,j,4)*.15)*pop*tw;c.fillStyle=j%3?d.accent:d.fg;star4(c,d.cx+Math.cos(ang)*rx,d.cy+Math.sin(ang)*ry,r,d.lt*.8*(j%2?1:-1));}
   c.restore();}},
 waveUnderline:{name:'波の下線',tags:['pop','calm','emotional'],w:1.1,plan:r=>({k:3+Math.floor(r()*3),double:r()<.5}),
  draw(c,d,P){c.save();c.strokeStyle=d.accent;c.lineCap='round';c.globalAlpha=d.z;
   for(let L=0;L<(P.double?2:1);L++){const y=d.y1+d.size*(.16+L*.14),amp=d.size*(.06-L*.02),pts=[];c.lineWidth=Math.max(1.5,d.size*(.06-L*.02));
    for(let i=0;i<=48;i++){const u=i/48;pts.push([lerp(d.x0-d.size*.1,d.x1+d.size*.1,u),y+Math.sin(u*TAU*P.k+L)*amp]);}
    strokePart(c,pts,outCubic(clamp(d.a*1.3-L*.3)));}
   c.restore();}},
 pointArrow:{name:'指さす矢印',tags:['pop','graphic','impact'],w:1,plan:r=>({side:sign(r),bend:.5+r()*.5}),
  draw(c,d,P){const s=P.side,tipX=s<0?d.x0-d.size*.25:d.x1+d.size*.25,tipY=d.cy-d.h*.1,bx=tipX+s*d.size*1.6,by=tipY-d.size*1.05;
   const pts=[];for(let i=0;i<=30;i++){const u=i/30,mx=lerp(bx,tipX,u),my=lerp(by,tipY,u)-Math.sin(u*Math.PI)*d.size*.45*P.bend;pts.push([mx,my]);}
   const u=outCubic(d.a);c.save();c.globalAlpha=d.z;c.strokeStyle=d.accent;c.fillStyle=d.accent;c.lineWidth=Math.max(2,d.size*.07);c.lineCap=c.lineJoin='round';strokePart(c,pts,u);
   if(u>.85){const k=(u-.85)/.15,[px,py]=pts[pts.length-3],ang=Math.atan2(tipY-py,tipX-px),hs=d.size*.28*k;
    c.beginPath();c.moveTo(tipX,tipY);c.lineTo(tipX-Math.cos(ang-.5)*hs,tipY-Math.sin(ang-.5)*hs);c.moveTo(tipX,tipY);c.lineTo(tipX-Math.cos(ang+.5)*hs,tipY-Math.sin(ang+.5)*hs);c.stroke();}
   c.restore();}},
 brackets:{name:'かぎかっこ',tags:['graphic','calm','pop'],w:1.1,plan:r=>({col:r()<.5?'accent':'fg'}),
  draw(c,d,P){const m=d.size*.32,L=Math.min(d.size*.9,Math.max(d.w,d.h)*.35),o=(1-outCubic(d.a))*d.size*.8;c.save();c.globalAlpha=d.z*clamp(d.a*3);c.strokeStyle=P.col==='fg'?d.fg:d.accent;c.lineWidth=Math.max(2,d.size*.08);c.lineCap='square';
   const x0=d.x0-m-o,y0=d.y0-m-o,x1=d.x1+m+o,y1=d.y1+m+o;
   c.beginPath();c.moveTo(x0+L,y0);c.lineTo(x0,y0);c.lineTo(x0,y0+L);c.moveTo(x1-L,y1);c.lineTo(x1,y1);c.lineTo(x1,y1-L);c.stroke();c.restore();}},
 focusLines:{name:'効果線',tags:['impact','pop','glitch'],w:1,plan:r=>({n:16+2*Math.floor(r()*5),seed:Math.floor(r()*1000)}),
  draw(c,d,P){const f=Math.floor(d.lt*12),rx=d.w/2+d.size*.55,ry=d.h/2+d.size*.5;c.save();c.globalAlpha=d.z*.9;c.strokeStyle=d.accent;c.lineCap='round';
   for(let j=0;j<P.n;j++){const ang=(j+hash(P.seed,j,1)*.6)/P.n*TAU,len=d.size*(.25+.35*hash(P.seed+f,j,2))*outCubic(d.a),ca=Math.cos(ang),sa=Math.sin(ang);if(len<=.5)continue;
    c.lineWidth=Math.max(1.5,d.size*(.03+.03*hash(P.seed,j,3)));c.beginPath();c.moveTo(d.cx+ca*rx,d.cy+sa*ry);c.lineTo(d.cx+ca*(rx+len),d.cy+sa*(ry+len));c.stroke();}
   c.restore();}},
 spikyBurst:{name:'ギザギザ爆発',tags:['impact','pop','graphic'],w:.9,back:true,plan:r=>({n:12+2*Math.floor(r()*4),seed:Math.floor(r()*1000),spin:sign(r)*(.08+r()*.1)}),
  draw(c,d,P){const s=outBack(d.a,1.8),rx=(d.w/2+d.size*.55)*s,ry=(d.h/2+d.size*.55)*s;if(s<=.01)return;c.save();c.translate(d.cx,d.cy);c.rotate(d.lt*P.spin);c.globalAlpha=d.z;
   c.beginPath();for(let i=0;i<P.n*2;i++){const a=i/(P.n*2)*TAU,k=i%2?.78:1.05+hash(P.seed,i,1)*.18;c.lineTo(Math.cos(a)*rx*k,Math.sin(a)*ry*k);}c.closePath();
   c.fillStyle=rgba(d.accent,.26);c.fill();c.strokeStyle=d.accent;c.lineWidth=Math.max(2,d.size*.05);c.lineJoin='round';c.stroke();c.restore();}},
 floatHearts:{name:'ハートが浮かぶ',tags:['emotional','pop','calm'],w:1,plan:r=>({n:3+Math.floor(r()*3),seed:Math.floor(r()*1000)}),
  draw(c,d,P){c.save();
   for(let j=0;j<P.n;j++){const x=lerp(d.x0,d.x1,hash(P.seed,j,1)),rise=fract2(d.lt*.45+hash(P.seed,j,2)),y=d.y0-d.size*(.15+rise*1.1),s=d.size*(.24+hash(P.seed,j,3)*.14)*clamp(d.a*2-j*.15);
    if(s<=.5)continue;c.globalAlpha=d.z*(1-rise)*clamp(rise*6);c.fillStyle=j%2?d.accent:d.fg;heart(c,x+Math.sin(d.lt*2+j)*d.size*.12,y,s);}
   c.restore();}},
 dashBox:{name:'点線の囲み',tags:['graphic','calm','pop'],w:1,plan:r=>({round:r()<.6,dir:sign(r)}),
  draw(c,d,P){const m=d.size*.3,x=d.x0-m,y=d.y0-m,w=d.w+m*2,h=d.h+m*2,u=outCubic(d.a);c.save();c.globalAlpha=d.z*clamp(d.a*2.5);c.strokeStyle=d.accent;c.lineWidth=Math.max(1.5,d.size*.05);
   const dash=d.size*.18;c.setLineDash([dash,dash*.7]);c.lineDashOffset=-d.lt*d.size*.6*P.dir;c.translate(d.cx,d.cy);c.scale(lerp(.85,1,u),lerp(.85,1,u));c.translate(-d.cx,-d.cy);
   c.beginPath();if(P.round&&c.roundRect)c.roundRect(x,y,w,h,Math.min(w,h)*.3);else c.rect(x,y,w,h);c.stroke();c.restore();}},
 emphasisMarks:{name:'強調の線',tags:['pop','impact','emotional'],w:1,plan:r=>({side:sign(r)}),
  draw(c,d,P){const s=P.side,bx=s>0?d.x1+d.size*.18:d.x0-d.size*.18,by=d.y0-d.size*.05,f=Math.floor(d.lt*8);c.save();c.globalAlpha=d.z;c.strokeStyle=d.accent;c.lineCap='round';c.lineWidth=Math.max(2,d.size*.09);
   for(let j=0;j<3;j++){const k=outBack(clamp(d.a*2-j*.25),2),ang=(-.95+j*.38)*(s>0?1:-1)-(s>0?0:Math.PI),len=d.size*.6*k,jx=(hash(f,j,1)-.5)*d.size*.03;if(k<=.01)continue;
    const sx=bx+Math.cos(ang)*d.size*.2+jx,sy=by+Math.sin(ang)*d.size*.2;c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+Math.cos(ang)*len,sy+Math.sin(ang)*len);c.stroke();}
   c.restore();}},
 musicNotes:{name:'音符が舞う',tags:['pop','emotional','calm'],w:.9,plan:r=>({n:3+Math.floor(r()*2),seed:Math.floor(r()*1000)}),
  draw(c,d,P){c.save();c.strokeStyle=c.fillStyle=d.accent;
   for(let j=0;j<P.n;j++){const side=j%2?1:-1,ph=d.lt*1.3+hash(P.seed,j,1)*TAU,x=(side>0?d.x1+d.size*.45:d.x0-d.size*.45)+Math.sin(ph)*d.size*.15,y=d.cy-d.size*(.1+j*.38)+Math.cos(ph*.8)*d.size*.1,s=d.size*.42*outBack(clamp(d.a*1.8-j*.2),2);
    if(s<=.5)continue;c.globalAlpha=d.z;c.save();c.translate(x,y);c.rotate(Math.sin(ph)*.25);note(c,0,0,s);c.restore();}
   c.restore();}},
 orbitDots:{name:'まわる点',tags:['calm','graphic','emotional'],w:.9,plan:r=>({n:3+Math.floor(r()*3),dir:sign(r),sp:.5+r()*.4}),
  draw(c,d,P){const rx=d.w/2+d.size*.5,ry=d.h/2+d.size*.42;c.save();c.globalAlpha=d.z*clamp(d.a*2);
   for(let j=0;j<P.n;j++){const base=d.lt*P.sp*TAU*P.dir+j*TAU/P.n;for(let t=0;t<5;t++){const a=base-t*.09*P.dir,r=d.size*(.07-t*.011);c.fillStyle=rgba(j%2?d.fg:d.accent,1-t*.2);c.beginPath();c.arc(d.cx+Math.cos(a)*rx,d.cy+Math.sin(a)*ry,Math.max(.5,r),0,TAU);c.fill();}}
   c.restore();}},
 // ---- 透ける装飾（2026-10-17）: 少し透けた付箋・ガラス・薄紙など。強すぎない飾りとして、どれも文字の後ろに淡く重ねる（シャボン玉だけは文字のまわりに線で描く）
 // ---- 線の飾り（2026-10-18）
 cornerCatch:{name:'四隅の枠が捕まえる',tags:['graphic','impact','pop'],w:1,plan:r=>({len:.3+r()*.15,col:r()<.7?'accent':'fg'}),
  // 四隅の L 字が外から縮んできて、文字の角で少し行き過ぎて止まる
  draw(c,d,P){const u=outBack(clamp(d.a*1.25),1.8),pad=d.size*(.22+(1-u)*1.6),L=d.size*P.len,x0=d.x0-pad,x1=d.x1+pad,y0=d.y0-pad*.8,y1=d.y1+pad*.8;
   c.save();c.globalAlpha=d.z*clamp(d.a*3);c.strokeStyle=P.col==='fg'?d.fg:d.accent;c.lineWidth=Math.max(2,d.size*.055);c.lineCap='square';c.beginPath();
   for(const [x,y,sx,sy] of [[x0,y0,1,1],[x1,y0,-1,1],[x0,y1,1,-1],[x1,y1,-1,-1]]){c.moveTo(x,y+sy*L);c.lineTo(x,y);c.lineTo(x+sx*L,y);}
   c.stroke();c.restore();}},
 ecgPulse:{name:'心電図の線',tags:['emotional','graphic','impact'],w:.9,back:true,plan:r=>({v:.7+r()*.5,k:1+Math.floor(r()*2)}),
  // 文字の後ろを、心電図のような線が左から右へ走る。走った後は少しずつ薄くなる。k は1回に走る間の鼓動の数
  draw(c,d,P){const x0=d.x0-d.size*.9,x1=d.x1+d.size*.9,Wd=x1-x0,hx=x0+fract(d.lt*P.v)*Wd*1.4,per=Wd/P.k,A=d.size*.55,tail=Wd*.7,st=Math.max(2,d.size*.04);
   const ecg=x=>{const f=fract(x/per);for(let j=1;j<ECG.length;j++)if(f<=ECG[j][0]){const [a,ya]=ECG[j-1],[b,yb]=ECG[j];return lerp(ya,yb,(f-a)/(b-a));}return 0;};
   c.save();c.lineWidth=Math.max(1.5,d.size*.045);c.lineJoin=c.lineCap='round';c.strokeStyle=d.accent;
   for(let s=0;s<10;s++){const xa=Math.max(x0,hx-tail*(1-s/10)),xb=Math.min(x1,hx-tail*(1-(s+1)/10));if(xb<=xa)continue;
    c.globalAlpha=d.z*clamp(d.a*2)*.8*(s+1)/10;c.beginPath();c.moveTo(xa,d.cy-A*ecg(xa-x0));for(let x=xa+st;x<xb;x+=st)c.lineTo(x,d.cy-A*ecg(x-x0));c.lineTo(xb,d.cy-A*ecg(xb-x0));c.stroke();}
   if(hx>=x0&&hx<=x1){c.globalAlpha=d.z*clamp(d.a*2)*.8;c.fillStyle=d.accent;c.beginPath();c.arc(hx,d.cy-A*ecg(hx-x0),d.size*.05,0,TAU);c.fill();}
   c.restore();}},
 crossFlash:{name:'X字の閃光',tags:['impact','glitch','graphic'],w:.9,plan:r=>({side:sign(r),ang:.5+r()*.35}),
  // 文字の上の角で、細い2本の光が X 字に交差して閃き、すぐに細く小さくなる（カットの頭）。そのあとも小さくまたたく
  draw(c,d,P){const t=d.lt,f=t<.4?1-t/.4:0,k=Math.max(f,(.25+.15*Math.sin(t*9))*.5),x=P.side>0?d.x1+d.size*.35:d.x0-d.size*.35,y=d.y0-d.size*.25,L=d.size*(.6+1.6*outCubic(clamp(t/.12)))*(.5+.5*k);
   c.save();c.globalAlpha=d.z*clamp(k)*clamp(t/.03);c.lineCap='round';
   for(const [lw,col] of [[d.size*.05,rgba(d.accent,.5)],[Math.max(1,d.size*.015),'#ffffff']]){c.lineWidth=lw;c.strokeStyle=col;c.beginPath();
    for(const a of [P.ang,-P.ang]){const dx=Math.cos(a)*L,dy=Math.sin(a)*L;c.moveTo(x-dx,y-dy);c.lineTo(x+dx,y+dy);}c.stroke();}
   c.fillStyle='#ffffff';c.beginPath();c.arc(x,y,d.size*.05*(.6+.4*k),0,TAU);c.fill();c.restore();}},
 paleSticky:{name:'薄い付箋',tags:['pop','emotional','calm'],w:1.1,back:true,plan:r=>({tilt:(r()-.5)*.14,col:Math.floor(r()*PALE.length),tape:r()<.55,side:sign(r)}),
  draw(c,d,P){const m=d.size*.32,w=d.w+m*2,h=d.h+m*2,u=clamp(d.a*1.2);c.save();c.globalAlpha=d.z;
   drawSticky(c,d,d.cx,d.cy,w,h,P.tilt,PALE[P.col]||PALE[0],.3,u,P.side);
   if(P.tape&&u>.5){c.translate(d.cx,d.cy);c.rotate(P.tilt);c.translate(0,-h/2);c.rotate(-P.tilt*2-.05);c.globalAlpha=d.z*clamp((u-.5)*3);c.fillStyle=rgba('#ffffff',.28);c.fillRect(-w*.14,-d.size*.12,w*.28,d.size*.24);}
   c.restore();}},
 stickyStack:{name:'付箋の重なり',tags:['pop','graphic','emotional'],w:.9,back:true,plan:r=>{const a=Math.floor(r()*PALE.length);return {back:(a+1+Math.floor(r()*(PALE.length-1)))%PALE.length,front:a,t1:(r()-.5)*.24,t2:(r()-.5)*.1,dx:sign(r)};},
  draw(c,d,P){const m=d.size*.3,w=d.w+m*2,h=d.h+m*2;c.save();c.globalAlpha=d.z;
   drawSticky(c,d,d.cx+P.dx*d.size*.35,d.cy-d.size*.22,w,h,P.t1,PALE[P.back]||PALE[1],.2,clamp(d.a*1.5),-P.dx);
   drawSticky(c,d,d.cx,d.cy,w,h,P.t2,PALE[P.front]||PALE[0],.27,clamp(d.a*1.6-.35),P.dx);
   c.restore();}},
 maskingTape:{name:'マスキングテープ',tags:['pop','emotional','graphic'],w:1,back:true,plan:r=>({pair:sign(r),col:r()<.45?-1:Math.floor(r()*PALE.length),seed:Math.floor(r()*1000)}),
  draw(c,d,P){const col=P.col<0?d.accent:PALE[P.col]||PALE[0],L=d.size*1.25,T=d.size*.34,o=d.size*.12,ends=P.pair>0?[[d.x0-o,d.y0-o,-.78],[d.x1+o,d.y1+o,-.78]]:[[d.x1+o,d.y0-o,.78],[d.x0-o,d.y1+o,.78]];
   c.save();c.globalAlpha=d.z;
   ends.forEach(([x,y,ang],j)=>{const u=outCubic(clamp(d.a*1.7-j*.35));if(u<=0)return;const x0=-L/2,x1=-L/2+L*u,zig=T/5;
    c.save();c.translate(x,y);c.rotate(ang);c.beginPath();c.moveTo(x0,-T/2);c.lineTo(x1,-T/2);
    for(let i=1;i<=5;i++)c.lineTo(x1+(i%2?1:-1)*zig*.35*(hash(P.seed,j,i)+.4),-T/2+i*zig);
    c.lineTo(x0,T/2);for(let i=4;i>=1;i--)c.lineTo(x0+(i%2?1:-1)*zig*.35*(hash(P.seed,j+5,i)+.4),-T/2+i*zig);c.closePath();
    c.fillStyle=rgba(col,.38);c.fill();c.clip();c.strokeStyle=rgba('#ffffff',.18);c.lineWidth=Math.max(1,T*.12);
    for(let s=x0-T;s<x1;s+=T*.55){c.beginPath();c.moveTo(s,T/2);c.lineTo(s+T*.6,-T/2);c.stroke();}
    c.restore();});
   c.restore();}},
 frostedGlass:{name:'すりガラスの板',tags:['calm','graphic','emotional'],w:1.1,back:true,plan:r=>({round:.16+r()*.2,dir:sign(r),seed:Math.floor(r()*1000)}),
  draw(c,d,P){const m=d.size*.38,w=d.w+m*2,h=d.h+m*2,u=outCubic(d.a),k=lerp(.96,1,u),x=-w/2,y=-h/2,rad=Math.min(w,h)*P.round;
   c.save();c.globalAlpha=d.z*clamp(d.a*2);c.translate(d.cx,d.cy+(1-u)*d.size*.25);c.scale(k,k);
   roundBox(c,x,y,w,h,rad);c.fillStyle=rgba('#ffffff',.1);c.fill();c.fillStyle=rgba(d.accent,.06);c.fill();
   c.save();roundBox(c,x,y,w,h,rad);c.clip();
   c.fillStyle=rgba('#ffffff',.08);for(let i=0;i<40;i++){const gx=x+hash(P.seed,i,1)*w,gy=y+hash(P.seed,i,2)*h,gr=Math.max(.6,d.size*.012*(.5+hash(P.seed,i,3)));c.fillRect(gx,gy,gr,gr);}
   const span=w+h,pos=((d.lt*.32+hash(P.seed,1,9))%1)*span*1.6-span*.3,sx=P.dir>0?x+pos:x+w-pos;
   for(const [off,bw,al] of [[0,d.size*.55,.13],[d.size*.75,d.size*.16,.09]]){const bx=sx+P.dir*off;c.beginPath();c.moveTo(bx,y);c.lineTo(bx+P.dir*bw,y);c.lineTo(bx+P.dir*bw-P.dir*h*.6,y+h);c.lineTo(bx-P.dir*h*.6,y+h);c.closePath();c.fillStyle=rgba('#ffffff',al);c.fill();}
   c.restore();
   roundBox(c,x,y,w,h,rad);c.strokeStyle=rgba('#ffffff',.38);c.lineWidth=Math.max(1,d.size*.025);c.stroke();
   c.beginPath();c.moveTo(x+rad,y+c.lineWidth);c.lineTo(x+w-rad,y+c.lineWidth);c.strokeStyle=rgba('#ffffff',.55);c.stroke();
   c.restore();}},
 glassBubbles:{name:'シャボン玉',tags:['calm','emotional','pop'],w:1,plan:r=>({n:4+Math.floor(r()*3),seed:Math.floor(r()*1000)}),
  draw(c,d,P){c.save();
   for(let j=0;j<P.n;j++){const ang=(j+hash(P.seed,j,1)*.7)/P.n*TAU,rx=d.w/2+d.size*(.45+hash(P.seed,j,2)*.35),ry=d.h/2+d.size*(.4+hash(P.seed,j,3)*.3),R=d.size*(.14+hash(P.seed,j,4)*.18)*outBack(clamp(d.a*1.6-j*.1),2);
    if(R<=.5)continue;const x=d.cx+Math.cos(ang)*rx+Math.sin(d.lt*1.5+j)*d.size*.06,y=d.cy+Math.sin(ang)*ry-d.lt*d.size*.12*(.5+hash(P.seed,j,5));
    c.globalAlpha=d.z;c.beginPath();c.arc(x,y,R,0,TAU);c.fillStyle=rgba('#ffffff',.06);c.fill();c.strokeStyle=rgba('#ffffff',.5);c.lineWidth=Math.max(1,R*.08);c.stroke();
    c.beginPath();c.arc(x,y,R*.92,Math.PI*.15,Math.PI*.85);c.strokeStyle=rgba(d.accent,.45);c.lineWidth=Math.max(1,R*.1);c.stroke();
    c.beginPath();c.arc(x,y,R*.68,Math.PI*1.1,Math.PI*1.45);c.strokeStyle=rgba('#ffffff',.8);c.lineWidth=Math.max(1,R*.12);c.lineCap='round';c.stroke();
    c.beginPath();c.arc(x-R*.35,y-R*.42,Math.max(.5,R*.09),0,TAU);c.fillStyle=rgba('#ffffff',.7);c.fill();}
   c.restore();}},
 softHalo:{name:'透ける光の輪',tags:['calm','emotional'],w:1,back:true,plan:r=>({breath:.5+r()*.5,ring:r()<.6}),
  draw(c,d,P){const k=outCubic(d.a)*(1+.035*Math.sin(d.lt*P.breath*TAU)),rx=(d.w/2+d.size*.9)*k,ry=(d.h/2+d.size*.75)*k;if(rx<=1)return;
   c.save();c.globalAlpha=d.z;c.fillStyle=rgba(d.accent,.05);
   for(let i=0;i<7;i++){const s=1-i/7;c.beginPath();c.ellipse(d.cx,d.cy,rx*s,ry*s,0,0,TAU);c.fill();}
   if(P.ring){c.beginPath();c.ellipse(d.cx,d.cy,rx*1.04,ry*1.04,0,0,TAU);c.strokeStyle=rgba('#ffffff',.22);c.lineWidth=Math.max(1,d.size*.02);c.stroke();}
   c.restore();}},
 veilCircles:{name:'透ける丸の重なり',tags:['graphic','calm','pop'],w:.9,back:true,plan:r=>({seed:Math.floor(r()*1000),dir:sign(r),col:Math.floor(r()*PALE.length)}),
  draw(c,d,P){const cols=[d.accent,PALE[P.col]||PALE[0],'#ffffff'],als=[.13,.13,.08];c.save();c.globalAlpha=d.z;
   for(let j=0;j<3;j++){const s=outBack(clamp(d.a*1.5-j*.2),1.6);if(s<=.01)continue;const ang=hash(P.seed,j,1)*TAU+d.lt*.15*P.dir,dist=d.size*(.3+hash(P.seed,j,2)*.5),R=(Math.max(d.w,d.h)*.2+d.size*(.35+hash(P.seed,j,3)*.35))*s;
    c.beginPath();c.arc(d.cx+Math.cos(ang)*dist,d.cy+Math.sin(ang)*dist*.6,R,0,TAU);c.fillStyle=rgba(cols[j],als[j]);c.fill();}
   c.restore();}},
 prismStreak:{name:'虹色の反射',tags:['emotional','graphic','glitch'],w:.9,back:true,plan:r=>({ang:sign(r)*(.32+r()*.25),seed:Math.floor(r()*1000)}),
  draw(c,d,P){const L=d.w+d.size*2.4,band=d.size*.95,st=band/RAINBOW.length,u=outCubic(d.a),wob=Math.sin(d.lt*1.2+P.seed)*d.size*.04;if(u<=0)return;
   c.save();c.globalAlpha=d.z;c.translate(d.cx,d.cy);c.rotate(P.ang);
   RAINBOW.forEach((col,i)=>{c.fillStyle=rgba(col,.17);c.fillRect(-L/2,-band/2+i*st+wob*(i/RAINBOW.length-.5),L*u,st+.5);});
   c.fillStyle=rgba('#ffffff',.25);c.fillRect(-L/2,-band/2-Math.max(1,d.size*.015),L*u,Math.max(1,d.size*.015));
   c.restore();}},
 tracingPaper:{name:'薄紙',tags:['calm','emotional','graphic'],w:1,back:true,plan:r=>({from:sign(r),tilt:(r()-.5)*.08,seed:Math.floor(r()*1000)}),
  draw(c,d,P){const w=d.w+d.size*1.4,h=d.h+d.size*.55,u=outCubic(d.a),step=d.size*.18,n=Math.max(4,Math.ceil(w/step)),x=-w/2,y=-h/2;
   c.save();c.globalAlpha=d.z*clamp(d.a*2.5);c.translate(d.cx+(1-u)*d.size*1.2*P.from,d.cy);c.rotate(P.tilt);
   c.beginPath();for(let i=0;i<=n;i++)c.lineTo(x+w*i/n,y+(hash(P.seed,i,1)-.5)*d.size*.08);for(let i=n;i>=0;i--)c.lineTo(x+w*i/n,y+h+(hash(P.seed,i,2)-.5)*d.size*.08);c.closePath();
   c.fillStyle=rgba('#ffffff',.16);c.fill();c.fillStyle=rgba(d.accent,.04);c.fill();c.strokeStyle=rgba('#ffffff',.3);c.lineWidth=1;c.stroke();
   c.restore();}},
};
const fract2=x=>x-Math.floor(x);
// 毎日のルーティンで足した装飾（daily-parts.js の axis:'deco'）を、表の末尾につなぐ
addDailyParts({deco:DECO},DAILY_CUT_PARTS);

/** 装飾の出てくる進み a（カットの頭 0→1）と、残っている度合い z（カットの終わり 1→0） */
export function decoTiming(lt,dur){
 const inT=Math.min(.32,dur*.35),outT=Math.min(.22,dur*.25);
 return {a:smooth(clamp((lt-.04)/inT)),z:1-smooth(clamp((lt-(dur-outT))/outT))};
}
/** カット cut の装飾を、文字のキャンバス c に描く（item: 文字の組み、lt: カットの中の時刻）。back: 文字の後ろの分だけ描く時 true */
export function renderDeco(c,cut,item,lt,{back=false}={}){
 const D=cut.deco&&DECO[cut.deco];if(!D||!!D.back!==back||!item?.bbox)return;
 lt-=item.delay||0;if(lt<0)return;
 const b=item.bbox,dur=Math.max(.05,cut.end-cut.start),{a,z}=decoTiming(lt,dur);if(a<=0||z<=0)return;
 const d={x0:b.x0,y0:b.y0,x1:b.x1,y1:b.y1,w:b.x1-b.x0,h:b.y1-b.y0,cx:(b.x0+b.x1)/2,cy:(b.y0+b.y1)/2,size:item.size,W:item.W,H:item.H,lt,dur,a,z,fg:cut.color||'#ffffff',accent:cut.emphasisColor||'#ffc04d',seed:(cut.seed|0)%997};
 c.save();try{D.draw(c,d,cut.decoP||{});}finally{c.restore();}
}
