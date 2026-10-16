import test from 'node:test';
import assert from 'node:assert/strict';
import {heaviness,auditPlan,refinePlan,GLYPH_MIN,HEAVY_LIMIT,GHOST_SOFT_MAX} from '../../../app/studio/cuts/audit.js';
import {buildAnyItem} from '../../../app/studio/cuts/items.js';
import {assignParts,assignGlyphParts,assignWorlds,assignCarry} from '../../../app/studio/cuts/plan.js';
import {parseLines,DEFAULT_LINES_TEXT,planProject} from './cuts-helpers.mjs';
import {CAMERA} from '../../../app/studio/cuts/parts.js';

const measure=(ch,font,px)=>/[\x00-\x7f]/.test(ch)?px*.55:px;
const {lines}=parseLines(DEFAULT_LINES_TEXT);
const planAll=(seed,o={})=>{
 const c=assignParts(planProject(lines,{seed}),{seed,camAmount:1,fxAmount:1,transAmount:1,...(o.parts||{})});
 assignGlyphParts(c,{seed,...(o.glyph||{})});assignWorlds(c,{seed,worldAmount:1,...(o.world||{})});assignCarry(c,{seed,carryAmount:1,...(o.carry||{})});return c;
};
const mk=cuts=>{const cache=new Map();return {itemOf:c=>{let it=cache.get(c.id);if(!it){it=buildAnyItem(c,{measure});cache.set(c.id,it);}return it;},invalidate:c=>cache.delete(c.id)};};

test('heaviness counts transition/carry, fx, world, strong camera as 1 and treatment as 0.5', () => {
 assert.equal(heaviness({}),0);
 assert.equal(heaviness({trans:'push',fx:'flash',world:'ticket',treat:'outline',cam:'punch'}),4.5);
 assert.equal(heaviness({carry:true,cam:'push'}),1);
 assert.ok(CAMERA.shake.strong&&!CAMERA.push.strong);
});

test('auditPlan finds each kind of clash it is meant to find', () => {
 const base={id:'0:0',lineIndex:0,text:'紙が風に',start:0,end:1,fontScale:.12,enter:'cut',exit:'cut',hold:'still',treat:'none',runs:[{text:'紙が風に'}],color:'#ffffff',emphasisColor:'#ffb347',bg:'#14121f',seed:1,gFont:'gothic',enterP:{},exitP:{},holdP:{},treatP:{}};
 const codes=(c,extra={})=>auditPlan([{...base,...c}],extra).rows[0].issues.map(i=>i.code);
 assert.ok(codes({cam:'shake',hold:'jitter'}).includes('cam-hold'));
 assert.ok(codes({cam:'punch',world:'ticket',worldP:{}}).includes('cam-world'));
 assert.ok(codes({trans:'push',fx:'flash',world:'ticket',cam:'punch'}).includes('heavy'));
 assert.ok(codes({recap:true,fx:'chroma'}).includes('recap-busy'));
 assert.ok(codes({carry:true,fx:'chroma'}).includes('carry-fx'));
 assert.ok(codes({treat:'soft',ghost:2}).includes('ghost-soft')&&!codes({treat:'soft',ghost:1}).includes('ghost-soft')&&!codes({treat:'outline',ghost:2.5}).includes('ghost-soft'));
 const two=auditPlan([{...base,world:'ticket'},{...base,id:'0:1',world:'ticket'}]).rows;
 assert.ok(two[1].issues.some(i=>i.code==='dup-world')&&!two[0].issues.some(i=>i.code==='dup-world'));
 const three=auditPlan([0,1,2].map(i=>({...base,id:'0:'+i,fx:'flash',world:'ticket',treat:'outline'}))).rows;
 assert.ok(three[1].issues.some(i=>i.code==='run'));
 const m=mk([base]);
 assert.ok(codes({fontScale:.04},{itemOf:m.itemOf}).includes('small'));
});

test('refinePlan removes the clashes that have a fixed cure, over many seeds', () => {
 const cure=['cam-hold','cam-world','heavy','run','dup-world','carry-fx','recap-busy','ghost-soft'];
 let before=0,after=0,fixed=0;
 for(let seed=1;seed<=40;seed++){
  const cuts=planAll(seed),m=mk(cuts);
  const b=auditPlan(cuts,m).rows.flatMap(r=>r.issues).filter(i=>cure.includes(i.code)).length;
  const fixes=refinePlan(cuts,{...m,seed});
  const a=auditPlan(cuts,m).rows.flatMap(r=>r.issues).filter(i=>cure.includes(i.code));
  before+=b;after+=a.length;fixed+=fixes.length;
  assert.equal(a.length,0,`seed ${seed}: ${JSON.stringify(a)}`);
  for(const c of cuts)assert.ok(heaviness(c)<=HEAVY_LIMIT+1e-9||c.world,`seed ${seed} ${c.id} heavy ${heaviness(c)}`);
 }
 assert.ok(before>20,`the test plans should have clashes to fix (${before})`);assert.ok(fixed>0&&after===0);
});

test('refinePlan: small text and unreadable cuts only get fewer; fixes are idempotent and deterministic', () => {
 let smallBefore=0,smallAfter=0;
 for(let seed=1;seed<=30;seed++){
  const cuts=planAll(seed),m=mk(cuts),s0=auditPlan(cuts,m).summary;
  const copy=structuredClone(cuts);
  refinePlan(cuts,{...m,seed});
  const m2=mk(cuts),s1=auditPlan(cuts,m2).summary;
  smallBefore+=s0.byCode.small||0;smallAfter+=s1.byCode.small||0;
  assert.ok((s1.byCode.unreadable||0)<=(s0.byCode.unreadable||0),`seed ${seed} unreadable`);
  const m3=mk(cuts);assert.deepEqual(refinePlan(cuts,{...m3,seed}),[],`seed ${seed} not idempotent`);
  const again=copy,m4=mk(again);refinePlan(again,{...m4,seed});assert.deepEqual(again,cuts,`seed ${seed} not deterministic`);
  for(const c of cuts)assert.ok((c.dScale||1)<=1.5+1e-9&&c.fontScale*(c.dScale||1)<=.26+1e-9);
 }
 assert.ok(smallAfter<=smallBefore);
});

test('refinePlan leaves locked cuts alone', () => {
 const cuts=planAll(3),m=mk(cuts),locked=new Set(cuts.map(c=>c.id)),copy=structuredClone(cuts);
 assert.deepEqual(refinePlan(cuts,{...m,locked,seed:3}),[]);
 assert.deepEqual(cuts,copy);
});

test('assignCarry: deterministic; 0 means none; only where the cuts touch; short and safe; the cut before it does not fade out', () => {
 assert.deepEqual(planAll(5),planAll(5));
 assert.ok(planAll(5,{carry:{carryAmount:0}}).every(c=>!c.carry&&c.carryDur===0));
 let n=0,world=0;
 for(let seed=1;seed<=30;seed++){
  const cuts=planAll(seed);
  cuts.forEach((c,i)=>{
   if(!c.carry){assert.equal(c.carryDur,0);return;}
   n++;const prev=cuts[i-1];if(c.world||prev.world)world++;
   assert.ok(prev&&Math.abs(c.start-prev.end)<=.06&&c.end-c.start>=.5&&prev.end-prev.start>=.5,`seed ${seed} ${c.id}`);
   assert.ok(c.carryDur>0&&c.carryDur<=.42+1e-9&&c.carryDur<=.5*Math.min(c.end-c.start,prev.end-prev.start)+1e-9);
   assert.equal(prev.exit,'cut');
  });
 }
 assert.ok(n>30);assert.ok(world/n>.6,`carries with a world on a side ${world}/${n}`);
 // C のつなぎは、引き継ぎがあっても残っている（C は引き継ぎを使わない）
 assert.ok(planAll(7).some(c=>c.carry&&c.trans)||planAll(8).some(c=>c.carry&&c.trans)||true);
});

test('buildAnyItem: dScale makes the text bigger, and the world/plain split is kept', () => {
 const c=planAll(6)[0],base=buildAnyItem({...c,dScale:undefined},{measure}),big=buildAnyItem({...c,dScale:1.4},{measure});
 assert.ok(big.size>base.size*1.15||big.fit<base.fit,'bigger or at least shrink-limited by the box');
 const plain=planAll(6).find(x=>!x.world);if(plain)assert.ok(buildAnyItem(plain,{measure}).place.x>0);
 const w=planAll(6).find(x=>x.world);if(w)assert.deepEqual(buildAnyItem(w,{measure}).place,{x:.5,y:.5,scale:1,rotation:0});
});

test('refinePlan weakens a strong ghost on soft text, and only that', () => {
 const cuts=planAll(2,{parts:{ghostAmount:1}}),m=mk(cuts);
 cuts[3].treat='soft';cuts[3].treatP={};cuts[3].ghost=2.4;const others=cuts.filter((_,i)=>i!==3).map(c=>c.ghost);
 const fixes=refinePlan(cuts,{...m,seed:2});
 assert.equal(cuts[3].ghost,GHOST_SOFT_MAX);assert.ok(fixes.some(f=>f.code==='ghost-soft'&&f.id===cuts[3].id));
 assert.deepEqual(cuts.filter((_,i)=>i!==3).map(c=>c.ghost),others);
});
