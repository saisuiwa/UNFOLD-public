// An .srt subtitle file (what an outside "MP3 -> SRT" site makes) loads in the sequence's 「05 曲・歌詞」 tab like an .lrc:
// timed lines with the start and end seconds, a multi-line cue becomes one phrase with a line break, and a file with no cue says why.
import assert from 'node:assert/strict';
import {startStaticServer} from '../lib/static-server.mjs';
import {launchBrowser} from '../lib/browser.mjs';
const server=await startStaticServer(),browser=await launchBrowser();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),problems=[];
 page.on('pageerror',e=>problems.push(String(e).slice(0,200)));
 await page.goto(server.url+'/sequence.html?empty',{waitUntil:'load'});await page.waitForFunction(()=>window.unfoldSeq,null,{timeout:60000});
 await page.locator('.tabs [data-tab="lyric"]').click();
 // the picker offers .srt and says so
 const picker=page.locator('#pane-lyric input[type=file][accept*=".srt"]');
 assert.equal(await picker.count(),1,'one lyric-file picker accepts .srt');
 assert.match(await picker.evaluate(i=>i.accept),/\.lrc/);
 assert.match(await picker.evaluate(i=>i.parentElement.textContent),/SRT/,'the label mentions SRT');
 // BOM + CRLF + Japanese + a two-line cue + a <i> tag, as a browser Whisper tool writes it
 const srt='﻿'+['1','00:00:01,500 --> 00:00:04,200','いちまいの えを ここにおいて','','2','00:00:05,000 --> 00:00:08,250','ぐしゃっと <i>くずれて</i>','ほどけだす','','3','00:01:02,040 --> 00:01:05,000','こなごなの いろが ふりそそぐ',''].join('\r\n');
 await picker.setInputFiles({name:'うた.srt',mimeType:'application/x-subrip',buffer:Buffer.from(srt,'utf8')});
 await page.waitForFunction(()=>unfoldSeq.seq.lyricDocument?.events.filter(e=>e.kind==='line').length===3,null,{timeout:15000});
 const lines=await page.evaluate(()=>unfoldSeq.seq.lyricDocument.events.filter(e=>e.kind==='line').map(e=>({raw:e.raw,text:e.text,s:e.s,e:e.e,src:e.timingSource})));
 assert.deepEqual(lines.map(l=>[l.s,l.e,l.src]),[[1.5,4.2,'file'],[5,8.25,'file'],[62.04,65,'file']],'start and end seconds from the cues');
 assert.deepEqual(lines.map(l=>l.raw),['いちまいの えを ここにおいて','ぐしゃっと くずれて/ほどけだす','こなごなの いろが ふりそそぐ'],'the two-line cue is one phrase broken at "/"; the tag is gone');
 assert.equal(await page.locator('.lm-event').count(),3,'three rows in the lyric list');
 // a file with no cue is refused with a reason, and the lyrics stay
 await picker.setInputFiles({name:'から.srt',mimeType:'application/x-subrip',buffer:Buffer.from('ただの文字\n','utf8')});
 await page.locator('.lm-status').filter({hasText:'SRT'}).first().waitFor({timeout:10000});
 assert.equal(await page.evaluate(()=>unfoldSeq.seq.lyricDocument.events.filter(e=>e.kind==='line').length),3,'the lyrics did not change');
 // .lrc still loads the same way
 await picker.setInputFiles({name:'a.lrc',mimeType:'text/plain',buffer:Buffer.from('[00:02.00]あ\n[00:04.00]い\n','utf8')});
 await page.waitForFunction(()=>unfoldSeq.seq.lyricDocument?.events.filter(e=>e.kind==='line').length===2,null,{timeout:15000});
 assert.deepEqual(problems,[]);
 console.log('PASS sequence lyric import: .srt gives timed lines (start, end, "/" break), a cue-less .srt is refused, .lrc still works');
}finally{await browser.close();await server.close();}
