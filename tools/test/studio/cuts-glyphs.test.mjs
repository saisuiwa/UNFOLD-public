import test from 'node:test';
import assert from 'node:assert/strict';
import {ENTER,HOLD,EXIT,TREAT,layoutText,buildItem,stateAt,readableAt,readableShare,renderText,timingsOf} from '../../../app/studio/cuts/glyphs.js';
import {assignParts,assignGlyphParts,GLYPH_FONTS} from '../../../app/studio/cuts/plan.js';
import {placeItem} from '../../../app/studio/cuts/items.js';
import {parseLines,DEFAULT_LINES_TEXT,planProject,describeGlyphParts,glyphChoices} from './cuts-helpers.mjs';
import {wordPieces} from '../../../app/studio/word-size.js';
import {rng} from '../../../app/studio/omakase.js';

const W=960,H=540;
const measure=(ch,font,px)=>/[\x00-\x7f]/.test(ch)?px*.55:px;
const stub=()=>{const f=function(){};const p=new Proxy(f,{get:(t,k)=>k===Symbol.toPrimitive?()=>0:k==='canvas'?{width:W,height:H}:p,set:()=>true,apply:()=>p});return p;};
const cutOf=(over={})=>({text:'折り目が光に変わっていく',runs:[{text:'折り目が光に変わっていく'}],start:0,end:1.2,color:'#ffffff',emphasisColor:'#ffb347',bg:'#14121f',fontScale:.12,seed:7,
 enter:'cut',enterP:{},hold:'still',holdP:{},exit:'cut',exitP:{},treat:'none',treatP:{},gFont:'gothic',gVertical:false,...over});
const item=(over,text)=>{const c=cutOf({...(text?{text,runs:[{text}]}:{}),...over});return buildItem(c,{W,H,measure,pieces:wordPieces(c.text)});};
const planFor=(seed,o={})=>{const {lines}=parseLines(DEFAULT_LINES_TEXT);return assignGlyphParts(assignParts(planProject(lines,{seed}),{seed,...(o.parts||{})}),{seed,...(o.glyph||{})});};

test('layoutText keeps every character, in order, inside the picture, and never starts a line with 、。 or ー', () => {
 for(const text of ['夜明け','折り目が光に変わっていく','小さな、紙が風に飛んだ。','ほら、もう一回ひろげよう','紙の翼でどこまでも','LOVE is ひかり','一二三四五六七八九十一二三四五六七八九十一二三四五六']){
  const c=cutOf({text,runs:[{text}]}),lay=layoutText({text,runs:c.runs,pieces:wordPieces(text),W,H,size:H*.12,font:'gothic',measure});
  assert.equal(lay.glyphs.map(g=>g.ch).join(''),text.replace(/\s/g,''));
  for(const g of lay.glyphs){assert.ok(g.cx-g.w/2>=W*.02&&g.cx+g.w/2<=W*.98,`${text} x ${g.cx}`);assert.ok(g.cy-g.size/2>=H*.03&&g.cy+g.size/2<=H*.97,`${text} y ${g.cy}`);}
  const byLine=new Map();for(const g of lay.glyphs){if(!byLine.has(g.line))byLine.set(g.line,[]);byLine.get(g.line).push(g);}
  for(const [li,gs] of byLine)if(li>0)assert.ok(!'、。ー'.includes(gs[0].ch),`${text} line ${li} starts with ${gs[0].ch}`);
  assert.ok(lay.bbox.x1>lay.bbox.x0&&lay.bbox.y1>lay.bbox.y0);
 }
});

test('layoutText: vertical reads top-to-bottom, columns right-to-left; word sizes (runs) change glyph sizes', () => {
 const text='小さな紙が',lay=layoutText({text,runs:[{text}],W,H,size:H*.12,font:'gothic',measure,vertical:true});
 assert.equal(lay.glyphs.length,5);
 assert.ok(lay.glyphs.every((g,i)=>i===0||g.cy>lay.glyphs[i-1].cy));
 const two=layoutText({text:'あいうえおかきくけこさ',runs:[{text:'あいうえおかきくけこさ'}],W,H,size:H*.1,font:'gothic',measure,vertical:true});
 const cols=[...new Set(two.glyphs.map(g=>g.cx))];assert.equal(cols.length,2);assert.ok(two.glyphs[0].cx>two.glyphs.at(-1).cx);
 const big=layoutText({text:'私は元気',runs:[{text:'私',scale:1.6},{text:'は',scale:.6},{text:'元気',scale:1.2}],W,H,size:H*.1,font:'gothic',measure});
 assert.ok(big.glyphs[0].size>big.glyphs[1].size*2);
});

test('every part is named, tagged, and has a plan that is deterministic', () => {
 for(const [name,reg] of Object.entries({ENTER,HOLD,EXIT,TREAT}))for(const [k,d] of Object.entries(reg)){
  assert.equal(typeof d.name,'string',`${name}.${k}`);assert.ok(d.tags.length>0);assert.ok((d.w??1)>0);
  if(d.plan){const a=d.plan(()=>.37),b=d.plan(()=>.37);assert.deepEqual(a,b);assert.deepEqual(JSON.parse(JSON.stringify(a)),a);}
 }
 assert.ok(Object.keys(ENTER).length>=14&&Object.keys(HOLD).length>=9&&Object.keys(EXIT).length>=10&&Object.keys(TREAT).length>=11);
});

// it.split: 斜めの切れ目（上下を切り分けてずらす）。ずれが残っていれば、まだ元の形ではない
const splitAway=(x,size)=>!!(x.split&&(x.split.n>size*.05||x.split.t>size*.05||x.split.dy>size*.05));
const near=(it,s,lim=.14)=>{const {glyphs,it:x}=stateAt(it,s);return !splitAway(x,it.size)&&glyphs.every(g=>!g.hide&&g.ch==null&&!g.reel&&g.a>=.85&&Math.abs(g.dx)<it.size*lim&&Math.abs(g.dy)<it.size*lim&&g.sx>.85&&g.sx<1.2&&g.sy>.85&&g.sy<1.2&&Math.abs(g.rot)<10&&(g.blur||0)<it.size*.05);};
test('enters start away from rest (except cut) and land on rest; exits start at rest', () => {
 for(const [k,d] of Object.entries(ENTER)){
  const P=d.plan?d.plan(()=>.5):{},it=item({enter:k,enterP:P});
  const inD=it.timing.inDur;
  if(k==='cut'){assert.equal(inD,0);continue;}
  assert.ok(inD>0&&inD<=.6*it.D,k);
  const start=stateAt(it,0),s0=start.glyphs.some(g=>g.hide||g.ch!=null||g.reel||g.a<.5||Math.abs(g.dx)>1||Math.abs(g.dy)>1||g.sx!==1||g.sy!==1||g.rot!==0)||start.it.clip||splitAway(start.it,it.size)||start.it.blur>0||start.it.sx!==1||start.it.a<1;
  assert.ok(s0,`${k} does not start away from rest`);
  assert.ok(near(it,inD*.999),`${k} does not land on rest`);
  for(let t=0;t<=it.D;t+=.02){const {glyphs,it:x}=stateAt(it,t);for(const g of glyphs)for(const v of [g.dx,g.dy,g.sx,g.sy,g.rot,g.a])assert.ok(Number.isFinite(v),`${k} NaN`);assert.ok(Number.isFinite(x.blur));}
 }
 for(const [k,d] of Object.entries(EXIT)){
  const it=item({exit:k,exitP:d.plan?d.plan(()=>.5):{}}),outD=it.timing.outDur;
  if(k==='cut'){assert.equal(outD,0);continue;}
  assert.ok(outD>0&&outD<=.6*it.D,k);
  assert.ok(near(it,it.D-outD-.001),`${k} is not at rest before it starts`);
  const end=stateAt(it,it.D-1e-4),gone=end.glyphs.every(g=>g.a<.45||g.hide||g.sx<.2||g.sy<.2||Math.abs(g.dy)>it.size*.6||Math.abs(g.dx)>it.size*.6)||end.it.a<.5||end.it.sy<.1||end.it.sx>2||!!(end.it.clip&&(end.it.clip.x0>=it.bbox.x1||end.it.clip.x1<=it.bbox.x0));
  assert.ok(gone,`${k} does not clear the text by the end`);
 }
});

test('holds stay small (readable) and keep moving', () => {
 for(const [k,d] of Object.entries(HOLD)){
  const it=item({hold:k,holdP:d.plan?d.plan(()=>.8):{}});
  let moved=false;
  for(let t=.4;t<1.2;t+=.011){
   const {glyphs,it:x}=stateAt(it,t);
   for(const g of glyphs){assert.ok((g.blur||0)<=it.size*.08+1e-9,`${k} glyph blur`);assert.ok(Math.abs(g.dx)<=it.size*.2&&Math.abs(g.dy)<=it.size*.2,`${k} shift`);assert.ok(Math.abs(g.rot)<=6,`${k} rot`);assert.ok(g.sx>.9&&g.sx<1.1&&g.sy>.9&&g.sy<1.1,`${k} scale`);if(g.dx||g.dy||g.rot||g.blur)moved=true;}
   assert.ok(x.sx>.95&&x.sx<1.05);assert.ok(x.blur<=it.size*.06+1e-9,`${k} item blur`);if(x.sx!==1||x.blur>0)moved=true;
  }
  assert.equal(moved,k!=='still',k);
 }
});

test('timings: enter + exit never take more than 60% of the cut; the rest is readable', () => {
 for(const D of [.5,.62,.8,1,1.3,2.6])for(const e of Object.keys(ENTER))for(const x of Object.keys(EXIT)){
  const {inDur,outDur}=timingsOf(D,e,x,8,{},{});
  assert.ok(inDur+outDur<=.6*D+1e-9,`${D} ${e} ${x}`);
  const it=item({enter:e,exit:x,end:D,enterP:ENTER[e].plan?.(()=>.5)||{},exitP:EXIT[x].plan?.(()=>.5)||{}});
  assert.ok(readableShare(it)>=.3,`${D}s ${e}+${x}: readable ${readableShare(it).toFixed(2)}`);
 }
});

test('rendering runs for every part at many times (no exception, blur layer used when needed)', () => {
 let layers=0;const layer=()=>{layers++;return stub();};
 for(const e of Object.keys(ENTER))for(const x of ['cut','fade','zoomPast','wipeOut','blurOut','collapse'])for(const tr of Object.keys(TREAT)){
  const it=item({enter:e,exit:x,treat:tr,hold:'wave',enterP:ENTER[e].plan?.(()=>.5)||{},exitP:EXIT[x].plan?.(()=>.5)||{},treatP:{}});
  for(const t of [0,.05,.2,.6,1.0,1.19])assert.doesNotThrow(()=>renderText(stub(),it,t,{layer}),`${e} ${x} ${tr} ${t}`);
 }
 assert.ok(layers>0);
});

test('assignGlyphParts: deterministic; valid keys; compat rules hold over many seeds', () => {
 assert.deepEqual(planFor(5),planFor(5));
 for(let seed=1;seed<=30;seed++){
  const cuts=planFor(seed);
  cuts.forEach((c,i)=>{
   assert.ok(ENTER[c.enter]&&HOLD[c.hold]&&EXIT[c.exit]&&TREAT[c.treat]);
   assert.ok(GLYPH_FONTS.includes(c.gFont));
   const n=c.text.replace(/\s/g,'').length,D=c.end-c.start;
   if(c.enter==='type')assert.ok(n<=14&&D>=.7*0,`type ${n} chars`);
   if(c.gVertical){assert.ok(n<=6);assert.ok(!['marker','underline','box'].includes(c.treat));}
   const next=cuts[i+1];
   if(next&&Math.abs(next.start-c.end)<=.06&&next.trans)assert.equal(c.exit,'cut',`seed ${seed} cut ${c.id} must not fade before a transition`);
   if(i&&c.gFont)assert.notEqual(c.gFont,cuts[i-1].gFont);
   const it=buildItem(c,{W,H,measure,pieces:wordPieces(c.text)});
   assert.ok(it.timing.inDur+it.timing.outDur<=.6*D+1e-9);
   assert.ok(readableShare(it)>=.3,`seed ${seed} cut ${c.id} ${c.enter}/${c.exit} readable ${readableShare(it).toFixed(2)}`);
   assert.ok(describeGlyphParts(c).enter);
  });
 }
});

test('assignGlyphParts: short cuts avoid slow enters; the font mode is respected', () => {
 let shortSlow=0,short=0;
 for(let seed=1;seed<=60;seed++)for(const c of planFor(seed,{glyph:{}})){const D=c.end-c.start;if(D<.7){short++;if(['scatter','wipe'].includes(c.enter))shortSlow++;}}
 assert.ok(short>20);assert.ok(shortSlow/short<.15,`slow enters on short cuts ${shortSlow}/${short}`);
 const {lines}=parseLines(DEFAULT_LINES_TEXT),base=assignParts(planProject(lines,{seed:3}),{seed:3});
 const cuts=assignGlyphParts(base,{seed:3,fontMode:'same'});
 assert.ok(cuts.every(c=>c.gFont===null));
 assert.equal(glyphChoices('enter').length,Object.keys(ENTER).length);
});

test('placeItem: the text, as actually laid out, stays inside the picture after it is moved / tilted / scaled', () => {
 for(let seed=1;seed<=40;seed++)for(const c of planFor(seed)){
  const it=buildItem(c,{W,H,measure,pieces:wordPieces(c.text)}),p=placeItem(it,c);
  // 文字の外接矩形の4隅を、置き場所の変形（中心基準の拡大・回転・移動）に通す
  const a=p.rotation*Math.PI/180,cs=Math.cos(a),sn=Math.sin(a);
  for(const [x,y] of [[it.bbox.x0,it.bbox.y0],[it.bbox.x1,it.bbox.y0],[it.bbox.x0,it.bbox.y1],[it.bbox.x1,it.bbox.y1]]){
   const dx=(x-W/2)*p.scale,dy=(y-H/2)*p.scale,X=W*p.x+dx*cs-dy*sn,Y=H*p.y+dx*sn+dy*cs;
   assert.ok(X>=-2&&X<=W+2&&Y>=-2&&Y<=H+2,`seed ${seed} cut ${c.id} (${p.x},${p.y}) corner ${X.toFixed(0)},${Y.toFixed(0)}`);
  }
 }
});

test('assignGlyphParts: 中抜き is not used for long or small text', () => {
 let bad=0,n=0;
 for(let seed=1;seed<=60;seed++)for(const c of planFor(seed)){if(c.treat==='hollow'){n++;if(c.text.replace(/\s/g,'').length>8||c.fontScale<.14)bad++;}}
 assert.ok(n>0);assert.ok(bad/n<.2,`hollow on long/small text ${bad}/${n}`);
});

test('assignGlyphParts: a recap cut (the whole line, to be read) is never made 〈ぼけた字〉', () => {
 let recaps=0,soft=0;
 for(let seed=1;seed<=80;seed++)for(const c of planFor(seed,{glyph:{treatAmount:1}})){if(c.recap){recaps++;if(c.treat==='soft')soft++;}}
 assert.ok(recaps>40,`recaps ${recaps}`);assert.equal(soft,0);
});

test('字の置き換え: the scramble / reel / mask entrances draw other characters first and the real ones at the end; ときどき化ける swaps one letter at a time at most', () => {
 for(const k of ['scramble','slotReel','maskReveal']){
  const it=item({enter:k,enterP:ENTER[k].plan(rng('sw:'+k))},'光を見つけた');
  const start=stateAt(it,.01).glyphs;assert.ok(start.every(g=>g.ch!=null||g.reel),`${k}: not every letter starts as another character`);
  assert.ok(start.every(g=>g.ch==null||g.ch.length===1),`${k}: one character per letter`);
  const end=stateAt(it,it.timing.inDur*.999).glyphs;assert.ok(end.every(g=>g.ch==null&&!g.reel),`${k}: not every letter is real by the end`);
 }
 const it=item({hold:'glyphSwap',holdP:HOLD.glyphSwap.plan(rng('gs'))},'光を見つけた');let swapped=0;
 for(let t=.4;t<it.D-.3;t+=.01){const n=stateAt(it,t).glyphs.filter(g=>g.ch!=null).length;assert.ok(n<=1,`${n} letters swapped at ${t}`);if(n)swapped++;}
 assert.ok(swapped>0,'never swapped');
});

test('マスクの中から: the mask entrances and exit clip each letter to its own cell while they move, and leave the letters as they are at rest', () => {
 for(const k of ['maskRise','maskSlideX']){
  const it=item({enter:k,enterP:ENTER[k].plan(rng('mk:'+k))},'光を見つけた');
  assert.ok(stateAt(it,it.timing.inDur*.2).glyphs.some(g=>g.cell),`${k}: no letter is clipped while it enters`);
  assert.ok(stateAt(it,it.timing.inDur*.999).glyphs.every(g=>!g.cell),`${k}: a letter is still clipped at rest`);
 }
 const it=item({exit:'maskExitUp',exitP:EXIT.maskExitUp.plan(rng('mx'))},'光を見つけた');
 assert.ok(stateAt(it,it.D-it.timing.outDur-.01).glyphs.every(g=>!g.cell));
 assert.ok(stateAt(it,it.D-1e-4).glyphs.every(g=>g.cell&&g.dy<-it.size));
});
