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
