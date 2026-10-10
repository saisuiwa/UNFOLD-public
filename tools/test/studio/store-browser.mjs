import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async page=>{
 assert.equal(await page.evaluate(async()=>typeof (await import('/studio/store.js').catch(()=>({}))).openStudioStore),'function','Studio store must exist');
 const result=await page.evaluate(async()=>{
 const {openStudioStore}=await import('/studio/store.js');const {createProject}=await import('/studio/model.js');
 const req=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});
 const open=indexedDB.open('unfold-projects',1);open.onupgradeneeded=()=>open.result.createObjectStore('projects');const legacy=await req(open);await req(legacy.transaction('projects','readwrite').objectStore('projects').put({sentinel:'old artwork'},'current'));
 const store=await openStudioStore();for(const id of ['p','p2'])await store.updateLease(id,()=>({ownerId:'test',fence:1,expiresAt:Date.now()+60000}));const asset=await store.putAsset(new Blob(['image']),{id:'asset',projectId:'p',type:'image/png'});const undo=await store.putAsset(new Blob(['undo']),{id:'undo',projectId:'p',type:'image/png'});await store.putAsset(new Blob(['orphan']),{id:'orphan',projectId:'p',type:'image/png'});
 await store.protect('history:p',new Set([undo.id]));let p=createProject({id:'p',durationUs:30e6});p.assets[asset.id]=asset;p.audio=[{id:'a',role:'sfx',assetId:asset.id,startUs:0,endUs:1e6,sourceInUs:0,linkClipId:null,muted:false,gain:1,envelope:{originUs:0,points:[]}}];p=await store.save(p,{expectedRevision:0,fence:1});
 const other=await store.putAsset(new Blob(['other']),{id:'other',projectId:'p2',type:'image/png'});const p2=createProject({id:'p2'});p2.assets.other=other;p2.audio=[{...p.audio[0],assetId:'other'}];await store.save(p2,{expectedRevision:0,fence:1});
 const original=IDBObjectStore.prototype.put;let quotaSave,quotaAsset;
 try{IDBObjectStore.prototype.put=function(...args){if(this.name==='projects')throw new DOMException('Full','QuotaExceededError');return original.apply(this,args);};try{await store.save({...p,name:'lost'},{expectedRevision:1,fence:1});}catch(e){quotaSave=e.code;}
 IDBObjectStore.prototype.put=function(...args){if(this.name==='assets')throw new DOMException('Full','QuotaExceededError');return original.apply(this,args);};try{await store.putAsset(new Blob(['quota']),{id:'fail',projectId:'p',type:'image/png'});}catch(e){quotaAsset=e.code;}
 }finally{IDBObjectStore.prototype.put=original;}
 const saved=await store.load('p'),gc=await store.gc({protectedIds:new Set()});let missing;try{await store.get('absent');}catch(e){missing=e.code;}
 const sentinel=await req(legacy.transaction('projects').objectStore('projects').get('current'));legacy.close();store.close();window.testAsset=asset;
 return {quotaSave,quotaAsset,savedRevision:saved.revision,savedName:saved.name,deleted:gc.deletedIds,sentinel,missing};
 });
 assert.equal(result.quotaSave,'QUOTA_EXCEEDED');assert.equal(result.quotaAsset,'QUOTA_EXCEEDED');assert.equal(result.savedRevision,1);assert.equal(result.savedName,'新しいMV');assert.deepEqual(result.deleted,['orphan']);assert.deepEqual(result.sentinel,{sentinel:'old artwork'});assert.equal(result.missing,'MISSING_ASSET');
 await page.reload();assert.deepEqual(await page.evaluate(async()=>{const s=await (await import('/studio/store.js')).openStudioStore();try{return [(await s.get('undo')).size,(await s.load('p')).revision,(await s.get('other')).size];}finally{s.close();}}),[4,1,5]);
 console.log('PASS store: quota at asset/save, atomic manifest, saved+history+other-project GC, legacy sentinel, reload');
});
