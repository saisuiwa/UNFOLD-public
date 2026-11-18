import test from 'node:test';
import assert from 'node:assert/strict';
import { createReliefShape, setReliefAmount, cleanReliefAmount, reliefGrid, openHeights, reliefSwing, reliefTilt, RELIEF, PERSON, personHeights, insideDistance, fillOutside } from '../../app/relief-shape.js';
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

// 人物だけを立体にする: an elliptic "person" in a 60×40 picture, her depth a little higher in the middle, the background far
function personPicture() {
  const w = 60, h = 40, data = new Float32Array(w * h), mask = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const e = Math.hypot((x - 30) / 12, (y - 20) / 15); mask[y * w + x] = e < 1 ? 1 : 0; data[y * w + x] = e < 1 ? .6 + .2 * (1 - e) : .1; }
  return { w, h, data, mask };
}
test('distance inside, and filling the outside from the nearest inside value', () => {
  const w = 7, h = 1, inside = Uint8Array.from([0, 1, 1, 1, 1, 1, 0]), d = insideDistance(inside, w, h);
  assert.deepEqual([...d].map(v => Math.round(v)), [0, 1, 2, 3, 2, 1, 0]);
  assert.deepEqual([...fillOutside(Float32Array.from([9, 1, 2, 3, 4, 5, 9]), inside, w, h)], [1, 1, 2, 3, 4, 5, 5]);
  assert.deepEqual([...insideDistance(Uint8Array.from([1, 1, 1, 0]), 4, 1)].map(v => Math.round(v)), [3, 2, 1, 0], 'the picture edge is not a silhouette (a body cut by the frame stays thick there)');
  assert.ok(insideDistance(Uint8Array.from([1, 1]), 2, 1).every(Number.isFinite), 'no outside at all: still finite');
});
test('the person heights: a thick rounded edge, higher inside; puff 0 = her depth only, 1 = only the rounded shape', () => {
  const w = 21, h = 1, inside = new Uint8Array(w), depth = new Float32Array(w);
  for (let x = 3; x <= 17; x++) { inside[x] = 1; depth[x] = x / 20; }
  const round = personHeights(depth, inside, w, h, 1), flat = personHeights(depth, inside, w, h, 0), mid = personHeights(depth, inside, w, h, .5);
  assert.ok(round[3] >= PERSON.BASE - 1e-6 && round[3] < .75 && round[10] > .99, `edge ${round[3].toFixed(2)} (thick), middle ${round[10].toFixed(2)}`);
  assert.ok(Math.abs(round[4] - round[16]) < 1e-6, 'the rounded shape is symmetric');
  assert.ok(flat[17] > flat[3] && flat[3] < .1 && flat[17] > .9, 'puff 0 follows her depth, stretched to 0–1 inside her');
  assert.ok(Math.abs(mid[10] - (round[10] + flat[10]) / 2) < 1e-6, 'puff mixes the two');
  assert.equal(round[0], round[3], 'outside: the nearest inside value (no stretched triangles across the silhouette)');
  assert.equal(personHeights(depth, new Uint8Array(w), w, h).every(v => v === 0), true, 'nobody: all zero');
});
test('with a mask the relief covers only the person, finer, and stands in front of the picture', () => {
  const { w, h, data, mask } = personPicture(), place = { x: -1.5, y: 1, w: 3, h: 2 };
  const full = createReliefShape({ w, h, data }, place), per = createReliefShape({ w, h, data }, place, { mask: { w, h, data: mask }, puff: .5 });
  assert.equal(full.relief.person, false); assert.equal(per.relief.person, true); assert.equal(per.relief.puff, .5);
  assert.ok(per.relief.cols > full.relief.cols, 'a finer grid, since only the person is kept');
  assert.ok(per.relief.cells < full.relief.cells && per.relief.cells > 15000, `${per.relief.cells} cells only inside her`);
  const t = per.target; let xmin = Infinity, xmax = -Infinity, zmin = Infinity;
  for (let i = 0; i < t.length; i += 3) { xmin = Math.min(xmin, t[i]); xmax = Math.max(xmax, t[i]); zmin = Math.min(zmin, t[i + 2]); }
  const halfW = 12 / 60 * 3; assert.ok(Math.abs(xmin + halfW) < .06 && Math.abs(xmax - halfW) < .06, `x from ${xmin.toFixed(2)} to ${xmax.toFixed(2)}: her width, not the picture's`);
  assert.ok(zmin > 0, 'even her edge stands a little in front of the picture plane');
  assert.throws(() => createReliefShape({ w, h, data }, place, { mask: { w, h, data: new Float32Array(w * h) } }), /人物の形/);
  assert.equal(setReliefAmount(per, 1.5), true, 'the amount slider still works');
});
