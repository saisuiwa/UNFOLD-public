import {settingsOf,workshopField} from './workshop-settings.js';
import {WORKSHOP_EXAMPLES} from './workshop-examples.js';
export {WORKSHOP_EXAMPLES};
import {openStore,sourceHash} from './method-library.js';
import {newCustomId,registerCustom} from './method-registry.js';
import {IMAGE_RUNTIME,newImageMethodId,cleanImageCode} from './image-method-format.js';
import {createMotionLibrary,parseMotionFile,buildMotionFile} from './lyric-library.js';
import {approveCodeMotion} from './code-motion-format.js';
import {cleanMotion} from './lyric-motion.js?v=26';
import {buildMethodFile,parseMethodFile} from './method-file.js';
export const WORKSHOP_CHANNEL='unfold-workshop-library-v1';
const store=openStore();
export const motionOf=d=>cleanMotion({...d.motion,code:{version:1,source:d.source},font:d.font||'gothic',color:d.color,emphasisColor:d.accent});
export async function savedWorkshopItems({existingOnly=false}={}){
 const exists=!existingOnly||globalThis.indexedDB?.databases&&(await indexedDB.databases()).some(d=>d.name==='unfold-method-library');
 const methods=exists?await store.list():[],motions=createMotionLibrary().list();
 return [...methods.map(m=>({key:'saved:'+m.id,savedId:m.id,name:m.name,kind:m.code?'image':'glsl',source:m.code?.source||m.vertex,params:m.code?.params,...m.workshop,status:m.status})),...motions.filter(m=>m.motion.code).map(m=>({key:'saved:'+m.id,savedId:m.id,name:m.name,kind:'text',motion:m.motion,source:m.motion.code.source,font:m.motion.font,color:m.motion.color,accent:m.motion.emphasisColor,...m.workshop}))];
}
function methodOf(d){const name=d.name.trim();if(!name||name.length>20)throw Error('名前は1〜20文字で入力してください。');return {id:d.savedId||(d.kind==='image'?newImageMethodId():newCustomId()),name,symbol:d.kind==='image'?'◈':'◆',...workshopField(settingsOf(d)),...(d.kind==='image'?{code:cleanImageCode({version:1,runtime:IMAGE_RUNTIME,source:d.source,params:d.params})}:{vertex:d.source}),status:'ok',reason:''};}
export async function addWorkshopItem(d){
 if(d.kind==='text'){approveCodeMotion(d.source);const library=createMotionLibrary(),item=d.savedId?library.update(d.savedId,{name:d.name,motion:motionOf(d),workshop:settingsOf(d)}):library.save({name:d.name,motion:motionOf(d),workshop:settingsOf(d)});return {kind:'text',id:item.id};}
 const item=methodOf(d),now=Date.now(),items=await store.list();
 const duplicate=!d.savedId&&items.find(m=>m.status==='ok'&&m.name===item.name&&JSON.stringify([m.vertex||'',m.code,m.workshop])===JSON.stringify([item.vertex||'',item.code,item.workshop]));
 if(duplicate)return {kind:d.kind,id:duplicate.id};
 let old=items.find(m=>m.id===item.id),previousId;
 const definition=m=>JSON.stringify([String(m.vertex||''),m.code]);
 // Projects store method IDs. Never replace executable content behind an existing ID.
 if(old&&definition(old)!==definition(item)){previousId=old.id;item.id=item.code?newImageMethodId():newCustomId();old=null;}
 await store.put({...item,hash:await sourceHash(item.code?JSON.stringify(item.code):item.vertex),createdAt:old?.createdAt||now,updatedAt:now,look:null,params:[]});registerCustom(item);return {kind:d.kind,id:item.id,...(previousId?{previousId}:{})};
}
export function announceWorkshopItem(item){if(globalThis.BroadcastChannel){const c=new BroadcastChannel(WORKSHOP_CHANNEL);c.postMessage(item);c.close()}}
export function workshopFile(d){return d.kind==='text'?{text:buildMotionFile({name:d.name,motion:motionOf(d),workshop:settingsOf(d)}),extension:'.unfoldmotion'}:{text:buildMethodFile([methodOf(d)]),extension:'.unfoldmethod'};}
const normalized=source=>source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
export function importedDrafts(text,{fileName='',kind}={}){
 if(typeof text!=='string'||text.length>600000)throw Error('読み込み用のファイルが大きすぎます。');
 if(/\.js$/i.test(fileName)){
  const source=normalized(text),known=WORKSHOP_EXAMPLES.find(d=>normalized(d.source)===source||d.originalSources?.some(s=>normalized(s)===source));
  if(known){const d=structuredClone(known);delete d.key;delete d.originalSources;return [d];}
  if(!source||source.length>32000)throw Error('JavaScriptは1〜32000文字で指定してください。');
  try{new Function('api',source);}catch{throw Error('JavaScriptの構文を確認してください。HTMLやコードを囲む ``` は入れず、関数の本体だけを選んでください。');}
  if(!['image','text'].includes(kind)){const error=Error('このJavaScriptを画像と文字のどちらに使うか選んでください。');error.code='JS_KIND_REQUIRED';throw error;}
  return [{name:(fileName.replace(/\.js$/i,'').trim()||'取り込んだ動き').slice(0,kind==='text'?40:20),kind,source}];
 }
 let value;try{value=JSON.parse(text)}catch{throw Error('共有ファイルのJSONを読み込めません。JavaScriptは .js ファイルを選んでください。')}
 if(value?.format==='unfold-motion'){const item=parseMotionFile(text);if(!item.motion.code)throw Error('組み合わせ形式はモーション集の「組み合わせて作る」から読み込めます。');const known=WORKSHOP_EXAMPLES.find(d=>d.originalSources?.some(s=>normalized(s)===normalized(item.motion.code.source)));const motion=known?{...item.motion,code:{version:1,source:known.source}}:item.motion;return [{name:item.name,kind:'text',motion,source:motion.code.source,font:motion.font,color:motion.color,accent:motion.emphasisColor,...item.workshop}];}
 if(value?.format!=='unfold-method')throw Error('これは作例の共有ファイルではありません。manifest.json等の検証記録ではなく、effects内の .js または .unfoldmethod / .unfoldmotion を選んでください。');
 const parsed=parseMethodFile(text);if(parsed.problems.length)throw Error(parsed.problems.join('\n'));return parsed.methods.map(m=>({name:m.name,kind:m.code?'image':'glsl',source:m.code?.source||m.vertex,params:m.code?.params,...m.workshop}));
}
