// カット演出の層: 歌詞1行を、カットごとの背景・カメラ・文字（字ごとの部品・物の世界）・ゴースト・つなぎ・引き継ぎ・画面効果で描く。
// 文字は Worker のコードモーションではなく、このフォルダの文字エンジンが時刻から直接描く。出力は不透明な1枚（背景の絵と、歌詞の期間いっぱいの絵）。
// compositor.js が、歌詞に cut（plan.js の cutActive）があれば kind 'cut' としてこの層を使う。プレビューも書き出しも同じ道を通る。
import {drawCutFrame,finishFrame,ghostPasses,ghostOffset,resetCtx} from './compose.js';
import {renderText} from './glyphs.js';
import {renderWorld,worldBox} from './worlds.js';
import {buildAnyItem} from './items.js';
import {absoluteCuts,fontsUsed,cleanCutData,cutActive,cutOf,spanOf} from './plan.js';
import {layerFrame} from '../image-layer.js';
import {checkAbort} from '../file.js';
import {StudioError} from '../model.js';

// ---- 書体（アプリ同梱の6書体。使う分だけ、最初に1度だけ読む） -----------------------------------------------------------------------------------
const fontJobs=new Map();
/** 使う書体を、document.fonts に 'U-<key>' という名前で登録して待つ。読めなかった書体は警告して、代わりの書体で描く。 */
export function ensureCutFonts(keys,{signal}={}){
 return Promise.all([...new Set(keys)].map(key=>{
  if(!fontJobs.has(key)){
   const base=new URL('../../vendor/motion-fonts/',import.meta.url);
   fontJobs.set(key,(async()=>{
    const response=await fetch(new URL(key+'.ttf',base));if(!response.ok)throw new Error('font '+key);
    const font=await new FontFace('U-'+key,await response.arrayBuffer()).load();document.fonts.add(font);
   })().catch(e=>{console.warn('カット演出の書体を読めませんでした:',key,e);}));
  }
  return fontJobs.get(key);
 })).then(()=>checkAbort(signal));
}
/** プロジェクトにカット演出のある歌詞が使う書体を、先に読み始める（待たない）。再生の途中で書体の読み込みを待たなくて済むように、合成器が準備の時に呼ぶ */
export function warmCutFonts(project){
 if(typeof document==='undefined'||typeof FontFace==='undefined')return;
 const keys=new Set();
 for(const x of [...(project.lyrics||[]),...(project.clips||[])]){const d=cutOf(x)&&cleanCutData(cutOf(x));if(d&&cutActive(x))for(const c of d.cuts)keys.add(c.gFont||'gothic');}
 if(keys.size)ensureCutFonts([...keys]).catch(()=>{});
}
let measureCtx=null;
/** 1字の幅を測る（検査と手直し、文字アイテムの作成に渡す）。書体は ensureCutFonts で読んでおく */
export const measureChar=(ch,font,px)=>{measureCtx??=new OffscreenCanvas(1,1).getContext('2d');measureCtx.font=`${px}px "U-${font}", sans-serif`;return measureCtx.measureText(ch).width;};

// ---- エンジン: 1つの歌詞の層ぶんの、文字アイテム・作業用キャンバス・前のカットの絵 ---------------------------------------------------------------------
const cpu=c=>c.getContext('2d',{willReadFrequently:true});   // 1度描いたきり置いておくもの（中身が消えない）
const gpu=c=>c.getContext('2d');                              // 毎フレーム描き直すもの（影やぼかしが速い）
export function createCutEngine(){
 const pool=new Map(),items=new Map(),prevFrames=new Map();
 const S={W:0,H:0,opaque:true,tmp:null,canvas:null};
 S.canvas=(key,w=S.W,h=S.H)=>{let c=pool.get(key);if(!c){c=new OffscreenCanvas(w,h);pool.set(key,c);}if(c.width!==w||c.height!==h){c.width=w;c.height=h;}return c;};
 S.tmp=(slot,w=S.W,h=S.H)=>S.canvas('tmp'+slot,w,h);
 const layerCtx=()=>{const c=cpu(S.canvas('layer'));resetCtx(c);c.clearRect(0,0,S.W,S.H);return c;};
 const clear=c=>{const x=gpu(c);resetCtx(x);x.clearRect(0,0,S.W,S.H);return x;};
 function inkOf(bmp){
  const c=S.canvas('ink',96,54),x=cpu(c);x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,96,54);x.drawImage(bmp,0,0,96,54);
  const d=x.getImageData(0,0,96,54).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>40)n++;return n;
 }
 const engine={
  /** 画面の大きさが変わったら、測り直しと前の絵の作り直し（保存したキャンバスは、大きさだけ変えて使い回す） */
  setSize(W,H){if(S.W===W&&S.H===H)return;S.W=W;S.H=H;items.clear();prevFrames.clear();},
  /** 下に別の絵（画像・動画・UNFOLD・ほかのクリップ）があるときは false: 背景色を塗らず、下の絵が透けて見える。変わったら前の絵は作り直す */
  setOpaque(opaque){if(S.opaque===opaque)return;S.opaque=opaque;prevFrames.clear();},
  itemOf(cut){
   let it=items.get(cut.id);
   if(!it){it=buildAnyItem(cut,{W:S.W,H:S.H,measure:measureChar});items.set(cut.id,it);}
   return it;
  },
  /** 台の四角（引き継ぎが重ねる）。世界があれば世界の台、なければ文字の外接矩形（置き場所の変形を通して） */
  boxOf(cut){
   const it=engine.itemOf(cut),{W,H}=S;
   if(cut.world)return worldBox(cut,it,W,H);
   const b=it.bbox,p=it.place,pad=Math.max(24,it.size*.4),a=p.rotation*Math.PI/180;
   const vx=((b.x0+b.x1)/2-W/2)*p.scale,vy=((b.y0+b.y1)/2-H/2)*p.scale;
   return {cx:W*p.x+vx*Math.cos(a)-vy*Math.sin(a),cy:H*p.y+vx*Math.sin(a)+vy*Math.cos(a),w:(b.x1-b.x0+pad*2)*p.scale,h:(b.y1-b.y0+pad*2)*p.scale,rot:p.rotation};
  },
  textCanvas(cut,lt){
   const c=S.canvas('text'),x=clear(c),it=engine.itemOf(cut);
   if(cut.world)renderWorld(x,cut,it,lt,{layer:layerCtx,W:S.W,H:S.H});else renderText(x,it,lt,{layer:layerCtx});
   return c;
  },
  /** ゴーストの層: 世界の物は付けず、文字だけを、その時刻で、その色で描く（層ごとに別のキャンバス） */
  textOnly(cut,lt,slot,tint){
   const c=S.canvas('ghost'+slot),x=clear(c),it=engine.itemOf(cut);
   if(cut.world)renderWorld(x,cut,it,lt,{layer:layerCtx,W:S.W,H:S.H,props:false,tint});else renderText(x,it,lt,{layer:layerCtx,tint});
   return c;
  },
  /** 前のカットの落ち着いた絵（後半のうち文字がいちばん多いコマ） */
  prevFrame(prev){
   let f=prevFrames.get(prev.id);if(f)return f;
   const dur=prev.end-prev.start;let best=0,bestInk=-1;
   for(const u of [.45,.6,.75,.9]){const lt=Math.min(dur*u,dur-1e-3),ink=inkOf(engine.textCanvas(prev,lt));if(ink>bestInk){bestInk=ink;best=lt;}}
   const tc=engine.textCanvas(prev,best),c=S.canvas('prev:'+prev.id);
   drawCutFrame(cpu(c),{...prev,place:engine.itemOf(prev).place},prev.start+best,tc,S);
   prevFrames.set(prev.id,c);
   if(prevFrames.size>3){const k=prevFrames.keys().next().value;prevFrames.delete(k);pool.delete('prev:'+k);}
   return c;
  },
  /** cuts[idx] の、時刻 t（プロジェクトの秒）の絵。cuts[idx-1] は前のカット（つなぎ・引き継ぎの「前の絵」を作る）。返すキャンバスは次の draw まで有効 */
  draw(cuts,idx,t){
   const cut=cuts[idx],X=S.canvas('X'),lt0=Math.min(t-cut.start,cut.end-cut.start-1e-3),tc=engine.textCanvas(cut,lt0);
   const ghosts=ghostPasses(cut,lt0).map((pass,i)=>({bmp:engine.textOnly(cut,pass.lt,i,pass.color),color:pass.color,...ghostOffset(cut,pass,S),tinted:true}));
   drawCutFrame(gpu(X),{...cut,place:engine.itemOf(cut).place},t,tc,S,ghosts);
   const prev=idx>0?cuts[idx-1]:null,lt=t-cut.start,touching=!!prev&&Math.abs(cut.start-prev.end)<=.06;
   let A=null,carry=null,cutArg=cut;
   if(cut.carry&&touching&&lt<cut.carryDur){A=engine.prevFrame(prev);carry={dur:cut.carryDur,fromBox:engine.boxOf(prev),toBox:engine.boxOf(cut)};cutArg={...cut,trans:null,transDur:0};}   // 引き継ぎは、つなぎの代わり
   else if(cut.trans&&touching&&lt<cut.transDur)A=engine.prevFrame(prev);
   const out=S.canvas('out');finishFrame(gpu(out),{cut:cutArg,t,X,A,carry},S);
   return out;
  },
  dispose(){pool.clear();items.clear();prevFrames.clear();}
 };
 return engine;
}

/** 部品を全部外した、いちばん素朴なカット（部品の表と食い違うデータで描けなかった時の代わり） */
const plainCut=c=>({...c,bgPart:null,cam:null,fx:null,trans:null,transDur:0,ghost:0,world:null,worldP:null,carry:false,carryDur:0,enter:'cut',enterP:{},hold:'still',holdP:{},exit:'cut',exitP:{},treat:'none',treatP:{},gVertical:false});

/** この時刻に、このカット演出より下（ほかのクリップ）に見える絵があるか。あれば、カット演出は透明な絵にする */
const hasUnderlay=(project,tUs,selfId)=>{
 const scene=project.scenes.find(s=>s.startUs<=tUs&&tUs<s.endUs);
 return !!scene&&project.clips.some(c=>c.id!==selfId&&c.sceneId===scene.id&&c.opacity!==0&&tUs>=scene.originUs+c.startUs&&tUs<scene.originUs+c.endUs);
};

export function createCutLayer(){
 let clip,project,cuts=[],first=0,engine,dead=false;
 return {
  async prepare(c,p,assets,signal){
   clip=c;project=p;
   const mine=absoluteCuts(c,{span:spanOf(p,c)});if(!mine)throw new StudioError('INVALID_CUT');
   // 歌詞は、前の歌詞のカットがこの歌詞の頭とほぼ隙間なく続くなら、その最後のカットが「前のカット」（つなぎ・引き継ぎの前の絵）
   let prev=null;
   if(!c.sceneId){const sorted=[...p.lyrics].sort((a,b)=>a.startUs-b.startUs),before=sorted[sorted.findIndex(l=>l.id===c.id)-1];
    prev=before&&Math.abs(c.startUs-before.endUs)<=60000?absoluteCuts(before)?.at(-1)||null:null;}
   cuts=prev?[prev,...mine]:mine;first=prev?1:0;
   await ensureCutFonts(fontsUsed(cuts),{signal});
   checkAbort(signal);if(dead)throw new StudioError('LAYER_DISPOSED');
   engine=createCutEngine();
  },
  async render(r){
   checkAbort(r.signal);if(dead)throw new StudioError('LAYER_DISPOSED');
   const t=r.projectUs/1e6;engine.setSize(r.width,r.height);engine.setOpaque(!hasUnderlay(project,r.projectUs,clip.id));
   let idx=cuts.findIndex((c,i)=>i>=first&&t>=c.start&&t<c.end);
   if(idx<0)idx=t<cuts[first].start?first:cuts.length-1;
   let out;
   try{out=engine.draw(cuts,idx,t);}
   catch(e){console.warn('カット演出を描けなかったので、部品を外して描きます:',e);engine.dispose();engine.setSize(0,0);engine.setSize(r.width,r.height);out=engine.draw(cuts.map(plainCut),idx,t);}
   checkAbort(r.signal);
   return layerFrame(out.transferToImageBitmap());
  },
  dispose(){dead=true;engine?.dispose();engine=null;}
 };
}
