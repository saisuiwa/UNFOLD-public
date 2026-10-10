import assert from 'node:assert/strict';
import {withStudioPage} from './browser-helper.mjs';
/**
 * Taking the edit right back from another tab must never leave an editor that cannot save (stale revision)
 * and must never silently overwrite either side's work.
 */
await withStudioPage(async page=>{
 await page.evaluate(()=>{window.make=async db=>{const {openStudioStore}=await import('/studio/store.js'),{createController}=await import('/studio/controller.js');const store=await openStudioStore({dbName:db}),c=createController({store});await c.ready;return {c,store};};});

 // 1) The other tab saved a newer revision while this one was a reader: takeover adopts it, and saving then works.
 const adopted=await page.evaluate(async db=>{
  const A=await make(db);await A.c.addText();await A.c.saveBrowser();
  const B=await make(db),wasReadOnly=B.c.get().readOnly;
  await A.c.addText();await A.c.saveBrowser(); // revision 2 exists only in the store
  await B.c.takeOver();
  const clipsAfterTakeover=B.c.get().project.clips.length;
  let saveError=null;try{await B.c.addText();await B.c.saveBrowser();}catch(e){saveError=e.code||e.message;}
  const out={wasReadOnly,clipsAfterTakeover,saveError,stored:(await A.store.load(B.c.get().project.id)).clips.length,readOnly:B.c.get().readOnly,status:B.c.get().saveStatus};
  await A.c.dispose();await B.c.dispose();return out;
 },'unfold-studio-takeover-clean');
 assert.equal(adopted.wasReadOnly,true);
 assert.equal(adopted.clipsAfterTakeover,2,'takeover must load the newest saved revision, not keep the stale in-memory project');
 assert.equal(adopted.saveError,null,'saving right after takeover must not hit REVISION_CONFLICT');
 assert.equal(adopted.stored,3);assert.equal(adopted.readOnly,false);assert.equal(adopted.status,'保存済み');

 // 2) Unsaved local edits AND a newer saved revision: refuse to overwrite silently; an explicit reload discards the local edits.
 const diverged=await page.evaluate(async db=>{
  const C=await make(db);await C.c.saveBrowser();
  const D=await make(db);
  await C.c.dispatch({type:'setProjectName',name:'C-local'});            // unsaved edit
  await D.c.takeOver();                                                  // C loses its lease
  for(let i=0;i<100&&!C.c.get().readOnly;i++)await new Promise(r=>setTimeout(r,10));
  await D.c.dispatch({type:'setProjectName',name:'D-saved'});await D.c.saveBrowser();
  let code=null;try{await C.c.takeOver();}catch(e){code=e.code;}
  const kept={name:C.c.get().project.name,readOnly:C.c.get().readOnly};
  // The refusal tells the user to export the local edits to a file: that must work while read-only.
  const parts=[];window.showSaveFilePicker=async()=>({createWritable:async()=>({write:async b=>parts.push(b),close:async()=>{},abort:async()=>{}})});
  let fileError=null;try{await C.c.saveFile({chooseNew:true});}catch(e){fileError=e.code||e.message;}
  const exported={fileError,bytes:await new Blob(parts).size,stillReadOnly:C.c.get().readOnly,name:C.c.get().project.name,storedName:(await C.store.load(C.c.get().project.id)).name};
  await C.c.reloadLatest();
  const after={name:C.c.get().project.name,readOnly:C.c.get().readOnly};
  let saveError=null;try{await C.c.addText();await C.c.saveBrowser();}catch(e){saveError=e.code||e.message;}
  const out={code,kept,exported,after,saveError,stored:(await C.store.load(C.c.get().project.id)).name};
  await C.c.dispose();await D.c.dispose();return out;
 },'unfold-studio-takeover-diverged');
 assert.equal(diverged.code,'LOCAL_CHANGES_OUTDATED');
 assert.deepEqual(diverged.kept,{name:'C-local',readOnly:true},'the unsaved local edit must be retained when takeover is refused');
 assert.equal(diverged.exported.fileError,null,'exporting the local edits to a file must work while read-only');
 assert.ok(diverged.exported.bytes>0);assert.equal(diverged.exported.stillReadOnly,true);
 assert.equal(diverged.exported.name,'C-local');assert.equal(diverged.exported.storedName,'D-saved','a read-only export must not write the browser copy');
 assert.deepEqual(diverged.after,{name:'D-saved',readOnly:false});
 assert.equal(diverged.saveError,null);assert.equal(diverged.stored,'D-saved');

 // 3) A lease that lapsed without anyone else taking it must not block the next save.
 const lapsed=await page.evaluate(async db=>{
  const E=await make(db);await E.c.addText();await E.c.saveBrowser();const id=E.c.get().project.id;
  await E.store.updateLease(id,x=>({...x,expiresAt:Date.now()-1}));
  await E.c.addText();let err=null;try{await E.c.saveBrowser();}catch(e){err=e.code||e.message;}
  const out={err,readOnly:E.c.get().readOnly,status:E.c.get().saveStatus,stored:(await E.store.load(id)).clips.length};
  await E.c.dispose();return out;
 },'unfold-studio-lapsed-save');
 assert.deepEqual(lapsed,{err:null,readOnly:false,status:'保存済み',stored:2});
 console.log('PASS takeover adopts the newest revision; diverged local edits are retained until reloadLatest; lapsed lease saves');
});
