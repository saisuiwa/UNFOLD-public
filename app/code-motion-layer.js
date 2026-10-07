import {createCodeMotionRuntime} from './code-motion-runtime.js';
import {isCodeMotionApproved} from './code-motion-format.js';
import {getCodeMotionFont} from './lyric-fonts.js';
import {cleanMotion} from './lyric-motion.js?v=26';
export function codeFrameInput(event,time,{width,height,bpm=120,seed=7}){
 const m=cleanMotion(event.motion),duration=Math.max(.001,event.end-event.start),localTime=Math.max(0,(time-event.start)*m.speed);
 const params={source:m.code.source,text:event.text,runs:event.runs,width:Math.round(width),height:Math.round(height),fontSize:height/720*112*m.size/72,color:m.color,accent:m.emphasisColor,font:m.font,seed,duration:duration*m.speed,bpm};
 return {params,time:localTime,key:JSON.stringify(params)};
}
export function createCodeMotionLayer({onReady=()=>{},onError=()=>{}}={}){
 let runtime=null,key='',prepared=null,bitmap=null,frameTime=-1,serial=0,epoch=0,wanted=null,errorKey='',chain=Promise.resolve(),pumping=false;
 function release(){serial++;runtime?.dispose();runtime=null;key='';prepared=null;bitmap?.close();bitmap=null;frameTime=-1;errorKey=''}
 function reset(){epoch++;wanted=null;release()}
 async function frame(input){
  if(errorKey===input.key)throw Error('このモーションの実行に失敗しました。コードを確認して再適用してください。');
  if(input.key!==key){release();key=input.key;const own=serial;runtime=createCodeMotionRuntime();const r=runtime;prepared=(async()=>{if(!isCodeMotionApproved(input.params.source))throw Error('未確認のコードモーションです。「コードを編集」からプレビューして有効にしてください。');const fontBytes=await getCodeMotionFont(input.params.font);if(own!==serial)throw Error('モーションの選択が変わりました。');await r.prepare({...input.params,fontBytes})})();}
  const own=serial,r=runtime;await prepared;if(own!==serial)return null;
  if(bitmap&&frameTime===input.time)return bitmap;
  const next=await r.render(input.time);if(own!==serial){next.close();return null}bitmap?.close();bitmap=next;frameTime=input.time;return bitmap;
 }
 function enqueue(input){const ticket=epoch;const job=chain.catch(()=>{}).then(()=>ticket===epoch?frame(input):null);chain=job.catch(()=>{});return job}
 async function pump(){if(pumping)return;pumping=true;try{while(wanted){const next=wanted;wanted=null;try{const result=await enqueue(next);if(result)onReady()}catch(e){if(key===next.key){errorKey=next.key;runtime?.dispose();onError(e)}}}}finally{pumping=false}}
 return {reset,async prepareFrame(event,time,options){wanted=null;return enqueue(codeFrameInput(event,time,options))},draw(ctx,event,time,options){const input=codeFrameInput(event,time,options);if(input.key===key&&bitmap)ctx.drawImage(bitmap,0,0,options.width,options.height);if(errorKey!==input.key&&!(bitmap&&input.key===key&&input.time===frameTime)){wanted=input;pump()}},dispose:reset};
}
