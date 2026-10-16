import test from 'node:test';
import assert from 'node:assert/strict';
import {chunkLine,splitLine,planCuts} from '../../../app/studio/cuts/plan.js';
import {parseLines,DEFAULT_LINES_TEXT,planProject} from './cuts-helpers.mjs';

const {lines}=parseLines(DEFAULT_LINES_TEXT);
const strip=t=>t.replace(/\s/g,'');

test('chunkLine loses nothing and cuts at 文節 boundaries', () => {
 for(const l of lines){
  const ch=chunkLine(l.text);
  assert.equal(ch.map(c=>c.text).join(''),l.text);
  assert.ok(ch.length>=2,l.text);
  assert.ok(ch.every(c=>c.text.length>0));
 }
 assert.deepEqual(chunkLine('折り目が光に変わっていく').map(c=>c.text),['折り目が','光に','変わっていく']);
 assert.deepEqual(chunkLine('小さな紙が風に飛んだ').map(c=>c.text),['小さな','紙が','風に','飛んだ']);
 assert.deepEqual(chunkLine('ほら、もう一回ひろげよう').map(c=>c.text),['ほら、もう','一回ひろげよう']);
 assert.deepEqual(chunkLine('紙の翼でどこまでも').map(c=>c.text),['紙の','翼でどこまでも']);
});

test('splitLine at the default density: 12 cuts for the 4 sample lines (a 4-chunk line in 3 cuts, short lines get the recap)', () => {
 const texts=lines.map(l=>splitLine(l,{density:.57}).map(c=>c.text));
 assert.deepEqual(texts[1],['小さな','紙が風に','飛んだ']);
 assert.deepEqual(texts[2],['ほら、もう','一回ひろげよう','ほら、もう一回ひろげよう']);
 assert.deepEqual(texts[3],['紙の','翼でどこまでも','紙の翼でどこまでも']);
 assert.equal(texts.flat().length,12);
});

test('splitLine: the pieces tile the line exactly, in order, no cut shorter than the minimum', () => {
 for(const density of [0,.3,.57,.8,1])for(const recap of ['auto','always','never'])for(const l of lines){
  const cuts=splitLine(l,{density,recap});
  assert.equal(cuts[0].start,l.start);assert.equal(cuts.at(-1).end,l.end);
  for(let i=0;i<cuts.length;i++){
   assert.ok(cuts[i].end-cuts[i].start>=.22-1e-9,`${l.text} ${density} ${recap} cut ${i}`);
   if(i)assert.ok(Math.abs(cuts[i].start-cuts[i-1].end)<1e-9);
  }
  const body=cuts.filter(c=>!c.recap).map(c=>c.text).join('');
  assert.equal(strip(body),strip(l.text));
  const recaps=cuts.filter(c=>c.recap);
  assert.ok(recaps.length<=1);
  if(recaps.length)assert.equal(recaps[0].text,l.text.trim());
  if(recap==='never')assert.equal(recaps.length,0);
 }
});

test('splitLine: a finer density never makes fewer cuts; the sample lines come out at 0.7-1.1 s per cut at the default', () => {
 for(const l of lines){
  const counts=[0,.25,.5,.75,1].map(d=>splitLine(l,{density:d}).length);
  for(let i=1;i<counts.length;i++)assert.ok(counts[i]>=counts[i-1],`${l.text}: ${counts}`);
 }
 const total=lines.flatMap(l=>splitLine(l,{density:.57}));
 const avg=total.reduce((a,c)=>a+c.end-c.start,0)/total.length;
 assert.ok(avg>.6&&avg<1.2,`average cut ${avg}`);
});

test('splitLine: a line too short for several cuts stays one cut', () => {
 const cuts=splitLine({text:'さよなら',start:1,end:1.4},{density:1,recap:'always'});
 assert.equal(cuts.length,1);
 assert.equal(splitLine({text:'a',start:0,end:3},{density:1}).length,1);
});


test('planCuts: deterministic; a new seed changes the plan; ids run line:cut; every cut has a size, a place, runs that spell its text and a dark base colour', () => {
 const a=planProject(lines,{seed:5}),b=planProject(lines,{seed:5}),c=planProject(lines,{seed:6});
 assert.deepEqual(a,b);
 assert.notDeepEqual(a.map(x=>[x.placeName,x.fontScale]),c.map(x=>[x.placeName,x.fontScale]));
 assert.equal(a.length,12);
 a.forEach((cut,i)=>{
  assert.match(cut.id,/^\d+:\d+$/);
  assert.ok(cut.fontScale>=.05&&cut.fontScale<=.24,String(cut.fontScale));
  assert.ok(Math.abs(cut.place.rotation)<=90&&cut.place.scale>=.7&&cut.place.scale<=1);
  assert.equal(cut.runs.map(r=>r.text).join(''),cut.text);
  assert.match(cut.bg,/^#[\da-f]{6}$/i);
  assert.ok(['calm','pop','glitch','graphic','emotional','impact'].includes(cut.moodId));
  if(i)assert.ok(cut.start>=a[i-1].start);
 });
 // the place is never the same twice in a row
 for(let seed=1;seed<=20;seed++){const p=planProject(lines,{seed});for(let i=1;i<p.length;i++)if(p[i].placeName!=='center'||p[i-1].placeName!=='center')assert.notEqual(p[i].placeName,p[i-1].placeName,`seed ${seed} cut ${i}`);}
});

test('planCuts: a fixed mood is used for every line; "mix" never repeats the mood of the line before', () => {
 assert.ok(planProject(lines,{seed:2,mood:'pop'}).every(c=>c.moodId==='pop'));
 for(let seed=1;seed<=15;seed++){const moods=[...new Set(planProject(lines,{seed}).map(c=>c.lineIndex+':'+c.moodId))].map(x=>x.split(':')[1]);for(let i=1;i<moods.length;i++)assert.notEqual(moods[i],moods[i-1],`seed ${seed}`);}
});

test('planCuts: the same lyrics split into several times the cuts of one-cut-per-line', () => {
 const cuts=planCuts(lines,{seed:1});
 assert.ok(cuts.length>=10&&cuts.length<=16,`cuts ${cuts.length}`);
});
