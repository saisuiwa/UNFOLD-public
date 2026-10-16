// Names for what the timeline shows: people read "語ごとにドンと落ちる" and "くしゃくしゃ / ハート", not code or ids.
import {CODE_MOTION_PRESETS} from '../code-motion-presets.js';
import {WORKSHOP_EXAMPLES} from '../workshop-examples.js';
import {TEXT_MOTIONS} from '../lyric-motion.js?v=28';
import {BUILTIN_MOTIONS,LAYOUTS,ENTRANCES} from '../lyric-recipe.js';
import {BUILTIN_METHODS} from '../method-registry.js';
import {cutActive} from './cuts/plan.js';

const sourceNames=new Map();
for(const item of [...CODE_MOTION_PRESETS,...WORKSHOP_EXAMPLES])if(typeof item.source==='string'&&item.name&&!sourceNames.has(item.source))sourceNames.set(item.source,item.name);
const methodNames=new Map(BUILTIN_METHODS.map(m=>[m[0],m[1]]));
const SHAPES={none:'平面',sphere:'球',torus:'ドーナツ',helix:'らせん',mass:'塊',cube:'立方体',heart:'ハート',star:'星',saturn:'土星',mobius:'メビウスの輪',diamond:'ダイヤ',flower:'花',human:'人',pegasus:'ペガサス',whale:'クジラ',dragon:'龍',flock:'鳥の群れ',spheres:'球の群れ',apple:'りんご',icecream:'アイス',text:'文字',silA:'シルエット',silB:'シルエット'};
const FONTS={gothic:'ゴシック',mincho:'明朝',rounded:'丸ゴシック',hand:'手書き',brush:'筆'};
export const shapeLabel=key=>SHAPES[key]||(String(key||'').startsWith('glb-')?'自作モデル':String(key||'平面'));
export const methodLabel=key=>methodNames.get(key)||(/^(cm-|im-)/.test(key||'')?'自作の崩れ方':String(key||'—'));
export const codeName=code=>code?.source?(sourceNames.get(code.source)||'自作コード'):'';
export function lyricMotionName(motion){
 if(motion?.code)return codeName(motion.code);
 const layout=motion?.recipe?.layout;
 if(layout){const builtin=BUILTIN_MOTIONS.find(m=>m.motion?.recipe?.layout===layout);return builtin?builtin.name:(LAYOUTS[layout]||ENTRANCES[motion.recipe.enter]||'レシピ');}
 return TEXT_MOTIONS[motion?.preset||'float']?.label||'ふわっと';
}
/** 歌詞の「文字の動き」の名前。カット演出がついていれば、そう言う */
export const lyricStyleName=lyric=>cutActive(lyric)?`カット演出（${lyric.cut.cuts.length}カット）`:lyricMotionName(lyric.motion);
export const unfoldLabels=(project,clip)=>(project.unfolds?.[clip.unfoldId]?.state?.transitions||[]).map(t=>methodLabel(t.method)+' / '+shapeLabel(t.shape));
export const isEffectClip=c=>c.kind==='p5'||c.kind==='text';
// a background effect draws no text: a text clip whose body is only code
export const isBackgroundClip=c=>c.kind==='text'&&!!c.motion?.code&&!String(c.text||'').trim();
export function clipTitle(c){
 if(c.kind==='text'&&cutActive(c))return 'カット演出：'+String(c.text).split('\n')[0].slice(0,8);
 if(c.kind==='text'&&c.motion?.code){const n=codeName(c.motion.code);if(n&&isBackgroundClip(c))return n;if(n)return n+(c.text?'：'+String(c.text).split('\n')[0].slice(0,8):'');}
 return c.name||c.kind;
}
export function sceneSummary(project,scene){
 const out=[];
 for(const c of project.clips.filter(x=>x.sceneId===scene.id&&['image','video','unfold'].includes(x.kind)).sort((a,b)=>a.z-b.z)){
  if(c.kind==='unfold'){const labels=unfoldLabels(project,c);out.push('◆ '+(labels[0]||c.name||'UNFOLD')+(labels.length>1?` ほか${labels.length-1}`:''));}
  else out.push(c.name||c.kind);
 }
 return out;
}
export function absRange(project,clip){
 const scene=project.scenes.find(s=>s.id===clip.sceneId);
 return scene?{start:Math.max(scene.startUs,scene.originUs+clip.startUs),end:Math.min(scene.endUs,scene.originUs+clip.endUs)}:null;
}
const overlapping=(project,start,end)=>project.clips.filter(c=>{const r=absRange(project,c);return r&&r.start<end&&start<r.end;});
const chip=(kind,label,value)=>({kind,label,value});
const KIND_LABEL={image:'画像',video:'動画',text:'装飾文字',p5:'演出',unfold:'UNFOLD'};
// one chip per clip: a background says 背景, an effect 演出, a decorative text 装飾文字, an UNFOLD its first transition
const clipChip=(project,c)=>chip(isBackgroundClip(c)?'bg':c.kind==='unfold'?'unfold':isEffectClip(c)?'fx':'media',isBackgroundClip(c)?'背景':KIND_LABEL[c.kind]||c.kind,c.kind==='unfold'?(unfoldLabels(project,c)[0]||c.name||'UNFOLD'):clipTitle(c));
/** What is inside the selected item, as small labelled chips (the 参考ツール-style "いまの案"). */
export function chipsFor(project,selection){
 if(!selection)return [];
 const find=(list,id)=>list.find(x=>x.id===selection.id);
 if(selection.kind==='lyric'){
  const l=find(project.lyrics);if(!l)return [];
  const out=[chip('motion','文字の動き',lyricStyleName(l))];
  const near=overlapping(project,l.startUs,l.endUs);
  for(const c of near.filter(isBackgroundClip))out.push(chip('bg','背景',clipTitle(c)));
  for(const c of near.filter(c=>isEffectClip(c)&&!isBackgroundClip(c)))out.push(chip('fx','演出',clipTitle(c)));
  for(const c of near.filter(c=>c.kind==='unfold')){const labels=unfoldLabels(project,c);out.push(chip('unfold','UNFOLD',labels.slice(0,2).join('、')+(labels.length>2?` ほか${labels.length-2}`:'')||c.name));}
  out.push(chip('font','書体・色',(FONTS[l.motion?.font]||'自分の書体')+' ／ '+(l.motion?.color||'#ffffff')));
  return out;
 }
 if(selection.kind==='clip'){
  const c=find(project.clips);if(!c)return [];
  const out=[clipChip(project,c)];
  if(c.kind==='unfold')for(const label of unfoldLabels(project,c).slice(0,3))out.push(chip('unfold','変形',label));
  return out;
 }
 if(selection.kind==='scene'){
  const s=find(project.scenes);if(!s)return [];
  return project.clips.filter(c=>c.sceneId===s.id).sort((a,b)=>b.z-a.z).map(c=>clipChip(project,c));
 }
 return [];
}
