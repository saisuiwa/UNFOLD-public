// "この歌詞を編集" in STUDIO: the same panel the sequence has (動き / 色 / 書体, one word's colour, all lyrics at once),
// plus the code motions and effects of the workshop as picture cards. It edits the STUDIO project through its commands.
import {createLyricQuick} from '../lyric-quick.js?v=21';
import {graphemes} from '../lyric-motion.js?v=28';
import {resizeRuns} from './word-size.js';
import {mergeMotion} from './omakase.js';
import {cleanWordColors,setWordColor,colorLyricRuns} from '../lyric-style.js';
import {getLyricFontBlob} from '../lyric-fonts.js';
import {DAILY_CODE_MOTIONS} from '../code-motion-daily.js';
import {createMotionLibrary} from '../lyric-library.js';
import {approveStudioCode,isStudioCodeApproved} from './code-trust.js';
import {el} from './dom.js';
import {lyricCutCommand} from './cuts/apply.js';
import {cutActive} from './cuts/plan.js';
import {ensureCutFonts,measureChar} from './cuts/layer.js';

// Code the panel is about to run: the workshop's own bundled motions are trusted; anything else (a motion from the saved library, code typed or pasted
// into the editor) is asked about once, exactly like opening a piece that carries code. Declining stops the change.
const BUNDLED=new Set(DAILY_CODE_MOTIONS.map(m=>m.source));
export function trustSource(source,{ask=message=>confirm(message)}={}){
 if(typeof source!=='string'||!source)return;
 if(isStudioCodeApproved(source))return;
 if(!BUNDLED.has(source)&&!ask('この動きのコードをSTUDIOで実行します。自分で作った、または信頼できる提供元のコードだけ許可してください。許可しますか？'))throw new DOMException('中止しました','AbortError');
 approveStudioCode(source);
}
const HEX=/^#[\da-f]{6}$/i;
// the per-word colours of a lyric are the colours of its runs
export function colorsOf(lyric){let pos=0;const out=[];for(const r of lyric.runs||[]){const len=(r.text||'').length;if(r.color&&HEX.test(r.color))out.push({start:pos,end:pos+len,color:r.color});pos+=len;}return out;}
const eventOf=l=>({id:l.id,kind:'line',decision:'lyric',text:l.text,raw:l.text,runs:(l.runs?.length?l.runs:[{text:l.text}]).map(r=>({text:r.text,emphasis:!!r.emphasis})),colors:colorsOf(l),motion:l.motion||{}});
// the new motion: the sequence's own normaliser decides what a patch means; STUDIO-only fields (font assets) are kept
export {mergeMotion};
/** New runs after one word's colour changed: the grapheme ids stay, so saved line breaks keep working. */
export function recolorRuns(lyric,start,end,color){
 const text=lyric.runs.map(r=>r.text).join(''),ids=lyric.runs.flatMap((r,ri)=>graphemes(r.text||'').map((_,i)=>r.glyphIds?.[i]??`${r.id??ri}:${i}`));
 const colors=setWordColor(colorsOf(lyric),text,start,end,color),plain=lyric.runs.map(r=>({text:r.text,emphasis:!!r.emphasis,...(r.outline?{outline:true}:{}),...(r.outline&&r.outlineColor?{outlineColor:r.outlineColor}:{}),...(r.outline&&r.outlineWidth?{outlineWidth:r.outlineWidth}:{}),...(r.hollow?{hollow:true}:{}),...(r.scale>0&&r.scale!==1?{scale:r.scale}:{})})),next=colorLyricRuns(plain,colors);
 let cursor=0;return next.map(r=>{const n=graphemes(r.text).length,glyphIds=ids.slice(cursor,cursor+n);cursor+=n;return {...r,id:glyphIds[0]?.split(':')[0]||crypto.randomUUID(),glyphIds};});
}

/**
 * New runs after the decoration of some characters changed (縁取り `outline` / 中抜き `hollow`, one of them at a time). The grapheme ids stay.
 * `key` is 'outline' | 'hollow' (switched on, or off when every chosen character already has it) or null (both removed).
 * `color` is the colour of an outline (#rrggbb) and `width` its thickness in % of the font size (2-16); for characters that already have an outline an
 * undefined value keeps what they have, null (or an invalid value) means automatic / default; `force` switches the decoration on even when every chosen
 * character has it (used when only the colour or the width changed).
 */
export function restyleRuns(lyric,start,end,key,{color,width,force=false}={}){
 const items=[];let pos=0;
 for(const [ri,r] of (lyric.runs||[]).entries())for(const [i,g] of graphemes(r.text||'').entries()){items.push({from:pos,to:pos+g.length,text:g,emphasis:!!r.emphasis,color:r.color,outline:!!r.outline,outlineColor:r.outline?r.outlineColor:undefined,outlineWidth:r.outline?r.outlineWidth:undefined,hollow:!!r.hollow,scale:r.scale>0&&r.scale!==1?r.scale:undefined,id:r.glyphIds?.[i]??`${r.id??ri}:${i}`});pos+=g.length;}
 const chosen=items.filter(it=>it.from<end&&it.to>start);
 if(!chosen.length)throw new Error('言葉を先に選んでください。');
 const on=key!=null&&(force||!chosen.every(it=>it[key])),edgeOf=v=>/^#[\da-f]{6}$/i.test(v||'')?v.toLowerCase():undefined,widthOf=v=>Number.isFinite(Number(v))&&Number(v)>=2&&Number(v)<=16?Math.round(Number(v)*10)/10:undefined;
 for(const it of chosen){
  const had=it.outline,keepColor=it.outlineColor,keepWidth=it.outlineWidth;
  it.outline=false;it.hollow=false;it.outlineColor=undefined;it.outlineWidth=undefined;
  if(on){it[key]=true;if(key==='outline'){it.outlineColor=color===undefined?(had?keepColor:undefined):edgeOf(color);it.outlineWidth=width===undefined?(had?keepWidth:undefined):widthOf(width);}}
 }
 const out=[];
 for(const it of items){const last=out.at(-1);
  if(last&&last.emphasis===it.emphasis&&last.color===it.color&&last.outline===it.outline&&last.outlineColor===it.outlineColor&&last.outlineWidth===it.outlineWidth&&last.hollow===it.hollow&&last.scale===it.scale){last.text+=it.text;last.glyphIds.push(it.id);}
  else out.push({text:it.text,emphasis:it.emphasis,color:it.color,outline:it.outline,outlineColor:it.outlineColor,outlineWidth:it.outlineWidth,hollow:it.hollow,scale:it.scale,glyphIds:[it.id]});}
 return out.map(r=>({text:r.text,emphasis:r.emphasis,...(r.color?{color:r.color}:{}),...(r.outline?{outline:true}:{}),...(r.outline&&r.outlineColor?{outlineColor:r.outlineColor}:{}),...(r.outline&&r.outlineWidth?{outlineWidth:r.outlineWidth}:{}),...(r.hollow?{hollow:true}:{}),...(r.scale>0&&r.scale!==1?{scale:r.scale}:{}),id:r.glyphIds[0]?.split(':')[0]||crypto.randomUUID(),glyphIds:r.glyphIds}));
}

export function createLyricEdit(controller){
 const state=()=>controller.get(),find=id=>state().project.lyrics.find(l=>l.id===id);
 const play=async id=>{const l=find(id);if(l)await controller.seek(l.startUs);};
 async function onAction(a){
  const s=state(),p=s.project;
  if(a.type==='select-lyric'){controller.select({kind:'lyric',id:a.id},{show:true});return;}
  if(a.type==='preview-lyric'){await play(a.id);return;}
  if(a.type==='lyric-style'){
   const targets=a.scope==='all'?p.lyrics:[find(a.id)].filter(Boolean);if(!targets.length)return;
   if(a.patch?.code?.source)trustSource(a.patch.code.source);
   // a PC font or a font file travels with the project as an asset (the text layer reads `fontAssetId`); a built-in font drops it again
   let fontAssetId;const key=a.patch?.font;
   if(typeof key==='string'&&/^(local:|file:)/.test(key)){
    const blob=await getLyricFontBlob(key);
    if(!blob)throw new Error('このフォントのデータを取り出せませんでした。「PCのフォント」か「フォントファイル」から選び直してください。');
    fontAssetId=await controller.addFontAsset(blob);
   }
   const commands=targets.map(l=>{const motion=mergeMotion(l.motion,a.patch||{});if(typeof key==='string'){if(fontAssetId)motion.fontAssetId=fontAssetId;else delete motion.fontAssetId;}return {type:'setLyricAppearance',id:l.id,patch:{motion}};});
   await controller.dispatch(commands.length===1?commands[0]:{type:'batch',commands});
   if(a.replay)await play(a.id);
   return;
  }
  if(a.type==='word-color'){
   const l=find(a.id);if(!l)return;
   await controller.dispatch({type:'setLyricText',id:l.id,text:l.text,runs:recolorRuns(l,a.start,a.end,a.color)});
   return;
  }
  if(a.type==='word-size'){
   const l=find(a.id);if(!l)return;
   await controller.dispatch({type:'setLyricText',id:l.id,text:l.text,runs:resizeRuns(l,a.start,a.end,{factor:a.factor,value:a.value})});
   return;
  }
  if(a.type==='word-style'){
   const l=find(a.id);if(!l)return;
   await controller.dispatch({type:'setLyricText',id:l.id,text:l.text,runs:restyleRuns(l,a.start,a.end,a.key??null,{color:a.color,width:a.width,force:!!a.force})});
   return;
  }
 }
 // the 動き tab: the size of the characters, motions saved in the library, and the workshop's code motions and effects as picture cards (the samples page previews)
 const selectedId=()=>state().selection?.kind==='lyric'?state().selection.id:null;
 const scopeAll=el('input',{type:'checkbox','aria-label':'全歌詞に適用'}),status=el('p',{class:'hint','data-testid':'code-card-status',role:'status'});
 const sizeValue=el('output',{class:'lq-size-value'},''),size=el('input',{type:'range',min:.03,max:.2,step:.005,value:.06,'aria-label':'文字の大きさ','data-testid':'lyric-size'});
 const targets=()=>{const p=state().project;return scopeAll.checked?p.lyrics:[find(selectedId())].filter(Boolean);};
 size.oninput=()=>{sizeValue.textContent=Math.round(Number(size.value)*1000)/10+'%';};
 size.onchange=()=>{const value=Number(size.value),p=state().project,commands=[];for(const l of targets())for(const viewId of Object.keys(p.views))commands.push({type:'setLayout',id:l.id,viewId,patch:{fontScale:value}});
  if(commands.length)controller.dispatch(commands.length===1?commands[0]:{type:'batch',commands}).then(()=>{status.textContent='文字の大きさを反映しました。';}).catch(e=>{status.textContent=e.message;});};
 const apply=patch=>onAction({type:'lyric-style',id:selectedId(),scope:scopeAll.checked?'all':'line',patch,replay:true});
 const group=(title,items,folder,open)=>{const box=el('details',{class:'lq-codes'},el('summary',{},title+'（'+items.length+'）')),grid=el('div',{class:'lq-code-grid'});box.open=!!open;
  for(const item of items){const b=el('button',{type:'button',class:'lq-code-card','data-key':item.key,title:item.desc||item.name,'aria-label':'動き '+item.name},el('img',{src:`./guide/samples/${folder}-${item.key}.jpg`,alt:'',loading:'lazy'}),el('span',{},item.name));
   b.onclick=()=>apply({code:{version:1,source:item.source},recipe:null}).then(()=>{status.textContent='「'+item.name+'」を反映しました。';}).catch(e=>{status.textContent=e.message;});grid.append(b);}
  box.append(grid);return box;};
 const texts=DAILY_CODE_MOTIONS.filter(m=>m.shelf!=='effect'),effects=DAILY_CODE_MOTIONS.filter(m=>m.shelf==='effect'&&!m.key.startsWith('bg-'));
 const saved=el('select',{'aria-label':'保存した動き'}),savedLabel=el('label',{class:'lq-scope'},'保存した動き',saved);
 let savedItems=[];
 saved.onchange=()=>{const item=savedItems.find(i=>i.id===saved.value);saved.value='';if(item)apply({code:item.motion.code||null,recipe:item.motion.recipe||null,speed:item.motion.speed}).then(()=>{status.textContent='「'+item.name+'」を反映しました。';}).catch(e=>{status.textContent=e.message;});};
 function refreshSaved(){try{savedItems=createMotionLibrary().list();}catch{savedItems=[];}saved.replaceChildren(new Option('選ぶ',''),...savedItems.map(i=>new Option(i.name,i.id)));savedLabel.hidden=!savedItems.length;}
 // カット割り: この歌詞だけ、短いカットに切って部品を重ねる演出にする（全部まとめては、おまかせの「カット割り」）。動きの札を選ぶと、普通の動きに戻る
 const cutState=el('p',{class:'lq-cut-state','data-testid':'lyric-cut-state'}),cutStatus=el('p',{class:'hint',role:'status'});
 const cutAct=(fn,done)=>()=>{cutStatus.textContent='作っています…';Promise.resolve().then(fn).then(()=>{cutStatus.textContent=done;refreshCut();}).catch(e=>{cutStatus.textContent=e.message||String(e);});};
 const makeCut=async()=>{const id=selectedId(),p=state().project;if(!id)return;const made=await lyricCutCommand(p,id,{seed:1+Math.floor(Math.random()*1e9),ensureFonts:ensureCutFonts,measure:measureChar});if(!made)throw new Error('この歌詞には文字がありません。');await controller.dispatch(made.command);await play(id);};
 const cutMake=el('button',{type:'button',class:'primary','data-testid':'lyric-cut-make',onclick:cutAct(makeCut,'カット割りにしました。')},'✂ この歌詞をカット割りにする');
 const cutAgain=el('button',{type:'button','data-testid':'lyric-cut-again',onclick:cutAct(makeCut,'別の案にしました。')},'別の案');
 const cutOff=el('button',{type:'button','data-testid':'lyric-cut-off',onclick:cutAct(async()=>{const id=selectedId();if(id)await controller.dispatch({type:'setLyricAppearance',id,patch:{cut:null}});},'普通の動きに戻しました。')},'普通の動きに戻す');
 const cutBox=el('div',{class:'lq-cut','data-testid':'lyric-cut-box'},el('div',{class:'lq-cut-head'},el('strong',{},'演出'),cutState),el('div',{class:'lq-row'},cutMake,cutAgain,cutOff),
  el('p',{class:'hint lq-cut-note'},'カット割り：短いカットに切って、背景・カメラ・文字の部品を重ねます。全部の歌詞をまとめて変える時は、右上の「おまかせ」の「カット割り」。'),cutStatus);
 function refreshCut(){const l=find(selectedId());const on=!!l&&cutActive(l);cutState.textContent=on?`カット割り（${l.cut.cuts.length}カット）`:'歌詞ごとの動き';cutBox.classList.toggle('on',on);cutMake.hidden=on;cutAgain.hidden=!on;cutOff.hidden=!on;}
 const motionPanel=el('section',{class:'lq-code-motions','aria-label':'動き'},
  cutBox,
  el('label',{class:'lq-size'},el('span',{},'文字の大きさ'),size,sizeValue),
  el('label',{class:'lq-scope'},scopeAll,' 全歌詞に適用（大きさ・動き）'),
  savedLabel,group('文字の動き',texts,'codetext',true),group('文字つきのエフェクト',effects,'effect',false),status);
 refreshSaved();
 // the panel is the sequence's own, with this 動き tab in place of its recipe cards.
 // It compares the document by identity to notice "the lyrics changed while a font was loading": keep it the same object until the lyrics really change.
 let cache={key:'',document:null};
 const documentOf=()=>{const s=state(),key=s.project.id+':'+s.editVersion;if(cache.key!==key)cache={key,document:{events:s.project.lyrics.map(eventOf)}};return cache.document;};
 const quick=createLyricQuick({getState:()=>{const s=state();return {document:documentOf(),selectedId:s.selection?.kind==='lyric'?s.selection.id:null,legacy:false,recording:false};},onAction,onMore:()=>{},motionPanel,wordSize:true});
 const element=el('div',{class:'studio-lyric-edit'},quick.element);
 function refresh(){quick.refresh();const s=state(),id=selectedId();if(!id)return;refreshCut();const layout=s.project.views[s.viewId]?.layout[id];if(layout){size.value=layout.fontScale;sizeValue.textContent=Math.round(layout.fontScale*1000)/10+'%';}}
 return {element,refresh,dispose(){quick.dispose();}};
}
