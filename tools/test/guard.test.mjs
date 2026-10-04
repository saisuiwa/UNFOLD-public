import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSource, LIMITS } from '../../app/method-guard.js';
import { GOOD, HOSTILE, GUARD_PASSES_BUT_COMPILE_FAILS } from './fixtures/methods.mjs';

for (const [name, src] of Object.entries(GOOD)) {
  test(`good: ${name} passes`, () => {
    const result = checkSource(src);
    assert.deepEqual(result.errors, []);
    assert.equal(result.ok, true);
  });
}

for (const [name, { src, error }] of Object.entries(HOSTILE)) {
  test(`hostile: ${name} is stopped`, () => {
    const result = checkSource(src);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(e => e.message.includes(error)), `expected a message with "${error}", got ${JSON.stringify(result.errors)}`);
  });
}

for (const [name, src] of Object.entries(GUARD_PASSES_BUT_COMPILE_FAILS)) {
  test(`the guard is only a text check: ${name} passes (the GPU compile catches it)`, () => {
    assert.equal(checkSource(src).ok, true);
  });
}

test('errors carry the line number', () => {
  const result = checkSource(`vec3 userMethod(vec2 p, float amount) {\n  vec2 q = p;\n  discard;\n  return vec3(q, 0.);\n}`);
  assert.equal(result.errors[0].line, 3);
});

test('loops are counted: sum of how often each loop body runs', () => {
  assert.equal(checkSource(GOOD.loopAndHelper).loops, 24);
  assert.equal(checkSource(HOSTILE.nestedTooMany.src).loops, 16 + 16 * 16);
});

test('limits are the ones in the design', () => {
  assert.deepEqual(LIMITS, { maxChars: 8000, maxLoop: 64, loopBudget: 256 });
});
