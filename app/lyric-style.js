import {cleanMotion} from './lyric-motion.js?v=4';
export const LYRIC_PALETTES=[
 {name:'ミント',color:'#c5f57b',emphasisColor:'#ffb454'},
 {name:'ソーダ',color:'#78ddff',emphasisColor:'#fff29a'},
 {name:'ベリー',color:'#ff91c7',emphasisColor:'#b9b2ff'},
 {name:'夕焼け',color:'#ffb16c',emphasisColor:'#ff7798'},
 {name:'ラベンダー',color:'#c7b8ff',emphasisColor:'#a4ffe1'},
 {name:'クリーム',color:'#fff0bc',emphasisColor:'#ff9fc7'},
 {name:'白と光',color:'#ffffff',emphasisColor:'#d9f878'},
 {name:'インク',color:'#14201b',emphasisColor:'#9b2855'}
];
const validColor=c=>typeof c==='string'&&/^#[\da-f]{6}$/i.test(c);
function chars(text){return [...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].map(x=>({text:x.segment,start:x.index,end:x.index+x.segment.length}));}
export function cleanWordColors(colors,text){
 const list=Array.isArray(colors)?colors.slice(0,2000).filter(c=>c&&Number.isInteger(c.start)&&Number.isInteger(c.end)&&c.start>=0&&c.end>c.start&&c.end<=text.length&&validColor(c.color)):[];
 const out=[];for(const g of chars(text)){const c=list.findLast(c=>c.start<g.end&&c.end>g.start);if(!c)continue;const last=out.at(-1);if(last&&last.end===g.start&&last.color===c.color)last.end=g.end;else out.push({start:g.start,end:g.end,color:c.color})}return out;
}
export function setWordColor(colors,text,start,end,color){
 if(color!==null&&!validColor(color))throw Error('文字色は #rrggbb で指定してください。');
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>text.length)throw Error('色を変える言葉を選んでください。');
 const selected=chars(text).filter(g=>g.start<end&&g.end>start);start=selected[0].start;end=selected.at(-1).end;
 const kept=cleanWordColors(colors,text).flatMap(c=>c.end<=start||c.start>=end?[c]:[...(c.start<start?[{...c,end:start}]:[]),...(c.end>end?[{...c,start:end}]:[])]);
 return cleanWordColors([...kept,...(color?[{start,end,color}]:[])],text);
}
export function colorLyricRuns(runs,colors){
 const text=runs.map(r=>r.text).join(''),spans=cleanWordColors(colors,text),out=[];let pos=0;
 for(const r of runs){for(const g of chars(r.text)){const c=spans.find(c=>c.start<=pos+g.start&&c.end>pos+g.start),run={text:g.text,emphasis:!!r.emphasis,...(c?{color:c.color}:{})},last=out.at(-1);if(last&&last.emphasis===run.emphasis&&last.color===run.color)last.text+=run.text;else out.push(run)}pos+=r.text.length}
 return out;
}
export function applyLyricStyle(doc,{id,scope='line',patch={}}){
 const d=structuredClone(doc);for(const e of d.events)if(e.kind==='line'&&(scope==='all'||e.id===id))e.motion=cleanMotion({...cleanMotion(e.motion),...patch});return d;
}
