import test from 'node:test';
import assert from 'node:assert/strict';
import {BG,CAMERA,FX,TRANS,GROUPS,partName} from '../../../app/studio/cuts/parts.js';
import {ghostPasses,ghostOffset,GHOST_PASSES} from '../../../app/studio/cuts/compose.js';
import {assignParts,partChoices} from '../../../app/studio/cuts/plan.js';
import {parseLines,DEFAULT_LINES_TEXT,planProject,describeParts} from './cuts-helpers.mjs';
import {MOODS,rng} from '../../../app/studio/omakase.js';

// 何を呼ばれても受け付ける Canvas のなりすまし（描く関数が例外を出さないことだけ確かめる）
const stub=()=>{const f=function(){};const p=new Proxy(f,{get:(t,k)=>k===Symbol.toPrimitive?()=>0:k==='canvas'?{width:960,height:540}:p,set:()=>true,apply:()=>p});return p;};
const env=(over={})=>({W:960,H:540,t:3.2,lt:.3,dur:.9,p:.33,fg:'#ffffff',accent:'#ffb347',bg:'#14121f',step:77,tmp:()=>stub(),...over});
const moods=new Set(MOODS.map(m=>m.id));

test('every part has a name, valid mood tags and a plan that is deterministic and JSON-safe', () => {
 for(const [group,reg] of Object.entries(GROUPS)){
  assert.ok(Object.keys(reg).length>=6,group);
  for(const [key,d] of Object.entries(reg)){
   assert.equal(typeof d.name,'string',`${group}.${key}`);
   assert.ok(d.tags.length>0&&d.tags.every(t=>moods.has(t)),`${group}.${key} tags`);
   assert.ok((d.w??1)>0);
   const a=d.plan(rng('x:'+key)),b=d.plan(rng('x:'+key));
   assert.deepEqual(a,b);assert.deepEqual(JSON.parse(JSON.stringify(a)),a);
  }
 }
 assert.equal(partName('bg','rays'),'放射');assert.equal(partName('bg',null),'なし');
});

test('backgrounds draw at many times without throwing', () => {
 for(const [key,d] of Object.entries(BG))for(const t of [0,1.7,9.3,123.4]){
  const P=d.plan(rng('bg'+key));assert.doesNotThrow(()=>d.draw(stub(),env({t}),P),key);
 }
});

test('cameras return finite, bounded transforms', () => {
 for(const [key,d] of Object.entries(CAMERA)){
  const P=d.plan(rng('cam'+key));
  for(const lt of [0,.05,.2,.5,.9]){
   const e=env({lt,t:3+lt,p:lt/.9}),c=d.get(e,P);
   for(const v of Object.values(c))assert.ok(Number.isFinite(v),`${key} ${JSON.stringify(c)}`);
   assert.ok((c.s??1)>=.95&&(c.s??1)<=1.45,`${key} scale ${c.s}`);
   assert.ok(Math.abs(c.rot||0)<=8,`${key} rot`);
   assert.ok((c.blur||0)>=0&&(c.blur||0)<=20,`${key} blur ${c.blur}`);
   assert.ok(Math.abs(c.x||0)<=e.W*.2&&Math.abs(c.y||0)<=e.H*.2,`${key} shift`);
  }
 }
});

test('screen effects and transitions run at every strength / progress', () => {
 for(const [key,d] of Object.entries(FX)){
  assert.ok(d.dur>=.1&&d.dur<=.5,key);
  for(const k of [1,.6,.2,.02])assert.doesNotThrow(()=>d.apply(stub(),env(),d.plan(rng('fx'+key)),k),key);
 }
 for(const [key,d] of Object.entries(TRANS)){
  assert.ok(d.dur>=.25&&d.dur<=.5,key);
  for(const p of [0,.1,.5,.9,1])assert.doesNotThrow(()=>d.draw(stub(),stub(),stub(),p,env(),d.plan(rng('tr'+key))),`${key} p=${p}`);
 }
});

const {lines}=parseLines(DEFAULT_LINES_TEXT);
const plan=(o={},seed=1)=>assignParts(planProject(lines,{seed}),{seed,...o});

test('assignParts: deterministic, only known keys, parts stored with their plans', () => {
 const a=plan(),b=plan();assert.deepEqual(a,b);
 for(const c of a){
  assert.ok(c.bgPart===null||BG[c.bgPart]);assert.ok(c.cam===null||CAMERA[c.cam]);assert.ok(c.fx===null||FX[c.fx]);assert.ok(c.trans===null||TRANS[c.trans]);
  assert.equal(c.bgPart===null,c.bgP===null);assert.equal(c.trans===null,c.transP===null);
  assert.deepEqual(JSON.parse(JSON.stringify([c.bgP,c.camP,c.fxP,c.transP])),[c.bgP,c.camP,c.fxP,c.transP]);
  const d=describeParts(c);assert.ok(d.bg&&d.cam&&d.fx&&d.trans);
 }
 assert.notDeepEqual(plan({},1).map(c=>[c.bgPart,c.cam,c.fx,c.trans]),plan({},2).map(c=>[c.bgPart,c.cam,c.fx,c.trans]));
});

test('assignParts: an amount of 0 switches that axis off; 1 uses it a lot', () => {
 const off=plan({camAmount:0,fxAmount:0,transAmount:0,bgMode:'none'});
 assert.ok(off.every(c=>!c.cam&&!c.fx&&!c.trans&&!c.bgPart));
 let cam=0,fx=0,trans=0,adjacentBoundaries=0;
 for(let seed=1;seed<=20;seed++){
  const cuts=plan({camAmount:1,fxAmount:1,transAmount:1},seed);
  cuts.forEach((c,i)=>{if(c.cam)cam++;if(c.fx)fx++;if(c.trans)trans++;if(i&&Math.abs(c.start-cuts[i-1].end)<=.06&&c.end-c.start>=.5)adjacentBoundaries++;});
 }
 const n=12*20;
 assert.ok(cam/n>.8,`cam ${cam/n}`);assert.ok(fx/n>.4,`fx ${fx/n}`);assert.ok(trans/adjacentBoundaries>.5,`trans ${trans}/${adjacentBoundaries}`);
});

test('assignParts: transitions only where the cuts touch, and never longer than 45% of the shorter cut', () => {
 for(let seed=1;seed<=30;seed++){
  const cuts=plan({transAmount:1},seed);
  cuts.forEach((c,i)=>{
   if(!c.trans){assert.equal(c.transDur,0);return;}
   const prev=cuts[i-1];
   assert.ok(prev&&Math.abs(c.start-prev.end)<=.06,`seed ${seed} cut ${c.id}`);
   assert.ok(c.end-c.start>=.5);
   assert.ok(c.transDur<=.45*Math.min(c.end-c.start,prev.end-prev.start)+1e-9&&c.transDur>0);
  });
 }
 // 行の最初のカット（前の行とは隙間がある所、または最初のカット）は、隙間が大きければつなぎなし
 const cuts=plan({transAmount:1},3),gapIndex=cuts.findIndex((c,i)=>i&&c.start-cuts[i-1].end>.2);
 assert.ok(gapIndex>0);assert.equal(cuts[gapIndex].trans,null);
});

test('assignParts: the same part is never picked twice in a row on one axis (when it picks one at all)', () => {
 for(let seed=1;seed<=40;seed++){
  const cuts=plan({camAmount:1,fxAmount:1,transAmount:1},seed);
  for(const axis of ['cam','fx','trans']){
   const picks=cuts.map(c=>c[axis]).filter(Boolean);   // 何も選ばなかったカットは飛ばして、選んだもの同士を比べる
   for(let i=1;i<picks.length;i++)assert.notEqual(picks[i],picks[i-1],`seed ${seed} ${axis}`);
  }
 }
});

test('ghost: strength follows the amount and the mood; passes only exist once there is a past; offsets scale with text size and flip with direction', () => {
 assert.ok(plan({ghostAmount:0}).every(c=>c.ghost===0));
 const mean=mood=>{let s=0,n=0;for(let seed=1;seed<=30;seed++)for(const c of assignParts(planProject(lines,{seed,mood}),{seed})){s+=c.ghost;n++;assert.ok(c.ghost>=0&&c.ghost<=2.5&&[-1,1].includes(c.ghostP.dir));}return s/n;};
 assert.ok(mean('glitch')>mean('calm')*2,`glitch ${mean('glitch')} calm ${mean('calm')}`);
 const lo=assignParts(planProject(lines,{seed:3}),{seed:3,ghostAmount:.2}),hi=assignParts(planProject(lines,{seed:3}),{seed:3,ghostAmount:.8});
 assert.ok(hi.every((c,i)=>c.ghost>=lo[i].ghost));
 const cut={ghost:1,ghostP:{dir:1},fontScale:.12},none={ghost:0,ghostP:{dir:1},fontScale:.12};
 assert.deepEqual(ghostPasses(none,.5),[]);
 assert.equal(ghostPasses(cut,0).length,0);
 assert.equal(ghostPasses(cut,.05).length,1);                       // 0.8/24秒前だけ（1.6/24秒前はまだ過去がない）
 assert.equal(ghostPasses(cut,.2).length,2);
 for(const p of ghostPasses(cut,.2))assert.ok(p.lt>=0&&p.lt<.2&&Math.abs(.2-p.lt-GHOST_PASSES.find(x=>x.color===p.color).lag)<1e-9);
 const S={W:960,H:540},o=ghostOffset(cut,GHOST_PASSES[0],S),o2=ghostOffset({...cut,fontScale:.24},GHOST_PASSES[0],S),o3=ghostOffset({...cut,ghostP:{dir:-1}},GHOST_PASSES[0],S);
 const big=ghostOffset(cut,GHOST_PASSES[0],{W:1920,H:1080});assert.ok(Math.abs(big.dx)>Math.abs(o.dx)*1.9,'the offset follows the picture size');
 assert.ok(Number.isFinite(o.dx)&&Math.abs(o2.dx)>Math.abs(o.dx)*1.5&&Math.abs(o3.dx+o.dx)<1e-9);
});

test('avoidFlash keeps flash / invert / flash transition out of the plan (and without it they do appear)', () => {
 const bad=c=>['flash','invert'].includes(c.fx)||c.trans==='flash';
 let withFlash=0,without=0;
 for(let seed=1;seed<=40;seed++){
  if(plan({avoidFlash:false,camAmount:1,fxAmount:1,transAmount:1},seed).some(bad))withFlash++;
  if(plan({avoidFlash:true,camAmount:1,fxAmount:1,transAmount:1},seed).some(bad))without++;
 }
 assert.ok(withFlash>10,`flash should appear when allowed (${withFlash})`);assert.equal(without,0);
 for(const k of ['flash','invert'])assert.ok(FX[k].strongFlash,k);assert.ok(TRANS.flash.strongFlash);
});
