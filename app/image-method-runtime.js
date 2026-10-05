import {validateImageTarget} from './image-method-target.js';
import {cleanImageCode} from './image-method-format.js';
import {getCodeMotionFont} from './lyric-fonts.js';
const bundleURL=new URL('./vendor/image-method-worker.js?v=2',import.meta.url);
const bridge=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; connect-src blob: data:; img-src blob: data:"><script>
let worker,port,url;addEventListener('message',e=>{if(e.source!==parent||port||!e.ports[0])return;port=e.ports[0];url=URL.createObjectURL(new Blob([e.data.bundle],{type:'text/javascript'}));worker=new Worker(url);worker.onmessage=e=>port.postMessage(e.data,e.data.bitmap?[e.data.bitmap]:[]);worker.onerror=e=>port.postMessage({fatal:e.message||'Worker error'});port.onmessage=e=>{const m=e.data;if(m.type==='terminate'){worker.terminate();URL.revokeObjectURL(url);port.close();return}worker.postMessage(m,m.type==='prepare'?[m.payload.imageA,m.payload.imageB,m.payload.fontBytes,...(m.payload.target?[m.payload.target.positions.buffer,m.payload.target.uv.buffer]:[])]:[])};port.start();port.postMessage({ready:true})});<\/script>`;
let bundled;
// Read back once at preparation time. Flipping a GPU-backed canvas directly can
// enter Chromium's accelerated bitmap-transform path with a missing shared image.
// ImageData owns CPU pixels, so conversion/transfer cannot depend on that resource.
async function imageBitmap(source){
 const canvas=document.createElement('canvas');
 canvas.width=source.naturalWidth||source.width;canvas.height=source.naturalHeight||source.height;
 try{
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(source,0,0);
  return await createImageBitmap(ctx.getImageData(0,0,canvas.width,canvas.height),{imageOrientation:'flipY'});
 }finally{canvas.width=canvas.height=0}
}
export function createImageMethodRuntime({initializationTimeout=20000,frameTimeout=10000}={}){
 let iframe,port,dead=false,prepared=false,serial=0;const pending=new Map();
 function dispose(reason='画像メソッドの実行を終了しました。'){if(dead)return;dead=true;port?.postMessage({type:'terminate'});port?.close();iframe?.remove();for(const x of pending.values()){clearTimeout(x.timer);x.reject(Error(reason))}pending.clear()}
 function request(message,timeout,transfer=[]){return new Promise((resolve,reject)=>{if(dead)return reject(Error('実行は終了しています。'));const id=++serial,timer=setTimeout(()=>dispose('画像メソッドの処理が時間内に終わらなかったため停止しました。'),timeout);pending.set(id,{resolve,reject,timer,type:message.type});try{port.postMessage({...message,id},transfer)}catch(e){clearTimeout(timer);pending.delete(id);reject(e)}})}
 return {async prepare(input){if(iframe||dead)throw Error('新しい実行環境で準備してください。');const code=cleanImageCode(input.code),validatedTarget=validateImageTarget(input.target),target=validatedTarget?{...validatedTarget,positions:validatedTarget.positions.slice(),uv:validatedTarget.uv.slice()}:null;if(!input.size||![input.size.width,input.size.height].every(n=>Number.isFinite(n)&&n>0&&n<100))throw Error('画像の大きさが不正です。');if(!globalThis.OffscreenCanvas||!globalThis.createImageBitmap)throw Error('この画像メソッドはOffscreenCanvas対応のChromeで開いてください。');
  const [bundle,fontBytes]=await Promise.all([bundled??=(fetch(bundleURL).then(r=>{if(!r.ok)throw Error('画像メソッドの描画器を読めません。');return r.text()}).catch(e=>{bundled=null;throw e})),getCodeMotionFont(code.params.font).then(b=>b.slice(0))]);if(dead)throw Error('準備が取り消されました。');
  const bitmaps=[];try{bitmaps.push(await imageBitmap(input.imageA));bitmaps.push(await imageBitmap(input.imageB||input.imageA));if(dead)throw Error('準備が取り消されました。');
  iframe=document.createElement('iframe');iframe.sandbox='allow-scripts';iframe.hidden=true;iframe.srcdoc=bridge;
  await new Promise((resolve,reject)=>{const channel=new MessageChannel();port=channel.port1;const timer=setTimeout(()=>{dispose();reject(Error('画像描画器を開始できませんでした。'))},initializationTimeout);port.onmessage=({data:m})=>{if(m.ready){clearTimeout(timer);resolve();return}if(m.fatal){clearTimeout(timer);dispose(m.fatal);reject(Error(m.fatal));return}const q=pending.get(m.id);if(!q){m.bitmap?.close();return}clearTimeout(q.timer);pending.delete(m.id);if(m.error)q.reject(Error(m.error));else if(q.type==='render'&&!(m.bitmap instanceof ImageBitmap))q.reject(Error('描画結果が不正です。'));else q.resolve(m.bitmap)};port.start();iframe.onload=()=>iframe.contentWindow.postMessage({bundle},'*',[channel.port2]);document.body.append(iframe)});
  if(dead)throw Error('準備が取り消されました。');await request({type:'prepare',payload:{code,target,size:input.size,imageA:bitmaps[0],imageB:bitmaps[1],fontBytes}},initializationTimeout,[...bitmaps,fontBytes,...(target?[target.positions.buffer,target.uv.buffer]:[])]);prepared=true;
  }catch(e){bitmaps.forEach(b=>b.close());dispose(e.message);throw e}},
 async render(frame){if(!prepared||dead)throw Error('画像メソッドの準備が完了していません。');if(![frame.width,frame.height].every(n=>Number.isInteger(n)&&n>0&&n<=8192)||!Number.isFinite(frame.clipTime)||frame.clipTime<0)throw Error('フレームの指定が不正です。');return request({type:'render',frame},frameTimeout)},dispose};
}
