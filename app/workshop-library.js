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
export async function savedWorkshopItems(){
 const methods=await store.list(),motions=createMotionLibrary().list();
 return [...methods.map(m=>({key:'saved:'+m.id,savedId:m.id,name:m.name,kind:m.code?'image':'glsl',source:m.code?.source||m.vertex,params:m.code?.params,status:m.status})),...motions.filter(m=>m.motion.code).map(m=>({key:'saved:'+m.id,savedId:m.id,name:m.name,kind:'text',motion:m.motion,source:m.motion.code.source,font:m.motion.font,color:m.motion.color,accent:m.motion.emphasisColor}))];
}
function methodOf(d){const name=d.name.trim();if(!name||name.length>20)throw Error('名前は1〜20文字で入力してください。');return {id:d.savedId||(d.kind==='image'?newImageMethodId():newCustomId()),name,symbol:d.kind==='image'?'◈':'◆',...(d.kind==='image'?{code:cleanImageCode({version:1,runtime:IMAGE_RUNTIME,source:d.source,params:d.params})}:{vertex:d.source}),status:'ok',reason:''};}
export async function addWorkshopItem(d){
 if(d.kind==='text'){approveCodeMotion(d.source);const library=createMotionLibrary(),item=d.savedId?library.update(d.savedId,{name:d.name,motion:motionOf(d)}):library.save({name:d.name,motion:motionOf(d)});return {kind:'text',id:item.id};}
 const item=methodOf(d),now=Date.now();let old=(await store.list()).find(m=>m.id===item.id),previousId;
 const definition=m=>JSON.stringify([String(m.vertex||''),m.code]);
 // Projects store method IDs. Never replace executable content behind an existing ID.
 if(old&&definition(old)!==definition(item)){previousId=old.id;item.id=item.code?newImageMethodId():newCustomId();old=null;}
 await store.put({...item,hash:await sourceHash(item.code?JSON.stringify(item.code):item.vertex),createdAt:old?.createdAt||now,updatedAt:now,look:null,params:[]});registerCustom(item);return {kind:d.kind,id:item.id,...(previousId?{previousId}:{})};
}
export function announceWorkshopItem(item){if(globalThis.BroadcastChannel){const c=new BroadcastChannel(WORKSHOP_CHANNEL);c.postMessage(item);c.close()}}
export function workshopFile(d){return d.kind==='text'?{text:buildMotionFile({name:d.name,motion:motionOf(d)}),extension:'.unfoldmotion'}:{text:buildMethodFile([methodOf(d)]),extension:'.unfoldmethod'};}
export function importedDrafts(text){
 let value;try{value=JSON.parse(text)}catch{throw Error('共有ファイルのJSONを読み込めません。')}
 if(value.format==='unfold-motion'){const item=parseMotionFile(text);if(!item.motion.code)throw Error('組み合わせ形式はモーション集の「組み合わせて作る」から読み込めます。');return [{name:item.name,kind:'text',motion:item.motion,source:item.motion.code.source,font:item.motion.font,color:item.motion.color,accent:item.motion.emphasisColor}];}
 const parsed=parseMethodFile(text);if(parsed.problems.length)throw Error(parsed.problems.join('\n'));return parsed.methods.map(m=>({name:m.name,kind:m.code?'image':'glsl',source:m.code?.source||m.vertex,params:m.code?.params}));
}
