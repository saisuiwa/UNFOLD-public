import test from 'node:test';
import assert from 'node:assert/strict';
import {importTimedLyrics} from '../../app/lyric-document.js';
import {getTimings,trimLyric,lyricPreviewTime} from '../../app/lyric-timing.js';
const doc=()=>importTimedLyrics([{s:2,t:'first'},{s:8,t:'second'}]);
test('preview skips a blank intro, restarts current line and wraps after last line',()=>{
 const d=doc();assert.equal(lyricPreviewTime(d,0,20),2);assert.equal(lyricPreviewTime(d,5,20),2);assert.equal(lyricPreviewTime(d,19,20),2);
 assert.equal(lyricPreviewTime(importTimedLyrics([]),0,20),null);
 assert.equal(lyricPreviewTime(d,0,20,10,10),10);
});
test('trim right shortens and lengthens without changing its start or next lyric',()=>{
 const d=doc(),id=d.events[0].id;
 const short=trimLyric(d,id,'end',-2,20);assert.equal(short.events[0].s,2);assert.equal(short.events[0].e,6);
 const long=trimLyric(short,id,'end',1,20);assert.equal(long.events[0].e,7);assert.equal(long.events[1].s,8);assert.equal(d.events[0].e,null);
 assert.equal(trimLyric(d,id,'end',100,20).events[0].e,8);
});
test('trim left keeps the end fixed and clamps crossed handles',()=>{
 const d=doc(),id=d.events[0].id;
 assert.equal(trimLyric(d,id,'start',2,20).events[0].s,4);
 assert.equal(trimLyric(d,id,'start',2,20).events[0].e,8);
 assert.equal(trimLyric(d,id,'start',-50,20).events[0].s,0);
 const clipped=trimLyric(d,id,'end',-50,20);assert.ok(clipped.events[0].e>2);
});
test('provisional timing is materialized and explicit duration can exceed maxHold',()=>{
 const d=doc();d.events[0].s=null;d.events[1].s=15;
 const t=getTimings(d,20).events[0];const result=trimLyric(d,t.id,'end',5,20);
 assert.equal(result.events[0].s,t.start);assert.equal(getTimings(result,20).events[0].end,11);
 assert.equal(result.events[0].timingSource,'manual');
});
test('trimming a provisional first lyric keeps the following lyric in place',()=>{
 const d=doc();for(const e of d.events)e.s=null;
 const before=getTimings(d,12).events;
 const result=trimLyric(d,before[0].id,'start',1,12);
 assert.equal(getTimings(result,12).events[1].start,before[1].start);
});
