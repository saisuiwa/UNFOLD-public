import test from'node:test';import assert from'node:assert/strict';import{existsSync}from'node:fs';import{parseLyrics}from'../../app/lyric-document.js';const u=new URL('../../app/lyric-motion.js',import.meta.url),m=existsSync(u)?await import(u):{};const make=()=>{assert.equal(typeof m.assignLyricMotions,'function','assignLyricMotions missing');return m.assignLyricMotions(parseLyrics('[Verse]\n声\n[Chorus]\n空へ'),{style:'pop',seed:7})};
test('seeded choices and fixed rows survive restyling',()=>{const d=make();assert.deepEqual(d,make());assert.ok(d.events[3].motion.size>d.events[1].motion.size);d.events[1].locked=true;const x=m.assignLyricMotions(d,{style:'soft',seed:9});assert.deepEqual(x.events[1].motion,d.events[1].motion)});
test('motion is seek deterministic and invisible outside its interval',()=>{const d=make(),e={...d.events[1],start:1,end:5};assert.equal(m.motionAt(e,.9,120).opacity,0);assert.equal(m.motionAt(e,5,120).opacity,0);assert.deepEqual(m.motionAt(e,2,120),m.motionAt(e,2,120));const frames=['float','slide','reveal','pop','emphasis'].map(p=>m.motionAt({...e,motion:{...e.motion,preset:p}},1.2,120));assert.equal(new Set(frames.map(f=>JSON.stringify(f))).size,5)});
test('long Japanese lyrics wrap inside the safe area and preserve graphemes',()=>{make();const text='か\u3099👨‍👩‍👧‍👦'+ '長い日本語の歌詞'.repeat(25);const layout=m.layoutText([{text,emphasis:false}],{width:720,height:1280,size:64,font:'sans',measure:(t,s)=>[...t].length*s});assert.ok(layout.bounds.width<=648);assert.ok(layout.bounds.height<=1152);assert.equal(layout.lines.flatMap(l=>l.runs.map(r=>r.text)).join(''),text);assert.ok(m.graphemes('か\u3099👨‍👩‍👧‍👦').length===2)});
test('missing per-line motion uses the readable default',()=>{assert.equal(m.cleanMotion(null).preset,'float');assert.ok(Number.isFinite(m.motionAt({start:0,end:2,motion:null},1).opacity));});
test('plain assignment (the sequence): every unlocked line is 一文字ずつ, no recipe, the chorus a little larger; locked and kept lines stay',()=>{
 const base=parseLyrics('[Verse]\n声\n[Chorus]\n空へ\n光');
 const plain=m.assignLyricMotions(base,{plain:true});
 const lines=plain.events.filter(e=>e.kind==='line');
 assert.ok(lines.length>=3);
 for(const e of lines){assert.equal(e.motion.preset,'reveal');assert.equal(e.motion.recipe,undefined);assert.equal(e.motion.code,undefined)}
 assert.ok(lines.find(e=>e.section==='chorus').motion.size>lines.find(e=>e.section!=='chorus').motion.size);
 const picked=m.assignLyricMotions(base,{style:'pop',seed:7});   // the old automatic choice: recipes
 assert.ok(picked.events.filter(e=>e.kind==='line').every(e=>e.motion.recipe));
 const locked=structuredClone(picked);locked.events.find(e=>e.kind==='line').locked=true;
 const again=m.assignLyricMotions(locked,{plain:true});
 assert.deepEqual(again.events.find(e=>e.kind==='line').motion,locked.events.find(e=>e.kind==='line').motion,'a locked line keeps its motion');
 const kept=m.assignLyricMotions(picked,{plain:true,preserveExisting:true});
 assert.deepEqual(kept.events.filter(e=>e.kind==='line').map(e=>e.motion),picked.events.filter(e=>e.kind==='line').map(e=>e.motion),'existing motions are kept when asked');
});
test('plainLyricView (what the sequence plays): reveal without a recipe; code motions and locked lines as they are; the document itself untouched',()=>{
 const picked=m.assignLyricMotions(parseLyrics('[Verse]\n声\n[Chorus]\n空へ\n光'),{style:'pop',seed:7});
 picked.events.filter(e=>e.kind==='line')[1].locked=true;
 const third=picked.events.filter(e=>e.kind==='line')[2];third.motion={...third.motion,code:{version:1,runtime:'text-motion',source:'return {update(){}}'}};
 const before=structuredClone(picked),view=m.plainLyricView(picked);
 assert.deepEqual(picked,before,'the document is not changed');
 const lines=view.events.filter(e=>e.kind==='line'),src=picked.events.filter(e=>e.kind==='line');
 assert.equal(lines[0].motion.preset,'reveal');assert.equal(lines[0].motion.recipe,undefined);
 assert.equal(lines[0].motion.font,src[0].motion.font,'the font stays');assert.equal(lines[0].motion.size,src[0].motion.size,'the size stays');
 assert.deepEqual(lines[1].motion,src[1].motion,'a locked line is shown as it is');
 assert.deepEqual(lines[2].motion,src[2].motion,'a code motion chosen on purpose is shown as it is');
 assert.equal(m.plainLyricView(picked),view,'the same view for the same document');
 const none={...picked,events:picked.events.map(e=>e.kind==='line'?{...e,locked:false,motion:undefined}:e)};
 assert.ok(m.plainLyricView(none).events.filter(e=>e.kind==='line').every(e=>e.motion.preset==='reveal'),'a line without a motion is 一文字ずつ too (not ふわっと)');
 const already=m.assignLyricMotions(parseLyrics('声\n空'),{plain:true});
 assert.equal(m.plainLyricView(already),already,'nothing to change: the same object');
 assert.equal(m.plainLyricView(null),null);
});
