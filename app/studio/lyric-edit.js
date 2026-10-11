// "この歌詞を編集" in STUDIO: the same panel the sequence has (動き / 色 / 書体, one word's colour, all lyrics at once),
// plus the code motions and effects of the workshop as picture cards. It edits the STUDIO project through its commands.
import {createLyricQuick} from '../lyric-quick.js?v=6';
import {cleanMotion,graphemes} from '../lyric-motion.js?v=26';
import {cleanWordColors,setWordColor,colorLyricRuns} from '../lyric-style.js';
import {DAILY_CODE_MOTIONS} from '../code-motion-daily.js';
import {approveStudioCode} from './code-trust.js';
import {el} from './dom.js';

const HEX=/^#[\da-f]{6}$/i;
// the per-word colours of a lyric are the colours of its runs
export function colorsOf(lyric){let pos=0;const out=[];for(const r of lyric.runs||[]){const len=(r.text||'').length;if(r.color&&HEX.test(r.color))out.push({start:pos,end:pos+len,color:r.color});pos+=len;}return out;}
const eventOf=l=>({id:l.id,kind:'line',decision:'lyric',text:l.text,raw:l.text,runs:(l.runs?.length?l.runs:[{text:l.text}]).map(r=>({text:r.text,emphasis:!!r.emphasis})),colors:colorsOf(l),motion:l.motion||{}});
// the new motion: the sequence's own normaliser decides what a patch means; STUDIO-only fields (font assets) are kept
export const mergeMotion=(old,patch)=>({...(old||{}),...cleanMotion({...cleanMotion(old||{}),...patch})});
/** New runs after one word's colour changed: the grapheme ids stay, so saved line breaks keep working. */
export function recolorRuns(lyric,start,end,color){
 const text=lyric.runs.map(r=>r.text).join(''),ids=lyric.runs.flatMap((r,ri)=>graphemes(r.text||'').map((_,i)=>r.glyphIds?.[i]??`${r.id??ri}:${i}`));
 const colors=setWordColor(colorsOf(lyric),text,start,end,color),plain=lyric.runs.map(r=>({text:r.text,emphasis:!!r.emphasis})),next=colorLyricRuns(plain,colors);
 let cursor=0;return next.map(r=>{const n=graphemes(r.text).length,glyphIds=ids.slice(cursor,cursor+n);cursor+=n;return {...r,id:glyphIds[0]?.split(':')[0]||crypto.randomUUID(),glyphIds};});
}

export function createLyricEdit(controller){
 const state=()=>controller.get(),find=id=>state().project.lyrics.find(l=>l.id===id);
 const play=async id=>{const l=find(id);if(l)await controller.seek(l.startUs);};
 async function onAction(a){
  const s=state(),p=s.project;
  if(a.type==='select-lyric'){controller.select({kind:'lyric',id:a.id});return;}
  if(a.type==='preview-lyric'){await play(a.id);return;}
  if(a.type==='lyric-style'){
   if(typeof a.patch?.font==='string'&&/^(local:|file:)/.test(a.patch.font))throw new Error('PCのフォントやフォントファイルは、シーケンスで選んでから送ってください。ここでは内蔵の書体を選べます。');
   const targets=a.scope==='all'?p.lyrics:[find(a.id)].filter(Boolean);if(!targets.length)return;
   if(a.patch?.code?.source)approveStudioCode(a.patch.code.source);
   const commands=targets.map(l=>({type:'setLyricAppearance',id:l.id,patch:{motion:mergeMotion(l.motion,a.patch||{})}}));
   await controller.dispatch(commands.length===1?commands[0]:{type:'batch',commands});
   if(a.replay)await play(a.id);
   return;
  }
  if(a.type==='word-color'){
   const l=find(a.id);if(!l)return;
   await controller.dispatch({type:'setLyricText',id:l.id,text:l.text,runs:recolorRuns(l,a.start,a.end,a.color)});
   return;
  }
 }
 // the panel compares the document by identity to notice "the lyrics changed while a font was loading": keep it the same object until the lyrics really change
 let cache={key:'',document:null};
 const documentOf=()=>{const s=state(),key=s.project.id+':'+s.editVersion;if(cache.key!==key)cache={key,document:{events:s.project.lyrics.map(eventOf)}};return cache.document;};
 const quick=createLyricQuick({getState:()=>{const s=state();return {document:documentOf(),selectedId:s.selection?.kind==='lyric'?s.selection.id:null,legacy:false,recording:false};},onAction,onMore:()=>{},customFonts:false});
 // the workshop's code motions and effects as picture cards (the same previews as the samples page)
 const apply=(item,scopeAll)=>onAction({type:'lyric-style',id:state().selection?.id,scope:scopeAll.checked?'all':'line',patch:{code:{version:1,source:item.source},recipe:null},replay:true});
 const scopeAll=el('input',{type:'checkbox','aria-label':'全歌詞に適用'}),status=el('p',{class:'hint','data-testid':'code-card-status',role:'status'});
 const group=(title,items,folder,open)=>{const box=el('details',{class:'lq-codes'},el('summary',{},title+'（'+items.length+'）')),grid=el('div',{class:'lq-code-grid'});box.open=!!open;
  for(const item of items){const b=el('button',{type:'button',class:'lq-code-card','data-key':item.key,title:item.desc||item.name,'aria-label':'動き '+item.name},el('img',{src:`./guide/samples/${folder}-${item.key}.jpg`,alt:'',loading:'lazy'}),el('span',{},item.name));
   b.onclick=()=>apply(item,scopeAll).then(()=>{status.textContent='「'+item.name+'」を反映しました。';}).catch(e=>{status.textContent=e.message;});grid.append(b);}
  box.append(grid);return box;};
 const texts=DAILY_CODE_MOTIONS.filter(m=>m.shelf!=='effect'),effects=DAILY_CODE_MOTIONS.filter(m=>m.shelf==='effect'&&!m.key.startsWith('bg-'));
 const codes=el('section',{class:'lq-code-motions','aria-label':'コードの動きとエフェクト'},el('h4',{},'コードの動き・エフェクト'),el('label',{class:'lq-scope'},scopeAll,' 全歌詞に適用'),group('文字の動き',texts,'codetext',true),group('文字つきのエフェクト',effects,'effect',false),status);
 const element=el('div',{class:'studio-lyric-edit'},quick.element,codes);
 return {element,refresh(){quick.refresh();},dispose(){quick.dispose();}};
}
