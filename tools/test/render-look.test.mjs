import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../app/vendor/three.module.min.js';
import { cleanRenderLook, addRenderUniforms, applyRenderLook, syncPerspective } from '../../app/render-look.js';

test('old projects retain legacy rendering and malformed look values are bounded',()=>{
 assert.equal(cleanRenderLook().enabled,false);
 const x=cleanRenderLook({enabled:true,perspective:9,azimuth:-999,elevation:Infinity,shade:NaN,alpha:'unsafe',unknown:2});
 assert.equal(x.perspective,1);assert.equal(x.azimuth,-180);assert.equal(x.elevation,30);assert.equal(x.shade,.6);assert.equal(x.alpha,'original');assert.equal('unknown' in x,false);
});
test('comparison toggle neutralizes new shader settings without losing stored choices',()=>{
 const u=addRenderUniforms({});applyRenderLook(u,{enabled:true,lighting:true,alpha:'dither',shade:.9});assert.equal(u.uLookLight.value,1);assert.equal(u.uLookAlpha.value,1);assert.equal(u.uLookShade.value,.9);
 applyRenderLook(u,{enabled:false,lighting:true,alpha:'dither'});assert.equal(u.uLookLight.value,0);assert.equal(u.uLookAlpha.value,0);
});
test('light direction is finite and normalized across slider endpoints',()=>{
 for(const azimuth of [-180,0,180])for(const elevation of [-80,0,80]){const u=addRenderUniforms({});applyRenderLook(u,{enabled:true,azimuth,elevation});assert.ok(Math.abs(u.uLookDirection.value.length()-1)<1e-12)}
});
test('perspective matches original plane framing, translated camera and roll',()=>{
 const o=new THREE.OrthographicCamera(-4.8,4.8,2.7,-2.7,.1,100);o.position.set(.3,-.2,10);o.rotation.z=.2;o.zoom=1.3;o.updateProjectionMatrix();o.updateMatrixWorld();
 const p=new THREE.PerspectiveCamera();assert.equal(syncPerspective(o,p,0),o);assert.equal(syncPerspective(o,p,.7),p);p.updateMatrixWorld();
 for(const point of [new THREE.Vector3(1,1,0),new THREE.Vector3(-1,-1,0)]){const a=point.clone().project(o),b=point.clone().project(p);assert.ok(Math.abs(a.x-b.x)<1e-12);assert.ok(Math.abs(a.y-b.y)<1e-12)}
});
