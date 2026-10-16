import {el,button,field,action} from './dom.js';import {displayTime} from './controller.js';
import {lyricStyleName,sceneSummary,chipsFor,isEffectClip,isBackgroundClip,clipTitle,absRange} from './timeline-labels.js';
// Four fixed lanes like the sequence editor so the whole song reads in a few rows: 歌詞 first (the lane used most), then 画像 / 演出 / 音声; the layers of the selected scene sit below.
const SUB=26;
export function mountTimeline(root,controller){let version='',zoom=1,state,drag=false,focusedSceneId=null,projectId=null,revealed=null;root.tabIndex=0;root.setAttribute('aria-label','タイムライン');
 const run=fn=>action(controller,fn)(),b=(t,f)=>button(controller,t,f);
 // 拡大 is a slider: the timeline follows the thumb while it is dragged and keeps the middle of the visible part where it was
 const zoomInput=el('input',{type:'range',min:1,max:8,step:.5,value:1,'aria-label':'拡大','data-testid':'timeline-zoom'}),zoomOut=el('output',{},'×1'),zoomField=el('label',{class:'field zoom-field'},el('span',{},'拡大'),zoomInput,zoomOut);
 const panInput=el('input',{type:'range',min:0,max:1000,step:1,value:0,'aria-label':'移動','data-testid':'timeline-pan',disabled:true}),panOut=el('output',{},'0%'),panField=el('label',{class:'field zoom-field pan-field'},el('span',{},'移動'),panInput,panOut),zoomBox=el('div',{class:'zoom-box'},zoomField,panField);
 zoomInput.addEventListener('input',()=>{const mid=(scroller.scrollLeft+scroller.clientWidth/2)/Math.max(1,tracks.scrollWidth);zoom=Math.max(1,Math.min(8,Number(zoomInput.value)||1));zoomOut.textContent='×'+zoom;version='';render(state);scroller.scrollLeft=Math.max(0,mid*tracks.scrollWidth-scroller.clientWidth/2);syncPan();});
 // 移動: the same as scrolling the timeline sideways (only useful when it is zoomed in); it follows the scrolling and the zoom
 function syncPan(){const room=Math.max(0,tracks.scrollWidth-scroller.clientWidth);panInput.disabled=room<2;const f=room<2?0:scroller.scrollLeft/room;panInput.value=String(Math.round(f*1000));panOut.textContent=Math.round(f*100)+'%';}
 panInput.addEventListener('input',()=>{const room=Math.max(0,tracks.scrollWidth-scroller.clientWidth);scroller.scrollLeft=Number(panInput.value)/1000*room;panOut.textContent=Math.round(Number(panInput.value)/10)+'%';});
 const toolbar=el('div',{class:'timeline-tools'},b('シーンを追加',()=>controller.addScene()),b('再生位置で分割',()=>controller.editSelected('split')),b('配置を複製',()=>controller.editSelected('duplicate')),b('選択を削除',()=>controller.editSelected('delete')),zoomBox);const waveCache=new Map();const scroller=el('div',{class:'timeline-scroll'}),tracks=el('div',{class:'timeline-tracks'}),chips=el('div',{class:'timeline-chips','data-testid':'timeline-chips','aria-live':'polite'});for(const x of toolbar.querySelectorAll('button'))if(['シーンを追加','再生位置で分割','配置を複製'].includes(x.textContent))x.dataset.advanced='';
 scroller.append(tracks);root.append(toolbar,scroller,chips);scroller.addEventListener('scroll',syncPan);
 // click or drag on the ruler or an empty stretch of a lane to move the playhead (the preview follows)
 let seeking=false,seekBusy=false;const seekTo=e=>{const rect=tracks.getBoundingClientRect(),head=parseFloat(getComputedStyle(tracks).getPropertyValue('--lane-head'))||76,frac=Math.min(1,Math.max(0,(e.clientX-rect.left-head)/Math.max(1,rect.width-head)));if(seekBusy||!state)return;seekBusy=true;controller.seek(Math.round(frac*state.project.durationUs)).catch(()=>{}).finally(()=>{seekBusy=false;});};
 tracks.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('.timeline-block,.lane-label,button,.selected-scene-heading'))return;if(!e.target.closest('.time-ruler,.lane-rail'))return;seeking=true;tracks.setPointerCapture?.(e.pointerId);seekTo(e);});
 tracks.addEventListener('pointermove',e=>{if(seeking)seekTo(e);});
 const stopSeek=()=>{seeking=false;};tracks.addEventListener('pointerup',stopSeek);tracks.addEventListener('pointercancel',stopSeek);
 root.addEventListener('keydown',e=>{if(!['Delete','Backspace'].includes(e.key)||e.target.closest('input,textarea,select,[contenteditable]'))return;e.preventDefault();run(()=>controller.editSelected('delete'));});
 // one block on a rail: select, move and trim (the same gestures for every lane)
 function block(kind,item,start,end,label,{rail,locked=false,testid,content,top=4,height=30,cls=kind,title}={}){
  const node=b(label,()=>controller.select({kind,id:item.id},{show:true}));node.className='timeline-block '+cls+(locked?' locked':'');if(content)node.replaceChildren(...content);if(title)node.title=title;
  node.style.left=(start/state.project.durationUs*100)+'%';node.style.width=Math.max(.2,(end-start)/state.project.durationUs*100)+'%';node.style.top=top+'px';node.style.height=height+'px';node.dataset.id=item.id;if(testid)node.setAttribute('data-testid',testid);node.setAttribute('aria-label',label+' '+displayTime(start));if(state.selection?.id===item.id)node.classList.add('selected');
  for(const edge of ['start','end'])node.append(el('span',{class:'trim-handle '+edge,'data-edge':edge}));
  node.onpointerdown=e=>{if(e.button!==0||locked)return;e.preventDefault();drag=true;controller.select({kind,id:item.id});const x=e.clientX,width=rail.getBoundingClientRect().width,edge=e.target.dataset.edge;drag=true;node.setPointerCapture(e.pointerId);const initialLeft=node.style.left,initialWidth=node.style.width;let nextStart=start,nextEnd=end;
   node.onpointermove=ev=>{const delta=Math.round((ev.clientX-x)/width*state.project.durationUs/1e6*30)*1e6/30;if(edge==='start')nextStart=Math.max(0,Math.min(end-33334,Math.round(start+delta)));else if(edge==='end')nextEnd=Math.min(state.project.durationUs,Math.max(start+33334,Math.round(end+delta)));else{nextStart=Math.max(0,Math.min(state.project.durationUs-(end-start),Math.round(start+delta)));nextEnd=nextStart+end-start;}node.style.left=nextStart/state.project.durationUs*100+'%';node.style.width=(nextEnd-nextStart)/state.project.durationUs*100+'%';};
   node.onpointerup=()=>{drag=false;node.onpointermove=null;node.onpointerup=null;if(nextStart===start&&nextEnd===end){controller.select({kind,id:item.id},{show:true});return;}run(()=>controller.editSelected(edge?'trim':'move',{startUs:nextStart,endUs:nextEnd}));};
   node.onpointercancel=()=>{drag=false;node.style.left=initialLeft;node.style.width=initialWidth;};};
  if(kind==='audio'&&item.assetId){const wave=el('canvas',{class:'waveform',width:384,height:24});node.prepend(wave);const key=item.assetId+':'+item.trackId+':'+item.sourceInUs+':'+(end-start);if(!waveCache.has(key))waveCache.set(key,controller.waveform(item).catch(()=>[]));waveCache.get(key).then(values=>{if(!wave.isConnected)return;const ctx=wave.getContext('2d');ctx.strokeStyle='#e6c59166';ctx.beginPath();values.forEach((v,i)=>{ctx.moveTo(i*4,12-Math.min(1,v)*12);ctx.lineTo(i*4,12+Math.min(1,v)*12);});ctx.stroke();});}
  rail.append(node);return node;}
 function lane(title,cls,height,testid){const l=el('div',{class:'timeline-lane '+cls,...(testid?{'data-testid':testid}:{})}),head=el('span',{class:'lane-label lane-title'},title),rail=el('div',{class:'lane-rail'});l.style.height=height+'px';l.append(head,rail);return {l,rail};}
 const pack=items=>{const ends=[];return items.map(it=>{let r=ends.findIndex(e=>e<=it.start);if(r<0){r=ends.length;ends.push(0);}ends[r]=it.end;return {...it,row:r};});};
 // the layers of the selected scene: one row per clip, topmost first (same rows as before)
 function layerRow(c,start,end){const l=el('div',{class:'timeline-lane layer','data-testid':'clip-row'}),name=b(c.name||c.kind,()=>controller.select({kind:'clip',id:c.id}));name.className='lane-label';const rail=el('div',{class:'lane-rail'});l.style.height='34px';block('clip',c,start,end,c.name||c.kind,{rail,cls:'clip',content:null,height:26,top:4});l.append(name,rail);return l;}
 function render(s){
  state=s;if(!s)return;const p=s.project;
  if(projectId!==p.id){projectId=p.id;focusedSceneId=null;}
  const selectedClip=s.selection?.kind==='clip'?p.clips.find(c=>c.id===s.selection.id):s.selection?.kind==='audio'?p.clips.find(c=>c.id===p.audio.find(a=>a.id===s.selection.id)?.linkClipId):null;
  const selectedScene=s.selection?.kind==='scene'?p.scenes.find(x=>x.id===s.selection.id):p.scenes.find(x=>x.id===selectedClip?.sceneId);
  if(selectedScene)focusedSceneId=selectedScene.id;
  if(!s.selection||!p.scenes.some(x=>x.id===focusedSceneId))focusedSceneId=(p.scenes.find(x=>x.startUs<=s.position&&s.position<x.endUs)||p.scenes[0])?.id;
  const focused=p.scenes.find(x=>x.id===focusedSceneId),key=[p.id,s.editVersion,s.selection?.kind,s.selection?.id,focusedSceneId,zoom].join(':');
  if(key!==version&&!drag){
   version=key;tracks.style.width=Math.max(700,900*zoom)+'px';const ruler=el('div',{class:'time-ruler'},el('span',{},'秒'));
   for(let i=0;i<=10;i++)ruler.append(el('span',{},(p.durationUs/1e6*i/10).toFixed(1)));tracks.replaceChildren(ruler);
   // 歌詞: every line with the name of its text motion
   {const {l,rail}=lane('歌詞','lane-lyrics',50);for(const lyric of p.lyrics){const provisional=lyric.timingSource==='provisional',motion=lyricStyleName(lyric);
     block('lyric',lyric,lyric.startUs,lyric.endUs,(provisional?'仮タイミング ':'歌詞 ')+lyric.text,{rail,locked:p.locks.lyrics,testid:'lyric-row',height:42,content:[el('span',{class:'tl-main'},(provisional?'仮 ':'')+lyric.text.replaceAll('\n',' ')),el('span',{class:'tl-sub tl-motion'},motion)],title:lyric.text+'\n文字の動き：'+motion});}
    tracks.append(l);}
   // 画像: the scenes, each saying what it holds
   {const {l,rail}=lane('画像','lane-scenes',46);for(const scene of p.scenes){const expanded=scene.id===focusedSceneId,label=(expanded?'▾ ':'▸ ')+'シーン '+displayTime(scene.startUs),parts=sceneSummary(p,scene),sub=parts.join(' ／ ');
     block('scene',scene,scene.startUs,scene.endUs,label,{rail,testid:'scene-row',height:38,content:[el('span',{class:'tl-main'},label),el('span',{class:'tl-sub'},sub||'空のシーン')],title:label+(sub?'\n'+sub:'')}).setAttribute('aria-expanded',String(expanded));}
    tracks.append(l);}
   // 演出: effects, backgrounds and decorative text of every scene, on the song's time
   {const items=pack(p.clips.filter(isEffectClip).map(c=>({c,...absRange(p,c)||{}})).filter(x=>x.end>x.start).sort((a,b)=>a.start-b.start)),rows=Math.min(3,Math.max(1,...items.map(x=>x.row+1))),{l,rail}=lane('演出','lane-fx',rows*SUB+8);
    for(const it of items){const name=clipTitle(it.c);block('clip',it.c,it.start,it.end,name,{rail,cls:'fx'+(isBackgroundClip(it.c)?' bg':''),testid:'fx-row',top:4+Math.min(2,it.row)*SUB,height:SUB-4,title:name});}
    tracks.append(l);}
   // 音声: the song and sound effects
   {const items=pack(p.audio.map(a=>({a,start:a.startUs,end:a.endUs})).sort((x,y)=>x.start-y.start)),rows=Math.min(3,Math.max(1,...items.map(x=>x.row+1))),{l,rail}=lane('音声','lane-audio',rows*SUB+8);
    for(const it of items){const a=it.a;block('audio',a,a.startUs,a.endUs,(a.linkClipId?'↳ 映像リンク ':a.role==='music'?'♫ 主曲 ':'♪ 効果音 ')+(a.muted?'MUTE':''),{rail,locked:a.role==='music'&&p.locks.music,testid:'audio-row',top:4+Math.min(2,it.row)*SUB,height:SUB-4});}
    tracks.append(l);}
   const sceneClips=focused?p.clips.filter(c=>c.sceneId===focused.id):[],autoBackgrounds=sceneClips.filter(c=>c.settings?.omakase).length;   // the おまかせ backgrounds are in the 演出 lane already
   tracks.append(el('div',{class:'selected-scene-heading','data-testid':'selected-scene'},focused?'選択シーン '+displayTime(focused.startUs)+' → '+displayTime(focused.endUs)+' / 重なり順（上が前）'+(autoBackgrounds?' ／ おまかせの背景 '+autoBackgrounds+' 個は「演出」の行にあります':''):'シーンを選ぶと重なりを表示します'));
   if(focused)for(const c of sceneClips.filter(c=>!c.settings?.omakase).sort((a,b)=>b.z-a.z))tracks.append(layerRow(c,Math.max(focused.startUs,focused.originUs+c.startUs),Math.min(focused.endUs,focused.originUs+c.endUs)));
   tracks.append(el('div',{class:'playhead'}));
   const list=chipsFor(p,s.selection);chips.replaceChildren(...(list.length?list.map(x=>el('span',{class:'tl-chip chip-'+x.kind},el('b',{},x.label),' '+x.value)):[el('span',{class:'tl-chip-hint'},'歌詞・シーン・配置を選ぶと、使っている動きや背景がここに出ます。')]));
  }
  for(const node of tracks.querySelectorAll('.timeline-block.scene')){const scene=p.scenes.find(x=>x.id===node.dataset.id);if(scene&&scene.startUs<=s.position&&s.position<scene.endUs)node.setAttribute('aria-current','time');else node.removeAttribute('aria-current');}
  const line=tracks.querySelector('.playhead');if(line)line.style.left=`calc(var(--lane-head) + (100% - var(--lane-head)) * ${s.position/p.durationUs})`;
  // a lyric that becomes the selection (the panel's arrows, a click elsewhere) is kept in view when the timeline is zoomed in
  {const sel=s.selection;if(sel?.kind!=='lyric')revealed=null;
   else if(sel.id!==revealed){revealed=sel.id;const node=[...tracks.querySelectorAll('.timeline-block.lyric')].find(n=>n.dataset.id===sel.id);
    if(node){const r=node.getBoundingClientRect(),sr=scroller.getBoundingClientRect();if(r.width>0&&(r.left<sr.left+90||r.right>sr.right))scroller.scrollLeft+=r.left-sr.left-(sr.width-r.width)/2;}}}
  syncPan();
 }
 return {render,dispose(){root.replaceChildren();}};
}
