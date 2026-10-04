const valid=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
// Spoken lines plus boundaries where lyrics must disappear. Other headings inherit their next line.
export function timingEvents(doc){return (doc?.events||[]).filter(e=>e.kind==='line'&&e.decision==='lyric'||e.kind==='section'&&e.decision==='instruction'&&['intro','instrumental','outro'].includes(e.section));}
export function getTimings(doc,duration){const end=duration>0?duration:12,source=timingEvents(doc),issues=[...(doc?.issues||[])],starts=source.map(e=>valid(e.s)?e.s:null);if(source[0]?.kind==='section'&&source[0].section==='intro'&&starts[0]===null)starts[0]=0;
 for(let i=0;i<starts.length;){if(starts[i]!==null){i++;continue}const a=i;while(i<starts.length&&starts[i]===null)i++;const left=a>0?starts[a-1]:0,right=i<starts.length?starts[i]:end,count=i-a;for(let j=0;j<count;j++)starts[a+j]=a===0?left+(right-left)*j/count:left+(right-left)*(j+1)/(count+1);}
 const events=source.map((e,i)=>{const start=starts[i],next=starts[i+1]??end;if(start>end)issues.push({code:'range',eventId:e.id,message:'曲の長さを超えた時刻です'});if(i&&start<starts[i-1])issues.push({code:'order',eventId:e.id,message:'歌詞の開始時刻が前後しています'});if(i&&start===starts[i-1]&&e.kind==='line'&&source[i-1].kind==='line')issues.push({code:'overlap',eventId:e.id,message:'歌詞の開始時刻が重複しています'});if(valid(e.e)&&e.e<start)issues.push({code:'order',eventId:e.id,message:'終了が開始より前です'});return {...e,start,end:Math.max(start,Math.min(end,next,valid(e.e)?e.e:e.kind==='line'?start+(doc.maxHold||6):end)),provisional:!valid(e.s)||e.timingSource==='provisional'};});return {events,issues};}
export function activeLyric(doc,songSec,duration){if(!doc?.enabled)return null;return getTimings(doc,duration).events.find(e=>e.kind==='line'&&songSec>=e.start&&songSec<e.end)||null;}
export function movieDuration({document,audioDuration,offset=0,backgroundDuration=0}){if(!document?.enabled)return backgroundDuration;if(document.durationMode==='song'&&audioDuration>0)return Math.max(0,audioDuration-offset);return backgroundDuration||12;}
export function moveLyric(doc,id,delta){const d=structuredClone(doc),e=d.events.find(e=>e.id===id);if(e){e.s=Math.max(0,Math.round(((valid(e.s)?e.s:0)+delta)*1000)/1000);if(valid(e.e))e.e=Math.max(e.s,e.e+delta);e.timingSource='manual'}return d;}
export function createTapSession(doc,duration){let d=structuredClone(doc),events=timingEvents(d),i=events.findIndex(e=>!valid(e.s)),paused=false;if(i<0)i=0;return {current:()=>paused?null:events[i]||null,tap(songSec){if(paused||!events[i]||!Number.isFinite(songSec))return;events[i].s=Math.max(0,songSec);events[i].timingSource='tap';i++},back(){if(i>0)i--;if(events[i]){events[i].s=null;events[i].timingSource='none'}return Math.max(0,(events[i-1]?.s||0)-1)},stop(){paused=true;return structuredClone(d)},resume(){paused=false}};}

// Start at a visible lyric, including when the playhead is in an intro or gap.
export function lyricPreviewTime(doc, songSec, duration, offset=0, movieLength=Infinity) {
 const lines=getTimings(doc,duration).events.filter(e=>e.kind==='line'&&e.end>Math.max(e.start,offset)&&e.start<offset+movieLength);
 const target=lines.find(e=>songSec>=e.start&&songSec<e.end)||lines.find(e=>e.start>=songSec)||lines[0];
 return target?Math.max(offset,target.start):null;
}
// Work from the gesture's snapshot, so multiple pointer moves never accumulate.
export function trimLyric(doc,id,edge,delta,duration) {
 const d=structuredClone(doc),times=getTimings(doc,duration).events,i=times.findIndex(e=>e.id===id),t=times[i];
 if(!t||!Number.isFinite(delta))return d;
 for(const time of times){const event=d.events.find(e=>e.id===time.id);if(!valid(event.s)){event.s=time.start;event.timingSource='provisional'}}
 const e=d.events.find(e=>e.id===id),minLength=Math.min(.1,Math.max(.001,t.end-t.start));
 e.s=t.start;e.e=t.end;
 if(edge==='start')e.s=Math.max(0,Math.min(t.end-minLength,Math.max((times[i-1]?.start??-.1)+.1,t.start+delta)));
 else if(edge==='end')e.e=Math.max(t.start+minLength,Math.min(times[i+1]?.start??duration,duration,t.end+delta));
 e.timingSource='manual';return d;
}
