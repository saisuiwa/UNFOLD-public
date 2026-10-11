// おまかせ: choose a motion for every lyric, a background for each stretch of lines and a palette, from per-mood allow-lists
// (the idea of 参考ツール's moods; the motions are UNFOLD's own). Everything is derived from seeds, so a plan can be replayed (前の案) and one part re-rolled (ここだけ変える).
// Pure functions: no DOM, no controller.
import {cleanMotion} from '../lyric-motion.js?v=26';
import {LYRIC_PALETTES} from '../lyric-style.js';
import {DAILY_CODE_MOTIONS} from '../code-motion-daily.js';

export const MOODS=[
 {id:'calm',name:'しっとり',text:['drop-settle','squash-in','rgb-settle','gucha-melt','gucha-ripple','gucha-bubble','gucha-ghost','kn-flow','kn-dive','echo-stack'],bg:['bg-concentric','bg-dot-wave'],palettes:['クリーム','ラベンダー','白と光','ソーダ']},
 {id:'pop',name:'ポップ',text:['gucha-squash','gucha-rubber','gucha-bubble','gucha-burst','gucha-wobble','kn-slam','kn-seesaw','kn-collide','letter-boxes','keycap-type'],bg:['bg-dot-wave','bg-diagonal'],palettes:['ミント','ベリー','夕焼け','ソーダ']},
 {id:'glitch',name:'グリッチ',text:['rgb-settle','gucha-boil','gucha-shuffle','gucha-strips','kn-swap','kn-cuts','kn-typeslam','bracket-glitch','flip-up'],bg:['bg-scan-grid','bg-speed-lines'],palettes:['白と光','ソーダ','ミント']},
 {id:'graphic',name:'グラフィック',text:['kn-turn','kn-reflow','gucha-steps','gucha-lanes','gucha-tiles','gucha-flip','layer-extrude','echo-stack','tape-cards'],bg:['bg-square-tunnel','bg-diagonal','bg-scan-grid'],palettes:['白と光','ミント','夕焼け']},
 {id:'emotional',name:'エモ',text:['gucha-gather','gucha-ghost','gucha-magnet','gucha-spiral','gucha-tangle','kn-dive','drop-settle','echo-stack'],bg:['bg-concentric','bg-square-tunnel'],palettes:['ラベンダー','ベリー','夕焼け','クリーム']},
 {id:'impact',name:'勢い',text:['kn-slam','gucha-pile','gucha-burst','kn-collide','kn-typeslam','kn-cuts','layer-extrude','gucha-squash'],bg:['bg-speed-lines','bg-diagonal'],palettes:['夕焼け','白と光','ミント']},
];
export const MOOD_AUTO='auto';
export const BG_OPACITY=.55;
const byKey=new Map(DAILY_CODE_MOTIONS.map(m=>[m.key,m]));
export const motionOf=key=>byKey.get(key);
export const moodOf=id=>MOODS.find(m=>m.id===id);

function hash(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function rng(seed){let a=hash(seed);return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
export const newSeeds=(random=Math.random)=>({mood:Math.floor(random()*1e9),text:Math.floor(random()*1e9),bg:Math.floor(random()*1e9),color:Math.floor(random()*1e9)});

/** The plan for this project: which key for which lyric, which background for which stretch, which palette. */
export function planOmakase(project,{mood=MOOD_AUTO,seeds}){
 const chosen=mood===MOOD_AUTO?MOODS[Math.floor(rng('mood:'+seeds.mood)()*MOODS.length)]:moodOf(mood)||MOODS[0];
 const lyrics=[...project.lyrics].sort((a,b)=>a.startUs-b.startUs);
 // a motion for every lyric, never the same as the line before or the one before that
 const rt=rng('text:'+seeds.text),recent=[],lines=[];
 for(const l of lyrics){let pool=chosen.text.filter(k=>!recent.includes(k));if(!pool.length)pool=chosen.text;const key=pool[Math.floor(rt()*pool.length)];recent.push(key);if(recent.length>2)recent.shift();lines.push({id:l.id,key});}
 // a background for every stretch of 3-5 lines; the stretches follow each other without a gap
 const rb=rng('bg:'+seeds.bg),blocks=[];let previous='';
 const pickBg=()=>{let pool=chosen.bg.filter(k=>k!==previous);if(!pool.length)pool=chosen.bg;const key=pool[Math.floor(rb()*pool.length)];previous=key;return key;};
 if(!lyrics.length)blocks.push({startUs:0,endUs:project.durationUs,key:pickBg()});
 else{let i=0;while(i<lyrics.length){const size=3+Math.floor(rb()*3),from=i,to=Math.min(lyrics.length,i+size);i=to;blocks.push({startUs:blocks.length?lyrics[from].startUs:0,endUs:to>=lyrics.length?project.durationUs:lyrics[to].startUs,key:pickBg()});}}
 // a palette from the mood's list
 const rc=rng('color:'+seeds.color),name=chosen.palettes[Math.floor(rc()*chosen.palettes.length)],palette=LYRIC_PALETTES.find(p=>p.name===name)||LYRIC_PALETTES[0];
 return {moodId:chosen.id,moodName:chosen.name,seeds:{...seeds},lines,blocks,palette:{name:palette.name,color:palette.color,emphasisColor:palette.emphasisColor}};
}

// the sequence's own normaliser decides what a motion patch means; STUDIO-only fields (font assets) are kept
export const mergeMotion=(old,patch)=>({...(old||{}),...cleanMotion({...cleanMotion(old||{}),...patch})});

/**
 * One batch (one undo): the lyric motions / colours, and the background clips (the previous おまかせ backgrounds are replaced).
 * `parts` says what to touch; lyrics' text and timing, the song and every other clip are never touched.
 */
export function omakaseCommands(project,plan,{parts={text:true,bg:true,color:true},newId=()=>crypto.randomUUID()}={}){
 const commands=[],line=new Map(plan.lines.map(l=>[l.id,l.key]));
 if(parts.text||parts.color){
  for(const l of project.lyrics){
   const patch={};
   if(parts.text&&line.has(l.id)){patch.code={version:1,source:motionOf(line.get(l.id)).source};patch.recipe=null;}
   if(parts.color){patch.color=plan.palette.color;patch.emphasisColor=plan.palette.emphasisColor;}
   if(Object.keys(patch).length)commands.push({type:'setLyricAppearance',id:l.id,patch:{motion:mergeMotion(l.motion,patch)}});
  }
 }
 if(parts.bg){
  for(const c of project.clips)if(c.settings?.omakase)commands.push({type:'deleteClip',id:c.id});
  let scenes=project.scenes;
  if(!scenes.length){const scene={id:newId(),startUs:0,endUs:project.durationUs,originUs:0};commands.push({type:'insertScene',scene});scenes=[scene];}
  const z=Math.max(0,...project.clips.filter(c=>!c.settings?.omakase).map(c=>c.z))+1;
  for(const block of plan.blocks)for(const scene of scenes){
   const a=Math.max(block.startUs,scene.startUs),b=Math.min(block.endUs,scene.endUs);if(b-a<33334)continue;
   const item=motionOf(block.key),start=a-scene.originUs,end=b-scene.originUs;
   commands.push({type:'insertClip',clip:{id:newId(),name:'おまかせ背景：'+item.name,sceneId:scene.id,kind:'text',startUs:start,endUs:end,sourceInUs:0,effectOriginUs:start,opacity:BG_OPACITY,z,seed:7,settings:{omakase:true},text:' ',runs:[{id:newId(),text:' '}],motion:{font:'gothic',color:plan.palette.color,emphasisColor:plan.palette.emphasisColor,code:{version:1,source:item.source}}}});
  }
 }
 return commands.length?{type:'batch',commands}:null;
}

/** What the plan says, for the "いまの案" box. */
export function describePlan(plan){
 const names=keys=>[...new Set(keys)].map(k=>motionOf(k)?.name||k);
 return {mood:plan.moodName,motions:names(plan.lines.map(l=>l.key)),backgrounds:names(plan.blocks.map(b=>b.key)),palette:plan.palette.name};
}
