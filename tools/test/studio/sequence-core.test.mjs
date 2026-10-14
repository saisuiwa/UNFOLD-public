import test from 'node:test';import assert from 'node:assert/strict';const m=await import('../../../app/sequence-core.js').catch(()=>({}));const fixture={settings:{bpm:120,holdBeats:4,bg:'#123456'},slides:[{},{}],transitions:[{beats:8,method:'fold',shape:'sphere'}]};
test('legacy beat intervals retain holds transitions exact boundaries and terminal frame',()=>{assert.equal(typeof m.compileSequenceTiming,'function');const t=m.compileSequenceTiming(fixture);assert.equal(t.durationUs,8e6);assert.deepEqual(t.segments.map(s=>[s.startUs,s.endUs,s.i,s.tr]),[[0,2e6,0,-1],[2e6,6e6,0,0],[6e6,8e6,1,-1]]);assert.equal(m.evaluateSequenceFrame(fixture,2e6).transitionIndex,0);assert.equal(m.evaluateSequenceFrame(fixture,6e6).slideIndex,1);assert.equal(m.evaluateSequenceFrame(fixture,8e6).slideIndex,1);});
test('pure transition coefficients match frozen old formulas at the midpoint and rewind',()=>{assert.equal(typeof m.evaluateSequenceFrame,'function');const f=m.evaluateSequenceFrame(fixture,4e6);assert.equal(f.progress,.5);assert.equal(f.localUs,2e6);assert.equal(f.transform.distort,1);assert.equal(f.transform.form,1);assert.equal(f.transform.conceal,1);assert.ok(Math.abs(f.transform.swap-.5)<1e-12);const one=m.evaluateSequenceFrame(fixture,1e6);m.evaluateSequenceFrame(fixture,7e6);assert.deepEqual(m.evaluateSequenceFrame(fixture,1e6),one);assert.equal(Object.hasOwn(one,'audio'),false);assert.equal(one.background,'#123456');});

// ---- ぐちゃぐちゃの長さ (chaos length) ---------------------------------------------------------------------------------------------------------------
import {sequenceCurves,warpTime} from '../../../app/sequence-core.js';
test('chaos length 0 is the original timing, exactly', () => {
 for(let i=0;i<=100;i++){const u=i/100,a=sequenceCurves(u),b=sequenceCurves(u,0);assert.deepEqual(b,a);assert.equal(warpTime(u,0),u);}
 assert.deepEqual(sequenceCurves(.5),{distort:sequenceCurves(.5,0).distort,form:sequenceCurves(.5,0).form,conceal:sequenceCurves(.5,0).conceal,swap:sequenceCurves(.5,0).swap,spin:sequenceCurves(.5,0).spin});
});
test('chaos length: the breaking-up finishes before the solid forms, the change keeps its length and still ends flat', () => {
 for(const hold of [.25,.5,1]){
  // the solid starts later than it did (and its way back too), never earlier
  const startOf=h=>{for(let i=0;i<=1000;i++)if(sequenceCurves(i/1000,h).form>.05)return i/1000;return 1;};
  assert.ok(startOf(hold)>startOf(0),'starts later: '+startOf(hold)+' > '+startOf(0));
  for(let i=0;i<=100;i++){const u=i/100;assert.ok(warpTime(u,hold)<=u+1e-9);if(u<=.45)assert.ok(sequenceCurves(u,hold).form<=sequenceCurves(u,0).form+1e-9,'form never earlier on the way up: '+hold+' '+u);}
  // at the moment the solid begins (form > 5 %), the breaking-up is already (almost) complete
  let first=0;for(let i=0;i<=1000;i++){if(sequenceCurves(i/1000,hold).form>.05){first=i/1000;break;}}
  assert.ok(sequenceCurves(first,hold).distort>=.95,`hold ${hold}: distort ${sequenceCurves(first,hold).distort} when the solid starts at ${first}`);
  // the ends: flat, no solid, picture swapped, nothing broken
  const end=sequenceCurves(1,hold),start=sequenceCurves(0,hold);
  assert.equal(end.distort,0);assert.equal(end.form,0);assert.equal(end.swap,1);assert.equal(start.distort,0);assert.equal(start.form,0);assert.equal(start.swap,0);
  // monotone warp
  let last=-1;for(let i=0;i<=200;i++){const w=warpTime(i/200,hold);assert.ok(w>=last-1e-12);last=w;}
 }
 // the original timing broke off half way: distort was < 0.95 when the solid started
 let first=0;for(let i=0;i<=1000;i++){if(sequenceCurves(i/1000).form>.05){first=i/1000;break;}}
 assert.ok(sequenceCurves(first).distort<.95);
});
test('a frame inside a change follows the setting; a project without it keeps the old timing', () => {
 const snapshot=extra=>({slides:[{hold:1},{hold:1}],transitions:[{beats:4}],settings:{bpm:60,holdBeats:1,...extra}});
 const at=(s,us)=>m.evaluateSequenceFrame(s,us).transform;
 const us=1e6+4e6*.35;   // 35 % into the change
 assert.deepEqual(at(snapshot({}),us),at(snapshot({chaosLength:0}),us),'missing = 0');
 const longer=at(snapshot({chaosLength:1}),us),plain=at(snapshot({chaosLength:0}),us);
 assert.ok(longer.form<plain.form,'the solid has not started yet: '+longer.form+' < '+plain.form);
 assert.ok(longer.distort>.5,'the breaking-up is well under way: '+longer.distort);
});
