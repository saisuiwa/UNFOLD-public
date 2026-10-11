import {createMotionColorResolver} from './code-motion-colors.js';
import * as THREE from 'three';
import {Text as TroikaText, configureTextBuilder} from 'troika-three-text';
import {gsap} from 'gsap';
configureTextBuilder({useWorker:false});
const originalError=console.error.bind(console);console.error=(...args)=>{originalError(...args);self.postMessage({fatal:'Code motion font or renderer error: '+args.map(String).join(' ')});};
let renderer,scene,camera,controller,fontURL;
const texts=[];
// Word decorations (縁取り outline, 中抜き hollow). Troika styles a whole mesh, so a mesh that mixes plain and decorated words is split: the plain
// base mesh hides the decorated glyphs and one overlay child mesh per decoration shows only its own glyphs. Which glyph instance belongs to which
// decoration is read back from the glyph colours: the low 2 bits of every colour channel carry the group id (colour error <= 3/255).
const decorated=[];
const parseColor=(v,fallback=0xffffff)=>{if(typeof v==='number')return v&0xffffff;if(typeof v==='string'){const t=v.trim(),m=/^#([\da-f]{6})$/i.exec(t)||null;if(m)return parseInt(m[1],16);const s=/^#([\da-f]{3})$/i.exec(t);if(s)return parseInt([...s[1]].map(c=>c+c).join(''),16);}return fallback;};
const luminance=c=>.2126*(c>>16&255)/255+.7152*(c>>8&255)/255+.0722*(c&255)/255;
const tagOf=g=>((g&3)<<16)|(((g>>2)&3)<<8)|((g>>4)&3);
const OUTLINE_EM=.07,STROKE_EM=.024;
function hideGlyphs(mesh,hide){
  const geometry=mesh.geometry,colors=geometry?.getAttribute?.('aTroikaGlyphColor'),bounds=geometry?.getAttribute?.('aTroikaGlyphBounds');
  if(!colors||!bounds)return;
  const c=colors.array,b=bounds.array.slice();let changed=false;
  for(let i=0;i*3<c.length;i++){
    const tag=(c[i*3]&3)|((c[i*3+1]&3)<<2)|((c[i*3+2]&3)<<4);
    if(hide(tag)&&(b[i*4]||b[i*4+1]||b[i*4+2]||b[i*4+3])){b[i*4]=b[i*4+1]=b[i*4+2]=b[i*4+3]=0;changed=true;}
  }
  if(changed){bounds.array=b;bounds.needsUpdate=true;}
}
// Applied every frame, after the motion has set its own values: the motion often fades text through fillOpacity / outlineOpacity, so that value is the
// "intent" and drives the stroke / outline opacity here; 中抜き also switches the motion's own outline off (it would fill the hollow glyph).
// Hollow wins when a word has both.
function applyDecoration(d){
  const {mesh,base,hollow,outline,color}=d,size=mesh.fontSize||16,intent=base?base.fillOpacity:d.intent();
  if(hollow){mesh.outlineWidth=0;mesh.strokeWidth=size*STROKE_EM;mesh.strokeColor=color;mesh.strokeOpacity=intent;if(base)mesh.fillOpacity=0;}
  else if(outline){mesh.outlineWidth=size*OUTLINE_EM;mesh.outlineColor=luminance(color)>.5?0x0b0d12:0xffffff;mesh.outlineOpacity=intent;mesh.outlineBlur=0;if(base)mesh.fillOpacity=base.fillOpacity;}
}
// a mesh decorated alike all over: its own fillOpacity reads 0 (hollow) while what the motion sets is remembered
function interceptFill(mesh){let intent=mesh.fillOpacity??1;Object.defineProperty(mesh,'fillOpacity',{configurable:true,enumerable:true,get:()=>0,set:v=>{intent=v;}});return ()=>intent;}
const SYNCED=['text','fontSize','letterSpacing','lineHeight','maxWidth','textAlign','anchorX','anchorY','curveRadius','whiteSpace','overflowWrap','font'];
function syncDecorated(){
  for(const d of decorated){
    const {base,mesh:overlay}=d;if(!base)continue;
    for(const k of SYNCED)if(overlay[k]!==base[k])overlay[k]=base[k];
    const bm=base.material,om=overlay.material;
    if(bm&&om){om.opacity=bm.opacity;om.transparent=bm.transparent;om.depthWrite=bm.depthWrite;om.depthTest=bm.depthTest;}
  }
  for(const d of decorated)applyDecoration(d);
}
function registerTexts(){scene.traverse(o=>{if(o instanceof TroikaText){if(!o.font)o.font=fontURL;o.gpuAccelerateSDF=false;if(!texts.includes(o))texts.push(o);}});}
function syncText(t){if(!t._needsSync&&!t._isSyncing)return Promise.resolve();return new Promise(resolve=>{const complete=()=>{if(!t._needsSync&&!t._isSyncing){t.removeEventListener('synccomplete',complete);resolve();}};t.addEventListener('synccomplete',complete);t.sync();complete();});}
async function prepare(p){
  const canvas=new OffscreenCanvas(p.width,p.height);
  renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
  renderer.setSize(p.width,p.height,false); renderer.setClearColor(0,0);
  scene=new THREE.Scene(); camera=new THREE.OrthographicCamera(-p.width/2,p.width/2,p.height/2,-p.height/2,0.1,10000);camera.position.z=1000;
  fontURL=URL.createObjectURL(new Blob([p.fontBytes],{type:'font/ttf'}));
  class Text extends TroikaText {constructor(){super();this.font=fontURL;this.fontSize=p.fontSize;this.color=p.color;this.gpuAccelerateSDF=false;}}
  let state=(p.seed>>>0)||1;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const resolveColors=createMotionColorResolver(p);
  const createText=(value,options={})=>{
    const {textStart,...style}=options;
    const colorRanges=resolveColors(value,options),marks=resolveColors.marks||[];
    const t=new Text();Object.assign(t,{text:String(value),font:fontURL,fontSize:p.fontSize,color:p.color,anchorX:'center',anchorY:'middle',gpuAccelerateSDF:false,...style,colorRanges});
    if(marks.length)decorate(t,String(value),colorRanges,marks,style.color??p.color);
    scene.add(t);texts.push(t);return t;
  };
  function decorate(t,value,colorRanges,marks,baseColor){
    const n=value.length,colorAt=new Array(n),group=new Array(n).fill(0),keys=new Map(),list=[];
    let current=parseColor(colorRanges?.[0]??baseColor);
    for(let i=0;i<n;i++){if(colorRanges&&Object.hasOwn(colorRanges,i))current=parseColor(colorRanges[i],current);colorAt[i]=current;}
    for(const m of marks)for(let i=m.from;i<Math.min(n,m.to);i++){
      if(/\s/.test(value[i]))continue;
      const key=(m.hollow?'h':'-')+(m.outline?'o':'-')+colorAt[i];
      let g=keys.get(key);
      if(g==null){if(list.length>=63){g=list.length;}else{list.push({hollow:m.hollow,outline:m.outline,color:colorAt[i]});g=list.length;keys.set(key,g);}}
      group[i]=g;
    }
    const present=new Set();for(let i=0;i<n;i++)if(!/\s/.test(value[i]))present.add(group[i]);
    if(present.size===1&&!present.has(0)){const d=list[[...present][0]-1],item={mesh:t,base:null,...d,hollow:d.hollow};if(d.hollow)item.intent=interceptFill(t);else item.intent=()=>t.fillOpacity;decorated.push(item);applyDecoration(item);return;}   // every glyph of this mesh is decorated alike
    // mixed: tag every glyph colour with its group, hide per glyph, add one overlay mesh per decoration
    const ranges={};let previous=-1;
    for(let i=0;i<n;i++){const c=(colorAt[i]&~0x030303)|tagOf(group[i]);if(c!==previous){ranges[i]=c;previous=c;}}
    t.colorRanges=ranges;
    t.addEventListener('synccomplete',()=>hideGlyphs(t,tag=>tag!==0));
    list.forEach((d,index)=>{
      const g=index+1;if(!present.has(g))return;
      const o=new Text();
      Object.assign(o,{text:value,font:fontURL,fontSize:t.fontSize,color:t.color,anchorX:t.anchorX,anchorY:t.anchorY,maxWidth:t.maxWidth,textAlign:t.textAlign,letterSpacing:t.letterSpacing,lineHeight:t.lineHeight,whiteSpace:t.whiteSpace,overflowWrap:t.overflowWrap,curveRadius:t.curveRadius,gpuAccelerateSDF:false,colorRanges:ranges});
      o.addEventListener('synccomplete',()=>hideGlyphs(o,tag=>tag!==g));
      t.add(o);const item={mesh:o,base:t,...d};decorated.push(item);applyDecoration(item);
    });
  }
  controller=new Function('api',p.source)({THREE,Text,gsap,scene,camera,text:p.text,width:p.width,height:p.height,fontSize:p.fontSize,bpm:p.bpm,color:p.color,accent:p.accent,fontURL,createText,random,runs:p.runs||[],duration:p.duration}) || {};
  if(!controller.timeline && typeof controller.update!=='function')throw new Error('Return a timeline or update(time).');
  controller.timeline?.pause();
  // Include Text instances added directly by authors, not only createText().
  syncDecorated();
  registerTexts();
  await Promise.all(texts.map(syncText));
}
let commands=Promise.resolve();
self.onmessage=({data:m})=>{commands=commands.then(async()=>{try{
 if(m.type==='prepare'){await prepare(m.payload);self.postMessage({id:m.id,ok:true});}
 if(m.type==='render'){controller.timeline?.seek(m.time,false);await controller.update?.(m.time);syncDecorated();registerTexts();await Promise.all(texts.map(syncText));renderer.render(scene,camera);const bitmap=renderer.domElement.transferToImageBitmap();self.postMessage({id:m.id,bitmap},[bitmap]);}
 if(m.type==='dispose'){controller?.dispose?.();texts.forEach(t=>t.dispose());renderer?.dispose();if(fontURL)URL.revokeObjectURL(fontURL);self.close();}
}catch(e){self.postMessage({id:m.id,error:String(e?.message||e)});}});};
