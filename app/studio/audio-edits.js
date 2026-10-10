import {clone,StudioError} from './model.js';
const find=(a,id)=>a.find(x=>x.id===id)||(()=>{throw new StudioError('NOT_FOUND');})();
export function resolveAudioSpan(p,audioId){
 const a=find(p.audio,audioId);if(!a.linkClipId)return {startUs:a.startUs,endUs:a.endUs,sourceInUs:a.sourceInUs,envelope:clone(a.envelope)};
 const c=find(p.clips,a.linkClipId),s=find(p.scenes,c.sceneId),clipStart=s.originUs+c.startUs;
 const startUs=Math.max(s.startUs,clipStart),endUs=Math.max(startUs,Math.min(s.endUs,s.originUs+c.endUs));
 return {startUs,endUs,sourceInUs:c.sourceInUs+startUs-clipStart,envelope:clone(a.envelope)};
}
function contentOrigin(p,clipId){const c=p.clips.find(c=>c.id===clipId),s=p.scenes.find(s=>s.id===c?.sceneId);return c&&s?s.originUs+c.startUs-c.sourceInUs:null;}
function trimEnvelope(a,startUs,endUs){if(!a.envelope.durationUs)return;const durationUs=endUs-startUs;if(durationUs<=0)return;a.envelope={...a.envelope,originUs:startUs,durationUs,fadeInUs:Math.min(a.envelope.fadeInUs||0,durationUs),fadeOutUs:Math.min(a.envelope.fadeOutUs||0,durationUs)};}
export function reconcileLinkedAudio(before,after,command){
 for(const a of after.audio){if(!a.linkClipId)continue;const prior=before.audio.find(x=>x.id===a.id);if(prior?.linkClipId){const oldOrigin=contentOrigin(before,prior.linkClipId),nextOrigin=contentOrigin(after,a.linkClipId);if(oldOrigin!==null&&nextOrigin!==null)a.envelope.originUs+=nextOrigin-oldOrigin;}
 const span=resolveAudioSpan(after,a.id);if(command?.type==='trimClip'&&command.id===a.linkClipId||command?.type==='trimScene'&&after.clips.find(c=>c.id===a.linkClipId)?.sceneId===command.id)trimEnvelope(a,span.startUs,span.endUs); // Serialized bounds describe the clip; scene masking remains derived.
 const c=find(after.clips,a.linkClipId),s=find(after.scenes,c.sceneId);a.startUs=Math.max(0,s.originUs+c.startUs);a.endUs=Math.max(a.startUs+1,s.originUs+c.endUs);a.sourceInUs=c.sourceInUs;
 }
 return after;
}
export function editAudio(p,c){
 const error=code=>{throw new StudioError(code);};
 if(c.type==='insertAudio'){if(c.audio.role==='music'&&p.locks.music&&p.audio.some(a=>a.role==='music'))error('TRACK_LOCKED');p.audio.push(clone(c.audio));return true;}
 if(c.type==='recreateSourceAudio'){const clip=find(p.clips,c.clipId);if(clip.kind!=='video')error('INVALID_AUDIO_LINK');if(p.audio.some(a=>a.linkClipId===clip.id))error('DUPLICATE_AUDIO_LINK');if(p.audio.some(a=>!a.linkClipId&&a.assetId===clip.assetId)&&!c.allowDuplicate)error('DUPLICATE_AUDIO_CONFIRMATION');const scene=find(p.scenes,clip.sceneId),startUs=scene.originUs+clip.startUs;p.audio.push({id:c.newId,role:'source',assetId:clip.assetId,startUs:Math.max(0,startUs),endUs:scene.originUs+clip.endUs,sourceInUs:clip.sourceInUs,linkClipId:clip.id,muted:false,gain:1,envelope:{originUs:startUs,points:[]}});return true;}
 if(!['moveAudio','trimAudio','splitAudio','deleteAudio','muteAudio','setEnvelope','detachAudio'].includes(c.type))return false;
 const a=find(p.audio,c.id);
 if(['moveAudio','trimAudio','splitAudio','deleteAudio','detachAudio'].includes(c.type)&&a.role==='music'&&p.locks.music)error('TRACK_LOCKED');
 if(['moveAudio','trimAudio','splitAudio'].includes(c.type)&&a.linkClipId)error('LINKED_AUDIO_EDIT');
 switch(c.type){
 case 'moveAudio':{const delta=c.startUs-a.startUs;a.startUs+=delta;a.endUs+=delta;a.envelope.originUs+=delta;break;}
 case 'trimAudio':a.sourceInUs+=c.startUs-a.startUs;a.startUs=c.startUs;a.endUs=c.endUs;trimEnvelope(a,c.startUs,c.endUs);break;
 case 'splitAudio':{if(c.atUs<=a.startUs||c.atUs>=a.endUs)error('EMPTY_RANGE');const right={...clone(a),id:c.newId,startUs:c.atUs,sourceInUs:a.sourceInUs+c.atUs-a.startUs};a.endUs=c.atUs;p.audio.push(right);break;}
 case 'deleteAudio':if(a.linkClipId)a.muted=true;else p.audio=p.audio.filter(x=>x.id!==c.id);break;
 case 'muteAudio':a.muted=c.muted;break;
 case 'setEnvelope':a.envelope=clone(c.envelope);break;
 case 'detachAudio':{if(!a.linkClipId)error('NOT_LINKED');const span=resolveAudioSpan(p,a.id);if(span.endUs<=span.startUs)error('EMPTY_RANGE');p.audio=p.audio.filter(x=>x.id!==a.id);p.audio.push({...clone(a),...span,id:c.newId,linkClipId:null,sourceClipId:a.linkClipId});break;}
 }
 return true;
}
