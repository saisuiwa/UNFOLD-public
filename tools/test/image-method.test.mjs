import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanImageCode,imageFrame} from '../../app/image-method-format.js';
import {IMAGE_METHOD_PRESETS} from '../../app/image-method-presets.js';
import {buildMethodFile,parseMethodFile} from '../../app/method-file.js';
import {collectMethods,projectVersion,planImport,registerQuarantined,remapTransitions} from '../../app/method-project.js';
import {sourceHash,createPersistence} from '../../app/method-library.js';
import * as R from '../../app/method-registry.js';
const code=()=>structuredClone(IMAGE_METHOD_PRESETS[0].code);
const record=()=>({id:'im-test',name:'Physics',symbol:'◈',code:code()});
test('image code file roundtrip preserves physics settings and quarantines executable source',async()=>{
 const r=record();r.code.params.gravity=9.8;
 const serialized=buildMethodFile([r]);assert.equal(JSON.parse(serialized).version,2);
 const parsed=parseMethodFile(serialized);assert.deepEqual(parsed.problems,[]);assert.deepEqual(parsed.methods[0].code,r.code);
 const plan=await planImport({embedded:parsed.methods,local:[],hash:sourceHash,newId:()=>{throw Error('GLSL id called')}});
 registerQuarantined(plan.created);const saved=R.getCustom(plan.created[0].id);assert.match(saved.id,/^im-/);assert.equal(saved.status,'quarantined');assert.equal(R.isUsable(saved.id),false);
 const methods=collectMethods([{method:saved.id}],R.getCustom);assert.equal(projectVersion(methods),4);assert.deepEqual(methods[0].code,r.code);R.unregisterCustom(saved.id);
});
test('same source with different physics parameters remains a separate method',async()=>{
 const a=record(),b=record();b.id='im-another';b.code.params.seed++;
 const p=await planImport({embedded:[b],local:[a],hash:sourceHash});assert.equal(p.created.length,1);
 const reused=await planImport({embedded:[a],local:[a],hash:sourceHash});assert.deepEqual(reused.reused,[a.id]);
});
test('malformed parameters and unknown runtime are rejected before execution',()=>{
 for(const params of [[],false,'',{'font':'https://example.com/font.ttf'},{gravity:NaN},{columns:2000}])assert.throws(()=>cleanImageCode({...code(),params}));
 assert.throws(()=>cleanImageCode({...code(),runtime:'future'}));
});
test('missing image code does not silently turn into a GLSL method',()=>{
 assert.throws(()=>remapTransitions([{method:'im-missing'}],new Map()),/画像/);
});
test('image envelope preserves original at endpoints and zero strength',()=>{
 assert.equal(imageFrame(0,6).amount,0);assert.equal(imageFrame(6,6).amount,0);
 assert.equal(imageFrame(3,6,0).amount,0);assert.equal(imageFrame(0,6).imageMix,0);assert.equal(imageFrame(6,6).imageMix,1);
});
test('browser method store saves and reloads image code without changing its settings',async()=>{
 const rows=new Map(),store={list:async()=>[...rows.values()],put:async r=>rows.set(r.id,structuredClone(r)),delete:async id=>rows.delete(id)};
 const p=createPersistence({store});p.start();R.registerCustom(record());await p.flush();p.stop();R.unregisterCustom('im-test');
 const q=createPersistence({store});await q.load();assert.deepEqual(R.getCustom('im-test').code,code());R.unregisterCustom('im-test');
});
