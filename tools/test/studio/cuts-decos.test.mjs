// カット割りの「装飾」（app/studio/cuts/decos.js）: 全部の装飾が描ける・同じ時刻は同じ描き方・計画の決まり（世界・縦書き・字の飾りのあるカットには付けない、量 0 なら出ない）・
// 保存データの掃除（知らない装飾は外す、世界のあるカットでは外す、値は plan の範囲に収める）。
import test from 'node:test';
import assert from 'node:assert/strict';
import {DECO,renderDeco,decoTiming} from '../../../app/studio/cuts/decos.js';
import {planCutsRaw,finishCutPlan,cleanCutData,assignDecos} from '../../../app/studio/cuts/plan.js';
import {buildAnyItem} from '../../../app/studio/cuts/items.js';
import {createProject,newLayout} from '../../../app/studio/model.js';
import {rng} from '../../../app/studio/omakase.js';

/** 呼ばれた描き方を記録するだけの、偽の 2D コンテキスト */
function recorder(){
 const calls=[];
 const ctx=new Proxy({},{get(t,k){if(k==='calls')return calls;if(k in t)return t[k];return (...a)=>{calls.push([k,...a.map(v=>typeof v==='number'?Math.round(v*1000)/1000:v)]);};},set(t,k,v){t[k]=v;calls.push(['set',k,v]);return true;}});
 return ctx;
}
const item={bbox:{x0:300,y0:220,x1:660,y1:320},size:90,W:960,H:540,delay:0};
const cutOf=(deco,decoP)=>({deco,decoP,start:0,end:2,color:'#ffffff',emphasisColor:'#ff6fae',seed:42});

test('every deco draws at several moments without errors, and the same moment draws the same way', () => {
 for(const [key,D] of Object.entries(DECO)){
  assert.ok(typeof D.name==='string'&&D.name.length>=2&&typeof D.draw==='function'&&Array.isArray(D.tags),`${key}: shape`);
  const P=D.plan?D.plan(rng('t:'+key)):{};
  for(const lt of [.05,.2,.5,1,1.9]){
   const a=recorder(),b=recorder();
   renderDeco(a,cutOf(key,P),item,lt,{back:!!D.back});renderDeco(b,cutOf(key,P),item,lt,{back:!!D.back});
   assert.deepEqual(a.calls,b.calls,`${key} at ${lt}: not the same`);
   if(lt===.5)assert.ok(a.calls.some(c=>['stroke','fill','fillRect','strokeRect'].includes(c[0])),`${key}: draws nothing in the middle of the cut`);
  }
  // drawn only on its own side of the text
  const other=recorder();renderDeco(other,cutOf(key,P),item,.5,{back:!D.back});assert.equal(other.calls.length,0,`${key}: drawn on the wrong side of the text`);
 }
});

test('the deco comes in at the head of the cut and is gone at its end', () => {
 assert.equal(decoTiming(0,2).a,0);
 assert.equal(decoTiming(1,2).a,1);assert.equal(decoTiming(1,2).z,1);
 assert.equal(decoTiming(2,2).z,0);
 const r=recorder();renderDeco(r,cutOf('sparkles',{n:4,seed:1}),item,0);assert.equal(r.calls.length,0);
});

const TEXTS=['折り目が光に変わっていく','小さな紙が風に飛んだ','ほら、もう一回ひろげよう','紙の翼でどこまでも'];
const projectOf=()=>{const p=createProject({durationUs:12e6});p.locks.lyrics=false;
 p.lyrics=TEXTS.map((text,i)=>({id:'L'+i,text,runs:[{id:'r'+i,text}],startUs:Math.round((.4+i*2.8)*1e6),endUs:Math.round((.4+i*2.8+2.6)*1e6),motion:{font:'gothic',color:'#ffffff',emphasisColor:'#ff6fae'},timingSource:'manual',opacity:1}));
 for(const v of Object.values(p.views))for(const l of p.lyrics)v.layout[l.id]=newLayout();return p;};
const measure=(ch,font,px)=>/[\x00-\x7f]/.test(ch)?px*.55:px;
const planOf=(seed,o={})=>finishCutPlan(planCutsRaw(projectOf(),{seed,...o}),{itemOf:cut=>buildAnyItem(cut,{W:960,H:540,measure})});

test('the plan puts decos on cuts, never on a world, a vertical cut or a cut whose glyphs are already decorated; 0% puts none', () => {
 let n=0;const used=new Set();
 for(let seed=1;seed<=40;seed++){
  for(const [,d] of planOf(seed,{decoAmount:1}).data)for(const c of d.cuts){
   if(!c.deco)continue;n++;used.add(c.deco);
   assert.ok(!c.world,'a deco on a world');assert.ok(!c.gVertical,'a deco on a vertical cut');assert.ok(!['marker','underline','box'].includes(c.treat),'a deco on decorated glyphs');
   assert.ok(DECO[c.deco]);
  }
  for(const [,d] of planOf(seed,{decoAmount:0}).data)assert.ok(d.cuts.every(c=>!c.deco),'0% still put a deco');
 }
 assert.ok(n>20,`only ${n} decos in 40 plans`);
 assert.ok(used.size>=Object.keys(DECO).length*.7,`only ${used.size} kinds of deco were used`);
});

test('assignDecos does not change the other parts of a plan', () => {
 const base=planCutsRaw(projectOf(),{seed:5,decoAmount:0}).cuts.map(c=>({...c,deco:undefined,decoP:undefined}));
 const withDeco=planCutsRaw(projectOf(),{seed:5,decoAmount:1}).cuts.map(c=>({...c,deco:undefined,decoP:undefined}));
 assert.deepEqual(withDeco,base);
 const c=[{id:'x',start:0,end:1,world:'ticket',gVertical:false,treat:'none',moodId:'pop'}];assignDecos(c,{seed:1,decoAmount:1});assert.equal(c[0].deco,null);
});

test('saved data: an unknown deco is dropped, a deco on a world cut is dropped, the values are kept to what plan can make', () => {
 const [,d]=[...planOf(3,{decoAmount:1}).data].find(([,x])=>x.cuts.some(c=>c.deco))||[];
 assert.ok(d,'no plan with a deco');
 const i=d.cuts.findIndex(c=>c.deco),c=d.cuts[i];
 assert.equal(cleanCutData(d).cuts[i].deco,c.deco);
 assert.deepEqual(cleanCutData(d).cuts[i].decoP,c.decoP,'the planned values changed');
 const swap=(x)=>({...d,cuts:d.cuts.map((y,j)=>j===i?{...y,...x}:y)});
 assert.equal(cleanCutData(swap({deco:'noSuchDeco'})).cuts[i].deco,null);
 const huge=cleanCutData(swap({deco:'focusLines',decoP:{n:1e9,seed:5}})).cuts[i].decoP;assert.ok(huge.n<=24,`n not limited: ${huge.n}`);
});
