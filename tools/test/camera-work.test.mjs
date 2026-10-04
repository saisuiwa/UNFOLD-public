import test from 'node:test';
import assert from 'node:assert/strict';
import { CAM_PRESETS, CAM_RANGES, camEnds, camLife, camValues, cleanCam, easeP, legacyKenBurns, lifeProgress, mixCam } from '../../app/camera-work.js';

test('every ease starts at 0, ends at 1 and never goes back', () => {
  for (const e of ['smooth', 'out', 'in', 'linear', undefined, 'nonsense']) {
    assert.equal(easeP(e, 0), 0);
    assert.equal(easeP(e, 1), 1);
    assert.equal(easeP(e, -3), 0);
    assert.equal(easeP(e, 9), 1);
    let last = 0;
    for (let p = 0; p <= 1; p += 0.05) { const v = easeP(e, p); assert.ok(v >= last - 1e-12); last = v; }
  }
  assert.ok(easeP('out', 0.3) > easeP('smooth', 0.3), '"out" is quick at the start');
  assert.ok(easeP('in', 0.3) < easeP('smooth', 0.3), '"in" is slow at the start');
});

test('cleanCam keeps known channels inside their ranges and drops the rest', () => {
  assert.equal(cleanCam(undefined), undefined);
  assert.equal(cleanCam(null), undefined);
  assert.equal(cleanCam([1, 2]), undefined);
  assert.equal(cleanCam('zoom'), undefined);
  assert.equal(cleanCam({}), undefined);
  assert.equal(cleanCam({ zoom: 2 }), undefined, 'a channel must be [from, to]');
  assert.equal(cleanCam({ zoom: [1, 'x'] }), undefined);
  assert.equal(cleanCam({ zoom: [1, NaN] }), undefined);
  assert.equal(cleanCam({ zoom: [1, 2, 3] }), undefined);
  assert.deepEqual(cleanCam({ zoom: [9, 0], x: [-5, 5], y: [0.1, 0.2], roll: [-99, 99] }), { zoom: [4, 0.5], x: [-1, 1], y: [0.1, 0.2], roll: [-30, 30] });
  assert.deepEqual(cleanCam({ zoom: [2.2, 1], ease: 'out', sec: 1.6, evil: 1, __proto__: { x: [1, 1] } }), { zoom: [2.2, 1], ease: 'out', sec: 1.6 });
  assert.deepEqual(cleanCam({ zoom: [1, 1.2], ease: 'smooth' }), { zoom: [1, 1.2] }, 'the default ease is not stored');
  assert.deepEqual(cleanCam({ zoom: [1, 1.2], ease: 'bounce', sec: -1 }), { zoom: [1, 1.2] });
  assert.deepEqual(cleanCam({ zoom: [1, 1.2], sec: 1e9 }), { zoom: [1, 1.2], sec: 60 });
});

test('cleanCam returns a fresh object', () => {
  const raw = { zoom: [1, 2] };
  const out = cleanCam(raw);
  out.zoom[0] = 3;
  assert.deepEqual(raw.zoom, [1, 2]);
});

test('camValues: ends are exact, channels not set stay neutral', () => {
  const cam = { zoom: [2.2, 1], ease: 'out' };
  assert.deepEqual(camValues(cam, 0), { zoom: 2.2, x: 0, y: 0, roll: 0 });
  assert.deepEqual(camValues(cam, 1), { zoom: 1, x: 0, y: 0, roll: 0 });
  const mid = camValues(cam, 0.5);
  assert.ok(mid.zoom < 1.5 && mid.zoom > 1, 'an ease-out zoom-out is mostly done by the middle');
  assert.deepEqual(camValues(undefined, 0.5), { zoom: 1, x: 0, y: 0, roll: 0 });
  assert.deepEqual(camValues({ x: [-0.1, 0.1] }, 0.5), { zoom: 1, x: 0, y: 0, roll: 0 });
});

test('camEnds shows the neutral value twice for a channel that is not set', () => {
  assert.deepEqual(camEnds({ zoom: [2, 1] }, 'zoom'), [2, 1]);
  assert.deepEqual(camEnds({ zoom: [2, 1] }, 'roll'), [0, 0]);
  assert.deepEqual(camEnds(undefined, 'zoom'), [1, 1]);
});

test('every preset is a valid camera that survives cleanCam unchanged', () => {
  assert.ok(CAM_PRESETS.length >= 8);
  for (const [name, cam] of CAM_PRESETS) {
    assert.ok(name);
    assert.deepEqual(cleanCam(cam), cam, name);
  }
  const reveal = CAM_PRESETS.find(([n]) => /ドンと引く/.test(n))[1];
  assert.ok(reveal.zoom[0] > 2 && reveal.zoom[1] === 1, 'the zoom-out reveal starts past the edges and ends at the normal size');
});

test('legacyKenBurns keeps the numbers the sequence always had', () => {
  // picture 0 zooms in, picture 1 out; the drift flips sign every two pictures
  assert.deepEqual(legacyKenBurns(0, 0, 1), { zoom: 1, x: -0.09 });
  assert.deepEqual(legacyKenBurns(0, 1, 1), { zoom: 1.12, x: 0.09 });
  assert.deepEqual(legacyKenBurns(1, 0, 1), { zoom: 1.12, x: -0.09 });
  assert.deepEqual(legacyKenBurns(1, 1, 1), { zoom: 1, x: 0.09 });
  assert.deepEqual(legacyKenBurns(2, 0, 1), { zoom: 1, x: 0.09 });
  assert.deepEqual(legacyKenBurns(3, 1, 1), { zoom: 1, x: -0.09 });
  const k = legacyKenBurns(0, 0.5, 0.7);
  assert.ok(Math.abs(k.zoom - (1 + 0.7 * 0.12 * 0.5)) < 1e-12);
  assert.equal(k.x, 0);
  const off = legacyKenBurns(5, 0.3, 0);
  assert.equal(off.zoom, 1);
  assert.ok(off.x === 0, 'with the global amount at 0 nothing moves');   // (-0 counts)
});

const lay = { transitions: [{ start: 4, end: 8 }, { start: 8, end: 12 }, { start: 14, end: 18 }], total: 20 };
test('camLife: arrives in the middle of the ◆ before, leaves a little into the ◆ after', () => {
  const trs = [{ shape: 'heart' }, { shape: 'none' }, { shape: 'star' }];
  assert.deepEqual(camLife(0, 4, lay, trs), { arrive: 0, leave: 4 + 4 * 0.3 });
  assert.deepEqual(camLife(1, 4, lay, trs), { arrive: 6, leave: 8 + 4 * 0.3 });
  assert.deepEqual(camLife(3, 4, lay, trs), { arrive: 16, leave: 20 });
});

test('camLife: a ◆ that keeps the solid the first picture (lateSwap) delivers the next picture later', () => {
  const late = [{ shape: 'heart', lateSwap: true }, { shape: 'none', lateSwap: true }, { shape: 'star' }];
  assert.ok(Math.abs(camLife(1, 4, lay, late).arrive - (4 + 4 * 0.76)) < 1e-12);
  assert.equal(camLife(2, 4, lay, late).arrive, 10, 'a ◆ without a solid ignores lateSwap');
  assert.equal(lay.transitions.length, 3);
});

test('lifeProgress: 0 on arrival, 1 when it leaves, sec shortens the move', () => {
  const life = { arrive: 10, leave: 14 };
  assert.equal(lifeProgress(9, life), 0);
  assert.equal(lifeProgress(10, life), 0);
  assert.equal(lifeProgress(12, life), 0.5);
  assert.equal(lifeProgress(14, life), 1);
  assert.equal(lifeProgress(99, life), 1);
  assert.equal(lifeProgress(11, life, { sec: 2 }), 0.5);
  assert.equal(lifeProgress(13, life, { sec: 2 }), 1, 'the move is over after sec seconds');
  assert.equal(lifeProgress(5, { arrive: 5, leave: 5 }), 1, 'a picture that is not on screen at all is simply at the end');
});

test('mixCam blends every channel and the ends are exact', () => {
  const a = { zoom: 1, x: 0, y: 0, roll: 0 }, b = { zoom: 2, x: 0.2, y: -0.2, roll: 4 };
  assert.deepEqual(mixCam(a, b, 0), a);
  assert.deepEqual(mixCam(a, b, 1), b);
  assert.deepEqual(mixCam(a, b, 0.5), { zoom: 1.5, x: 0.1, y: -0.1, roll: 2 });
  assert.equal(Object.keys(CAM_RANGES).length, 4);
});
