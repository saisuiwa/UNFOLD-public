import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeTargetGLSL } from '../../app/shape-target.js';

// GLSL's pow(x, y) is undefined for x < 0. The heart used pow(sin(a), 3.): on software GL (and any GPU that returns NaN there)
// the half of the heart where sin(a) < 0 was not drawn. Found 2026-11-15 while recording with the test browser.
test('the shape formulas never raise a value that can be negative with pow()', () => {
  const code = shapeTargetGLSL.replace(/\/\/[^\n]*/g, '');   // without the comments
  const calls = [...code.matchAll(/pow\(([^,]+),/g)].map(m => m[1].trim());
  for (const base of calls) assert.ok(/^(abs\(|max\(|length\(|[0-9.]+$)/.test(base), `pow(${base}, …) may get a negative base`);
  assert.ok(calls.length >= 1 && !/pow\(sin/.test(code));
});

test('the heart is the same on both sides: x mirrors with the angle, y does not change', () => {
  // the same formula in JavaScript, read from the shader's text so the two cannot drift apart silently
  assert.match(shapeTargetGLSL, /float sa=sin\(a\);\s*vec2 h=vec2\(16\.\*sa\*sa\*sa,13\.\*cos\(a\)-5\.\*cos\(2\.\*a\)-2\.\*cos\(3\.\*a\)-cos\(4\.\*a\)\)\/17\.;/);
  const heart = a => [16 * Math.sin(a) ** 3 / 17, (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17];
  for (const a of [.3, 1.1, 2.4]) { const [x1, y1] = heart(a), [x2, y2] = heart(-a); assert.ok(Math.abs(x1 + x2) < 1e-12 && Math.abs(y1 - y2) < 1e-12 && x2 < 0, 'the left side is there'); }
});
