import {openCodeMotionEditor} from './code-motion-editor.js';
import {savedLyricFonts,lyricFontLabel} from './lyric-fonts.js';
import {createFontPicker} from './lyric-font-picker.js';
import {BUILTIN_MOTIONS,LAYOUTS,ENTRANCES,SUSTAINS,EXITS,normalizeRecipe} from './lyric-recipe.js';
import {cleanMotion} from './lyric-motion.js?v=26';
import {lyricRuns} from './lyric-document.js?v=4';
import {createMotionLibrary,buildMotionFile,parseMotionFile,motionAIPrompt} from './lyric-library.js';
import {createLyricPainter,prepareMotionFont} from './lyric-painter.js?v=12';
const node=(tag,text)=>Object.assign(document.createElement(tag),text==null?{}:{textContent:text});
let active=null;
export function downloadMotion(record){const blob=new Blob([buildMotionFile(record)],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=(record.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'').slice(0,40)||'motion')+'.unfoldmotion';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function openMotionStudio({motion,text='小さな*光*を/明日へつなぐ',onApply=null,applyLabel='この動きを使う'}={}){
 if(motion?.code)return openCodeMotionEditor({motion,text,onApply});
 active?.close();
 if(!document.querySelector('link[data-motion-studio]')){const link=node('link');link.rel='stylesheet';link.href=new URL('./lyric-studio.css',import.meta.url).href;link.dataset.motionStudio='';document.head.append(link)}
 const dialog=node('dialog');dialog.className='motion-studio';dialog.setAttribute('aria-label','モーション集・自作');dialog.addEventListener('keydown',e=>e.stopPropagation());
 let current=cleanMotion(motion?.recipe?motion:BUILTIN_MOTIONS[0].motion),time=2.1,playing=true,last=0,raf=0,closed=false,fontToken=0;
 const painter=createLyricPainter(),library=createMotionLibrary();
 const head=node('header'),title=node('h2','モーション集・自作'),close=node('button','閉じる ×');close.type='button';close.dataset.action='close-studio';close.onclick=()=>dialog.close();head.append(title,close);dialog.append(head);
 const body=node('div');body.className='ms-body';const form=node('div'),view=node('div');form.className='ms-form';view.className='ms-view';body.append(form,view);dialog.append(body);
 const field=(label,input,parent=form)=>{const l=node('label',label);l.className='ms-field';l.append(input);parent.append(l);return input};
 const button=(label,fn,parent,primary=false)=>{const b=node('button',label);b.type='button';if(primary)b.className='ms-primary';b.onclick=async()=>{try{await fn()}catch(e){status.textContent=e.message}};parent.append(b);return b};
 const select=(label,options,onChange)=>{const s=node('select');for(const [v,label]of Object.entries(options))s.append(new Option(label,v));s.onchange=()=>{onChange(s.value);changed()};return field(label,s)};
 const pick=node('select');field('見本・保存したモーション',pick);
 function choices(){pick.replaceChildren();const built=node('optgroup');built.label='標準のモーション';for(const item of BUILTIN_MOTIONS)built.append(new Option(item.name,item.id));pick.append(built);try{const saved=library.list().filter(i=>!i.motion.code);if(saved.length){const group=node('optgroup');group.label='保存したモーション';for(const item of saved)group.append(new Option(item.name,item.id));pick.append(group)}}catch(e){status.textContent=e.message}}
 const name=field('名前',node('input'));name.maxLength=40;name.value='マイモーション';
 const layout=select('構成',LAYOUTS,v=>current.recipe.layout=v);
 const enter=select('登場',ENTRANCES,v=>current.recipe.enter=v);
 const effects=node('fieldset'),legend=node('legend','表示中の動き（3種類まで）');effects.append(legend);form.append(effects);const checks=[];
 for(const [value,label]of Object.entries(SUSTAINS)){const l=node('label'),i=node('input');i.type='checkbox';i.value=value;i.onchange=()=>{const selected=checks.filter(x=>x.checked).map(x=>x.value);if(selected.length>3){i.checked=false;status.textContent='表示中の動きは3種類まで組み合わせられます。';return}current.recipe.sustain=selected;changed()};l.append(i,node('span',label));effects.append(l);checks.push(i)}
 const exit=select('退場',EXITS,v=>current.recipe.exit=v);
 const range=(label,key,min,max,step,recipe=false)=>{const i=node('input');Object.assign(i,{type:'range',min,max,step});i.oninput=()=>{(recipe?current.recipe:current)[key]=Number(i.value);changed()};return field(label,i)};
 const strength=range('表示中の強さ','strength',0,1,.05,true),stagger=range('文字の時間差','stagger',0,.2,.01,true),speed=range('動きの速さ','speed',.5,2,.1),size=range('文字の大きさ','size',32,160,1);
 const font=select('書体',{gothic:'ゴシック',mincho:'明朝',round:'丸ゴシック',dela:'デラゴシック',marker:'手書き',dot:'ドット'},v=>{current.font=v;prepare()});
 // PC fonts and font files, not only the six built-in ones
 const fontPicker=createFontPicker({onStatus:m=>{status.textContent=m},onPick:async(key,label)=>{current.font=key;if(![...font.options].some(o=>o.value===key))font.append(new Option(label||lyricFontLabel(key),key));font.value=key;changed();status.textContent='書体「'+(label||lyricFontLabel(key))+'」を反映しました。';await prepare()}});
 form.append(fontPicker.element);
 const color=field('文字色',node('input')),accent=field('アクセント色',node('input'));color.type=accent.type='color';color.oninput=()=>{current.color=color.value;changed()};accent.oninput=()=>{current.emphasisColor=accent.value;changed()};
 const canvas=node('canvas');canvas.width=1280;canvas.height=720;canvas.setAttribute('aria-label','モーションのプレビュー');view.append(canvas);const ctx=canvas.getContext('2d');
 const transport=node('div');transport.className='ms-transport';view.append(transport);const play=button('一時停止',()=>{playing=!playing;draw()},transport),scrub=node('input');Object.assign(scrub,{type:'range',min:0,max:6,step:.01,value:time});scrub.setAttribute('aria-label','モーションの再生位置');scrub.oninput=()=>{time=Number(scrub.value);playing=false;draw()};const counter=node('output');counter.className='ms-time';transport.append(scrub,counter);button('表示中から再生',()=>{time=1.9;playing=true},transport);
 const words=field('試す言葉（/ で改行、*言葉* で強調）',node('textarea'),view);words.value=String(text).slice(0,2000);words.maxLength=2000;words.rows=2;words.oninput=()=>{painter.clear();prepare();draw()};
 const bg=field('プレビュー背景',node('select'),view);for(const [v,l]of [['dark','暗い'],['light','明るい'],['busy','動く模様']])bg.append(new Option(l,v));bg.onchange=draw;
 const actions=node('div');actions.className='ms-actions';view.append(actions);
 const record=()=>({name:name.value.trim(),motion:cleanMotion(current)});
 if(onApply)button(applyLabel,async()=>{await onApply(cleanMotion(current));dialog.close()},actions,true);
 button('名前を付けて保存',()=>{const item=library.save(record());choices();pick.value=item.id;status.textContent=`「${item.name}」をこのブラウザに保存しました。`},actions);
 button('ファイルに保存',()=>downloadMotion(record()),actions);
 const upload=node('input');upload.type='file';upload.accept='.unfoldmotion,.json';upload.hidden=true;view.append(upload);button('ファイルから読み込み',()=>upload.click(),actions);upload.onchange=async()=>{try{const file=upload.files[0];if(!file)return;if(file.size>131072)throw Error('モーションファイルが大きすぎます。');load(parseMotionFile(await file.text()));status.textContent='読み込みました。試してから保存・適用できます。'}catch(e){status.textContent=e.message}finally{upload.value=''}};
 const status=node('p');status.className='ms-status';status.setAttribute('role','status');view.append(status);
 const note=node('p','保存するのは動きのレシピです。試す言葉や音楽・画像は含みません。');note.className='ms-small';view.append(note);
 const advanced=node('details');advanced.append(node('summary','AIに作ってもらう・レシピを編集'));view.append(advanced);
 const explanation=node('p','依頼文をコピーしてAIに希望を伝え、返されたJSONを下に貼り付けてください。対応する構成と動きの組み合わせを作れます。');explanation.className='ms-small';advanced.append(explanation);
 const json=node('textarea');json.className='ms-json';json.spellcheck=false;json.setAttribute('aria-label','モーションのJSON');const ai=button('AIへの依頼文をコピー',async()=>{const prompt=motionAIPrompt();try{await navigator.clipboard.writeText(prompt);status.textContent='AIへの依頼文をコピーしました。希望の動きを書き足してください。'}catch{json.value=prompt;json.focus();json.select();status.textContent='依頼文を選択しました。手動でコピーしてください。'}},advanced);ai.dataset.action='ai-prompt';advanced.append(json);button('JSONをプレビューに反映',()=>{load(parseMotionFile(json.value));status.textContent='レシピを確認してプレビューに反映しました。'},advanced);
 function sync(){for(const item of savedLyricFonts())if(![...font.options].some(o=>o.value===item.key))font.append(new Option(item.label,item.key));if(![...font.options].some(o=>o.value===current.font))font.append(new Option(lyricFontLabel(current.font),current.font));layout.value=current.recipe.layout;enter.value=current.recipe.enter;exit.value=current.recipe.exit;strength.value=current.recipe.strength;stagger.value=current.recipe.stagger;speed.value=current.speed;size.value=current.size;font.value=current.font;color.value=current.color;accent.value=current.emphasisColor;for(const i of checks)i.checked=current.recipe.sustain.includes(i.value);json.value=buildMotionFile(record())}
 function load(item){if(item.motion.code){dialog.close();openCodeMotionEditor({motion:item.motion,text:words.value,onApply});return;}current=cleanMotion(item.motion);name.value=item.name;sync();time=0;playing=true;prepare()}
 pick.onchange=()=>{try{const item=[...BUILTIN_MOTIONS,...library.list()].find(x=>x.id===pick.value);if(item)load(item)}catch(e){status.textContent=e.message}};
 function changed(){current=cleanMotion(current);painter.clear();json.value=buildMotionFile({...record(),name:name.value.trim()||'マイモーション'});draw()}
 async function prepare(){const token=++fontToken;try{await prepareMotionFont(current,words.value);if(token===fontToken&&!closed){painter.clear();draw()}}catch(e){if(!closed)status.textContent=e.message}}
 function draw(){ctx.clearRect(0,0,1280,720);ctx.fillStyle=bg.value==='light'?'#e8ece1':'#101b1b';ctx.fillRect(0,0,1280,720);if(bg.value==='busy'){for(let i=0;i<6;i++){ctx.save();ctx.translate(640+Math.sin(time*.4+i)*390,360+Math.cos(time*.5+i)*210);ctx.rotate(i+time*.2);ctx.fillStyle=['#24344f','#422740','#174847'][i%3];ctx.fillRect(-150,-150,300,300);ctx.restore()}}
  painter.draw(ctx,{id:'preview',text:words.value,runs:lyricRuns(words.value),start:0,end:6,motion:current},time,{width:1280,height:720,bpm:120});scrub.value=time;counter.textContent=time.toFixed(2)+' / 6.00';play.textContent=playing?'一時停止':'再生';
 }
 function tick(now){if(closed)return;if(playing){time=(time+Math.min(.1,(now-last)/1000))%6;draw()}last=now;raf=requestAnimationFrame(tick)}
 dialog.addEventListener('close',()=>{closed=true;cancelAnimationFrame(raf);painter.clear();dialog.remove();if(active===dialog)active=null},{once:true});document.body.append(dialog);active=dialog;choices();sync();dialog.showModal();prepare();draw();raf=requestAnimationFrame(tick);return dialog;
}
