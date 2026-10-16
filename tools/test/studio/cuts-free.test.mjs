// 自由文字（「文字を追加」で置いた文字のクリップ）にも、カット演出を付けられる。データは clip.settings.cut。
import test from 'node:test';
import assert from 'node:assert/strict';
import {planCutsRaw,finishCutPlan,cutActive,cutOf,absoluteCuts,spanOf,linesOf,isFreeText,motionSig} from '../../../app/studio/cuts/plan.js';
import {cutCommands,removeCutCommands} from '../../../app/studio/cuts/apply.js';
import {buildAnyItem} from '../../../app/studio/cuts/items.js';
import {applyCommand} from '../../../app/studio/commands.js';
import {createProject,validateProject,newLayout} from '../../../app/studio/model.js';

const clipOf=(over={})=>({id:'T1',sceneId:'S',kind:'text',name:'自由文字',text:'光をつなぐ',runs:[{id:'t',text:'光をつなぐ'}],startUs:.5e6,endUs:3.5e6,sourceInUs:0,effectOriginUs:.5e6,opacity:1,z:1,seed:1,motion:{font:'gothic',color:'#ffffff'},settings:{},...over});
const projectOf=()=>{
 const p=createProject({durationUs:20e6});p.locks.lyrics=false;
 p.scenes=[{id:'S',startUs:2e6,endUs:12e6,originUs:2e6}];
 p.lyrics=[{id:'L0',text:'折り目が光に変わっていく',runs:[{id:'r',text:'折り目が光に変わっていく'}],startUs:13e6,endUs:16e6,motion:{font:'gothic',color:'#ffffff'},timingSource:'manual',opacity:1}];
 p.clips=[clipOf(),clipOf({id:'BG',text:' ',settings:{omakase:true},motion:{code:{version:1,source:'x'}}}),clipOf({id:'EMPTY',text:'  '}),{...clipOf({id:'IMG',kind:'image'}),assetId:'a'}];
 p.assets={a:{id:'a',projectId:p.id,byteLength:1,hash:'h'}};
 for(const v of Object.values(p.views)){for(const c of p.clips)v.layout[c.id]=newLayout();for(const l of p.lyrics)v.layout[l.id]=newLayout();}
 return p;
};
const measure=(ch,font,px)=>/[\x00-\x7f]/.test(ch)?px*.55:px;
const planOf=(p,o={})=>finishCutPlan(planCutsRaw(p,{seed:3,...o}),{itemOf:cut=>buildAnyItem(cut,{W:960,H:540,measure})});

test('free text: only clips that have text and are not omakase backgrounds count; times are the scene origin + the clip time', () => {
 const p=projectOf();
 assert.deepEqual(p.clips.filter(isFreeText).map(c=>c.id),['T1']);
 assert.deepEqual(spanOf(p,p.clips[0]),{startUs:2.5e6,endUs:5.5e6},'scene origin 2 s + clip 0.5-3.5 s');
 assert.deepEqual(spanOf(p,p.lyrics[0]),{startUs:13e6,endUs:16e6});
 const off=linesOf(p),on=linesOf(p,{freeText:true});
 assert.deepEqual(off.subjects.map(s=>s.id),['L0']);
 assert.deepEqual(on.subjects.map(s=>s.id+':'+s.kind),['T1:clip','L0:lyric'],'in time order, with the kind');
 assert.deepEqual(on.lines[0],{text:'光をつなぐ',start:2.5,end:5.5});
});

test('the plan covers the free text too, and the data is stored on the clip (settings.cut), valid and drawable', () => {
 const p=projectOf(),{data,lyrics}=planOf(p,{freeText:true});
 assert.deepEqual([...data.keys()].sort(),['L0','T1']);
 assert.equal(lyrics.find(s=>s.id==='T1').kind,'clip');
 const cmd=cutCommands(p,{data,lyrics},{palette:{color:'#ffd23f',emphasisColor:'#ff6fae'},sizePct:12,clearBg:true});
 assert.deepEqual(cmd.commands.filter(c=>c.type==='setClipContent').map(c=>c.id),['T1'],'only the free text clip gets a plan (not the background, the empty text or the image)');
 assert.ok(cmd.commands.some(c=>c.type==='setLyricAppearance'&&c.id==='L0')&&cmd.commands.some(c=>c.type==='deleteClip'&&c.id==='BG'));
 const {project:q}=applyCommand(p,cmd);
 assert.deepEqual(validateProject(q),[]);
 const clip=q.clips.find(c=>c.id==='T1');
 assert.ok(cutActive(clip)&&cutOf(clip).cuts.length>=1);
 assert.equal(clip.motion.color,'#ffd23f','the palette is applied');
 assert.equal(cutOf(clip).sig,motionSig(clip));
 assert.ok(!q.clips.some(c=>c.id==='BG'),'the omakase background clip is removed');
 assert.ok(!('cut' in q.clips.find(c=>c.id==='IMG').settings)&&!q.clips.find(c=>c.id==='EMPTY').settings.cut);
 // times: inside the clip's span, scaled to the clip
 const abs=absoluteCuts(clip,{span:spanOf(q,clip)});
 assert.equal(abs[0].start,2.5);assert.equal(abs.at(-1).end,5.5);
 assert.ok(abs.every((c,i)=>c.id===`T1:${i}`&&c.color==='#ffd23f'));
 // the clip trimmed to half: the same cuts, squeezed
 const short=absoluteCuts(clip,{span:{startUs:2.5e6,endUs:4e6}});assert.equal(short.at(-1).end,4);
 // changing the text, or picking a code motion by hand, switches this clip back to the normal text layer
 const {project:t}=applyCommand(q,{type:'setClipContent',id:'T1',patch:{text:'ちがう文字'}});assert.equal(cutActive(t.clips.find(c=>c.id==='T1')),false);
 const {project:m}=applyCommand(q,{type:'setClipContent',id:'T1',patch:{motion:{...clip.motion,code:{version:1,source:'return 1'}}}});assert.equal(cutActive(m.clips.find(c=>c.id==='T1')),false);
});

test('without 「自由文字にも付ける」 the clips get no plan, and an old plan on a clip is taken off', () => {
 const p=projectOf(),withFree=planOf(p,{freeText:true}),{project:q}=applyCommand(p,cutCommands(p,withFree,{palette:null,sizePct:12,clearBg:false}));
 assert.ok(cutActive(q.clips.find(c=>c.id==='T1')));
 const none=planOf(q,{freeText:false});assert.deepEqual([...none.data.keys()],['L0']);
 const {project:r}=applyCommand(q,cutCommands(q,none,{palette:null,sizePct:12,clearBg:false}));
 assert.ok(!('cut' in r.clips.find(c=>c.id==='T1').settings),'the old plan is gone');assert.ok(cutActive(r.lyrics[0]),'the lyric keeps its plan');
 // removing everything
 const {project:z}=applyCommand(q,removeCutCommands(q));assert.ok(z.clips.every(c=>!c.settings?.cut)&&z.lyrics.every(l=>!l.cut));assert.deepEqual(validateProject(z),[]);
 assert.equal(removeCutCommands(z),null,'nothing to remove');
});

test('a malformed plan on a clip is refused by the project check', () => {
 const p=projectOf();
 for(const bad of [5,{v:1},{v:2,cuts:[]},'x']){
  const q={...p,clips:p.clips.map(c=>c.id==='T1'?{...c,settings:{cut:bad}}:c)};
  assert.ok(validateProject(q).some(i=>i.code==='INVALID_VALUE'&&i.targetId==='T1'),JSON.stringify(bad));
 }
 assert.deepEqual(validateProject({...p,clips:p.clips.map(c=>c.id==='T1'?{...c,settings:{cut:null}}:c)}),[]);
});
