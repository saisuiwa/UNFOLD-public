import assert from 'node:assert/strict';
import {withStudioPage} from './browser-helper.mjs';
/** An edit made within the 1 s autosave debounce must survive closing/reloading the tab, without saving untouched projects. */
await withStudioPage(async page=>{
 const closed=await page.evaluate(async()=>{
  const {openStudioStore}=await import('/studio/store.js'),{createController}=await import('/studio/controller.js'),db='unfold-studio-flush-close';
  const store=await openStudioStore({dbName:db}),c=createController({store});await c.ready;
  await c.addText();await c.saveBrowser();const id=c.get().project.id,savedFlag=c.get().unsaved;
  await c.addText();const pending={status:c.get().saveStatus,unsaved:c.get().unsaved};   // autosave timer still pending
  await c.dispose();                                                                      // what pagehide does
  const reopened=await openStudioStore({dbName:db}),saved=await reopened.load(id);reopened.close();
  return {savedFlag,pending,clips:saved.clips.length};
 });
 assert.equal(closed.savedFlag,false);
 assert.deepEqual(closed.pending,{status:'未保存',unsaved:true});
 assert.equal(closed.clips,2,'the edit made inside the autosave debounce must be saved when the page is disposed');

 const flushed=await page.evaluate(async()=>{
  const {openStudioStore}=await import('/studio/store.js'),{createController}=await import('/studio/controller.js'),db='unfold-studio-flush-api';
  const store=await openStudioStore({dbName:db}),c=createController({store});await c.ready;
  await c.addText();await c.saveBrowser();const id=c.get().project.id;
  await c.addText();await c.flush();                                                      // visibilitychange -> hidden
  const out={status:c.get().saveStatus,unsaved:c.get().unsaved,clips:(await store.load(id)).clips.length};
  await c.dispose();return out;
 });
 assert.deepEqual(flushed,{status:'保存済み',unsaved:false,clips:2});

 // Opening and closing STUDIO without touching anything must not write a project.
 const untouched=await page.evaluate(async()=>{
  const {openStudioStore}=await import('/studio/store.js'),{createController}=await import('/studio/controller.js'),db='unfold-studio-flush-untouched';
  localStorage.removeItem('unfold-studio-current');
  const store=await openStudioStore({dbName:db}),c=createController({store});await c.ready;await c.dispose();
  const reopened=await openStudioStore({dbName:db}),list=await reopened.listProjects();reopened.close();return list.length;
 });
 assert.equal(untouched,0);
 // An explicit save settles the autosave armed by the edit: the same content must not be written (and revised) again.
 const settled=await page.evaluate(async()=>{
  const {openStudioStore}=await import('/studio/store.js'),{createController}=await import('/studio/controller.js');
  const store=await openStudioStore({dbName:'unfold-studio-flush-settled'}),c=createController({store});await c.ready;
  await c.addText();await c.saveBrowser();const afterSave=c.get().project.revision;
  await new Promise(r=>setTimeout(r,1500));
  const out={afterSave,later:c.get().project.revision,status:c.get().saveStatus};await c.dispose();return out;
 });
 assert.equal(settled.later,settled.afterSave,'no second save of identical content after an explicit save');
 assert.equal(settled.status,'保存済み');
 console.log('PASS pagehide/dispose and flush() save pending edits; untouched projects and already-saved edits are not written again');
});
