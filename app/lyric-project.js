import {getTimings} from './lyric-timing.js?v=2';
import {cleanLyricDocument,importTimedLyrics} from './lyric-document.js?v=5';
import {assignLyricMotions} from './lyric-motion.js?v=28';
export function cleanLyricSettings(v={}){return {bpm:Number.isFinite(v?.bpm)?Math.max(30,Math.min(300,v.bpm)):98,phase:Number.isFinite(v?.phase)?v.phase:0}}
export function convertLegacyLyrics({slides=[],transitions=[],lyrics=[]}){const ids=new Set(lyrics.map(l=>l.id).filter(Boolean));const converted=slides.map(s=>{if(!s.lyric||!ids.has(s.lyric.lineId))return {...s};const {lyric,...rest}=s;return {...rest,img:lyric.img||null,name:s.name||lyric.text}});const tr=transitions.map((t,i)=>{const next=slides[i+1];return {...structuredClone(t),...(next?.lyric&&ids.has(next.lyric.lineId)&&t.shape==='text'&&t.text===next.lyric.text?{shape:'none'}:{})}});return {slides:converted,transitions:tr,document:assignLyricMotions(importTimedLyrics(lyrics,'legacy'),{style:'readable',seed:7})}}

// The full document preserves boundaries, emphasis and unset/provisional times.
// A lines projection remains available to older timing-file consumers.
export function lyricTimingFile(document,duration=12){const d=cleanLyricDocument(document);return JSON.stringify({version:1,lyricDocument:d,lines:getTimings(d,duration).events.map(e=>({s:e.start,e:e.end,t:e.raw,k:e.section}))},null,2)}
export function lyricTimingDocument(value){return cleanLyricDocument(value?.lyricDocument)}
// 字幕ファイル（SRT）: the lyric lines with their times in the song (seconds of the song, not of the video), one cue per line; a / in a line
// stays a line break. Lines without text are left out.
const srtTime=sec=>{const ms=Math.max(0,Math.round(sec*1000)),h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`};
export function lyricSrtFile(document,duration=12){const d=cleanLyricDocument(document);if(!d)return '';const cues=getTimings(d,duration).events.filter(e=>e.kind==='line'&&String(e.text).trim());return cues.map((e,i)=>`${i+1}\n${srtTime(e.start)} --> ${srtTime(Math.max(e.end,e.start+.05))}\n${String(e.text).trim()}\n`).join('\n')}
