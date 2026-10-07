// Await scene preparation for every frame; simulation speed never changes video time.
import {MP4Writer} from './mp4-writer.js?v=1';
import {WebMWriter} from './webm-writer.js?v=2';
export async function encodeCanvasVideo({canvas,width,height,fps=30,seconds,format='mp4',draw,cancelled=()=>false,onProgress=()=>{}}){
 if(!globalThis.VideoEncoder)throw Error('このブラウザはWebCodecsに対応していません。Chromeで開いてください。');
 if(!Number.isFinite(seconds)||seconds<=0)throw Error('書き出し範囲が空です。');
 const base={width,height,framerate:fps,bitrate:width*height>1e6?16000000:8000000,latencyMode:'quality'};
 let codec,mkv;const mp4=format==='mp4';
 if(mp4){for(const c of ['avc1.64002A','avc1.640033','avc1.4D402A','avc1.42E02A'])if((await VideoEncoder.isConfigSupported({...base,codec:c,avc:{format:'avc'}})).supported){codec=c;break}if(!codec)throw Error('MP4の書き出しに対応していません。WebMを選んでください。');base.avc={format:'avc'};}
 else{codec='vp09.00.40.08';mkv='V_VP9';if(!(await VideoEncoder.isConfigSupported({...base,codec})).supported){codec='vp8';mkv='V_VP8';}}
 const writer=mp4?new MP4Writer({width,height,fps}):new WebMWriter({width,height,fps,codec:mkv});
 let error;const encoder=new VideoEncoder({output:(chunk,meta)=>writer.addChunk(chunk,1,meta),error:e=>{error=e}});
 const check=()=>{if(cancelled())throw new DOMException('書き出しを中止しました。','AbortError');if(error)throw error};
 try{encoder.configure({...base,codec});const count=Math.max(1,Math.round(seconds*fps));
  for(let k=0;k<count;k++){check();await draw(k/fps);check();const frame=new VideoFrame(canvas,{timestamp:Math.round(k*1e6/fps),duration:Math.round(1e6/fps)});try{encoder.encode(frame,{keyFrame:k%(fps*2)===0})}finally{frame.close()}
   while(encoder.encodeQueueSize>6){check();await new Promise(r=>setTimeout(r,4))}onProgress((k+1)/count);if(k%10===0)await new Promise(r=>setTimeout(r,0));
  }await encoder.flush();check();return writer.finish();
 }finally{if(encoder.state!=='closed')encoder.close()}
}
