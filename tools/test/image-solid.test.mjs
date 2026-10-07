import test from 'node:test';
import assert from 'node:assert/strict';
import {imageFrame} from '../../app/image-method-format.js';
test('solid envelope is opt-in and independent of deformation strength',()=>{
 assert.equal(imageFrame(3,6,0).form,0);
 const f=imageFrame(3,6,0,{form:1});assert.equal(f.form,1);assert.equal(f.amount,0);
 assert.equal(imageFrame(0,6,.8,{form:1}).form,0);
 assert.equal(imageFrame(6,6,.8,{form:1}).form,0);
 assert.equal(imageFrame(3,6,.8,{form:8}).form,1);
});

import * as THREE from '../../app/vendor/three.module.min.js';
import {imageTarget,validateImageTarget} from '../../app/image-method-target.js';
test('target keeps all custom triangles and caches stable identities across frames',()=>{
 const g=new THREE.BoxGeometry();const t=imageTarget(g,{shape:'glb-test',preset:true});
 assert.equal(t.uv.length,g.index.count*2);assert.equal(t.positions.length,g.index.count*3);
 assert.equal(imageTarget(g,{shape:'glb-test',preset:true}),t);
 assert.notEqual(imageTarget(g,{shape:'heart'}),t);assert.equal(imageTarget(g,{shape:'heart'}).shape,5);
 assert.equal(validateImageTarget(t),t);g.dispose();
});
test('target rejects malformed arrays and nonfinite imported coordinates',()=>{
 const t={positions:new Float32Array(9),uv:new Float32Array(6),shape:0,preset:true,project:false};
 assert.equal(validateImageTarget(t),t);
 assert.throws(()=>validateImageTarget({...t,uv:new Float32Array(4)}));
 assert.throws(()=>validateImageTarget({...t,shape:NaN}));
 t.positions[3]=NaN;assert.throws(()=>validateImageTarget(t));
});
test('maximum allowed GLB retains the importer padding triangles',()=>{
 const triangles=Math.ceil(1000000/512)*512;
 assert.doesNotThrow(()=>validateImageTarget({positions:new Float32Array(triangles*9),uv:new Float32Array(triangles*6),shape:0,preset:true,project:false}));
});
