import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKDROPS, VERTIGOS, cleanSolidStage, stageLayout, vertigoAt } from '../../app/solid-stage.js';

test('the stage settings are cleaned: off by default, a known backdrop, blur 0–1, the floor on unless turned off', () => {
  assert.deepEqual(cleanSolidStage(), { enabled: false, backdrop: 'picture', blur: .5, floor: true, vertigo: 'none', vertigoAmount: .7 });
  assert.deepEqual(cleanSolidStage({ enabled: 1, backdrop: 'sky', blur: 4, floor: 0 }), { enabled: false, backdrop: 'picture', blur: 1, floor: true, vertigo: 'none', vertigoAmount: .7 });
  assert.deepEqual(cleanSolidStage({ enabled: true, backdrop: 'plate', blur: .2, floor: false, vertigo: 'out', vertigoAmount: 3 }), { enabled: true, backdrop: 'plate', blur: .2, floor: false, vertigo: 'out', vertigoAmount: 1 });
  assert.deepEqual(BACKDROPS.map(([id]) => id), ['picture', 'plate', 'none']);
});

test('the solid stands on the floor: the shadow is at its foot, the horizon above its foot and inside the view', () => {
  const L = stageLayout(.5, 1.8, -2.7);
  assert.ok(Math.abs(L.ground - (.5 - 1.8 * 1.02)) < 1e-9);
  assert.ok(L.shadow.y < L.ground && L.ground - L.shadow.y < .2, 'shadow just under the foot');
  assert.ok(L.horizon > L.ground && L.horizon >= -2.7 + .05);
  assert.ok(stageLayout(-3, 1, -2.7).horizon >= -2.65 - 1e-9, 'a solid below the view still leaves a strip of floor');
});

test('めまいショット: nothing while the picture is whole; closing in widens the lens and the backdrop falls away; the reverse brings it closer', () => {
  assert.deepEqual(VERTIGOS.map(([id]) => id), ['none', 'in', 'out']);
  assert.deepEqual(vertigoAt('none', 1, .5, 1), { k: 0, back: 1 });
  for (const kind of ['in', 'out']) for (const q of [0, .5, 1]) assert.equal(vertigoAt(kind, 1, q, 0).k, 0, 'flat picture: no perspective');
  const a = vertigoAt('in', .7, 0, 1), b = vertigoAt('in', .7, 1, 1);
  assert.ok(b.k > a.k + .4 && a.back > b.back + .3 && Math.abs(b.back - 1) < 1e-9, `in: the lens widens (${a.k} → ${b.k}) and the backdrop shrinks to just covering (${a.back} → ${b.back})`);
  const c = vertigoAt('out', .7, 0, 1), d = vertigoAt('out', .7, 1, 1);
  assert.ok(Math.abs(c.k - b.k) < 1e-9 && Math.abs(d.k - a.k) < 1e-9, 'out is in, backwards');
  for (const kind of ['in', 'out']) for (let q = 0; q <= 1; q += .1) { const v = vertigoAt(kind, 1, q, 1); assert.ok(v.k >= 0 && v.k <= 1 && v.back >= 1 - 1e-9, 'the backdrop always covers the view'); }
  assert.ok(vertigoAt('in', 1, 1, 1).k > vertigoAt('in', .2, 1, 1).k, 'more amount = wider');
});
