import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKDROPS, cleanSolidStage, stageLayout } from '../../app/solid-stage.js';

test('the stage settings are cleaned: off by default, a known backdrop, blur 0–1, the floor on unless turned off', () => {
  assert.deepEqual(cleanSolidStage(), { enabled: false, backdrop: 'picture', blur: .5, floor: true });
  assert.deepEqual(cleanSolidStage({ enabled: 1, backdrop: 'sky', blur: 4, floor: 0 }), { enabled: false, backdrop: 'picture', blur: 1, floor: true });
  assert.deepEqual(cleanSolidStage({ enabled: true, backdrop: 'plate', blur: .2, floor: false }), { enabled: true, backdrop: 'plate', blur: .2, floor: false });
  assert.deepEqual(BACKDROPS.map(([id]) => id), ['picture', 'plate', 'none']);
});

test('the solid stands on the floor: the shadow is at its foot, the horizon above its foot and inside the view', () => {
  const L = stageLayout(.5, 1.8, -2.7);
  assert.ok(Math.abs(L.ground - (.5 - 1.8 * 1.02)) < 1e-9);
  assert.ok(L.shadow.y < L.ground && L.ground - L.shadow.y < .2, 'shadow just under the foot');
  assert.ok(L.horizon > L.ground && L.horizon >= -2.7 + .05);
  assert.ok(stageLayout(-3, 1, -2.7).horizon >= -2.65 - 1e-9, 'a solid below the view still leaves a strip of floor');
});
