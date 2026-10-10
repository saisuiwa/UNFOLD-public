import test from 'node:test';
import assert from 'node:assert/strict';
import {acquireLease} from '../../../app/studio/lease.js';
/** In-memory stand-in for the two lease functions of the IndexedDB store (same read-modify-write contract). */
const memoryStore=()=>{const rows=new Map();return {rows,async updateLease(id,update){const previous=rows.get(id),next=update(previous);if(next!==undefined)rows.set(id,next);return next??previous;},async readLease(id){return rows.get(id);}};};
const realNow=Date.now;let skew=0;
const live=[];
const lease=async(...args)=>{const l=await acquireLease(...args);live.push(l);return l;};
test.beforeEach(()=>{skew=0;Date.now=()=>realNow()+skew;});
test.afterEach(async()=>{Date.now=realNow;while(live.length)await live.pop().release();});

test('a lapsed lease that nobody else took is renewed, not lost (sleep / throttled timers)',async()=>{
 const store=memoryStore();let lost=0;
 const a=await lease(store,'p',{ownerId:'A',onLost:()=>lost++});assert.equal(a.mode,'writer');
 skew=20000; // more than the 15 s TTL passed without a renewal
 await a.renew();
 assert.equal(a.mode,'writer');assert.equal(lost,0);
 const record=await store.readLease('p');
 assert.equal(record.ownerId,'A');assert.equal(record.fence,a.fence);assert.ok(record.expiresAt>Date.now(),'the lease must be live again');
});

test('a lapsed lease that another owner took is still lost',async()=>{
 const store=memoryStore();let lost=0;
 const a=await lease(store,'p',{ownerId:'A',onLost:()=>lost++});
 skew=20000;
 const b=await lease(store,'p',{ownerId:'B'});assert.equal(b.mode,'writer');assert.ok(b.fence>a.fence);
 await a.renew();
 assert.equal(a.mode,'reader');assert.equal(lost,1);
});

test('a change notification does not demote a writer whose lease merely lapsed',async()=>{
 const store=memoryStore();let lost=0;
 const a=await lease(store,'p',{ownerId:'A',onLost:()=>lost++});
 skew=20000;
 const other=new BroadcastChannel('unfold-studio-lease:p');other.postMessage({changed:true});
 await new Promise(r=>setTimeout(r,80));other.close();
 assert.equal(a.mode,'writer');assert.equal(lost,0);
});
