import {openStore} from './method-library.js';
import {getCustom,listCustom,newCustomId,registerCustom} from './method-registry.js';
import {newImageMethodId} from './image-method-format.js';
import {createMotionLibrary} from './lyric-library.js';
import {isCodeMotionApproved} from './code-motion-format.js';
import {WORKSHOP_CHANNEL} from './workshop-library.js';
// Existing project blocks and Undo keep their original definition when an edited library ID collides.
function activateMethod(method){
 const definition=m=>JSON.stringify([String(m.vertex||''),m.code]);
 const old=getCustom(method.id);
 if(old&&definition(old)!==definition(method)){
  const reusable=listCustom().find(m=>m.status==='ok'&&definition(m)===definition(method));
  if(reusable)return {...method,id:reusable.id};
  method={...method,id:method.code?newImageMethodId():newCustomId()};
 }
 registerCustom(method);return method;
}
// A notification never executes code or changes a project. Apply is an explicit action.
export function attachWorkshopLink({apply,beforeApply=()=>null,notify=()=>{}}){
 let panel;
 function offer(receipt){
  if(!receipt||!['glsl','image','text'].includes(receipt.kind)||typeof receipt.id!=='string'||receipt.id.length>100)return;
  panel?.remove();panel=document.createElement('aside');panel.id='workshop-invitation';panel.setAttribute('aria-label','工房から追加');Object.assign(panel.style,{position:'fixed',left:'12px',bottom:'12px',zIndex:'1000',maxWidth:'min(540px,calc(100vw - 24px))',display:'flex',flexWrap:'wrap',gap:'10px',alignItems:'center',padding:'14px',border:'1px solid #d9f878',borderRadius:'12px',background:'#172622',color:'#edf4e5',font:'13px/1.6 system-ui',boxShadow:'0 8px 30px #0008'});
  const invitation=panel;
  const label=document.createElement('span');label.textContent=receipt.kind==='text'?'工房の文字モーション。適用する歌詞を選んでください。':'工房のメソッド。シーケンスでは適用する◆を選んでください。';
  const button=document.createElement('button');button.id='workshop-apply';button.textContent='このブロックに使う';Object.assign(button.style,{padding:'8px 12px',background:'#d9f878',color:'#17211b',border:0,borderRadius:'7px',cursor:'pointer'});
  const close=document.createElement('button');close.textContent='閉じる';close.onclick=()=>invitation.remove();
  button.onclick=async()=>{button.disabled=true;try{
   const target=beforeApply(receipt);
   let item;if(receipt.kind==='text'){const motion=createMotionLibrary().list().find(m=>m.id===receipt.id);if(!motion||!isCodeMotionApproved(motion.motion.code?.source))throw Error('工房でプレビューしてから追加してください。');item={...receipt,...motion};}
   else{const method=(await openStore().list()).find(m=>m.id===receipt.id);if(!method||method.status!=='ok')throw Error('工房でプレビューしてから追加してください。');item={...receipt,...method};}
   await apply(item,target,()=>item.kind==='text'?item:activateMethod(item));invitation.remove();const url=new URL(location.href);url.searchParams.delete('workshopMethod');url.searchParams.delete('workshopMotion');history.replaceState(history.state,'',url);notify('工房の動きを適用しました。');
  }catch(e){notify(e.message);label.textContent=e.message;}finally{button.disabled=false}};
  panel.append(label,button,close);document.body.append(panel);
 }
 const params=new URLSearchParams(location.search),method=params.get('workshopMethod'),motion=params.get('workshopMotion');if(method)offer({kind:method.startsWith('im-')?'image':'glsl',id:method});else if(motion)offer({kind:'text',id:motion});
 const channel=globalThis.BroadcastChannel?new BroadcastChannel(WORKSHOP_CHANNEL):null;if(channel)channel.onmessage=e=>offer(e.data);
 addEventListener('pagehide',()=>channel?.close(),{once:true});return {offer};
}
