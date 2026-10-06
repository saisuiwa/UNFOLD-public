export const DRAFTS_KEY='unfold-workshop-drafts-v1';
export function colorFormats(value){
 if(typeof value!=='string'||!/^#[\da-f]{6}$/i.test(value))throw Error('色は #rrggbb の6桁で入力してください。');
 const hex=value.toLowerCase(),rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
 return {hex,js:'0x'+hex.slice(1),glsl:`vec3(${rgb.map(x=>x.toFixed(4)).join(', ')})`};
}
export function imageScale(width,height){
 if(![width,height].every(n=>Number.isFinite(n)&&n>0)||width*height>80e6)throw Error('画像は8000万画素以内にしてください。');
 const scale=Math.min(1,2048/Math.max(width,height));return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
export function readDrafts(storage){
 try{const raw=storage.getItem(DRAFTS_KEY);if(!raw)return {active:'',drafts:{}};const v=JSON.parse(raw);if(!v||typeof v.active!=='string'||!v.drafts||Array.isArray(v.drafts)||typeof v.drafts!=='object')throw Error();return v;}
 catch{throw Error('工房の下書きを読み込めません。保存データは変更していません。');}
}
export function writeDrafts(storage,state){try{storage.setItem(DRAFTS_KEY,JSON.stringify(state));}catch{throw Error('下書きを保存できません。コードをコピーして保管してください。');}}
export async function loadWorkshopImage(file){
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('20MB以下のPNG・JPG・WebPを選んでください。');
 const url=URL.createObjectURL(file),image=new Image();
 try{image.src=url;await image.decode();const {width,height}=imageScale(image.naturalWidth,image.naturalHeight),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d',{willReadFrequently:true}).drawImage(image,0,0,width,height);const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('画像を変換できません。')),'image/png'));return {canvas,blob,name:file.name||'参照画像'};}
 finally{URL.revokeObjectURL(url)}
}
export function assetStore(){
 let opening;
 const db=()=>opening??=new Promise((resolve,reject)=>{const r=indexedDB.open('unfold-workshop-assets',1);r.onupgradeneeded=()=>r.result.createObjectStore('images');r.onsuccess=()=>resolve(r.result);r.onerror=()=>{opening=null;reject(r.error)}});
 async function run(mode,key,value){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('images',mode),s=tx.objectStore('images'),request=mode==='readonly'?s.get(key):s.put(value,key);let result;request.onsuccess=()=>result=request.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('画像を保存できません。'))})}
 return {get:key=>run('readonly',key),put:(key,value)=>run('readwrite',key,value)};
}
