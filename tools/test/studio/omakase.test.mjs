import test from 'node:test';
import assert from 'node:assert/strict';
import {MOODS,planOmakase,omakaseCommands,motionOf,newSeeds,describePlan,BG_OPACITY,mergeMotion} from '../../../app/studio/omakase.js';
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
 for(const x of plan.sizes)assert.ok(x.fontScale>=.04&&x.fontScale<=.12,String(x.fontScale));
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
