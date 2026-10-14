import test from 'node:test';
import assert from 'node:assert/strict';
import {MOODS,COLOR_FAMILIES,FAMILY_AUTO,SIZE_MIN,SIZE_MAX,SIZE_PCT,fitCap,uniformSizes,opacityCommands,familyOf,planOmakase,omakaseCommands,motionOf,newSeeds,describePlan,BG_OPACITY,mergeMotion} from '../../../app/studio/omakase.js';
import {createProject,assertProject} from '../../../app/studio/model.js';
import {applyCommand} from '../../../app/studio/commands.js';

const project=(lines=12,{scenes=1}={})=>{
 const p=createProject({durationUs:lines*5e6});
 const sceneLen=Math.floor(p.durationUs/scenes);
 p.scenes=Array.from({length:scenes},(_,i)=>({id:'s'+i,startUs:i*sceneLen,endUs:i===scenes-1?p.durationUs:(i+1)*sceneLen,originUs:i*sceneLen}));
 p.lyrics=Array.from({length:lines},(_,i)=>({id:'L'+i,text:'歌詞'+i,runs:[{id:'r'+i,text:'歌詞'+i}],startUs:i*5e6,endUs:i*5e6+4e6,motion:{font:'gothic',color:'#ffffff'},timingSource:'manual',opacity:1}));
 for(const v of Object.values(p.views))for(const l of p.lyrics)v.layout[l.id]={x:.5,y:.5,scale:1,rotation:0,anchor:'canvas',fit:'contain',focus:{x:.5,y:.5},backdrop:'solid',textWidth:.84,fontScale:.06,breaks:[]};
 return p;
};
const SEEDS={mood:1,text:2,bg:3,color:4,size:5};
let serial=0;const ids=()=>'id'+(++serial);

test('every key in every mood is a bundled motion; a mood has enough variety to avoid repeats', () => {
 for(const m of MOODS){
  assert.ok(m.text.length>=6,m.id+' has few motions');
  assert.ok(m.bg.length>=4,m.id+' has few backgrounds (a long song would repeat them): '+m.bg.length);
  for(const k of [...m.text,...m.bg])assert.ok(motionOf(k),m.id+': '+k);
  for(const k of m.bg)assert.match(k,/^bg-/);
  for(const k of m.text)assert.ok(!k.startsWith('bg-')&&k!=='ring-text',m.id+': '+k+' draws no words or fills the frame');
 }
});

test('the plan is deterministic, follows its mood, and never repeats a motion within two lines', () => {
 const p=project(),a=planOmakase(p,{mood:'pop',seeds:SEEDS}),b=planOmakase(p,{mood:'pop',seeds:SEEDS});
 assert.deepEqual(a,b);
 const pop=MOODS.find(m=>m.id==='pop');
 for(const l of a.lines)assert.ok(pop.text.includes(l.key));
 for(let i=1;i<a.lines.length;i++){assert.notEqual(a.lines[i].key,a.lines[i-1].key);if(i>1)assert.notEqual(a.lines[i].key,a.lines[i-2].key);}
 assert.ok(a.blocks.every(x=>pop.bg.includes(x.key)));
 const c=planOmakase(p,{mood:'pop',seeds:{...SEEDS,text:99}});
 assert.notDeepEqual(c.lines,a.lines,'another text seed gives another plan');
 assert.deepEqual(c.blocks,a.blocks,'and leaves the backgrounds alone');
 assert.deepEqual(c.palette,a.palette,'and the palette');
});

test('backgrounds follow each other without a gap, cover the whole song, and change at each stretch', () => {
 const p=project(14),plan=planOmakase(p,{mood:'graphic',seeds:SEEDS});
 assert.equal(plan.blocks[0].startUs,0);assert.equal(plan.blocks.at(-1).endUs,p.durationUs);
 for(let i=1;i<plan.blocks.length;i++){assert.equal(plan.blocks[i].startUs,plan.blocks[i-1].endUs);assert.notEqual(plan.blocks[i].key,plan.blocks[i-1].key);}
 const empty=createProject({durationUs:20e6}),only=planOmakase(empty,{mood:'calm',seeds:SEEDS});
 assert.equal(only.lines.length,0);assert.deepEqual([only.blocks[0].startUs,only.blocks[0].endUs],[0,20e6]);
});

test('"おまかせ" mood picks one of the moods from its seed', () => {
 const seen=new Set();for(let i=0;i<40;i++)seen.add(planOmakase(project(4),{mood:'auto',seeds:{...newSeeds(()=>(i*7919%1000)/1000),mood:i}}).moodId);
 assert.ok(seen.size>=4,'several moods appear: '+[...seen].join());
});

test('applying a plan changes motions, colours and backgrounds only; text, timing and the other clips stay; applying again replaces the backgrounds', () => {
 let p=project(10);
 p.clips=[{id:'u',name:'UNFOLD',kind:'unfold',sceneId:'s0',startUs:0,endUs:p.durationUs,sourceInUs:0,effectOriginUs:0,opacity:1,z:0,seed:7,unfoldId:'x'}];
 p.unfolds={x:{id:'x',version:1,state:{settings:{},slides:[],transitions:[],methods:[]},dependencies:[]}};
 for(const v of Object.values(p.views))v.layout.u={x:.5,y:.5,scale:1,rotation:0,anchor:'canvas',fit:'contain',focus:{x:.5,y:.5},backdrop:'solid',textWidth:.84,fontScale:.06,breaks:[]};
 const before=structuredClone(p),plan=planOmakase(p,{mood:'impact',seeds:SEEDS});
 const command=omakaseCommands(p,plan,{newId:ids});
 p=applyCommand(p,command).project;assertProject(p);
 // lyrics: motion code set, text and timing untouched
 for(const [i,l] of p.lyrics.entries()){
  assert.equal(l.text,before.lyrics[i].text);assert.equal(l.startUs,before.lyrics[i].startUs);assert.equal(l.endUs,before.lyrics[i].endUs);assert.deepEqual(l.runs,before.lyrics[i].runs);
  assert.equal(l.motion.code.source,motionOf(plan.lines[i].key).source);assert.equal(l.motion.color,plan.palette.color);
 }
 const unfold=p.clips.find(c=>c.id==='u');assert.deepEqual(unfold,before.clips[0],'the UNFOLD clip is not touched');
 const bgs=p.clips.filter(c=>c.settings?.omakase);
 assert.equal(bgs.length,plan.blocks.length);
 assert.ok(bgs.every(c=>c.kind==='text'&&c.opacity===BG_OPACITY&&c.z>unfold.z&&!c.text.trim()),'backgrounds sit above the pictures and draw no text');
 // a second plan replaces the first backgrounds instead of adding to them
 const plan2=planOmakase(p,{mood:'calm',seeds:{...SEEDS,bg:777}});
 p=applyCommand(p,omakaseCommands(p,plan2,{newId:ids})).project;assertProject(p);
 assert.equal(p.clips.filter(c=>c.settings?.omakase).length,plan2.blocks.length);
 assert.equal(p.clips.filter(c=>!c.settings?.omakase).length,1);
});

test('re-rolling only the background leaves the lyric motions as they are', () => {
 let p=project(8);
 const plan=planOmakase(p,{mood:'glitch',seeds:SEEDS});
 p=applyCommand(p,omakaseCommands(p,plan,{newId:ids})).project;
 const motions=p.lyrics.map(l=>l.motion.code.source);
 const plan2=planOmakase(p,{mood:'glitch',seeds:{...SEEDS,bg:555}});
 const command=omakaseCommands(p,plan2,{parts:{text:false,bg:true,color:false},newId:ids});
 assert.ok(command.commands.every(c=>c.type!=='setLyricAppearance'));
 p=applyCommand(p,command).project;assertProject(p);
 assert.deepEqual(p.lyrics.map(l=>l.motion.code.source),motions);
});

test('several scenes: a stretch is cut at the scene borders and times are scene-relative', () => {
 let p=project(8,{scenes:2});
 const plan=planOmakase(p,{mood:'emotional',seeds:SEEDS}),command=omakaseCommands(p,plan,{newId:ids});
 p=applyCommand(p,command).project;assertProject(p);
 const second=p.scenes[1];
 for(const c of p.clips.filter(x=>x.settings?.omakase)){
  const scene=p.scenes.find(s=>s.id===c.sceneId);
  assert.ok(c.startUs>=0&&scene.originUs+c.endUs<=scene.endUs,'inside its scene');
 }
 assert.ok(p.clips.some(c=>c.sceneId===second.id&&c.settings?.omakase));
});

test('no scene yet: one is made to hold the backgrounds', () => {
 const p=createProject({durationUs:20e6});p.lyrics=[];
 const command=omakaseCommands(p,planOmakase(p,{mood:'calm',seeds:SEEDS}),{newId:ids});
 assert.equal(command.commands[0].type,'insertScene');
 const next=applyCommand(p,command).project;assertProject(next);
 assert.ok(next.clips.length>=1);
});

test('describePlan names the mood, motions, backgrounds and palette in Japanese', () => {
 const d=describePlan(planOmakase(project(),{mood:'pop',seeds:SEEDS}));
 assert.equal(d.mood,'ポップ');assert.ok(d.motions.length>=3&&d.motions.every(n=>/[ぁ-んァ-ヶ一-龠]/.test(n)));assert.ok(d.backgrounds.every(n=>/背景/.test(n)));assert.ok(d.palette.length>0);
});

test('a recipe patch (code: null) really takes the old code away; a code patch takes the recipe away; STUDIO-only fields stay', () => {
 const withCode={font:'file:abc',fontAssetId:'asset1',color:'#ffffff',code:{version:1,source:motionOf('kn-slam').source}};
 const recipe={version:1,layout:'editorial',enter:'rise',sustain:['sway'],exit:'fade',strength:.6,stagger:.08};
 const a=mergeMotion(withCode,{code:null,recipe});
 assert.equal('code' in a,false,'the old code must not survive and win');assert.equal(a.recipe.layout,'editorial');assert.equal(a.fontAssetId,'asset1');assert.equal(a.font,'file:abc');
 const b=mergeMotion(a,{code:{version:1,source:motionOf('kn-flow').source},recipe:null});
 assert.equal('recipe' in b,false);assert.equal(b.code.source,motionOf('kn-flow').source);assert.equal(b.fontAssetId,'asset1');
});

test('sizes: every lyric gets a size inside the range, they differ, long lines are smaller, and both views are set', () => {
 const p=project(10);p.lyrics[3].text='とても長い歌詞の一行がここにあってそれが画面に収まるように小さくなる';
 const plan=planOmakase(p,{mood:'impact',seeds:SEEDS});
 assert.equal(plan.sizes.length,10);
 for(const x of plan.sizes)assert.ok(x.fontScale>=SIZE_MIN&&x.fontScale<=SIZE_MAX,String(x.fontScale));
 assert.ok(new Set(plan.sizes.map(x=>x.fontScale)).size>=5,'the sizes are not all the same');
 const long=plan.sizes[3].fontScale,others=plan.sizes.filter((_,i)=>i!==3).map(x=>x.fontScale);
 assert.ok(long<Math.max(...others),'a long line is not the biggest: '+long);
 const command=omakaseCommands(p,plan,{parts:{text:false,bg:false,color:false,size:true},newId:ids});
 assert.equal(command.commands.length,10*2);assert.ok(command.commands.every(c=>c.type==='setLayout'&&['wide','tall'].includes(c.viewId)));
 const next=applyCommand(p,command).project;assertProject(next);
 assert.equal(next.views.wide.layout.L3.fontScale,plan.sizes[3].fontScale);assert.equal(next.views.tall.layout.L3.fontScale,plan.sizes[3].fontScale);
 // the same seed gives the same sizes; another size seed gives other sizes and leaves the rest of the plan alone
 const again=planOmakase(p,{mood:'impact',seeds:SEEDS}),other=planOmakase(p,{mood:'impact',seeds:{...SEEDS,size:99}});
 assert.deepEqual(again.sizes,plan.sizes);assert.notDeepEqual(other.sizes,plan.sizes);assert.deepEqual(other.lines,plan.lines);assert.deepEqual(other.blocks,plan.blocks);
});

// hue of #rrggbb in degrees and its saturation (0..1); a colour is "green" when it is clearly coloured and between yellow-green and green-cyan
const hueSat=hex=>{const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;if(!d)return {h:0,s:0};
 const h=max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4;return {h:h*60,s:d/(max===0?1:max)};};
const isGreen=hex=>{const {h,s}=hueSat(hex);return s>.25&&h>=65&&h<=170;};

test('colour families: each mood allows several, none of the palettes is green, and the palette belongs to the family', () => {
 assert.ok(COLOR_FAMILIES.length>=6);
 for(const f of COLOR_FAMILIES){
  assert.ok(f.palettes.length>=3,f.id);
  for(const pal of f.palettes){assert.ok(!isGreen(pal.color),f.id+' '+pal.name+' text');assert.ok(!isGreen(pal.emphasisColor),f.id+' '+pal.name+' emphasis');}
 }
 for(const m of MOODS){assert.ok(m.families.length>=3,m.id);for(const id of m.families)assert.ok(familyOf(id),m.id+': '+id);}
 const p=project();
 for(const m of MOODS)for(let i=0;i<30;i++){
  const plan=planOmakase(p,{mood:m.id,seeds:{...SEEDS,color:i*7919}});
  assert.ok(m.families.includes(plan.palette.familyId),m.id+' '+plan.palette.familyId);
  assert.ok(!isGreen(plan.palette.color)&&!isGreen(plan.palette.emphasisColor),plan.palette.name);
 }
});

test('a chosen colour family decides the palette, and only the palette', () => {
 const p=project(),auto=planOmakase(p,{mood:'calm',seeds:SEEDS});
 for(const f of COLOR_FAMILIES){
  const seen=new Set();
  for(let i=0;i<40;i++){
   const plan=planOmakase(p,{mood:'calm',family:f.id,seeds:{...SEEDS,color:i*104729}});
   assert.equal(plan.palette.familyId,f.id);assert.ok(f.palettes.some(x=>x.name===plan.palette.name&&x.color===plan.palette.color));
   assert.deepEqual(plan.lines,auto.lines,'motions are the mood\'s, not the family\'s');assert.deepEqual(plan.blocks,auto.blocks);assert.deepEqual(plan.sizes,auto.sizes);
   seen.add(plan.palette.name);
  }
  assert.equal(seen.size,f.palettes.length,f.id+': every palette of the family can come up');
 }
 assert.equal(FAMILY_AUTO,'auto');
 assert.deepEqual(planOmakase(p,{mood:'calm',family:'no-such-family',seeds:SEEDS}).palette,auto.palette,'an unknown family falls back to the mood');
});

test('the size slider sets the average: bigger by default than before, proportional to the slider, never beyond what fits', () => {
 assert.deepEqual(SIZE_PCT,{min:6,max:24,default:12});assert.equal(SIZE_MAX,.24);assert.ok(SIZE_MIN>=.05);
 const p=project(24);
 const mean=(mood,pct)=>{const v=[];for(let i=0;i<20;i++)for(const x of planOmakase(p,{mood,sizePct:pct,seeds:{...SEEDS,size:i*104729+1}}).sizes)v.push(x.fontScale);return {mean:v.reduce((a,b)=>a+b,0)/v.length,min:Math.min(...v),max:Math.max(...v)};};
 for(const m of MOODS){
  const d=mean(m.id,undefined),lo=mean(m.id,8),hi=mean(m.id,20);
  assert.ok(d.mean>=.1,m.id+' default mean '+d.mean);                      // the old moods averaged 5.5-10.5 %
  assert.ok(hi.mean>lo.mean*2,m.id+': the slider moves the sizes '+lo.mean+' -> '+hi.mean);
  for(const r of [d,lo,hi]){assert.ok(r.min>=SIZE_MIN&&r.max<=SIZE_MAX,m.id+' range '+r.min+'..'+r.max);}
 }
 // long lines are capped so they fit, whatever the slider says
 const long=project(3);long.lyrics[1].text='あ'.repeat(35);long.lyrics[2].text='あ'.repeat(10);
 const sizes=planOmakase(long,{mood:'impact',sizePct:24,seeds:SEEDS}).sizes;
 assert.ok(sizes[1].fontScale<=fitCap(35)+1e-9,'35 characters: '+sizes[1].fontScale);assert.ok(sizes[2].fontScale<=fitCap(10)+1e-9);
 assert.ok(fitCap(35)<.16&&fitCap(7)===SIZE_MAX&&fitCap(16)>.2,'the cap: '+[fitCap(7),fitCap(16),fitCap(35)].join());
});

test('uniformSizes (the slider before any plan) and opacityCommands', () => {
 const p=project(3);p.lyrics[1].text='あ'.repeat(35);
 const u=uniformSizes(p,20);
 assert.equal(u.length,3);assert.equal(u[0].fontScale,.2);assert.ok(u[1].fontScale<.16,'the long line is capped: '+u[1].fontScale);
 const command=omakaseCommands(p,{sizes:u,lines:[],blocks:[],palette:{}},{parts:{text:false,bg:false,color:false,size:true},newId:ids});
 assert.equal(command.commands.length,3*2);assert.ok(command.commands.every(c=>c.type==='setLayout'));
 // opacity: only the lyrics that change get a command; one batch; clamped
 assert.equal(opacityCommands(p,1),null,'already 100 %');
 const half=opacityCommands(p,.5);assert.equal(half.commands.length,3);assert.ok(half.commands.every(c=>c.type==='setLyricAppearance'&&c.patch.opacity===.5));
 const next=applyCommand(p,half).project;assertProject(next);assert.ok(next.lyrics.every(l=>l.opacity===.5));
 assert.equal(opacityCommands(next,.5),null);
 assert.equal(opacityCommands(p,0).commands[0].patch.opacity,.05,'never fully invisible');
});

// ---- 配置と語ごとの大小 ------------------------------------------------------------------------------------------------------------------------
import {placeLine,LAYOUT_CENTER,LAYOUT_SPREAD} from '../../../app/studio/omakase.js';
import {pickWordScales,sizeRuns,wordPieces,wordKind} from '../../../app/studio/word-size.js';
const jp=(texts)=>{const p=project(texts.length);texts.forEach((t,i)=>{p.lyrics[i].text=t;p.lyrics[i].runs=[{id:'r'+i,text:t}];});return p;};
const LINES=['私は元気です','かたちをほどいて自由に。','君と見た夏の終わりの空は今でも覚えているよ','走り出せ、夜明けまで','ありがとう','もっと強く、もっと高く','今日も明日もずっと','夜に溶けていく'];

test('word pieces: content words are big and particles small (私 は 元気 です)', () => {
 const kinds=wordPieces('私は元気です').map(p=>p.text+':'+wordKind(p));
 assert.deepEqual(kinds,['私:big','は:small','元気:big','です:small']);
 // ほどいて is one word: its て is not made small on its own
 const k2=wordPieces('かたちをほどいて自由に。').map(p=>wordKind(p));
 assert.ok(k2.includes('attach'));
});
test('word scales: big words > 1 > small words, the mean size stays 1, short lines are left alone, the same seed gives the same sizes', () => {
 const rnd=()=>{let a=9;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};};
 const text='私は元気です',s=pickWordScales(text,rnd());
 assert.ok(s.length>=3);
 const big=s.find(r=>text.slice(r.from,r.to)==='元気').scale,small=s.find(r=>text.slice(r.from,r.to)==='は').scale;
 assert.ok(big>1.2&&small<.85,'big '+big+' small '+small);
 assert.ok(big/small>1.8,'the contrast is visible: '+big/small);
 let total=0,n=0;for(const r of s){const len=r.to-r.from;total+=r.scale*len;n+=len;}
 const unsized=text.length-n;assert.ok(Math.abs((total+unsized)/text.length-1)<.06,'mean '+(total+unsized)/text.length);
 assert.deepEqual(pickWordScales(text,rnd()),s);
 assert.deepEqual(pickWordScales('あい',rnd()),[]);
 for(const l of LINES)for(const r of pickWordScales(l,rnd()))assert.ok(r.scale>=.5&&r.scale<=1.75,l+' '+r.scale);
});
test('sizeRuns keeps colours, outlines and grapheme ids, merges equal neighbours and can clear the sizes', () => {
 const lyric={id:'L',text:'私は元気です',runs:[{id:'a',text:'私は',glyphIds:['a:0','a:1']},{id:'b',text:'元気',emphasis:true,color:'#ff0000',outline:true,outlineColor:'#000000',outlineWidth:8,glyphIds:['b:0','b:1']},{id:'c',text:'です',glyphIds:['c:0','c:1']}]};
 const out=sizeRuns(lyric,[{from:0,to:1,scale:1.5},{from:1,to:2,scale:.7},{from:2,to:4,scale:1.5},{from:4,to:6,scale:.7}]);
 assert.equal(out.map(r=>r.text).join(''),'私は元気です');
 assert.deepEqual(out.map(r=>r.scale),[1.5,.7,1.5,.7]);
 const gen=out.find(r=>r.text==='元気');assert.equal(gen.emphasis,true);assert.equal(gen.color,'#ff0000');assert.equal(gen.outline,true);assert.equal(gen.outlineColor,'#000000');
 assert.deepEqual(out.flatMap(r=>r.glyphIds),['a:0','a:1','b:0','b:1','c:0','c:1']);
 const cleared=sizeRuns({...lyric,runs:out},[]);assert.ok(cleared.every(r=>r.scale===undefined));
});
test('placeLine keeps a line inside the margin in wide and tall, for every place, rotation and length', () => {
 const views=[{width:1920,height:1080},{width:1080,height:1920}];
 for(const view of views)for(const place of ['center','top-left','top-right','bottom-left','bottom-right','top','bottom','left','right'])
  for(const chars of [3,8,14,24,35])for(const rotation of [0,5,-6,90,-90]){
   const fontScale=Math.min(.12,fitCap(chars)),r=placeLine({chars,fontScale,view,place,rotation,scale:.8});
   assert.ok(r.x>=.04&&r.x<=.96&&r.y>=.04&&r.y<=.96,JSON.stringify({view:view.width,place,chars,rotation,r}));
   assert.ok(r.scale>0&&r.scale<=1+1e-9);
   if(place!=='center'&&(Math.abs(r.x-.5)>.05||Math.abs(r.y-.5)>.05))assert.ok(r.scale<=.8+1e-9);
  }
});
test('spread plan: lines sit at different places, tilt a little, differ between plans, and cover wide and tall', () => {
 const p=jp(LINES.concat(LINES));
 const plan=planOmakase(p,{mood:'pop',seeds:{...SEEDS,layout:11}});
 assert.equal(plan.places.length,p.lyrics.length);
 const spots=new Set(plan.places.map(x=>x.place).filter(x=>x!=='self'));
 assert.ok(spots.size>=4,'places: '+[...spots]);
 for(const pl of plan.places){assert.ok(pl.views.wide&&pl.views.tall);for(const v of Object.values(pl.views)){assert.ok(Math.abs(v.rotation)<=90);assert.ok(v.x>=.04&&v.x<=.96&&v.y>=.04&&v.y<=.96);}}
 const other=planOmakase(p,{mood:'pop',seeds:{...SEEDS,layout:12}});
 assert.notDeepEqual(other.places,plan.places);
 assert.deepEqual(planOmakase(p,{mood:'pop',seeds:{...SEEDS,layout:11}}).places,plan.places,'replayable');
 // neighbours do not repeat the same place
 for(let i=1;i<plan.places.length;i++)if(plan.places[i].place!=='self'&&plan.places[i-1].place!=='self')assert.notEqual(plan.places[i].place,plan.places[i-1].place);
});
test('the calm mood stays mostly in the middle, and 真ん中に揃える puts every line at the centre with no word sizes', () => {
 const p=jp(Array.from({length:40},(_,i)=>LINES[i%LINES.length]));
 const calm=planOmakase(p,{mood:'calm',seeds:{...SEEDS,layout:3}});
 const centred=calm.places.filter(x=>x.place==='center'||x.place==='self').length;
 assert.ok(centred>=calm.places.length*.3,'calm centred '+centred);
 const flat=planOmakase(p,{mood:'pop',layout:LAYOUT_CENTER,seeds:SEEDS});
 for(const pl of flat.places)for(const v of Object.values(pl.views))assert.deepEqual(v,{x:.5,y:.5,scale:1,rotation:0});
 assert.ok(flat.words.every(w=>w.ranges.length===0));
});
test('omakaseCommands(layout): sets x/y/scale/rotation in both views and word sizes in the runs; the project stays valid; undoing the sizes is possible', () => {
 const p=jp(LINES);
 const plan=planOmakase(p,{mood:'pop',seeds:{...SEEDS,layout:5}});
 const cmd=omakaseCommands(p,plan,{parts:{text:false,bg:false,color:false,size:false,layout:true}});
 assert.equal(cmd.type,'batch');
 const q=applyCommand(p,cmd).project;
 assertProject(q);
 const moved=p.lyrics.filter(l=>{const a=p.views.wide.layout[l.id],b=q.views.wide.layout[l.id];return a.x!==b.x||a.y!==b.y||a.rotation!==b.rotation||a.scale!==b.scale;});
 assert.ok(moved.length>=4,'moved '+moved.length);
 const sized=q.lyrics.filter(l=>l.runs.some(r=>r.scale));
 assert.ok(sized.length>=4,'word sizes '+sized.length);
 for(const l of q.lyrics){assert.equal(l.runs.map(r=>r.text).join(''),l.text);assert.equal(l.startUs,p.lyrics.find(x=>x.id===l.id).startUs);}
 // choosing 真ん中に揃える afterwards brings everything back
 const back=omakaseCommands(q,planOmakase(q,{mood:'pop',layout:LAYOUT_CENTER,seeds:SEEDS}),{parts:{text:false,bg:false,color:false,size:false,layout:true}});
 const r=applyCommand(q,back).project;
 assert.ok(r.lyrics.every(l=>l.runs.every(x=>x.scale===undefined)));
 for(const l of r.lyrics){const a=r.views.wide.layout[l.id];assert.deepEqual([a.x,a.y,a.scale,a.rotation],[.5,.5,1,0]);}
});

import {EXTENTS} from '../../../app/studio/omakase-extents.js';
import {extentOf} from '../../../app/studio/omakase.js';
test('every text motion of every mood has a measured extent (run node tools/omakase_extents.mjs after adding a motion)', () => {
 for(const m of MOODS)for(const k of m.text){const e=EXTENTS[k];assert.ok(e&&e.wide?.length===5&&e.tall?.length===5&&[...e.wide,...e.tall].every(([n,w,h])=>n>0&&w>=.5&&h>=.5),m.id+': '+k+' has no extent');}
});
test('a motion that is drawn much bigger than its text is kept in the middle instead of being pushed out of the picture', () => {
 const view={width:1920,height:1080},big={w:30,h:14};
 const r=placeLine({chars:16,fontScale:.1,view,place:'top-left',rotation:5,scale:.8,extent:big});
 assert.deepEqual([r.x,r.y],[.5,.5]);
 const small=placeLine({chars:6,fontScale:.08,view,place:'top-left',rotation:0,scale:.8,extent:{w:6,h:1.4}});
 assert.ok(small.x<.4&&small.y<.4,JSON.stringify(small));
 // a short line of a block motion reads its measured size, longer lines read further down the table
 const v={width:1920,height:1080},a=extentOf('sticky-notes',v,5),b=extentOf('sticky-notes',v,35);assert.ok(a&&b&&b.w>a.w*.5);
 assert.equal(extentOf('no-such-motion',v,10),null);
 assert.ok(extentOf('gucha-melt',{width:1080,height:1920},12).h>0);
});

// ---- 候補を広げる: motions that are not in a mood's list ----------------------------------------------------------------------------------------
import {extraMotions} from '../../../app/studio/omakase.js';
import {DAILY_CODE_MOTIONS} from '../../../app/code-motion-daily.js';
const LIB=[
 {id:'m1',name:'私のぷるぷる',motion:{code:{version:1,source:'// my own\nconst {createText,text}=api;const t=createText(text);return {update(){t.fillOpacity=1}};'}}},
 {id:'m2',name:'私のレシピ',motion:{recipe:{layout:'center',units:'char',enter:'rise',exit:'fade',ease:'smooth',stagger:.05,distance:.5,dur:.6}}},
 {id:'m3',name:'私の背景',workshop:{shelf:'effect'},motion:{code:{version:1,source:'// my effect\nreturn {update(){}};'}}},
];
test('extraMotions: bundled text motions no mood lists, and the saved ones except effects', () => {
 const listed=new Set(MOODS.flatMap(m=>[...m.text,...m.bg])),e=extraMotions({library:LIB});
 const bundled=e.filter(x=>x.from==='bundled'),saved=e.filter(x=>x.from==='saved');
 assert.ok(bundled.length>=1,'a bundled text motion that no mood lists is offered');
 for(const b of bundled){assert.ok(!listed.has(b.key));const d=DAILY_CODE_MOTIONS.find(x=>x.key===b.key);assert.ok(d&&d.shelf!=='effect'&&!d.key.startsWith('bg-'));assert.notEqual(b.key,'ring-text');}
 assert.deepEqual(saved.map(x=>x.key),['saved:m1','saved:m2'],'the effect is left out');
 assert.ok(saved[0].code.source.includes('my own')&&saved[1].recipe);
 assert.equal(extraMotions({library:LIB,saved:false}).some(x=>x.from==='saved'),false);
});
test('a plan uses the extra motions too, keeps them when replayed, and its commands carry the saved code / recipe', () => {
 const p=project(30),extras=extraMotions({library:LIB});
 const plan=planOmakase(p,{mood:'pop',seeds:{...SEEDS,layout:3},extras}),again=planOmakase(p,{mood:'pop',seeds:{...SEEDS,layout:3},extras});
 assert.deepEqual(plan.lines,again.lines);
 const used=plan.lines.filter(l=>l.extra);
 assert.ok(used.length>=2,'saved motions are used: '+used.length);
 assert.ok(plan.lines.some(l=>!l.extra),'the mood\'s own motions are still used');
 const q=applyCommand(p,omakaseCommands(p,plan,{parts:{text:true,bg:false,color:false,size:false,layout:false}})).project;
 assertProject(q);
 const code=plan.lines.find(l=>l.extra?.code),recipe=plan.lines.find(l=>l.extra?.recipe);
 if(code)assert.equal(q.lyrics.find(l=>l.id===code.id).motion.code.source,code.extra.code.source);
 if(recipe){const m=q.lyrics.find(l=>l.id===recipe.id).motion;assert.ok(m.recipe&&!m.code);}
 // the names of the saved motions show in the description
 assert.ok(describePlan(plan).motions.some(n=>n==='私のぷるぷる'||n==='私のレシピ'));
 // without extras nothing changes from before
 const plain=planOmakase(p,{mood:'pop',seeds:{...SEEDS,layout:3}});
 assert.ok(plain.lines.every(l=>!l.extra&&MOODS.find(m=>m.id==='pop').text.includes(l.key)));
});
