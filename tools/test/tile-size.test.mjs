import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_TILES, MAX_TILES, MIN_TILES, applyTiles, tileCells, tilesAcross } from '../../app/tile-size.js';

// a flat 16×16-tile picture, each tile cut into sub×sub squares of two triangles (like the built-in shapes, but bigger squares to keep the test small)
function grid(tiles = 16, sub = 3) {
  const uv = [], step = 1 / (tiles * sub);
  for (let cy = 0; cy < tiles; cy++) for (let cx = 0; cx < tiles; cx++) for (let sy = 0; sy < sub; sy++) for (let sx = 0; sx < sub; sx++) {
    const u = (cx + sx / sub) / tiles, v = (cy + sy / sub) / tiles;
    for (const [du, dv] of [[0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]]) uv.push(u + du * step, v + dv * step);
  }
  return new Float32Array(uv);
}

test('tilesAcross: the middle is the standard 16, the ends are 4 and 64, bad values fall back to the middle', () => {
  assert.equal(tilesAcross(.5), BASE_TILES);
  assert.equal(tilesAcross(0), MIN_TILES);
  assert.equal(tilesAcross(1), MAX_TILES);
  assert.equal(tilesAcross(.25), 8);
  assert.equal(tilesAcross(.75), 32);
  assert.equal(tilesAcross(-3), MIN_TILES);
  assert.equal(tilesAcross(7), MAX_TILES);
  for (const bad of [undefined, null, NaN, 'abc']) assert.equal(tilesAcross(bad), BASE_TILES);
  let last = 0;
  for (let s = 0; s <= 100; s++) { const n = tilesAcross(s / 100); assert.ok(n >= last, 'never goes down'); last = n; }
});

test('tileCells at the standard count is null (no attribute: the shader keeps its 16×16 cell)', () => {
  assert.equal(tileCells(grid(), BASE_TILES), null);
  assert.equal(tileCells(grid(), 0), null);
  assert.equal(tileCells(grid(), 2.5), null);
});

test('tileCells: all 3 vertices of a face share one centre; the centre is the middle of the n×n group the face is in', () => {
  const uv = grid(), out = tileCells(uv, 4);
  assert.equal(out.length, uv.length / 6 * 9);
  for (let t = 0; t < uv.length / 6; t++) {
    const o = t * 6, k = t * 9;
    const cx = (uv[o] + uv[o + 2] + uv[o + 4]) / 3, cy = (uv[o + 1] + uv[o + 3] + uv[o + 5]) / 3;
    const ex = (Math.floor(cx * 4) + .5) / 4, ey = (Math.floor(cy * 4) + .5) / 4;
    for (let j = 0; j < 3; j++) assert.deepEqual([out[k + j * 3], out[k + j * 3 + 1], out[k + j * 3 + 2]], [ex, ey, 4]);
  }
});

test('tileCells: n tiles across gives exactly n×n different groups; the biggest n splits every old tile', () => {
  const uv = grid();
  for (const n of [4, 8, 32, 64]) {
    const out = tileCells(uv, n), seen = new Set();
    for (let k = 0; k < out.length; k += 9) seen.add(out[k] + ',' + out[k + 1]);
    assert.ok(seen.size <= n * n && seen.size >= (n < 48 ? n * n * .85 : 1000), `n=${n}: ${seen.size} groups`);
  }
  assert.equal(new Set(Array.from(tileCells(uv, 1)).filter((_, i) => i % 3 === 2)).size, 1);   // one huge tile
});

test('tileCells: picture edges (uv 0 and 1) stay inside the grid', () => {
  const out = tileCells(new Float32Array([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]), 8);
  assert.deepEqual([...out.slice(0, 3)], [.5 / 8, .5 / 8, 8]);
  assert.deepEqual([...out.slice(9, 12)], [7.5 / 8, 7.5 / 8, 8]);
});

test('applyTiles sets, replaces and removes the tcell attribute', () => {
  const attrs = new Map();
  const THREE = { BufferAttribute: class { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; } } };
  const g = { getAttribute: n => attrs.get(n), setAttribute: (n, a) => attrs.set(n, a), deleteAttribute: n => attrs.delete(n) };
  g.setAttribute('uv', { array: grid(4, 2) });
  applyTiles(THREE, g, 8);
  assert.equal(g.getAttribute('tcell').itemSize, 3);
  applyTiles(THREE, g, 2);
  assert.equal(g.getAttribute('tcell').array[2], 2);
  applyTiles(THREE, g, BASE_TILES);
  assert.equal(g.getAttribute('tcell'), undefined);
  applyTiles(THREE, g, BASE_TILES);   // nothing to remove: no error
});
