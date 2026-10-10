/**
 * One editor id per browser tab. sessionStorage survives a reload of the same tab, so a reloaded page
 * recognises its own leftover lease instead of treating it as another editor. A duplicated tab copies
 * sessionStorage verbatim; a ping on a BroadcastChannel tells whether a live page already uses the id,
 * and the copy then takes a fresh one.
 */
const KEY='unfold-studio-owner-id',CHANNEL='unfold-studio-owner';
export async function claimOwnerId({storage=globalThis.sessionStorage,wait=120,make=()=>crypto.randomUUID()}={}){
 let id=null;try{id=storage?.getItem(KEY)||null;}catch{}
 const channel=typeof BroadcastChannel==='function'?new BroadcastChannel(CHANNEL):null;
 if(id&&channel){
  const alive=await new Promise(done=>{const timer=setTimeout(()=>done(false),wait);channel.onmessage=e=>{if(e.data?.pong===id){clearTimeout(timer);done(true);}};channel.postMessage({ping:id});});
  if(alive)id=null;
 }
 if(!id){id=make();try{storage?.setItem(KEY,id);}catch{}}
 if(channel)channel.onmessage=e=>{if(e.data?.ping===id)channel.postMessage({pong:id});};
 return {id,close(){channel?.close();}};
}
