import test from 'node:test';
import assert from 'node:assert/strict';
import { GALLERY_STYLES, cleanGallery, styleOf, galleryGap, galleryZoom, galleryPose, planeOpacity } from '../../app/gallery-walk.js';
import { borderOf } from '../../app/frame-stage.js';

test('the gallery settings are cleaned: off by default, a known style, numbers in range', () => {
  assert.deepEqual(cleanGallery(), { enabled: false, style: 'mix', size: .8, pop: .15, lead: .5 });
  assert.deepEqual(cleanGallery({ enabled: 'x', style: 'neon', size: 2, pop: -1, lead: 9 }), { enabled: false, style: 'mix', size: .95, pop: 0, lead: 1 });
  assert.deepEqual(cleanGallery({ enabled: true, style: 'wood', size: .6, pop: .5, lead: 0 }), { enabled: true, style: 'wood', size: .6, pop: .5, lead: 0 });
  assert.equal(GALLERY_STYLES[0][0], 'mix');
  assert.deepEqual([0, 1, 2, 3, 4].map(i => styleOf('mix', i)), ['gold', 'wood', 'black', 'white', 'gold']);
  assert.equal(styleOf('black', 3), 'black');
});

test('every frame style fits the view at the chosen size, and the frames do not touch', () => {
  const w = 5.25, h = w * 9 / 16, z = galleryZoom(9.6, 5.4, w, h, .8);
  for (const s of ['gold', 'wood', 'black', 'white']) { const b = borderOf(s, w, h); assert.ok((w + 2 * b) * z <= 9.6 * .8 + 1e-9 && (h + 2 * b) * z <= 5.4 * .8 + 1e-9, s); }
  assert.ok(galleryGap(w) > w + 2 * borderOf('white', w, h) + .5, 'a gap of wall between two frames');
});

test('a held picture hangs in its own frame; a change carries it to the next frame, and the camera goes with it', () => {
  assert.deepEqual(galleryPose(2, false), { x: 2, lift: 0, focus: 2, lead: 0 });
  const start = galleryPose(1, true, 0, 0), end = galleryPose(1, true, 1, 1);
  assert.ok(Math.abs(start.x - 1) < 1e-9 && Math.abs(start.focus - 1) < 1e-9 && Math.abs(start.lead) < 1e-9, 'starts in frame 1, the camera on it');
  assert.ok(Math.abs(end.x - 2) < 1e-9 && Math.abs(end.focus - 2) < 1e-9 && Math.abs(end.lead) < 1e-9 && Math.abs(end.lift) < 1e-9, 'ends in frame 2, the camera on it');
  let lastX = 1, lastF = 1;
  for (let u = 0; u <= 1.0001; u += .05) { const p = galleryPose(1, true, u, u); assert.ok(p.x >= lastX - 1e-9 && p.focus >= lastF - 1e-9 && p.lift >= -1e-9 && p.lead >= -1e-9 && p.lead <= 1 + 1e-9); assert.ok(Math.abs(p.focus - p.x) < .32, `the camera stays with the solid (u ${u.toFixed(2)})`); lastX = p.x; lastF = p.focus; }
  assert.ok(galleryPose(1, true, .5, .5).lift > 0 && galleryPose(1, true, .5, .5).lead > .9, 'half way: lifted, the camera walking');
  assert.equal(galleryPose(1, true, .7, .7, 'reveal').x, 1, 'a reveal breaks away where it hangs');
  assert.ok(Math.abs(galleryPose(1, true, .5, .9, 'through').x - 1.5) < 1e-9, 'without a solid the pieces cross in the middle of the change (its own time, not the solid\'s)');
});

test('the frames behind keep their pictures, the one being left gets its picture back, the ones ahead wait dark', () => {
  assert.deepEqual([0, 1, 2, 3].map(j => planeOpacity(j, 1, false)), [1, 0, 0, 0], 'holding picture 2: it is the mesh itself; ahead is dark');
  assert.deepEqual([0, 1, 2, 3].map(j => planeOpacity(j, 1, true, .2)), [1, 0, 0, 0], 'just left: its frame is empty');
  assert.deepEqual([0, 1, 2, 3].map(j => planeOpacity(j, 1, true, .95)), [1, 1, 0, 0], 'later: the picture is back in the frame it left; the next is the mesh landing');
  assert.equal(planeOpacity(2, 1, true, .3, 'reveal'), 1, 'a reveal\'s next picture already hangs there');
});
