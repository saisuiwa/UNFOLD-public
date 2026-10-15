import {getTimings} from './lyric-timing.js?v=2';
import {cleanLyricDocument,importTimedLyrics} from './lyric-document.js?v=4';
import {assignLyricMotions} from './lyric-motion.js?v=28';
export function cleanLyricSettings(v={}){return {bpm:Number.isFinite(v?.bpm)?Math.max(30,Math.min(300,v.bpm)):98,phase:Number.isFinite(v?.phase)?v.phase:0}}
export function convertLegacyLyrics({slides=[],transitions=[],lyrics=[]}){const ids=new Set(lyrics.map(l=>l.id).filter(Boolean));const converted=slides.map(s=>{if(!s.lyric||!ids.has(s.lyric.lineId))return {...s};const {lyric,...rest}=s;return {...rest,img:lyric.img||null,name:s.name||lyric.text}});const tr=transitions.map((t,i)=>{const next=slides[i+1];return {...structuredClone(t),...(next?.lyric&&ids.has(next.lyric.lineId)&&t.shape==='text'&&t.text===next.lyric.text?{shape:'none'}:{})}});return {slides:converted,transitions:tr,document:assignLyricMotions(importTimedLyrics(lyrics,'legacy'),{style:'readable',seed:7})}}

// The full document preserves boundaries, emphasis and unset/provisional times.
// A lines projection remains available to older timing-file consumers.
export function lyricTimingFile(document,duration=12){const d=cleanLyricDocument(document);return JSON.stringify({version:1,lyricDocument:d,lines:getTimings(d,duration).events.map(e=>({s:e.start,e:e.end,t:e.raw,k:e.section}))},null,2)}
export function lyricTimingDocument(value){return cleanLyricDocument(value?.lyricDocument)}
