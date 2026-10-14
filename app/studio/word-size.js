// Word sizes for おまかせ: a lyric line is cut into words (Intl.Segmenter, the same ICU dictionary Chrome uses), the content words are made big and the
// particles / auxiliaries small ("私"大 "は"小 "元気"大 "です"小), and the sizes are written as a run's `scale` (1 = as set). Pure: no DOM.
import {graphemes} from '../lyric-motion.js';

// function words that are drawn small; anything else made of kanji / katakana / latin / three or more hiragana is a content word
const SMALL=new Set(['は','が','を','に','へ','で','と','も','の','や','か','よ','ね','な','さ','ぞ','わ','ば','より','から','まで','など','だけ','しか','ので','のに','けど','けれど','です','ます','でした','ました','だ','だった','じゃ','って','という','として','には','では','とは','でも','にも','へも','まで','こと','もの','ない','ある','いる','する','れる','られる','たい','ように','みたい']);
// pieces that are part of the word in front of them (て in ほどいて, 。after a word)
const ATTACH=new Set(['て','た','だ','い','う','る','き','し','ち','り','み','ん','っ','ゃ','ゅ','ょ','ぇ']);
const PUNCT=/^[\s、。，．,.!?！？…‥ー〜～・「」『』（）()\[\]【】〔〕〈〉《》"'“”‘’\-—]+$/u;
const HAN=/\p{Script=Han}/u,KATA=/[\p{Script=Katakana}ー]/u,LATIN=/[A-Za-z0-9]/;

/** Words of a line: [{text,from,to}] (UTF-16 offsets into `text`). Falls back to runs of one script when Intl.Segmenter is missing. */
export function wordPieces(text){
 const out=[];text=String(text||'');
 if(typeof Intl!=='undefined'&&Intl.Segmenter){
  for(const s of new Intl.Segmenter('ja',{granularity:'word'}).segment(text))out.push({text:s.segment,from:s.index,to:s.index+s.segment.length});
  return out;
 }
 let i=0;const cls=c=>HAN.test(c)?'h':KATA.test(c)?'k':/\p{Script=Hiragana}/u.test(c)?'r':PUNCT.test(c)?'p':LATIN.test(c)?'l':'o';
 while(i<text.length){let j=i+1;const k=cls(text[i]);while(j<text.length&&cls(text[j])===k&&k!=='p')j++;out.push({text:text.slice(i,j),from:i,to:j});i=j;}
 return out;
}

const clampScale=v=>Math.max(.55,Math.min(1.7,v));
/** 'small' | 'big' | 'attach' (takes the size of the piece before it) | 'plain' */
export function wordKind(piece){
 const t=piece.text;
 if(PUNCT.test(t))return 'attach';
 if(SMALL.has(t))return 'small';
 if(ATTACH.has(t))return 'attach';
 if(HAN.test(t)||KATA.test(t)||LATIN.test(t))return 'big';
 return [...t].length>=3?'big':[...t].length===1?'small':'plain';
}

/**
 * Sizes for one line: [{from,to,scale}] (only pieces whose size is not 1), or [] when the line is too short / has nothing to contrast.
 * `rnd` is a 0..1 generator, `strength` 0..1 how far the sizes go apart. The mean size (by character count) is kept at 1 so the line is as wide as before.
 */
export function pickWordScales(text,rnd,{strength=1,big=[1.35,1.7],small=[.58,.78],mid=[.95,1.15]}={}){
 const pieces=wordPieces(text).filter(p=>p.text.length);
 const chars=[...String(text||'')].filter(c=>!/\s/.test(c)).length;
 if(chars<3||strength<=0)return [];
 const kinds=pieces.map(wordKind);
 const lerp=(a,b,u)=>a+(b-a)*u,pick=r=>lerp(r[0],r[1],rnd());
 const has=k=>kinds.includes(k);
 let scales=pieces.map((p,i)=>{
  const k=kinds[i];
  if(k==='big')return rnd()<.22?pick(mid):pick(big);
  if(k==='small')return pick(small);
  return 1;
 });
 // a line with nothing small (or nothing big): alternate so there is still a rhythm, only if there are enough words
 const contentCount=kinds.filter(k=>k==='big'||k==='plain').length;
 if(!has('small')&&contentCount>=3){let flip=rnd()<.5;scales=scales.map((s,i)=>{if(kinds[i]!=='big'&&kinds[i]!=='plain')return 1;flip=!flip;return flip?pick(big):pick(small);});}
 else if(!has('small')||!has('big')&&contentCount<2)return [];
 // attach pieces follow the piece before them
 for(let i=0;i<pieces.length;i++)if(kinds[i]==='attach')scales[i]=i>0?scales[i-1]:(scales[i+1]??1);
 // strength pulls every size toward 1
 scales=scales.map(s=>1+(s-1)*Math.min(1,strength));
 // keep the mean size at 1 (by character count)
 let total=0,weight=0;pieces.forEach((p,i)=>{const n=[...p.text].filter(c=>!PUNCT.test(c)).length;total+=scales[i]*n;weight+=n;});
 const mean=weight?total/weight:1;
 const out=[];
 pieces.forEach((p,i)=>{const s=Math.round(clampScale(scales[i]/mean)*100)/100;if(Math.abs(s-1)>.02)out.push({from:p.from,to:p.to,scale:s});});
 return out.length?out:[];
}

/**
 * New runs for a lyric with `ranges` ([{from,to,scale}] over lyric.text) applied. Colours, outlines and the grapheme ids (saved line breaks) stay.
 * `ranges: []` clears every scale.
 */
export function sizeRuns(lyric,ranges){
 const items=[];let pos=0;
 for(const [ri,r] of (lyric.runs||[]).entries())for(const [i,g] of graphemes(r.text||'').entries()){
  const at=ranges.find(x=>x.from<=pos&&pos<x.to);
  items.push({text:g,emphasis:!!r.emphasis,color:r.color,outline:!!r.outline,outlineColor:r.outline?r.outlineColor:undefined,outlineWidth:r.outline?r.outlineWidth:undefined,hollow:!!r.hollow,scale:at?at.scale:undefined,id:r.glyphIds?.[i]??`${r.id??ri}:${i}`});
  pos+=g.length;
 }
 const out=[];
 for(const it of items){const last=out.at(-1);
  if(last&&last.emphasis===it.emphasis&&last.color===it.color&&last.outline===it.outline&&last.outlineColor===it.outlineColor&&last.outlineWidth===it.outlineWidth&&last.hollow===it.hollow&&last.scale===it.scale){last.text+=it.text;last.glyphIds.push(it.id);}
  else out.push({...it,glyphIds:[it.id]});}
 return out.map(r=>({text:r.text,emphasis:r.emphasis,...(r.color?{color:r.color}:{}),...(r.outline?{outline:true}:{}),...(r.outline&&r.outlineColor?{outlineColor:r.outlineColor}:{}),...(r.outline&&r.outlineWidth?{outlineWidth:r.outlineWidth}:{}),...(r.hollow?{hollow:true}:{}),...(r.scale>0&&r.scale!==1?{scale:r.scale}:{}),id:r.glyphIds[0]?.split(':')[0]||crypto.randomUUID(),glyphIds:r.glyphIds}));
}
