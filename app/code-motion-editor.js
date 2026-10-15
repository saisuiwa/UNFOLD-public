import {createCodeMotionRuntime} from './code-motion-runtime.js';
import {approveCodeMotion} from './code-motion-format.js';
import {getCodeMotionFont} from './lyric-fonts.js';
import {cleanMotion} from './lyric-motion.js?v=28';
import {lyricRuns} from './lyric-document.js?v=4';
import {createMotionLibrary,parseMotionFile,buildMotionFile} from './lyric-library.js';
import {CODE_MOTION_PRESETS,codeMotionPrompt} from './code-motion-presets.js';
const node=(tag,text)=>Object.assign(document.createElement(tag),text==null?{}:{textContent:text});
let active;
export function openCodeMotionEditor({motion={},text='小さな*光*を/明日へつなぐ',runs=null,onApply=null,applyLabel='追加してこの歌詞に使う',onSaved=()=>{}}={}){
 active?.close();
 if(!document.querySelector('link[data-motion-studio]')){const link=node('link');link.rel='stylesheet';link.href=new URL('./lyric-studio.css',import.meta.url).href;link.dataset.motionStudio='';document.head.append(link)}
 const dialog=node('dialog');dialog.className='motion-studio code-motion-editor';dialog.setAttribute('aria-label','コードでモーションを追加');dialog.addEventListener('keydown',e=>e.stopPropagation());
 let runtime=null,generation=0,busy=false,redraw=false,playing=false,t=0,last=0,raf=0,closed=false,checked='',base=cleanMotion(motion);
 const header=node('header'),title=node('h2','＋ モーションを作る'),close=node('button','閉じる ×');close.onclick=()=>dialog.close();header.append(title,close);dialog.append(header);
 const body=node('div');body.className='ms-body';const form=node('div'),view=node('div');form.className='ms-form';view.className='ms-view';body.append(form,view);dialog.append(body);
 function field(label,input,parent=form){const l=node('label',label);l.className='ms-field';l.append(input);parent.append(l);return input}
 function button(label,action,parent=form){const b=node('button',label);b.type='button';b.onclick=async()=>{try{await action()}catch(e){status.textContent=e.message}};parent.append(b);return b}
 const name=field('モーションの名前',node('input'));name.value='マイコードモーション';name.maxLength=40;
 const example=field('ひな形',node('select'));const motionGroup=Object.assign(document.createElement('optgroup'),{label:'文字モーション'}),effectGroup=Object.assign(document.createElement('optgroup'),{label:'エフェクト（文字の後ろや周りの装飾）'});for(const [i,p] of CODE_MOTION_PRESETS.entries())(p.shelf==='effect'?effectGroup:motionGroup).append(new Option(p.name,String(i)));example.append(motionGroup,effectGroup);
 const source=field('JavaScript（Three.js + Troika Text + GSAP）',node('textarea'));source.className='ms-json';source.style.minHeight='390px';source.spellcheck=false;source.maxLength=32000;source.setAttribute('aria-label','モーションのコード');source.value=motion.code?.source||CODE_MOTION_PRESETS[0].source;
 const explanation=node('p','コードをプレビューしてから追加します。作った動きは、このブラウザとプロジェクトに保存でき、ファイルで共有できます。');explanation.className='ms-small';form.append(explanation);
 const docs=node('a','書き方・APIガイド');docs.href=new URL('./guide/code-motions.html',import.meta.url).href;docs.target='_blank';docs.rel='noopener';form.append(docs);
 const canvas=node('canvas');canvas.width=960;canvas.height=540;canvas.setAttribute('aria-label','コードモーションのプレビュー');view.append(canvas);const ctx=canvas.getContext('2d');
 const transport=node('div');transport.className='ms-transport';view.append(transport);
 const play=button('再生',()=>{if(!checked)throw Error('先に「コードをプレビュー」を押してください。');playing=!playing;play.textContent=playing?'一時停止':'再生'},transport);
 const scrub=node('input');Object.assign(scrub,{type:'range',min:0,max:6,step:.01,value:0});scrub.setAttribute('aria-label','コードモーションの再生位置');transport.append(scrub);const counter=node('output');transport.append(counter);
 const words=field('試す言葉（/ で改行、*言葉* で強調）',node('textarea'),view);words.value=String(text).slice(0,2000);words.maxLength=2000;words.rows=2;
 const actions=node('div');actions.className='ms-actions';view.append(actions);
 const status=node('p','ひな形を選んで「コードをプレビュー」。コードは自由に編集できます。');status.className='ms-status';status.setAttribute('role','status');view.append(status);
 const record=()=>({name:name.value.trim(),motion:cleanMotion({...base,recipe:null,code:{version:1,source:source.value}})});
 const clear=()=>{ctx.fillStyle='#101b1b';ctx.fillRect(0,0,960,540)};
 function invalidate(){generation++;runtime?.dispose();runtime=null;checked='';redraw=false;playing=false;play.textContent='再生';clear();status.textContent='変更しました。「コードをプレビュー」で確認してください。'}
 source.oninput=invalidate;words.oninput=()=>{runs=null;invalidate()};example.onchange=()=>{source.value=CODE_MOTION_PRESETS[Number(example.value)].source;name.value=CODE_MOTION_PRESETS[Number(example.value)].name;invalidate()};
 async function render(){if(!runtime||closed)return;if(busy){redraw=true;return}busy=true;redraw=false;const mine=generation,r=runtime,frameTime=t;try{const bitmap=await r.render(frameTime);if(mine===generation&&!closed){clear();ctx.drawImage(bitmap,0,0);scrub.value=frameTime;counter.textContent=frameTime.toFixed(2)+' / 6.00'}bitmap.close()}catch(e){if(mine===generation){invalidate();status.textContent=e.message}}finally{busy=false;if(redraw&&runtime&&!closed){redraw=false;render()}}}
 async function preview(){invalidate();const mine=generation,m=record().motion;status.textContent='日本語の書体と描画を準備しています…';const fontBytes=await getCodeMotionFont(m.font);if(mine!==generation||closed)return;const r=createCodeMotionRuntime();runtime=r;try{const segments=runs||lyricRuns(words.value),plain=segments.map(x=>x.text).join('');await r.prepare({source:m.code.source,text:plain,runs:segments,width:960,height:540,fontSize:84*m.size/72,color:m.color,accent:m.emphasisColor,fontBytes,duration:6,seed:7,bpm:120});const bitmap=await r.render(.8);bitmap.close();if(mine!==generation||closed)return;approveCodeMotion(m.code.source);checked=m.code.source;t=0;playing=true;play.textContent='一時停止';status.textContent='プレビューできました。動きを追加・適用できます。';await render()}catch(e){if(mine===generation){invalidate();status.textContent=e.message}}}
 const previewButton=button('コードをプレビュー',preview,actions);previewButton.className='ms-primary';
 function requireChecked(){if(checked!==source.value)throw Error('変更したコードを先にプレビューしてください。')}
 button(onApply?applyLabel:'ブロックに追加',async()=>{requireChecked();const item=createMotionLibrary().save(record());onSaved(item);if(onApply){await onApply(item.motion);dialog.close()}else status.textContent='「'+item.name+'」を追加しました。'},actions);
 button('共有ファイルに書き出す',()=>{requireChecked();const value=buildMotionFile(record()),url=URL.createObjectURL(new Blob([value],{type:'application/json'})),a=node('a');a.href=url;a.download=(name.value.replace(/[\\/:*?"<>|]/g,'').slice(0,40)||'motion')+'.unfoldmotion';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)},actions);
 const file=node('input');file.type='file';file.accept='.unfoldmotion,.json';file.hidden=true;form.append(file);button('モーションファイルを読み込む',()=>file.click());file.onchange=async()=>{try{const f=file.files[0];if(!f)return;if(f.size>131072)throw Error('モーションファイルが大きすぎます。');const item=parseMotionFile(await f.text());if(!item.motion.code)throw Error('レシピ形式です。「細かく調整」から読み込めます。');invalidate();base=cleanMotion({...item.motion,font:base.font,color:base.color,emphasisColor:base.emphasisColor});source.value=item.motion.code.source;name.value=item.name;status.textContent='読み込みました。内容を確認してプレビューしてください。'}catch(e){status.textContent=e.message}finally{file.value=''}};
 button('AIへの作成依頼をコピー',async()=>{const prompt=codeMotionPrompt();try{await navigator.clipboard.writeText(prompt);status.textContent='作成依頼をコピーしました。AIに希望の演出を添えて渡してください。'}catch{const area=node('textarea');area.value=prompt;view.append(area);area.focus();area.select();status.textContent='依頼文を選択しました。手動でコピーしてください。'}});
 scrub.oninput=()=>{playing=false;play.textContent='再生';t=Number(scrub.value);render()};
 function tick(now){if(closed)return;if(playing){t=(t+Math.min(.1,(now-last)/1000))%6;render()}last=now;raf=requestAnimationFrame(tick)}
 dialog.addEventListener('close',()=>{closed=true;generation++;runtime?.dispose();cancelAnimationFrame(raf);dialog.remove();if(active===dialog)active=null},{once:true});document.body.append(dialog);active=dialog;dialog.showModal();clear();raf=requestAnimationFrame(tick);return dialog;
}
