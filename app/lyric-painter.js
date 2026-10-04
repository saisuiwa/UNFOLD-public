import {compileLyricScene,evaluateLyricNode} from './lyric-scene.js?v=2';
import {lyricFontCSS,prepareLyricFont} from './lyric-fonts.js';
const fontFor=lyricFontCSS;
export async function prepareMotionFont(motion,text){await prepareLyricFont(motion?.font,text)}
export function createLyricPainter(){
 let scene=null,sceneKey='';const bitmaps=new Map();
 function bitmap(ctx,n,m,color,outline=false){const font=fontFor(m.font,n.size),key=JSON.stringify([n.text,font,color,outline]);if(bitmaps.has(key))return bitmaps.get(key);
  const canvas=document.createElement('canvas'),x=canvas.getContext('2d'),pad=Math.ceil(n.size*.25+5);x.font=font;const w=x.measureText(n.text).width;
  canvas.width=Math.max(1,Math.ceil(w+pad*2));canvas.height=Math.max(1,Math.ceil(n.size*1.8+pad*2));x.font=font;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.lineWidth=Math.max(1,n.size*.065);x.strokeStyle='rgba(0,0,0,.7)';x.fillStyle=color;
  if(outline){x.lineWidth=Math.max(1,n.size*.013);x.strokeStyle=color;x.strokeText(n.text,canvas.width/2,canvas.height/2)}else{x.strokeText(n.text,canvas.width/2,canvas.height/2);x.fillText(n.text,canvas.width/2,canvas.height/2)}
  if(bitmaps.size>=192)bitmaps.delete(bitmaps.keys().next().value);bitmaps.set(key,canvas);return canvas;
 }
 const image=(ctx,img,dx=0,dy=0)=>ctx.drawImage(img,-img.width/2+dx,-img.height/2+dy);
 return {clear(){scene=null;sceneKey='';bitmaps.clear()},draw(ctx,event,time,{width=ctx.canvas.width,height=ctx.canvas.height,bpm=120}={}){
  const key=JSON.stringify([event.runs,event.text,event.motion,event.start,event.end,width,height]);
  if(key!==sceneKey){scene=compileLyricScene(event,{width,height,measure:(text,size,font)=>{ctx.font=fontFor(font,size);return ctx.measureText(text).width}});sceneKey=key;bitmaps.clear()}
  if(time<scene.start||time>=scene.end||!scene.nodes.length)return;
  const {motion:m,recipe:r,bounds}=scene,d=Math.max(.001,scene.end-scene.start),age=time-scene.start,fade=Math.min(1,Math.max(0,age/Math.min(.35,d*.15)),Math.max(0,(scene.end-time)/Math.min(.4,d*.15)));
  ctx.save();ctx.beginPath();ctx.rect(width*.045,height*.04,width*.91,height*.92);ctx.clip();ctx.globalAlpha*=fade;
  // Graphic elements remain separate from lyric nodes; text order never changes.
  if(r.layout==='editorial'){ctx.fillStyle=m.emphasisColor;ctx.fillRect(width*.087,bounds.top,width*.004,Math.max(0,bounds.bottom-bounds.top));}
  if(r.layout==='impact'){ctx.save();ctx.translate(width/2,(bounds.top+bounds.bottom)/2);ctx.rotate(-.035);ctx.fillStyle='#'+m.emphasisColor.slice(1).match(/../g).map(v=>Math.round(parseInt(v,16)*.18).toString(16).padStart(2,'0')).join('');ctx.fillRect(-width*.43,-(bounds.bottom-bounds.top)/2-height*.035,width*.86,bounds.bottom-bounds.top+height*.07);ctx.restore()}
  if(r.layout==='vertical'){ctx.strokeStyle=m.emphasisColor;ctx.lineWidth=Math.max(1,width*.001);ctx.beginPath();ctx.moveTo(width*.91,height*.16);ctx.lineTo(width*.91,height*.84);ctx.stroke()}
  if(r.layout==='poster'){ctx.save();ctx.globalAlpha*=.24;ctx.font=fontFor(m.font,height*.64);ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=Math.max(1,width*.002);ctx.strokeStyle=scene.heroColor;ctx.strokeText(scene.hero,width*.28,height*.49);ctx.restore()}
  if(r.layout==='echo'){for(let j=3;j>=1;j--){ctx.save();ctx.globalAlpha*=.055;const factor=1+j*.13;ctx.translate(width/2,height/2);ctx.scale(factor,factor);ctx.translate(-width/2,-height/2);for(const n of scene.nodes){ctx.save();ctx.translate(n.x,n.y);image(ctx,bitmap(ctx,n,m,m.emphasisColor,true));ctx.restore()}ctx.restore()}}
  for(const n of scene.nodes){const f=evaluateLyricNode(scene,n,time,bpm);if(f.opacity<=0)continue;ctx.save();ctx.globalAlpha*=f.opacity;ctx.translate(f.x,f.y);ctx.rotate(f.rotation);ctx.scale(f.scale,f.scale);
   const color=n.color||(n.emphasis?m.emphasisColor:m.color),img=bitmap(ctx,n,m,color);
   if(f.echo){for(let j=3;j>=1;j--){ctx.save();ctx.globalAlpha*=.13;image(ctx,bitmap(ctx,n,m,j%2?'#68dbf2':m.emphasisColor),Math.sin(f.phase-j*.3)*f.echo*j,Math.cos(f.phase-j*.4)*f.echo*j*.5);ctx.restore()}}
   if(f.glitch){ctx.save();ctx.globalAlpha*=.7;image(ctx,bitmap(ctx,n,m,'#33ddff'),-f.glitch,0);image(ctx,bitmap(ctx,n,m,'#ff529b'),f.glitch,0);ctx.restore()}
   if(f.warp){const step=Math.max(2,Math.ceil(width/640));for(let x=0;x<img.width;x+=step){const sw=Math.min(step,img.width-x),wave=Math.sin(x/Math.max(12,n.size*.8)+f.phase)*f.warp;ctx.drawImage(img,x,0,sw,img.height,-img.width/2+x,-img.height/2+wave,sw,img.height)}}else image(ctx,img);
   if(f.glitch){const sy=Math.floor(img.height*.42),sh=Math.max(2,Math.ceil(n.size*.13));ctx.drawImage(img,0,sy,img.width,sh,-img.width/2+Math.sin(f.phase)*f.glitch*2,sy-img.height/2,img.width,sh)}
   ctx.restore();
  }
  ctx.restore();
 }};
}
