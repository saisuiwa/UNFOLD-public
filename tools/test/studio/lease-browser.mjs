import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async(a,{context,server})=>{
 assert.equal(await a.evaluate(async()=>typeof (await import('/studio/lease.js').catch(()=>({}))).acquireLease),'function');
 const b=await context.newPage();await b.goto(server.url+'/__tools/test/studio/host.html');
 const setup=async(page,owner)=>page.evaluate(async owner=>{const {openStudioStore}=await import('/studio/store.js');const {acquireLease}=await import('/studio/lease.js');window.store=await openStudioStore();window.lease=await acquireLease(store,'p',{ownerId:owner,takeover:false,onLost:()=>window.lost=true});return {mode:lease.mode,fence:lease.fence};},owner);
 const aa=await setup(a,'A'),bb=await setup(b,'B');assert.equal(aa.mode,'writer');assert.equal(bb.mode,'reader');
 await a.evaluate(async()=>{const {createProject}=await import('/studio/model.js');window.p=await store.save(createProject({id:'p'}),{fence:lease.fence,expectedRevision:0});const {createHistory}=await import('/studio/history.js');window.h=createHistory(p);h.execute({type:'setLock',track:'lyrics',locked:false});h.undo();window.delayed=()=>store.save({...h.get(),name:'A stale'},{fence:lease.fence,expectedRevision:1});});
 const takeover=await b.evaluate(async()=>{await lease.release();lease=await (await import('/studio/lease.js')).acquireLease(store,'p',{ownerId:'B',takeover:true});return {fence:lease.fence,mode:lease.mode};});assert.ok(takeover.fence>aa.fence);
 assert.equal(await a.evaluate(async()=>{try{await delayed();return 'saved';}catch(e){return e.code;}}),'STALE_WRITER');
 await b.evaluate(async()=>{const p=await store.load('p');window.saved=await store.save({...p,name:'B'},{expectedRevision:1,fence:lease.fence});});
 assert.equal(await b.evaluate(async()=>{try{await store.save(saved,{expectedRevision:1,fence:lease.fence});return 'saved';}catch(e){return e.code;}}),'REVISION_CONFLICT');
 assert.equal(await a.evaluate(async()=>(await store.load('p')).name),'B');
 await a.evaluate(async()=>{await lease.renew();});assert.equal(await a.evaluate(()=>lease.mode),'reader');
 await b.evaluate(async()=>{await lease.release();store.close();});const next=await a.evaluate(async()=>{await lease.release();lease=await (await import('/studio/lease.js')).acquireLease(store,'p',{ownerId:'A',takeover:false});const out={mode:lease.mode,fence:lease.fence};await lease.release();store.close();return out;});assert.equal(next.mode,'writer');assert.ok(next.fence>takeover.fence);
 const expired=await b.evaluate(async()=>{store=await (await import('/studio/store.js')).openStudioStore();const {acquireLease}=await import('/studio/lease.js');const old=await acquireLease(store,'expired',{ownerId:'old'});await store.updateLease('expired',x=>({...x,expiresAt:Date.now()-1}));const next=await acquireLease(store,'expired',{ownerId:'new'});await old.renew();const result=[old.mode,next.mode,next.fence>old.fence];await old.release();await next.release();
  // A lapsed lease that nobody else took is revived by its own renewal (sleep / throttled timers); only another owner's record demotes the writer.
  const kept=await acquireLease(store,'lapsed',{ownerId:'kept'});await store.updateLease('lapsed',x=>({...x,expiresAt:Date.now()-1}));await kept.renew();const revived=[kept.mode,(await store.readLease('lapsed')).expiresAt>Date.now()];await kept.release();store.close();return {result,revived};});assert.deepEqual(expired.result,['reader','writer',true]);assert.deepEqual(expired.revived,['writer',true]);
 console.log('PASS lease: readonly second tab, fenced takeover, stale delayed save rejected, CAS revision, release/reacquire');
});
