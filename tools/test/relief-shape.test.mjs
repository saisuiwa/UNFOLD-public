import test from 'node:test';
import assert from 'node:assert/strict';
import { createReliefShape, setReliefAmount, cleanReliefAmount, reliefGrid, openHeights, reliefSwing, reliefTilt, RELIEF } from '../../app/relief-shape.js';
import { normalizeField, blurField, sampleField } from '../../app/depth-auto/depth-field.js';

// a 64×36 picture: far (0) everywhere, with a near (1) round "person" in the middle and a gentle slope on the left third
const W = 64, H = 36;
function person() {
  const data = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = Math.hypot((x - 38) / 12, (y - 18) / 14);
    data[y * W + x] = r < 1 ? 1 : x < 20 ? x / 20 * 0.3 : 0;
  }
  return { w: W, h: H, data };
}
const place = { x: -2.6, y: 1.4, w: 5.2, h: 2.8 };
const near = (t, x, y) => { let best = null; for (let i = 0; i < t.length; i += 3) { const d = Math.hypot(t[i] - x, t[i + 1] - y); if (!best || d < best.d) best = { d, z: t[i + 2] }; } return best.z; };

test('the field helpers: normalise, blur, and read with v going up', () => {
  assert.deepEqual([...normalizeField([2, 4, 6])], [0, .5, 1]);
  assert.deepEqual([...normalizeField([3, 3])], [0, 0], 'a flat field stays flat');
  const spike = new Float32Array(21 * 21); spike[10 * 21 + 10] = 1;   // far from the edges, so nothing is stretched back in
  const soft = blurField(spike, 21, 21, 1), mid = 10 * 21 + 10;
  assert.ok(soft[mid] < 1 && soft[mid] > soft[mid - 1] && soft[mid - 1] > soft[mid - 2], 'the spike spreads out');
  assert.ok(Math.abs([...soft].reduce((a, b) => a + b, 0) - 1) < 1e-4, 'blur keeps the total');
  assert.deepEqual([...blurField(spike, 21, 21, 0)], [...spike], 'sigma 0 = unchanged');
  assert.deepEqual([...blurField(new Float32Array(9).fill(.4), 3, 3, 2)].map(v => +v.toFixed(5)), new Array(9).fill(.4), 'a flat field stays flat, edges included');
  const f = new Float32Array([0, 0, 1, 1]);   // 2×2: top row 0, bottom row 1
  assert.equal(sampleField(f, 2, 2, .5, 1), 0, 'v = 1 is the top row');
  assert.equal(sampleField(f, 2, 2, .5, 0), 1, 'v = 0 is the bottom row');
  assert.equal(sampleField(f, 2, 2, .5, .5), .5);
});

test('the grid follows the picture shape and the setting is kept in range', () => {
  const g = reliefGrid(16 / 9);
  assert.ok(Math.abs(g.cols / g.rows - 16 / 9) < .05);
  assert.ok(Math.abs(g.cols * g.rows - RELIEF.cells) / RELIEF.cells < .05);
  assert.equal(cleanReliefAmount(9), RELIEF.MAX); assert.equal(cleanReliefAmount(0), RELIEF.MIN); assert.equal(cleanReliefAmount('x', .7), .7); assert.equal(cleanReliefAmount(), 1);
});

test('the solid sits exactly on the picture, and only the near things come forward', () => {
  const data = createReliefShape(person(), place, { amount: 1, cells: 3000 });
  const t = data.target;
  assert.equal(t.length % 9, 0); assert.equal(data.uv.length, t.length / 3 * 2);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < t.length; i += 3) { x0 = Math.min(x0, t[i]); x1 = Math.max(x1, t[i]); y0 = Math.min(y0, t[i + 1]); y1 = Math.max(y1, t[i + 1]); }
  assert.ok(Math.abs(x0 - place.x) < 1e-6 && Math.abs(x1 - (place.x + place.w)) < 1e-6, 'left and right edges are the picture’s');
  assert.ok(Math.abs(y1 - place.y) < 1e-6 && Math.abs(y0 - (place.y - place.h)) < 1e-6, 'top and bottom edges are the picture’s');
  // the picture is drawn through the solid by position, so the middle of the person is where the person is in the picture (x: 38/63 across, y: 18/35 from the top)
  const px = place.x + 38 / (W - 1) * place.w, py = place.y - 18 / (H - 1) * place.h, bx = place.x + 56 / (W - 1) * place.w, by = place.y - 6 / (H - 1) * place.h;
  const zPerson = near(t, px, py), zBack = near(t, bx, by);
  assert.ok(zPerson > zBack + .5 * RELIEF.Z * place.h, `the person (${zPerson.toFixed(2)}) is well in front of the far background (${zBack.toFixed(2)})`);
  assert.ok(Math.abs(zPerson - (1 - RELIEF.PIVOT) * RELIEF.Z * place.h) < .05, 'a depth of 1 reaches the full height');
  assert.ok(zBack < 0 && Math.abs(zBack + RELIEF.PIVOT * RELIEF.Z * place.h) < .05, 'a depth of 0 sits a little behind the picture plane');
});

test('an outline becomes a smooth slope that is stretched, not cut; only an extreme step is flattened onto its far side', () => {
  const data = createReliefShape(person(), place, { amount: 1, cells: 3000 });
  assert.equal(data.relief.flattened, 0, 'the person’s outline is a slope, nothing is flattened');
  const t = data.target;
  let worst = 0;
  for (let k = 0; k < t.length; k += 9) worst = Math.max(worst, Math.max(t[k + 2], t[k + 5], t[k + 8]) - Math.min(t[k + 2], t[k + 5], t[k + 8]));
  assert.ok(worst < (1 - RELIEF.PIVOT) * RELIEF.Z * place.h + .6 * RELIEF.Z * place.h, 'the slope is shorter than the whole depth');
  const old = RELIEF.STEP;
  try {
    RELIEF.STEP = 0.07;   // the rule itself: with a low limit the outline triangles are flattened and none is deeper than the limit
    const cut = createReliefShape(person(), place, { amount: 1, cells: 3000 }), c = cut.target, limit = RELIEF.STEP * RELIEF.Z * place.h;
    assert.ok(cut.relief.flattened > 0);
    let deepest = 0;
    for (let k = 0; k < c.length; k += 9) deepest = Math.max(deepest, Math.max(c[k + 2], c[k + 5], c[k + 8]) - Math.min(c[k + 2], c[k + 5], c[k + 8]));
    assert.ok(deepest <= limit * 1.05 + 1e-9, `no triangle is deeper than the limit (${deepest.toFixed(3)} <= ${(limit * 1.05).toFixed(3)})`);
  } finally { RELIEF.STEP = old; }
});

test('thin bright lines (hair, wires) are taken out of the depth; thick things keep their shape', () => {
  const w = 21, h = 21, d = new Float32Array(w * h);
  for (let y = 0; y < h; y++) { d[y * w + 4] = 1; }                              // a one-cell-wide line
  for (let y = 6; y < 15; y++) for (let x = 10; x < 19; x++) d[y * w + x] = 1;   // a 9×9 block
  const o = openHeights(d, w, h, 1);
  assert.equal(o[10 * w + 4], 0, 'the thin line is gone');
  assert.equal(o[10 * w + 14], 1, 'the block stays');
  assert.equal(o[6 * w + 10], 1, 'and so do its corners');
  assert.deepEqual([...openHeights(d, w, h, 0)], [...d], 'radius 0 = unchanged');
});

test('the amount scales the height without rebuilding', () => {
  const data = createReliefShape(person(), place, { amount: 1, cells: 3000 });
  const px = place.x + 38 / (W - 1) * place.w, py = place.y - 18 / (H - 1) * place.h;
  const z1 = near(data.target, px, py), xs = data.target.slice(0, 30);
  assert.equal(setReliefAmount(data, 1), false, 'same amount: nothing to do');
  assert.equal(setReliefAmount(data, .5), true);
  assert.ok(Math.abs(near(data.target, px, py) - z1 / 2) < 1e-4, 'half the amount = half the height');
  assert.deepEqual([...data.target.slice(0, 30)].filter((_, i) => i % 3 !== 2), [...xs].filter((_, i) => i % 3 !== 2), 'x and y do not move');
  assert.equal(data.relief.amount, .5);
  setReliefAmount(data, 9); assert.equal(data.relief.amount, RELIEF.MAX, 'the amount stays in range');
  assert.equal(setReliefAmount({}, 1), false);
});

test('it refuses what it cannot use', () => {
  assert.throws(() => createReliefShape(null, place), /奥行き/);
  assert.throws(() => createReliefShape({ w: 4, h: 4, data: new Float32Array(3) }, place), /奥行き/);
  assert.throws(() => createReliefShape(person(), { x: 0, y: 0, w: 0, h: 1 }), /大きさ/);
});

test('the swing is one slow left-right pass inside the time the solid is whole, and nothing outside it', () => {
  for (const w of [0, .2, .4, .45, .46, .74, .8, 1]) assert.equal(reliefSwing(w, 1), 0, `still at ${w}`);
  const right = reliefSwing(.525, 1), left = reliefSwing(.675, 1);
  assert.ok(right > .3 && right <= .45, `swings one way first (${right.toFixed(3)} rad)`);
  assert.ok(left < -.25 && left >= -.45, `then the other (${left.toFixed(3)} rad)`);
  assert.ok(Math.abs(reliefSwing(.6, 1)) < .05, 'and crosses the middle in between');
  assert.equal(reliefSwing(.525, 0), 0, 'amount 0 = off');
  assert.ok(Math.abs(reliefSwing(.525, .5) - right / 2) < 1e-9, 'the amount scales it');
  assert.equal(reliefSwing(.525, 9), right, 'and is capped at 1');
  assert.equal(reliefSwing(.525, NaN), 0, 'a bad number counts as off');
});

test('the tilt nods up and down in the same time, a quarter turn behind the swing, and nothing outside it', () => {
  for (const w of [0, .2, .4, .45, .46, .74, .8, 1]) assert.equal(reliefTilt(w, 1), 0, `still at ${w}`);
  assert.ok(Math.abs(reliefTilt(.525, 1)) < 1e-9 && Math.abs(reliefTilt(.675, 1)) < 1e-9, 'level at the two ends of the swing');
  const mid = reliefTilt(.60, 1);
  assert.ok(mid > .27 && mid <= .30, `leans the most in the middle, where the swing crosses zero (${mid.toFixed(3)} rad)`);
  assert.ok(Math.abs(reliefSwing(.60, 1)) < .05, 'which is where the swing itself is level');
  assert.ok(Math.max(...[.5, .55, .65, .7].map(w => Math.abs(reliefTilt(w, 1)))) < mid, 'and nowhere leans more than the middle');
  assert.equal(reliefTilt(.60, 0), 0, 'amount 0 = off');
  assert.ok(Math.abs(reliefTilt(.60, .5) - mid / 2) < 1e-9, 'the amount scales it');
  assert.equal(reliefTilt(.60, 9), mid, 'and is capped at 1');
  assert.equal(reliefTilt(.60, NaN), 0, 'a bad number counts as off');
  // together the two make a closed loop: going round once ends where it began (both back at rest)
  assert.ok(Math.abs(reliefSwing(.47, 1)) < .02 && Math.abs(reliefTilt(.47, 1)) < .02 && Math.abs(reliefSwing(.73, 1)) < .02 && Math.abs(reliefTilt(.73, 1)) < .02, 'it starts and ends at rest (under about 1 degree just inside the window)');
});
