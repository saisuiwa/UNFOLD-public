import assert from 'node:assert/strict';
import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async page=>{
 const result=await page.evaluate(async()=>{
  const {openStudioStore}=await import('/studio/store.js'),{acquireLease}=await import('/studio/lease.js'),{createController}=await import('/studio/controller.js'),{createProject}=await import('/studio/model.js'),{writeStudioFile}=await import('/studio/file.js');
  const store=await openStudioStore({dbName:'unfold-studio-dirty-lease-regression'}),c=createController({store});await c.ready;await c.saveBrowser();const oldId=c.get().project.id;
  const other=createProject(),l=await acquireLease(store,other.id);await store.save(other,{expectedRevision:0,fence:l.fence});await l.release();
  const chunks=[];await writeStudioFile(other,{get:async()=>null},{write:async b=>chunks.push(b),close:async()=>{},abort:async()=>{}});
  await c.dispatch({type:'setProjectName',name:'未保存の大切な編集'});const takeover=await acquireLease(store,oldId,{takeover:true});for(let i=0;i<50&&!c.get().readOnly;i++)await new Promise(r=>setTimeout(r,10));
  const checks=[];for(const action of [()=>c.newProject(),()=>c.openSaved(other.id),()=>c.openFile(new Blob(chunks))]){let error;try{await action();}catch(e){error=e.message;}checks.push({error,retained:c.get().project.id===oldId&&c.get().project.name==='未保存の大切な編集'&&c.get().history.canUndo});}
  await takeover.release();await c.takeOver();await c.saveBrowser();const saved=await store.load(oldId);await c.newProject();const switched=c.get().project.id!==oldId;await c.dispose();return {checks,savedName:saved.name,switched};
 });for(const c of result.checks){assert.ok(c.error);assert.equal(c.retained,true);}assert.equal(result.savedName,'未保存の大切な編集');assert.equal(result.switched,true);console.log('PASS dirty lost-lease project is retained for all three switches; takeover+save restores switching');
});
