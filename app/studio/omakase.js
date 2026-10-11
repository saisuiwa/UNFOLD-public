// おまかせ: choose a motion for every lyric, a background for each stretch of lines and a palette, from per-mood allow-lists
// (the idea of 参考ツール's moods; the motions are UNFOLD's own). Everything is derived from seeds, so a plan can be replayed (前の案) and one part re-rolled (ここだけ変える).
// Pure functions: no DOM, no controller.
import {cleanMotion} from '../lyric-motion.js?v=26';
import {DAILY_CODE_MOTIONS} from '../code-motion-daily.js';

export const MOODS=[
 {id:'calm',name:'しっとり',text:['drop-settle','squash-in','rgb-settle','gucha-melt','gucha-ripple','gucha-bubble','gucha-ghost','kn-flow','kn-dive','echo-stack'],bg:['bg-concentric','bg-dot-wave'],families:['pastel','white','cool','warm'],size:{base:.075,spread:.015}},
 {id:'pop',name:'ポップ',text:['gucha-squash','gucha-rubber','gucha-bubble','gucha-burst','gucha-wobble','kn-slam','kn-seesaw','kn-collide','letter-boxes','keycap-type'],bg:['bg-dot-wave','bg-diagonal'],families:['pastel','neon','white','warm'],size:{base:.09,spread:.02}},
 {id:'glitch',name:'グリッチ',text:['rgb-settle','gucha-boil','gucha-shuffle','gucha-strips','kn-swap','kn-cuts','kn-typeslam','bracket-glitch','flip-up'],bg:['bg-scan-grid','bg-speed-lines'],families:['neon','mono','cool','rock'],size:{base:.085,spread:.018}},
 {id:'graphic',name:'グラフィック',text:['kn-turn','kn-reflow','gucha-steps','gucha-lanes','gucha-tiles','gucha-flip','layer-extrude','echo-stack','tape-cards'],bg:['bg-square-tunnel','bg-diagonal','bg-scan-grid'],families:['mono','white','rock','gold'],size:{base:.092,spread:.02}},
 {id:'emotional',name:'エモ',text:['gucha-gather','gucha-ghost','gucha-magnet','gucha-spiral','gucha-tangle','kn-dive','drop-settle','echo-stack'],bg:['bg-concentric','bg-square-tunnel'],families:['pastel','cool','warm','gold'],size:{base:.08,spread:.016}},
 {id:'impact',name:'勢い',text:['kn-slam','gucha-pile','gucha-burst','kn-collide','kn-typeslam','kn-cuts','layer-extrude','gucha-squash'],bg:['bg-speed-lines','bg-diagonal'],families:['rock','gold','neon','white'],size:{base:.105,spread:.025}},
];
export const MOOD_AUTO='auto';

// 配色の系統: the colour families the panel offers (the idea of picking a colour scheme as in 参考ツール; the colours are UNFOLD's own).
// Every palette is a text colour and the colour of an emphasised word; green is kept out on purpose (it used to dominate).
export const FAMILY_AUTO='auto';
export const COLOR_FAMILIES=[
 {id:'white',name:'白＋アクセント',palettes:[
  {name:'白とピンク',color:'#ffffff',emphasisColor:'#ff6fae'},{name:'白と水色',color:'#ffffff',emphasisColor:'#5fd3ff'},{name:'白と金',color:'#ffffff',emphasisColor:'#ffc04d'},
  {name:'白と紫',color:'#ffffff',emphasisColor:'#b69cff'},{name:'白と珊瑚',color:'#ffffff',emphasisColor:'#ff7a6b'}]},
 {id:'neon',name:'ネオン',palettes:[
  {name:'ネオン 水色×桃',color:'#7df9ff',emphasisColor:'#ff3fd2'},{name:'ネオン 桃×水色',color:'#ff7ad9',emphasisColor:'#7df9ff'},
  {name:'ネオン 黄×桃',color:'#fff35c',emphasisColor:'#ff4fa3'},{name:'ネオン 紫×橙',color:'#c58bff',emphasisColor:'#ffb347'}]},
 {id:'pastel',name:'パステル',palettes:[
  {name:'パステル さくら',color:'#ffe4ee',emphasisColor:'#9ad7ff'},{name:'パステル ゆめ',color:'#e5dcff',emphasisColor:'#ffd3a8'},
  {name:'パステル クリーム',color:'#fff3c4',emphasisColor:'#ffb3c7'},{name:'パステル そら',color:'#d6ecff',emphasisColor:'#ffc9de'}]},
 {id:'mono',name:'モノクロ',palettes:[
  {name:'モノクロ 銀と白',color:'#c9ced3',emphasisColor:'#ffffff'},{name:'モノクロ 白と灰',color:'#ffffff',emphasisColor:'#9aa4ad'},
  {name:'モノクロ 白だけ',color:'#ffffff',emphasisColor:'#ffffff'}]},
 {id:'warm',name:'暖色',palettes:[
  {name:'暖色 橙',color:'#fff0d9',emphasisColor:'#ff8a4c'},{name:'暖色 夕焼け',color:'#ffd9a0',emphasisColor:'#ff5d73'},
  {name:'暖色 琥珀',color:'#ffb36b',emphasisColor:'#fff2c2'},{name:'暖色 桃',color:'#ffd6cc',emphasisColor:'#ff6f91'}]},
 {id:'cool',name:'寒色',palettes:[
  {name:'寒色 氷',color:'#e6f4ff',emphasisColor:'#6fb7ff'},{name:'寒色 空と紫',color:'#b9e6ff',emphasisColor:'#a99bff'},
  {name:'寒色 青',color:'#8fd8ff',emphasisColor:'#ffffff'},{name:'寒色 藤',color:'#d8ccff',emphasisColor:'#7fd4ff'}]},
 {id:'rock',name:'ロック（赤）',palettes:[
  {name:'ロック 白と赤',color:'#ffffff',emphasisColor:'#ff3b3b'},{name:'ロック 赤と白',color:'#ff4d4d',emphasisColor:'#ffffff'},
  {name:'ロック 黄と赤',color:'#ffd23f',emphasisColor:'#ff3b3b'}]},
 {id:'gold',name:'ゴールド',palettes:[
  {name:'ゴールド 淡金',color:'#fff3c4',emphasisColor:'#ffc83d'},{name:'ゴールド 金と白',color:'#ffd76a',emphasisColor:'#ffffff'},
  {name:'ゴールド 金と朱',color:'#ffe08a',emphasisColor:'#ff7a45'}]}
];
export const familyOf=id=>COLOR_FAMILIES.find(f=>f.id===id);
export const BG_OPACITY=.55;
// the range of おまかせ sizes (fraction of the shorter side of the picture). Checked: every bundled text motion stays inside the frame at rest up to SIZE_MAX,
// in wide and tall, for lyrics of 7 to 35 characters (the layout wraps long lines).
export const SIZE_MIN=.05,SIZE_MAX=.15;
const byKey=new Map(DAILY_CODE_MOTIONS.map(m=>[m.key,m]));
export const motionOf=key=>byKey.get(key);
export const moodOf=id=>MOODS.find(m=>m.id===id);

function hash(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function rng(seed){let a=hash(seed);return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
export const newSeeds=(random=Math.random)=>({mood:Math.floor(random()*1e9),text:Math.floor(random()*1e9),bg:Math.floor(random()*1e9),color:Math.floor(random()*1e9),size:Math.floor(random()*1e9)});

/** The plan for this project: which key for which lyric, which background for which stretch, which palette. */
export function planOmakase(project,{mood=MOOD_AUTO,family=FAMILY_AUTO,seeds}){
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
 // a size for every lyric: the mood's size, a little more or less per line, now and then a line that is made big; long lines are kept smaller so they fit
 const rs=rng('size:'+(seeds.size??seeds.text)),sizes=lyrics.map(l=>{
  const n=[...String(l.text||'').replace(/\s/g,'')].length,fit=n>16?Math.max(.65,16/n):1;
  let v=chosen.size.base+(rs()*2-1)*chosen.size.spread;if(rs()<.2)v*=1.3;
  return {id:l.id,fontScale:Math.round(Math.min(SIZE_MAX,Math.max(SIZE_MIN,v*fit))*1000)/1000};
 });
 // a colour family (the one asked for, else one of the mood's), then a palette of that family
 const rc=rng('color:'+seeds.color),asked=family!==FAMILY_AUTO?familyOf(family):null,fam=asked||familyOf(chosen.families[Math.floor(rc()*chosen.families.length)])||COLOR_FAMILIES[0],palette=fam.palettes[Math.floor(rc()*fam.palettes.length)];
 return {moodId:chosen.id,moodName:chosen.name,seeds:{...seeds},lines,blocks,sizes,palette:{name:palette.name,color:palette.color,emphasisColor:palette.emphasisColor,familyId:fam.id,familyName:fam.name}};
}

// the sequence's own normaliser decides what a motion patch means; STUDIO-only fields (font assets) are kept
export function mergeMotion(old,patch){
 const cleaned=cleanMotion({...cleanMotion(old||{}),...patch}),out={...(old||{}),...cleaned};
 // cleanMotion returns `code` or `recipe` (or neither): the one it leaves out must not survive from the old motion, or the old code keeps winning
 if(!('code' in cleaned))delete out.code;
 if(!('recipe' in cleaned))delete out.recipe;
 return out;
}

/**
 * One batch (one undo): the lyric motions / colours, and the background clips (the previous おまかせ backgrounds are replaced).
 * `parts` says what to touch; lyrics' text and timing, the song and every other clip are never touched.
 */
export function omakaseCommands(project,plan,{parts={text:true,bg:true,color:true,size:true},newId=()=>crypto.randomUUID()}={}){
 const commands=[],line=new Map(plan.lines.map(l=>[l.id,l.key]));
 if(parts.text||parts.color){
  for(const l of project.lyrics){
   const patch={};
   if(parts.text&&line.has(l.id)){patch.code={version:1,source:motionOf(line.get(l.id)).source};patch.recipe=null;}
   if(parts.color){patch.color=plan.palette.color;patch.emphasisColor=plan.palette.emphasisColor;}
   if(Object.keys(patch).length)commands.push({type:'setLyricAppearance',id:l.id,patch:{motion:mergeMotion(l.motion,patch)}});
  }
 }
 if(parts.size){
  const sizes=new Map((plan.sizes||[]).map(x=>[x.id,x.fontScale]));
  for(const l of project.lyrics)if(sizes.has(l.id))for(const viewId of Object.keys(project.views))commands.push({type:'setLayout',id:l.id,viewId,patch:{fontScale:sizes.get(l.id)}});
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
 const scales=(plan.sizes||[]).map(x=>x.fontScale);return {mood:plan.moodName,motions:names(plan.lines.map(l=>l.key)),backgrounds:names(plan.blocks.map(b=>b.key)),palette:plan.palette.name,size:scales.length?{min:Math.min(...scales),max:Math.max(...scales)}:null};
}
