import assert from 'node:assert/strict';
import {withStudioPage} from './browser-helper.mjs';
/**
 * A saved project that cannot be opened (invalid record, or its first frame cannot be rendered) must never
 * lock STUDIO out: the page opens, says why, and the stored project is not deleted.
 */
await withStudioPage(async page=>{
 const result=await page.evaluate(async()=>{
  const {openStudioStore}=await import('/studio/store.js'),{createController}=await import('/studio/controller.js'),{mixedProject}=await import('/__tools/test/studio/fixtures.mjs');
  const put=(db,project)=>new Promise((ok,no)=>{const open=indexedDB.open(db,1);open.onsuccess=()=>{const tx=open.result.transaction('projects','readwrite');tx.objectStore('projects').put(project,project.id);tx.oncomplete=()=>{open.result.close();ok();};tx.onerror=()=>no(tx.error);};open.onerror=()=>no(open.error);});
  const boot=async db=>{const store=await openStudioStore({dbName:db}),c=createController({store});let readyError=null;try{await c.ready;}catch(e){readyError=e.code||e.message;}return {store,c,readyError};};
  const out={};

  // (a) a record that fails validation (anchor loop saved by an older build)
  {const db='unfold-studio-startup-cycle',first=await openStudioStore({dbName:db});first.close();
   const p=mixedProject();p.id='poisoned-cycle';for(const a of Object.values(p.assets))a.projectId=p.id;p.revision=1;
   p.views.wide.layout.cImage.anchor={clipId:'cVideo'};p.views.wide.layout.cVideo.anchor={clipId:'cImage'};
   await put(db,p);localStorage.setItem('unfold-studio-current',p.id);
   const {c,store,readyError}=await boot(db);
   const message=c.get().message;                                   // an edit clears the notice, so read it first
   let edit=null;try{if(!readyError){await c.addText();}}catch(e){edit=e.code||e.message;}
   out.cycle={readyError,fresh:c.get().project.id!==p.id,readOnly:c.get().readOnly,message,key:localStorage.getItem('unfold-studio-current'),edit,stillStored:!!await store.load(p.id)};
   await c.dispose();}

  // (b) a valid record whose first frame cannot be rendered (asset bytes are gone)
  {const db='unfold-studio-startup-missing',first=await openStudioStore({dbName:db});first.close();
   const p=mixedProject();p.id='missing-bytes';for(const a of Object.values(p.assets))a.projectId=p.id;p.revision=1;
   await put(db,p);localStorage.setItem('unfold-studio-current',p.id);
   const {c,store,readyError}=await boot(db);
   out.missing={readyError,id:c.get().project.id,readOnly:c.get().readOnly,message:c.get().message,stillStored:!!await store.load(p.id)};
   await c.dispose();}
  return out;
 });
 assert.equal(result.cycle.readyError,null,'an invalid saved project must not make STUDIO unopenable');
 assert.equal(result.cycle.fresh,true);assert.equal(result.cycle.readOnly,false);
 assert.match(result.cycle.message,/開けませんでした/);
 assert.equal(result.cycle.key,null,'the broken project must not be reopened on every start');
 assert.equal(result.cycle.edit,null);assert.equal(result.cycle.stillStored,true,'the stored project is never deleted');
 assert.equal(result.missing.readyError,null,'a first-frame render failure must not make STUDIO unopenable');
 assert.equal(result.missing.id,'missing-bytes');assert.equal(result.missing.readOnly,false);
 assert.match(result.missing.message,/描画できません/);assert.equal(result.missing.stillStored,true);
 console.log('PASS startup recovery: invalid saved project falls back to a new one; render failure keeps the project open; nothing deleted');
});
