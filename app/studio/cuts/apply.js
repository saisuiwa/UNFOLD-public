// カット演出を STUDIO のプロジェクトに入れるコマンド（1回で元に戻せる1まとまり）と、計画を作る一連の流れ。
// 歌詞の文字・時刻・曲・ほかのクリップは変えない。歌詞ごとに lyric.cut（plan.js）と、配色（motion.color / emphasisColor）を入れるだけ。
import {planCutsRaw,finishCutPlan,fontsUsed,motionSig,CUT_VERSION,MIX} from './plan.js';
import {buildAnyItem} from './items.js';
import {mergeMotion,uniformSizes,MOOD_AUTO} from '../omakase.js';

/**
 * 計画を作る。ensureFonts(keys) は、使う書体を読んでおく（検査と手直しが文字を測るため）。measure(ch,font,px) は1字の幅。
 * palette: {color,emphasisColor}。返す result は finishCutPlan の結果。
 */
export async function makeCutPlan(project,{mood=MOOD_AUTO,seed=1,sizePct=12,palette,cut={},ensureFonts=async()=>{},measure}={}){
 const raw=planCutsRaw(project,{...cut,mood:mood===MOOD_AUTO?MIX:mood,seed,sizePct,palette});
 await ensureFonts(fontsUsed(raw.cuts));
 const items=new Map();
 const itemOf=c=>{let it=items.get(c.id);if(!it){it=buildAnyItem(c,{W:960,H:540,measure});items.set(c.id,it);}return it;};
 return finishCutPlan(raw,{itemOf,invalidate:c=>items.delete(c.id)});
}

/**
 * 結果 → コマンド。clearBg: おまかせで足した背景のクリップを消す（カット演出の絵は不透明で、背景も自分で描くので、重ねても見えない）。
 * size: 文字の大きさのスライダーの値（%）を、全歌詞の配置の大きさにも入れる（スライダーの表示と合わせるため。カット演出の文字の大きさは、計画が決める）。
 */
export function cutCommands(project,result,{palette,sizePct=12,clearBg=true}={}){
 const commands=[];
 for(const l of project.lyrics){
  const data=result.data.get(l.id),patch={};
  const motion=palette?mergeMotion(l.motion,{color:palette.color,emphasisColor:palette.emphasisColor}):l.motion;
  if(palette)patch.motion=motion;
  // 目印（sig）は、色などを入れた後の動きから取る（動きのコードが変わると、手で別の動きを選んだと分かって、カット演出をやめる）
  patch.cut=data?{...data,sig:motionSig({motion})}:null;
  commands.push({type:'setLyricAppearance',id:l.id,patch});
 }
 for(const s of uniformSizes(project,sizePct))for(const viewId of Object.keys(project.views))if(project.views[viewId].layout[s.id])commands.push({type:'setLayout',id:s.id,viewId,patch:{fontScale:s.fontScale}});
 if(clearBg)for(const c of project.clips)if(c.settings?.omakase)commands.push({type:'deleteClip',id:c.id});
 return commands.length?{type:'batch',commands}:null;
}

/** カット演出をやめる（全部の歌詞から外す）。やめると、歌詞はもとの動きの描き方に戻る */
export function removeCutCommands(project){
 const commands=project.lyrics.filter(l=>l.cut).map(l=>({type:'setLyricAppearance',id:l.id,patch:{cut:null}}));
 return commands.length?{type:'batch',commands}:null;
}
export {CUT_VERSION};
