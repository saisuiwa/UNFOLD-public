import {StudioError,integerUs,frameUs} from './time.js';
export {StudioError};
export const FORMAT='unfold-studio';
export const clone=value=>structuredClone(value);
export function newLayout(){return {x:.5,y:.5,scale:1,rotation:0,anchor:'canvas',fit:'contain',focus:{x:.5,y:.5},backdrop:'solid',textWidth:.84,fontScale:.06,breaks:[]};}
export function createProject({id=crypto.randomUUID(),durationUs=30e6}={}){
 integerUs(durationUs);if(!durationUs)throw new StudioError('EMPTY_RANGE');durationUs=frameUs(Math.max(1,Math.round(durationUs*30/1e6)));
 return {format:FORMAT,version:1,id,name:'新しいMV',revision:0,durationUs,fps:30,bg:'#111718',scenes:[],clips:[],lyrics:[],audio:[],locks:{music:true,lyrics:true},views:Object.fromEntries([['wide',1920,1080],['tall',1080,1920]].map(([id,width,height])=>[id,{id,width,height,layout:{},safe:{left:.08,right:.08,top:.1,bottom:.1}}])),shorts:[],assets:{},unfolds:{}};
}
export function validateProject(p){
 const issues=[],add=(code,targetId,message=code)=>issues.push({code,targetId,message});
 if(!p||p.format!==FORMAT||p.version!==1){add('UNSUPPORTED_VERSION');return issues;}
 const time=x=>Number.isSafeInteger(x)&&x>=0,finite=x=>typeof x==='number'&&Number.isFinite(x);
 if(!p.id||!time(p.revision)||!time(p.durationUs)||!p.durationUs||p.fps!==30)add('INVALID_TIME');
 for(const k of ['scenes','clips','lyrics','audio','shorts'])if(!Array.isArray(p[k]))add('INVALID_STRUCTURE',k);
 if(issues.some(i=>i.code==='INVALID_STRUCTURE'))return issues;
 if(!p.assets||!p.unfolds||typeof p.locks?.music!=='boolean'||typeof p.locks?.lyrics!=='boolean'){add('INVALID_STRUCTURE');return issues;}
 const seen=new Set();for(const x of [...p.scenes,...p.clips,...p.lyrics,...p.audio,...p.shorts]){if(typeof x?.id!=='string'||!x.id||seen.has(x.id))add('DUPLICATE_ID',x?.id);seen.add(x?.id);}
 const interval=(x,absolute=true)=>{if(!time(x.startUs)||!time(x.endUs)||x.endUs<=x.startUs)add('INVALID_TIME',x.id);if(absolute&&x.endUs>p.durationUs)add('CONTENT_OUT_OF_RANGE',x.id);};
 const noOverlap=(items,code)=>{const ordered=[...items].sort((a,b)=>a.startUs-b.startUs);for(let i=1;i<ordered.length;i++)if(ordered[i].startUs<ordered[i-1].endUs)add(code,ordered[i].id);};
 noOverlap(p.scenes,'SCENE_OVERLAP');noOverlap(p.lyrics,'LYRIC_OVERLAP');
 for(const s of p.scenes){interval(s);if(!Number.isSafeInteger(s.originUs))add('INVALID_TIME',s.id);}
 const sceneIds=new Set(p.scenes.map(s=>s.id)),clipIds=new Set(p.clips.map(c=>c.id)),layoutIds=new Set([...clipIds,...p.lyrics.map(l=>l.id)]);
 const asset=(id,target)=>{if(!p.assets[id])add('MISSING_ASSET',target);};
 for(const c of p.clips){interval(c,false);if(!sceneIds.has(c.sceneId))add('MISSING_SCENE',c.id);if(!['image','video','text','p5','unfold'].includes(c.kind))add('INVALID_KIND',c.id);if(!time(c.sourceInUs)||!Number.isSafeInteger(c.effectOriginUs))add('INVALID_TIME',c.id);if(!finite(c.opacity)||c.opacity<0||c.opacity>1||!finite(c.z)||!Number.isSafeInteger(c.seed))add('INVALID_VALUE',c.id);if(['image','video'].includes(c.kind))asset(c.assetId,c.id);if(c.kind==='unfold'&&!p.unfolds[c.unfoldId])add('MISSING_UNFOLD',c.id);}
 for(const l of p.lyrics){interval(l);if(typeof l.text!=='string'||!Array.isArray(l.runs))add('INVALID_LYRIC',l.id);}
 for(const a of p.audio){interval(a,!a.linkClipId);asset(a.assetId,a.id);if(a.linkClipId&&!clipIds.has(a.linkClipId))add('MISSING_CLIP',a.id);if(a.linkClipId&&p.clips.find(c=>c.id===a.linkClipId)?.kind!=='video')add('INVALID_AUDIO_LINK',a.id);if(!['music','sfx','source'].includes(a.role)||!time(a.sourceInUs)||!finite(a.gain)||a.gain<0||typeof a.muted!=='boolean')add('INVALID_AUDIO',a.id);if(!a.envelope||!Number.isSafeInteger(a.envelope.originUs)||!Array.isArray(a.envelope.points)||a.envelope.points.some(q=>!time(q.atUs)||!finite(q.gain)||q.gain<0))add('INVALID_ENVELOPE',a.id);}
 for(const viewId of ['wide','tall']){const v=p.views?.[viewId];if(!v||!finite(v.width)||!finite(v.height)||v.width<=0||v.height<=0||!v.layout){add('INVALID_VIEW',viewId);continue;}
  for(const id of layoutIds)if(!v.layout[id])add('MISSING_LAYOUT',id);
  for(const [id,l] of Object.entries(v.layout)){if(!layoutIds.has(id))add('ORPHAN_LAYOUT',id);if(!l||['x','y','scale','rotation','textWidth','fontScale'].some(k=>!finite(l[k]))||l.scale<=0||l.textWidth<=0||l.textWidth>1||l.fontScale<.03||!['contain','cover','manual'].includes(l.fit)||!['solid','blur'].includes(l.backdrop))add('INVALID_LAYOUT',id);if(l?.anchor!=='canvas'&&(!clipIds.has(l?.anchor?.clipId)||l?.anchor?.clipId===id))add('INVALID_ANCHOR',id);}
  // An anchor loop (A→B→A) would make every render throw ANCHOR_CYCLE; reject it where it is created or arrives.
  for(const start of Object.keys(v.layout)){const seen=new Set();let id=start;while(id&&!seen.has(id)){seen.add(id);const a=v.layout[id]?.anchor;id=a&&a!=='canvas'?a.clipId:null;}if(id===start)add('ANCHOR_CYCLE',start);}
 }
 for(const [id,a] of Object.entries(p.assets))if(id!==a.id||a.projectId!==p.id||!time(a.byteLength)||typeof a.hash!=='string')add('INVALID_ASSET',id);
 for(const [id,u] of Object.entries(p.unfolds)){if(u.id!==id||u.version!==1||!Array.isArray(u.dependencies))add('INVALID_UNFOLD',id);else for(const dep of u.dependencies)asset(dep,id);}
 // Invalidated short ranges are preserved for repair; export validates them.
 for(const s of p.shorts)if(!time(s.startUs)||!time(s.endUs)||s.startUs>=s.endUs||!p.views[s.viewId]||!time(s.fadeInUs)||!time(s.fadeOutUs))add('INVALID_SHORT_RANGE',s.id);
 return issues;
}
export function assertProject(p){const issues=validateProject(p);if(issues.length)throw new StudioError(issues[0].code,issues);return p;}
