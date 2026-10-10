import assert from 'node:assert/strict';
import {withStudioPage} from './browser-helper.mjs';
/**
 * Reloading the SAME tab must not make the editor read-only because of its own leftover lease
 * (the old page's async release may never finish), while a DUPLICATED tab (sessionStorage copied)
 * must still be fenced out by the live original.
 */
const DB='unfold-studio-reload-regression';
const boot=async db=>{
 const {openStudioStore}=await import('/studio/store.js'),{createController}=await import('/studio/controller.js');
 const store=await openStudioStore({dbName:db}),c=createController({store});window.c=c;await c.ready;
 return {readOnly:c.get().readOnly,clips:c.get().project.clips.length,id:c.get().project.id};
};
await withStudioPage(async(page,{context,server})=>{
 const first=await page.evaluate(boot,DB);
 assert.equal(first.readOnly,false,'a fresh page must be the writer');
 await page.evaluate(async()=>{await c.addText();await c.saveBrowser();}); // note: never disposed, like a tab that is reloaded or killed
 await page.reload();
 const second=await page.evaluate(boot,DB);
 assert.equal(second.id,first.id,'the reload reopens the saved project');
 assert.equal(second.clips,1);
 assert.equal(second.readOnly,false,'same tab after reload must still be the writer (its own previous lease is not a competitor)');
 const saved=await page.evaluate(async()=>{await c.addText();await c.saveBrowser();return c.get().saveStatus;});
 assert.equal(saved,'保存済み');

 // Duplicated tab: sessionStorage is copied verbatim, the original page is alive.
 const entries=await page.evaluate(()=>Object.entries(sessionStorage));
 const dup=await context.newPage();await dup.goto(server.url+'/__tools/test/studio/host.html');
 await dup.evaluate(e=>{for(const [k,v] of e)sessionStorage.setItem(k,v);},entries);
 const copy=await dup.evaluate(boot,DB);
 assert.equal(copy.id,first.id);
 assert.equal(copy.readOnly,true,'a duplicated tab must not become a second writer while the original is alive');
 const original=await page.evaluate(async()=>{await c.addText();await c.saveBrowser();return {readOnly:c.get().readOnly,status:c.get().saveStatus};});
 assert.deepEqual(original,{readOnly:false,status:'保存済み'});
 await page.evaluate(()=>c.dispose());await dup.evaluate(()=>c.dispose());
 console.log('PASS reload keeps the writer lease; duplicated tab is fenced out by the live original');
});
