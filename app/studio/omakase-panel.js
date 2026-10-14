// "おまかせ" in STUDIO's right column: one button to decide the motions, backgrounds and palette; 前の案 / 次の案 to walk through the plans;
// ここだけ変える to re-roll one part. Every step is one undoable batch (studio/omakase.js builds it).
import {el,button} from './dom.js';
import {MOODS,MOOD_AUTO,COLOR_FAMILIES,FAMILY_AUTO,LAYOUT_SPREAD,LAYOUT_CENTER,SIZE_PCT,newSeeds,planOmakase,omakaseCommands,opacityCommands,uniformSizes,describePlan} from './omakase.js';

export function createOmakasePanel(controller){
 const state={mood:MOOD_AUTO,history:[],index:-1,projectId:'',plan:null};
 const status=el('p',{class:'hint',role:'status','data-testid':'omakase-status'}),summary=el('div',{class:'omakase-summary','data-testid':'omakase-summary'});
 const mood=el('select',{'aria-label':'雰囲気'},el('option',{value:MOOD_AUTO},'おまかせ'),...MOODS.map(m=>el('option',{value:m.id},m.name)));
 const family=el('select',{'aria-label':'配色の系統','data-testid':'omakase-family'},el('option',{value:FAMILY_AUTO},'雰囲気におまかせ'),...COLOR_FAMILIES.map(f=>el('option',{value:f.id},f.name)));
 const layoutSel=el('select',{'aria-label':'配置と語の大小','data-testid':'omakase-layout'},el('option',{value:LAYOUT_SPREAD},'ばらけさせる（位置・語の大小）'),el('option',{value:LAYOUT_CENTER},'真ん中に揃える'));
 const withBg=el('input',{type:'checkbox','aria-label':'背景も足す',checked:true}),withColor=el('input',{type:'checkbox','aria-label':'配色も変える',checked:true}),withSize=el('input',{type:'checkbox','aria-label':'大きさも変える',checked:true});
 const counter=el('span',{class:'omakase-counter'},'');
 // two sliders for all lyrics: the average size (percent of the picture's shorter side) and the opacity
 const sizeSlider=el('input',{type:'range',min:SIZE_PCT.min,max:SIZE_PCT.max,step:1,value:SIZE_PCT.default,'aria-label':'文字の大きさの目安（%）','data-testid':'omakase-size'}),sizeOut=el('output',{},SIZE_PCT.default+'%');
 const opacitySlider=el('input',{type:'range',min:10,max:100,step:5,value:100,'aria-label':'文字の不透明度（%）','data-testid':'omakase-opacity'}),opacityOut=el('output',{},'100%');
 const run=fn=>Promise.resolve().then(fn).then(()=>{status.textContent='';render();}).catch(e=>{status.textContent=e.name==='AbortError'?'':(e.message||String(e));});
 const project=()=>controller.get().project;
 function sync(){const id=project().id;if(state.projectId!==id){state.projectId=id;state.history=[];state.index=-1;state.plan=null;}}
 async function apply(entry){
  const p=project();
  if(!p.lyrics.length&&!entry.parts.bg)throw new Error('歌詞がありません。シーケンスで歌詞を入れてから送ってください。');
  const plan=planOmakase(p,{mood:entry.mood,family:entry.family,sizePct:entry.sizePct,layout:entry.layout,seeds:entry.seeds}),command=omakaseCommands(p,plan,{parts:entry.parts});
  if(!command)throw new Error('変える所がありません。');
  await controller.dispatch(command);
  state.plan=plan;
 }
 const parts=()=>({text:true,bg:withBg.checked,color:withColor.checked,size:withSize.checked,layout:true});
 const fresh=(base={})=>({mood:mood.value,family:family.value,layout:layoutSel.value,sizePct:Number(sizeSlider.value),seeds:newSeeds(),parts:parts(),...base});
 const push=async entry=>{state.history=state.history.slice(0,state.index+1);state.history.push(entry);state.index=state.history.length-1;await apply(entry);};
 const create=()=>run(()=>{sync();return push(fresh());});
 const next=()=>run(()=>{sync();if(state.index<state.history.length-1){state.index++;return apply(state.history[state.index]);}return push(fresh());});
 const back=()=>run(()=>{sync();if(state.index<=0)throw new Error('これより前の案はありません。');state.index--;return apply(state.history[state.index]);});
 // a re-roll that comes out the same as before is useless to look at: roll again (a few times) until this part really differs
 const PART_KEY={text:'lines',bg:'blocks',color:'palette',size:'sizes',layout:'places'};
 // (the colour family chosen in the select is read when the colours are re-rolled; the other parts keep the family of the plan on screen)
 const only=part=>run(()=>{sync();const shown=state.history[state.index]||fresh(),base=part==='color'?{...shown,family:family.value}:shown,p=project(),was=JSON.stringify(planOmakase(p,{mood:shown.mood,family:shown.family,sizePct:shown.sizePct,layout:shown.layout,seeds:shown.seeds})[PART_KEY[part]]);
  let seeds=base.seeds;for(let i=0;i<12;i++){seeds={...base.seeds,[part]:newSeeds()[part]};if(JSON.stringify(planOmakase(p,{mood:base.mood,family:base.family,sizePct:base.sizePct,layout:base.layout,seeds})[PART_KEY[part]])!==was)break;}
  return push({...base,seeds,parts:parts()});});
 // the sliders act on every lyric at once and are one undoable step each (the label follows the thumb while it is dragged)
 async function setSize(pct){
  sync();const p=project();if(!p.lyrics.length)throw new Error('歌詞がありません。');
  const entry=state.history[state.index];let plan;
  if(entry){entry.sizePct=pct;plan=planOmakase(p,{mood:entry.mood,family:entry.family,sizePct:pct,layout:entry.layout,seeds:entry.seeds});}
  else plan={sizes:uniformSizes(p,pct)};
  const command=omakaseCommands(p,plan,{parts:{text:false,bg:false,color:false,size:true,layout:true}});
  if(!command)return;
  await controller.dispatch(command);if(entry)state.plan=plan;
 }
 async function setOpacity(pct){
  sync();const p=project();if(!p.lyrics.length)throw new Error('歌詞がありません。');
  const command=opacityCommands(p,pct/100);if(command)await controller.dispatch(command);
 }
 sizeSlider.addEventListener('input',()=>{sizeOut.textContent=sizeSlider.value+'%';});sizeSlider.addEventListener('change',()=>run(()=>setSize(Number(sizeSlider.value))));
 opacitySlider.addEventListener('input',()=>{opacityOut.textContent=opacitySlider.value+'%';});opacitySlider.addEventListener('change',()=>run(()=>setOpacity(Number(opacitySlider.value))));
 // choosing a colour family re-rolls the colours at once when there is a plan on screen
 family.addEventListener('change',()=>{if(state.plan)run(()=>only('color'));});
 function render(){
  sync();const d=state.plan?describePlan(state.plan):null;
  counter.textContent=state.history.length?`${state.index+1} / ${state.history.length}`:'';
  {const p=project(),entry=state.history[state.index];
   // the size slider keeps its own value (default 12 %) and shows the plan on screen when walking through plans; the opacity slider shows the first lyric's
   if(entry?.sizePct!=null){const pct=Math.round(Math.min(SIZE_PCT.max,Math.max(SIZE_PCT.min,entry.sizePct)));sizeSlider.value=pct;sizeOut.textContent=pct+'%';}
   if(p.lyrics.length){const o=Math.round((p.lyrics[0].opacity??1)*100/5)*5;opacitySlider.value=Math.min(100,Math.max(10,o));opacityOut.textContent=opacitySlider.value+'%';}}
  summary.replaceChildren(...(d?[
   el('div',{},el('b',{},'雰囲気　'),d.mood+'　／　'+d.palette),
   el('div',{},el('b',{},'動き　'),d.motions.join('、')),
   el('div',{},el('b',{},'背景　'),d.backgrounds.join('、')),el('div',{},el('b',{},'配置　'),d.layout),...(d.size?[el('div',{},el('b',{},'大きさ　'),`${Math.round(d.size.min*1000)/10}〜${Math.round(d.size.max*1000)/10}`)]:[])]:[el('div',{class:'hint'},'まだ作っていません。')]));
 }
 const element=el('section',{class:'omakase','aria-label':'おまかせ','data-testid':'omakase-panel'},
  el('h2',{title:'歌詞の動き・背景・配色をまとめて決めます。歌詞の文字と時刻、曲、UNFOLD作品は変わりません。'},'おまかせ ',el('small',{},'動き・背景・配色をまとめて決める')),
  button(controller,'おまかせで作る',create,{class:'primary wide','data-testid':'omakase-create'}),
  el('label',{class:'omakase-mood'},el('span',{},'雰囲気'),mood),
  el('label',{class:'omakase-mood'},el('span',{},'配色の系統'),family),
  el('label',{class:'omakase-mood'},el('span',{},'文字の配置'),layoutSel),
  el('div',{class:'omakase-row'},button(controller,'◀ 前の案',back,{'data-testid':'omakase-back'}),button(controller,'次の案 ▶',next,{'data-testid':'omakase-next'}),counter),
  el('div',{class:'omakase-row omakase-checks'},el('label',{class:'omakase-check'},withBg,' 背景も足す'),el('label',{class:'omakase-check'},withColor,' 配色も変える'),el('label',{class:'omakase-check'},withSize,' 大きさも変える')),
  el('div',{class:'omakase-sliders'},
   el('label',{class:'omakase-slider',title:'全部の歌詞の文字の大きさの平均（画面の短い辺に対する%）。長い歌詞は収まるように小さくなります。'},el('span',{},'文字の大きさ'),sizeSlider,sizeOut),
   el('label',{class:'omakase-slider',title:'全部の歌詞の文字の濃さ（100%で不透明）'},el('span',{},'文字の不透明度'),opacitySlider,opacityOut)),
  summary,
  el('div',{class:'omakase-row'},el('span',{class:'omakase-label'},'ここだけ変える'),button(controller,'動き',()=>only('text'),{'data-testid':'omakase-only-text'}),button(controller,'背景',()=>only('bg'),{'data-testid':'omakase-only-bg'}),button(controller,'配色',()=>only('color'),{'data-testid':'omakase-only-color'}),button(controller,'配置・大小',()=>only('layout'),{'data-testid':'omakase-only-layout'}),button(controller,'大きさ',()=>only('size'),{'data-testid':'omakase-only-size'})),
  status);
 render();
 return {element,refresh:render};
}
