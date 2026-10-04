// Plain, serializable lyric document. No media/DOM dependencies.
export const SECTIONS=['intro','verse','prechorus','chorus','bridge','instrumental','outro','unknown'];
export const SECTION_LABELS={intro:'イントロ',verse:'A/Bメロ',prechorus:'サビ前',chorus:'サビ',bridge:'ブリッジ',instrumental:'間奏',outro:'アウトロ',unknown:'未分類'};
const aliases={intro:'intro',イントロ:'intro',前奏:'intro',verse:'verse',aメロ:'verse',bメロ:'verse',prechorus:'prechorus',サビ前:'prechorus',chorus:'chorus',サビ:'chorus',ラスサビ:'chorus',finalchorus:'chorus',bridge:'bridge',ブリッジ:'bridge',cメロ:'bridge',instrumental:'instrumental',interlude:'instrumental',間奏:'instrumental',solo:'instrumental',outro:'outro',アウトロ:'outro',後奏:'outro'};
const seconds=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0?x:null;
export function lyricRuns(text){const chunks=String(text).replaceAll('/','\n').split(/(\*[^*\n]+\*)/g);return chunks.filter(Boolean).map(t=>({text:t.startsWith('*')&&t.endsWith('*')&&t.length>2?t.slice(1,-1):t,emphasis:t.startsWith('*')&&t.endsWith('*')&&t.length>2}));}
const base=()=>({version:1,enabled:true,sourceText:'',events:[],style:'readable',seed:7,maxHold:6,durationMode:'song',issues:[]});
function issues(events){return events.flatMap(e=>e.decision==='pending'&&e.kind==='section'?[{code:'unknown-heading',eventId:e.id,message:'未分類の見出し：歌詞か演出指示か選んでください'}]:e.kind==='line'&&e.section==='instrumental'&&e.decision!=='lyric'?[{code:'instrumental-text',eventId:e.id,message:'間奏に文章があります。歌詞として使うか選んでください'}]:[])}
export function parseLyrics(sourceText,previous=null){
 sourceText=String(sourceText??'');if(sourceText.length>100000)throw new Error('歌詞は10万文字以内にしてください。');
 let section='verse',serial=0;const old=previous?.events||[];for(const e of old){const n=Number(String(e.id).replace(/^L/,''));if(Number.isFinite(n))serial=Math.max(serial,n)}
 const events=[];for(const raw of sourceText.split(/\r?\n/)){const trim=raw.trim();if(!trim)continue;if(events.length>=2000)throw new Error('歌詞は見出しを含め2000行以内にしてください。');const match=trim.match(/^(?:【([^】]+)】|\[([^\]]+)\]|［([^］]+)］)$/);let kind='line',decision='lyric';
 if(match){const label=match[1]||match[2]||match[3];const key=label.toLowerCase().replace(/[\s\-_\d０-９]+/g,'');const found=aliases[key];kind='section';decision=found?'instruction':'pending';if(found)section=found;else section='unknown';}
 const runs=kind==='line'?lyricRuns(raw):[];events.push({id:`L${++serial}`,kind,raw,text:kind==='line'?runs.map(x=>x.text).join(''):trim,runs,section,decision:kind==='line'&&section==='instrumental'?'pending':decision,s:null,e:null,timingSource:'none',locked:false,motion:null});}
 // Preserve unchanged edges and same-position anchors before matching the middle.
 // If occurrence counts differ in an unanchored region, its identity is ambiguous:
 // leave timing unset rather than borrowing another chorus's timing or lock.
 const pairs=[],n=old.length,p=events.length;let head=0,tail=0;
 while(head<Math.min(n,p)&&old[head].raw===events[head].raw){pairs.push([head,head]);head++}
 while(tail<Math.min(n,p)-head&&old[n-1-tail].raw===events[p-1-tail].raw)tail++;
 const anchors=[];if(n-head-tail===p-head-tail)for(let i=head;i<n-tail;i++)if(old[i].raw===events[i].raw)anchors.push([i,i]);
 anchors.push([n-tail,p-tail]);let oi=head,nj=head;
 for(const [stopI,stopJ]of anchors){
   const oc=new Map(),nc=new Map();for(let i=oi;i<stopI;i++)oc.set(old[i].raw,(oc.get(old[i].raw)||0)+1);for(let j=nj;j<stopJ;j++)nc.set(events[j].raw,(nc.get(events[j].raw)||0)+1);
   const equal=(i,j)=>old[i].raw===events[j].raw&&oc.get(old[i].raw)===nc.get(events[j].raw);
   const dp=Array.from({length:stopI-oi+1},()=>new Uint16Array(stopJ-nj+1));
   for(let i=stopI-1;i>=oi;i--)for(let j=stopJ-1;j>=nj;j--)dp[i-oi][j-nj]=equal(i,j)?1+dp[i-oi+1][j-nj+1]:Math.max(dp[i-oi+1][j-nj],dp[i-oi][j-nj+1]);
   for(let i=oi,j=nj;i<stopI&&j<stopJ;){if(equal(i,j)){pairs.push([i++,j++])}else if(dp[i-oi+1][j-nj]>=dp[i-oi][j-nj+1])i++;else j++}
   if(stopI<n-tail)pairs.push([stopI,stopJ]);oi=stopI+1;nj=stopJ+1;
 }
 for(let k=0;k<tail;k++)pairs.push([n-tail+k,p-tail+k]);
 for(const [i,j]of pairs){const e=events[j],o=old[i];Object.assign(e,{id:o.id,s:o.s,e:o.e,timingSource:o.timingSource,locked:o.locked,motion:o.motion?structuredClone(o.motion):null});if(o.words)e.words=structuredClone(o.words);if(o.decision==='instruction'&&(e.kind==='line'||e.section==='unknown'))e.decision='instruction';if(o.kind==='line'&&e.kind==='section'&&o.decision==='lyric'){e.kind='line';e.decision='lyric';e.runs=lyricRuns(e.raw);e.text=e.runs.map(x=>x.text).join('');}if(o.section==='instrumental'&&o.decision==='lyric')e.decision='lyric';if(o.sectionOverride){e.sectionOverride=o.sectionOverride;e.section=o.sectionOverride;}}
 const d={...base(),...(previous?{enabled:previous.enabled,style:previous.style,seed:previous.seed,maxHold:previous.maxHold,durationMode:previous.durationMode}:{}),sourceText,events};d.issues=issues(events);return d;
}
export function resolveUnknown(doc,id,decision){const d=structuredClone(doc),e=d.events.find(e=>e.id===id);if(!e)return d;e.decision=decision;if(decision==='lyric'){e.kind='line';e.runs=lyricRuns(e.raw);e.text=e.runs.map(r=>r.text).join('');if(e.section==='unknown'||e.section==='instrumental')e.section='verse';}else {e.kind='section';e.runs=[];}d.issues=issues(d.events);return d;}
export function importTimedLyrics(lines,source='file'){const valid=lines.filter(l=>seconds(l.s)!==null&&String(l.t??'').trim());const d=parseLyrics(valid.map(l=>String(l.t).replace(/\r?\n/g,'/')).join('\n'));for(let i=0;i<d.events.length;i++){const l=valid[i];if(!l)break;Object.assign(d.events[i],{s:l.s,e:seconds(l.e),timingSource:source});if(l.words)d.events[i].words=l.words.filter(w=>seconds(w.s)!==null).map(w=>({text:String(w.text),s:w.s}));}return d;}
export function cleanLyricDocument(value){if(!value||value.version!==1||!Array.isArray(value.events))return null;const d={...base(),sourceText:String(value.sourceText??'').slice(0,100000),enabled:value.enabled!==false,style:['readable','pop','soft'].includes(value.style)?value.style:'readable',seed:Number.isFinite(value.seed)?value.seed:7,maxHold:Math.max(.1,Math.min(60,Number(value.maxHold)||6)),durationMode:['sequence','background'].includes(value.durationMode)?'background':'song'};const seen=new Set();d.events=value.events.slice(0,2000).map((e,i)=>{let id=String(e.id??`L${i+1}`);while(seen.has(id))id+='x';seen.add(id);const raw=String(e.raw??e.text??'');const kind=e.kind==='section'?'section':'line',runs=kind==='line'?lyricRuns(raw):[];const out={id,kind,raw,text:kind==='line'?runs.map(r=>r.text).join(''):String(e.text??raw),runs,section:SECTIONS.includes(e.section)?e.section:'verse',decision:['pending','lyric','instruction'].includes(e.decision)?e.decision:'lyric',s:seconds(e.s),e:seconds(e.e),timingSource:['none','provisional','embedded','file','tap','manual','legacy'].includes(e.timingSource)?e.timingSource:'none',locked:e.locked===true,motion:e.motion&&typeof e.motion==='object'?structuredClone(e.motion):null};if(SECTIONS.includes(e.sectionOverride)){out.sectionOverride=e.sectionOverride;out.section=e.sectionOverride;}if(Array.isArray(e.words))out.words=e.words.filter(w=>seconds(w.s)!==null).map(w=>({text:String(w.text),s:w.s}));return out});d.issues=issues(d.events);return d;}
