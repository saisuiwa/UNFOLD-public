import {isLyricFontKey} from './lyric-fonts.js';
export const IMAGE_RUNTIME='three180-troika524-gsap313-rapier021-v1';
export const isImageMethodKey=id=>typeof id==='string'&&id.startsWith('im-');
export const newImageMethodId=()=>`im-${crypto.randomUUID()}`;
export function cleanImageCode(v){
 if(!v||v.version!==1||v.runtime!==IMAGE_RUNTIME||typeof v.source!=='string'||!v.source.trim()||v.source.length>32000)throw Error('画像コードは対応版のJavaScriptを1〜32000文字で指定してください。');
 if(Object.keys(v).some(k=>!['version','runtime','source','params'].includes(k)))throw Error('画像コードに未対応の項目があります。');
 if(v.params!==undefined&&(!v.params||typeof v.params!=='object'||Array.isArray(v.params)))throw Error('物理設定はオブジェクトで指定してください。');
 const p=v.params||{},out={};
 if(p.font!==undefined&&!isLyricFontKey(p.font))throw Error('未対応の書体です。');
 if(Object.keys(p).some(k=>!['columns','gravity','bounce','seed','returnMode','label','font'].includes(k)))throw Error('未対応の物理設定です。');
 for(const [k,d,min,max] of [['columns',12,2,24],['gravity',4,0,20],['bounce',.5,0,1],['seed',7,0,999999]]){const n=p[k]??d;if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw Error(k+' が範囲外です。');out[k]=k==='columns'||k==='seed'?Math.round(n):n;}
 if(p.returnMode!=null&&!['reverse','assemble'].includes(p.returnMode))throw Error('戻り方を確認してください。');
 out.returnMode=p.returnMode||'reverse';out.label=typeof p.label==='string'?p.label.slice(0,100):'UNFOLD';out.font=typeof p.font==='string'?p.font:'gothic';
 return {version:1,runtime:IMAGE_RUNTIME,source:v.source,params:out};
}
export function imageMethodIdentity(m){return m.code?JSON.stringify(cleanImageCode(m.code)):m.vertex;}
export const smoothImage=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
export function imageFrame(time,duration,strength=.8){
 const progress=Math.max(0,Math.min(1,time/Math.max(.001,duration))),envelope=smoothImage(progress/.22)*(1-smoothImage((progress-.76)/.24));
 return {clipTime:progress*duration,duration,progress,amount:envelope*strength,form:0,phase:progress<.5?'enter':'exit',direction:progress<.5?1:-1,imageMix:smoothImage((progress-.42)/.16)};
}
