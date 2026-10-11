// "おまかせ" in STUDIO's right column: one button to decide the motions, backgrounds and palette; 前の案 / 次の案 to walk through the plans;
// ここだけ変える to re-roll one part. Every step is one undoable batch (studio/omakase.js builds it).
import {el,button} from './dom.js';
import {MOODS,MOOD_AUTO,newSeeds,planOmakase,omakaseCommands,describePlan} from './omakase.js';

export function createOmakasePanel(controller){
 const state={mood:MOOD_AUTO,history:[],index:-1,projectId:'',plan:null};
 const status=el('p',{class:'hint',role:'status','data-testid':'omakase-status'}),summary=el('div',{class:'omakase-summary','data-testid':'omakase-summary'});
 const mood=el('select',{'aria-label':'雰囲気'},el('option',{value:MOOD_AUTO},'おまかせ'),...MOODS.map(m=>el('option',{value:m.id},m.name)));
 const withBg=el('input',{type:'checkbox','aria-label':'背景も足す',checked:true}),withColor=el('input',{type:'checkbox','aria-label':'配色も変える',checked:true}),withSize=el('input',{type:'checkbox','aria-label':'大きさも変える',checked:true});
 const counter=el('span',{class:'omakase-counter'},'');
 const run=fn=>Promise.resolve().then(fn).then(()=>{status.textContent='';render();}).catch(e=>{status.textContent=e.name==='AbortError'?'':(e.message||String(e));});
 const project=()=>controller.get().project;
 function sync(){const id=project().id;if(state.projectId!==id){state.projectId=id;state.history=[];state.index=-1;state.plan=null;}}
 async function apply(entry){
  const p=project();
  if(!p.lyrics.length&&!entry.parts.bg)throw new Error('歌詞がありません。シーケンスで歌詞を入れてから送ってください。');
  const plan=planOmakase(p,{mood:entry.mood,seeds:entry.seeds}),command=omakaseCommands(p,plan,{parts:entry.parts});
  if(!command)throw new Error('変える所がありません。');
  await controller.dispatch(command);
  state.plan=plan;
 }
 const parts=()=>({text:true,bg:withBg.checked,color:withColor.checked,size:withSize.checked});
 const fresh=(base={})=>({mood:mood.value,seeds:newSeeds(),parts:parts(),...base});
 const push=async entry=>{state.history=state.history.slice(0,state.index+1);state.history.push(entry);state.index=state.history.length-1;await apply(entry);};
 const create=()=>run(()=>{sync();return push(fresh());});
 const next=()=>run(()=>{sync();if(state.index<state.history.length-1){state.index++;return apply(state.history[state.index]);}return push(fresh());});
 const back=()=>run(()=>{sync();if(state.index<=0)throw new Error('これより前の案はありません。');state.index--;return apply(state.history[state.index]);});
 // a re-roll that comes out the same as before is useless to look at: roll again (a few times) until this part really differs
 const PART_KEY={text:'lines',bg:'blocks',color:'palette',size:'sizes'};
 const only=part=>run(()=>{sync();const base=state.history[state.index]||fresh(),p=project(),was=JSON.stringify(planOmakase(p,{mood:base.mood,seeds:base.seeds})[PART_KEY[part]]);
  let seeds=base.seeds;for(let i=0;i<12;i++){seeds={...base.seeds,[part]:newSeeds()[part]};if(JSON.stringify(planOmakase(p,{mood:base.mood,seeds})[PART_KEY[part]])!==was)break;}
  return push({...base,seeds,parts:parts()});});
 function render(){
  sync();const d=state.plan?describePlan(state.plan):null;
  counter.textContent=state.history.length?`${state.index+1} / ${state.history.length}`:'';
  summary.replaceChildren(...(d?[
   el('div',{},el('b',{},'雰囲気　'),d.mood+'　／　'+d.palette),
   el('div',{},el('b',{},'動き　'),d.motions.join('、')),
   el('div',{},el('b',{},'背景　'),d.backgrounds.join('、')),...(d.size?[el('div',{},el('b',{},'大きさ　'),`${Math.round(d.size.min*1000)/10}〜${Math.round(d.size.max*1000)/10}`)]:[])]:[el('div',{class:'hint'},'まだ作っていません。')]));
 }
 const element=el('section',{class:'omakase','aria-label':'おまかせ','data-testid':'omakase-panel'},
  el('h2',{title:'歌詞の動き・背景・配色をまとめて決めます。歌詞の文字と時刻、曲、UNFOLD作品は変わりません。'},'おまかせ ',el('small',{},'動き・背景・配色をまとめて決める')),
  button(controller,'おまかせで作る',create,{class:'primary wide','data-testid':'omakase-create'}),
  el('label',{class:'omakase-mood'},el('span',{},'雰囲気'),mood),
  el('div',{class:'omakase-row'},button(controller,'◀ 前の案',back,{'data-testid':'omakase-back'}),button(controller,'次の案 ▶',next,{'data-testid':'omakase-next'}),counter),
  el('div',{class:'omakase-row omakase-checks'},el('label',{class:'omakase-check'},withBg,' 背景も足す'),el('label',{class:'omakase-check'},withColor,' 配色も変える'),el('label',{class:'omakase-check'},withSize,' 大きさも変える')),
  summary,
  el('div',{class:'omakase-row'},el('span',{class:'omakase-label'},'ここだけ変える'),button(controller,'動き',()=>only('text'),{'data-testid':'omakase-only-text'}),button(controller,'背景',()=>only('bg'),{'data-testid':'omakase-only-bg'}),button(controller,'配色',()=>only('color'),{'data-testid':'omakase-only-color'}),button(controller,'大きさ',()=>only('size'),{'data-testid':'omakase-only-size'})),
  status);
 render();
 return {element,refresh:render};
}
