// カット演出の部品（背景・カメラ・画面効果・つなぎ）。どれも Canvas2D の小さな関数で、import した時点では DOM に触らない（node で動かして確かめられる）。
// 画面の大きさは e.W / e.H で受け取るので、横長でも縦長でも、どの解像度でも同じ作りで描ける。
// 部品の形（契約）:
//   背景    draw(ctx, e, P)              背景色を塗った後に、時刻 e.t だけから描く
//   カメラ  get(e, P) → {s,x,y,rot}      文字レイヤー全体の変形（背景は動かさない）
//   画面効果 apply(ctx, e, P, k)          できあがった1フレームへの後処理。k は 1→0 に減っていく強さ
//   つなぎ  draw(ctx, A, B, p, e, P)     前カットの最後の絵 A と今カットの絵 B を p(0→1) で合成
// 共通: name（日本語名）, tags（合うムード）, w（出やすさ）, plan(rnd) → P（保存して再現できる値）
// e = {W,H,t,lt,dur,p,fg,accent,bg,text,step,tmp(slot,w,h)}   rnd = 0..1 の乱数関数（text はそのカットの歌詞）
import {addDailyParts} from './kit.js';
import {DAILY_CUT_PARTS} from './daily-parts.js';
export const TAU=Math.PI*2,DEG=Math.PI/180;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,u)=>a+(b-a)*u;
const outCubic=x=>1-(1-clamp(x))**3;
const inOutCubic=x=>{x=clamp(x);return x<.5?4*x*x*x:1-(-2*x+2)**3/2;};
const outExpo=x=>x>=1?1:1-2**(-10*clamp(x));
const bell=p=>Math.sin(clamp(p)*Math.PI);
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const fract=x=>x-Math.floor(x);
const hash=(a,b=0,c=0)=>fract(Math.sin(a*127.1+b*311.7+c*74.7)*43758.5453);
const hexRgb=h=>{const n=parseInt(String(h).slice(1,7),16)||0;return [n>>16&255,n>>8&255,n&255];};
export const rgba=(h,a)=>{const [r,g,b]=hexRgb(h);return `rgba(${r},${g},${b},${a})`;};
export const mixHex=(a,b,u)=>{const x=hexRgb(a),y=hexRgb(b);return '#'+x.map((v,i)=>Math.round(lerp(v,y[i],u)).toString(16).padStart(2,'0')).join('');};
const sign=r=>r()<.5?-1:1;
const pickW=(r,items,weights)=>{let x=r()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<items.length;i++){x-=weights[i];if(x<=0)return items[i];}return items.at(-1);};

// ---- 背景 ---------------------------------------------------------------------------------------------------------------------------------
export const BG={
 rays:{name:'放射',tags:['pop','impact','graphic'],w:1,
  plan:r=>({n:8+2*Math.floor(r()*6),cx:.5+(r()-.5)*.3,cy:.5+(r()-.5)*.3,spin:sign(r)*(.02+r()*.04),a:.07+r()*.05}),
  draw(c,e,P){const R=Math.hypot(e.W,e.H),s=TAU/P.n;c.translate(e.W*P.cx,e.H*P.cy);c.rotate(e.t*P.spin*TAU);c.fillStyle=rgba(e.accent,P.a);
   for(let i=0;i<P.n;i+=2){c.beginPath();c.moveTo(0,0);c.arc(0,0,R,i*s,(i+1)*s);c.closePath();c.fill();}}},
 grid:{name:'罫線グリッド',tags:['graphic','glitch','calm'],w:1,
  plan:r=>({cell:.07+r()*.05,vx:sign(r)*(.1+r()*.2),vy:sign(r)*(.05+r()*.15),a:.07+r()*.05}),
  draw(c,e,P){const cell=e.H*P.cell,ox=((e.t*P.vx*cell)%cell+cell)%cell,oy=((e.t*P.vy*cell)%cell+cell)%cell;
   c.strokeStyle=rgba(e.fg,P.a);c.lineWidth=Math.max(1,e.H/540);c.beginPath();
   for(let x=-ox;x<e.W;x+=cell){c.moveTo(x,0);c.lineTo(x,e.H);}
   for(let y=-oy;y<e.H;y+=cell){c.moveTo(0,y);c.lineTo(e.W,y);}
   c.stroke();}},
 dots:{name:'網点の波',tags:['pop','emotional','calm'],w:1,
  plan:r=>({cell:.055+r()*.03,k:.8+r()*.8,a:.13+r()*.06,dir:sign(r)}),
  draw(c,e,P){const cell=e.H*P.cell;c.fillStyle=rgba(e.accent,P.a);
   for(let y=cell/2;y<e.H;y+=cell)for(let x=cell/2;x<e.W;x+=cell){
    const d=Math.hypot(x-e.W/2,y-e.H/2)/e.H,k=.5+.5*Math.sin(d*7*P.k-e.t*1.4*P.dir),r=cell*.46*k*(1-clamp(d*.9)*.4);
    if(r>.6){c.beginPath();c.arc(x,y,r,0,TAU);c.fill();}}}},
 bands:{name:'大きな斜線',tags:['impact','graphic','pop'],w:1,
  plan:r=>({ang:sign(r)*(20+r()*18),w:.2+r()*.1,v:.04+r()*.05,a:.08+r()*.05}),
  draw(c,e,P){const R=Math.hypot(e.W,e.H),w=e.H*P.w,off=(e.t*P.v*e.H)%(w*2);
   c.translate(e.W/2,e.H/2);c.rotate(P.ang*DEG);c.fillStyle=rgba(e.accent,P.a);
   for(let x=-R-w*2+off;x<R;x+=w*2)c.fillRect(x,-R,w,R*2);}},
 rings:{name:'広がる輪',tags:['emotional','calm','pop'],w:1,
  plan:r=>({n:5+Math.floor(r()*4),v:.1+r()*.1,cx:.5+(r()-.5)*.4,cy:.5+(r()-.5)*.4,a:.2+r()*.08}),
  draw(c,e,P){const R=Math.hypot(e.W,e.H)*.6;c.lineWidth=Math.max(1.5,e.H*.005);
   for(let k=0;k<P.n;k++){const u=fract(e.t*P.v+k/P.n);c.strokeStyle=rgba(e.accent,P.a*(1-u));c.beginPath();c.arc(e.W*P.cx,e.H*P.cy,u*R,0,TAU);c.stroke();}}},
 scan:{name:'走査線',tags:['glitch','graphic','impact'],w:.9,
  plan:r=>({gap:3+Math.floor(r()*3),v:.15+r()*.2,a:.18}),
  draw(c,e,P){const g=P.gap*e.H/540;c.fillStyle=rgba('#000000',P.a);
   for(let y=0;y<e.H;y+=g*2)c.fillRect(0,y,e.W,g);
   const bh=e.H*.16,y=((e.t*P.v)%1.4-.2)*e.H,gr=c.createLinearGradient(0,y,0,y+bh);
   gr.addColorStop(0,rgba(e.fg,0));gr.addColorStop(.5,rgba(e.fg,.08));gr.addColorStop(1,rgba(e.fg,0));c.fillStyle=gr;c.fillRect(0,y,e.W,bh);}},
 split:{name:'斜め二色',tags:['graphic','impact','glitch'],w:1,
  plan:r=>({ang:sign(r)*(10+r()*25),sw:.08+r()*.08,u:.42+r()*.16}),
  draw(c,e,P){const x0=e.W*(P.u+P.sw*Math.sin(e.t*.7)),sk=e.H*Math.tan(P.ang*DEG)/2;
   c.fillStyle=e.opaque===false?rgba(e.accent,.2):mixHex(e.bg,e.accent,.2);   // 下に絵があるときは、半分を塗りつぶさず、薄い色を重ねる
   c.beginPath();c.moveTo(x0+sk,0);c.lineTo(e.W,0);c.lineTo(e.W,e.H);c.lineTo(x0-sk,e.H);c.closePath();c.fill();}},
 glow:{name:'ゆれる光',tags:['emotional','calm','pop'],w:1.2,
  plan:r=>({ph:[r()*TAU,r()*TAU,r()*TAU],a:.2+r()*.1}),
  draw(c,e,P){const R=e.H*.85,cols=[rgba(e.accent,P.a),rgba(e.fg,P.a*.45),rgba(mixHex(e.accent,e.fg,.5),P.a*.7)];
   cols.forEach((col,i)=>{const x=e.W*(.5+.32*Math.sin(e.t*(.35+i*.11)+P.ph[i])),y=e.H*(.5+.3*Math.cos(e.t*(.28+i*.09)+P.ph[(i+1)%3])),g=c.createRadialGradient(x,y,0,x,y,R);
    g.addColorStop(0,col);g.addColorStop(1,rgba(e.accent,0));c.fillStyle=g;c.fillRect(0,0,e.W,e.H);});}},
 // ---- 光や自然の背景（2026-10-17）。どれも薄く重ねる（下に写真や映像があっても、塗りつぶさない。重なった所でも不透明度は 130/255 以下）
 rain:{name:'雨',tags:['emotional','calm'],w:.9,
  plan:r=>({n:60+Math.floor(r()*40),ang:sign(r)*(6+r()*12),v:1.1+r()*.6,drops:5+Math.floor(r()*5),seed:Math.floor(r()*1000)}),
  draw(c,e,P){const L=e.H*.09,sk=Math.tan(P.ang*DEG);c.strokeStyle=rgba(e.fg,.18);c.lineWidth=Math.max(1,e.H/700);c.beginPath();
   for(let i=0;i<P.n;i++){const x0=hash(P.seed,i,1)*(e.W+e.H*.3)-e.H*.15,y=fract(hash(P.seed,i,2)+e.t*P.v*(.7+.6*hash(P.seed,i,3)))*(e.H+L)-L,x=x0+y*sk;c.moveTo(x,y);c.lineTo(x+L*sk,y+L);}
   c.stroke();
   for(let i=0;i<P.drops;i++){const x=hash(P.seed,i,7)*e.W,y=fract(hash(P.seed,i,8)+e.t*.06*(.5+hash(P.seed,i,9)))*e.H*1.1-e.H*.05,r=e.H*(.006+.008*hash(P.seed,i,10));
    c.fillStyle=rgba('#ffffff',.06);c.fillRect(x-r*.35,y-r*9,r*.7,r*9);c.fillStyle=rgba('#ffffff',.24);c.beginPath();c.arc(x,y,r,0,TAU);c.fill();}}},
 petals:{name:'花びら',tags:['emotional','pop','calm'],w:.9,
  plan:r=>({n:22+Math.floor(r()*12),dir:sign(r),v:.05+r()*.04,seed:Math.floor(r()*1000)}),
  // 全部の花びらを1つの形にまとめて1回で塗る（重なった所が濃くならない）
  draw(c,e,P){const col=mixHex(e.accent,'#ffc4d6',.6),s0=e.H*.032;c.beginPath();
   for(let i=0;i<P.n;i++){const u=fract(hash(P.seed,i,1)+e.t*P.v*(.7+.6*hash(P.seed,i,2))),x=P.dir>0?u*(e.W*1.2)-e.W*.1:e.W*1.1-u*e.W*1.2,y=hash(P.seed,i,3)*e.H+Math.sin(e.t*1.3+i)*e.H*.05+u*e.H*.25-e.H*.12,s=s0*(.6+.8*hash(P.seed,i,4));
    c.save();c.translate(x,y);c.rotate(e.t*(1+hash(P.seed,i,5))*sign(()=>hash(P.seed,i,6))+i);c.scale(1,.45+.45*Math.abs(Math.sin(e.t*2+i)));
    c.moveTo(0,-s);c.quadraticCurveTo(s,-s*.2,0,s);c.quadraticCurveTo(-s,-s*.2,0,-s);c.closePath();c.restore();}
   c.fillStyle=rgba(col,.42);c.fill();}},
 snow:{name:'雪',tags:['calm','emotional'],w:.9,plan:r=>({n:50+Math.floor(r()*30),v:.05+r()*.03,wind:(r()-.5)*.5,seed:Math.floor(r()*1000)}),
  // 奥と手前の2つの層。層ごとに全部の雪を1つの形にまとめて1回で塗る（重なった所が濃くならない。2つの層が重なっても 125/255 まで）。奥の雪は小さく、遅く、薄い
  draw(c,e,P){const S=Math.min(e.W,e.H),col=mixHex(e.fg,'#ffffff',.5);
   for(const [layer,al] of [[0,.18],[1,.38]]){c.beginPath();
    for(let i=layer;i<P.n;i+=2){const z=layer?.7+.3*hash(P.seed,i,1):.35+.3*hash(P.seed,i,1),u=fract(hash(P.seed,i,2)+e.t*P.v*z*1.8),y=u*e.H*1.1-e.H*.05,
     x=fract(hash(P.seed,i,3)+u*P.wind)*e.W+Math.sin(e.t*(.6+z)+i*1.3)*S*.02*z,r=Math.max(1,S*.012*z);c.moveTo(x+r,y);c.arc(x,y,r,0,TAU);}
    c.fillStyle=rgba(col,al);c.fill();}}},
 embers:{name:'火の粉',tags:['impact','emotional'],w:.8,
  plan:r=>({n:40+Math.floor(r()*20),v:.12+r()*.08,seed:Math.floor(r()*1000)}),
  draw(c,e,P){const g=c.createLinearGradient(0,e.H,0,e.H*.45);g.addColorStop(0,rgba('#ff5a1f',.18));g.addColorStop(1,rgba('#ff5a1f',0));c.fillStyle=g;c.fillRect(0,e.H*.45,e.W,e.H*.55);
   for(let i=0;i<P.n;i++){const u=fract(hash(P.seed,i,1)+e.t*P.v*(.6+.8*hash(P.seed,i,2))),x=hash(P.seed,i,3)*e.W+Math.sin(e.t*2+i*1.7)*e.H*.03*(1+u),y=e.H*(1.05-u*1.1),r=e.H*(.0025+.004*hash(P.seed,i,4))*(1-u*.6),a=(1-u)*(.5+.5*Math.sin(e.t*9+i));
    if(a<=.02)continue;c.fillStyle=rgba(i%3?'#ffb347':'#ff6a2a',clamp(a*.34));c.beginPath();c.arc(x,y,Math.max(.6,r),0,TAU);c.fill();}}},
 lightLeak:{name:'光漏れ',tags:['emotional','calm'],w:.9,
  plan:r=>({side:Math.floor(r()*4),ph:r()*TAU,a:.26+r()*.1}),
  draw(c,e,P){const pts=[[0,0],[1,0],[1,1],[0,1]],[ax,ay]=pts[P.side],[bx,by]=pts[(P.side+2)%4];
   [[ax,ay,'#ffb03a',1],[bx,by,'#ff5b2e',.6]].forEach(([u,v,col,k],i)=>{const br=.75+.25*Math.sin(e.t*.6+P.ph+i*2),R=e.H*(.9+.25*i)*br,x=e.W*u,y=e.H*v,g=c.createRadialGradient(x,y,0,x,y,R);
    g.addColorStop(0,rgba(col,P.a*k*br));g.addColorStop(.55,rgba(col,P.a*k*.35*br));g.addColorStop(1,rgba(col,0));c.fillStyle=g;c.fillRect(0,0,e.W,e.H);});}},
 aurora:{name:'オーロラ',tags:['calm','emotional'],w:.8,
  plan:r=>({n:3,ph:r()*TAU,v:.15+r()*.15}),
  draw(c,e,P){const step=Math.max(4,e.W/120);
   for(let k=0;k<P.n;k++){const g=c.createLinearGradient(0,e.H*.08,0,e.H*.72);g.addColorStop(0,rgba(k%2?'#8b5cf6':'#34d399',0));g.addColorStop(.35,rgba(k%2?'#8b5cf6':'#34d399',.16));g.addColorStop(1,rgba('#8b5cf6',0));c.fillStyle=g;
    c.beginPath();for(let x=0;x<=e.W+step;x+=step){const y=e.H*(.18+.06*k+.07*Math.sin(x/e.W*TAU*(1+k*.4)+e.t*P.v*(1+k*.3)+P.ph+k));x===0?c.moveTo(x,y):c.lineTo(x,y);}
    for(let x=e.W+step;x>=0;x-=step){const y=e.H*(.55+.06*k+.05*Math.sin(x/e.W*TAU*(1.3+k*.3)-e.t*P.v+P.ph*2+k));c.lineTo(x,y);}c.closePath();c.fill();}}},
 backlight:{name:'逆光の光条',tags:['emotional','graphic','calm'],w:.9,
  plan:r=>({x:.2+r()*.6,y:.15+r()*.3,v:sign(r)*(.01+r()*.015)}),
  draw(c,e,P){const x=e.W*(P.x+P.v*e.t%.4),y=e.H*P.y,R=e.H*.9,g=c.createRadialGradient(x,y,0,x,y,R);g.addColorStop(0,rgba('#ffb35c',.26));g.addColorStop(.4,rgba('#ff7a4a',.12));g.addColorStop(1,rgba('#ff7a4a',0));c.fillStyle=g;c.fillRect(0,0,e.W,e.H);
   for(const [h,a] of [[e.H*.012,.2],[e.H*.045,.08]]){const s=c.createLinearGradient(0,0,e.W,0);s.addColorStop(0,rgba('#7fd6ff',0));s.addColorStop(clamp(x/e.W),rgba('#7fd6ff',a));s.addColorStop(1,rgba('#7fd6ff',0));c.fillStyle=s;c.fillRect(0,y-h/2,e.W,h);}}},
 // ---- 後ろを流れる文字の背景（2026-10-17）。e.text はそのカットの歌詞（compose.js の envFor）
 bigText:{name:'流れる大きな文字',tags:['graphic','pop','impact'],w:.8,
  plan:r=>({rows:1+Math.floor(r()*2),v:sign(r)*(.04+r()*.04),a:.12+r()*.06}),
  draw(c,e,P){const txt=String(e.text||'LYRIC').replace(/\s+/g,' ').trim()+'  ',s=e.H*(P.rows>1?.36:.5);c.font=`900 ${s}px "U-dela","U-gothic",sans-serif`;c.textBaseline='middle';
   const tw=Math.max(e.H*.5,Number(c.measureText(txt).width)||0);c.strokeStyle=rgba(e.fg,P.a);c.lineWidth=Math.max(1,e.H/360);
   for(let k=0;k<P.rows;k++){const dir=k%2?-1:1,off=fract(e.t*P.v*dir)*tw,y=P.rows>1?e.H*(.3+.4*k):e.H*.5;for(let x=-off-tw;x<e.W+tw;x+=tw)c.strokeText(txt,x,y);}}},
 codeRain:{name:'降る文字の列',tags:['glitch','graphic'],w:.7,
  plan:r=>({cols:28+Math.floor(r()*16),v:.5+r()*.4,seed:Math.floor(r()*1000)}),
  draw(c,e,P){const cw=e.W/P.cols,s=cw*.8,len=12,CH='アイウエオカキクケコサシスセソ0123456789ABCDEFｦｱｳｴｵ';c.font=`${s}px ui-monospace,Menlo,monospace`;c.textAlign='center';c.textBaseline='top';
   for(let i=0;i<P.cols;i++){const sp=.6+.8*hash(P.seed,i,1),head=fract(hash(P.seed,i,2)+e.t*P.v*sp*.25)*(e.H+len*s)-len*s*.2,x=(i+.5)*cw;
    for(let j=0;j<len;j++){const y=head-j*s;if(y<-s||y>e.H)continue;const ch=CH[Math.floor(hash(P.seed+Math.floor(e.t*8+j),i,j)*CH.length)];c.fillStyle=j===0?rgba('#e6ffe9',.42):rgba(mixHex(e.accent,'#3bff8a',.6),.28*(1-j/len));c.fillText(ch,x,y);}}}},
 textWall:{name:'文字の壁',tags:['graphic','calm','glitch'],w:.7,
  plan:r=>({rows:7+Math.floor(r()*5),v:.03+r()*.03,a:.09+r()*.05}),
  draw(c,e,P){const txt=String(e.text||'LYRIC').replace(/\s+/g,' ').trim()+' · ',h=e.H/P.rows,s=h*.62;c.font=`700 ${s}px "U-gothic",sans-serif`;c.textBaseline='middle';
   const tw=Math.max(h,Number(c.measureText(txt).width)||0);c.fillStyle=rgba(e.fg,P.a);
   for(let k=0;k<P.rows;k++){const dir=k%2?-1:1,off=fract(e.t*P.v*dir*(1+k*.13)+k*.37)*tw,y=(k+.5)*h;for(let x=-off-tw;x<e.W+tw;x+=tw)c.fillText(txt,x,y);}}}
};

// ---- カメラ（文字レイヤー全体の変形） ----------------------------------------------------------------------------------------------------------
export const CAMERA={
 push:{name:'ゆっくり寄る',tags:['calm','emotional','graphic','pop','glitch','impact'],w:3,plan:()=>({a:.05}),get:(e,P)=>({s:1+P.a*inOutCubic(e.p)})},
 pull:{name:'引いていく',tags:['calm','emotional','graphic'],w:1.5,plan:()=>({a:.1}),get:(e,P)=>({s:1+P.a*(1-outCubic(e.p))})},
 drift:{name:'斜めドリフト',tags:['calm','emotional','graphic','pop'],w:1.5,plan:r=>({dx:sign(r)*(.6+r()*.4),dy:sign(r)*(.3+r()*.4)}),
  get:(e,P)=>({s:1.05,x:P.dx*e.W*.03*(e.p-.5),y:P.dy*e.H*.03*(e.p-.5)})},
 roll:{name:'ゆっくり傾く',tags:['emotional','pop','graphic'],w:1,strong:true,plan:r=>({a:sign(r)*(2+r()*2.5)}),get:(e,P)=>({s:1.05,rot:P.a*inOutCubic(e.p)})},
 shake:{name:'地震',tags:['impact','glitch','pop'],w:.8,strong:true,plan:r=>({amp:.7+r()*.6}),
  get:(e,P)=>{const s=Math.floor(e.t*24);return {s:1.03,x:(hash(s,1)-.5)*e.W*.012*P.amp,y:(hash(s,2)-.5)*e.H*.012*P.amp,rot:(hash(s,3)-.5)*.8*P.amp};}},
 snap:{name:'スナップパン',tags:['pop','impact','glitch','graphic'],w:1,strong:true,plan:r=>({dir:sign(r)}),get:(e,P)=>({s:1.02,x:P.dir*e.W*.14*(1-outExpo(e.lt/.2))})},
 punch:{name:'ズームパンチ',tags:['impact','pop','glitch'],w:1,strong:true,plan:r=>({a:.16+r()*.1}),get:(e,P)=>({s:1+P.a*(1-outExpo(e.lt/.24))})},
 dutch:{name:'ななめ構図',tags:['graphic','glitch','impact'],w:.8,plan:r=>({a:sign(r)*(3+r()*2.5)}),get:(e,P)=>({s:1.06+.03*e.p,rot:P.a})},
 float:{name:'ふわふわ浮く',tags:['calm','emotional'],w:1.2,plan:r=>({ph:r()*TAU}),
  get:(e,P)=>({s:1.03,y:Math.sin(e.t*1.4+P.ph)*e.H*.012,rot:Math.sin(e.t*.8+P.ph)*.6})},
 // ぼかし（blur は px。文字レイヤー全体に掛かる。ブラウザが canvas の filter を持たない時は掛からない）
 focusIn:{name:'ピント合わせ',tags:['emotional','calm','pop','graphic'],w:1.3,plan:r=>({b:.02+r()*.015}),
  get:(e,P)=>({s:1+.035*(1-outCubic(e.lt/.45)),blur:e.H*P.b*(1-outCubic(e.lt/.45))})},
 defocus:{name:'ピンぼけ',tags:['emotional','calm','glitch'],w:1,plan:r=>({b:.006+r()*.006,ph:r()*TAU}),
  get:(e,P)=>({s:1.02,blur:e.H*P.b*(.55+.45*Math.sin(e.t*1.7+P.ph))})},
 focusRack:{name:'ピントの出入り',tags:['emotional','pop','graphic','calm'],w:1,plan:r=>({b:.016+r()*.012}),
  get:(e,P)=>({s:1.015,blur:e.H*P.b*((1-smooth(e.lt/.28))+.6*smooth((e.lt-(e.dur-.28))/.28))})}
};

// ---- 画面効果（できあがった1フレームへの後処理。カットの頭で鳴って減衰） --------------------------------------------------------------------------
const grab=(c,e)=>{const s=e.tmp(0),x=s.getContext('2d');x.globalCompositeOperation='copy';x.drawImage(c.canvas,0,0);x.globalCompositeOperation='source-over';return s;};
// 下に別の絵があって、この層が透明なとき（e.opaque===false）の画面効果の作り方。
// 色を掛けて足し合わせる方法（multiply + lighter）や、全面に白を重ねる方法は、透明な所まで色や白で塗ってしまい、画面が真っ白になる。
// そこで、文字や図形の形だけを塗った色のコピー（tintOf）を、ずらして重ねる。ずらした帯は、元の帯を消してから置く（hole）。
const tintOf=(e,s,color)=>{const t=e.tmp(1),x=t.getContext('2d');x.globalCompositeOperation='copy';x.drawImage(s,0,0);x.globalCompositeOperation='source-in';x.fillStyle=color;x.fillRect(0,0,e.W,e.H);x.globalCompositeOperation='source-over';return t;};
const fringe=(c,e,s,list)=>{c.clearRect(0,0,e.W,e.H);for(const [col,dx,dy,sc] of list){c.globalAlpha=.75;c.drawImage(tintOf(e,s,col),dx+e.W*(1-sc)/2,dy+e.H*(1-sc)/2,e.W*sc,e.H*sc);}c.globalAlpha=1;c.drawImage(s,0,0);};
const hole=(c,e,x,y,w,h)=>{if(e.opaque===false)c.clearRect(x,y,w,h);};
/** 色を反転する（今の clip の中だけ）。下に絵がある時（s = 反転前の絵の写し）は、描いてある所の色だけを反転し、透明な所は透明のまま
 *  （前は白を 85% 重ねていた。画面いっぱいの板（抜き文字）があると、絵全体がほぼ白になったので、2026-10-18 に本当の反転にした） */
function invertIn(c,e,s){
 c.globalCompositeOperation='difference';c.fillStyle='#ffffff';c.fillRect(0,0,e.W,e.H);
 if(s){c.globalCompositeOperation='destination-in';c.drawImage(s,0,0);}
 c.globalCompositeOperation='source-over';
}
export const FX={
 chroma:{name:'色ズレの跳ね',tags:['glitch','pop','impact'],w:1.4,dur:.4,plan:r=>({s:.8+r()*.6,dir:sign(r)}),
  apply(c,e,P,k){const d=Math.max(1,e.W*.016*k*P.s),s=grab(c,e),t2=e.tmp(1),x=t2.getContext('2d');
   if(e.opaque===false)return fringe(c,e,s,[['#ff2a2a',-d*P.dir,-d*.35,1],['#2a5aff',d*P.dir,d*.35,1]]);
   c.globalCompositeOperation='source-over';c.clearRect(0,0,e.W,e.H);c.globalCompositeOperation='lighter';
   for(const [col,dx,dy] of [['#ff0000',-d,-d*.35],['#00ff00',0,0],['#0000ff',d,d*.35]]){x.globalCompositeOperation='copy';x.drawImage(s,0,0);x.globalCompositeOperation='multiply';x.fillStyle=col;x.fillRect(0,0,e.W,e.H);c.drawImage(t2,dx*P.dir,dy);}
   c.globalCompositeOperation='source-over';}},
 shake:{name:'揺れ',tags:['impact','pop','glitch'],w:1,dur:.35,plan:r=>({s:.8+r()*.5}),
  apply(c,e,P,k){const s=grab(c,e);c.clearRect(0,0,e.W,e.H);c.drawImage(s,(hash(e.step,1)-.5)*2*k*e.W*.025*P.s,(hash(e.step,2)-.5)*2*k*e.H*.025*P.s);}},
 slice:{name:'スライスグリッチ',tags:['glitch','graphic','impact'],w:1.2,dur:.35,plan:r=>({n:5+Math.floor(r()*5)}),
  apply(c,e,P,k){const s=grab(c,e);for(let i=0;i<P.n;i++){const y=hash(e.step,i,3)*e.H,h=e.H*(.03+.08*hash(e.step,i,4)),dx=(hash(e.step,i,5)-.5)*2*k*e.W*.12;hole(c,e,0,y,e.W,h);c.drawImage(s,0,y,e.W,h,dx,y,e.W,h);}}},
 flash:{name:'フラッシュ',tags:['pop','impact','emotional'],w:.9,dur:.28,strongFlash:true,plan:()=>({}),
  apply(c,e,P,k){c.fillStyle='#ffffff';c.globalAlpha=clamp(k*.55);c.fillRect(0,0,e.W,e.H);c.globalAlpha=1;}},
 zoomblur:{name:'ズームブラー',tags:['impact','pop','emotional'],w:1,dur:.38,plan:r=>({s:.8+r()*.5}),
  apply(c,e,P,k){const s=grab(c,e);for(let i=1;i<=6;i++){const sc=1+i*.03*k*P.s;c.globalAlpha=.16*k;c.drawImage(s,e.W*(1-sc)/2,e.H*(1-sc)/2,e.W*sc,e.H*sc);}c.globalAlpha=1;}},
 mosaic:{name:'モザイク',tags:['glitch','graphic'],w:.8,dur:.3,plan:r=>({px:14+Math.floor(r()*18)}),
  apply(c,e,P,k){const px=lerp(1,P.px,k),w=Math.max(2,Math.ceil(e.W/px)),h=Math.max(2,Math.ceil(e.H/px)),s=grab(c,e),sm=e.tmp(1,w,h),x=sm.getContext('2d');
   x.imageSmoothingEnabled=true;x.globalCompositeOperation='copy';x.drawImage(s,0,0,w,h);x.globalCompositeOperation='source-over';
   hole(c,e,0,0,e.W,e.H);c.imageSmoothingEnabled=false;c.drawImage(sm,0,0,w,h,0,0,e.W,e.H);c.imageSmoothingEnabled=true;}},
 block:{name:'ブロックグリッチ',tags:['glitch','graphic','impact'],w:1,dur:.3,plan:r=>({n:4+Math.floor(r()*5),inv:r()<.4}),
  apply(c,e,P,k){const s=grab(c,e);
   for(let i=0;i<P.n;i++){
    const w=e.W*(.08+.22*hash(e.step,i,11)),h=e.H*(.04+.14*hash(e.step,i,12)),x=hash(e.step,i,13)*(e.W-w),y=hash(e.step,i,14)*(e.H-h);
    const dx=(hash(e.step,i,15)-.5)*2*k*e.W*.18,dy=(hash(e.step,i,16)-.5)*k*e.H*.1;
    hole(c,e,x,y,w,h);c.drawImage(s,x,y,w,h,x+dx,y+dy,w,h);
    if(P.inv&&e.opaque!==false&&hash(e.step,i,17)<.5*k){c.save();c.globalCompositeOperation='difference';c.fillStyle='#ffffff';c.fillRect(x+dx,y+dy,w,h);c.restore();}
   }}},
 circleInvert:{name:'円の中だけ反転',tags:['graphic','impact','glitch'],w:.8,dur:.5,strongFlash:true,plan:r=>({cx:.5+(r()-.5)*.3,cy:.5+(r()-.5)*.3}),
  // 広がる輪の中だけ白黒（色）を反転する。輪の内側のふちも追いかけて広がるので、最後は何も残らない（2026-10-17）
  apply(c,e,P,k){const u=1-clamp(k),R=Math.hypot(e.W,e.H)*.62,ro=outCubic(u*1.15)*R,ri=Math.max(0,(u-.35)/.65)**2*R;if(ro<=ri+.5)return;
   const s=e.opaque===false?grab(c,e):null;
   c.save();c.beginPath();c.arc(e.W*P.cx,e.H*P.cy,ro,0,TAU);if(ri>.5)c.arc(e.W*P.cx,e.H*P.cy,ri,0,TAU,true);c.clip('evenodd');invertIn(c,e,s);c.restore();}},
 shockRing:{name:'暗転して衝撃波',tags:['impact','pop','glitch'],w:.8,dur:.45,strongFlash:true,plan:r=>({cx:.5+(r()-.5)*.2,cy:.5+(r()-.5)*.2}),
  // カットの頭の2コマ（0.08秒）だけ暗くしてから、輪が2つ広がる。下に写真や映像がある時（opaque===false）は、描いてある所の上だけに描く
  apply(c,e,P){const t=e.lt,R=Math.hypot(e.W,e.H)*.62;c.save();if(e.opaque===false)c.globalCompositeOperation='source-atop';
   if(t<.08){c.fillStyle='rgba(0,0,0,.82)';c.fillRect(0,0,e.W,e.H);c.restore();return;}
   for(const lag of [0,.07]){const v=clamp((t-.06-lag)/.36);if(v<=0||v>=1)continue;c.globalAlpha=(1-v)*.85;c.strokeStyle=lag?e.accent:mixHex(e.accent,'#ffffff',.6);c.lineWidth=Math.max(1.5,e.H*.035*(1-v));
    c.beginPath();c.arc(e.W*P.cx,e.H*P.cy,outCubic(v)*R,0,TAU);c.stroke();}
   c.restore();}},
 invert:{name:'反転',tags:['glitch','impact','graphic'],w:.7,dur:.12,strongFlash:true,plan:()=>({}),
  apply(c,e){const s=e.opaque===false?grab(c,e):null;c.save();invertIn(c,e,s);c.restore();}},
 radial:{name:'放射色収差',tags:['glitch','pop','impact','emotional'],w:1.1,dur:.4,plan:r=>({s:.7+r()*.6}),
  apply(c,e,P,k){const s=grab(c,e),t2=e.tmp(1),x=t2.getContext('2d'),a=.014*k*P.s;
   if(e.opaque===false)return fringe(c,e,s,[['#ff2a2a',0,0,1+a],['#2a5aff',0,0,1-a]]);
   c.globalCompositeOperation='source-over';c.clearRect(0,0,e.W,e.H);c.globalCompositeOperation='lighter';
   for(const [col,sc] of [['#ff0000',1+a],['#00ff00',1],['#0000ff',1-a]]){x.globalCompositeOperation='copy';x.drawImage(s,0,0);x.globalCompositeOperation='multiply';x.fillStyle=col;x.fillRect(0,0,e.W,e.H);c.drawImage(t2,e.W*(1-sc)/2,e.H*(1-sc)/2,e.W*sc,e.H*sc);}
   c.globalCompositeOperation='source-over';}},
 smear:{name:'横スミア',tags:['glitch','pop','impact'],w:.9,dur:.35,plan:r=>({dir:sign(r),n:7}),
  apply(c,e,P,k){const s=grab(c,e);for(let i=1;i<=P.n;i++){c.globalAlpha=.13*k*(1-i/(P.n+1));c.drawImage(s,P.dir*i*e.W*.012*k,0);}c.globalAlpha=1;}},
 tracking:{name:'VHSトラッキング',tags:['glitch','graphic','calm'],w:1,dur:.5,plan:r=>({n:3+Math.floor(r()*3)}),
  apply(c,e,P,k){const s=grab(c,e);
   for(let i=0;i<P.n;i++){const y=((hash(e.step>>1,i,21)+e.t*.18*(i+1))%1)*e.H,h=e.H*(.015+.05*hash(i,7,22)),dx=(hash(e.step,i,23)-.5)*2*k*e.W*.06;hole(c,e,0,y,e.W,h);c.drawImage(s,0,y,e.W,h,dx,y,e.W,h);}
   c.fillStyle=`rgba(0,0,0,${(.18*k).toFixed(3)})`;for(let y=0;y<e.H;y+=4)c.fillRect(0,y,e.W,2);}},
 bloom:{name:'ブルーム',tags:['emotional','calm','pop','glitch'],w:1.1,dur:.45,plan:r=>({s:.8+r()*.5}),
  apply(c,e,P,k){const s=grab(c,e),w=Math.max(8,Math.round(e.W/10)),h=Math.max(6,Math.round(e.H/10)),sm=e.tmp(1,w,h),x=sm.getContext('2d');
   x.imageSmoothingEnabled=true;x.globalCompositeOperation='copy';x.drawImage(s,0,0,w,h);x.globalCompositeOperation='source-over';
   // 明るい所が絵の広い範囲を占める時（画面いっぱいの板・大きな吹き出しなど）は、足すと白く飛ぶので弱める（2026-10-18。ブルームは光る所のまわりのにじみ）
   //  明るさは、縮めた絵の平均（不透明度 × 明るさ。0..1）。文字だけの絵は 0.1 ほどで、ほぼ元の強さ。半分ほど明るい板では消える
   let sum=0,all=0;try{const d=x.getImageData(0,0,w,h).data;for(let i=0;i<d.length;i+=4){all++;sum+=d[i+3]/255*(d[i]+d[i+1]+d[i+2])/765;}}catch{}
   const gain=clamp(1-(all?sum/all:0)*1.8);
   c.save();c.globalCompositeOperation='lighter';c.globalAlpha=clamp(.7*k*P.s*gain);c.imageSmoothingEnabled=true;c.drawImage(sm,0,0,w,h,0,0,e.W,e.H);c.restore();}}
};

// ---- つなぎ（前カットの最後の絵 A と、今カットの絵 B を合成） ------------------------------------------------------------------------------------
const dirP=r=>({dir:pickW(r,['L','R','U','D'],[3,2,1.4,.8])});
const dirInfo=(d,e)=>{const h=d==='L'||d==='R';return {h,sg:d==='L'||d==='U'?-1:1,L:h?e.W:e.H};};
const edgeBar=(c,e,p,x,y,w,h)=>{c.globalAlpha=Math.pow(bell(p),.6);c.fillStyle=e.accent;c.fillRect(x,y,w,h);c.globalAlpha=1;};
export const TRANS={
 flash:{name:'フラッシュ転換',tags:['pop','impact','emotional','glitch'],w:1,dur:.3,strongFlash:true,plan:()=>({}),
  draw(c,A,B,p,e){c.drawImage(p<.5?A:B,0,0);c.globalAlpha=Math.pow(bell(p),.7)*.7;c.fillStyle='#ffffff';c.fillRect(0,0,e.W,e.H);c.globalAlpha=1;}},
 push:{name:'プッシュ',tags:['graphic','pop','calm','impact'],w:1.2,dur:.35,plan:dirP,
  draw(c,A,B,p,e,P){const {h,sg,L}=dirInfo(P.dir,e),off=Math.round(inOutCubic(p)*L)*sg;
   if(h){c.drawImage(A,off,0);c.drawImage(B,off-sg*e.W,0);edgeBar(c,e,p,(sg<0?e.W+off:off)-e.W*.003,0,e.W*.006,e.H);}
   else{c.drawImage(A,0,off);c.drawImage(B,0,off-sg*e.H);edgeBar(c,e,p,0,(sg<0?e.H+off:off)-e.H*.003,e.W,e.H*.006);}}},
 cover:{name:'カバー',tags:['calm','graphic','emotional'],w:1,dur:.35,plan:dirP,
  draw(c,A,B,p,e,P){const {h,sg,L}=dirInfo(P.dir,e),q=inOutCubic(p),bo=Math.round((1-q)*L)*-sg,ao=Math.round(q*L*.16)*sg;
   const dim=()=>{if(e.opaque===false){c.globalAlpha=1-.45*q;return true;}c.globalAlpha=1;return false;};   // 透明な絵では、前の絵だけを暗くする（下の絵まで暗くしない）
   const shade=()=>{c.fillStyle='#000';c.globalAlpha=.45*q;c.fillRect(0,0,e.W,e.H);c.globalAlpha=1;};
   if(h){const t=dim();c.drawImage(A,ao,0);c.globalAlpha=1;if(!t)shade();c.drawImage(B,bo,0);}
   else{const t=dim();c.drawImage(A,0,ao);c.globalAlpha=1;if(!t)shade();c.drawImage(B,0,bo);}}},
 uncover:{name:'アンカバー',tags:['calm','graphic','pop'],w:.9,dur:.35,plan:dirP,
  draw(c,A,B,p,e,P){const {h,sg,L}=dirInfo(P.dir,e),q=inOutCubic(p),ao=Math.round(q*L)*sg,bo=Math.round((1-q)*L*.16)*-sg;
   if(h){c.drawImage(B,bo,0);c.drawImage(A,ao,0);}else{c.drawImage(B,0,bo);c.drawImage(A,0,ao);}}},
 iris:{name:'アイリスイン',tags:['emotional','pop','graphic','calm'],w:1,dur:.4,plan:r=>({x:.5+(r()-.5)*.24,y:.5+(r()-.5)*.2}),
  draw(c,A,B,p,e,P){const cx=e.W*P.x,cy=e.H*P.y,R=Math.hypot(Math.max(cx,e.W-cx),Math.max(cy,e.H-cy))+4,r=R*inOutCubic(p);
   c.drawImage(A,0,0);if(r>.5){c.save();c.beginPath();c.arc(cx,cy,r,0,TAU);c.clip();c.drawImage(B,0,0);c.restore();}
   c.globalAlpha=Math.pow(bell(p),.6);c.strokeStyle=e.accent;c.lineWidth=Math.max(2,e.H*.009);c.beginPath();c.arc(cx,cy,r+c.lineWidth/2,0,TAU);c.stroke();c.globalAlpha=1;}},
 slash:{name:'斜め帯ワイプ',tags:['impact','graphic','pop','glitch'],w:1.1,dur:.4,plan:r=>({slope:.35+r()*.35,flip:r()<.5}),
  draw(c,A,B,p,e,P){const s=e.H*P.slope,edge=lerp(-s,e.W+s,inOutCubic(p));
   c.drawImage(A,0,0);c.save();if(P.flip){c.translate(e.W,0);c.scale(-1,1);}
   c.beginPath();c.moveTo(0,0);c.lineTo(edge+s/2,0);c.lineTo(edge-s/2,e.H);c.lineTo(0,e.H);c.closePath();c.save();c.clip();
   if(P.flip){c.translate(e.W,0);c.scale(-1,1);}c.drawImage(B,0,0);c.restore();
   c.globalAlpha=Math.pow(bell(p),.6);c.strokeStyle=e.accent;c.lineWidth=Math.max(3,e.H*.014);c.beginPath();c.moveTo(edge+s/2,0);c.lineTo(edge-s/2,e.H);c.stroke();c.restore();c.globalAlpha=1;}},
 blinds:{name:'ブラインド転換',tags:['graphic','glitch','calm'],w:.9,dur:.45,plan:r=>({n:6+2*Math.floor(r()*4)}),
  draw(c,A,B,p,e,P){c.drawImage(A,0,0);const sh=e.H/P.n;for(let i=0;i<P.n;i++){const u=clamp(p*1.6-i/P.n*.6);if(u>0)c.drawImage(B,0,i*sh,e.W,sh*u,0,i*sh,e.W,sh*u);}}},
 clock:{name:'クロックワイプ',tags:['graphic','pop','emotional'],w:.8,dur:.45,plan:r=>({flip:r()<.5}),
  draw(c,A,B,p,e,P){const cx=e.W/2,cy=e.H/2,R=Math.hypot(cx,cy)+4,a0=-Math.PI/2,a1=a0+(P.flip?-1:1)*TAU*inOutCubic(p);
   c.drawImage(A,0,0);c.save();c.beginPath();c.moveTo(cx,cy);c.arc(cx,cy,R,a0,a1,!!P.flip);c.closePath();c.clip();c.drawImage(B,0,0);c.restore();
   c.globalAlpha=Math.pow(bell(p),.6);c.strokeStyle=e.accent;c.lineWidth=Math.max(2,e.H*.008);c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+Math.cos(a1)*R,cy+Math.sin(a1)*R);c.stroke();c.globalAlpha=1;}},
 checker:{name:'市松転換',tags:['pop','graphic','glitch'],w:.9,dur:.45,plan:r=>({n:10+2*Math.floor(r()*4),seed:Math.floor(r()*1e6)}),
  draw(c,A,B,p,e,P){c.drawImage(A,0,0);const cw=e.W/P.n,rows=Math.ceil(e.H/cw);
   for(let j=0;j<rows;j++)for(let i=0;i<P.n;i++){const u=outCubic(clamp(p*1.5-hash(P.seed,i,j)*.5));if(u<=0)continue;const x=i*cw,y=j*cw,w=Math.min(cw,e.W-x),h=Math.min(cw,e.H-y);
    c.drawImage(B,x,y,w,h,x+w/2*(1-u),y+h/2*(1-u),w*u,h*u);}}}
};

/** グループ名 → [キー, 部品] の並び（画面の選択肢と、選び方の候補に使う） */
// 毎日のルーティンで足した部品（daily-parts.js）を、表の末尾につなぐ
addDailyParts({bg:BG,cam:CAMERA,fx:FX,trans:TRANS},DAILY_CUT_PARTS);
export const GROUPS={bg:BG,cam:CAMERA,fx:FX,trans:TRANS};
export const GROUP_NAMES={bg:'BG',cam:'CAM',fx:'FX',trans:'TRANS'};
export const partName=(group,key)=>GROUPS[group]?.[key]?.name||'なし';
