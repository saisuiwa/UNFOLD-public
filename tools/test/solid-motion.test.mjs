import test from 'node:test';
import assert from 'node:assert/strict';
import {SOLID_MOTIONS, cleanSolidMotion, solidMotionAt, pickSolidMotion, suggestSolidMotions} from '../../app/solid-motion.js';
import {cleanShot} from '../../app/shot-motion.js';

const ids = SOLID_MOTIONS.map(([id]) => id);
const close = (a, b, eps = 1e-9) => a.every((x, i) => Math.abs(x - b[i]) < eps);

test('a stored motion is cleaned: unknown kinds become none, the amount stays in 0.2–2', () => {
  assert.deepEqual(cleanSolidMotion(), {kind: 'none', amount: 1});
  assert.deepEqual(cleanSolidMotion({kind: 'hax', amount: 99}), {kind: 'none', amount: 2});
  assert.deepEqual(cleanSolidMotion({kind: 'sway', amount: NaN}), {kind: 'sway', amount: 1});
  assert.deepEqual(cleanSolidMotion({kind: 'hop', amount: 0}), {kind: 'hop', amount: 0.2});
});

test('the shot settings carry the motion, and old shots without one mean no motion', () => {
  assert.deepEqual(cleanShot().motion, {kind: 'none', amount: 1});
  assert.deepEqual(cleanShot({rotation: {enabled: true}}).motion, {kind: 'none', amount: 1});
  assert.deepEqual(cleanShot({motion: {kind: 'float', amount: 1.5}}).motion, {kind: 'float', amount: 1.5});
});

test('no motion, or no solid yet, leaves the solid exactly where it was', () => {
  assert.equal(solidMotionAt({kind: 'none'}, 3, .5, 1), null);
  for (const id of ids) assert.equal(solidMotionAt({kind: id}, 3.3, .5, 0), null, id);
});

test('every motion gives a finite pose at any time and weight, with a unit quaternion and a positive scale', () => {
  for (const id of ids) for (const sec of [0, .13, 1, 2.77, 9.9]) for (const w of [.3, 1]) {
    const p = solidMotionAt({kind: id, amount: 2}, sec, .5, w);
    assert.ok(p, id);
    for (const x of [...p.quaternion, ...p.position, ...p.scale]) assert.ok(Number.isFinite(x), `${id} ${sec}`);
    assert.ok(Math.abs(Math.hypot(...p.quaternion) - 1) < 1e-9, `${id} quaternion`);
    assert.ok(p.scale.every(k => k >= .3), `${id} scale`);
  }
});

test('every motion actually moves the solid somewhere in a few beats', () => {
  for (const id of ids) {
    const moved = [.1, .37, .6, 1.15, 1.9, 2.6, 3.4].some(sec => {
      const p = solidMotionAt({kind: id}, sec, .5, 1);
      return !close(p.quaternion, [0, 0, 0, 1], 1e-3) || !close(p.position, [0, 0, 0], 1e-3) || !close(p.scale, [1, 1, 1], 1e-3);
    });
    assert.ok(moved, id);
  }
});

test('a half-formed solid moves less, and the weight fades the motion out smoothly (no jump near 0)', () => {
  for (const id of ids) {
    const tiny = solidMotionAt({kind: id}, 1.37, .5, 1e-4);
    assert.ok(close(tiny.quaternion, [0, 0, 0, 1], 1e-3) && close(tiny.position, [0, 0, 0], 1e-3) && close(tiny.scale, [1, 1, 1], 1e-3), id);
  }
});

test('the rhythm follows the beat: twice the tempo, the same pose at half the time', () => {
  const a = solidMotionAt({kind: 'sway'}, 1, .5, 1), b = solidMotionAt({kind: 'sway'}, .5, .25, 1);
  assert.ok(close(a.quaternion, b.quaternion) && close(a.position, b.position));
});

test('the swing turns around the bottom: the bottom point of the solid stays put', () => {
  const p = solidMotionAt({kind: 'sway'}, .5 * .5, .5, 1);   // a quarter of the two-beat swing = the widest tilt
  const [x, y, z, w] = p.quaternion, v = [0, -1.5, 0];
  // rotate v by the quaternion, then add the shift
  const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
  const r = [v[0] + w * t[0] + (y * t[2] - z * t[1]), v[1] + w * t[1] + (z * t[0] - x * t[2]), v[2] + w * t[2] + (x * t[1] - y * t[0])];
  assert.ok(close(r.map((c, i) => c + p.position[i]), v, 1e-9));
  assert.ok(Math.abs(x) + Math.abs(y) + Math.abs(z) > .05, 'it does tilt');
});

test('🎲 picks a motion that suits the shape, never the same one twice in a row', () => {
  assert.deepEqual(suggestSolidMotions('c-ghost'), ['sway', 'float', 'flutter']);
  for (let i = 0; i < 20; i++) {
    const r = () => i / 20;
    const g = pickSolidMotion('c-ghost', 'sway', r);
    assert.ok(['float', 'flutter'].includes(g), g);
    const any = pickSolidMotion('sphere', 'hop', r);
    assert.ok(ids.includes(any) && any !== 'hop', any);
  }
  assert.ok(suggestSolidMotions('c-ghost').concat(suggestSolidMotions('c-bat'), suggestSolidMotions('heart')).every(id => ids.includes(id)));
});

test('image-code methods get the shift and size through the camera: moving the camera by M⁻¹ shows the same picture', async () => {
  const {motionCamera} = await import('../../app/solid-motion.js');
  const cam = {projection: [1], world: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, .3, -.2, 8, 1]};
  assert.equal(motionCamera(cam, null), cam);
  const m = {quaternion: [0, 0, 0, 1], position: [.5, .25, 0], scale: [2, 2, 2]};
  const out = motionCamera(cam, m).world;
  // a point p on the solid is drawn at M·p; seen from the new camera, the unmoved p must sit where M·p sits for the old one:
  // old camera space of M·p = W⁻¹·(2p + t); new camera = (M⁻¹W), its inverse W⁻¹M, so W⁻¹·M·p — the same. Check W' = M⁻¹·W numerically.
  const mul = (a, b) => Array.from({length: 16}, (_, i) => { const c = Math.floor(i / 4), r = i % 4; let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; return s; });
  const M = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, .5, .25, 0, 1];
  assert.ok(close(mul(M, out), cam.world, 1e-12));
});

test('振り向いて寄る follows the solid\'s life: sideways first, then facing you, then closer', async () => {
  const {solidLife} = await import('../../app/solid-motion.js');
  const at = life => solidMotionAt({kind: 'turnaround'}, 1, .5, 1, life);
  const yaw = q => 2 * Math.atan2(q[1], q[3]);   // the turn around the vertical axis (the other tilts are tiny)
  assert.ok(yaw(at(0).quaternion) > 1, 'sideways at the start');
  assert.ok(Math.abs(yaw(at(.5).quaternion)) < .02 && Math.abs(at(.5).scale[0] - 1) < 1e-9, 'facing you, normal size, in the middle');
  assert.ok(at(1).scale[0] > 1.25 && at(1).position[2] > .6, 'closer at the end');
  assert.equal(solidLife(.40, [.45, .60]), 0); assert.ok(Math.abs(solidLife(.525, [.45, .60]) - .5) < 1e-12); assert.equal(solidLife(.9, [.45, .60]), 1);
});
