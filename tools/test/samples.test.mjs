import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, checkSource } from '../../app/method-guard.js';
import { NEW_METHOD_SOURCE, SAMPLES, SAMPLE_GROUPS, aiTemplate } from '../../app/method-samples.js';

test('every sample and the starter code pass the guard', () => {
  for (const s of [...SAMPLES, { key: 'starter', source: NEW_METHOD_SOURCE }]) {
    assert.deepEqual(checkSource(s.source).errors, [], s.key);
  }
});

test('samples have a key, a name and a one-character symbol', () => {
  assert.ok(SAMPLES.length >= 4);
  assert.equal(new Set(SAMPLES.map(s => s.key)).size, SAMPLES.length);
  for (const s of SAMPLES) assert.ok(s.key && s.name && [...s.symbol].length === 1, s.key);
});

const isDay = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d);

test('every sample has a clean key, a short name, a category, a one-line explanation and a first-line comment', () => {
  const groups = SAMPLE_GROUPS.map(([key]) => key);
  assert.deepEqual(groups, ['method', 'graphic']);
  for (const s of SAMPLES) {
    assert.match(s.key, /^[a-z][a-z0-9-]*$/, s.key);
    assert.ok(s.name.length >= 2 && s.name.length <= 12, `${s.key}: name`);
    assert.ok(groups.includes(s.category), `${s.key}: category`);
    assert.ok(s.desc.length >= 10 && s.desc.length <= 60 && s.desc.endsWith('。'), `${s.key}: desc`);
    assert.ok(isDay(s.added), `${s.key}: added is a real day (YYYY-MM-DD)`);
    assert.ok(s.source.startsWith('//'), `${s.key}: the first line is a comment`);
    assert.ok(/vec3 userMethod\(vec2 p, float amount\)/.test(s.source), `${s.key}: signature`);
  }
  for (const field of ['key', 'name', 'desc', 'source']) assert.equal(new Set(SAMPLES.map(s => s[field])).size, SAMPLES.length, `${field} is unique`);
});

test('the AI template carries the rules and the tools', () => {
  const text = aiTemplate();
  const parts = ['vec3 userMethod(vec2 p, float amount)', String(LIMITS.maxChars), String(LIMITS.maxLoop), String(LIMITS.loopBudget),
    'while', 'discard', 'hash(', 'rot(', 'partC()', 'ph(', 'cell', 'uTime', 'gKind', 'gAlpha', 'gGlow', 'gLocal', 'コードブロック'];
  for (const part of parts) assert.ok(text.includes(part), part);
});


test('workbench presets include petals, vortex and depth-pop', () => {
  for (const key of ['petals', 'vortex', 'depth-pop']) {
    const preset = SAMPLES.find(s => s.key === key);
    assert.ok(preset, `Missing workbench preset: ${key}`);
    assert.equal(checkSource(preset.source).ok, true, key);
  }
});
