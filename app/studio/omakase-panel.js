// "おまかせ" in STUDIO's right column: one button to decide the motions, backgrounds and palette; 前の案 / 次の案 to walk through the plans;
// ここだけ変える to re-roll one part. Every step is one undoable batch (studio/omakase.js builds it).
// 演出 "カット割り": instead of one motion per lyric, every lyric is cut into short cuts with their own background, camera, effects, transition, per-character parts
// and prop worlds (studio/cuts/); the plan is stored on each lyric (lyric.cut) and drawn by the compositor.
import {el,button} from './dom.js';
import {createMotionLibrary} from '../lyric-library.js';
import {approveStudioCode,isStudioCodeApproved} from './code-trust.js';
import {MOODS,MOOD_AUTO,COLOR_FAMILIES,FAMILY_AUTO,LAYOUT_SPREAD,LAYOUT_CENTER,SIZE_PCT,newSeeds,planOmakase,omakaseCommands,opacityCommands,uniformSizes,describePlan,extraMotions} from './omakase.js';
import {makeCutPlan,cutCommands,removeCutCommands} from './cuts/apply.js';
import {CUT_DEFAULTS,summarizeCuts} from './cuts/plan.js';
import {ensureCutFonts,measureChar} from './cuts/layer.js';

export function createOmakasePanel(controller){
 const state={mood:MOOD_AUTO,history:[],index:-1,projectId:'',plan:null,cut:null};
 const status=el('p',{class:'hint',role:'status','data-testid':'omakase-status'}),summary=el('div',{class:'omakase-summary','data-testid':'omakase-summary'});
 const mood=el('select',{'aria-label':'雰囲気'},el('option',{value:MOOD_AUTO},'おまかせ'),...MOODS.map(m=>el('option',{value:m.id},m.name)));
 const family=el('select',{'aria-label':'配色の系統','data-testid':'omakase-family'},el('option',{value:FAMILY_AUTO},'雰囲気におまかせ'),...COLOR_FAMILIES.map(f=>el('option',{value:f.id},f.name)));
 const layoutSel=el('select',{'aria-label':'配置と語の大小','data-testid':'omakase-layout'},el('option',{value:LAYOUT_SPREAD},'ばらけさせる（位置・語の大小）'),el('option',{value:LAYOUT_CENTER},'真ん中に揃える'));
 const styleSel=el('select',{'aria-label':'演出のしかた','data-testid':'omakase-style'},el('option',{value:'line'},'歌詞ごとに1つの動き'),el('option',{value:'cut'},'カット割り（短く切って、部品を重ねる）'));
 // カット割りの細かい設定（0〜100%）。変えると、いまの案の種のまま、その場で作り直す
 const CUT_SLIDERS=[['density','カットの細かさ',CUT_DEFAULTS.density],['camAmount','カメラ',CUT_DEFAULTS.camAmount],['fxAmount','画面効果',CUT_DEFAULTS.fxAmount],['transAmount','つなぎ',CUT_DEFAULTS.transAmount],['treatAmount','文字の加工',CUT_DEFAULTS.treatAmount],['worldAmount','物の世界',CUT_DEFAULTS.worldAmount],['carryAmount','物の引き継ぎ',CUT_DEFAULTS.carryAmount],['ghostAmount','ゴースト（色ずれ）',CUT_DEFAULTS.ghostAmount]];
 const cutSliders=Object.fromEntries(CUT_SLIDERS.map(([key,label,value])=>{const input=el('input',{type:'range',min:0,max:100,step:1,value:Math.round(value*100),'aria-label':label+'（%）','data-testid':'omakase-cut-'+key}),out=el('output',{},Math.round(value*100)+'%');input.addEventListener('input',()=>{out.textContent=input.value+'%';});return [key,{input,out,label}];}));
 const freeText=el('input',{type:'checkbox','aria-label':'自由文字にも付ける',checked:true,'data-testid':'omakase-cut-free'}),avoidFlash=el('input',{type:'checkbox','aria-label':'強い点滅を避ける',checked:true,'data-testid':'omakase-cut-avoidFlash'}),cutBg=el('input',{type:'checkbox','aria-label':'背景の絵も付ける',checked:true,'data-testid':'omakase-cut-bg'});
 const cutOptions=()=>({...Object.fromEntries(CUT_SLIDERS.map(([key])=>[key,Number(cutSliders[key].input.value)/100])),avoidFlash:avoidFlash.checked,bgMode:cutBg.checked?'auto':'none',freeText:freeText.checked});
 const cutBox=el('div',{class:'omakase-cut','data-testid':'omakase-cut-box',hidden:true},
  el('div',{class:'omakase-sliders'},...CUT_SLIDERS.map(([key])=>el('label',{class:'omakase-slider'},el('span',{},cutSliders[key].label),cutSliders[key].input,cutSliders[key].out))),
  el('div',{class:'omakase-row omakase-checks'},el('label',{class:'omakase-check',title:'フラッシュ・反転・フラッシュ転換を使いません'},avoidFlash,' 強い点滅を避ける'),el('label',{class:'omakase-check'},cutBg,' 背景の絵も付ける'),el('label',{class:'omakase-check',title:'「文字を追加」で置いた自由文字にも、カット演出を付けます'},freeText,' 自由文字にも付ける')));
 const withBg=el('input',{type:'checkbox','aria-label':'背景も足す',checked:true}),withColor=el('input',{type:'checkbox','aria-label':'配色も変える',checked:true}),withSize=el('input',{type:'checkbox','aria-label':'大きさも変える',checked:true});
 const withSaved=el('input',{type:'checkbox','aria-label':'保存した動き・新しい動きも使う',checked:true});
 const counter=el('span',{class:'omakase-counter'},'');
 // two sliders for all lyrics: the average size (percent of the picture's shorter side) and the opacity
 const sizeSlider=el('input',{type:'range',min:SIZE_PCT.min,max:SIZE_PCT.max,step:1,value:SIZE_PCT.default,'aria-label':'文字の大きさの目安（%）','data-testid':'omakase-size'}),sizeOut=el('output',{},SIZE_PCT.default+'%');
 const opacitySlider=el('input',{type:'range',min:10,max:100,step:5,value:100,'aria-label':'文字の不透明度（%）','data-testid':'omakase-opacity'}),opacityOut=el('output',{},'100%');
 const run=fn=>Promise.resolve().then(fn).then(()=>{status.textContent='';render();}).catch(e=>{status.textContent=e.name==='AbortError'?'':(e.message||String(e));});
 const project=()=>controller.get().project;
 function sync(){const id=project().id;if(state.projectId!==id){state.projectId=id;state.history=[];state.index=-1;state.plan=null;}}
 // カット割り: 配色と雰囲気は今までと同じ種から決め、カットの計画を作って、歌詞ごとに入れる（おまかせの背景クリップは、不透明なカット演出の下に隠れるので消す）
 async function applyCut(entry){
  const p=project();
  if(!p.lyrics.some(l=>String(l.text||'').trim()))throw new Error('歌詞がありません。シーケンスで歌詞を入れてから送ってください。');
  const plan=planOmakase(p,{mood:entry.mood,family:entry.family,sizePct:entry.sizePct,layout:LAYOUT_CENTER,seeds:entry.seeds,extras:[]});
  const result=await makeCutPlan(p,{mood:entry.mood,seed:entry.seeds.text,sizePct:entry.sizePct,palette:plan.palette,cut:entry.cut||{},ensureFonts:ensureCutFonts,measure:measureChar});
  const command=cutCommands(p,result,{palette:entry.parts.color?plan.palette:null,sizePct:entry.sizePct,clearBg:true});
  if(!command)throw new Error('変える所がありません。');
  await controller.dispatch(command);
  state.plan=plan;state.cut={...summarizeCuts(result.cuts),fixes:result.fixes.length,mood:entry.mood===MOOD_AUTO?'行ごとに変える':plan.moodName,palette:plan.palette.name};
 }
 async function apply(entry){
  if(entry.style==='cut')return applyCut(entry);
  state.cut=null;
  const p=project();
  if(!p.lyrics.length&&!entry.parts.bg)throw new Error('歌詞がありません。シーケンスで歌詞を入れてから送ってください。');
  const plan=planOmakase(p,{mood:entry.mood,family:entry.family,sizePct:entry.sizePct,layout:entry.layout,seeds:entry.seeds,extras:entry.extras||[]});
  let command=omakaseCommands(p,plan,{parts:entry.parts});
  // カット割りで付けた自由文字のカット演出は、ここで外す（歌詞のぶんは omakaseCommands が、動きを選び直す時に外す）
  const clipCuts=removeCutCommands(p)?.commands.filter(x=>x.type==='setClipContent');
  if(clipCuts?.length)command={type:'batch',commands:[...(command?.commands||[]),...clipCuts]};
  if(!command)throw new Error('変える所がありません。');
  await controller.dispatch(command);
  state.plan=plan;
 }
 const parts=()=>({text:true,bg:withBg.checked,color:withColor.checked,size:withSize.checked,layout:true});
 // the motions beyond the moods' own lists (new bundled ones, the person's saved ones) are read once for each plan, so that 前の案 gives the same plan again
 const libraryItems=()=>{try{return createMotionLibrary().list();}catch{return [];}};
 // Saved code that STUDIO has not been told to run yet is asked about once, in one question, exactly like a motion applied by hand (lyric-edit.js trustSource):
 // what is declined is left out of the plan and nothing is approved silently.
 const declined=new Set();
 function allowSaved(list){
  const refused=list.filter(e=>e.from==='saved'&&e.code?.source&&declined.has(e.code.source));   // said no earlier in this session: not asked again, not used
  list=list.filter(e=>!refused.includes(e));
  const waiting=list.filter(e=>e.from==='saved'&&e.code?.source&&!isStudioCodeApproved(e.code.source));
  if(!waiting.length)return list;
  const names=waiting.slice(0,5).map(e=>'「'+e.name+'」').join('')+(waiting.length>5?'ほか':'');
  const ok=confirm('保存した動き '+waiting.length+' 個（'+names+'）のコードを、おまかせでSTUDIOが実行します。自分で作った、または信頼できる提供元のコードだけ許可してください。許可しますか？\n「キャンセル」なら、これらは使いません。');
  if(!ok){for(const e of waiting)declined.add(e.code.source);return list.filter(e=>!waiting.includes(e));}
  for(const e of waiting)approveStudioCode(e.code.source);
  return list;
 }
 const fresh=(base={})=>({style:styleSel.value,cut:cutOptions(),mood:mood.value,family:family.value,layout:layoutSel.value,sizePct:Number(sizeSlider.value),seeds:newSeeds(),parts:parts(),extras:allowSaved(extraMotions({library:libraryItems(),saved:withSaved.checked})),...base});
 const push=async entry=>{state.history=state.history.slice(0,state.index+1);state.history.push(entry);state.index=state.history.length-1;await apply(entry);};
 const create=()=>run(()=>{sync();return push(fresh());});
 const next=()=>run(()=>{sync();if(state.index<state.history.length-1){state.index++;return apply(state.history[state.index]);}return push(fresh());});
 const back=()=>run(()=>{sync();if(state.index<=0)throw new Error('これより前の案はありません。');state.index--;return apply(state.history[state.index]);});
 // a re-roll that comes out the same as before is useless to look at: roll again (a few times) until this part really differs
 const PART_KEY={text:'lines',bg:'blocks',color:'palette',size:'sizes',layout:'places'};
 // (the colour family chosen in the select is read when the colours are re-rolled; the other parts keep the family of the plan on screen)
 const only=part=>run(()=>{sync();{const now=state.history[state.index];if(now?.style==='cut'&&part!=='color')return push({...now,seeds:{...now.seeds,text:newSeeds().text},parts:parts()});}   // カット割りの「動き・背景・配置・大きさ」は、カットの計画を引き直す
  const shown=state.history[state.index]||fresh(),base=part==='color'?{...shown,family:family.value}:shown,p=project(),was=JSON.stringify(planOmakase(p,{mood:shown.mood,family:shown.family,sizePct:shown.sizePct,layout:shown.layout,seeds:shown.seeds,extras:shown.extras||[]})[PART_KEY[part]]);
  let seeds=base.seeds;for(let i=0;i<12;i++){seeds={...base.seeds,[part]:newSeeds()[part]};if(JSON.stringify(planOmakase(p,{mood:base.mood,family:base.family,sizePct:base.sizePct,layout:base.layout,seeds,extras:base.extras||[]})[PART_KEY[part]])!==was)break;}
  return push({...base,seeds,parts:parts()});});
 // the sliders act on every lyric at once and are one undoable step each (the label follows the thumb while it is dragged)
 async function setSize(pct){
  sync();const p=project();if(!p.lyrics.length)throw new Error('歌詞がありません。');
  const entry=state.history[state.index];let plan;
  if(entry?.style==='cut'){entry.sizePct=pct;await applyCut(entry);return;}   // カット割りは、大きさを計画に入れて作り直す
  if(entry){entry.sizePct=pct;plan=planOmakase(p,{mood:entry.mood,family:entry.family,sizePct:pct,layout:entry.layout,seeds:entry.seeds,extras:entry.extras||[]});}
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
 // 演出のしかたを変えると、いまの案を、そのしかたで作り直す。カット割りの設定を変えても、いまの案の種のまま、その場で作り直す
 styleSel.addEventListener('change',()=>{cutBox.hidden=styleSel.value!=='cut';const entry=state.history[state.index];if(entry&&state.plan)run(()=>{entry.style=styleSel.value;entry.cut=cutOptions();return apply(entry);});else render();});
 const recut=()=>{const entry=state.history[state.index];if(entry?.style==='cut')run(()=>{entry.cut=cutOptions();return applyCut(entry);});};
 for(const {input} of Object.values(cutSliders))input.addEventListener('change',recut);
 avoidFlash.addEventListener('change',recut);cutBg.addEventListener('change',recut);freeText.addEventListener('change',recut);
 function render(){
  sync();const d=state.plan?describePlan(state.plan):null;
  counter.textContent=state.history.length?`${state.index+1} / ${state.history.length}`:'';
  {const p=project(),entry=state.history[state.index];
   // the size slider keeps its own value (default 12 %) and shows the plan on screen when walking through plans; the opacity slider shows the first lyric's
   if(entry){styleSel.value=entry.style||'line';cutBox.hidden=styleSel.value!=='cut';if(entry.cut)for(const [key,{input,out}] of Object.entries(cutSliders))if(entry.cut[key]!=null){input.value=Math.round(entry.cut[key]*100);out.textContent=input.value+'%';}if(entry.cut){avoidFlash.checked=!!entry.cut.avoidFlash;cutBg.checked=entry.cut.bgMode!=='none';freeText.checked=entry.cut.freeText!==false;}}
   if(entry?.sizePct!=null){const pct=Math.round(Math.min(SIZE_PCT.max,Math.max(SIZE_PCT.min,entry.sizePct)));sizeSlider.value=pct;sizeOut.textContent=pct+'%';}
   if(p.lyrics.length){const o=Math.round((p.lyrics[0].opacity??1)*100/5)*5;opacitySlider.value=Math.min(100,Math.max(10,o));opacityOut.textContent=opacitySlider.value+'%';}}
  const cs=state.cut;
  if(cs)summary.replaceChildren(
   el('div',{},el('b',{},'雰囲気　'),cs.mood+'　／　'+cs.palette),
   el('div',{},el('b',{},'カット　'),`${cs.cuts}個（平均${cs.avgCut.toFixed(2)}秒${cs.recaps?`・再掲${cs.recaps}`:''}）`),
   el('div',{},el('b',{},'物の世界　'),cs.worlds.join('、')||'なし'),el('div',{},el('b',{},'カメラ　'),cs.cameras.join('、')||'なし'),
   el('div',{},el('b',{},'画面効果　'),cs.effects.join('、')||'なし'),el('div',{},el('b',{},'つなぎ　'),(cs.transitions.join('、')||'なし')+(cs.carries?`　／　引き継ぎ ${cs.carries}回`:'')),
   el('div',{},el('b',{},'背景の絵　'),cs.backgrounds.join('、')||'なし'),...(cs.fixes?[el('div',{class:'hint'},`重なりすぎ・小さすぎを ${cs.fixes} 件、自動で直しました`)]:[]));
  else summary.replaceChildren(...(d?[
   el('div',{},el('b',{},'雰囲気　'),d.mood+'　／　'+d.palette),
   el('div',{},el('b',{},'動き　'),d.motions.join('、')),
   el('div',{},el('b',{},'背景　'),d.backgrounds.join('、')),el('div',{},el('b',{},'配置　'),d.layout),...(d.size?[el('div',{},el('b',{},'大きさ　'),`${Math.round(d.size.min*1000)/10}〜${Math.round(d.size.max*1000)/10}`)]:[])]:[el('div',{class:'hint'},'まだ作っていません。')]));
 }
 const element=el('section',{class:'omakase','aria-label':'おまかせ','data-testid':'omakase-panel'},
  el('h2',{title:'歌詞の動き・背景・配色をまとめて決めます。歌詞の文字と時刻、曲、UNFOLD作品は変わりません。'},'おまかせ ',el('small',{},'動き・背景・配色をまとめて決める')),
  button(controller,'おまかせで作る',create,{class:'primary wide','data-testid':'omakase-create'}),
  el('label',{class:'omakase-mood'},el('span',{},'演出'),styleSel),
  el('label',{class:'omakase-mood'},el('span',{},'雰囲気'),mood),
  el('label',{class:'omakase-mood'},el('span',{},'配色の系統'),family),
  el('label',{class:'omakase-mood'},el('span',{},'文字の配置'),layoutSel),
  el('div',{class:'omakase-row'},button(controller,'◀ 前の案',back,{'data-testid':'omakase-back'}),button(controller,'次の案 ▶',next,{'data-testid':'omakase-next'}),counter),
  el('div',{class:'omakase-row omakase-checks'},el('label',{class:'omakase-check'},withBg,' 背景も足す'),el('label',{class:'omakase-check'},withColor,' 配色も変える'),el('label',{class:'omakase-check'},withSize,' 大きさも変える'),el('label',{class:'omakase-check',title:'あとから足された標準の動きと、「モーション集」で保存した動きも、おまかせの候補に入れます'},withSaved,' 保存した動き・新しい動きも使う')),
  el('div',{class:'omakase-sliders'},
   el('label',{class:'omakase-slider',title:'全部の歌詞の文字の大きさの平均（画面の短い辺に対する%）。長い歌詞は収まるように小さくなります。'},el('span',{},'文字の大きさ'),sizeSlider,sizeOut),
   el('label',{class:'omakase-slider',title:'全部の歌詞の文字の濃さ（100%で不透明）'},el('span',{},'文字の不透明度'),opacitySlider,opacityOut)),
  cutBox,
  summary,
  el('div',{class:'omakase-row'},el('span',{class:'omakase-label'},'ここだけ変える'),button(controller,'動き',()=>only('text'),{'data-testid':'omakase-only-text'}),button(controller,'背景',()=>only('bg'),{'data-testid':'omakase-only-bg'}),button(controller,'配色',()=>only('color'),{'data-testid':'omakase-only-color'}),button(controller,'配置・大小',()=>only('layout'),{'data-testid':'omakase-only-layout'}),button(controller,'大きさ',()=>only('size'),{'data-testid':'omakase-only-size'})),
  status);
 render();
 return {element,refresh:render};
}
