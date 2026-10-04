import test from 'node:test';
import assert from 'node:assert/strict';
import { modelLayout } from '../../app/model-layout.js';
import * as before from '../../archive/app-before-ordered-glb-2026-10-03/model-layout.js';

// a small bumpy "sphere" of triangles, in a scrambled order
function sphereTriangles(n = 40) {
  const tris = [];
  const p = (a, b) => [Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const a0 = i / n * 2 * Math.PI, a1 = (i + 1) / n * 2 * Math.PI, b0 = (j / n - 0.5) * Math.PI, b1 = ((j + 1) / n - 0.5) * Math.PI;
    tris.push([...p(a0, b0), ...p(a1, b0), ...p(a0, b1)], [...p(a1, b0), ...p(a1, b1), ...p(a0, b1)]);
  }
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  tris.sort(() => rnd() - 0.5);
  return new Float32Array(tris.flat());
}

test('the default layout is exactly what it was before the ordered option existed', () => {
  const input = sphereTriangles();
  const a = modelLayout(input), b = before.modelLayout(input);
  assert.deepEqual(Array.from(a.target), Array.from(b.target));
  assert.deepEqual(Array.from(a.uv), Array.from(b.uv));
  assert.equal(a.triangles, b.triangles);
  assert.deepEqual(Array.from(modelLayout(input, {}).target), Array.from(b.target), 'an empty options object changes nothing');
});

test('ordered keeps every triangle (only the order changes)', () => {
  const input = sphereTriangles();
  const a = modelLayout(input), o = modelLayout(input, { ordered: true });
  assert.equal(o.triangles, a.triangles);
  const key = t => Array.from(t).map(v => v.toFixed(4)).join(',');
  const set = arr => { const m = new Map(); for (let i = 0; i < arr.length; i += 9) { const k = key(arr.slice(i, i + 9)); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const sa = set(a.target), so = set(o.target);
  assert.equal(sa.size, so.size);
  for (const [k, n] of sa) assert.equal(so.get(k), n);
});

// where each tile's triangles are (average x, y) against where the tile is in the picture
function tilePlacement(data) {
  const per = data.triangles / 256, xs = [], ys = [];
  for (let t = 0; t < 256; t++) {
    let x = 0, y = 0;
    for (let k = 0; k < per; k++) { const o = (t * per + k) * 9; x += (data.target[o] + data.target[o + 3] + data.target[o + 6]) / 3; y += (data.target[o + 1] + data.target[o + 4] + data.target[o + 7]) / 3; }
    xs.push(x / per); ys.push(y / per);
  }
  return { xs, ys };
}
const corr = (a, b) => {
  const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return sab / Math.sqrt(saa * sbb);
};

test('ordered lays the picture on by position: left stays left, bottom stays bottom; the default does not', () => {
  const input = sphereTriangles(), col = Array.from({ length: 256 }, (_, t) => t % 16), row = Array.from({ length: 256 }, (_, t) => Math.floor(t / 16));
  const o = tilePlacement(modelLayout(input, { ordered: true }));
  assert.ok(corr(col, o.xs) > 0.8, `columns ${corr(col, o.xs)}`);
  assert.ok(corr(row, o.ys) > 0.9, `rows ${corr(row, o.ys)}`);
  const d = tilePlacement(modelLayout(input));
  assert.ok(Math.abs(corr(col, d.xs)) < 0.5 && Math.abs(corr(row, d.ys)) < 0.5, 'the default is not in position order');
});
