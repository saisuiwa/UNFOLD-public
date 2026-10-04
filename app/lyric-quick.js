import {openCodeMotionEditor} from './code-motion-editor.js';
import {BUILTIN_MOTIONS} from './lyric-recipe.js';
import {cleanMotion} from './lyric-motion.js?v=4';
import {LYRIC_PALETTES} from './lyric-style.js';
import {createMotionLibrary} from './lyric-library.js';
import {createLyricPainter,prepareMotionFont} from './lyric-painter.js';
import {lyricFontLabel,savedLyricFonts,listLocalLyricFonts,selectLocalLyricFont,importLyricFont} from './lyric-fonts.js';
const node=(tag,text,cls)=>Object.assign(document.createElement(tag),{...(text==null?{}:{textContent:text}),...(cls?{className:cls}:{})});
export function createLyricQuick({getState,onAction,onMore}){
 const element=node('section',null,'lm-quick');element.id='lm-quick';element.setAttribute('aria-label','選んだ歌詞を編集');let selectedId=null,textKey='',thumbKey='',token=0,range=null,localFonts=[];
 const title=node('h3','歌詞を選んで、その場で編集'),hint=node('p','タイムラインの歌詞をタップしてください。','hint');element.append(title,hint);
 const content=node('div');element.append(content);
 const nav=node('div',null,'lq-row'),prev=node('button','← 前の歌詞','btn'),next=node('button','次の歌詞 →','btn'),play=node('button','この歌詞を再生','btn');nav.append(prev,next,play);content.append(nav);
 const current=()=>getState().document?.events.find(e=>e.id===selectedId&&e.kind==='line');
 const send=async a=>{try{await onAction(a);status.textContent=''}catch(e){status.textContent=e.message}};
 const selectRelative=delta=>{const events=getState().document.events.filter(e=>e.kind==='line'&&e.decision==='lyric'),at=events.findIndex(e=>e.id===selectedId);if(events[at+delta])send({type:'select-lyric',id:events[at+delta].id})};prev.onclick=()=>selectRelative(-1);next.onclick=()=>selectRelative(1);play.onclick=()=>send({type:'preview-lyric',id:selectedId});
 const wordsLabel=node('label','色を変える言葉を選択','lq-label'),words=node('textarea');words.readOnly=true;words.rows=2;words.setAttribute('aria-label','選んだ歌詞の言葉');wordsLabel.append(words);content.append(wordsLabel);
 const selected=node('p','行全体を編集します。','hint'),chips=node('div',null,'lq-words');content.append(chips,selected);
 const scopeLabel=node('label','色・書体を適用する範囲','lm-field'),scope=node('select');for(const [v,l]of [['line','この歌詞だけ'],['word','選んだ言葉の色'],['all','全歌詞（色・書体）']])scope.append(new Option(l,v));scopeLabel.append(scope);content.append(scopeLabel);
 function capture(){if(words.selectionEnd>words.selectionStart){range={start:words.selectionStart,end:words.selectionEnd};scope.value='word';setTab('color');describe()}}
 words.onselect=capture;words.onmouseup=capture;words.onkeyup=capture;scope.onchange=describe;
 function describe(){selected.textContent=scope.value==='word'?(range?'「'+words.value.slice(range.start,range.end)+'」の色を変更':'上の言葉をタップするか、文字をドラッグで選んでください。'):scope.value==='all'?'全歌詞の色・書体を変更します。固定した動きと時刻は維持します。':'この歌詞の色・書体を変更します。'}
 const palette=node('div',null,'lq-palettes');palette.setAttribute('aria-label','配色');content.append(palette);
 async function colorPatch(patch){if(scope.value==='word'){if(!range){status.textContent='先に色を変える言葉を選んでください。';return}await send({type:'word-color',id:selectedId,...range,color:patch.color})}else await send({type:'lyric-style',id:selectedId,scope:scope.value,patch});}
 for(const p of LYRIC_PALETTES){const b=node('button',p.name,'lq-palette');b.type='button';b.style.setProperty('--swatch',p.color);b.style.setProperty('--accent-swatch',p.emphasisColor);b.setAttribute('aria-label','配色 '+p.name);b.onclick=()=>colorPatch({color:p.color,emphasisColor:p.emphasisColor});palette.append(b)}
 const customLabel=node('label','好きな文字色','lm-field'),custom=node('input');custom.type='color';customLabel.append(custom);custom.onchange=()=>colorPatch({color:custom.value});content.append(customLabel);
 const reset=node('button','選んだ言葉の色を戻す','btn');reset.onclick=()=>{if(range)send({type:'word-color',id:selectedId,...range,color:null});else status.textContent='戻す言葉を先に選んでください。'};content.append(reset);
 const fontLabel=node('label','書体','lm-field'),font=node('select');font.setAttribute('aria-label','その場で書体');fontLabel.append(font);content.append(fontLabel);
 const fontsActions=node('div',null,'lq-row'),pc=node('button','PCのフォント','btn'),fileButton=node('button','フォントファイル','btn'),file=node('input');file.type='file';file.accept='.ttf,.otf,.woff,.woff2';file.hidden=true;fontsActions.append(pc,fileButton,file);content.append(fontsActions);
 const browser=node('div',null,'lq-font-browser');browser.hidden=true;const search=node('input'),list=node('select');search.placeholder='フォント名で絞り込む';search.setAttribute('aria-label','PCフォントを検索');list.size=6;list.setAttribute('aria-label','PCフォント一覧');browser.append(search,list);content.append(browser);
 const fontNote=node('p','PCフォントはこのPCから参照します。ファイルはこのブラウザに保存。別のPCでは同じフォントを指定してください。','hint');content.append(fontNote);
 function options(){const key=current()?.motion?.font||'gothic';font.replaceChildren();for(const k of ['gothic','mincho','round','dela','marker','dot'])font.append(new Option(lyricFontLabel(k),k));const items=savedLyricFonts();if(!items.some(i=>i.key===key)&&!['gothic','mincho','round','dela','marker','dot'].includes(key))items.push({key,label:lyricFontLabel(key)});for(const i of items)font.append(new Option(i.label,i.key));font.value=key}
 async function useFont(load){const id=selectedId,doc=getState().document,targetScope=scope.value;pc.disabled=fileButton.disabled=font.disabled=list.disabled=true;try{const key=await load();if(doc!==getState().document||id!==selectedId){status.textContent='選択が変わりました。書体をもう一度選んでください。';options();return}await onAction({type:'lyric-style',id,scope:targetScope==='all'?'all':'line',patch:{font:key}});status.textContent='書体を反映しました。';options()}catch(e){status.textContent=e.message;options()}finally{const disabled=!!getState().recording;pc.disabled=fileButton.disabled=font.disabled=list.disabled=disabled}}
 font.onchange=()=>{const key=font.value;useFont(async()=>{await prepareMotionFont({font:key},current()?.text);return key})};
 function filterFonts(){const q=search.value.toLocaleLowerCase(),items=localFonts.filter(i=>i.label.toLocaleLowerCase().includes(q)).slice(0,200);list.replaceChildren(new Option('書体を選んで適用',''));for(const i of items)list.append(new Option(i.label,i.key));list.value=''}
 pc.onclick=async()=>{pc.disabled=true;try{localFonts=await listLocalLyricFonts();browser.hidden=false;filterFonts();status.textContent=localFonts.length+'書体。名前で検索し、選ぶと反映されます。'}catch(e){status.textContent=e.message}finally{pc.disabled=!!getState().recording}};search.oninput=filterFonts;list.onchange=()=>{const item=localFonts.find(f=>f.key===list.value);if(item)useFont(()=>selectLocalLyricFont(item))};fileButton.onclick=()=>file.click();file.onchange=()=>{const selectedFile=file.files[0];file.value='';if(selectedFile)useFont(()=>importLyricFont(selectedFile))};
 const motionHeading=node('h4','動きをタップして試す');content.append(motionHeading);
 const motions=node('div',null,'lq-motions'),cards=[];content.append(motions);
 for(const item of BUILTIN_MOTIONS){const b=node('button',null,'lq-motion'),canvas=node('canvas');canvas.width=256;canvas.height=144;b.type='button';b.setAttribute('aria-label','動き '+item.name);b.append(canvas,node('span',item.name));b.onclick=()=>send({type:'lyric-style',id:selectedId,patch:{code:null,recipe:item.motion.recipe},replay:true});motions.append(b);cards.push({b,canvas,item,painter:createLyricPainter()})}
 const savedLabel=node('label','保存した動き','lm-field'),saved=node('select');savedLabel.append(saved);content.append(savedLabel);let savedItems=[];
 saved.onchange=()=>{const item=savedItems.find(i=>i.id===saved.value);if(item)send({type:'lyric-style',id:selectedId,patch:{code:item.motion.code||null,recipe:item.motion.recipe||null,speed:item.motion.speed},replay:true})};
 function editCode(fresh=false){const e=current();if(!e)return;openCodeMotionEditor({motion:fresh?{...e.motion,code:null}:e.motion,text:e.raw,runs:e.runs,onSaved:()=>refresh(),onApply:m=>send({type:'lyric-style',id:e.id,patch:{code:m.code,recipe:null},replay:true})})}
 const add=node('button','＋ 追加・コードで作る','btn');add.onclick=()=>editCode(true);const customCards=node('div',null,'lq-motions');
 const more=node('button','細かく調整・名前を付けて保存','btn');more.onclick=()=>current()?.motion?.code?editCode():onMore(selectedId);const motionNote=node('p','動きを変えても、選んだ色・書体はそのままです。','hint');content.append(more,motionNote);
 const status=node('p',null,'lm-status');status.setAttribute('role','status');content.append(status);
 const tabs=node('div',null,'lq-tabs'),panels={motion:node('div'),color:node('div'),font:node('div')},tabButtons={};let activeTab='motion';
 for(const [key,label]of [['motion','動き'],['color','色'],['font','書体']]){const b=node('button',label);b.type='button';b.onclick=()=>setTab(key);tabs.append(b);tabButtons[key]=b}
 panels.motion.append(motionHeading,motions,customCards,add,savedLabel,more,motionNote);panels.color.append(chips,palette,customLabel,reset);panels.font.append(fontLabel,fontsActions,browser,fontNote);
 content.replaceChildren(nav,wordsLabel,tabs,scopeLabel,selected,panels.motion,panels.color,panels.font,status);
 function setTab(key){activeTab=key;for(const [k,p]of Object.entries(panels)){p.hidden=k!==key;tabButtons[k].setAttribute('aria-pressed',String(k===key))}scopeLabel.hidden=selected.hidden=key==='motion';scope.options[1].disabled=key==='font';if(key==='font'&&scope.value==='word')scope.value='line';describe()}
 setTab('motion');
 function refresh(){const s=getState(),e=s.document?.events.find(e=>e.id===s.selectedId&&e.kind==='line'&&e.decision==='lyric');element.hidden=!!s.legacy;content.hidden=!e;hint.hidden=!!e;if(!e){selectedId=null;thumbKey='';token++;status.textContent='';return}
  const changed=e.id!==selectedId||textKey!==e.text;selectedId=e.id;textKey=e.text;title.textContent='この歌詞を編集';if(changed){words.value=e.text;range=null;scope.value='line';setTab('motion');chips.replaceChildren();for(const part of new Intl.Segmenter('ja',{granularity:'word'}).segment(e.text)){if(!part.segment.trim())continue;const b=node('button',part.segment,'lq-word');b.type='button';b.onclick=()=>{range={start:part.index,end:part.index+part.segment.length};scope.value='word';words.focus();words.setSelectionRange(range.start,range.end);setTab('color');describe()};chips.append(b)}describe();status.textContent=''}
  const m=cleanMotion(e.motion);custom.value=m.color;options();try{savedItems=createMotionLibrary().list();saved.replaceChildren(new Option('保存した動きを選ぶ',''));for(const i of savedItems)saved.append(new Option(i.name,i.id));savedLabel.hidden=!savedItems.length;customCards.replaceChildren();for(const item of savedItems){const b=node('button',null,'lq-motion');b.append(node('span',item.motion.code?'〈 / 〉 コード':'◇ レシピ'),node('span',item.name));b.type='button';b.setAttribute('aria-label','保存した動き '+item.name);b.onclick=()=>send({type:'lyric-style',id:selectedId,patch:{code:item.motion.code||null,recipe:item.motion.recipe||null},replay:true});customCards.append(b)}more.textContent=m.code?'コードを編集・確認':'細かく調整・名前を付けて保存'}catch(err){status.textContent=err.message}
  const key=JSON.stringify([e.text,m.font,m.color,m.emphasisColor,e.colors]);for(const c of cards)c.b.setAttribute('aria-pressed',String(m.recipe?.layout===c.item.id));
  if(key!==thumbKey){thumbKey=key;const mine=++token;prepareMotionFont(m,e.text).then(()=>{if(mine!==token)return;for(const c of cards){const ctx=c.canvas.getContext('2d');ctx.clearRect(0,0,256,144);ctx.fillStyle='#101819';ctx.fillRect(0,0,256,144);c.painter.clear();c.painter.draw(ctx,{...e,start:0,end:6,motion:{...m,code:null,recipe:c.item.motion.recipe}},2.1,{width:256,height:144})}}).catch(err=>{if(mine===token)status.textContent=err.message})}
  for(const control of element.querySelectorAll('button,input,textarea,select'))control.disabled=!!s.recording;
 }
 return {element,refresh,reveal(){element.scrollIntoView({block:'start',behavior:'instant'})},dispose(){token++;for(const c of cards)c.painter.clear();element.remove()}};
}
