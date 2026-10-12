import * as THREE from './vendor/three.module.min.js';
import {createImageMethodRuntime} from './image-method-runtime.js';
import {getCustom} from './method-registry.js';
const imageIds=new WeakMap();let nextId=0;
const identity=x=>{if(!imageIds.has(x))imageIds.set(x,++nextId);return imageIds.get(x)};
export function createImageMethodLayer(renderer,{onReady=()=>{},onError=()=>{},resolveMethod=getCustom,resolveFontBytes}={}){
 let runtime=null,key='',ready=null,bitmap=null,stamp='',epoch=0,chain=Promise.resolve(),wanted=null,pumping=false,errorKey='';
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1),material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}),mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);scene.add(mesh);
 function release(){runtime?.dispose();runtime=null;ready=null;bitmap?.close();bitmap=null;stamp=''}
 function keyOf(input){return JSON.stringify([input.id,resolveMethod(input.id)?.code,resolveMethod(input.id)?.status,resolveMethod(input.id)?.rev,identity(input.imageA),identity(input.imageB||input.imageA),input.size,input.target?identity(input.target):0])}
 function reset(){epoch++;wanted=null;release();key='';errorKey=''}
 // start the worker for this method and these pictures (a new key replaces the old runtime); the pictures are sent when it is prepared
 function ensure(input){const k=keyOf(input);if(k!==key){release();key=k;errorKey='';const record=resolveMethod(input.id);if(!record?.code||record.status!=='ok')throw Error('未確認の画像コードです。編集画面でプレビューして保存してください。');runtime=createImageMethodRuntime();ready=(async()=>{const fontBytes=await resolveFontBytes?.(record.code.params?.font);return runtime.prepare({...input,code:record.code,fontBytes})})()}}
 async function frame(input){const k=keyOf(input);if(errorKey===k)throw Error('画像メソッドでエラーが発生しました。コードを確認して再適用してください。');ensure(input);const mine=runtime;await ready;if(mine!==runtime)return null;const s=JSON.stringify(input.frame);if(stamp===s&&bitmap)return bitmap;const b=await mine.render(input.frame);if(mine!==runtime){b.close();return null}bitmap?.close();bitmap=b;stamp=s;return b}
 function enqueue(input){const own=epoch;const job=chain.catch(()=>{}).then(()=>own===epoch?frame(input):null);chain=job.catch(()=>{});return job}
 async function pump(){if(pumping)return;pumping=true;try{while(wanted){const input=wanted;wanted=null;try{if(await enqueue(input))onReady()}catch(e){if(key===keyOf(input)){errorKey=key;runtime?.dispose();onError(e)}}}}finally{pumping=false}}
 function paint(b,opacity){if(canvas.width!==b.width||canvas.height!==b.height){canvas.width=b.width;canvas.height=b.height}ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(b,0,0);texture.needsUpdate=true;material.opacity=opacity;const old=renderer.autoClear;renderer.autoClear=false;renderer.render(scene,camera);renderer.autoClear=old;}
 return {reset,
  // get the worker ready before the change starts (the picture is still held): its start-up takes a fraction of a second, which is most of a quick change.
  // Nothing is drawn; asking again with the same input does nothing; a method that cannot be used is left for draw() to report.
  warm(input){const record=resolveMethod(input.id);if(!record?.code||record.status!=='ok'||keyOf(input)===key)return;const own=epoch;wanted=null;chain=chain.catch(()=>{}).then(async()=>{if(own!==epoch||keyOf(input)===key)return;try{ensure(input);await ready}catch{}}).catch(()=>{})},
  async prepare(input){wanted=null;try{return await enqueue(input)}catch(e){errorKey=key;runtime?.dispose();throw e}},draw(input,opacity=1){if(keyOf(input)===key&&bitmap)paint(bitmap,opacity);if(errorKey!==keyOf(input)&&!(keyOf(input)===key&&stamp===JSON.stringify(input.frame))){wanted=input;pump()}},dispose(){reset();texture.dispose();mesh.geometry.dispose();material.dispose()}};
}
export function imageCamera(camera){camera.updateMatrixWorld();return {projection:camera.projectionMatrix.toArray(),world:camera.matrixWorld.toArray()};}
