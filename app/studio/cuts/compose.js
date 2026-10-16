// カット演出の1フレームを組み立てる。背景 → （カメラを通した）文字 → つなぎ/引き継ぎ → 画面効果。
// 画面の大きさと作業用キャンバスは S = {W,H,opaque,tmp(slot,w,h),canvas(key,w,h)} で受け取る（opaque=false なら、背景色を塗らず、下の絵が透けて見える）（横長・縦長・どの解像度でも同じ作り）。ctx は 2D コンテキスト（OffscreenCanvas でも普通の canvas でもよい）。
import {BG,CAMERA,FX,TRANS,DEG} from './parts.js';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const reset=c=>{c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.filter='none';c.imageSmoothingEnabled=true;};
export const resetCtx=reset;

export function envFor(cut,t,S){
 const lt=t-cut.start,dur=cut.end-cut.start;
 return {W:S.W,H:S.H,t,lt,dur,p:clamp(lt/dur),fg:cut.color,accent:cut.emphasisColor,bg:cut.bg,step:Math.floor(t*24),tmp:S.tmp};
}

// ---- 常時ゴースト（時間遅れの色収差）----------------------------------------------------------------------------------------------------------
// 少し前の時刻の文字を、ピンクとシアンに塗って、ずらして主役の後ろに重ねる。文字が動いている間だけ、動いた分だけ色がずれて見える。
export const GHOST_PASSES=[{lag:1.6/24,color:'#ff2fa8',kx:-1,ky:-.38},{lag:.8/24,color:'#00e5ff',kx:.94,ky:.56}];
/** カット内の時刻 lt で、描く必要のあるゴーストの層（lt はその層の時刻）。強さ 0 や、カットの頭で、まだ過去がない時は空 */
export function ghostPasses(cut,lt){return (cut.ghost>.02?GHOST_PASSES:[]).filter(p=>lt-p.lag>=0).map(p=>({...p,lt:lt-p.lag}));}
/** 層のずらし量 (px)。文字の大きさに比例（大きい字ほど大きくずれる）× カットごとの強さ × 向き */
export function ghostOffset(cut,pass,S){
 const u=Math.max(2,Math.min(S.W,S.H)*cut.fontScale*(cut.dScale||1)*.05)*cut.ghost*(cut.ghostP?.dir||1);
 return {dx:pass.kx*u,dy:pass.ky*u};
}
const canFilter=c=>typeof c.filter==='string';
// 色つきの層（tinted）は、呼ぶ側が最初からその色で描いてあるのでそのまま重ねる。そうでない層は、ここで色を塗る。
function drawGhosts(ctx,ghosts,S){
 for(const gh of ghosts){
  let src=gh.bmp;
  if(!gh.tinted){
   const tc=S.canvas('tint',S.W,S.H),tx=tc.getContext('2d');
   tx.setTransform(1,0,0,1,0,0);tx.globalAlpha=1;tx.globalCompositeOperation='copy';tx.drawImage(gh.bmp,0,0);
   tx.globalCompositeOperation='source-in';tx.fillStyle=gh.color;tx.fillRect(0,0,S.W,S.H);tx.globalCompositeOperation='source-over';
   src=tc;
  }
  ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.85;ctx.drawImage(src,-S.W/2+gh.dx,-S.H/2+gh.dy);ctx.restore();
 }
}

/** 背景 + （カメラを通した）文字。bmp は null でもよい（背景だけ）。cut.place は置き場所 {x,y,scale,rotation}。ghosts: [{bmp,color,dx,dy,tinted}] */
export function drawCutFrame(ctx,cut,t,bmp,S,ghosts=null){
 const {W,H}=S,e=envFor(cut,t,S);
 reset(ctx);if(S.opaque!==false){ctx.fillStyle=cut.bg;ctx.fillRect(0,0,W,H);}
 if(cut.bgPart&&BG[cut.bgPart]){ctx.save();BG[cut.bgPart].draw(ctx,e,cut.bgP);ctx.restore();}
 if(!bmp)return;
 ctx.save();
 if(cut.cam&&CAMERA[cut.cam]){
  const cm=CAMERA[cut.cam].get(e,cut.camP)||{};
  ctx.translate(W/2+(cm.x||0),H/2+(cm.y||0));if(cm.rot)ctx.rotate(cm.rot*DEG);const s=cm.s??1;ctx.scale(s,s);ctx.translate(-W/2,-H/2);
  if(cm.blur>.4&&canFilter(ctx))ctx.filter=`blur(${cm.blur.toFixed(1)}px)`;   // ピント合わせ・ピンぼけ（文字レイヤー全体にぼかし）
 }
 const p=cut.place;
 ctx.translate(W*p.x,H*p.y);ctx.rotate(p.rotation*Math.PI/180);ctx.scale(p.scale,p.scale);
 if(ghosts?.length)drawGhosts(ctx,ghosts,S);
 ctx.drawImage(bmp,-W/2,-H/2);
 ctx.restore();
}

/** できあがった絵 X を出力へ。引き継ぎ・つなぎ（A→X）と、カット頭の画面効果をここで掛ける。 */
export function finishFrame(out,{cut,t,X,A,carry},S){
 const {W,H}=S;
 reset(out);
 const lt=t-cut.start;
 if(carry&&A&&lt<carry.dur){drawCarry(out,A,X,Math.max(0,lt)/carry.dur,carry.fromBox,carry.toBox,S);reset(out);}
 else if(cut.trans&&A&&TRANS[cut.trans]&&lt<cut.transDur){
  out.save();TRANS[cut.trans].draw(out,A,X,Math.max(0,lt)/cut.transDur,{W,H,accent:cut.emphasisColor,fg:cut.color},cut.transP);out.restore();reset(out);
 }else out.drawImage(X,0,0);
 if(cut.fx&&FX[cut.fx]){
  const F=FX[cut.fx];
  if(lt>=0&&lt<F.dur){out.save();F.apply(out,envFor(cut,t,S),cut.fxP,Math.pow(1-lt/F.dur,1.5));out.restore();reset(out);}
 }
}

// ---- 引き継ぎ: 前のカットの台が画面いっぱいに寄り、次のカットの台に入れ替わって引く ----------------------------------------------------------------
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const fitScale=(b,W,H)=>Math.max(1.4,Math.min(3.2,Math.min(W/b.w,H/b.h)*.9));   // 台が大きくても、はっきり寄って見えるよう、最低でも1.4倍
/** 台の四角 box が画面いっぱいになる変形を u（0=そのまま 1=台が画面中央に大きく、傾きを戻して）で適用する */
function boxTransform(c,box,u,W,H){
 const s=Math.exp(Math.log(fitScale(box,W,H))*u),px=W/2+(box.cx-W/2)*u,py=H/2+(box.cy-H/2)*u;
 c.translate(W/2,H/2);c.rotate(-(box.rot||0)*DEG*u);c.scale(s,s);c.translate(-px,-py);
}
/**
 * A（前のカットの落ち着いた絵）が fromBox の台を中心に寄っていき、途中で B（今のカットの絵）に入れ替わり、
 * B は toBox の台を中心に寄った所から、元の大きさに引く。台どうしが重なるので、物が次の物に変わったように見える。
 */
export function drawCarry(out,A,B,p,fromBox,toBox,S){
 const {W,H}=S,q=.5-.5*Math.cos(Math.PI*clamp(p));   // 始まりがゆっくりすぎない緩急
 out.save();if(S.opaque!==false){out.fillStyle='#000';out.fillRect(0,0,W,H);}
 out.save();boxTransform(out,toBox,1-q,W,H);out.drawImage(B,0,0);out.restore();
 const a=1-smooth((q-.38)/.24);
 if(a>0){out.save();boxTransform(out,fromBox,q,W,H);out.globalAlpha=a;out.drawImage(A,0,0);out.restore();}
 out.restore();
}
