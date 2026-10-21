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
test('target carries a GLB\'s own colours, and its texture coordinates only with the texture',()=>{
 const g=new THREE.BoxGeometry(),n=g.attributes.position.count;
 g.setAttribute('targetPosition',g.attributes.position.clone());
 g.setAttribute('modelColor',new THREE.BufferAttribute(new Float32Array(n*4).fill(2),4));g.setAttribute('modelUv',new THREE.BufferAttribute(new Float32Array(n*3),3));
 const plain=imageTarget(g,{shape:'glb-colour'});
 assert.equal(plain.color.length,g.index.count*4);assert.equal(plain.modelUv,undefined);assert.equal(plain.texture,undefined);assert.equal(validateImageTarget(plain),plain);
 const texture={image:{width:4,height:4}},painted=imageTarget(g,{shape:'glb-painted',texture});
 assert.equal(painted.modelUv.length,g.index.count*3);assert.equal(painted.texture,texture);assert.equal(validateImageTarget(painted),painted);
 // a shape without colour stays as it was: no colour fields at all
 const bare=new THREE.BoxGeometry(),b=imageTarget(bare,{shape:'heart'});assert.deepEqual(Object.keys(b).sort(),['positions','preset','project','shape','uv']);
 g.dispose();bare.dispose();
});
test('target rejects malformed colours and texture coordinates',()=>{
 const t={positions:new Float32Array(9),uv:new Float32Array(6),shape:0,preset:true,project:false},texture={image:{width:2,height:2}};
 assert.doesNotThrow(()=>validateImageTarget({...t,color:new Float32Array(12)}));
 assert.doesNotThrow(()=>validateImageTarget({...t,color:new Float32Array(12),modelUv:new Float32Array(9),texture}));
 assert.throws(()=>validateImageTarget({...t,color:new Float32Array(9)}));
 assert.throws(()=>validateImageTarget({...t,color:[0,0,0,2,0,0,0,2,0,0,0,2]}));
 assert.throws(()=>validateImageTarget({...t,modelUv:new Float32Array(9)}),'texture coordinates without the texture');
 assert.throws(()=>validateImageTarget({...t,texture}),'a texture without coordinates');
 assert.throws(()=>validateImageTarget({...t,modelUv:new Float32Array(9),texture:{image:{width:0,height:2}}}));
 const bad=new Float32Array(12);bad[5]=Infinity;assert.throws(()=>validateImageTarget({...t,color:bad}));
});
