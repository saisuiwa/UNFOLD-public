import {graphemes} from '../lyric-motion.js';
const nonstart='、。，．！？!?）」』】〕〉》］｝ー〜～…‥っゃゅょぁぃぅぇぉッャュョァィゥェォ',nonend='（「『【〔〈《［｛';
export function layoutTextRuns({runs,layout,width,height,measure}){
 const glyphs=[];for(const [ri,r] of runs.entries())for(const [i,text] of graphemes(r.text||'').entries())glyphs.push({...r,text,id:r.glyphIds?.[i]??`${r.id??ri}:${i}`,runId:r.id??String(ri)});
 const fontSize=Math.max(.03,layout.fontScale||.06)*Math.min(width,height)*(layout.scale||1),size=Math.max(Math.min(width,height)*.03,fontSize),maxWidth=width*layout.textWidth,lines=[],breaks=new Set(layout.breaks||[]);let line=[];
 const finish=()=>{lines.push({glyphs:line});line=[];};
 for(const g of glyphs){if(g.text==='\n'){finish();continue;}g.fontSize=size*(g.scale>0&&g.scale<=3?g.scale:1);g.width=measure(g.text,g.fontSize,g.font);if(breaks.has(g.id)&&line.length)finish();
 if(line.length&&line.reduce((s,n)=>s+n.width,0)+g.width>maxWidth&&!nonstart.includes(g.text)){
 const last=line.at(-1);if(nonend.includes(last.text)&&line.length>1){line.pop();finish();line.push(last);}else finish();}
 line.push(g);}
 if(line.length)finish();const totalH=lines.length*size*1.4,issues=[];let y=height*layout.y-totalH/2;
 for(const l of lines){l.width=l.glyphs.reduce((s,g)=>s+g.width,0);let x=width*layout.x-l.width/2;for(const g of l.glyphs){g.x=x+g.width/2;g.y=y+size*.7;x+=g.width;}y+=size*1.4;}
 const output=lines.flatMap(l=>l.glyphs);if(output.some(g=>g.x-g.width/2<width*.08||g.x+g.width/2>width*.92||g.y-size*.7<height*.1||g.y+size*.7>height*.9))issues.push({code:'TEXT_OVERFLOW',message:'文字が安全余白を越えています。位置・幅・改行を確認してください。'});
 return {lines,glyphs:output,issues};
}
