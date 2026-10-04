import {BUILTIN_MOTIONS} from '../lyric-recipe.js';
import {lyricRuns} from '../lyric-document.js?v=2';
import {createLyricPainter,prepareMotionFont} from '../lyric-painter.js';
import {createMotionLibrary} from '../lyric-library.js';
import {openMotionStudio,downloadMotion} from '../lyric-studio.js';
const $=id=>document.getElementById(id),canvas=$('motion-preview'),ctx=canvas.getContext('2d'),painter=createLyricPainter(),library=createMotionLibrary();
let selected=BUILTIN_MOTIONS[0],time=1.9,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,last=0,token=0;
function draw(){ctx.fillStyle='#101b1b';ctx.fillRect(0,0,1280,720);painter.draw(ctx,{id:'gallery',text:$('preview-words').value,runs:lyricRuns($('preview-words').value),start:0,end:6,motion:selected.motion},time,{width:1280,height:720,bpm:120});$('motion-play').textContent=playing?'一時停止':'再生'}
async function prepare(){const id=++token;try{await prepareMotionFont(selected.motion,$('preview-words').value);if(id===token){painter.clear();draw()}}catch(e){$('motion-status').textContent=e.message}}
for(const item of BUILTIN_MOTIONS){const b=document.createElement('button'),title=document.createElement('b'),desc=document.createElement('small');title.textContent=item.name;desc.textContent=item.description;b.append(title,desc);b.type='button';b.dataset.id=item.id;b.setAttribute('aria-pressed',String(item===selected));b.onclick=()=>{selected=item;time=0;playing=true;for(const x of $('motion-choices').children)x.setAttribute('aria-pressed',String(x===b));prepare()};$('motion-choices').append(b)}
$('motion-play').onclick=()=>{playing=!playing;draw()};$('motion-restart').onclick=()=>{time=0;playing=true};$('motion-sustain').onclick=()=>{time=1.9;playing=true};$('preview-words').oninput=()=>{painter.clear();prepare()};
$('motion-add').onclick=()=>{try{const item=library.save(selected);$('motion-status').textContent=`「${item.name}」を追加しました。歌詞MVのモーション集から選べます。`}catch(e){$('motion-status').textContent=e.message}};
$('motion-download').onclick=()=>{try{downloadMotion(selected)}catch(e){$('motion-status').textContent=e.message}};
$('motion-edit').onclick=()=>openMotionStudio({motion:selected.motion,text:$('preview-words').value,onApply:motion=>{selected={name:'作成したモーション',motion};painter.clear();prepare();for(const b of $('motion-choices').children)b.setAttribute('aria-pressed','false')},applyLabel:'このページで試す'});
function tick(now){if(playing&&!document.hidden&&!document.querySelector('dialog.motion-studio[open]')){time=(time+Math.min(.1,(now-last)/1000))%6;draw()}last=now;requestAnimationFrame(tick)}prepare();requestAnimationFrame(tick);
