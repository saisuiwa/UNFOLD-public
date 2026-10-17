// おまかせ: choose a motion for every lyric, a background for each stretch of lines and a palette, from per-mood allow-lists
// (moods as lyric videos commonly use them; the motions are UNFOLD's own). Everything is derived from seeds, so a plan can be replayed (前の案) and one part re-rolled (ここだけ変える).
// Pure functions: no DOM, no controller.
import {cleanMotion} from '../lyric-motion.js?v=28';
import {DAILY_CODE_MOTIONS} from '../code-motion-daily.js';
import {pickWordScales,sizeRuns} from './word-size.js';
import {EXTENTS} from './omakase-extents.js';

export const MOODS=[
 {id:'calm',name:'しっとり',text:['drop-settle','squash-in','rgb-settle','gucha-melt','gucha-ripple','gucha-bubble','gucha-ghost','kn-flow','kn-dive','echo-stack','tate-columns','slant-flow','handdrawn-mark','marker-highlight','sticky-notes'],bg:['bg-concentric','bg-dot-wave','bg-bokeh','bg-ink-bleed','bg-plasma-lines'],families:['pastel','white','cool','warm'],size:{base:.075,spread:.015}},
 {id:'pop',name:'ポップ',text:['gucha-squash','gucha-rubber','gucha-bubble','gucha-burst','gucha-wobble','kn-slam','kn-seesaw','kn-collide','letter-boxes','keycap-type','size-beat','corner-words','stair-words','sticker-stick','bubble-pop','sticky-notes','patch-badge','handdrawn-mark'],bg:['bg-dot-wave','bg-diagonal','bg-checker-wave','bg-halftone-pop','bg-zigzag'],families:['pastel','neon','white','warm'],size:{base:.09,spread:.02}},
 {id:'glitch',name:'グリッチ',text:['rgb-settle','gucha-boil','gucha-shuffle','gucha-strips','kn-swap','kn-cuts','kn-typeslam','bracket-glitch','flip-up','cross-vertical','slant-flow','label-writer','stamp-ink','ticket-stub'],bg:['bg-scan-grid','bg-speed-lines','bg-grid-warp','bg-scribble','bg-rain-streaks'],families:['neon','mono','cool','rock'],size:{base:.085,spread:.018}},
 {id:'graphic',name:'グラフィック',text:['kn-turn','kn-reflow','gucha-steps','gucha-lanes','gucha-tiles','gucha-flip','layer-extrude','echo-stack','tape-cards','tate-columns','cross-vertical','corner-words','stair-words','label-writer','stamp-ink','ticket-stub','chalk-board','patch-badge','marker-highlight'],bg:['bg-square-tunnel','bg-diagonal','bg-scan-grid','bg-hex-pulse','bg-checker-wave','bg-sunburst'],families:['mono','white','rock','gold'],size:{base:.092,spread:.02}},
 {id:'emotional',name:'エモ',text:['gucha-gather','gucha-ghost','gucha-magnet','gucha-spiral','gucha-tangle','kn-dive','drop-settle','echo-stack','tate-columns','slant-flow','sticky-notes','handdrawn-mark','chalk-board'],bg:['bg-concentric','bg-square-tunnel','bg-bokeh','bg-ink-bleed','bg-starfield'],families:['pastel','cool','warm','gold'],size:{base:.08,spread:.016}},
 {id:'impact',name:'勢い',text:['kn-slam','gucha-pile','gucha-burst','kn-collide','kn-typeslam','kn-cuts','layer-extrude','gucha-squash','size-beat','slant-flow','cross-vertical','stamp-ink','sticker-stick','patch-badge','label-writer'],bg:['bg-speed-lines','bg-diagonal','bg-sunburst','bg-rain-streaks','bg-zigzag'],families:['rock','gold','neon','white'],size:{base:.105,spread:.025}},
];
export const MOOD_AUTO='auto';

// 配色の系統: the colour families the panel offers (picking a colour scheme, as lyric video tools commonly do; the colours are UNFOLD's own).
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
/** an おまかせ background does not stay longer than this (microseconds) */
export const MAX_BG_US=9e6;
// Sizes are a fraction of the shorter side of the picture. The slider 「文字の大きさの目安」 sets the average (percent); the mood and a little jitter vary it per line.
// Longer lines are capped (fitCap) so they still fit: the layout wraps lines, and every bundled text motion was checked to stay inside the frame at rest
// in wide and tall at exactly these caps, for lyrics of 7 to 35 characters.
export const SIZE_MIN=.05,SIZE_MAX=.24;
export const SIZE_PCT={min:6,max:24,default:12};
const MEAN_BASE=.0875;   // the mean of the moods' base sizes: a mood's base / MEAN_BASE scales the slider's value (calm a little smaller, 勢い a little bigger)
export const fitCap=n=>n>0?Math.min(SIZE_MAX,.9/Math.sqrt(n)):SIZE_MAX;
const charCount=text=>[...String(text||'').replace(/\s/g,'')].length;
/** The same size for every lyric (what the slider does before any おまかせ plan exists). */
export const uniformSizes=(project,pct)=>project.lyrics.map(l=>({id:l.id,fontScale:Math.round(Math.min(fitCap(charCount(l.text)),Math.max(SIZE_MIN,pct/100))*1000)/1000}));
const byKey=new Map(DAILY_CODE_MOTIONS.map(m=>[m.key,m]));
export const motionOf=key=>byKey.get(key);
export const moodOf=id=>MOODS.find(m=>m.id===id);

function hash(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function rng(seed){let a=hash(seed);return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
export const newSeeds=(random=Math.random)=>({mood:Math.floor(random()*1e9),text:Math.floor(random()*1e9),bg:Math.floor(random()*1e9),color:Math.floor(random()*1e9),size:Math.floor(random()*1e9),layout:Math.floor(random()*1e9)});


// ---- 配置と語ごとの大小 (where a line sits in the picture, and how big each word is) --------------------------------------------------------------
// The text motions draw their line around the middle of the picture; the lyric's layout (x, y, scale, rotation) moves that whole drawing, so a line can
// sit in a corner, at an edge, be tilted or turned sideways. The drawing is scaled down a little (and kept inside a margin) so it never leaves the picture.
// The word sizes are runs' `scale` (word-size.js): content words big, particles small, as lyric videos commonly do.
export const LAYOUT_SPREAD='spread',LAYOUT_CENTER='center';
const PLACES={center:[.5,.5],'top-left':[.3,.3],'top-right':[.7,.3],'bottom-left':[.3,.7],'bottom-right':[.7,.7],top:[.5,.24],bottom:[.5,.76],left:[.27,.5],right:[.73,.5]};
// per mood: how often each place is used, how far lines are tilted (degrees), how often a short line is turned sideways, how strong the word sizes are
const LAYOUT_STYLE={
 calm:{weights:{center:5,bottom:2,top:1.5,left:1,right:1,'top-left':1,'bottom-right':1},tilt:1.5,sideways:0,words:.6},
 pop:{weights:{center:2,'top-left':2,'top-right':2,'bottom-left':2,'bottom-right':2,top:1,bottom:1,left:1,right:1},tilt:7,sideways:.05,words:1},
 glitch:{weights:{center:2,'top-left':2,'bottom-right':2,left:1.5,right:1.5,top:1,bottom:1},tilt:3,sideways:.12,words:.9},
 graphic:{weights:{center:2,left:2,right:2,top:1.5,bottom:1.5,'top-left':1.5,'bottom-right':1.5},tilt:0,sideways:.14,words:1},
 emotional:{weights:{center:4,'bottom-left':1.5,'top-right':1.5,bottom:1.5,top:1},tilt:3,sideways:.04,words:.7},
 impact:{weights:{center:3,'top-left':1.5,'top-right':1.5,'bottom-left':1.5,'bottom-right':1.5,left:1,right:1},tilt:5,sideways:.06,words:1}
};
const FALLBACK_STYLE=LAYOUT_STYLE.pop,MARGIN=.045;
// motions that place and size the words themselves (a vertical column, stairs, corners ...): they stay where they are and get no word sizes from the plan
export const SELF_PLACED=new Set(['tate-columns','stair-words','corner-words','cross-vertical','size-beat','slant-flow']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function weighted(weights,rnd,exclude){
 const entries=Object.entries(weights).filter(([k])=>k!==exclude);
 let total=entries.reduce((s,[,w])=>s+w,0),r=rnd()*total;
 for(const [k,w] of entries){r-=w;if(r<=0)return k;}
 return entries.at(-1)[0];
}
/**
 * How wide and tall (in multiples of the font size) the line of this motion really is at rest: measured per motion, view and length
 * (omakase-extents.js, made by tools/omakase_extents.mjs) and read in between; a motion that was not measured gets the plain estimate, with room to spare.
 */
export function extentOf(key,view,chars){
 const table=EXTENTS[key]?.[view.width>=view.height?'wide':'tall'];
 if(table?.length){
  if(chars<=table[0][0])return {w:table[0][1],h:table[0][2]};
  for(let i=1;i<table.length;i++)if(chars<=table[i][0]){const [n0,w0,h0]=table[i-1],[n1,w1,h1]=table[i],u=(chars-n0)/(n1-n0);return {w:w0+(w1-w0)*u,h:h0+(h1-h0)*u};}
  const [,w,h]=table.at(-1);return {w,h};
 }
 return null;
}
/**
 * Where one line goes in one view: {x,y,scale,rotation}. `extent` is the measured size of the drawn line in multiples of the font size ({w,h}; null = a plain
 * estimate from the characters, 1.5 times for safety). If the place asked for cannot be reached with the line this big, the line is made a little smaller,
 * and if it still cannot, it stays in the middle (as before).
 */
export function placeLine({chars,fontScale,view,place,rotation=0,scale=1,extent=null}){
 const W=view.width,H=view.height,m=Math.min(W,H),fs=fontScale*m;
 let boxW,boxH;
 if(extent){boxW=extent.w*fs;boxH=extent.h*fs;}
 else{const perLine=Math.max(1,Math.floor(W*.82/fs)),lines=Math.max(1,Math.ceil(chars/perLine));boxW=Math.min(chars,perLine)*fs*1.5;boxH=lines*fs*1.4*1.5;}
 const half=(rot,s)=>{const a=Math.abs(rot)*Math.PI/180,c=Math.abs(Math.cos(a)),sn=Math.abs(Math.sin(a));return {hw:(c*boxW+sn*boxH)*s/2/W,hh:(sn*boxW+c*boxH)*s/2/H};};
 const fits=({hw,hh})=>hw<=.5-MARGIN&&hh<=.5-MARGIN;
 const round=(x,y,s,r)=>({x:Math.round(x*1000)/1000,y:Math.round(y*1000)/1000,scale:Math.round(s*1000)/1000,rotation:Math.round(r*10)/10});
 const [tx,ty]=PLACES[place]||PLACES.center;
 if(place!=='center'){
  for(let s=scale;s>=.5;s*=.92){
   const h=half(rotation,s);if(!fits(h))continue;
   const x=clamp(tx,MARGIN+h.hw,1-MARGIN-h.hw),y=clamp(ty,MARGIN+h.hh,1-MARGIN-h.hh);
   if(Math.abs(x-tx)<=.04&&Math.abs(y-ty)<=.04)return round(x,y,s,rotation);
  }
 }
 // the middle: as it was before; a tilt is kept only when the tilted line still fits
 for(const rot of [rotation,0]){
  for(let s=1;s>=.8;s*=.95){if(fits(half(rot,s)))return round(.5,.5,s,rot);}
 }
 return round(.5,.5,1,0);
}
function planLayout(project,lyrics,sizes,lines,{mood,layout,seeds}){
 const style=LAYOUT_STYLE[mood]||FALLBACK_STYLE,views=Object.values(project.views||{}),scaleOf=new Map(sizes.map(s=>[s.id,s.fontScale])),keyOf=new Map(lines.map(l=>[l.id,l.key]));
 const places=[],words=[];
 if(layout===LAYOUT_CENTER){
  for(const l of lyrics){places.push({id:l.id,views:Object.fromEntries(views.map(v=>[v.id,{x:.5,y:.5,scale:1,rotation:0}]))});words.push({id:l.id,ranges:[]});}
  return {places,words};
 }
 const rp=rng('layout:'+(seeds.layout??seeds.size??seeds.text)),rw=rng('words:'+(seeds.layout??seeds.size??seeds.text));
 let previous='';
 for(const l of lyrics){
  const n=charCount(l.text);
  if(SELF_PLACED.has(keyOf.get(l.id))){
   places.push({id:l.id,place:'self',views:Object.fromEntries(views.map(v=>[v.id,{x:.5,y:.5,scale:1,rotation:0}]))});words.push({id:l.id,ranges:[]});
   continue;
  }
  let place=weighted(style.weights,rp,previous);previous=place;
  let rotation=0;
  const tilt=style.tilt*(rp()*2-1);
  if(n<=9&&(place==='left'||place==='right')&&rp()<style.sideways)rotation=rp()<.5?90:-90;
  else if(Math.abs(tilt)>.8)rotation=tilt;
  else rp();
  const scale=place==='center'?1:.72+rp()*.14;
  const byView={};
  for(const v of views)byView[v.id]=placeLine({chars:n,fontScale:scaleOf.get(l.id)??.08,view:v,place,rotation,scale,extent:extentOf(keyOf.get(l.id),v,n)});
  places.push({id:l.id,place,views:byView});
  words.push({id:l.id,ranges:pickWordScales(l.text,rw,{strength:style.words})});
 }
 return {places,words};
}

// ---- 候補を広げる (motions that are not in a mood's list) ----------------------------------------------------------------------------------
// A mood's own list is what was checked by hand. Everything else a person can have is added to the pool of every mood, so that a motion made later
// (the daily routine's new text motions) or by the person (the motions saved in the library, 「保存した動き」) is used by おまかせ too:
//  - bundled text motions that no mood lists (not an effect, not a background, not the full-frame ring);
//  - the person's saved motions (code or recipe) from the library, except effects (shelf: 'effect').
// Their size on screen is not measured: placeLine() uses its careful estimate for them.
const NOT_FOR_TEXT=new Set(['ring-text']);
export function extraMotions({library=[],saved=true}={}){
 const listed=new Set(MOODS.flatMap(m=>[...m.text,...m.bg]));
 const out=DAILY_CODE_MOTIONS.filter(m=>m.shelf!=='effect'&&!m.key.startsWith('bg-')&&!listed.has(m.key)&&!NOT_FOR_TEXT.has(m.key)).map(m=>({key:m.key,name:m.name,from:'bundled'}));
 if(saved)for(const item of library){
  if(!item||item.workshop?.shelf==='effect')continue;
  const code=item.motion?.code,recipe=item.motion?.recipe;
  if(!(code?.source||recipe))continue;
  out.push({key:'saved:'+item.id,name:String(item.name||'保存した動き').slice(0,40),from:'saved',...(code?.source?{code:{version:1,source:code.source}}:{recipe})});
 }
 return out;
}

/** The plan for this project: which key for which lyric, which background for which stretch, which palette. */
export function planOmakase(project,{mood=MOOD_AUTO,family=FAMILY_AUTO,sizePct=SIZE_PCT.default,layout=LAYOUT_SPREAD,seeds,extras=[]}){
 const chosen=mood===MOOD_AUTO?MOODS[Math.floor(rng('mood:'+seeds.mood)()*MOODS.length)]:moodOf(mood)||MOODS[0];
 const lyrics=[...project.lyrics].sort((a,b)=>a.startUs-b.startUs);
 // a motion for every lyric, never the same as the line before or the one before that
 const rt=rng('text:'+seeds.text),recent=[],lines=[];
 const extraByKey=new Map(extras.map(e=>[e.key,e])),everyKey=[...chosen.text,...extras.map(e=>e.key).filter(k=>!chosen.text.includes(k))];
 for(const l of lyrics){let pool=everyKey.filter(k=>!recent.includes(k));if(!pool.length)pool=everyKey;const key=pool[Math.floor(rt()*pool.length)];recent.push(key);if(recent.length>2)recent.shift();const e=extraByKey.get(key);lines.push({id:l.id,key,...(e?.from==='saved'?{extra:{name:e.name,...(e.code?{code:e.code}:{recipe:e.recipe})}}:{})});}
 // a background for every stretch of 2-3 lines (and never longer than MAX_BG_US: a long stretch is cut into equal parts, each with its own background);
 // the stretches follow each other without a gap
 const rb=rng('bg:'+seeds.bg),blocks=[];let previous='';
 const pickBg=()=>{let pool=chosen.bg.filter(k=>k!==previous);if(!pool.length)pool=chosen.bg;const key=pool[Math.floor(rb()*pool.length)];previous=key;return key;};
 const pushBlocks=(startUs,endUs)=>{const n=Math.max(1,Math.ceil((endUs-startUs)/MAX_BG_US));for(let k=0;k<n;k++)blocks.push({startUs:k?Math.round(startUs+(endUs-startUs)*k/n):startUs,endUs:k===n-1?endUs:Math.round(startUs+(endUs-startUs)*(k+1)/n),key:pickBg()});};
 if(!lyrics.length)pushBlocks(0,project.durationUs);
 else{let i=0;while(i<lyrics.length){
  const from=i,start=blocks.length?lyrics[from].startUs:0,endOf=to=>to>=lyrics.length?project.durationUs:lyrics[to].startUs;
  let to=Math.min(lyrics.length,i+2+Math.floor(rb()*2));
  while(to-from>1&&endOf(to)-start>MAX_BG_US)to--;   // a stretch of several lines that would run long gets fewer lines
  i=to;pushBlocks(start,endOf(to));}}
 // a size for every lyric: the slider's average scaled by the mood, a little more or less per line, now and then a line that is made big; long lines are capped so they fit
 const rs=rng('size:'+(seeds.size??seeds.text)),sizes=lyrics.map(l=>{
  const n=charCount(l.text),target=Math.min(SIZE_PCT.max,Math.max(SIZE_PCT.min,Number(sizePct)||SIZE_PCT.default))/100;
  let v=target*(chosen.size.base/MEAN_BASE)*(1+(rs()*2-1)*chosen.size.spread/chosen.size.base);if(rs()<.2)v*=1.3;
  return {id:l.id,fontScale:Math.round(Math.min(fitCap(n),Math.max(SIZE_MIN,v))*1000)/1000};
 });
 // a colour family (the one asked for, else one of the mood's), then a palette of that family
 const rc=rng('color:'+seeds.color),asked=family!==FAMILY_AUTO?familyOf(family):null,fam=asked||familyOf(chosen.families[Math.floor(rc()*chosen.families.length)])||COLOR_FAMILIES[0],palette=fam.palettes[Math.floor(rc()*fam.palettes.length)];
 const {places,words}=planLayout(project,lyrics,sizes,lines,{mood:chosen.id,layout,seeds});
 return {moodId:chosen.id,moodName:chosen.name,seeds:{...seeds},lines,blocks,sizes,places,words,layout,palette:{name:palette.name,color:palette.color,emphasisColor:palette.emphasisColor,familyId:fam.id,familyName:fam.name}};
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
export function omakaseCommands(project,plan,{parts={text:true,bg:true,color:true,size:true,layout:false},newId=()=>crypto.randomUUID()}={}){
 const commands=[],line=new Map((plan.lines||[]).map(l=>[l.id,l]));
 if(parts.text||parts.color){
  for(const l of project.lyrics){
   const patch={};
   if(parts.text&&line.has(l.id)){
    const entry=line.get(l.id);
    if(entry.extra?.recipe){patch.recipe=entry.extra.recipe;patch.code=null;}
    else{patch.code=entry.extra?.code||{version:1,source:motionOf(entry.key).source};patch.recipe=null;}
   }
   if(parts.color){patch.color=plan.palette.color;patch.emphasisColor=plan.palette.emphasisColor;}
   if(Object.keys(patch).length)commands.push({type:'setLyricAppearance',id:l.id,patch:{motion:mergeMotion(l.motion,patch),...(parts.text&&l.cut?{cut:null}:{})}});   // 動きを選び直したら、カット演出はやめる
  }
 }
 if(parts.size){
  const sizes=new Map((plan.sizes||[]).map(x=>[x.id,x.fontScale]));
  for(const l of project.lyrics)if(sizes.has(l.id))for(const viewId of Object.keys(project.views))commands.push({type:'setLayout',id:l.id,viewId,patch:{fontScale:sizes.get(l.id)}});
 }
 if(parts.layout){
  const lyricById=new Map(project.lyrics.map(l=>[l.id,l]));
  for(const pl of plan.places||[]){
   for(const [viewId,patch] of Object.entries(pl.views||{}))if(project.views[viewId]?.layout[pl.id])commands.push({type:'setLayout',id:pl.id,viewId,patch});
  }
  for(const w of plan.words||[]){
   const l=lyricById.get(w.id);if(!l)continue;
   const had=(l.runs||[]).some(r=>r.scale!=null&&r.scale!==1);
   if(!w.ranges.length&&!had)continue;
   commands.push({type:'setLyricText',id:l.id,text:l.text,runs:sizeRuns(l,w.ranges)});
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

/** The same opacity (0..1) for every lyric, one batch; null when nothing changes. */
export function opacityCommands(project,opacity){
 const value=Math.min(1,Math.max(.05,Number(opacity)));
 const commands=project.lyrics.filter(l=>Math.abs((l.opacity??1)-value)>1e-6).map(l=>({type:'setLyricAppearance',id:l.id,patch:{opacity:value}}));
 return commands.length?{type:'batch',commands}:null;
}

/** What the plan says, for the "いまの案" box. */
export function describePlan(plan){
 const names=keys=>[...new Set(keys)].map(k=>motionOf(k)?.name||(plan.lines||[]).find(l=>l.key===k)?.extra?.name||k);
 const scales=(plan.sizes||[]).map(x=>x.fontScale);return {mood:plan.moodName,motions:names(plan.lines.map(l=>l.key)),backgrounds:names(plan.blocks.map(b=>b.key)),palette:plan.palette.name,layout:plan.layout===LAYOUT_CENTER?'真ん中に揃える':'位置と語の大小をばらけさせる',size:scales.length?{min:Math.min(...scales),max:Math.max(...scales)}:null};
}
