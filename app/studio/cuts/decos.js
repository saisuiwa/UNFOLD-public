// カット割りの「装飾」: 文字のまわりに付く小さな飾り（手描きの丸囲み・キラキラ・矢印・効果線…）。
// 文字のキャンバスに、文字と同じ座標で描く（layer.js の textCanvas）。だからカメラ・置き場所・引き継ぎの変形は文字と一緒に掛かり、
// 色ずれ（ゴースト）の層には入らない。物の世界のあるカットには付けない（世界が飾りの役をする。plan.js の assignDecos）。
//
// 1つの装飾 = {name, tags, w, back?, plan(r) → P, draw(c,d,P)}
//   back  true なら文字の後ろに描く（それ以外は文字の上）
//   d     {x0,y0,x1,y1,w,h,cx,cy}: 文字の外接矩形（文字のキャンバスの px）、size: 字の大きさ、W,H: 画面、lt: カットの中の時刻、dur: カットの長さ、
//         a: 出てくる進み 0→1（カットの頭）、z: 残っている度合い 1→0（カットの終わり）、fg: 文字色、accent: アクセント色、seed: カットごとの種
// 決まり: 同じ時刻なら同じ絵（Math.random・Date.now は使わない。乱数は plan(r) の r か hash）。文字を隠さない（文字の上に描くものは線・小さな形だけ）。
import {TAU,clamp,lerp,smooth,outCubic,outBack,hash,sign,rgba,addDailyParts} from './kit.js';
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
