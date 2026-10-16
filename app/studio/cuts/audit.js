// カット演出の計画の検査と手直し。各軸を別々に選んだ後で、「組み合わせたときの破綻」を見つけて直す。
// 参考ツールの planner が、選ぶ時点の重みと互換ルールで防いでいるものに加えて、選び終えた計画全体を見て直す（重ね過ぎ・文字が小さい・読めない…）。
// 純粋な関数（DOM なし）。文字アイテムは itemOf(cut) で受け取る（ブラウザでは実際の書体で測ったもの、テストでは偽の測りで）。
import {CAMERA} from './parts.js';
import {ENTER,readableShare} from './glyphs.js';
import {rng} from '../omakase.js';

/** 1カットの「盛り具合」: つなぎ/引き継ぎ・画面効果・世界・強いカメラは1、加工は0.5 */
export const heaviness=c=>(c.trans||c.carry?1:0)+(c.fx?1:0)+(c.world?1:0)+((c.treat&&c.treat!=='none')?.5:0)+((c.cam&&CAMERA[c.cam]?.strong)?1:0);
export const HEAVY_LIMIT=3,RUN_LIMIT=2.5;
/** 文字の高さ（絵の高さに対する割合）の下限。世界の上は箱に収めるので少し小さくてよく、再掲は全文なのでさらに小さくてよい */
export const GLYPH_MIN={normal:.125,world:.105,recap:.095};
const minGlyph=c=>c.recap?GLYPH_MIN.recap:c.world?GLYPH_MIN.world:GLYPH_MIN.normal;
/** ぼけた字（加工）と重ねてよいゴーストの強さの上限（それを超えると、にじみが二重になって読みにくい） */
export const GHOST_SOFT_MAX=1.2;
const BUSY_ENTER=['stretch','glitch','flicker','spin','scatter'];
const SLOW_ENTER=['type','scatter','wipe','drop'];

/** 計画を検査する。issues は {code,msg}。itemOf がなければ、文字の大きさと読める時間は見ない */
export function auditPlan(cuts,{itemOf,H=540}={}){
 const rows=cuts.map((c,i)=>{
  const issues=[],heavy=heaviness(c),it=itemOf?.(c),glyph=it?it.size/H:null,readable=it?readableShare(it):null;
  const strong=!!(c.cam&&CAMERA[c.cam]?.strong);
  if(strong&&['jitter','glitchtick'].includes(c.hold))issues.push({code:'cam-hold',msg:'強いカメラと細かい震えが重なる'});
  if(strong&&c.world)issues.push({code:'cam-world',msg:'世界の入りと強いカメラが重なる'});
  if(heavy>HEAVY_LIMIT)issues.push({code:'heavy',msg:`盛りすぎ（${heavy}）`});
  if(glyph!=null&&glyph<minGlyph(c)-1e-9)issues.push({code:'small',msg:`文字が小さい（絵の高さの${Math.round(glyph*100)}%）`});
  if(readable!=null&&readable<.4)issues.push({code:'unreadable',msg:`読める時間が短い（${Math.round(readable*100)}%）`});
  if(c.recap&&(c.fx||BUSY_ENTER.includes(c.enter)))issues.push({code:'recap-busy',msg:'再掲が騒がしい'});
  if(c.world&&cuts.slice(0,i).some(x=>x.lineIndex===c.lineIndex&&x.world===c.world))issues.push({code:'dup-world',msg:'同じ行で同じ世界が2回'});
  if(c.carry&&c.fx)issues.push({code:'carry-fx',msg:'引き継ぎと画面効果が重なる'});
  if(c.treat==='soft'&&c.ghost>GHOST_SOFT_MAX)issues.push({code:'ghost-soft',msg:'ぼけた字と強いゴーストが重なり、読みにくい'});
  return {id:c.id,heavy,glyph,readable,issues};
 });
 for(let i=1;i<rows.length-1;i++)if(rows[i-1].heavy>=RUN_LIMIT&&rows[i].heavy>=RUN_LIMIT&&rows[i+1].heavy>=RUN_LIMIT)rows[i].issues.push({code:'run',msg:'重いカットが3つ続く'});
 const all=rows.flatMap(r=>r.issues);
 const byCode={};for(const x of all)byCode[x.code]=(byCode[x.code]||0)+1;
 return {rows,summary:{issues:all.length,byCode,heavyAvg:rows.reduce((a,r)=>a+r.heavy,0)/Math.max(1,rows.length),glyphAvg:rows.filter(r=>r.glyph!=null).reduce((a,r)=>a+r.glyph,0)/Math.max(1,rows.filter(r=>r.glyph!=null).length)}};
}

const drop={
 fx:c=>{if(!c.fx)return false;c.fx=null;c.fxP=null;return true;},
 treat:c=>{if(!c.treat||c.treat==='none')return false;c.treat='none';c.treatP={};return true;},
 cam:c=>{if(!c.cam)return false;c.cam=null;c.camP=null;return true;},
 strongCam:c=>CAMERA[c.cam]?.strong?drop.cam(c):false,
 world:c=>{if(!c.world)return false;c.world=null;c.worldP=null;c.worldExit=false;return true;}
};
const setEnter=(c,key,seed)=>{c.enter=key;c.enterP=ENTER[key].plan?ENTER[key].plan(rng(`fixe:${seed}:${c.id}`)):{};};

/**
 * 計画を手直しする（cuts を書き換える）。locked は触らないカットのid。
 * 直し方は決まっていて、同じ入力なら同じ結果。1回で収まらない時は3回まで繰り返す。
 * itemOf/invalidate: 文字の大きさと読める時間を測るため（invalidate は、cut を変えた後に、測り直せるようにする）。
 * 返す fixes: [{id,code,msg}]（何をどう直したか）
 */
export function refinePlan(cuts,{itemOf,invalidate=()=>{},locked=new Set(),seed=1,H=540}={}){
 const fixes=[],note=(c,code,msg)=>fixes.push({id:c.id,code,msg});
 for(let pass=0;pass<3;pass++){
  const {rows}=auditPlan(cuts,{itemOf,H});let changed=false;
  rows.forEach((row,i)=>{
   const c=cuts[i];if(locked.has(c.id))return;
   for(const {code} of row.issues){
    if(code==='cam-hold'){c.hold='still';c.holdP={};note(c,code,'保持を静止に');changed=true;}
    else if(code==='cam-world'){if(drop.cam(c)){note(c,code,'カメラを外した');changed=true;}}
    else if(code==='dup-world'){if(drop.world(c)){invalidate(c);note(c,code,'2回目の世界を外した');changed=true;}}
    else if(code==='carry-fx'){if(drop.fx(c)){note(c,code,'画面効果を外した');changed=true;}}
    else if(code==='ghost-soft'){c.ghost=GHOST_SOFT_MAX;note(c,code,'ゴーストを弱めた');changed=true;}
    else if(code==='recap-busy'){
     let did=drop.fx(c);
     if(BUSY_ENTER.includes(c.enter)){setEnter(c,'slide',seed);invalidate(c);did=true;}
     if(did){note(c,code,'再掲を落ち着かせた');changed=true;}
    }
    else if(code==='heavy'||code==='run'){
     const limit=code==='run'?RUN_LIMIT-.5:HEAVY_LIMIT;let did=false;
     for(const step of [drop.fx,drop.treat,drop.strongCam]){if(heaviness(c)<=limit)break;if(step(c))did=true;}
     if(did){invalidate(c);note(c,code,code==='run'?'続く重さを一息つけた':'盛りすぎを減らした');changed=true;}
    }
    else if(code==='small'){
     const min=minGlyph(c),cur=c.dScale||1,next=Math.min(1.5,.26/c.fontScale,cur*(min/Math.max(.01,row.glyph))*1.04);
     if(next>cur+.01){
      c.dScale=Math.round(next*100)/100;invalidate(c);
      // 世界の箱に収める文字は、dScale を上げても大きくならないことがある（箱の大きさで頭打ち）。効かなければ元に戻す
      const now=itemOf?.(c)?.size/H;
      if(now>row.glyph*1.03){note(c,code,`文字を${Math.round(next*100)}%に拡大`);changed=true;}
      else{c.dScale=cur===1?undefined:cur;invalidate(c);}
     }
    }
    else if(code==='unreadable'){
     if(c.exit!=='cut'){c.exit='cut';c.exitP={};invalidate(c);note(c,code,'退場をなしに');changed=true;}
     else if(SLOW_ENTER.includes(c.enter)||BUSY_ENTER.includes(c.enter)){setEnter(c,'pop',seed);invalidate(c);note(c,code,'登場をポップに');changed=true;}
     else if(c.enter!=='cut'){setEnter(c,'cut',seed);invalidate(c);note(c,code,'登場をなしに');changed=true;}
    }
   }
  });
  if(!changed)break;
 }
 return fixes;
}
