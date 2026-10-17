import {FontLoader} from './vendor/FontLoader.js';
import {TextGeometry} from './vendor/TextGeometry.js';
import {modelLayout} from './model-layout.js?v=13';
let fontPromise;
export function validateText(text){
 const value=String(text).trim();
 if(!value||value.length>24||!/^[A-Za-z0-9 .!?+&-]+$/.test(value))throw new Error('英数字と . ! ? + & - を、1〜24文字で入力してね。');
 return value;
}
export function textLayout(text,fontData){
 const value=validateText(text),font=new FontLoader().parse(fontData);
 if([...value].some(c=>!font.data.glyphs[c]))throw new Error('この文字は現在のフォントに対応していません。');
 const geometry=new TextGeometry(value,{font,size:1,depth:.28,curveSegments:8,steps:1,bevelEnabled:true,bevelThickness:.025,bevelSize:.018,bevelSegments:2});
 try{
  geometry.computeBoundingBox();const b=geometry.boundingBox;
  const data=modelLayout(geometry.getAttribute('position').array);
  const factor=Math.min(5/(b.max.x-b.min.x),3.2/(b.max.y-b.min.y))/data.scale;
  for(let i=0;i<data.target.length;i++)data.target[i]*=factor;
  data.scale*=factor;return data;
 }finally{geometry.dispose()}
}
export async function createTextShape(text){
 const value=validateText(text);
 if(!fontPromise)fontPromise=fetch(new URL('./vendor/helvetiker_bold.typeface.json',import.meta.url)).then(r=>{if(!r.ok)throw new Error('文字用フォントを読み込めませんでした。');return r.json()}).catch(e=>{fontPromise=null;throw e});
 return textLayout(value,await fontPromise);
}
