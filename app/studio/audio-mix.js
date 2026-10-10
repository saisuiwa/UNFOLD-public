import {resolveAudioSpan} from './audio-edits.js';
import {StudioError} from './model.js';
import {sampleAt} from './time.js';
import {checkAbort} from './file.js';
export function gainAt(envelope,projectUs){if(envelope?.durationUs)return boundaryGain({startUs:envelope.originUs,endUs:envelope.originUs+envelope.durationUs,fadeInUs:envelope.fadeInUs,fadeOutUs:envelope.fadeOutUs},projectUs);const points=envelope?.points||[];if(!points.length)return 1;const t=projectUs-envelope.originUs;if(t<=points[0].atUs)return points[0].gain;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(t<=b.atUs)return b.atUs===a.atUs?b.gain:a.gain+(b.gain-a.gain)*(t-a.atUs)/(b.atUs-a.atUs);}return points.at(-1).gain;}
export function boundaryGain(short,projectUs){if(!short)return 1;if(projectUs<short.startUs||projectUs>=short.endUs)return 0;const length=short.endUs-short.startUs,fadeIn=Math.min(length,short.fadeInUs||0),fadeOut=Math.min(length,short.fadeOutUs||0);return (fadeIn?Math.min(1,(projectUs-short.startUs)/fadeIn):1)*(fadeOut?Math.min(1,(short.endUs-projectUs)/fadeOut):1);}
export async function mixAudio(p,reader,{startSample,frames,short,signal}){
 if(!Number.isSafeInteger(startSample)||!Number.isSafeInteger(frames)||frames<0)throw new StudioError('INVALID_AUDIO_RANGE');checkAbort(signal);const channels=[new Float32Array(frames),new Float32Array(frames)];
 for(const a of p.audio){if(a.muted||a.gain===0)continue;const span=resolveAudioSpan(p,a.id),start=sampleAt(span.startUs),end=sampleAt(span.endUs),from=Math.max(startSample,start,0),to=Math.min(startSample+frames,end,sampleAt(p.durationUs));
  for(let at=from;at<to;at+=48000){checkAbort(signal);const count=Math.min(48000,to-at),sourceSample=sampleAt(span.sourceInUs)+at-start;let pcm;try{pcm=await reader.audioBlock(a.assetId,a.trackId,sourceSample,count,signal);}catch(e){if(e.code==='ABORTED')throw e;throw new StudioError(e.code||'AUDIO_DECODE_FAILED',[{code:e.code||'AUDIO_DECODE_FAILED',targetId:a.id,message:'音声を読み込めません。素材と使用設定を確認してください。'}]);}if(pcm.sampleRate!==48000||pcm.channels.length!==2||pcm.channels.some(c=>c.length!==count))throw new StudioError('INVALID_PCM');
   for(let i=0;i<count;i++){const index=at+i-startSample,time=(at+i)*1e6/48000,gain=a.gain*gainAt(span.envelope,time);channels[0][index]+=pcm.channels[0][i]*gain;channels[1][index]+=pcm.channels[1][i]*gain;}
  }
 }
 let peak=0;for(let i=0;i<frames;i++){const gain=boundaryGain(short,(startSample+i)*1e6/48000);for(const c of channels){c[i]*=gain;peak=Math.max(peak,Math.abs(c[i]));}}checkAbort(signal);return {pcm:{sampleRate:48000,channels},peak};
}
