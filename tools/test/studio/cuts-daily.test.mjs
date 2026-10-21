// 毎日足すカット割りの部品（app/studio/cuts/daily-parts.js）: 形・名前・説明・日付の決まり、手で作った部品と名前が重ならない、
// 計画（おまかせのカット割り）が実際に選ぶ、保存データの掃除（cleanCutData）で値が変わらない。描く部品が例外を出さないことは、軸ごとのテスト（cuts-glyphs / cuts-parts / cuts-worlds）が全部の部品について見る。
import test from 'node:test';
import assert from 'node:assert/strict';
import {DAILY_CUT_PARTS} from '../../../app/studio/cuts/daily-parts.js';
import {AXES,MOODS} from '../../../app/studio/cuts/kit.js';
import {GLYPH_GROUPS} from '../../../app/studio/cuts/glyphs.js';
import {GROUPS} from '../../../app/studio/cuts/parts.js';
import {WORLD} from '../../../app/studio/cuts/worlds.js';
import {DECO} from '../../../app/studio/cuts/decos.js';
import {planCutsRaw,finishCutPlan,cleanCutData} from '../../../app/studio/cuts/plan.js';
import {buildAnyItem} from '../../../app/studio/cuts/items.js';
import {createProject,newLayout} from '../../../app/studio/model.js';
import {rng} from '../../../app/studio/omakase.js';

const TABLES={...GLYPH_GROUPS,...GROUPS,world:WORLD,deco:DECO};
// 軸ごとの、計画のカットでの項目名（部品の名前、その値）
const FIELD={enter:['enter','enterP'],hold:['hold','holdP'],exit:['exit','exitP'],treat:['treat','treatP'],bg:['bgPart','bgP'],cam:['cam','camP'],fx:['fx','fxP'],trans:['trans','transP'],world:['world','worldP'],deco:['deco','decoP']};
const NEEDS={enter:d=>typeof d.inDur==='function'&&(d.glyph||d.item),exit:d=>typeof d.outDur==='function'&&(d.glyph||d.item),hold:d=>d.glyph||d.item,treat:d=>typeof d.style==='function',
 bg:d=>typeof d.draw==='function',cam:d=>typeof d.get==='function',fx:d=>typeof d.apply==='function'&&d.dur>0,trans:d=>typeof d.draw==='function'&&d.dur>0,world:d=>typeof d.frame==='function'&&typeof d.fits==='function',deco:d=>typeof d.draw==='function'};

test('every daily part follows the rules of the routine and is joined to its table (not hidden by a hand-made part of the same name)', () => {
 const seen=new Set();
 for(const d of DAILY_CUT_PARTS){
  const id=`${d.axis}/${d.key}`;
  assert.ok(Object.hasOwn(AXES,d.axis),`${id}: axis`);
  assert.match(d.key,/^[a-z][A-Za-z0-9]*$/,`${id}: key`);
  assert.ok(!seen.has(id),`${id}: twice`);seen.add(id);
  assert.ok(typeof d.name==='string'&&[...d.name].length>=2&&[...d.name].length<=12,`${id}: name (2-12)`);
  assert.ok(typeof d.desc==='string'&&[...d.desc].length>=10&&[...d.desc].length<=60&&d.desc.endsWith('。'),`${id}: desc (10-60, ends with 。)`);
  assert.match(d.added,/^\d{4}-\d{2}-\d{2}$/,`${id}: added`);
  // 言い方（部品ラボの言葉辞典が引く）。2026-10-22 から足す部品は必ず付ける
  if(d.words!==undefined||d.added>='2026-10-22')assert.ok(Array.isArray(d.words)&&d.words.length>=1&&d.words.length<=4&&d.words.every(x=>typeof x==='string'&&x.trim()===x&&[...x].length>=1&&[...x].length<=12)&&new Set(d.words).size===d.words.length,`${id}: words (1-4 different words, 1-12 characters each)`);
  assert.ok(Array.isArray(d.tags)&&d.tags.length&&d.tags.every(t=>MOODS.includes(t)),`${id}: tags`);
  assert.ok(d.w>0&&d.w<=2,`${id}: w`);
  assert.ok(NEEDS[d.axis](d),`${id}: the functions of a ${d.axis} part`);
  const joined=TABLES[d.axis][d.key];
  assert.ok(joined&&joined.daily?.added===d.added,`${id}: a hand-made part already has this name`);
  assert.ok(!Object.values(TABLES[d.axis]).some(o=>o!==joined&&o.name===d.name),`${id}: another ${d.axis} part has the name 「${d.name}」`);
  if(d.plan)for(let s=0;s<20;s++){const a=d.plan(rng(id+s)),b=d.plan(rng(id+s));assert.deepEqual(a,b,`${id}: plan is not deterministic`);assert.deepEqual(JSON.parse(JSON.stringify(a)),a,`${id}: plan is not JSON-safe`);}
 }
});

const TEXTS=['折り目が光に変わっていく','小さな紙が風に飛んだ','ほら、もう一回ひろげよう','紙の翼でどこまでも'];
const projectOf=()=>{const p=createProject({durationUs:12e6});p.locks.lyrics=false;
 p.lyrics=TEXTS.map((text,i)=>({id:'L'+i,text,runs:[{id:'r'+i,text}],startUs:Math.round((.4+i*2.8)*1e6),endUs:Math.round((.4+i*2.8+2.6)*1e6),motion:{font:'gothic',color:'#ffffff',emphasisColor:'#ff6fae'},timingSource:'manual',opacity:1}));
 for(const v of Object.values(p.views))for(const l of p.lyrics)v.layout[l.id]=newLayout();return p;};
const measure=(ch,font,px)=>/[\x00-\x7f]/.test(ch)?px*.55:px;
const planOf=(seed,over={})=>finishCutPlan(planCutsRaw(projectOf(),{seed,camAmount:1,fxAmount:1,transAmount:1,worldAmount:1,treatAmount:1,holdAmount:1,decoAmount:1,...over}),{itemOf:cut=>buildAnyItem(cut,{W:960,H:540,measure})});
// 台（世界）のあるカットには飾りが付かない。台を全部に付けると飾りの出番が少なく、飾りが増えると、どれかが60通りで一度も出ないことがある（2026-10-18、飾り34個で）。
// だから「選ばれるか」は、台なしの計画も一緒に数える

test('おまかせのカット割り picks the daily parts, and the saved values of a daily part pass the value check unchanged', () => {
 const used=new Set(),changed=[];
 for(let seed=1;seed<=60;seed++){
  for(const [,d] of planOf(seed,{worldAmount:0}).data)for(const c of d.cuts)if(c.deco)used.add(`deco/${c.deco}`);
  for(const [,d] of planOf(seed).data){
   for(const c of d.cuts)for(const [axis,[k]] of Object.entries(FIELD))if(c[k])used.add(`${axis}/${c[k]}`);
   // put each daily part (with values from its own plan) on the first cut, and read the data back
   if(seed>12)continue;
   for(const part of DAILY_CUT_PARTS){
    const [k,kp]=FIELD[part.axis],P=part.plan?part.plan(rng(`check:${seed}:${part.key}`)):{};
    const cut={...d.cuts[0],[k]:part.key,[kp]:P};if(part.axis==='deco'){cut.world=null;cut.worldP=null;}   // 装飾は物の世界のあるカットには付かないif(part.axis==='trans'){cut.transDur=Math.min(part.dur,.3);}
    const clean=cleanCutData({...d,cuts:[cut,...d.cuts.slice(1)]});
    if(!clean)changed.push(`${part.axis}/${part.key}: the data was dropped`);
    else if(clean.cuts[0][k]!==part.key)changed.push(`${part.axis}/${part.key}: became ${clean.cuts[0][k]}`);
    else if(JSON.stringify(clean.cuts[0][kp]??{})!==JSON.stringify(P))changed.push(`${part.axis}/${part.key}: ${JSON.stringify(P)} -> ${JSON.stringify(clean.cuts[0][kp])}`);
   }
  }
 }
 const never=DAILY_CUT_PARTS.filter(p=>!used.has(`${p.axis}/${p.key}`)).map(p=>`${p.axis}/${p.key}`);
 assert.deepEqual(never,[],'never picked in 60 plans (check tags, w, minDur, maxChars)');
 assert.deepEqual(changed.slice(0,6),[],`${changed.length} values were changed by the value check`);
});
