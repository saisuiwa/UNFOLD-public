import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUILTIN_KEYS, CUSTOM_PREFIX } from '../../app/method-registry.js';
import { GRAIN_METHODS, SMOOTH_METHODS, TILE_METHODS, grainReaches, grainSequenceNote, grainSingleNote, tileSequenceNote, tileSingleNote, tilesReach, usesGrain, usesTiles } from '../../app/slider-notes.js';

// the shader is the truth: which built-in methods follow the grain (partC()) or the tiles (unfoldTileC()) is read from each branch of breakAt
function branches() {
  const src = readFileSync(new URL('../../app/motion.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('vec3 breakAt('), src.indexOf('void main()'));
  const marks = [...body.matchAll(/(?:if|else if)\(m<(\d*\.?\d+)\)\{/g)].map(m => ({ at: m.index, id: Math.round(Number(m[1]) - .5) }));
  marks.push({ at: body.indexOf('}else{'), id: marks.length });   // the last method (line) is the plain else
  assert.equal(marks.length, BUILTIN_KEYS.length);
  return marks.map((m, i) => ({ key: BUILTIN_KEYS[m.id], code: body.slice(m.at, i + 1 < marks.length ? marks[i + 1].at : body.length) }));
}

test('GRAIN_METHODS / TILE_METHODS / SMOOTH_METHODS match what each shader branch uses, and cover all 37 once', () => {
  const grain = [], tile = [], smooth = [];
  for (const { key, code } of branches()) {
    const g = /partC\(\)/.test(code), t = /unfoldTileC\(\)/.test(code);
    assert.ok(!(g && t), `${key} uses both`);
    (g ? grain : t ? tile : smooth).push(key);
  }
  assert.deepEqual(grain.sort(), [...GRAIN_METHODS].sort());
  assert.deepEqual(tile.sort(), [...TILE_METHODS].sort());
  assert.deepEqual(smooth.sort(), [...SMOOTH_METHODS].sort());
  assert.equal(GRAIN_METHODS.length + TILE_METHODS.length + SMOOTH_METHODS.length, 37);
});

test('the shader never reads the raw 16×16 cell inside a method branch any more (tiles go through unfoldTileC)', () => {
  for (const { key, code } of branches()) assert.doesNotMatch(code, /\bcell\b/, key);
});

test('usesGrain / usesTiles: custom methods may use grain (partC) but never the tiles', () => {
  assert.equal(usesGrain('dust'), true);
  assert.equal(usesGrain(CUSTOM_PREFIX + 'abc'), true);
  assert.equal(usesTiles(CUSTOM_PREFIX + 'abc'), false);
  for (const k of ['crumple', 'twist', 'wave', 'ripple', 'line']) { assert.equal(usesGrain(k), false, k); assert.equal(usesTiles(k), false, k); }
  for (const k of ['scatter', 'shatter', 'glitch']) { assert.equal(usesTiles(k), true, k); assert.equal(usesGrain(k), false, k); }
});

test('grainReaches needs a grain method (either of the two) and a fine shape; tilesReach needs only a tile method', () => {
  assert.equal(grainReaches({ method: 'dust', shapeHasGrain: true }), true);
  assert.equal(grainReaches({ method: 'scatter', method2: 'snow', shapeHasGrain: true }), true);
  assert.equal(grainReaches({ method: 'dust', shapeHasGrain: false }), false);
  assert.equal(tilesReach({ method: 'shatter' }), true);
  assert.equal(tilesReach({ method: 'crumple', method2: 'flip' }), true);
  assert.equal(tilesReach({ method: 'dust' }), false);
});

test('grainSequenceNote: counts ◆, says whether the method or the shape is the reason', () => {
  const glb = { shapeHasGrain: true }, preset = { shapeHasGrain: false };
  let n = grainSequenceNote([{ method: 'dust', ...glb }, { method: 'crumple', ...glb }, { method: 'snow', ...preset }]);
  assert.deepEqual([n.reach, n.total], [1, 3]);
  assert.match(n.text, /3個のうち1個/);
  n = grainSequenceNote([{ method: 'crumple', ...glb }]);
  assert.match(n.text, /粒で崩す方法/);
  assert.match(n.text, /タイルの細かさ/);          // points at the other slider
  n = grainSequenceNote([{ method: 'dust', ...preset }]);
  assert.match(n.text, /面の細かい形/);
  assert.equal(grainSequenceNote([]).total, 0);
});

test('tileSequenceNote: counts ◆ and shows the current tile count', () => {
  let n = tileSequenceNote([{ method: 'shatter' }, { method: 'dust' }, { method: 'crumple', method2: 'flip' }], .5);
  assert.deepEqual([n.reach, n.total], [2, 3]);
  assert.match(n.text, /3個のうち2個/);
  assert.match(n.text, /タイル 16×16・標準/);
  assert.match(tileSequenceNote([{ method: 'shatter' }], 0).text, /タイル 4×4）/);
  assert.match(tileSequenceNote([{ method: 'shatter' }], 1).text, /タイル 64×64）/);
  n = tileSequenceNote([{ method: 'crumple' }, { method: 'dust' }], .5);
  assert.equal(n.reach, 0);
  assert.match(n.text, /粒の細かさ/);              // points at the other slider
});

test('single-picture notes name the method', () => {
  assert.match(grainSingleNote({ method: 'crumple', shapeHasGrain: true }).text, /くしゃくしゃ.*効きません/);
  assert.equal(grainSingleNote({ method: 'dust', shapeHasGrain: true }).reach, 1);
  assert.equal(grainSingleNote({ method: 'dust', shapeHasGrain: false }).reach, 0);
  assert.match(tileSingleNote({ method: 'crumple' }, .5).text, /くしゃくしゃ.*効きません/);
  assert.match(tileSingleNote({ method: 'scatter' }, .25).text, /ばらばら.*に効きます（タイル 8×8）/);
});
