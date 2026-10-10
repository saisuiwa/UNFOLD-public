import {editAudio,reconcileLinkedAudio} from './audio-edits.js';
import {clone,assertProject,StudioError,newLayout} from './model.js';
import {frameUs} from './time.js';
const fail=code=>{throw new StudioError(code);};
export function findById(items,id){return items.find(x=>x.id===id)||fail('NOT_FOUND');}
function patch(target,values,allowed){if(!values||Object.keys(values).some(k=>!allowed.includes(k)))fail('INVALID_PATCH');Object.assign(target,clone(values));}
function layouts(p,oldId,newId){for(const v of Object.values(p.views))v.layout[newId]=clone(v.layout[oldId]);}
function snapshotCopy(p,c,newId){if(c.kind==='unfold'){if(!newId||p.unfolds[newId])fail('DUPLICATE_ID');p.unfolds[newId]={...clone(p.unfolds[c.unfoldId]),id:newId};c.unfoldId=newId;}}
function deleteVisual(p,ids){p.clips=p.clips.filter(c=>!ids.includes(c.id));p.audio=p.audio.filter(a=>!ids.includes(a.linkClipId));for(const v of Object.values(p.views)){for(const id of ids)delete v.layout[id];for(const l of Object.values(v.layout))if(ids.includes(l.anchor?.clipId))l.anchor='canvas';}}
function shiftScene(s,start){const delta=start-s.startUs;s.startUs=start;s.endUs+=delta;s.originUs+=delta;}
function splitAllowed(start,end,at){if(at-start<frameUs(1)||end-at<frameUs(1))fail('CLIP_TOO_SHORT');}
function addAssets(p,items=[]){for(const a of items){if(p.assets[a.id]&&JSON.stringify(p.assets[a.id])!==JSON.stringify(a))fail('ASSET_CONFLICT');p.assets[a.id]=clone(a);}}
/** Immutable commands are the only editor mutation boundary. */
export function applyCommand(project,command){
 if(command.type==='batch'){let current=clone(project);for(const item of command.commands)current=applyCommand(current,item).project;return {project:current,changed:JSON.stringify(current)!==JSON.stringify(project)};}
 const p=clone(project);execute(p,command);reconcileLinkedAudio(project,p);p.scenes.sort((a,b)=>a.startUs-b.startUs);assertProject(p);return {project:p,changed:JSON.stringify(project)!==JSON.stringify(p)};
}
function execute(p,c){
 switch(c.type){
 case 'batch':for(const command of c.commands)execute(p,command);break;
 case 'setLock':if(!['music','lyrics'].includes(c.track)||typeof c.locked!=='boolean')fail('INVALID_LOCK');p.locks[c.track]=c.locked;break;
 case 'setLyricText':{const l=findById(p.lyrics,c.id);l.text=c.text;l.runs=clone(c.runs);break;}
 case 'setLyricAppearance':patch(findById(p.lyrics,c.id),c.patch,['motion','opacity']);break;
 case 'setLyricTiming':{if(p.locks.lyrics)fail('TRACK_LOCKED');const l=findById(p.lyrics,c.id);l.startUs=c.startUs;l.endUs=c.endUs;break;}
 case 'deleteLyric':{if(p.locks.lyrics)fail('TRACK_LOCKED');findById(p.lyrics,c.id);p.lyrics=p.lyrics.filter(l=>l.id!==c.id);for(const v of Object.values(p.views))delete v.layout[c.id];break;}
 case 'replaceLyrics':{if(p.locks.lyrics)fail('TRACK_LOCKED');for(const v of Object.values(p.views)){for(const l of p.lyrics)delete v.layout[l.id];for(const l of c.lyrics)v.layout[l.id]=newLayout();}p.lyrics=clone(c.lyrics);break;}
 case 'setAudioGain':findById(p.audio,c.id).gain=c.gain;break;
 case 'insertScene':p.scenes.push(clone(c.scene));break;
 case 'insertClip':{addAssets(p,c.assetMetas);p.clips.push(clone(c.clip));for(const v of Object.values(p.views))v.layout[c.clip.id]=clone(c.layouts?.[v.id]||newLayout());break;}
 case 'setClipContent':patch(findById(p.clips,c.id),c.patch,['text','motion','settings','opacity','z','seed','name']);break;
 case 'moveScene':shiftScene(findById(p.scenes,c.id),c.startUs);break;
 case 'trimScene':{const s=findById(p.scenes,c.id);if(c.endUs-c.startUs<frameUs(1))fail('CLIP_TOO_SHORT');s.startUs=c.startUs;s.endUs=c.endUs;break;}
 case 'deleteScene':{findById(p.scenes,c.id);deleteVisual(p,p.clips.filter(x=>x.sceneId===c.id).map(x=>x.id));p.scenes=p.scenes.filter(x=>x.id!==c.id);break;}
 case 'reorderScenes':{const group=c.ids.map(id=>findById(p.scenes,id)).sort((a,b)=>a.startUs-b.startUs);if(new Set(c.ids).size!==c.ids.length||c.order.length!==c.ids.length||new Set(c.order).size!==c.ids.length||c.order.some(id=>!c.ids.includes(id)))fail('INVALID_REORDER');if(group.some((s,i)=>i&&s.startUs!==group[i-1].endUs))fail('NONCONTIGUOUS_REORDER');let time=group[0].startUs;for(const id of c.order){const s=findById(group,id),duration=s.endUs-s.startUs;shiftScene(s,time);time+=duration;}break;}
 case 'splitScene':{const s=findById(p.scenes,c.id);splitAllowed(s.startUs,s.endUs,c.atUs);const right={...clone(s),id:c.newId,startUs:c.atUs};s.endUs=c.atUs;p.scenes.push(right);for(const original of [...p.clips.filter(x=>x.sceneId===c.id)]){const id=c.idMap?.[original.id];if(!id)fail('MISSING_ID_MAP');const copy={...clone(original),id,sceneId:c.newId};snapshotCopy(p,copy,c.idMap?.[original.unfoldId]);p.clips.push(copy);layouts(p,original.id,id);for(const v of Object.values(p.views)){const anchor=v.layout[id].anchor;if(anchor?.clipId&&c.idMap[anchor.clipId])anchor.clipId=c.idMap[anchor.clipId];}for(const a of [...p.audio.filter(a=>a.linkClipId===original.id)])p.audio.push({...clone(a),id:c.idMap?.[a.id]||`${id}:audio`,linkClipId:id});}break;}
 case 'moveClip':{const clip=findById(p.clips,c.id),delta=c.startUs-clip.startUs;clip.startUs+=delta;clip.endUs+=delta;clip.effectOriginUs+=delta;break;}
 case 'trimClip':{const clip=findById(p.clips,c.id);if(c.endUs-c.startUs<frameUs(1))fail('CLIP_TOO_SHORT');clip.sourceInUs+=c.startUs-clip.startUs;clip.startUs=c.startUs;clip.endUs=c.endUs;break;}
 case 'splitClip':{const clip=findById(p.clips,c.id);splitAllowed(clip.startUs,clip.endUs,c.atUs);const right={...clone(clip),id:c.newId,startUs:c.atUs,sourceInUs:clip.sourceInUs+c.atUs-clip.startUs};snapshotCopy(p,right,c.newUnfoldId);clip.endUs=c.atUs;p.clips.push(right);layouts(p,c.id,c.newId);for(const a of [...p.audio.filter(a=>a.linkClipId===c.id)])p.audio.push({...clone(a),id:`${c.newId}:audio`,linkClipId:c.newId});break;}
 case 'deleteClip':findById(p.clips,c.id);deleteVisual(p,[c.id]);break;
 case 'setLayout':{const v=p.views[c.viewId];if(!v||!v.layout[c.id])fail('MISSING_LAYOUT');patch(v.layout[c.id],c.patch,['x','y','scale','rotation','anchor','fit','focus','backdrop','textWidth','fontScale','breaks','camera']);break;}
 default:if(!editAudio(p,c))fail('UNKNOWN_COMMAND');
 }
}
