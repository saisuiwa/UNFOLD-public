import {chromium} from '../image-code-build/.test-deps/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const p=await browser.newPage();await p.goto('http://127.0.0.1:8777/app/sequence.html?empty');
 const result=await p.evaluate(async()=>{
  const {createImageMethodRuntime}=await import('/app/image-method-runtime.js');
  const {IMAGE_METHOD_PRESETS}=await import('/app/image-method-presets.js');
  const T=await import('/app/vendor/three.module.min.js');
  const original=createImageBitmap;let unsafe=0;
  window.createImageBitmap=(source,...args)=>{
   // Simulate a GPU-backed canvas whose native transformation cannot be used.
   if(!(source instanceof ImageData)&&args.at(-1)?.imageOrientation==='flipY'){unsafe++;throw Error('GPU-backed image transformation unavailable')}
   return original(source,...args);
  };
  const c=document.createElement('canvas');c.width=160;c.height=90;const x=c.getContext('2d');x.fillStyle='#ff0000';x.fillRect(0,0,160,45);x.fillStyle='#0000ff';x.fillRect(0,45,160,45);
  const camera=new T.OrthographicCamera(-2,2,1.125,-1.125,.1,100);camera.position.z=10;camera.updateMatrixWorld();
  const r=createImageMethodRuntime();try{
   await r.prepare({code:IMAGE_METHOD_PRESETS[0].code,imageA:c,size:{width:4,height:2.25}});
   const bitmap=await r.render({width:160,height:90,clipTime:0,duration:6,progress:0,amount:0,form:0,imageMix:0,camera:{projection:camera.projectionMatrix.toArray(),world:camera.matrixWorld.toArray()}});
   const out=document.createElement('canvas');out.width=160;out.height=90;const ctx=out.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);bitmap.close();
   return {unsafe,top:[...ctx.getImageData(80,20,1,1).data],bottom:[...ctx.getImageData(80,70,1,1).data]};
  }finally{r.dispose();window.createImageBitmap=original}
 });
 assert.equal(result.unsafe,0);assert.deepEqual(result.top,[255,0,0,255]);assert.deepEqual(result.bottom,[0,0,255,255]);console.log(JSON.stringify(result));
}finally{await browser.close()}
