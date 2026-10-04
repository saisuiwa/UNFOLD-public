import * as THREE from 'three';
import {Text as TroikaText, configureTextBuilder} from 'troika-three-text';
import {gsap} from 'gsap';
configureTextBuilder({useWorker:false});
const originalError=console.error.bind(console);console.error=(...args)=>{originalError(...args);self.postMessage({fatal:'Code motion font or renderer error: '+args.map(String).join(' ')});};
let renderer,scene,camera,controller,fontURL;
const texts=[];
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
  const createText=(value,options={})=>{const colorRanges={};if(String(value)===p.text){let offset=0;for(const run of p.runs||[]){colorRanges[offset]=run.color||(run.emphasis?p.accent:p.color);offset+=String(run.text||'').length;}}const t=new Text();Object.assign(t,{text:String(value),font:fontURL,fontSize:p.fontSize,color:p.color,anchorX:'center',anchorY:'middle',gpuAccelerateSDF:false,colorRanges:Object.keys(colorRanges).length?colorRanges:null},options);scene.add(t);texts.push(t);return t;};
  controller=new Function('api',p.source)({THREE,Text,gsap,scene,camera,text:p.text,width:p.width,height:p.height,fontSize:p.fontSize,bpm:p.bpm,color:p.color,accent:p.accent,fontURL,createText,random,runs:p.runs||[],duration:p.duration}) || {};
  if(!controller.timeline && typeof controller.update!=='function')throw new Error('Return a timeline or update(time).');
  controller.timeline?.pause();
  // Include Text instances added directly by authors, not only createText().
  registerTexts();
  await Promise.all(texts.map(syncText));
}
let commands=Promise.resolve();
self.onmessage=({data:m})=>{commands=commands.then(async()=>{try{
 if(m.type==='prepare'){await prepare(m.payload);self.postMessage({id:m.id,ok:true});}
 if(m.type==='render'){controller.timeline?.seek(m.time,false);await controller.update?.(m.time);registerTexts();await Promise.all(texts.map(syncText));renderer.render(scene,camera);const bitmap=renderer.domElement.transferToImageBitmap();self.postMessage({id:m.id,bitmap},[bitmap]);}
 if(m.type==='dispose'){controller?.dispose?.();texts.forEach(t=>t.dispose());renderer?.dispose();if(fontURL)URL.revokeObjectURL(fontURL);self.close();}
}catch(e){self.postMessage({id:m.id,error:String(e?.message||e)});}});};
