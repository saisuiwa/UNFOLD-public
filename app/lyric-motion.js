import {cleanCodeMotion} from './code-motion-format.js';
import {normalizeRecipe,BUILTIN_MOTIONS} from './lyric-recipe.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));const ease=t=>1-(1-t)**3;
export function graphemes(t){return typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(t)].map(x=>x.segment):String(t).match(/(?:\P{Mark}\p{Mark}*(?:\u200d\P{Mark}\p{Mark}*)*|\p{Mark}+)/gu)||[]}
// Text motions, one entry per preset. To add one, add an entry here: the per-line select, the file check and the samples page all read this table.
// label: the name in the select. desc: one line for the samples page. added: the day it was added (YYYY-MM-DD, Japan time).
// poster (optional): how many seconds after the line starts the still picture of the samples page is taken (0.2 if left out; pick the moment the motion is easiest to see). fn(c): returns only the parts of the frame it moves —
//   x, y (in text heights), scale, reveal (0..1: how much of the line is written), emphasis (scale of *emphasised* words). Anything else stays at rest.
// c = { m: the cleaned motion, e: the line, t: time (s), p: 0..1 through the line, q: eased intro 0..1, intro: linear intro 0..1, duration (s), bpm }
// The fade in and out (opacity) is shared by all of them. New entries go at the end: that is the order in the select.
const bounceOut=x=>{const n=7.5625,d=2.75;return x<1/d?n*x*x:x<2/d?n*(x-=1.5/d)*x+.75:x<2.5/d?n*(x-=2.25/d)*x+.9375:n*(x-=2.625/d)*x+.984375};   // 0 -> 1, landing with bounces
export const TEXT_MOTIONS={
  float:{label:'ふわっと',desc:'下から少し浮かびながら、ふわっと現れます。',added:'2026-10-04',fn:({q})=>({y:(1-q)*.55})},
  slide:{label:'流れ込む',desc:'選んだ方向から、すっと流れ込んできます。',added:'2026-10-04',fn:({m,q})=>{const sign=['left','up'].includes(m.direction)?-1:1;return {[['left','right'].includes(m.direction)?'x':'y']:sign*(1-q)*2.5}}},
  reveal:{label:'一文字ずつ',desc:'文字が一つずつ、順番に現れます。',added:'2026-10-04',fn:({m,e,t,duration})=>({reveal:clamp((t-e.start)/Math.min(duration*.7,1.5/m.speed),0,1)})},
  pop:{label:'弾む',desc:'ぽんと大きくなってから、弾んで落ち着きます。',added:'2026-10-04',fn:({intro})=>({scale:1+(1-intro)*Math.sin(intro*Math.PI*2.4)*.32})},
  emphasis:{label:'強調',desc:'*強調*した言葉が、拍に合わせてどくんと膨らみます。',added:'2026-10-04',fn:({e,t,p,bpm})=>({emphasis:1+.13*Math.sin(clamp((t-e.start)*bpm/60,0,1)*Math.PI)*(1-p)})},
  bounce:{label:'落ちて弾む',desc:'上から落ちてきて、床に当たったように弾みながら止まります。',added:'2026-10-07',poster:.14,fn:({intro})=>({y:-1.6*(1-bounceOut(intro))})}
};
// what a frame looks like at rest, and how far each part may go (a bad entry cannot push the text off the screen or make it vanish)
const REST={x:0,y:0,scale:1,reveal:1,emphasis:1},RANGE={x:[-10,10],y:[-10,10],scale:[.05,4],reveal:[0,1],emphasis:[.05,4]};
export function cleanMotion(m={}){m=m&&typeof m==='object'?m:{};return {preset:Object.hasOwn(TEXT_MOTIONS,m.preset)?m.preset:'float',direction:['left','right','up','down'].includes(m.direction)?m.direction:'up',color:/^#[\da-f]{6}$/i.test(m.color)?m.color:'#ffffff',emphasisColor:/^#[\da-f]{6}$/i.test(m.emphasisColor)?m.emphasisColor:'#d9f878',size:clamp(Number(m.size)||64,32,160),position:m.position==='center'?'center':'bottom',font:typeof m.font==='string'?m.font:'gothic',speed:clamp(Number(m.speed)||1,.5,2),...(m.code?{code:cleanCodeMotion(m.code)}:m.recipe?.version===1?{recipe:normalizeRecipe(m.recipe)}:{})}}
function hash(s){let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0}
export function assignLyricMotions(doc,{style='readable',seed=7,preserveExisting=false,plain=false}={}){
 const d=structuredClone(doc);d.style=style;d.seed=seed;let previous='';
 for(const e of d.events){if(e.kind!=='line')continue;if(e.locked||(preserveExisting&&e.motion)){previous=e.motion?.recipe?.layout||'';continue}
 if(plain){e.motion=cleanMotion({preset:'reveal',size:e.section==='chorus'?86:64});continue}
 const k=hash(`${seed}:${e.section}:${e.id}`),chorus=e.section==='chorus';
 const choices=style==='soft'?['vertical','editorial','echo']:style==='pop'?['impact','assemble','poster','echo']:['editorial','assemble','vertical'];
 let pick=choices[k%choices.length];if(chorus&&style!=='soft')pick=['impact','echo','poster'][k%3];if(pick===previous)pick=choices[(choices.indexOf(pick)+1+choices.length)%choices.length];
 const template=BUILTIN_MOTIONS.find(x=>x.id===pick).motion;
 e.motion=cleanMotion({...template,size:chorus?86:64,emphasisColor:style==='pop'?'#ffd16b':style==='soft'?'#b5dbff':'#d9f878'});previous=pick;
 }return d;
}
// What the sequence shows: every line is played 一文字ずつ (reveal) without a recipe; the recipes (picked automatically by older versions) are STUDIO's.
// A code motion (chosen on purpose in the motion studio) and a locked line are shown as they are.
// A view of the document (the document is not changed, so a project handed to STUDIO keeps what it holds). Same object when nothing differs.
const plainViews=new WeakMap();
export function plainLyricView(doc){
 if(!doc||!Array.isArray(doc.events))return doc;
 if(plainViews.has(doc))return plainViews.get(doc);
 let changed=false;
 const events=doc.events.map(e=>{
  if(e.kind!=='line'||e.locked||e.motion?.code)return e;
  const m=e.motion;if(m&&m.preset==='reveal'&&!m.recipe)return e;
  changed=true;const {recipe,...rest}=m||{};return {...e,motion:cleanMotion({...rest,preset:'reveal'})};
 });
 const view=changed?{...doc,events}:doc;plainViews.set(doc,view);return view;
}
export function motionAt(e,t,bpm=120){const m=cleanMotion(e.motion),duration=e.end-e.start,p=clamp((t-e.start)/Math.max(.001,duration),0,1),span=Math.min(.65/m.speed,Math.max(.01,duration*.35)),intro=clamp((t-e.start)/span,0,1),out=clamp((e.end-t)/span,0,1),q=ease(intro),v={opacity:t<e.start||t>=e.end?0:Math.min(q,out),...REST},part=TEXT_MOTIONS[m.preset].fn({m,e,t,p,q,intro,duration,bpm});for(const k in RANGE){const n=part?.[k];if(Number.isFinite(n))v[k]=clamp(n,...RANGE[k])}return v}
export function layoutText(runs,{width,height,font,size=64,measure}){const maxW=width*.9,maxH=height*.8;let fontSize=size;let lines=[];for(let attempt=0;attempt<60;attempt++){lines=[{runs:[],width:0}];for(const run of runs)for(const char of graphemes(run.text)){let line=lines.at(-1);if(char==='\n'){lines.push({runs:[],width:0});continue}const w=measure(char,fontSize,font);if(line.width+w>maxW&&line.runs.length){line={runs:[],width:0};lines.push(line)}line.runs.push({text:char,emphasis:run.emphasis});line.width+=w}if(lines.length*fontSize*1.3<=maxH&&Math.max(...lines.map(l=>l.width))<=maxW)break;fontSize*=.9;}return {lines,size:fontSize,bounds:{x:width*.05,y:height*.1,width:Math.max(0,...lines.map(l=>l.width)),height:lines.length*fontSize*1.3}}}
