import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import * as THREE from '../../app/vendor/three.module.min.js';
const url=new URL('../../app/shot-motion.js',import.meta.url);
const m=existsSync(url)?await import(url):{};
test('shared rotation and camera controls are available',()=>assert.equal(typeof m.cleanShot,'function','shared shot settings missing'));
const check=(name,fn)=>test(name,()=>{assert.equal(typeof m.cleanShot,'function','shared shot settings missing');fn()});
check('old projects and malformed settings stay bounded',()=>{
 const d=m.cleanShot();assert.equal(d.rotation.enabled,false);assert.equal(d.camera.enabled,false);
 const c=m.cleanShot({rotation:{enabled:true,inDirection:'hax',outDirection:'up',inTurns:Infinity,outTurns:20},camera:{enabled:true,from:{x:99,y:NaN,zoom:100},to:{x:-99,y:Infinity,zoom:-3},start:99,end:1,ease:'hax'}});
 assert.equal(c.rotation.inDirection,'right');assert.equal(c.rotation.outDirection,'up');assert.equal(c.rotation.inTurns,1);assert.equal(c.rotation.outTurns,3);
 assert.equal(c.camera.from.x,1);assert.equal(c.camera.from.zoom,4);assert.equal(c.camera.from.y,0);assert.equal(c.camera.to.zoom,.5);assert.ok(c.camera.end>c.camera.start);
});
check('right/left and up/down rotate along opposite axes in both modes',()=>{
 for(const mode of ['single','sequence']){
 const t=mode==='single'?.40:.28;
 for(const [a,b]of [['right','left'],['up','down'],['up-right','down-left']]){
 const r=m.rotationAt({enabled:true,inDirection:a},t,mode),l=m.rotationAt({enabled:true,inDirection:b},t,mode);
 assert.ok(r.angle>0);assert.equal(r.angle,l.angle);for(let i=0;i<3;i++)assert.ok(Math.abs(r.axis[i]+l.axis[i])<1e-12);
 }
 }
});
check('all directions finish whole turns at identity and never leak into original image',()=>{
 for(const mode of ['single','sequence'])for(const direction of m.DIRECTIONS.map(x=>x[0]))for(const turns of [0,1,2,3]){
 for(const t of [0,1]){const r=m.rotationAt({enabled:true,inDirection:direction,outDirection:direction,inTurns:turns,outTurns:turns},t,mode);assert.equal(r.angle,0)}
 const r=m.rotationAt({enabled:true,inDirection:direction},mode==='single'?.45:.35,mode);assert.ok(Math.abs(Math.hypot(...r.axis)-1)<1e-12);assert.ok(Number.isFinite(r.angle));
 }
});
check('return direction and turn amount are independent; none stays still',()=>{
 const a=m.rotationAt({enabled:true,inDirection:'left',outDirection:'up',outTurns:2},.78,'single');const b=m.rotationAt({enabled:true,inDirection:'right',outDirection:'up',outTurns:1},.78,'single');
 assert.deepEqual(a.axis,b.axis);assert.equal(a.angle,b.angle*2);
 for(const t of [.4,.8])assert.equal(m.rotationAt({enabled:true,inDirection:'none',outDirection:'none'},t,'single').angle,0);
 assert.equal(m.rotationAt({enabled:false},.4,'single'),null);
});
check('camera travels from left toward upper right with simultaneous zoom and exact endpoints',()=>{
 const cam={enabled:true,from:{x:-.4,y:0,zoom:1},to:{x:.3,y:.35,zoom:2},start:10,end:80,ease:'linear'};
 assert.deepEqual(m.cameraAt(cam,0),{x:0,y:0,zoom:1,roll:0});assert.deepEqual(m.cameraAt(cam,1),{x:0,y:0,zoom:1,roll:0});
 const a=m.cameraAt(cam,.10),b=m.cameraAt(cam,.45),c=m.cameraAt(cam,.80);
 assert.equal(a.x,-.4);assert.ok(Math.abs(b.x+.05)<1e-12);assert.equal(c.x,.3);assert.equal(c.y,.35);assert.equal(c.zoom,2);assert.equal(m.cameraAt({enabled:false},.4),null);
});
check('enabled motion supersedes old camera only in active interval, blends continuously',()=>{
 const c={enabled:true,from:{x:-.4,y:.2,zoom:2},to:{x:.4,y:-.1,zoom:3}};
 const a=m.cameraAt(c,.000001),b=m.cameraAt(c,.999999);for(const x of [a,b]){assert.ok(Math.abs(x.x)<1e-7);assert.ok(Math.abs(x.zoom-1)<1e-7)}
});
check('sanitized shot settings round-trip without shared mutable endpoints',()=>{
 const raw={rotation:{enabled:true,inDirection:'up-left',outDirection:'down-right',inTurns:2,outTurns:1},camera:{enabled:true,from:{x:-.4,y:.1,zoom:1.2},to:{x:.3,y:.4,zoom:2}}};const a=m.cleanShot(raw),b=m.cleanShot(JSON.parse(JSON.stringify(a)));assert.deepEqual(a,b);a.camera.from.x=1;assert.equal(raw.camera.from.x,-.4);
});
check('transition camera joins the existing slide camera without endpoint jumps',()=>{
 assert.equal(typeof m.blendCameraMove,'function','transition camera blend missing');
 const current={x:.7,y:-.4,zoom:2.3,roll:.1},settings={enabled:true,from:{x:-.4,y:0,zoom:1},to:{x:.3,y:.3,zoom:2},start:10,end:80,ease:'linear'};
 for(const t of [0,1])assert.deepEqual(m.blendCameraMove(current,settings,t,{width:5,height:3,zoom:1.2}),current);
 const at=m.blendCameraMove(current,settings,.8,{width:5,height:3,zoom:1.2});assert.equal(at.x,1.5);assert.ok(Math.abs(at.y-.9)<1e-12);assert.equal(at.zoom,2.4);assert.equal(at.roll,0);
 assert.deepEqual(m.blendCameraMove(current,{enabled:false},.5,{width:5,height:3,zoom:1.2}),current);
});
check('portrait target coordinates use the visible image instead of letterbox margins',()=>{
 assert.equal(typeof m.cameraPadRect,'function','image fit mapping missing');const r=m.cameraPadRect(900,1600);assert.equal(r.width,101.25);assert.equal(r.height,180);
 const p=m.cameraPadPoint(r,r.x+r.width,r.y);assert.equal(p.x,.5);assert.equal(p.y,.5);
 assert.deepEqual(m.cameraPadPoint(m.cameraPadRect(1600,900),160,90),{x:0,y:0});
});
