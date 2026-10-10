import {assertProject,clone,StudioError} from './model.js';
import {blobHash,collectAssetRefs} from './assets.js';
const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
function storageError(e){return e?.name==='QuotaExceededError'?new StudioError('QUOTA_EXCEEDED'):e;}
export async function openStudioStore({dbName='unfold-studio-projects'}={}){
 if(!dbName.startsWith('unfold-studio'))throw new StudioError('INVALID_STORE_NAME');
 const opening=indexedDB.open(dbName,1);opening.onupgradeneeded=()=>{for(const name of ['projects','assets','drafts','leases'])opening.result.createObjectStore(name);};const db=await request(opening);
 db.onversionchange=()=>db.close();
 async function transaction(names,mode,fn){const tx=db.transaction(names,mode);const done=new Promise((ok,no)=>{tx.oncomplete=ok;tx.onabort=tx.onerror=()=>no(tx.error||new StudioError('STORAGE_ABORTED'));});done.catch(()=>{});
  try{const result=await fn(tx);await done;return result;}catch(e){try{tx.abort();}catch{}await done.catch(()=>{});throw storageError(e);}}
 const store={
 async putAsset(blob,meta){if(!(blob instanceof Blob)||!meta.projectId||!meta.id)throw new StudioError('INVALID_ASSET');const asset={...clone(meta),byteLength:blob.size,hash:await blobHash(blob)};
 return transaction(['assets'],'readwrite',async tx=>{const table=tx.objectStore('assets'),existing=await request(table.get(asset.id));if(existing){if(existing.meta.hash!==asset.hash||existing.meta.projectId!==asset.projectId)throw new StudioError('ASSET_CONFLICT');return existing.meta;}await request(table.put({meta:asset,blob},asset.id));return asset;});},
 async get(id){const record=await transaction(['assets'],'readonly',tx=>request(tx.objectStore('assets').get(id)));if(!record)throw new StudioError('MISSING_ASSET',[{code:'MISSING_ASSET',targetId:id}]);return record.blob;},
 listProjects(){return transaction(['projects'],'readonly',tx=>request(tx.objectStore('projects').getAll()));},
 load(id){return transaction(['projects'],'readonly',async tx=>(await request(tx.objectStore('projects').get(id)))||null);},
 async save(project,{expectedRevision,fence}){assertProject(project);return transaction(['projects','assets','leases'],'readwrite',async tx=>{
  const table=tx.objectStore('projects'),prior=await request(table.get(project.id));if((prior?.revision||0)!==expectedRevision)throw new StudioError('REVISION_CONFLICT');const lease=await request(tx.objectStore('leases').get(project.id));if(!lease||lease.fence!==fence||lease.expiresAt<=Date.now())throw new StudioError('STALE_WRITER');
  for(const id of collectAssetRefs(project)){const record=await request(tx.objectStore('assets').get(id));if(!record||record.meta.projectId!==project.id||record.meta.hash!==project.assets[id]?.hash)throw new StudioError('MISSING_ASSET',[{code:'MISSING_ASSET',targetId:id}]);}
  const saved={...clone(project),revision:expectedRevision+1};await request(table.put(saved,project.id));return saved;
 });},
 protect(ownerId,ids){return transaction(['drafts'],'readwrite',tx=>request(tx.objectStore('drafts').put([...ids],ownerId)));},
 releaseProtection(ownerId){return transaction(['drafts'],'readwrite',tx=>request(tx.objectStore('drafts').delete(ownerId)));},
 gc({protectedIds=new Set()}={}){return transaction(['projects','assets','drafts'],'readwrite',async tx=>{const keep=new Set(protectedIds);for(const p of await request(tx.objectStore('projects').getAll()))for(const id of collectAssetRefs(p))keep.add(id);for(const ids of await request(tx.objectStore('drafts').getAll()))for(const id of ids)keep.add(id);const table=tx.objectStore('assets'),deletedIds=[];for(const key of await request(table.getAllKeys()))if(!keep.has(key)){await request(table.delete(key));deletedIds.push(key);}return {deletedIds};});},
 readLease(id){return transaction(['leases'],'readonly',tx=>request(tx.objectStore('leases').get(id)));},
 updateLease(id,update){return transaction(['leases'],'readwrite',async tx=>{const table=tx.objectStore('leases'),previous=await request(table.get(id)),next=update(previous);if(next!==undefined)await request(table.put(next,id));return next??previous;});},
 close(){db.close();}
 };
 return store;
}
