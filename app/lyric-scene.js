import {cleanMotion,graphemes} from './lyric-motion.js?v=26';
import {normalizeRecipe} from './lyric-recipe.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)},ease=x=>1-(1-clamp(x))**3;
export function compileLyricScene(event,{width,height,measure}){
 const motion=cleanMotion(event.motion),recipe=normalizeRecipe(motion.recipe),paragraphs=[[]];
 for(const run of event.runs||[{text:event.text||'',emphasis:false}])for(const text of graphemes(run.text)){if(text==='\n')paragraphs.push([]);else paragraphs.at(-1).push({text,emphasis:!!run.emphasis,...(run.color?{color:run.color}:{}),...(run.outline?{outline:true}:{}),...(run.outline&&run.outlineColor?{outlineColor:run.outlineColor}:{}),...(run.hollow?{hollow:true}:{})})}
 const all=paragraphs.flat(),nodes=[],layout=recipe.layout,base=height/720*112*motion.size/72;
 if(layout==='vertical'){
  const cols=[],nonstart='、。，．！？!?）」』】〕〉》］｝ー〜～…‥っゃゅょぁぃぅぇぉッャュョァィゥェォ',nonend='（「『【〔〈《［｛';
  for(const p of paragraphs){let i=0;while(i<p.length){let end=Math.min(i+8,p.length);while(end<p.length&&nonstart.includes(p[end].text))end++;if(end<p.length)while(end>i+1&&nonend.includes(p[end-1].text))end--;cols.push(p.slice(i,end));i=end}}

  let size=base*.64;const maxUnit=Math.max(1,...all.map(n=>measure(n.text,1,motion.font)));
  size=Math.min(size,width*.76/Math.max(1,cols.length)/(maxUnit+0.38),height*.62/(Math.max(1,...cols.map(c=>c.length))*1.35));
  const colW=size*(maxUnit+.38),startX=width/2+(cols.length-1)*colW/2;
  cols.forEach((col,j)=>{const top=height*.5-(col.length-1)*size*1.35/2;col.forEach((n,i)=>{const punctuation='、。，．'.includes(n.text),offsetX=punctuation?size*.25:0,offsetY=punctuation?-size*.25:0;nodes.push({...n,x:startX-j*colW+offsetX,y:top+i*size*1.35+offsetY,w:measure(n.text,size,motion.font),size,role:'text',offsetX,offsetY,rotation:'ー〜～（）「」『』【】〔〕〈〉《》［］｛｝…‥'.includes(n.text)?Math.PI/2:0})})});
 }else{
  const maxW=width*(layout==='poster'?.38:.76),maxH=height*.62;
  let size=base,lines=[];
  const makeLines=()=>{const lines=[];paragraphs.forEach((p,pi)=>{let line={nodes:[],w:0,h:0};
   const factor=layout==='editorial'&&paragraphs.length>1&&pi===0?.68:layout==='impact'&&pi===paragraphs.length-1?1.12:1;
   for(const n of p){const s=size*factor*(n.emphasis?1.16:1),w=measure(n.text,s,motion.font);if(line.nodes.length&&line.w+w>maxW){lines.push(line);line={nodes:[],w:0,h:0}}line.nodes.push({...n,w,size:s});line.w+=w;line.h=Math.max(line.h,s*1.4)}if(line.nodes.length)lines.push(line);
  });return lines};
  for(let i=0;i<80;i++){lines=makeLines();if(lines.reduce((sum,l)=>sum+l.h,0)<=maxH&&lines.every(l=>l.w<=maxW))break;size*=.85}
  const totalH=lines.reduce((sum,l)=>sum+l.h,0);let y=(motion.position==='bottom'?height*.87-totalH:height*.5-totalH/2);
  for(const line of lines){let x=layout==='editorial'?width*.12:layout==='poster'?width*.7-line.w/2:width*.5-line.w/2;for(const n of line.nodes){nodes.push({...n,x:x+n.w/2,y:y+line.h/2,role:'text',rotation:0});x+=n.w}y+=line.h}
 }
 nodes.forEach((n,i)=>n.index=i);
 const minY=nodes.length?Math.min(...nodes.map(n=>n.y-n.size*.7)):height*.3,maxY=nodes.length?Math.max(...nodes.map(n=>n.y+n.size*.7)):height*.7;
 const hero=all.find(n=>n.emphasis)||all[0];
 return {nodes,motion,recipe,width,height,start:Number.isFinite(event.start)?event.start:0,end:Number.isFinite(event.end)?event.end:6,text:all.map(n=>n.text).join(''),bounds:{top:minY,bottom:maxY},hero:hero?.text||'',heroColor:hero?.color||motion.emphasisColor};
}
export function evaluateLyricNode(scene,n,time,bpm=120){
 const {recipe:r,motion:m,start,end}=scene,d=Math.max(.001,end-start),age=time-start,left=end-time,count=Math.max(1,scene.nodes.length-1);
 const intro=Math.min(.65/m.speed,d*.22),outro=Math.min(.5/m.speed,d*.2),spread=Math.min(r.stagger*count,1.1,d*.2),delay=n.index/count*spread;
 const q=ease((age-delay)/intro),away=smooth(1-left/outro),opacity=time<start||time>=end?0:Math.min(q,1-away);
 const frame={x:n.x,y:n.y,scale:1,rotation:n.rotation||0,opacity,warp:0,phase:0,echo:0,glitch:0};
 const angle=n.index*2.399;
 if(r.enter==='rise')frame.y+=(1-q)*n.size*.8;
 if(r.enter==='scatter'){frame.x+=Math.cos(angle)*(1-q)*scene.width*.17;frame.y+=Math.sin(angle)*(1-q)*scene.height*.22;frame.rotation+=(1-q)*Math.sin(angle)*.8;frame.scale=.6+.4*q}
 if(r.enter==='pop'){const u=clamp((age-delay)/intro);frame.scale=1+(1-u)*Math.sin(u*Math.PI*2.4)*.3}
 if(r.enter==='reveal')frame.scale=.92+.08*q;
 if(r.exit==='drift'){frame.y-=away*n.size*.6;frame.x+=away*n.size*.3}
 if(r.exit==='scatter'){frame.x+=away*Math.cos(angle)*scene.width*.14;frame.y+=away*Math.sin(angle)*scene.height*.16;frame.rotation+=away*Math.sin(angle)*.55}
 const a=r.strength*smooth((age-intro-spread)/Math.min(.35,d*.15))*(1-away),beat=age*(Number.isFinite(bpm)?clamp(bpm,30,300):120)/60*m.speed;
 if(a>0){if(r.sustain.includes('sway')){frame.x+=Math.sin(beat*.7+n.index*.18)*n.size*.035*a;frame.y+=Math.sin(beat*.9+n.index*.23)*n.size*.06*a;frame.rotation+=Math.sin(beat*.5+n.index*.1)*.025*a}
 if(r.sustain.includes('breathe')){frame.scale*=1+Math.sin(beat*Math.PI)*.025*a;frame.opacity*=1-(.5+.5*Math.sin(beat*Math.PI))*.28*a}
 if(r.sustain.includes('warp')){frame.warp=n.size*.085*a;frame.phase=beat*1.7+n.x/Math.max(n.size,1)}
 if(r.sustain.includes('echo')){frame.echo=n.size*.08*a;frame.phase=beat*1.1+n.index*.1}
 if(r.sustain.includes('glitch')&&beat%4<.42){frame.glitch=n.size*.07*a;frame.phase=Math.floor(beat*16)*1.71+n.index*.2}
 }
 return frame;
}
