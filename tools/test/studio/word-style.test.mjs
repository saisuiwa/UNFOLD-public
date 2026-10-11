import test from 'node:test';
import assert from 'node:assert/strict';
import {restyleRuns,recolorRuns} from '../../../app/studio/lyric-edit.js';
import {colorLyricRuns} from '../../../app/lyric-style.js';
import {createMotionColorResolver} from '../../../app/code-motion-colors.js';

const lyric=runs=>({id:'L',text:runs.map(r=>r.text).join(''),runs});
const text=runs=>runs.map(r=>r.text).join('');

test('restyleRuns: 縁取り on the chosen characters only, ids and text kept, toggles off when every chosen character has it', () => {
 const l=lyric([{id:'a',text:'ひかりを',emphasis:false},{id:'b',text:'つなぐ',emphasis:true}]);
 const on=restyleRuns(l,2,5,'outline');   // り を つ
 assert.equal(text(on),'ひかりをつなぐ');
 assert.deepEqual(on.map(r=>[r.text,!!r.outline,!!r.hollow,r.emphasis]),[['ひか',false,false,false],['りを',true,false,false],['つ',true,false,true],['なぐ',false,false,true]]);
 assert.deepEqual(on.flatMap(r=>r.glyphIds),['a:0','a:1','a:2','a:3','b:0','b:1','b:2'],'the grapheme ids stay');
 // the same characters again: switched off, and the runs merge back
 const off=restyleRuns(lyric(on),2,5,'outline');
 assert.deepEqual(off.map(r=>[r.text,!!r.outline,r.emphasis]),[['ひかりを',false,false],['つなぐ',false,true]]);
});

test('restyleRuns: 縁取り and 中抜き exclude each other; null removes both; colours are kept', () => {
 let l=lyric([{id:'a',text:'あいうえ',color:'#ff4d4d'}]);
 const hollow=restyleRuns(l,1,3,'hollow');
 assert.deepEqual(hollow.map(r=>[r.text,!!r.hollow,r.color]),[['あ',false,'#ff4d4d'],['いう',true,'#ff4d4d'],['え',false,'#ff4d4d']]);
 const outlined=restyleRuns(lyric(hollow),1,3,'outline');
 assert.deepEqual(outlined.map(r=>[r.text,!!r.outline,!!r.hollow]),[['あ',false,false],['いう',true,false],['え',false,false]],'outline replaces hollow');
 const none=restyleRuns(lyric(outlined),0,4,null);
 assert.deepEqual(none.map(r=>[r.text,!!r.outline,!!r.hollow,r.color]),[['あいうえ',false,false,'#ff4d4d']]);
 assert.throws(()=>restyleRuns(l,5,9,'outline'),/言葉を先に選んで/);
});

test('recolouring a word keeps the decorations of the others', () => {
 const l=lyric([{id:'a',text:'あい',outline:true},{id:'b',text:'うえ',hollow:true}]);
 const next=recolorRuns(l,0,1,'#4dd2ff');
 assert.equal(text(next),'あいうえ');
 const flags=next.flatMap(r=>[...r.text].map(()=>[!!r.outline,!!r.hollow,r.color||null]));
 assert.deepEqual(flags,[[true,false,'#4dd2ff'],[true,false,null],[false,true,null],[false,true,null]]);
 const merged=colorLyricRuns([{text:'ab',outline:true},{text:'cd',outline:true},{text:'ef'}],[]);
 assert.deepEqual(merged.map(r=>[r.text,!!r.outline]),[['abcd',true],['ef',false]]);
});

test('the colour resolver reports the decorated ranges of each mesh text', () => {
 const runs=[{text:'ひかり'},{text:'を',outline:true},{text:'つなぐ',hollow:true,color:'#4dd2ff'}];
 const resolve=createMotionColorResolver({text:'ひかりをつなぐ',runs,color:'#ffffff',accent:'#ffcc00'});
 resolve('ひかりをつなぐ');
 assert.deepEqual(resolve.marks,[{from:3,to:4,outline:true,hollow:false},{from:4,to:7,outline:false,hollow:true}]);
 // a word of its own mesh: ranges are relative to that mesh
 const parts=createMotionColorResolver({text:'ひかりをつなぐ',runs,color:'#ffffff',accent:'#ffcc00'});
 parts('ひかりを');assert.deepEqual(parts.marks,[{from:3,to:4,outline:true,hollow:false}]);
 parts('つなぐ');assert.deepEqual(parts.marks,[{from:0,to:3,outline:false,hollow:true}]);
 parts('ひかり');assert.deepEqual(parts.marks,[],'no decoration in a plain mesh');
});
