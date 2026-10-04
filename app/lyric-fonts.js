import {FONTS,ensureFont} from './mask-shape.js?v=5';
const faces=new Map(),pending=new Map(),labels=new Map();
const META='unfold-lyric-font-labels-v1';
export function isLyricFontKey(key){
 if(typeof key!=='string')return false;if(Object.hasOwn(FONTS,key))return true;
 if(/^file:[a-f0-9]{64}$/.test(key))return true;
 if(!key.startsWith('local:')||key.length>500)return false;
 try{const name=decodeURIComponent(key.slice(6));return name.length>0&&name.length<=180&&!/[\u0000-\u001f\u007f]/.test(name)&&encodeURIComponent(name)===key.slice(6)}catch{return false}
}
export function localFontKey(postscriptName){const key='local:'+encodeURIComponent(postscriptName);if(!isLyricFontKey(key))throw Error('このフォント名は使えません。');return key;}
function storedLabels(){try{return JSON.parse(globalThis.localStorage?.getItem(META)||'{}')}catch{return {}}}
export function lyricFontLabel(key){return FONTS[key]?.label||labels.get(key)||storedLabels()[key]||(key?.startsWith('local:')?decodeURIComponent(key.slice(6)):'読み込んだフォント');}
export function savedLyricFonts(){return Object.entries(storedLabels()).filter(([key])=>isLyricFontKey(key)).map(([key,label])=>({key,label}));}
function remember(key,label){labels.set(key,label);try{globalThis.localStorage.setItem(META,JSON.stringify({...storedLabels(),[key]:label}))}catch{}}
function alias(key){return 'UnfoldFont_'+[...key].map(c=>c.charCodeAt(0).toString(16)).join('');}
export function lyricFontCSS(key,size){const f=FONTS[key]||(!isLyricFontKey(key)?FONTS.gothic:null);return f?`${f.weight} ${size}px ${f.family}`:`400 ${size}px "${alias(key)}",sans-serif`;}
async function fontStore(mode,key,value){
 if(!globalThis.indexedDB)throw Error('フォントの保存場所を開けません。');
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('unfold-local-fonts',1);r.onupgradeneeded=()=>r.result.createObjectStore('fonts');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 return new Promise((resolve,reject)=>{const tx=db.transaction('fonts',mode),store=tx.objectStore('fonts');let result;const req=mode==='readwrite'?store.put(value,key):store.get(key);req.onsuccess=()=>result=req.result;tx.oncomplete=()=>{db.close();resolve(result)};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||Error('フォントを保存できませんでした。'))}});
}
export async function prepareLyricFont(key,text='あいうえおABC'){
 if(!isLyricFontKey(key)||Object.hasOwn(FONTS,key)){await ensureFont(lyricFontCSS(key,64),text);return}
 if(faces.has(key))return;
 if(pending.has(key))return pending.get(key);
 const task=(async()=>{try{
  let source;if(key.startsWith('local:'))source=`local(${JSON.stringify(decodeURIComponent(key.slice(6)))})`;else{const record=await fontStore('readonly',key);if(!record?.blob)throw Error('フォントファイルが見つかりません。「フォントファイル」で同じファイルを読み込んでください。');source=await record.blob.arrayBuffer();remember(key,record.label)}
  const face=await new FontFace(alias(key),source).load();document.fonts.add(face);faces.set(key,face);
 }catch(e){throw Error(key.startsWith('local:')?'PCフォント「'+lyricFontLabel(key)+'」を開けません。「PCのフォント」から選び直すか、ファイルを読み込んでください。':e.message)}finally{pending.delete(key)}})();pending.set(key,task);return task;
}
export async function listLocalLyricFonts(){
 if(typeof globalThis.queryLocalFonts!=='function')throw Error('PCフォント一覧はChrome/EdgeのPC版で使えます。下のフォントファイル読込も使えます。');
 try{return (await globalThis.queryLocalFonts()).map(f=>({key:localFontKey(f.postscriptName),label:f.fullName||f.postscriptName})).sort((a,b)=>a.label.localeCompare(b.label,'ja'))}catch(e){throw Error(e.name==='NotAllowedError'?'PCフォントの参照が許可されませんでした。ファイルから読み込む方法も使えます。':e.message)}
}
export async function selectLocalLyricFont(item){await prepareLyricFont(item.key);remember(item.key,item.label);return item.key;}
export async function importLyricFont(file){
 if(!file||!file.size||file.size>32*1024*1024||!(/\.(ttf|otf|woff2?)$/i.test(file.name)))throw Error('32MB以内の TTF・OTF・WOFF・WOFF2 を選んでください。');
 const bytes=await file.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes),key='file:'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 const face=await new FontFace(alias(key),bytes).load();
 await fontStore('readwrite',key,{blob:file,label:file.name});document.fonts.add(face);faces.set(key,face);remember(key,file.name);return key;
}
