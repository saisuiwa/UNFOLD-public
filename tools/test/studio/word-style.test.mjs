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

test('an outline colour: set with the outline, kept by recolouring, changed without toggling, removed with the outline', () => {
 const l=lyric([{id:'a',text:'あいうえ'}]);
 const red=restyleRuns(l,1,3,'outline',{color:'#FF0000'});
 assert.deepEqual(red.map(r=>[r.text,!!r.outline,r.outlineColor||null]),[['あ',false,null],['いう',true,'#ff0000'],['え',false,null]]);
 // recolouring the text of another word keeps the outline colour
 const re=recolorRuns(lyric(red),0,1,'#4dd2ff');
 assert.deepEqual(re.filter(r=>r.outline).map(r=>[r.text,r.outlineColor]),[['いう','#ff0000']]);
 // the same characters with another colour: stays on (force), colour changes, runs merge
 const blue=restyleRuns(lyric(red),1,3,'outline',{color:'#0000ff',force:true});
 assert.deepEqual(blue.filter(r=>r.outline).map(r=>[r.text,r.outlineColor]),[['いう','#0000ff']]);
 // without force the same button switches it off, and the colour goes with it
 const off=restyleRuns(lyric(red),1,3,'outline',{color:'#0000ff'});
 assert.deepEqual(off.map(r=>[r.text,!!r.outline,r.outlineColor||null]),[['あいうえ',false,null]]);
 // an invalid colour is ignored (automatic)
 assert.equal(restyleRuns(l,0,2,'outline',{color:'red'}).find(r=>r.outline).outlineColor,undefined);
 // hollow has no outline colour
 assert.equal(restyleRuns(lyric(red),1,3,'hollow').find(r=>r.hollow).outlineColor,undefined);
 // the resolver hands the colour to the worker
 const resolve=createMotionColorResolver({text:'あいうえ',runs:red,color:'#ffffff',accent:'#ffcc00'});
 resolve('あいうえ');assert.deepEqual(resolve.marks,[{from:1,to:3,outline:true,hollow:false,outlineColor:'#ff0000'}]);
});

test('an outline width (% of the font size): set, kept when only the colour changes, kept by recolouring, changed alone, removed with the outline', () => {
 const l=lyric([{id:'a',text:'あいうえ'}]);
 const wide=restyleRuns(l,1,3,'outline',{width:12});
 assert.deepEqual(wide.filter(r=>r.outline).map(r=>[r.text,r.outlineWidth,r.outlineColor]),[['いう',12,undefined]]);
 // only the colour changes (force, width not given): the width stays
 const colored=restyleRuns(lyric(wide),1,3,'outline',{color:'#ff0000',force:true});
 assert.deepEqual(colored.filter(r=>r.outline).map(r=>[r.outlineWidth,r.outlineColor]),[[12,'#ff0000']]);
 // only the width changes: the colour stays
 const thin=restyleRuns(lyric(colored),1,3,'outline',{width:3.5,force:true});
 assert.deepEqual(thin.filter(r=>r.outline).map(r=>[r.outlineWidth,r.outlineColor]),[[3.5,'#ff0000']]);
 // automatic colour is an explicit null
 const auto=restyleRuns(lyric(thin),1,3,'outline',{color:null,force:true});
 assert.deepEqual(auto.filter(r=>r.outline).map(r=>[r.outlineWidth,r.outlineColor]),[[3.5,undefined]]);
 // recolouring the text keeps the width; out-of-range widths are ignored (default)
 assert.equal(recolorRuns(lyric(thin),0,1,'#4dd2ff').find(r=>r.outline).outlineWidth,3.5);
 assert.equal(restyleRuns(l,0,1,'outline',{width:40}).find(r=>r.outline).outlineWidth,undefined);
 // the outline off takes the width with it; hollow has none
 assert.equal(restyleRuns(lyric(thin),1,3,'outline').some(r=>r.outline||r.outlineWidth),false);
 assert.equal(restyleRuns(lyric(thin),1,3,'hollow').find(r=>r.hollow).outlineWidth,undefined);
 // the worker is told
 const resolve=createMotionColorResolver({text:'あいうえ',runs:thin,color:'#ffffff',accent:'#ffcc00'});
 resolve('あいうえ');assert.deepEqual(resolve.marks,[{from:1,to:3,outline:true,hollow:false,outlineColor:'#ff0000',outlineWidth:3.5}]);
});

// ---- 語ごとの大きさ (a run's `scale`) -------------------------------------------------------------------------------------------------------
test('word sizes (scale) survive a colour change, 縁取り / 中抜き and colorLyricRuns; the resolver hands them to the worker as ranges of the mesh text', () => {
 const l=lyric([{id:'a',text:'私',scale:1.5},{id:'b',text:'は',scale:.7},{id:'c',text:'元気',scale:1.5,emphasis:true},{id:'d',text:'です',scale:.7}]);
 const colored=recolorRuns(l,0,1,'#00ff00');
 assert.equal(text(colored),'私は元気です');
 assert.deepEqual(colored.map(r=>[r.text,r.scale]),[['私',1.5],['は',.7],['元気',1.5],['です',.7]]);
 const outlined=restyleRuns(lyric(colored),2,4,'outline');
 assert.deepEqual(outlined.map(r=>[r.text,r.scale,!!r.outline]),[['私',1.5,false],['は',.7,false],['元気',1.5,true],['です',.7,false]]);
 const again=colorLyricRuns([{text:'私は',scale:1.5},{text:'元気',scale:.7}],[]);
 assert.deepEqual(again.map(r=>[r.text,r.scale]),[['私は',1.5],['元気',.7]]);
 // a scale of 1 is the same as none, and it is not stored
 assert.equal('scale' in restyleRuns(lyric([{id:'a',text:'あい',scale:1}]),0,1,'outline')[0],false);
 const resolve=createMotionColorResolver({text:'私は元気です',runs:l.runs,color:'#ffffff',accent:'#ff0000'});
 resolve('私は元気です',{});
 assert.deepEqual(resolve.sizes,[{from:0,to:1,scale:1.5},{from:1,to:2,scale:.7},{from:2,to:4,scale:1.5},{from:4,to:6,scale:.7}]);
 resolve('元気',{textStart:2});
 assert.deepEqual(resolve.sizes,[{from:0,to:2,scale:1.5}]);
});
