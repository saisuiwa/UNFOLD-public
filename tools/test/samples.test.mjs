import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, checkSource } from '../../app/method-guard.js';
import { NEW_METHOD_SOURCE, SAMPLES, aiTemplate } from '../../app/method-samples.js';

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
