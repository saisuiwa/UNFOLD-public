import test from 'node:test';
import assert from 'node:assert/strict';
import {mixedProject} from './fixtures.mjs';
import {applyCommand} from '../../../app/studio/commands.js';
import {validateProject} from '../../../app/studio/model.js';
/**
 * "配置の基準" is a graph between clips. A loop (A→B→A) used to pass validation, made every render throw
 * ANCHOR_CYCLE and, once saved, made STUDIO unopenable. It is rejected when it is created.
 */
const anchor=(p,viewId,id,target)=>applyCommand(p,{type:'setLayout',viewId,id,patch:{anchor:target}}).project;

test('closing a two-clip anchor loop is rejected and leaves the project untouched',()=>{
 const p=anchor(mixedProject(),'wide','cImage',{clipId:'cVideo'});          // image follows video: fine
 const before=structuredClone(p);
 assert.throws(()=>anchor(p,'wide','cVideo',{clipId:'cImage'}),e=>e.code==='ANCHOR_CYCLE');
 assert.deepEqual(p,before);
});

test('a longer loop and a loop in the tall view are rejected as well',()=>{
 let p=mixedProject();
 p=anchor(p,'tall','cImage',{clipId:'cVideo'});p=anchor(p,'tall','cVideo',{clipId:'cUnfold'});
 assert.throws(()=>anchor(p,'tall','cUnfold',{clipId:'cImage'}),e=>e.code==='ANCHOR_CYCLE');
});

test('independent views may anchor in opposite directions (no cycle across views)',()=>{
 let p=anchor(mixedProject(),'wide','cImage',{clipId:'cVideo'});
 p=anchor(p,'tall','cVideo',{clipId:'cImage'});
 assert.deepEqual(validateProject(p).filter(i=>i.code==='ANCHOR_CYCLE'),[]);
});

test('validateProject reports a loop that arrives from a file',()=>{
 const p=mixedProject();
 p.views.wide.layout.cImage.anchor={clipId:'cVideo'};p.views.wide.layout.cVideo.anchor={clipId:'cImage'};
 assert.ok(validateProject(p).some(i=>i.code==='ANCHOR_CYCLE'));
});
