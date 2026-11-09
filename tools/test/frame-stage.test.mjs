import test from 'node:test';
import assert from 'node:assert/strict';
import { FRAME_STYLES, FRAME_TILTS, PERSON_MOVES, cleanFrameStage, borderOf, frameZoom, personOut, solidPop, tiltAt, pickTilt, personPose, pickPersonMove, solidShift } from '../../app/frame-stage.js';
import { bestOffset } from '../../app/cutout-align.js';

test('the frame settings are cleaned: off by default, a known style, pop 0–1, size 0.5–0.95', () => {
  assert.deepEqual(cleanFrameStage(), { enabled: false, style: 'gold', pop: .4, size: .78, tilt: 'none', tiltAmount: .5, personMove: 'pop', solidX: 0, solidY: 0 });
  assert.deepEqual(cleanFrameStage({ enabled: 'yes', style: 'neon', pop: 3, size: .1, tilt: 'spin', tiltAmount: 9 }), { enabled: false, style: 'gold', pop: 1, size: .5, tilt: 'none', tiltAmount: 1, personMove: 'pop', solidX: 0, solidY: 0 });
  assert.deepEqual(cleanFrameStage({ enabled: true, style: 'wood', pop: .25, size: .9, tilt: 'orbit', tiltAmount: .3, personMove: 'nudge', solidX: .6, solidY: -2 }), { enabled: true, style: 'wood', pop: .25, size: .9, tilt: 'orbit', tiltAmount: .3, personMove: 'nudge', solidX: .6, solidY: -1 });
  assert.deepEqual(FRAME_STYLES.map(([id]) => id), ['gold', 'wood', 'black', 'white']);
});

test('the whole frame fits the view at the chosen size', () => {
  const w = 6.5, h = 3.65;
  for (const [style] of FRAME_STYLES) for (const size of [.5, .78, .95]) {
    const z = frameZoom(9.6, 5.4, w, h, style, size), b = borderOf(style, w, h);
    assert.ok((w + 2 * b) * z <= 9.6 * size + 1e-9 && (h + 2 * b) * z <= 5.4 * size + 1e-9, `${style} ${size}`);
    assert.ok(Math.abs(Math.max((w + 2 * b) * z / 9.6, (h + 2 * b) * z / 5.4) - size) < 1e-9, `${style} ${size} touches one side`);
  }
});

test('the person is in the picture while it is whole, out while it is broken or a solid, and back at the end', () => {
  assert.equal(personOut(0, 0), 0);
  assert.equal(personOut(1, 0), 1);
  assert.equal(personOut(0, 1), 1);
  assert.ok(personOut(.2, 0) > 0 && personOut(.2, 0) < 1);
  let last = 0;
  for (let d = 0; d <= 1.0001; d += .05) { const v = personOut(d, 0); assert.ok(v >= last - 1e-12); last = v; }
});

test('the solid grows past the frame only as it forms', () => {
  assert.equal(solidPop(.4, 0), 1);
  assert.equal(solidPop(.4, 1), 1.4);
  assert.equal(solidPop(0, 1), 1);
});

test('a cut-out is found where it was cut from the picture (MOTION LAB\'s search)', () => {
  const aw = 60, ah = 40, a = new Uint8ClampedArray(aw * ah * 4);
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) { const i = (y * aw + x) * 4; a[i] = x * 4; a[i + 1] = y * 6; a[i + 2] = (x * y) % 255; a[i + 3] = 255; }
  const bw = 12, bh = 10, ox = 31, oy = 17, b = new Uint8ClampedArray(bw * bh * 4);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const i = (y * bw + x) * 4, j = ((y + oy) * aw + x + ox) * 4; b.set(a.subarray(j, j + 3), i); b[i + 3] = (x - 6) ** 2 + (y - 5) ** 2 < 20 ? 255 : 0; }
  const r = bestOffset(a, aw, ah, b, bw, bh);
  assert.deepEqual([r.x, r.y, r.err], [ox, oy, 0]);
});

test('the tilt is nothing while the picture is whole, turns as it changes, and the named ones turn the named way', () => {
  for (const [id] of FRAME_TILTS) for (const sec of [0, 1.3, 4.2]) assert.deepEqual(tiltAt(id, .5, sec, 0), { yaw: 0, pitch: 0 }, id);
  assert.deepEqual(tiltAt('none', 1, 2, 1), { yaw: 0, pitch: 0 });
  assert.ok(tiltAt('rightFront', .5, 0, 1).yaw > 0 && tiltAt('leftFront', .5, 0, 1).yaw < 0, 'right / left come closer');
  assert.ok(tiltAt('topBack', .5, 0, 1).pitch < 0, 'the top goes back: the camera looks from below');
  const max = id => Math.max(...Array.from({ length: 50 }, (_, i) => { const t = tiltAt(id, 1, i / 10, 1); return Math.max(Math.abs(t.yaw), Math.abs(t.pitch)); }));
  for (const [id] of FRAME_TILTS) assert.ok(max(id) <= 20 * Math.PI / 180 + 1e-9, `${id} stays within 20 degrees`);
  assert.ok(Math.abs(tiltAt('rightFront', 0, 0, 1).yaw - 6 * Math.PI / 180) < 1e-9 && Math.abs(tiltAt('rightFront', 1, 0, 1).yaw - 20 * Math.PI / 180) < 1e-9, '6–20 degrees');
});

test('🎲 picks a tilt that is not the current one, never なし', () => {
  for (let i = 0; i < 20; i++) { const t = pickTilt('sway', () => i / 20); assert.ok(t !== 'sway' && t !== 'none' && FRAME_TILTS.some(([id]) => id === t), t); }
});

test('the person lands exactly on the picture with every move, and each move does what it says', () => {
  const still = { s: 1, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
  for (const [id] of PERSON_MOVES) for (const hold of [0, .4, 1]) for (const sec of [0, 2.7]) assert.deepEqual(personPose(id, 0, hold, sec, { yaw: .3, pitch: -.1 }), still, id);
  const tilt = { yaw: .2, pitch: 0 };
  assert.ok(personPose('counter', 1, .5, 0, tilt).ry > 0 && personPose('counter', 1, .5, 0, tilt).x < personPose('pop', 1, .5, 0, tilt).x, '額縁と逆に動く: turned past the camera, shifted against it');
  assert.ok(personPose('forward', 1, 1).z > personPose('forward', 1, 0).z && personPose('forward', 1, 1).s > personPose('forward', 1, 0).s, 'ゆっくり前へ: closer and bigger as time goes on');
  assert.ok(personPose('nudge', 1, .2).z > personPose('nudge', 1, 1).z && personPose('nudge', 1, 1).z > 0, '前に出て、少し下がる: out first, then back a little (still out)');
  const f = [0, 1, 2, 3].map(sec => personPose('float', 1, .5, sec).y);
  assert.ok(new Set(f.map(v => v.toFixed(4))).size > 2, 'ふわふわ漂う moves over time');
  for (const [id] of PERSON_MOVES) for (const hold of [0, .5, 1]) { const p = personPose(id, 1, hold, 1.3, tilt); assert.ok(p.s >= 1 && p.s <= 1.5 && p.z >= 0 && p.z <= .6, `${id} stays a sensible size (${p.s.toFixed(2)}, z ${p.z.toFixed(2)})`); }
});

test('🎲 for the person picks another move', () => {
  for (let i = 0; i < 20; i++) { const m = pickPersonMove('pop', () => i / 20); assert.ok(m !== 'pop' && PERSON_MOVES.some(([id]) => id === m), m); }
});

test('the solid moves aside only as it forms, up to half the picture', () => {
  assert.ok(solidShift(.8, -.5, 6, 4, 0).every(v => v === 0), 'not moved while the picture is whole');
  assert.deepEqual(solidShift(1, -1, 6, 4, 1), [3, -2, 0]);
  assert.deepEqual(solidShift(.5, 0, 6, 4, .5), [.75, 0, 0]);
});
