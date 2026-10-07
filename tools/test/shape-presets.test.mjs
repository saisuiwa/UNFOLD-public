import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { presetNames, presetTargets } from '../../app/shape-presets.js';
import { existsSync } from 'node:fs';

// The old copy lives in archive/ (not in Git). Without it the comparison is skipped, like in registry.test.mjs.
const OLD = new URL('../../archive/app-before-new-shapes-2026-10-03/shape-presets.js', import.meta.url);
const before = existsSync(OLD) ? await import(OLD.href) : null;

const hash = a => createHash('sha1').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex');

test('every shape gives 16x16 tiles of 5x5 quads, all real numbers', () => {
  for (const n of presetNames) {
    const a = presetTargets(n);
    assert.equal(a.length, 16 * 16 * 25 * 6 * 3, n);
    assert.ok(a.every(Number.isFinite), n);
  }
});

test('the new shapes are there, and the old ones are still there', () => {
  for (const n of ['human', 'pegasus', 'apple', 'icecream', 'whale', 'dragon', 'flock', 'spheres']) assert.ok(presetNames.includes(n), n);
});

test('apple and ice cream are exactly what they were (same numbers as before the new shapes)', { skip: !before }, () => {
  for (const n of ['apple', 'icecream']) assert.equal(hash(presetTargets(n)), hash(before.presetTargets(n)), n);
});

const extent = a => {
  const mn = [9, 9, 9], mx = [-9, -9, -9];
  for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], a[i + k]); mx[k] = Math.max(mx[k], a[i + k]); }
  return { w: mx[0] - mn[0], h: mx[1] - mn[1], cx: (mx[0] + mn[0]) / 2, cy: (mx[1] + mn[1]) / 2 };
};

test('every shape fits the picture plane (about 5.25 x 2.95), centred', () => {
  for (const n of ['human', 'pegasus', 'whale', 'dragon', 'flock', 'spheres']) {
    const e = extent(presetTargets(n));
    assert.ok(e.w <= 5.3, `${n} width ${e.w}`);
    assert.ok(e.h <= 3.0, `${n} height ${e.h}`);
    assert.ok(Math.abs(e.cy) < 0.2, `${n} not centred up/down: ${e.cy}`);
  }
});

test('"spheres" is the shape of a 16:9 screen: 16 x 9 balls', () => {
  const e = extent(presetTargets('spheres'));
  assert.ok(Math.abs(e.w / e.h - 16 / 9) < 0.06, `ratio ${e.w / e.h}`);
});

// where each tile ends up (the average of its quads) against where the tile is in the picture
function tilePlacement(name) {
  const a = presetTargets(name), tiles = 256, per = 25 * 18, xs = [], ys = [];
  for (let t = 0; t < tiles; t++) {
    let x = 0, y = 0;
    for (let i = 0; i < 25 * 6; i++) { x += a[t * per + i * 3]; y += a[t * per + i * 3 + 1]; }
    xs.push(x / 150); ys.push(y / 150);
  }
  return { xs, ys };
}
const corr = (a, b) => {
  const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return sab / Math.sqrt(saa * sbb);
};

test('the new shapes lay the picture on by position (left stays left, bottom stays bottom)', () => {
  const col = Array.from({ length: 256 }, (_, t) => t % 16), row = Array.from({ length: 256 }, (_, t) => Math.floor(t / 16));
  for (const n of ['whale', 'dragon', 'flock', 'spheres', 'pegasus']) {
    const { xs, ys } = tilePlacement(n);
    assert.ok(corr(col, xs) > 0.65, `${n}: columns ${corr(col, xs)}`);
    assert.ok(corr(row, ys) > 0.8, `${n}: rows ${corr(row, ys)}`);
  }
});

test('the older shapes keep their scattered layout (no position order)', () => {
  const col = Array.from({ length: 256 }, (_, t) => t % 16);
  const { xs } = tilePlacement('apple');
  assert.ok(Math.abs(corr(col, xs)) < 0.5);
});
