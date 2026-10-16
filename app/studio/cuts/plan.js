// カット演出の計画: 歌詞1行を「文節」で 0.5〜1.3 秒のカットに割り、カットごとに 背景・カメラ・画面効果・つなぎ・ゴースト・
// 字ごとの登場/保持/退場/加工・物の世界・引き継ぎ を選ぶ。選び方は部品の軸ごとに独立で、重み × 雰囲気タグ × 直近に使ったものは出にくく（novelty）× 互換のルール、
// すべて乱数の種から決まるので、同じ設定なら同じ計画になる（前の案に戻れる）。
// 考え方は 参考ツール の planner（1カット 0.5〜1.3 秒、足りなければ全文の「再掲」カット、軸ごとの互換ルール）を参考にした独自実装。
// DOM には触らない（node でテストできる）。文字の大きさを測る必要があるのは検査と手直し（audit.js）だけで、itemOf として外から渡す。
import {wordPieces,wordKind,pickWordScales,sizeRuns} from '../word-size.js';
import {MOODS,rng,fitCap,SIZE_MIN} from '../omakase.js';
import {BG,CAMERA,FX,TRANS,GROUPS,GROUP_NAMES} from './parts.js';
import {ENTER,HOLD,EXIT,TREAT,GLYPH_GROUPS,GLYPH_GROUP_NAMES,timingsOf} from './glyphs.js';
import {WORLD,worldChoices} from './worlds.js';
import {refinePlan,auditPlan} from './audit.js';

export const CUT_VERSION=1;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,u)=>a+(b-a)*u;
const PUNCT=/^[\s、。，．,.!?！？…‥ー〜～・「」『』（）()\[\]【】〔〕〈〉《》"'“”‘’\-—]+$/u;
const charCount=text=>[...String(text||'').replace(/\s/g,'')].length;
const contentLen=text=>[...String(text||'')].filter(c=>!PUNCT.test(c)).length;
const FPS=24;

// ---- 文節に割る ------------------------------------------------------------------------------------------------------------------------------
// ICU の単語区切り（Intl.Segmenter 'ja'）で語に割り、助詞・語尾は前の語にくっつける（STUDIO の語ごとの大小と同じ分類）。
// 内容語が続いたら新しい文節。1文字しかない文節は隣にくっつける。
export function chunkLine(text){
 text=String(text||'');
 const chunks=[];
 for(const p of wordPieces(text).filter(x=>x.text.length)){
  // 'plain' = 2文字のひらがな語（てる・まだ・われ…）。前の文節があればその続きとして扱う
  const kind=wordKind(p),last=chunks.at(-1),content=kind==='big'||(kind==='plain'&&!last);
  if(!last||(content&&last.content))chunks.push({from:p.from,to:p.to,content});
  else{last.to=p.to;last.content=last.content||content;}
 }
 const textOf=c=>text.slice(c.from,c.to);
 let merged=true;
 while(merged&&chunks.length>1){
  merged=false;
  for(let i=0;i<chunks.length;i++){
   if(contentLen(textOf(chunks[i]))>1)continue;
   const a=i+1<chunks.length?i:i-1,b=a+1;
   chunks.splice(a,2,{from:chunks[a].from,to:chunks[b].to,content:true});
   merged=true;break;
  }
 }
 return chunks.map(c=>({text:textOf(c),from:c.from,to:c.to}));
}

/** chunks を k 個の連続したグループに、文字数がなるべく揃うように分ける。 */
function partition(chunks,k){
 const n=chunks.length,len=chunks.map(c=>contentLen(c.text)+1),pre=[0];
 for(const l of len)pre.push(pre.at(-1)+l);
 const target=pre[n]/k,cost=(a,b)=>{const d=pre[b]-pre[a]-target;return d*d;};
 const best=Array.from({length:k+1},()=>Array(n+1).fill(Infinity)),from=Array.from({length:k+1},()=>Array(n+1).fill(0));
 best[0][0]=0;
 for(let g=1;g<=k;g++)for(let i=g;i<=n;i++)for(let j=g-1;j<i;j++){const c=best[g-1][j]+cost(j,i);if(c<best[g][i]){best[g][i]=c;from[g][i]=j;}}
 const out=[];let i=n;
 for(let g=k;g>=1;g--){const j=from[g][i];out.unshift(chunks.slice(j,i));i=j;}
 return out;
}

const MIN_CUT=.22;
/**
 * 1行を「カット」に割る。cut = {text, recap, start, end}。
 *  density 0..1: 1カットの目安が 1.3 秒（0）〜 0.5 秒（1）。
 *  recap: 'auto'（割った数より多くカットが入る時間があれば全文を足す）| 'always' | 'never'
 */
export function splitLine(line,{density=.57,recap='auto'}={}){
 const text=String(line.text).trim(),s=line.start,e=line.end,D=e-s;
 const chunks=chunkLine(text),L=lerp(1.3,.5,clamp(density,0,1));
 let nC=Math.round(D/L);
 const maxC=chunks.length+(chunks.length>=2&&D>2?1:0);
 nC=clamp(nC,1,Math.max(1,maxC));
 const nG=Math.min(nC,chunks.length);
 const groups=nG<=1?[text]:partition(chunks,nG).map(g=>text.slice(g[0].from,g.at(-1).to).trim());
 const wantRecap=groups.length>=2&&(recap==='always'||(recap==='auto'&&nC>groups.length));
 let units=groups.map(g=>({text:g,recap:false,w:charCount(g)+1.6}));
 if(wantRecap)units.push({text,recap:true,w:units.reduce((a,u)=>a+u.w,0)/units.length*1.25});
 // 短すぎる行に最短カットが入りきらない時は、再掲 → 後ろのカットの順に減らす
 while(units.length>1&&units.length*MIN_CUT>D){if(units.at(-1).recap)units.pop();else{const b=units.pop(),a=units.pop();units.push({text:(a.text+b.text),recap:false,w:a.w+b.w});}}
 const total=units.reduce((a,u)=>a+u.w,0),bounds=[s];
 let acc=s;
 units.forEach((u,k)=>{acc+=D*u.w/total;bounds.push(k===units.length-1?e:acc);});
 const snap=t=>Math.round(t*FPS)/FPS,last=bounds.length-1;
 for(let k=1;k<last;k++)bounds[k]=snap(bounds[k]);
 for(let k=1;k<last;k++)bounds[k]=Math.max(bounds[k],bounds[k-1]+MIN_CUT);          // 前から詰め
 for(let k=last-1;k>=1;k--)bounds[k]=Math.min(bounds[k],bounds[k+1]-MIN_CUT);        // 後ろから詰め
 return units.map((u,k)=>({text:u.text,recap:u.recap,start:bounds[k],end:bounds[k+1]}));
}

// ---- 雰囲気・配置・大きさ -----------------------------------------------------------------------------------------------------------------------
// 位置の重みは studio/omakase.js の LAYOUT_STYLE と同じ値（そちらは export されていないので写した）。
const LAYOUT_STYLE={
 calm:{weights:{center:5,bottom:2,top:1.5,left:1,right:1,'top-left':1,'bottom-right':1},tilt:1.5,sideways:0,words:.6},
 pop:{weights:{center:2,'top-left':2,'top-right':2,'bottom-left':2,'bottom-right':2,top:1,bottom:1,left:1,right:1},tilt:7,sideways:.05,words:1},
 glitch:{weights:{center:2,'top-left':2,'bottom-right':2,left:1.5,right:1.5,top:1,bottom:1},tilt:3,sideways:.12,words:.9},
 graphic:{weights:{center:2,left:2,right:2,top:1.5,bottom:1.5,'top-left':1.5,'bottom-right':1.5},tilt:0,sideways:.14,words:1},
 emotional:{weights:{center:4,'bottom-left':1.5,'top-right':1.5,bottom:1.5,top:1},tilt:3,sideways:.04,words:.7},
 impact:{weights:{center:3,'top-left':1.5,'top-right':1.5,'bottom-left':1.5,'bottom-right':1.5,left:1,right:1},tilt:5,sideways:.06,words:1}
};
const MEAN_BASE=.0875;
const BGS=['#14121f','#0f1a1d','#1d1316','#161a10','#0e0e14'];
export const MIX='mix';

function weighted(weights,rnd,exclude){
 const entries=Object.entries(weights).filter(([k])=>k!==exclude);
 let total=entries.reduce((s,[,w])=>s+w,0),r=rnd()*total;
 for(const [k,w] of entries){r-=w;if(r<=0)return k;}
 return entries.at(-1)[0];
}
const hashInt=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const round3=v=>Math.round(v*1000)/1000;

/**
 * 行（{text,start,end} 秒）を、カットの並びにする。mood: MIX（行ごとに直前と違う雰囲気）か、雰囲気の id。
 * 返す cut は {id,lineIndex,unitIndex,start,end,text,recap,moodId,placeName,place:{rotation,scale},fontScale,runs,bg,seed}。
 * 文字の置き場所（x,y）は、実際の文字の広がりを測ってから決めるので（items.js の placeItem）、ここでは向きと縮め具合だけ。
 */
export function planCuts(lines,{mood=MIX,density=.57,recap='auto',wordSizes=true,sizePct=12,seed=1}={}){
 const cuts=[],moodHistory=[];
 let previousPlace='';
 lines.forEach((line,li)=>{
  const rm=rng(`mood:${seed}:${li}`);
  let chosen;
  if(mood===MIX){const pool=MOODS.filter(m=>m.id!==moodHistory.at(-1));chosen=pool[Math.floor(rm()*pool.length)];}
  else chosen=MOODS.find(m=>m.id===mood)||MOODS[0];
  moodHistory.push(chosen.id);
  const style=LAYOUT_STYLE[chosen.id]||LAYOUT_STYLE.pop;
  const units=splitLine(line,{density,recap});
  units.forEach((u,k)=>{
   const id=`${li}:${k}`,r=rng(`cut:${seed}:${id}`);
   const n=charCount(u.text);
   // 大きさ: 短いカットは大きく、再掲は全文なので少し大きめ。長さの上限は fitCap
   const shortBoost=lerp(1.7,1,clamp((n-3)/9,0,1));
   let v=(sizePct/100)*(chosen.size.base/MEAN_BASE)*shortBoost*(1+(r()*2-1)*.12);
   if(!u.recap&&r()<.2)v*=1.25;
   if(u.recap)v*=1.2;
   const fontScale=round3(Math.min(fitCap(n),Math.max(SIZE_MIN,v)));
   // 配置（前のカットと同じ場所は避ける）
   const place=weighted(style.weights,r,previousPlace);previousPlace=place;
   let rotation=0;const tilt=style.tilt*(r()*2-1);
   if(n<=9&&(place==='left'||place==='right')&&r()<style.sideways)rotation=r()<.5?90:-90;
   else if(Math.abs(tilt)>.8)rotation=tilt;
   else r();
   const scale=place==='center'?1:.72+r()*.14;
   // 語ごとの大小
   const base=[{text:u.text}];
   const ranges=wordSizes?pickWordScales(u.text,r,{strength:style.words}):[];
   const runs=ranges.length?sizeRuns({runs:base},ranges):base;
   cuts.push({id,lineIndex:li,unitIndex:k,start:u.start,end:u.end,text:u.text,recap:u.recap,moodId:chosen.id,
    placeName:place,place:{rotation:Math.round(rotation*10)/10,scale:Math.round(scale*1000)/1000},fontScale,runs,
    bg:BGS[(li+seed)%BGS.length],seed:hashInt(`${seed}:${id}`)%1000000+1});
  });
 });
 return cuts;
}

// ---- 部品の選び方 ---------------------------------------------------------------------------------------------------------------------------------
// 選び方は軸ごとに独立。重み × ムードが合えば×2 × 直近に使ったものは出にくく（novelty）。互換のルール:
//  - つなぎは、前のカットとほぼ隙間なく続く所だけ。0.5秒未満のカットには入れない。長さは短いほうのカットの45%まで。
//  - 強いカメラ（地震・スナップ・パンチ・傾き）は「カメラの量」が小さいと出にくい。
//  - 背景は行ごとに選び、行の途中で18%の確率で変える。
//  - 量が 0 のものは、その軸を一切使わない。
//  - つなぎがあるカットは、画面効果を出にくくする（4割）。フラッシュ効果は付けない。
export function partChoices(group){return Object.keys(GROUPS[group]).map(key=>({key,name:GROUPS[group][key].name}));}
function pickPart(r,group,o){return pickFrom(r,GROUPS[group]||GLYPH_GROUPS[group],o);}
function pickFrom(r,reg,{mood,history=[],n=3,f=.25,extra=()=>1}){
 const keys=Object.keys(reg);
 const ws=keys.map(k=>{const d=reg[k];if(keys.length>2&&history.at(-1)===k)return 0;   // 直前と同じものは選ばない
  return Math.max(0,(d.w??1)*(d.tags?.includes(mood)?2:1)*(history.slice(-n).includes(k)?f:1)*extra(d));});
 let x=r()*ws.reduce((a,b)=>a+b,0);
 for(let i=0;i<keys.length;i++){x-=ws[i];if(x<=0)return keys[i];}
 return keys.at(-1);
}
// 常時ゴースト（時間遅れの色収差）の強さは、ムードで違う（グリッチ・勢いは強く、しっとりは弱く）
const GHOST_MOOD={calm:.35,emotional:.6,graphic:.9,pop:1,impact:1.15,glitch:1.35};
/** cuts に bgPart/cam/fx/trans/ghost とそれぞれの P を書き足して返す（cuts は書き換える）。amounts は 0..1。bgMode: 'auto' | 'none' */
export function assignParts(cuts,{seed=1,bgMode='auto',camAmount=.5,fxAmount=.5,transAmount=.5,ghostAmount=.2,avoidFlash=false}={}){
 const hist={bg:[],cam:[],fx:[],trans:[]};
 let lastLine=-1,lineBg=null;
 const pickBg=(r,mood)=>{
  if(bgMode==='none'||r()<.2)return {key:null,P:null};
  const key=pickPart(r,'bg',{mood,history:hist.bg,n:3,f:.25});hist.bg.push(key);return {key,P:BG[key].plan(r)};
 };
 cuts.forEach((c,i)=>{
  const id=c.id,r=rng(`part:${seed}:${id}`);
  // 背景
  if(c.lineIndex!==lastLine){lastLine=c.lineIndex;lineBg=pickBg(rng(`linebg:${seed}:${c.lineIndex}`),c.moodId);}
  else if(r()<.18)lineBg=pickBg(r,c.moodId);
  else r();
  c.bgPart=lineBg.key;c.bgP=lineBg.P;
  // カメラ
  let cam=null;
  if(camAmount>0&&r()<.2+.8*camAmount)cam=pickPart(r,'cam',{mood:c.moodId,history:hist.cam,n:2,f:.25,extra:d=>d.strong?.25+.9*camAmount:1});else r();
  if(cam)hist.cam.push(cam);
  c.cam=cam;c.camP=cam?CAMERA[cam].plan(rng(`cam:${seed}:${id}`)):null;
  // つなぎ（前のカットとほぼ隙間なく続く所だけ）
  const prev=cuts[i-1],dur=c.end-c.start;
  const adjacent=!!prev&&Math.abs(c.start-prev.end)<=.06&&dur>=.5;
  let trans=null;
  if(adjacent&&transAmount>0&&r()<.08+.62*transAmount)trans=pickPart(r,'trans',{mood:c.moodId,history:hist.trans,n:2,f:.2,extra:d=>avoidFlash&&d.strongFlash?0:1});else r();
  if(trans)hist.trans.push(trans);
  c.trans=trans;c.transP=trans?TRANS[trans].plan(rng(`trans:${seed}:${id}`)):null;
  c.transDur=trans?Math.min(TRANS[trans].dur,.45*Math.min(dur,prev.end-prev.start)):0;
  // 画面効果（カットの頭で鳴る）。つなぎがあるカットでは出にくくし、フラッシュは避ける（つなぎ自体が大きな動きなので）
  let fx=null;
  if(fxAmount>0&&r()<(.08+.6*fxAmount)*(c.unitIndex===0?1.3:1)*(trans?.4:1))fx=pickPart(r,'fx',{mood:c.moodId,history:hist.fx,n:3,f:.2,extra:d=>(trans&&d===FX.flash)||(avoidFlash&&d.strongFlash)?0:1});else r();
  if(fx)hist.fx.push(fx);
  c.fx=fx;c.fxP=fx?FX[fx].plan(rng(`fx:${seed}:${id}`)):null;
  // 常時ゴースト（時間遅れの色収差）。強さ＝量 × ムード × 少しの揺らぎ。向きは2通り
  c.ghost=ghostAmount>0?Math.round(Math.min(2.5,ghostAmount*2.4*(GHOST_MOOD[c.moodId]??1)*(.75+.5*r()))*100)/100:0;
  c.ghostP={dir:r()<.5?-1:1};
 });
 return cuts;
}

export const GLYPH_FONTS=['gothic','mincho','round','marker','dela','dot'];
export const FONT_NAMES={gothic:'ゴシック',mincho:'明朝',round:'丸ゴシック',marker:'マーカー',dela:'デラゴシック',dot:'ドット'};
const FONT_BY_MOOD={calm:['mincho','round'],pop:['round','dela','marker'],glitch:['gothic','dot','dela'],graphic:['gothic','mincho','marker'],emotional:['mincho','round'],impact:['dela','gothic','marker']};
/**
 * cuts に enter/hold/exit/treat（とそれぞれの P）、gFont、gVertical を書き足して返す（assignParts の後に呼ぶ。つなぎの有無を見るため）。互換のルール:
 *  - 短いカット（0.7秒未満）では、短くても成り立つ登場（fast）を選び、遅い登場は出にくい。タイプは14字まで。ワイプ・散らばりは0.6〜0.7秒以上。
 *  - 次のカットがつなぎ（つなぎが前の絵Aを持ち出す）なら、このカットは退場なし（cut）。そうしないと文字が消えかけてから元に戻って見える。
 *  - つなぎがあるカット自身は、登場が重ならないよう、速い登場を選ぶ。
 *  - 同じ行の途中のカット（次がすぐ続く）は、退場が cut になりやすい。行の最後のカットは自由に選ぶ。
 *  - 登場と退場の合計は、カットの60%まで（timingsOf）。読める時間を残す。
 *  - 縦書きは6字以下だけ。蛍光ペン・下線・箱は縦書きには付けない。
 *  - 中抜きは8字以下で、文字が小さくない時だけ（細い線なので、長い歌詞では読めない）。
 *  - 再掲（全文を読ませるカット）は、ぼけた字にしない。
 */
export function assignGlyphParts(cuts,{seed=1,fontMode='cut',treatAmount=.45,holdAmount=.7}={}){
 const hist={enter:[],hold:[],exit:[],treat:[],font:[]};
 cuts.forEach((c,i)=>{
  const id=c.id,r=rng(`glyph:${seed}:${id}`);
  const n=charCount(c.text),D=c.end-c.start,next=cuts[i+1];
  const touchingNext=!!next&&Math.abs(next.start-c.end)<=.06,midLine=touchingNext&&next.lineIndex===c.lineIndex;
  const nextTrans=touchingNext&&!!next.trans;
  const vertical=n<=6&&r()<(['graphic','calm','emotional'].includes(c.moodId)?.14:.05);
  const enter=pickFrom(r,ENTER,{mood:c.moodId,history:hist.enter,n:4,f:.3,extra:d=>{
   let w=1;
   if(D<.7)w*=d.fast?1.6:.3;
   if(d.minDur&&D<d.minDur)w*=.1;
   if(d.maxChars&&n>d.maxChars)w*=.15;
   if(c.trans)w*=d.fast?1.5:.1;
   return w;}});
  hist.enter.push(enter);
  const exit=nextTrans?'cut':pickFrom(r,EXIT,{mood:c.moodId,history:hist.exit,n:4,f:.3,extra:d=>{
   let w=1;
   if(d.minDur&&D<d.minDur)w*=.1;
   if(midLine)w*=d===EXIT.cut?3.5:.5;
   if(D<.6&&d!==EXIT.cut)w*=.4;
   return w;}});
  hist.exit.push(exit);
  let hold='still';
  if(r()<holdAmount)hold=pickFrom(r,HOLD,{mood:c.moodId,history:hist.hold,n:2,f:.3,extra:d=>d===HOLD.still?0:1});else r();
  hist.hold.push(hold);
  let treat='none';
  if(treatAmount>0&&r()<treatAmount*(c.recap?1.3:1))treat=pickFrom(r,TREAT,{mood:c.moodId,history:hist.treat,n:2,f:.3,extra:d=>{
   if(d===TREAT.none||(vertical&&['marker','underline','box'].some(k=>TREAT[k]===d)))return 0;
   if(d===TREAT.hollow&&(n>8||c.fontScale<.14))return .1;   // 中抜きは細いので、長い歌詞や小さい文字には向かない
   if(c.recap&&d===TREAT.soft)return 0;   // 再掲は全文を読ませるカットなので、ぼけた字にはしない
   return 1;}});else r();
  hist.treat.push(treat);
  let gFont=null;
  if(fontMode==='cut'){
   const pool=FONT_BY_MOOD[c.moodId]||GLYPH_FONTS,cands=pool.filter(k=>k!==hist.font.at(-1));
   gFont=(cands.length?cands:pool)[Math.floor(r()*(cands.length||pool.length))];
  }else r();
  hist.font.push(gFont);
  const P=(reg,key,tag)=>reg[key].plan?reg[key].plan(rng(`${tag}:${seed}:${id}`)):{};
  Object.assign(c,{enter,enterP:P(ENTER,enter,'ge'),hold,holdP:P(HOLD,hold,'gh'),exit,exitP:P(EXIT,exit,'gx'),treat,treatP:P(TREAT,treat,'gt'),gFont,gVertical:vertical});
 });
 return cuts;
}

/**
 * cuts に world/worldP/worldExit を書き足して返す（assignGlyphParts の後に呼ぶ。量 0 なら一切使わない）。互換のルール:
 *  - 文字数が世界の上限（fits）を超えるときは使わない（ステッカーは8字まで、吹き出しは14字まで、…）。縦書きのカットには使わない。
 *  - 0.6秒未満のカットは、物が出てくる時間が足りないので出にくい。直前と同じ世界は選ばない。
 *  - 世界は、次のカットがすぐ続かない時（行末・最後）だけ、自分で退場する（worldExit）。続く時は、そのまま切り替わる。
 *  - 世界の物の濃さ（worldOpacity 0..1）は、世界のあるカットに worldA として入れる（文字は薄くならない）。
 *  - 物の上で読みにくい加工（蛍光ペン・下線・箱・中抜き・押し出し・ぼけた字・ぼかし送り）は付けない（none に戻す）。
 */
export function assignWorlds(cuts,{seed=1,worldAmount=.5,worldOpacity=1}={}){
 const hist=[];
 cuts.forEach((c,i)=>{
  const id=c.id,r=rng(`world:${seed}:${id}`);
  const n=charCount(c.text),D=c.end-c.start,next=cuts[i+1],touchingNext=!!next&&Math.abs(next.start-c.end)<=.06;
  let key=null;
  const any=Object.values(WORLD).some(d=>d.fits(n));
  if(worldAmount>0&&any&&!c.gVertical&&r()<worldAmount*(D<.6?.6:1))key=pickFrom(r,WORLD,{mood:c.moodId,history:hist,n:3,f:.25,extra:d=>d.fits(n)?1:0});else r();
  if(key)hist.push(key);
  c.world=key;c.worldP=key?WORLD[key].plan(rng(`wp:${seed}:${id}`),c):null;c.worldExit=!!key&&!touchingNext;c.worldA=key?Math.round(clamp(worldOpacity,0,1)*100)/100:undefined;
  if(key){c.gVertical=false;if(['marker','underline','box','hollow','extrude','soft','blurTrail'].includes(c.treat)){c.treat='none';c.treatP={};}}
 });
 return cuts;
}

/**
 * 前のカットとほぼ隙間なく続く所で、「前のカットの台が画面いっぱいに寄り、次のカットの台に入れ替わって引く」引き継ぎを付ける（c.carry=true）。互換のルール:
 *  - 前後どちらかが世界のカットだと出やすい（台がある）。どちらも世界でないカットどうしは出にくい（約1/3）。
 *  - 0.5秒未満のカットには付けない。長さは短いほうのカットの半分まで（最大0.42秒）。
 *  - 引き継ぎの前のカットは退場なし（cut）にする（文字が消えかけてから元に戻って見えるのを防ぐ）。
 */
export function assignCarry(cuts,{seed=1,carryAmount=.5}={}){
 cuts.forEach((c,i)=>{
  c.carry=false;c.carryDur=0;
  const prev=cuts[i-1];if(!prev)return;
  const r=rng(`carry:${seed}:${c.id}`),dur=c.end-c.start,pd=prev.end-prev.start;
  const touching=Math.abs(c.start-prev.end)<=.06&&dur>=.5&&pd>=.5;
  const on=touching&&carryAmount>0&&r()<carryAmount*(c.world||prev.world?1:.35);
  if(on){c.carry=true;c.carryDur=Math.floor(Math.min(.42,.5*Math.min(dur,pd))*100)/100;prev.exit='cut';prev.exitP={};}
 });
 return cuts;
}
export {GROUP_NAMES,GLYPH_GROUP_NAMES,timingsOf,worldChoices};

// ---- 歌詞（STUDIO の lyric）との行き来 -----------------------------------------------------------------------------------------------------------
/** 歌詞の動き（コード・レシピ）の目印。カット演出を付けた後に、手で別の動きを選んだら変わるので、そこでカット演出をやめて普通の文字の描き方に戻る */
export const motionSig=lyric=>JSON.stringify([lyric?.motion?.code?.source??null,lyric?.motion?.recipe??null]);
/** この歌詞は、カット演出で描くか（文字が変わっていない・別の動きに変えられていない・データが読める） */
export function cutActive(x){
 const d=cutOf(x);
 return !!d&&d.v===CUT_VERSION&&Array.isArray(d.cuts)&&d.cuts.length>0&&d.dur>0&&d.text===x.text&&d.sig===motionSig(x)&&!!cleanCutData(d);
}
/** カット演出のデータの置き場: 歌詞は lyric.cut、自由文字（文字のクリップ）は clip.settings.cut */
export const cutOf=x=>x?.cut??x?.settings?.cut;
/** 歌詞・自由文字が、プロジェクトの時間のどこにあるか（クリップはシーンの原点からの時刻） */
export function spanOf(project,x){
 if(x.sceneId){const s=project.scenes.find(s=>s.id===x.sceneId);if(s)return {startUs:s.originUs+x.startUs,endUs:s.originUs+x.endUs};}
 return {startUs:x.startUs,endUs:x.endUs};
}
/** 自由文字: 文字のあるテキストのクリップ（おまかせの背景・文字のない演出は除く） */
export const isFreeText=c=>c?.kind==='text'&&!!String(c.text||'').trim()&&!c.settings?.omakase;

const DROP=new Set(['id','lineIndex','start','end','color','emphasisColor','paletteName']);
const finite=(x,def,lo=-Infinity,hi=Infinity)=>Number.isFinite(x)?clamp(x,lo,hi):def;
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
/**
 * 保存したカット演出のデータを、描けるカットに整える。読めない・壊れているなら null（その歌詞は普通の文字の描き方に戻る）。
 * 部品のキーが今の部品表にないもの（別の版で作られた等）は、「なし」にする。
 */
// ---- 保存した部品の値（P）の検査 -------------------------------------------------------------------------------------------------------------
// プロジェクトのファイルは人から受け取ることもある。P の値（背景の升目の大きさ・輪の数など）は描く繰り返しの回数を決めるので、そのまま信じない。
// 各部品の plan() を何通りか動かして「その部品が作りうる値の形と範囲」を調べ（初回だけ、覚えておく）、保存された値をその範囲に収める。
const SCHEMA_SAMPLES=1500,HEX=/^#[\da-f]{6}$/i;
const SAMPLE_CUT={text:'ほら、もう一回ひろげよう',emphasisColor:'#ffb347',color:'#ffffff',recap:false,lineIndex:0,unitIndex:0};
// 数えるための整数（本数・升の数）は範囲ぴったり、広い範囲の整数（乱数の種・通し番号）は両端に余裕を持たせる
function shapeOf(values){
 const defined=values.filter(v=>v!==undefined&&v!==null);
 if(!defined.length||defined.length!==values.length)return {t:'x'};
 if(defined.every(v=>typeof v==='number'&&Number.isFinite(v))){const min=Math.min(...defined),max=Math.max(...defined),int=defined.every(Number.isInteger),pad=int&&max-min<=50?0:Math.max(1e-9,(max-min)*.1);return {t:'n',min:min>=0?Math.max(0,min-pad):min-pad,max:max+pad,int,def:defined[0]};}
 if(defined.every(v=>typeof v==='string')){const hex=defined.some(v=>HEX.test(v));return {t:'s',set:[...new Set(defined.filter(v=>!HEX.test(v)))],hex,def:defined[0]};}
 if(defined.every(v=>typeof v==='boolean'))return {t:'b',def:defined[0]};
 if(defined.every(Array.isArray)){const lens=defined.map(v=>v.length);return {t:'a',min:Math.min(...lens),max:Math.max(...lens),el:shapeOf(defined.flat()),def:defined[0]};}
 if(defined.every(v=>typeof v==='object')){const keys=Object.keys(defined[0]).filter(k=>defined.every(v=>k in v));return {t:'o',keys:Object.fromEntries(keys.map(k=>[k,shapeOf(defined.map(v=>v[k]))])),def:defined[0]};}
 return {t:'x'};
}
function sanitize(v,shape){
 switch(shape.t){
  case 'n':return Number.isFinite(v)?Math.min(shape.max,Math.max(shape.min,shape.int?Math.round(v):v)):shape.def;
  case 's':return typeof v==='string'&&(shape.set.includes(v)||(shape.hex&&HEX.test(v)))?v:shape.def;
  case 'b':return typeof v==='boolean'?v:shape.def;
  case 'a':return Array.isArray(v)&&v.length>=shape.min&&v.length<=shape.max?v.map(x=>sanitize(x,shape.el)):structuredClone(shape.def);
  case 'o':{const o=obj(v);return Object.fromEntries(Object.entries(shape.keys).map(([k,sh])=>[k,sanitize(o[k],sh)]));}
  default:return null;
 }
}
const schemas=new Map();
/** reg[key] の plan が作りうる値の形。plan がない部品は null（値は {} にする） */
function schemaOf(group,reg,key){
 const id=group+':'+key;
 if(!schemas.has(id)){
  const d=reg[key];let shape=null;
  if(typeof d?.plan==='function'){
   const samples=[];
   for(let i=0;i<SCHEMA_SAMPLES;i++){try{samples.push(JSON.parse(JSON.stringify(d.plan(rng(`schema:${id}:${i}`),{...SAMPLE_CUT}))));}catch{}}
   shape=samples.length?shapeOf(samples):null;
  }
  schemas.set(id,shape);
 }
 return schemas.get(id);
}
/** 保存された部品の値 P を、その部品が作りうる範囲に収める（部品がなければ null、plan のない部品は {}） */
const cleanP=(group,reg,key,P)=>{if(!key)return null;const sh=schemaOf(group,reg,key);return sh&&sh.t==='o'?sanitize(P,sh):{};};
export const MAX_CUTS_PER_LYRIC=48,MAX_CUT_CHARS=300,MAX_RUNS=80;
/** 語ごとの指定（runs）。つなげた文字が、カットの文字そのものと同じでなければ（描く文字を差し替えたり、長くしたりするものは）使わない */
function cleanRuns(runs,text){
 const plain=[{text}];
 if(!Array.isArray(runs)||!runs.length||runs.length>MAX_RUNS)return plain;
 const out=runs.map(r=>({text:String(r?.text??''),...(r?.scale>0?{scale:finite(r.scale,1,.3,3)}:{}),...(r?.emphasis?{emphasis:true}:{}),...(typeof r?.color==='string'&&HEX.test(r.color)?{color:r.color}:{})}));
 return out.map(r=>r.text).join('')===text?out:plain;
}

const cleaned=new WeakMap();
export function cleanCutData(d){
 if(d&&typeof d==='object'){if(!cleaned.has(d))cleaned.set(d,cleanCutDataUncached(d));return cleaned.get(d);}
 return null;
}
function cleanCutDataUncached(d){
 if(!d||d.v!==CUT_VERSION||!Array.isArray(d.cuts)||!d.cuts.length||d.cuts.length>MAX_CUTS_PER_LYRIC||!(d.dur>0)||d.dur>3600)return null;
 const cuts=[];let at=0;
 for(const c of d.cuts){
  if(!c||typeof c.text!=='string'||!c.text.trim()||c.text.length>MAX_CUT_CHARS)return null;
  const a=finite(c.a,NaN,0,d.dur),b=finite(c.b,NaN,0,d.dur);
  if(!(b>a)||a<at-1e-6)return null;
  at=b;
  const key=(reg,k,def)=>reg&&typeof k==='string'&&Object.hasOwn(reg,k)?k:def;
  const n=[...c.text.replace(/\s/g,'')].length;
  let world=key(WORLD,c.world,null);if(world&&!WORLD[world].fits(n))world=null;   // その世界に置ける字数を超えるものは使わない
  const bgPart=key(BG,c.bgPart,null),cam=key(CAMERA,c.cam,null),fx=key(FX,c.fx,null),trans=key(TRANS,c.trans,null);
  const enter=key(ENTER,c.enter,'cut'),hold=key(HOLD,c.hold,'still'),exit=key(EXIT,c.exit,'cut'),treat=key(TREAT,c.treat,'none');
  cuts.push({
   a,b,text:c.text,recap:!!c.recap,unitIndex:finite(c.unitIndex,cuts.length,0,1000),moodId:key(Object.fromEntries(MOODS.map(m=>[m.id,1])),c.moodId,'pop'),
   placeName:typeof c.placeName==='string'&&c.placeName.length<20?c.placeName:'center',place:{rotation:finite(c.place?.rotation,0,-360,360),scale:finite(c.place?.scale,1,.3,2)},
   fontScale:finite(c.fontScale,.12,.03,.5),runs:cleanRuns(c.runs,c.text),
   bg:HEX.test(c.bg)?c.bg:BGS[0],seed:finite(c.seed,1,0,1e9)|0,
   bgPart,bgP:bgPart?cleanP('bg',BG,bgPart,c.bgP):null,cam,camP:cam?cleanP('cam',CAMERA,cam,c.camP):null,fx,fxP:fx?cleanP('fx',FX,fx,c.fxP):null,
   trans,transP:trans?cleanP('trans',TRANS,trans,c.transP):null,transDur:trans?finite(c.transDur,0,0,2):0,
   ghost:finite(c.ghost,0,0,2.5),ghostP:{dir:c.ghostP?.dir===-1?-1:1},
   enter,enterP:cleanP('enter',ENTER,enter,c.enterP)??{},hold,holdP:cleanP('hold',HOLD,hold,c.holdP)??{},exit,exitP:cleanP('exit',EXIT,exit,c.exitP)??{},
   treat,treatP:cleanP('treat',TREAT,treat,c.treatP)??{},gFont:key(Object.fromEntries(GLYPH_FONTS.map(f=>[f,1])),c.gFont,'gothic'),gVertical:!!c.gVertical&&!world,
   world,worldP:world?cleanP('world',WORLD,world,c.worldP):null,worldExit:!!c.worldExit,worldA:world?finite(c.worldA,1,0,1):undefined,carry:!!c.carry,carryDur:finite(c.carryDur,0,0,1),dScale:c.dScale>0?finite(c.dScale,1,.5,2):undefined
  });
 }
 return {v:CUT_VERSION,text:d.text,sig:d.sig,dur:d.dur,seed:d.seed|0,cuts};
}

/**
 * 歌詞（や自由文字）のカット演出を、プロジェクトの時刻（秒）つきのカットにする。長さが変わっていたら、カットの境目も同じ割合で伸び縮みする。
 * span: {startUs,endUs}（プロジェクトの時間での位置。歌詞は省いてよい。自由文字は spanOf で）。colors: {color,emphasisColor}（動きの色。なければ白と金）。id は `${id}:${番号}`。
 */
export function absoluteCuts(lyric,{color,emphasisColor,span}={}){
 if(!cutActive(lyric))return null;
 const sp=span||{startUs:lyric.startUs,endUs:lyric.endUs};
 const d=cleanCutData(cutOf(lyric)),L0=sp.startUs/1e6,dur=(sp.endUs-sp.startUs)/1e6,k=dur/d.dur;
 const col=/^#[\da-f]{6}$/i.test(color||lyric.motion?.color)?(color||lyric.motion.color):'#ffffff',acc=/^#[\da-f]{6}$/i.test(emphasisColor||lyric.motion?.emphasisColor)?(emphasisColor||lyric.motion.emphasisColor):'#ffc04d';
 return d.cuts.map((c,i)=>{
  const start=L0+c.a*k,end=i===d.cuts.length-1?sp.endUs/1e6:L0+c.b*k,len=end-start;
  return {...c,id:`${lyric.id}:${i}`,start,end,color:col,emphasisColor:acc,transDur:Math.min(c.transDur,.45*len),carryDur:Math.min(c.carryDur,.5*len)};
 });
}

/**
 * プロジェクトの歌詞（と、freeText なら自由文字）→ 行（開始が早い順）。文字のないものは飛ばす。
 * lyrics（= subjects）は {id,kind:'lyric'|'clip',text,motion,startUs,endUs}。index が行番号に当たる。
 */
export function linesOf(project,{freeText=false}={}){
 const subjects=[];
 for(const l of project.lyrics)if(String(l.text||'').trim()&&l.endUs>l.startUs)subjects.push({id:l.id,kind:'lyric',text:l.text,motion:l.motion,startUs:l.startUs,endUs:l.endUs});
 if(freeText)for(const c of project.clips||[])if(isFreeText(c)){const sp=spanOf(project,c);if(sp.endUs>sp.startUs)subjects.push({id:c.id,kind:'clip',text:c.text,motion:c.motion,...sp});}
 subjects.sort((a,b)=>a.startUs-b.startUs);
 return {lyrics:subjects,subjects,lines:subjects.map(l=>({text:String(l.text).replace(/\s*\n\s*/g,' ').trim(),start:l.startUs/1e6,end:l.endUs/1e6}))};
}

export const CUT_DEFAULTS={freeText:true,mood:MIX,density:.57,recap:'auto',wordSizes:true,sizePct:12,bgMode:'auto',camAmount:.6,fxAmount:.5,transAmount:.65,treatAmount:.45,holdAmount:.7,ghostAmount:.2,worldAmount:.55,worldOpacity:1,carryAmount:.35,avoidFlash:true,fontMode:'cut',refine:true};

/**
 * 計画の前半（文字の大きさを測らなくてよい所まで）。返す cuts は、まだ検査と手直しの前。
 * palette: {color,emphasisColor}（検査と手直しで文字を測る時の色。保存はしない）。
 */
export function planCutsRaw(project,opts={}){
 const o={...CUT_DEFAULTS,...opts},seed=Number.isFinite(o.seed)?o.seed|0:1;
 const {lyrics,lines}=linesOf(project,{freeText:o.freeText});
 const cuts=planCuts(lines,{mood:o.mood,density:o.density,recap:o.recap,wordSizes:o.wordSizes,sizePct:o.sizePct,seed});
 const pal=o.palette||{color:'#ffffff',emphasisColor:'#ffc04d'};
 for(const c of cuts){c.color=pal.color;c.emphasisColor=pal.emphasisColor;}   // 部品を選ぶ前に付ける（物の世界の計画が文字色を見るので）
 assignParts(cuts,{seed,bgMode:o.bgMode,camAmount:o.camAmount,fxAmount:o.fxAmount,transAmount:o.transAmount,ghostAmount:o.ghostAmount,avoidFlash:o.avoidFlash});
 assignGlyphParts(cuts,{seed,fontMode:o.fontMode,treatAmount:o.treatAmount,holdAmount:o.holdAmount});
 assignWorlds(cuts,{seed,worldAmount:o.worldAmount,worldOpacity:o.worldOpacity});
 assignCarry(cuts,{seed,carryAmount:o.carryAmount});
 return {cuts,lyrics,seed,options:o};
}
/** 計画で使う書体（検査と手直しの前に、これを読み込んでおく） */
export const fontsUsed=cuts=>[...new Set(cuts.map(c=>c.gFont||'gothic'))];

/**
 * 計画の後半: 検査と手直し（itemOf があれば）と、歌詞ごとのデータ（lyric.cut に入れるもの）への変換。
 * itemOf(cut): 文字アイテム（items.js の buildAnyItem で、実際の書体で測ったもの）。invalidate(cut): cut を変えたあと、測り直せるようにする。
 * 返す data は Map(歌詞のid → データ)。
 */
export function finishCutPlan({cuts,lyrics,seed,options},{itemOf,invalidate=()=>{},H=540}={}){
 const o=options,fixes=o.refine&&itemOf?refinePlan(cuts,{itemOf,invalidate,seed,H}):[];
 const audit=auditPlan(cuts,{itemOf,H});
 const data=new Map();
 lyrics.forEach((l,li)=>{
  const mine=cuts.filter(c=>c.lineIndex===li);if(!mine.length)return;
  const L0=l.startUs/1e6;
  data.set(l.id,{v:CUT_VERSION,text:l.text,sig:motionSig(l),dur:(l.endUs-l.startUs)/1e6,seed,cuts:mine.map(c=>{
   const out={};for(const [k,v] of Object.entries(c))if(!DROP.has(k)&&v!==undefined)out[k]=structuredClone(v);
   out.a=Math.round((c.start-L0)*1000)/1000;out.b=Math.round((c.end-L0)*1000)/1000;
   return out;
  })});
 });
 return {data,cuts,fixes,audit,lyrics};
}

/** 計画の要約（画面の「いまの案」の表示用） */
export function summarizeCuts(cuts){
 const count=f=>cuts.filter(f).length,names=reg=>keys=>[...new Set(keys.filter(Boolean))].map(k=>reg[k]?.name||k);
 return {cuts:cuts.length,recaps:count(c=>c.recap),worlds:names(WORLD)(cuts.map(c=>c.world)),cameras:names(CAMERA)(cuts.map(c=>c.cam)),effects:names(FX)(cuts.map(c=>c.fx)),
  transitions:names(TRANS)(cuts.map(c=>c.trans)),carries:count(c=>c.carry),backgrounds:names(BG)(cuts.map(c=>c.bgPart)),enters:names(ENTER)(cuts.map(c=>c.enter)),
  avgCut:cuts.length?cuts.reduce((a,c)=>a+(c.end-c.start),0)/cuts.length:0};
}
