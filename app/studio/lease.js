import {StudioError} from './model.js';
/** Notifications accelerate UI updates; the DB transaction is the write authority. */
export async function acquireLease(store,projectId,{ownerId=crypto.randomUUID(),takeover=false,onLost=()=>{}}={}){
 const current=await store.updateLease(projectId,old=>{const now=Date.now();if(old&&old.expiresAt>now&&old.ownerId!==ownerId&&!takeover)return old;return {ownerId,fence:(old?.fence||0)+1,expiresAt:now+15000};});
 const fence=current.fence;let mode=current.ownerId===ownerId?'writer':'reader',released=false,timer;
 const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('unfold-studio-lease:'+projectId):null;
 function lose(){if(mode==='writer'){mode='reader';clearInterval(timer);onLost();}}
 async function check(){const latest=await store.readLease(projectId);if(!latest||latest.ownerId!==ownerId||latest.fence!==fence||latest.expiresAt<=Date.now())lose();}
 const lease={fence,get mode(){return mode;},
 async renew(){if(released||mode!=='writer')return;const latest=await store.updateLease(projectId,old=>old?.ownerId===ownerId&&old.fence===fence&&old.expiresAt>Date.now()?{...old,expiresAt:Date.now()+15000}:old);if(latest?.ownerId!==ownerId||latest.fence!==fence||latest.expiresAt<=Date.now())lose();},
 async release(){if(released)return;released=true;clearInterval(timer);try{if(mode==='writer')await store.updateLease(projectId,old=>old?.ownerId===ownerId&&old.fence===fence?{...old,ownerId:null,expiresAt:0}:old);}finally{mode='reader';channel?.postMessage({changed:true});channel?.close();}}
 };
 if(channel)channel.onmessage=()=>check().catch(lose);
 if(mode==='writer'){timer=setInterval(()=>lease.renew().catch(lose),5000);channel?.postMessage({changed:true});}
 return lease;
}
