// カット演出の「物の世界」のレイアウト。文字が、チケット・フィルム・升目・リボンなどの「物」の上に載る構図。
// 世界は「文字を置く領域（箱）」と「その後ろ/前に描く物」と「全体の入り・出」を決める。文字は段階2の字ごとの部品（登場・保持・退場・加工）がそのまま動く。
// DOM には触らない（描く関数は ctx を受け取る。node で偽のキャンバスを渡して動かせる）。
//
// 世界の契約:
//   plan(r, cut) → P                     保存して再現できる値
//   fits(n)                              n 字までなら置ける
//   frame(P, {W,H,n,D,exitOK}) → {box:{cx,cy,w,h}, mode?, cols?, curve?, align?, maxWidth?, delay, ...}
//                                         文字を置く箱と配置の種類（wrap|grid|path）。delay は、物が出てくるまで文字を待たせる秒数
//   xform(c, e, P, F)                    物と文字をまとめて動かす（入り・出・傾き）
//   back(c, e, P, F, item) / front(...)  文字の後ろ/前に描く物。item は配置済みの文字アイテム（行・字の位置を読める）
//   textColor(P, cut) → 色               物の上で読める文字色
//   arrange(item, P)                     字ごとの調整（色・傾き・書体）
// e = {W,H,t,lt,D,inW,outW,pIn,pOut,fg,accent,bg}   pIn: 物の入り 0→1、pOut: 物の出 0→1（exitOK のカットだけ）
import {renderText,buildItem,DEG,TAU} from './glyphs.js';
import {rgba,mixHex} from './parts.js';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,u)=>a+(b-a)*u;
const outCubic=x=>1-(1-clamp(x))**3;
const inCubic=x=>clamp(x)**3;
const outBack=(x,s=1.70158)=>{x=clamp(x)-1;return 1+(s+1)*x*x*x+s*x*x;};
const bounceOut=x=>{x=clamp(x);const n=7.5625,d=2.75;return x<1/d?n*x*x:x<2/d?n*(x-=1.5/d)*x+.75:x<2.5/d?n*(x-=2.25/d)*x+.9375:n*(x-=2.625/d)*x+.984375;};
const fract=x=>x-Math.floor(x);
const hash=(a,b=0,c=0)=>fract(Math.sin(a*127.1+b*311.7+c*74.7)*43758.5453);
const sign=r=>r()<.5?-1:1;
const pickW=(r,items,weights)=>{let x=r()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<items.length;i++){x-=weights[i];if(x<=0)return items[i];}return items.at(-1);};
const luma=hex=>{const n=parseInt(String(hex).slice(1,7),16)||0;return (.2126*(n>>16&255)+.7152*(n>>8&255)+.0722*(n&255))/255;};
const contrast=hex=>luma(hex)>.55?'#14141c':'#ffffff';
const rr=(c,x,y,w,h,r)=>{r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();};
/** 世界の入り・出にかける秒数。出は、次がすぐ続かないカット（exitOK）だけ */
export function worldTimes(D,exitOK){return {inW:clamp(D*.3,.14,.36),outW:exitOK?clamp(D*.2,.1,.28):0};}
const dly=(D,exitOK,k)=>worldTimes(D,exitOK).inW*k;
const FONTS=['gothic','mincho','round','marker','dela','dot'];

export const WORLD={
 ticket:{name:'チケット',tags:['pop','graphic'],w:1.1,fits:n=>n<=16,
  box:(P,F,it,W,H)=>({cx:W/2,cy:H/2,w:F.g.tw,h:F.g.th,rot:P.tilt}),
  plan:r=>({tilt:sign(r)*(2+r()*4),fill:pickW(r,['accent','ink','paper'],[1.4,1,1]),label:pickW(r,['ADMIT ONE','LIVE','TICKET','VIP'],[1,1,1,.6]),serial:1+Math.floor(r()*999999)}),
  geo(W,H){const tw=Math.min(W*.84,H*1.9);return {tw,th:tw*.36,stubW:tw*.22};},
  plate:(P,accent)=>P.fill==='accent'?accent:P.fill==='ink'?'#1b1b26':'#f2ecdc',
  frame(P,{W,H,D,exitOK}){const g=this.geo(W,H),left=W/2-g.tw/2+g.th*.12,right=W/2-g.tw/2+g.tw-g.stubW-g.th*.12;
   return {box:{cx:(left+right)/2,cy:H/2,w:right-left,h:g.th*.56},g,delay:dly(D,exitOK,.55)};},
  textColor(P,cut){return contrast(this.plate(P,cut.emphasisColor));},
  xform(c,e,P){const eIn=outBack(e.pIn,1.2),eOut=inCubic(e.pOut);c.translate(e.W/2,e.H/2+(1-eIn)*e.H*.7+eOut*e.H*.5);c.rotate((P.tilt*(1-eOut*.5)+(1-eIn)*10)*DEG);c.translate(-e.W/2,-e.H/2);},
  back(c,e,P,F){
   const {tw,th,stubW}=F.g,x0=e.W/2-tw/2,y0=e.H/2-th/2,plate=this.plate(P,e.accent),tc=contrast(plate),px0=x0+tw-stubW,nr=th*.075;
   c.save();c.shadowColor='rgba(0,0,0,.4)';c.shadowBlur=18;c.shadowOffsetY=8;c.fillStyle=plate;rr(c,x0,y0,tw,th,th*.05);c.fill();c.restore();
   c.fillStyle=e.bg;c.beginPath();c.arc(px0,y0,nr,0,TAU);c.fill();c.beginPath();c.arc(px0,y0+th,nr,0,TAU);c.fill();
   c.fillStyle=rgba(tc,.55);for(let y=y0+nr*2;y<y0+th-nr*2;y+=th*.06)c.fillRect(px0-1.5,y,3,th*.03);
   const s=Math.max(11,th*.07);c.font=`700 ${s}px ui-monospace,Menlo,monospace`;c.textBaseline='middle';c.textAlign='left';c.fillStyle=rgba(tc,.8);
   c.fillText(`${P.label}  ·  No.${String(P.serial).padStart(6,'0')}`,x0+th*.12,y0+th*.12);
   c.fillText(`GATE ${String.fromCharCode(65+P.serial%6)}   ROW ${String(1+P.serial%30).padStart(2,'0')}   SEAT ${String(1+(P.serial>>3)%40).padStart(2,'0')}`,x0+th*.12,y0+th-th*.12);
   c.fillStyle=rgba(tc,.35);c.fillRect(x0+th*.12,y0+th*.22,tw-stubW-th*.24,1.5);c.fillRect(x0+th*.12,y0+th-th*.22,tw-stubW-th*.24,1.5);
   c.save();c.translate(px0+stubW*.32,y0+th/2);c.rotate(-Math.PI/2);c.textAlign='center';c.fillStyle=rgba(tc,.85);c.fillText(P.label,0,0);c.restore();
   for(let i=0,y=y0+th*.15;i<40&&y<y0+th*.85;i++){const h=th*(.006+.014*hash(P.serial,i,3));c.fillStyle=rgba(tc,.8);c.fillRect(px0+stubW*.55,y,stubW*.3,h);y+=h+th*(.005+.01*hash(P.serial,i,4));}
  }},

 film:{name:'フィルム',tags:['emotional','calm','graphic'],w:1,fits:n=>n<=16,
  box:(P,F,it,W,H)=>({cx:W/2,cy:H/2,w:W*.7,h:F.sh,rot:P.tilt}),
  plan:r=>({tilt:sign(r)*(.8+r()*1.8),speed:sign(r)*(50+r()*70),dir:sign(r)}),
  frame(P,{W,H,D,exitOK}){const sh=H*.52;return {box:{cx:W/2,cy:H/2,w:W*.64,h:sh*.6},sh,delay:dly(D,exitOK,.55)};},
  xform(c,e,P){const eIn=outCubic(e.pIn),eOut=inCubic(e.pOut);c.translate(e.W/2+(1-eIn)*e.W*P.dir-eOut*e.W*P.dir,e.H/2);c.rotate(P.tilt*DEG);c.translate(-e.W/2,-e.H/2);},
  back(c,e,P,F){
   const sh=F.sh,y0=e.H/2-sh/2,x0=-e.W*.15,x1=e.W*1.15,pitch=sh*.16,hw=pitch*.5,hh=sh*.07;
   c.fillStyle='#0b0b0e';c.fillRect(x0,y0,x1-x0,sh);c.strokeStyle=rgba(e.fg,.22);c.lineWidth=2;c.strokeRect(x0,y0,x1-x0,sh);
   const off=((e.t*P.speed)%pitch+pitch)%pitch;c.fillStyle='rgba(216,210,196,.85)';
   for(let x=x0-pitch+off;x<x1;x+=pitch){rr(c,x,y0+sh*.03,hw,hh,hh*.3);c.fill();rr(c,x,y0+sh-sh*.03-hh,hw,hh,hh*.3);c.fill();}
   const cw=F.box.w+16,ch=F.box.h+16,cx=e.W/2,cy=e.H/2;
   for(const k of [-1,1]){c.fillStyle='#15151a';c.fillRect(cx+k*(cw+22)-cw/2,cy-ch/2,cw,ch);}
   c.fillStyle=mixHex('#0b0b0e',e.accent,.14);c.fillRect(cx-cw/2,cy-ch/2,cw,ch);c.strokeStyle=rgba(e.fg,.4);c.lineWidth=2;c.strokeRect(cx-cw/2,cy-ch/2,cw,ch);
   c.font=`700 ${Math.max(10,sh*.05)}px ui-monospace,Menlo,monospace`;c.fillStyle=rgba(e.accent,.9);c.textAlign='left';c.textBaseline='middle';c.fillText('▶ '+String(12+Math.floor(e.t*3)%24)+'A',cx-cw/2+6,y0+sh*.03+hh*2.2);
  }},

 grid:{name:'升目',tags:['graphic','glitch'],w:1.3,fits:n=>n<=24,
  plan:r=>({numbered:r()<.7,accentCell:r()<.8}),
  frame(P,{W,H,n,D,exitOK}){const cols=n<=8?Math.max(1,n):Math.ceil(n/Math.ceil(n/8)),rows=Math.ceil(n/cols),cell=Math.min(W*.86/cols,H*.72/rows,150);
   return {box:{cx:W/2,cy:H/2,w:cell*cols,h:cell*rows},mode:'grid',cols,rows,cell,delay:dly(D,exitOK,.45),maxWidth:1};},
  arrange(item,P){if(P.accentCell&&item.glyphs.length)item.glyphs.at(-1).color=contrast(item.accent);},
  xform(c,e){c.globalAlpha*=1-outCubic(e.pOut);},
  back(c,e,P,F,item){
   const ox=F.box.cx-F.box.w/2,oy=F.box.cy-F.box.h/2,cnt=item.glyphs.length;
   item.glyphs.forEach((g,i)=>{
    const u=outCubic(clamp(e.pIn*1.6-i/Math.max(1,cnt)*.6));if(u<=0)return;
    const cell=g.cell,cx=ox+cell.x+cell.w/2,cy=oy+cell.y+cell.w/2;
    c.save();c.translate(cx,cy);c.scale(u,u);
    if(P.accentCell&&i===cnt-1){c.fillStyle=e.accent;c.fillRect(-cell.w/2,-cell.w/2,cell.w,cell.w);}
    c.strokeStyle=rgba(e.fg,.6);c.lineWidth=2;c.strokeRect(-cell.w/2,-cell.w/2,cell.w,cell.w);
    if(P.numbered){c.font=`${Math.max(9,cell.w*.11)}px ui-monospace,Menlo,monospace`;c.fillStyle=rgba(e.fg,.55);c.textAlign='left';c.textBaseline='top';c.fillText(String(i+1).padStart(2,'0'),-cell.w/2+4,-cell.w/2+3);}
    c.restore();
   });
  }},

 ribbon:{name:'リボン',tags:['emotional','pop','calm'],w:1,fits:n=>n<=16,
  box:(P,F,it,W,H)=>({cx:W/2,cy:H/2,w:W*.9,h:it.size*1.7+2*P.amp*H,rot:0}),
  plan:r=>({amp:.04+r()*.05,k:.5+r()*.6,ph:r()*TAU,dark:r()<.4}),
  frame(P,{W,H,D,exitOK}){return {box:{cx:W/2,cy:H/2,w:W*.84,h:H*.3},mode:'path',curve:{amp:H*P.amp,k:P.k,ph:P.ph},delay:dly(D,exitOK,.3),maxWidth:.96};},
  textColor(P,cut){return contrast(P.dark?'#1b1b26':cut.emphasisColor);},
  back(c,e,P,F,item){
   const col=P.dark?'#1b1b26':e.accent,band=item.size*1.7,L=Math.max(1,item.bbox.x1-item.bbox.x0);
   const A=P.amp*e.H,y=x=>e.H/2+A*Math.sin((x-e.W/2)/L*TAU*P.k+P.ph);
   c.save();c.beginPath();c.rect(e.W*outCubic(e.pOut),0,e.W*outCubic(e.pIn)-e.W*outCubic(e.pOut)+1,e.H);c.clip();
   c.lineCap='butt';c.lineJoin='round';
   for(const [dy,color,w] of [[band*.1,'rgba(0,0,0,.3)',band],[0,col,band],[0,rgba(contrast(col),.35),Math.max(2,band*.04)]]){
    c.strokeStyle=color;c.lineWidth=w;c.beginPath();
    for(let x=-10;x<=e.W+10;x+=8){const yy=y(x)+dy;if(x<0)c.moveTo(x,yy);else c.lineTo(x,yy);}
    c.stroke();
   }
   c.restore();
  }},

 card:{name:'ポスターカード',tags:['calm','emotional','graphic'],w:1,fits:n=>n<=24,
  box:(P,F,it,W,H)=>({cx:W/2,cy:H/2,w:F.card.cw,h:F.card.ch,rot:P.tilt}),
  plan:r=>({tilt:sign(r)*(1.5+r()*3),paper:pickW(r,['#f4efe2','#ffffff','#ffe3b0','#d6ebff'],[2,1,1,1]),no:1+Math.floor(r()*99)}),
  frame(P,{W,H,D,exitOK}){const cw=W*.7,ch=H*.62;return {box:{cx:W/2,cy:H/2,w:cw*.84,h:ch*.7},card:{cw,ch},delay:dly(D,exitOK,.55)};},
  textColor:()=>'#14141c',
  xform(c,e,P){const eIn=outBack(e.pIn,1.1),eOut=inCubic(e.pOut),s=.7+.3*eIn;c.translate(e.W/2,e.H/2+eOut*e.H*.8);c.rotate((P.tilt+(1-eIn)*-14+eOut*20)*DEG);c.scale(s,s);c.translate(-e.W/2,-e.H/2);c.globalAlpha*=clamp(e.pIn*2);},
  back(c,e,P,F){
   const {cw,ch}=F.card,x=e.W/2-cw/2,y=e.H/2-ch/2;
   c.save();c.shadowColor='rgba(0,0,0,.45)';c.shadowBlur=24;c.shadowOffsetY=10;c.fillStyle=P.paper;rr(c,x,y,cw,ch,16);c.fill();c.restore();
   c.strokeStyle='rgba(20,20,28,.5)';c.lineWidth=2;const m=ch*.06,L=ch*.05;
   for(const [px,py,sx,sy] of [[x+m,y+m,1,1],[x+cw-m,y+m,-1,1],[x+m,y+ch-m,1,-1],[x+cw-m,y+ch-m,-1,-1]]){c.beginPath();c.moveTo(px,py+sy*L);c.lineTo(px,py);c.lineTo(px+sx*L,py);c.stroke();}
   c.font=`700 ${Math.max(10,ch*.034)}px ui-monospace,Menlo,monospace`;c.fillStyle='rgba(20,20,28,.55)';c.textAlign='left';c.textBaseline='middle';c.fillText('N° '+String(P.no).padStart(3,'0'),x+m*2.2,y+m*1.3);
  }},

 tape:{name:'テープ',tags:['pop','impact','graphic'],w:1,fits:n=>n<=24,
  plan:(r,cut)=>({tilts:[0,1,2,3].map(()=>(r()*2.4-1.2)),cols:[cut.emphasisColor,'#f4efe2',mixHex(cut.emphasisColor,'#ffffff',.5),'#e45a8c'].sort(()=>r()-.5)}),
  frame(P,{W,H,D,exitOK}){return {box:{cx:W/2,cy:H/2,w:W*.78,h:H*.5},delay:dly(D,exitOK,.5),maxWidth:.94};},
  arrange(item,P){for(const g of item.glyphs)g.color=contrast(P.cols[g.line%P.cols.length]);},
  back(c,e,P,F,item){
   const ox=F.box.cx-F.box.w/2,oy=F.box.cy-F.box.h/2;
   item.lines.forEach((l,i)=>{
    const prog=outCubic(clamp(e.pIn*1.5-i*.25));if(prog<=0)return;
    const pad=l.h*.4,x0=ox+l.x0-pad,w=(l.x1-l.x0+pad*2)*prog,cy=oy+l.cy,h=l.h*1.1,t=h/6;
    c.save();c.translate(ox+(l.x0+l.x1)/2,cy);c.rotate(P.tilts[i%4]*DEG);c.translate(-(ox+(l.x0+l.x1)/2),-cy);
    c.fillStyle=P.cols[i%P.cols.length];c.globalAlpha*=.96;c.beginPath();c.moveTo(x0,cy-h/2);c.lineTo(x0+w,cy-h/2);
    for(let k=0;k<=6;k++)c.lineTo(x0+w+(k%2?h*.06:0),cy-h/2+k*t);
    c.lineTo(x0,cy+h/2);for(let k=6;k>=0;k--)c.lineTo(x0+(k%2?-h*.06:0),cy-h/2+k*t);c.closePath();c.fill();c.restore();
   });
  }},

 bubble:{name:'吹き出し',tags:['pop','emotional'],w:1,fits:n=>n<=14,
  box:(P,F,it,W,H)=>({cx:W/2,cy:H/2-H*.03,w:F.bub.w,h:F.bub.h,rot:P.tilt}),
  plan:r=>({tail:pickW(r,['bl','br','bc'],[1,1,.6]),tilt:sign(r)*(1+r()*2.5)}),
  tip(P,W,H){return {x:W/2+(P.tail==='bl'?-.2:P.tail==='br'?.2:0)*W,y:H/2+H*.36};},
  frame(P,{W,H,D,exitOK}){return {box:{cx:W/2,cy:H/2-H*.03,w:W*.64,h:H*.4},bub:{w:W*.76,h:H*.56},maxWidth:.94,delay:dly(D,exitOK,.5)};},
  textColor:()=>'#14141c',
  xform(c,e,P){const tip=this.tip(P,e.W,e.H),s=Math.max(.01,(.5+.5*outBack(e.pIn,1.6))*(1-outCubic(e.pOut)));c.translate(tip.x,tip.y);c.rotate(P.tilt*DEG);c.scale(s,s);c.translate(-tip.x,-tip.y);},
  back(c,e,P,F){
   const {w,h}=F.bub,cx=e.W/2,cy=e.H/2-e.H*.03,tip=this.tip(P,e.W,e.H),by=cy+h/2,bx=tip.x*.55+cx*.45;
   c.save();c.shadowColor='rgba(0,0,0,.4)';c.shadowBlur=16;c.shadowOffsetY=8;c.fillStyle='#ffffff';c.strokeStyle='#14141c';c.lineWidth=6;c.lineJoin='round';
   rr(c,cx-w/2,cy-h/2,w,h,h*.45);c.fill();c.stroke();c.restore();
   c.fillStyle='#ffffff';c.strokeStyle='#14141c';c.lineWidth=6;c.beginPath();c.moveTo(bx-e.W*.04,by-3);c.lineTo(tip.x,tip.y);c.lineTo(bx+e.W*.04,by-3);c.stroke();c.fill();
   c.fillStyle='#ffffff';c.fillRect(bx-e.W*.04+3,by-9,e.W*.08-6,12);
  }},

 telop:{name:'字幕帯',tags:['graphic','impact','glitch'],w:1,fits:n=>n<=24,
  box:(P,F,it,W,H)=>({cx:W*.03+F.bar.w/2,cy:F.box.cy,w:F.bar.w,h:F.bar.h,rot:0}),
  plan:r=>({y:.66+r()*.14}),
  frame(P,{W,H,D,exitOK}){const bh=H*.24;return {box:{cx:W*.52,cy:H*P.y,w:W*.78,h:bh*.7},bar:{w:W*.94,h:bh},mode:'wrap',align:'left',delay:dly(D,exitOK,.4),maxWidth:.98};},
  textColor:()=>'#ffffff',
  back(c,e,P,F){
   const {w,h}=F.bar,y=F.box.cy-h/2,x0=e.W*.03,x1=x0+w;
   c.save();c.beginPath();c.rect(x0+w*outCubic(e.pOut),y-4,w*outCubic(e.pIn)-w*outCubic(e.pOut)+2,h+8);c.clip();
   c.fillStyle=mixHex(e.bg,'#ffffff',.16);c.fillRect(x0,y,w,h);c.fillStyle=rgba(e.accent,.6);c.fillRect(x0,y,w,2);c.fillRect(x0,y+h-2,w,2);c.fillStyle=e.accent;c.fillRect(x0,y,e.W*.014,h);
   c.font=`700 ${Math.max(10,h*.13)}px ui-monospace,Menlo,monospace`;c.fillStyle=e.accent;c.textAlign='left';c.textBaseline='top';c.fillText('LYRIC',x0+e.W*.03,y+h*.08);
   c.fillStyle=rgba(e.fg,.25);c.fillRect(x0+e.W*.03,y+h*.26,w*.5,1.5);c.restore();
  }},

 ransom:{name:'切り抜き文字',tags:['impact','pop','glitch'],w:.9,fits:n=>n<=12,
  plan:r=>({seed:Math.floor(r()*1e6)}),
  pairs:[['#faf9f4','#141316'],['#ece8dc','#141316'],['#141316','#faf9f4'],['#e45a8c','#faf9f4'],['#f4d632','#141316'],['#60b6ba','#141316']],
  frame(P,{W,H,D,exitOK}){return {box:{cx:W/2,cy:H/2,w:W*.84,h:H*.5},delay:dly(D,exitOK,.3),maxWidth:.95};},
  arrange(item,P){item.glyphs.forEach((g,i)=>{const pr=this.pairs[Math.floor(hash(P.seed,i)*this.pairs.length)];g.color=pr[1];g.plate=pr[0];g.rot0=(hash(P.seed,i,2)-.5)*12;g.fontKey=FONTS[Math.floor(hash(P.seed,i,3)*FONTS.length)];});},
  back(c,e,P,F,item){
   const ox=F.box.cx-F.box.w/2,oy=F.box.cy-F.box.h/2,n=item.glyphs.length;
   item.glyphs.forEach((g,i)=>{
    const u=outBack(clamp(e.pIn*1.6-i/Math.max(1,n)*.6),1.4);if(u<=0)return;
    c.save();c.translate(ox+g.cx,oy+g.cy);c.rotate(g.rot0*DEG);c.scale(u,u);c.shadowColor='rgba(0,0,0,.35)';c.shadowBlur=6;c.shadowOffsetY=3;
    c.fillStyle=g.plate;c.fillRect(-g.size*.58,-g.size*.62,g.size*1.16,g.size*1.24);c.restore();
   });
  }},

 sticker:{name:'ステッカー',tags:['pop','impact'],w:.8,fits:n=>n<=8,
  box:(P,F,it,W,H)=>F.pill?{cx:W/2,cy:H/2,w:F.R*2.4,h:F.R*1.0,rot:P.tilt}:{cx:W/2,cy:H/2,w:F.R*1.5,h:F.R*1.5,rot:P.tilt},
  plan:r=>({tilt:sign(r)*(4+r()*8),burst:12+2*Math.floor(r()*4),dark:r()<.4}),
  frame(P,{W,H,n,D,exitOK}){const R=H*.36,pill=n>5;return {box:pill?{cx:W/2,cy:H/2,w:R*2.1,h:R*.9}:{cx:W/2,cy:H/2,w:R*1.5,h:R*1.1},R,pill,delay:dly(D,exitOK,.5)};},
  textColor:P=>P.dark?'#ffffff':'#14141c',
  xform(c,e,P){const eIn=outBack(e.pIn,1.8),eOut=inCubic(e.pOut),s=Math.max(.01,(.2+.8*eIn)*(1-eOut));c.translate(e.W/2,e.H/2);c.rotate((P.tilt+(1-eIn)*-120)*DEG);c.scale(s,s);c.translate(-e.W/2,-e.H/2);},
  back(c,e,P,F){
   const R=F.R,cx=e.W/2,cy=e.H/2;c.save();c.translate(cx,cy);
   c.fillStyle=e.accent;c.beginPath();const n=P.burst*2;
   for(let i=0;i<n;i++){const a=i/n*TAU,rad=i%2?R*.86:R*1.04;c.lineTo(Math.cos(a)*rad*(F.pill?1.35:1),Math.sin(a)*rad*(F.pill?.72:1));}
   c.closePath();c.fill();
   const inner=P.dark?'#1b1b26':'#ffffff';c.fillStyle=inner;c.strokeStyle='#ffffff';c.lineWidth=R*.05;
   if(F.pill){rr(c,-R*1.2,-R*.5,R*2.4,R*1.0,R*.5);}else{c.beginPath();c.arc(0,0,R*.72,0,TAU);}
   c.fill();c.stroke();
   c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=R*.04;c.beginPath();c.arc(0,0,F.pill?R*.5:R*.62,Math.PI*1.1,Math.PI*1.45);c.stroke();
   c.restore();
  }},

 window:{name:'ウィンドウ',tags:['glitch','graphic'],w:1,fits:n=>n<=24,
  box:(P,F,it,W,H)=>({cx:W/2,cy:H/2,w:F.win.ww,h:F.win.wh,rot:P.tilt}),
  plan:r=>({title:pickW(r,['lyrics.txt','memo','note.md','untitled'],[1,1,1,.7]),tilt:sign(r)*r()*1.2}),
  frame(P,{W,H,D,exitOK}){const ww=W*.76,wh=H*.6,tb=H*.07;return {box:{cx:W/2,cy:H/2+tb/2,w:ww*.88,h:(wh-tb)*.72},win:{ww,wh,tb},mode:'wrap',align:'left',delay:dly(D,exitOK,.5),maxWidth:.98};},
  textColor:()=>'#e8f0ff',
  xform(c,e,P){const s=(.92+.08*outCubic(e.pIn))*(1-.08*outCubic(e.pOut));c.translate(e.W/2,e.H/2);c.rotate(P.tilt*DEG);c.scale(s,s);c.translate(-e.W/2,-e.H/2);c.globalAlpha*=clamp(e.pIn*2)*(1-outCubic(e.pOut));},
  back(c,e,P,F){
   const {ww,wh,tb}=F.win,x=e.W/2-ww/2,y=e.H/2-wh/2;
   c.save();c.shadowColor='rgba(0,0,0,.5)';c.shadowBlur=26;c.shadowOffsetY=12;c.fillStyle='#1b1f2e';rr(c,x,y,ww,wh,12);c.fill();c.restore();
   c.fillStyle='#303652';c.beginPath();c.moveTo(x,y+tb);c.lineTo(x,y+12);c.arcTo(x,y,x+12,y,12);c.lineTo(x+ww-12,y);c.arcTo(x+ww,y,x+ww,y+12,12);c.lineTo(x+ww,y+tb);c.closePath();c.fill();
   [['#ff5f57',.03],['#febc2e',.055],['#28c840',.08]].forEach(([col,u])=>{c.fillStyle=col;c.beginPath();c.arc(x+ww*u+6,y+tb/2,tb*.16,0,TAU);c.fill();});
   c.font=`${Math.max(10,tb*.36)}px ui-monospace,Menlo,monospace`;c.fillStyle='rgba(232,240,255,.6)';c.textAlign='center';c.textBaseline='middle';c.fillText(P.title,x+ww/2,y+tb/2);
   c.strokeStyle='rgba(255,255,255,.22)';c.lineWidth=1.5;rr(c,x,y,ww,wh,12);c.stroke();
  },
  front(c,e,P,F,item){
   if(e.lt<(item.delay||0)+.05||Math.floor(e.t*2.2)%2)return;
   const g=item.glyphs.at(-1);if(!g)return;
   c.fillStyle=e.accent;c.fillRect(F.box.cx-F.box.w/2+g.cx+g.w/2+4,F.box.cy-F.box.h/2+g.cy-g.size*.45,g.size*.38,g.size*.9);
  }},

 bands:{name:'帯重ね',tags:['impact','graphic','pop'],w:1,fits:n=>n<=24,
  plan:(r,cut)=>({cols:[cut.emphasisColor,'#14141c','#f4efe2'],first:Math.floor(r()*3),flip:r()<.5}),
  frame(P,{W,H,D,exitOK}){return {box:{cx:W/2,cy:H/2,w:W*.8,h:H*.54},delay:dly(D,exitOK,.5),maxWidth:.94};},
  arrange(item,P){for(const g of item.glyphs)g.color=contrast(P.cols[(P.first+g.line)%3]);},
  back(c,e,P,F,item){
   const oy=F.box.cy-F.box.h/2;
   item.lines.forEach((l,i)=>{
    const dir=(i%2?1:-1)*(P.flip?-1:1),off=(1-outCubic(clamp(e.pIn*1.5-i*.25)))*e.W*dir,y=oy+l.cy;
    c.fillStyle=P.cols[(P.first+i)%3];c.fillRect(off,y-l.h*.64,e.W,l.h*1.28);
   });
  }},

 photo:{name:'写真',tags:['emotional','calm'],w:.9,fits:n=>n<=14,
  box:(P,F,it,W,H)=>({cx:W/2,cy:H/2,w:F.card.cw,h:F.card.ch,rot:P.tilt}),
  plan:r=>({tilt:sign(r)*(1.5+r()*2),sun:.2+r()*.4}),
  frame(P,{W,H,D,exitOK}){const cw=W*.62,ch=H*.8,pad=cw*.05,ph=ch*.74;return {box:{cx:W/2,cy:H/2-ch/2+pad+ph/2,w:cw*.78,h:ph*.55},card:{cw,ch,pad,ph},delay:dly(D,exitOK,.55)};},
  textColor:()=>'#ffffff',
  xform(c,e,P){const eOut=inCubic(e.pOut);c.translate(e.W/2,e.H/2-(1-bounceOut(e.pIn))*e.H*.7+eOut*e.H*.8);c.rotate((P.tilt+eOut*16)*DEG);c.translate(-e.W/2,-e.H/2);},
  back(c,e,P,F){
   const {cw,ch,pad,ph}=F.card,x=e.W/2-cw/2,y=e.H/2-ch/2,px=x+pad,py=y+pad,pw=cw-pad*2;
   c.save();c.shadowColor='rgba(0,0,0,.45)';c.shadowBlur=22;c.shadowOffsetY=10;c.fillStyle='#f6f3ea';c.fillRect(x,y,cw,ch);c.restore();
   const gr=c.createLinearGradient(0,py,0,py+ph);gr.addColorStop(0,mixHex(e.bg,e.accent,.55));gr.addColorStop(1,mixHex(e.bg,'#000000',.3));c.fillStyle=gr;c.fillRect(px,py,pw,ph);
   c.save();c.beginPath();c.rect(px,py,pw,ph);c.clip();
   c.fillStyle=rgba('#ffffff',.85);c.beginPath();c.arc(px+pw*(.18+P.sun*1.2),py+ph*(.17+P.sun*.1),ph*.07,0,TAU);c.fill();
   c.fillStyle=rgba('#000000',.4);c.beginPath();c.moveTo(px,py+ph);c.lineTo(px,py+ph*.78);c.quadraticCurveTo(px+pw*.3,py+ph*.62,px+pw*.55,py+ph*.8);c.quadraticCurveTo(px+pw*.8,py+ph*.68,px+pw,py+ph*.76);c.lineTo(px+pw,py+ph);c.closePath();c.fill();
   c.restore();
   c.font=`${Math.max(10,ch*.032)}px ui-monospace,Menlo,monospace`;c.fillStyle='rgba(20,20,28,.6)';c.textAlign='right';c.textBaseline='middle';c.fillText("'26.10.16",x+cw-pad,py+ph+(ch-ph-pad)/2);
  }}
};
export const WORLD_NAMES=Object.fromEntries(Object.entries(WORLD).map(([k,v])=>[k,v.name]));
export const worldChoices=()=>Object.keys(WORLD).map(key=>({key,name:WORLD[key].name}));

/** カットの世界の枠（文字の箱・配置の種類）。n は見える字の数 */
export function worldFrame(cut,n,W=960,H=540){return WORLD[cut.world].frame(cut.worldP,{W,H,n,D:cut.end-cut.start,exitOK:!!cut.worldExit});}
export const worldTextColor=cut=>WORLD[cut.world].textColor?.(cut.worldP,cut)??null;
export function worldEnv(cut,lt,W=960,H=540){
 const D=cut.end-cut.start,T=worldTimes(D,!!cut.worldExit);
 return {W,H,t:cut.start+lt,lt,D,inW:T.inW,outW:T.outW,pIn:T.inW>0?clamp(lt/T.inW):1,pOut:T.outW>0?clamp((lt-(D-T.outW))/T.outW):0,fg:cut.color,accent:cut.emphasisColor,bg:cut.bg};
}
/** 世界（物）と、その上の文字を描く。ctx は絵と同じ大きさ。item は buildItem(…frame) で作ったもの */
export function renderWorld(ctx,cut,item,lt,{layer,W=960,H=540,props=true,tint}={}){
 const Wd=WORLD[cut.world],P=cut.worldP,F=item.worldFrame,e=worldEnv(cut,lt,W,H);
 ctx.save();
 Wd.xform?.(ctx,e,P,F);
 if(props)Wd.back?.(ctx,e,P,F,item);
 ctx.save();ctx.translate(F.box.cx-F.box.w/2,F.box.cy-F.box.h/2);renderText(ctx,item,lt,{layer,tint});ctx.restore();
 if(props)Wd.front?.(ctx,e,P,F,item);   // props=false: 文字だけ（ゴーストの層）
 ctx.restore();
}

/** 世界つきのカットの文字アイテムを作る（世界が決めた箱・配置・待ち時間・文字色で。字ごとの調整まで） */
export function buildWorldItem(cut,{W=960,H=540,measure,pieces,fontFamily}){
 const n=Array.from(cut.text).filter(ch=>!/\s/.test(ch)).length,F=worldFrame(cut,n,W,H),tc=worldTextColor(cut);
 const it=buildItem({...cut,color:tc??cut.color,gVertical:false},{W,H,measure,pieces,...(fontFamily?{fontFamily}:{}),frame:F});
 it.worldFrame=F;WORLD[cut.world].arrange?.(it,cut.worldP);
 return it;
}

/** 世界の「台」の四角（落ち着いた時の、絵の中の位置・大きさ・傾き）。カット間の引き継ぎが、台どうしを重ねるのに使う */
export function worldBox(cut,item,W=960,H=540){
 const Wd=WORLD[cut.world],F=item.worldFrame;
 if(Wd.box)return Wd.box(cut.worldP,F,item,W,H);
 return {cx:F.box.cx,cy:F.box.cy,w:F.box.w*1.1+40,h:F.box.h*1.1+40,rot:0};
}
