import test from 'node:test';
import assert from 'node:assert/strict';
import {colorFormats,imageScale,readDrafts,writeDrafts,DRAFTS_KEY} from '../../app/workshop-data.js';
test('palette produces matching three code formats without accepting executable text',()=>{
 assert.deepEqual(colorFormats('#FF0080'),{hex:'#ff0080',js:'0xff0080',glsl:'vec3(1.0000, 0.0000, 0.5020)'});
 for(const v of ['red','#fff','#ffffff;alert(1)',null])assert.throws(()=>colorFormats(v));
});
test('preview image bounds preserve ratio and reject empty or excessive images',()=>{
 assert.deepEqual(imageScale(4000,2000),{width:2048,height:1024});assert.deepEqual(imageScale(400,800),{width:400,height:800});
 for(const [w,h]of [[0,8],[NaN,90],[10000,10000],[-1,30]])assert.throws(()=>imageScale(w,h));
});
const store=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}};
test('draft storage round trips code without executing and keeps legacy draft separate',()=>{
 const s=store();s.setItem('unfold-method-draft','legacy');const state={active:'local-1',drafts:{'local-1':{kind:'image',source:'while(true){}',name:'draft'}}};writeDrafts(s,state);assert.deepEqual(readDrafts(s),state);assert.equal(s.getItem('unfold-method-draft'),'legacy');
});
test('invalid or unavailable draft storage is reported without overwriting it',()=>{
 const s=store();s.setItem(DRAFTS_KEY,'broken');assert.throws(()=>readDrafts(s));assert.equal(s.getItem(DRAFTS_KEY),'broken');
 assert.throws(()=>writeDrafts({setItem(){throw Error('quota')}},{active:'',drafts:{}}),/保存/);
});
import {createMotionLibrary} from '../../app/lyric-library.js';
test('editing a saved text motion updates only that block and preserves its id',()=>{
 const s=store(),lib=createMotionLibrary(s),first=lib.save({name:'first',motion:{code:{version:1,source:'return {update(){}};'}}}),second=lib.save({name:'second',motion:{code:{version:1,source:'return {update(t){}};'}}});
 const updated=lib.update(first.id,{name:'edited',motion:{code:{version:1,source:'return {update(t){const x=t;}};'}}});
 assert.equal(updated.id,first.id);assert.equal(lib.list().length,2);assert.equal(lib.list()[0].name,'edited');assert.deepEqual(lib.list()[1],second);assert.throws(()=>lib.update('missing',updated));
});
import {workshopFile,importedDrafts} from '../../app/workshop-library.js';
import {buildMotionFile,parseMotionFile} from '../../app/lyric-library.js';
test('editing a text motion preserves existing motion settings through import and export',()=>{
 const value={name:'styled',motion:{size:120,speed:2,position:'bottom',direction:'left',code:{version:1,source:'return {update(){}};'}}};
 const original=parseMotionFile(buildMotionFile(value)).motion;
 const draft=importedDrafts(buildMotionFile(value))[0];draft.name='edited';
 assert.deepEqual(parseMotionFile(workshopFile(draft).text).motion,original);
});
