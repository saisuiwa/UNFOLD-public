import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD,worldFrame,renderWorld,buildWorldItem,worldTimes} from '../../../app/studio/cuts/worlds.js';
import {readableShare} from '../../../app/studio/cuts/glyphs.js';
import {assignParts,assignGlyphParts,assignWorlds} from '../../../app/studio/cuts/plan.js';
import {parseLines,DEFAULT_LINES_TEXT,planProject,describeWorld} from './cuts-helpers.mjs';
import {MOODS,rng} from '../../../app/studio/omakase.js';
import {wordPieces} from '../../../app/studio/word-size.js';

const W=960,H=540;
const measure=(ch,font,px)=>/[\x00-\x7f]/.test(ch)?px*.55:px;
const stub=()=>{const f=function(){};const p=new Proxy(f,{get:(t,k)=>k===Symbol.toPrimitive?()=>0:k==='canvas'?{width:W,height:H}:p,set:()=>true,apply:()=>p});return p;};
const moods=new Set(MOODS.map(m=>m.id));
const cutOf=(key,over={})=>{const c={id:'0:0',text:'紙は窓から飛んだ',runs:[{text:'紙は窓から飛んだ'}],start:0,end:1.2,color:'#ffffff',emphasisColor:'#ffb347',bg:'#14121f',fontScale:.13,seed:5,
 enter:'pop',enterP:{spread:.4,amp:2.4},hold:'still',holdP:{},exit:'cut',exitP:{},treat:'none',treatP:{},gFont:'gothic',gVertical:false,moodId:'pop',world:key,worldExit:true,...over};
 c.worldP=WORLD[key].plan(rng('t:'+key),c);return c;};
const itemFor=cut=>buildWorldItem(cut,{W,H,measure,pieces:wordPieces(cut.text)});
const planFor=(seed,o={})=>{const {lines}=parseLines(DEFAULT_LINES_TEXT);return assignWorlds(assignGlyphParts(assignParts(planProject(lines,{seed}),{seed}),{seed}),{seed,...o});};

test('every world is named, tagged, has fits/frame/plan, and its plan is deterministic and JSON-safe', () => {
 assert.ok(Object.keys(WORLD).length>=13);
 for(const [k,d] of Object.entries(WORLD)){
  assert.equal(typeof d.name,'string',k);assert.ok(d.tags.length>0&&d.tags.every(t=>moods.has(t)),k);assert.ok((d.w??1)>0);
  assert.equal(typeof d.fits,'function');assert.equal(typeof d.frame,'function');assert.ok(d.fits(4),`${k} must fit a short lyric`);
  const c=cutOf(k),a=d.plan(rng('x'+k),c),b=d.plan(rng('x'+k),c);assert.deepEqual(a,b);assert.deepEqual(JSON.parse(JSON.stringify(a)),a);
 }
});

test('the text box of every world stays inside the picture, and the world does not make the text wait longer than it can afford', () => {
 for(const [k,d] of Object.entries(WORLD))for(const n of [2,5,8,12,16,24].filter(n=>d.fits(n))){
  const text=Array.from('小さな紙が風に飛んだほらもう一回ひろげよう一二三').slice(0,n).join('');
  const c=cutOf(k,{text,runs:[{text}]}),F=worldFrame(c,n);
  const {cx,cy,w,h}=F.box;
  assert.ok(w>20&&h>20,`${k} n=${n}`);
  assert.ok(cx-w/2>=W*.02-1&&cx+w/2<=W*.98+1&&cy-h/2>=H*.02-1&&cy+h/2<=H*.98+1,`${k} n=${n} box ${JSON.stringify(F.box)}`);
  const T=worldTimes(1.2,true);assert.ok(F.delay>=0&&F.delay<=T.inW+1e-9,`${k} delay ${F.delay}`);
 }
});

test('layout modes: grid keeps every glyph in its cell, path tilts glyphs along the curve, left-aligned worlds start every line at the same x', () => {
 const g=itemFor(cutOf('grid'));
 assert.ok(g.glyphs.length===8&&g.glyphs.every(x=>x.cell&&Math.abs(x.cx-(x.cell.x+x.cell.w/2))<1e-6));
 const xs=new Set(g.glyphs.map(x=>x.cell.w.toFixed(3)));assert.equal(xs.size,1);
 const r=itemFor(cutOf('ribbon'));
 assert.ok(r.glyphs.every(x=>Number.isFinite(x.rot0)&&Math.abs(x.rot0)<35)&&r.glyphs.some(x=>Math.abs(x.rot0)>.5));
 assert.equal(new Set(r.glyphs.map(x=>x.line)).size,1,'ribbon is one line');
 for(const k of ['telop','window']){
  const text='小さな紙が風に飛んだほらもう一回ひろげようよ',it=itemFor(cutOf(k,{text,runs:[{text}],fontScale:.1}));
  assert.ok(it.lines.length>=2,k);
  const x0s=it.lines.map(l=>l.x0.toFixed(2));assert.equal(new Set(x0s).size,1,`${k} ${x0s}`);
 }
});

test('worlds draw at every moment (entering, resting, leaving) without an exception, with and without their own exit', () => {
 for(const k of Object.keys(WORLD))for(const exit of [true,false]){
  const c=cutOf(k,{worldExit:exit}),it=itemFor(c);
  for(const lt of [0,.04,.15,.3,.6,1.0,1.15,1.199])assert.doesNotThrow(()=>renderWorld(stub(),c,it,lt,{layer:stub}),`${k} ${exit} ${lt}`);
 }
});

test('arrange: plate worlds give every glyph a readable colour; ransom gives each glyph its own tilt and typeface', () => {
 for(const k of ['tape','bands','grid']){const it=itemFor(cutOf(k));assert.ok(it.glyphs.some(g=>g.color),k);}
 const it=itemFor(cutOf('ransom'));
 assert.ok(it.glyphs.every(g=>g.plate&&g.color&&Number.isFinite(g.rot0)&&g.fontKey));
 assert.ok(new Set(it.glyphs.map(g=>g.fontKey)).size>1);
});

test('assignWorlds: deterministic; an amount of 0 means no world; fits and vertical rules hold', () => {
 assert.deepEqual(planFor(4),planFor(4));
 assert.ok(planFor(4,{worldAmount:0}).every(c=>!c.world&&c.worldP===null&&!c.worldExit));
 let withWorld=0,all=0;
 for(let seed=1;seed<=30;seed++){
  const cuts=planFor(seed,{worldAmount:1});
  cuts.forEach((c,i)=>{
   all++;const n=c.text.replace(/\s/g,'').length;
   if(c.gVertical)assert.equal(c.world,null);
   if(c.world){withWorld++;assert.ok(WORLD[c.world].fits(n),`${c.world} n=${n}`);assert.ok(!['marker','underline','box','hollow','extrude'].includes(c.treat));assert.ok(describeWorld(c));}
   const next=cuts[i+1],touching=!!next&&Math.abs(next.start-c.end)<=.06;
   assert.equal(c.worldExit,!!c.world&&!touching,`seed ${seed} ${c.id}`);
   if(i&&c.world&&cuts[i-1].world)assert.notEqual(c.world,cuts[i-1].world);
  });
 }
 assert.ok(withWorld/all>.7,`worlds used ${withWorld}/${all}`);
});

test('assignWorlds: every cut with a world still leaves a readable share of its time', () => {
 for(let seed=1;seed<=25;seed++)for(const c of planFor(seed,{worldAmount:1})){
  if(!c.world)continue;
  const it=itemFor(c),rs=readableShare(it);
  assert.ok(it.delay>=0&&it.D>0&&it.timing.inDur+it.timing.outDur<=.6*it.D+1e-9);
  assert.ok(rs>=.3,`seed ${seed} cut ${c.id} ${c.world} ${c.enter}/${c.exit} readable ${rs.toFixed(2)}`);
 }
});


test('字幕帯: a short lyric stays on one line at a readable size, and the band ends a little after the text (no long empty band)', () => {
 for(const text of ['ひとりでも 空はひらくから','紙は窓から飛んだ']){
  const cut=cutOf('telop',{text,runs:[{text}]}),it=itemFor(cut),F=it.worldFrame;
  assert.equal(new Set(it.glyphs.map(g=>g.line)).size,1,text+': one line');
  const right=F.box.cx-F.box.w/2+it.bbox.x1,box=WORLD.telop.box(cut.worldP,F,it,W,H),bandRight=box.cx+box.w/2;
  assert.ok(bandRight>right,text+': the band reaches past the text');
  assert.ok(bandRight-right<W*.1,text+`: the band ends soon after the text (${Math.round(bandRight-right)} px of empty band)`);
  assert.ok(box.w<F.bar.w,text+': shorter than the full-width band');
 }
});

test('抜き文字（knockout）: the plate covers the picture when in, is gone before it comes, and the plan gives it no glyph styling, no ghost and a heavy face', () => {
 const KO=Object.entries(WORLD).filter(([,d])=>d.knockout);
 assert.ok(KO.length>=4);
 const rec=()=>{const calls=[];return new Proxy({calls},{get(t,k){if(k in t)return t[k];return (...a)=>{calls.push(k);};},set(t,k,v){t[k]=v;return true;}});};
 for(const [k,d] of KO){
  assert.equal(typeof d.plate,'function',k);
  const P=d.plan(rng('ko:'+k));
  const env=(pIn,pOut)=>({W,H,lt:.5,pIn,pOut,cx:W/2,cy:H/2,fg:'#ffffff',accent:'#ff6fae',bg:'#14121f'});
  for(const mask of [true,false]){
   const before=rec();d.plate(before,env(0,0),P,{mask});assert.ok(!before.calls.some(c=>['fill','fillRect'].includes(c)),`${k}: drawn before it comes in`);
   const full=rec();d.plate(full,env(1,0),P,{mask});assert.ok(full.calls.some(c=>['fill','fillRect'].includes(c)),`${k}: nothing drawn when in`);
  }
 }
 let seen=0;
 for(let seed=1;seed<=60;seed++)for(const c of planFor(seed,{worldAmount:1})){
  if(!WORLD[c.world]?.knockout)continue;seen++;
  assert.equal(c.treat,'none');assert.equal(c.ghost||0,0);assert.ok(['gothic','dela','round'].includes(c.gFont),c.gFont);
 }
 assert.ok(seen>0,'no knockout in 60 plans');
});

test('抜き文字: a white or nearly white accent never becomes a white plate over the whole picture', () => {
 for(const accent of ['#ffffff','#fff2c2']){
  const c=new Proxy({},{get(t,k){if(k in t)return t[k];return ()=>{};},set(t,k,v){t[k]=v;return true;}});
  WORLD.knockout.plate(c,{W,H,lt:.5,pIn:1,pOut:0,cx:W/2,cy:H/2,fg:'#ffffff',accent,bg:'#14121f'},{fill:'accent',dir:0,edge:false},{mask:false});
  assert.notEqual(String(c.fillStyle).toLowerCase(),accent,`plate in ${accent}`);
 }
});
