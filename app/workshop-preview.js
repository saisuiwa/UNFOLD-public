import * as THREE from './vendor/three.module.min.js';
import {vertexShader,fragmentShader,motionAt} from './motion.js?v=30';
import {createPreview,makeTestImage} from './method-preview.js';
import {checkSource} from './method-guard.js';
import {compileUserMethod} from './custom-method.js';
import {createTrial} from './method-trial.js';
import {createImageMethodRuntime} from './image-method-runtime.js';
import {createCodeMotionRuntime} from './code-motion-runtime.js';
import {IMAGE_RUNTIME,imageFrame} from './image-method-format.js';
import {previewTarget} from './image-method-target.js';
import {getModel} from './model-library.js?v=4';
import {importModel} from './model-import.js?v=12';
import {getCodeMotionFont} from './lyric-fonts.js';
import {codeFrameInput} from './code-motion-layer.js';
import {motionOf} from './workshop-library.js';
import {lyricRuns} from './lyric-document.js?v=4';
const trial=createTrial({vertexShader,fragmentShader});
export const testImage=()=>makeTestImage(960,540);
async function targetFor(shape){if(shape==='none')return null;if(!shape.startsWith('glb-'))return previewTarget(shape);const model=await getModel(shape);if(!model)throw Error('保存したGLBが見つかりません。');const data=await importModel(model.buffer);return {positions:data.target,uv:data.uv,shape:0,preset:true,project:false};}
export function createWorkshopPreview(host){
 let generation=0,active=null;
 function dispose(){generation++;active?.dispose();active=null;}
 return {dispose,async prepare(draft,images){
  dispose();const own=generation,canvas=document.createElement('canvas');canvas.width=800;canvas.height=450;canvas.setAttribute('aria-label','メソッドの実描画プレビュー');host.replaceChildren(canvas);
  const cancelled=()=>{if(own!==generation)throw Error('プレビューを停止しました。')};
  try{
   if(draft.kind==='glsl'){
    const guard=checkSource(draft.source);if(!guard.ok)throw Error(guard.errors.map(e=>`${e.line?e.line+'行目: ':''}${e.message}`).join('\n'));
    const preview=createPreview(canvas,{vertexShader,fragmentShader});active=preview;preview.resize(800/devicePixelRatio,450/devicePixelRatio);preview.setImage(images.a||testImage());
    const errors=await compileUserMethod(preview.renderer,{vertexShader,fragmentShader,source:draft.source});cancelled();if(errors.length)throw Error(errors.map(e=>`${e.line||''}行目: ${e.message}`).join('\n'));
    const verdict=await trial.run(draft.source);cancelled();if(verdict.failed||verdict.heavy)throw Error(verdict.failed||'重い処理のため停止しました。ループや計算を減らしてください。');preview.setSource(draft.source);
    return {canvas,async render(time,strength){cancelled();preview.setTime(time);preview.setAmount(strength*(.5-.5*Math.cos(time/6*Math.PI*2)));}};
   }
   let textInput;
   const ctx=canvas.getContext('2d'),runtime=draft.kind==='image'?createImageMethodRuntime():createCodeMotionRuntime();active=runtime;
   if(draft.kind==='image'){
    const a=images.a||testImage(),b=images.b||a,ratio=a.width/a.height,height=Math.min(3.65,5.25/ratio);
    const target=await targetFor(draft.shape||'sphere');cancelled();
    await runtime.prepare({code:{version:1,runtime:IMAGE_RUNTIME,source:draft.source,params:draft.params},imageA:a,imageB:b,size:{width:height*ratio,height},target});
   }else{
    const runs=lyricRuns(draft.words||'かたちをほどいて/自由に。'),event={start:0,end:6,text:runs.map(r=>r.text).join(''),runs,motion:motionOf(draft)};
    textInput=time=>codeFrameInput(event,time,{width:800,height:450});
    const params=textInput(0).params,fontBytes=await getCodeMotionFont(params.font);cancelled();
    await runtime.prepare({...params,fontBytes});
   }
   cancelled();const cam=new THREE.OrthographicCamera(-4,4,2.25,-2.25,.1,100);cam.position.z=10;cam.updateMatrixWorld();
   return {canvas,async render(time,strength){cancelled();const f={...imageFrame(time,6,strength,{form:draft.shape==='none'?0:motionAt(time/6).form}),width:800,height:450,bg:'#101819',camera:{projection:cam.projectionMatrix.toArray(),world:cam.matrixWorld.toArray()}};const bitmap=await runtime.render(draft.kind==='image'?f:textInput(time).time);try{cancelled();ctx.clearRect(0,0,800,450);ctx.drawImage(bitmap,0,0);}finally{bitmap.close()}}};
  }catch(error){if(own===generation)dispose();throw error}
 }};
}
