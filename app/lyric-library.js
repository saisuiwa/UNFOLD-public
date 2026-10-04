import {cleanMotion} from './lyric-motion.js?v=3';
import {validateRecipe,BUILTIN_MOTIONS} from './lyric-recipe.js';
export const MOTION_LIBRARY_KEY='unfold-motion-library-v1';
const maxChars=32768,validFonts=['gothic','mincho','round','dela','marker','dot'];
export function cleanMotionRecord(value){
 if(!value||typeof value!=='object'||typeof value.name!=='string'||!value.name.trim()||value.name.length>40)throw Error('名前は1〜40文字で入力してください。');
 const m=value.motion;
 if(!m||typeof m!=='object'||Object.keys(m).some(k=>!['recipe','preset','direction','color','emphasisColor','size','position','font','speed'].includes(k)))throw Error('文字モーションの設定を確認してください。');
 const recipe=validateRecipe(m.recipe);
 for(const [k,min,max]of [['size',32,160],['speed',.5,2]])if(m[k]!=null&&(!Number.isFinite(m[k])||m[k]<min||m[k]>max))throw Error(`${k} が範囲外です。`);
 for(const k of ['color','emphasisColor'])if(m[k]!=null&&!/^#[\da-f]{6}$/i.test(m[k]))throw Error('色は #rrggbb で指定してください。');
 if(m.font!=null&&!validFonts.includes(m.font))throw Error('未対応の書体です。');
 return {name:value.name.trim(),description:String(value.description||'').slice(0,300),motion:cleanMotion({...m,recipe})};
}
export function buildMotionFile(record){return JSON.stringify({format:'unfold-motion',version:1,...cleanMotionRecord(record)},null,2)+'\n'}
export function parseMotionFile(text){
 if(typeof text!=='string'||text.length>maxChars)throw Error('モーションファイルは32KB以内にしてください。');
 let v;try{v=JSON.parse(text)}catch{throw Error('JSONとして読み込めません。')}
 if(v?.format!=='unfold-motion'||v.version!==1)throw Error('未対応のモーションファイルです。');
 if(Object.keys(v).some(k=>!['format','version','name','description','motion'].includes(k)))throw Error('モーションファイルに未対応の項目があります。');
 return cleanMotionRecord(v);
}
const hash=text=>{let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(16)};
export function createMotionLibrary(storage){
 const getStore=()=>storage||globalThis.localStorage;
 function list(){let raw;try{raw=getStore().getItem(MOTION_LIBRARY_KEY)}catch{throw Error('ブラウザの保存場所を開けません。ファイルに保存してください。')}
  if(!raw)return [];try{const data=JSON.parse(raw);if(!Array.isArray(data)||data.length>100)throw Error();return data.map(x=>({...cleanMotionRecord(x),id:String(x.id)}))}catch{throw Error('保存済みモーションを読み込めません。既存データは変更していません。')}
 }
 return {list,save(value){const item=cleanMotionRecord(value),items=list(),key=JSON.stringify(item.motion),same=items.find(x=>JSON.stringify(x.motion)===key);
  if(same)return structuredClone(same);
  if(items.length>=100)throw Error('モーションは100個までです。');
  let id='lm-'+hash(key);while(items.some(x=>x.id===id))id+='x';const result={...item,id};
  try{getStore().setItem(MOTION_LIBRARY_KEY,JSON.stringify([...items,result]))}catch{throw Error('保存できませんでした。空き容量を確認するか、ファイルに保存してください。')}
  return result;
 }};
}
export function motionAIPrompt(){return `UNFOLD用のテキストモーションを作成してください。説明やコードフェンスなしでJSONのみ返してください。実行コード、URL、歌詞は入れません。\n構成 layout: editorial / impact / vertical / echo / assemble / poster\n登場 enter: rise / scatter / reveal / pop / fade\n表示中 sustain: sway / breathe / glitch / warp / echo から重複なしで0〜3種類\n退場 exit: fade / drift / scatter\nstrength: 0〜1、stagger: 0〜0.2（秒）。書体 font: gothic / mincho / round / dela / marker / dot。size:32〜160、speed:0.5〜2。色は#rrggbb。\n以下の形式を守り、希望に合う組み合わせに変えてください。未対応の機能や項目は追加しないでください。\n${buildMotionFile(BUILTIN_MOTIONS[0])}\n希望の動き：`}
