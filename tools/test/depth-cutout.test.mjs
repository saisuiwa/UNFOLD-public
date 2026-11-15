import test from 'node:test';
import assert from 'node:assert/strict';
import { DEPTH_CUT, cleanDepthCut, workSize, spreadDepth, refineDepth, median3, splitAt, depthMatte, matteShare } from '../../app/depth-cutout.js';

test('the setting has sane first values, and anything odd falls back', () => {
  assert.deepEqual(cleanDepthCut(), { at: .3, tilt: 0, fine: true });
  assert.deepEqual(cleanDepthCut({ at: 9, tilt: -7, fine: false }), { at: .95, tilt: -1, fine: false });
  assert.deepEqual(cleanDepthCut({ at: 'x', tilt: NaN, fine: 0 }), { ...DEPTH_CUT });
  assert.deepEqual(cleanDepthCut(cleanDepthCut({ at: .62, tilt: .4 })), { at: .62, tilt: .4, fine: true });
});

test('the working size keeps the picture\'s shape and never grows it', () => {
  assert.deepEqual(workSize(1920, 1080), { W: 960, H: 540 });
  assert.deepEqual(workSize(640, 360), { W: 640, H: 360 });
  assert.deepEqual(workSize(1000, 2000), { W: 480, H: 960 });
});

test('a coarse depth is spread smoothly over the picture', () => {
  const d = spreadDepth({ w: 2, h: 1, data: Float32Array.from([0, 1]) }, 8, 2);
  assert.ok(d[0] === 0 && d[7] === 1, 'the ends keep their values');
  for (let x = 1; x < 8; x++) assert.ok(d[x] >= d[x - 1], 'rising from left to right');
  assert.deepEqual([...d.slice(0, 8)], [...d.slice(8, 16)], 'both rows alike');
});

// a picture: left half red, right half blue; its coarse depth has the step in the wrong place (shifted right) and blurred
function scene() {
  const W = 64, H = 24, rgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = (y * W + x) * 4, near = x < 32; rgba[p] = near ? 220 : 30; rgba[p + 1] = 40; rgba[p + 2] = near ? 30 : 220; rgba[p + 3] = 255; }
  const coarse = { w: 16, h: 6, data: new Float32Array(16 * 6) };
  for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) coarse.data[y * 16 + x] = Math.min(1, Math.max(0, (10.5 - x) / 3));   // near on the left, the slope lies around x = 9 of 16 (= 36 of 64)
  return { W, H, rgba, raw: spreadDepth(coarse, W, H) };
}

test('refining pulls the depth\'s edge onto the picture\'s colour edge', () => {
  const { W, H, rgba, raw } = scene(), fine = refineDepth(raw, rgba, W, H), row = 12 * W;
  const rawStep = raw[row + 31] - raw[row + 32], fineStep = fine[row + 31] - fine[row + 32];
  assert.ok(rawStep < .1, `the coarse depth has no step at the colour edge (${rawStep.toFixed(3)})`);
  assert.ok(fineStep > .5, `the refined depth steps right there (${fineStep.toFixed(3)})`);
  assert.ok(fine[row + 20] > .9 && fine[row + 44] < .2, 'far from the edge the two sides keep their depth');
  for (const v of fine) assert.ok(v >= 0 && v <= 1 && Number.isFinite(v));
});

test('a lone speck is removed, an edge stays', () => {
  const W = 9, H = 9, d = new Float32Array(W * H).fill(.2); d[4 * W + 4] = 1;
  assert.equal(median3(d, W, H)[4 * W + 4], Math.fround(.2));
  const e = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 5; x < W; x++) e[y * W + x] = 1;
  const m = median3(e, W, H); assert.ok(m[4 * W + 4] === 0 && m[4 * W + 5] === 1);
});

test('what is nearer than the split stays in the cut-out; a tilt moves the split across the picture', () => {
  const W = 10, H = 2, d = new Float32Array(W * H).fill(.5);
  assert.ok(depthMatte(d, W, H, { at: .3 }).every(a => a === 255), 'nearer than the split: kept');
  assert.ok(depthMatte(d, W, H, { at: .7 }).every(a => a === 0), 'farther: dropped');
  const tilted = depthMatte(d, W, H, { at: .5, tilt: 1 });
  assert.ok(tilted[0] === 255 && tilted[W - 1] === 0, 'tilted: kept on the left, dropped on the right');
  assert.ok(splitAt({ at: .5, tilt: 1 }, 0) < .5 && splitAt({ at: .5, tilt: 1 }, 1) > .5 && splitAt({ at: .5, tilt: 0 }, .9) === .5);
  const soft = depthMatte(Float32Array.from([.28, .3, .32]), 3, 1, { at: .3 });
  assert.ok(soft[0] < soft[1] && soft[1] < soft[2] && soft[1] > 100 && soft[1] < 155, `the edge is soft (${[...soft]})`);
  assert.equal(matteShare(Uint8ClampedArray.from([255, 255, 0, 0])), .5);
});
