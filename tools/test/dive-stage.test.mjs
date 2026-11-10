import test from 'node:test';
import assert from 'node:assert/strict';
import { DIVE, diveAt, divePath, PERSON_Z, BACK_Z } from '../../app/dive-stage.js';
import { galleryPose, planeOpacity } from '../../app/gallery-walk.js';

test('the dive has three parts: closing in, inside the picture, the next picture arriving; the light covers the cut', () => {
  assert.deepEqual(diveAt(0), { closing: 0, go: 0, inside: false, flash: 0, arrive: 0 });
  const mid = diveAt((DIVE.IN + DIVE.CUT) / 2);
  assert.ok(mid.inside && mid.closing === 1 && Math.abs(mid.go - .5) < 1e-9 && mid.arrive === 0);
  assert.ok(diveAt(DIVE.CUT - 1e-6).inside && !diveAt(DIVE.CUT).inside, 'the dive stage draws up to the cut');
  assert.ok(diveAt(DIVE.CUT - .01).flash > .85 && diveAt(DIVE.CUT + .01).flash > .85, 'bright on both sides of the cut');
  const end = diveAt(1);
  assert.ok(end.arrive === 1 && end.flash < 1e-9 && end.go === 1 && !end.inside, 'settled on the next picture at the end');
  let last = -1; for (let u = 0; u <= 1.0001; u += .02) { const g = diveAt(u).go; assert.ok(g >= last - 1e-9); last = g; }
});

test('the camera starts where the picture fills the view, passes the person on the chosen side and stops before the background', () => {
  const start = divePath(0, -1);   // (−0 is fine: compare by size)
  assert.ok(start.z === 1 && [start.x, start.y, start.look.x, start.look.y, start.bank].every(v => Math.abs(v) === 0), 'the first position shows the picture as it is');
  const end = divePath(1, -1);
  assert.ok(end.z < PERSON_Z && end.z > BACK_Z + .1, `past the person, short of the background (${end.z})`);
  assert.ok(end.x < -.2 && divePath(1, 1).x > .2 && divePath(1, 0).x === 0, 'left, right, or straight without a person');
  let z = 2; for (let g = 0; g <= 1.0001; g += .05) { const p = divePath(g, 1, 1.3); assert.ok(p.z <= z + 1e-9, 'always forwards'); z = p.z; }
});

test('in the gallery a dive goes into the frame it is at and comes out of the next one', () => {
  assert.deepEqual(galleryPose(1, true, .3, .3, 'dive'), { x: 1, lift: 0, focus: 1, lead: 0 });
  assert.deepEqual(galleryPose(1, true, .8, .8, 'dive'), { x: 2, lift: 0, focus: 2, lead: 0 });
  assert.equal(planeOpacity(2, 1, true, .8, 'dive'), 0, 'the picture it comes out of is the mesh itself');
  assert.equal(planeOpacity(1, 1, true, .95, 'dive'), 1, 'the frame it left has its picture back');
});
