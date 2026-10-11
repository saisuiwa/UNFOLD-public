import test from 'node:test';
import assert from 'node:assert/strict';
import { vertexShader } from '../../app/motion.js';
import { assembleVertex, explainLog, SLOT_A, SLOT_B } from '../../app/custom-method.js';
import { GOOD, GUARD_PASSES_BUT_COMPILE_FAILS } from './fixtures/methods.mjs';

const lineOf = (text, part) => text.split('\n').findIndex(l => l.includes(part)) + 1;   // 1-based

test('slot numbers', () => {
  assert.equal(SLOT_A, 100);
  assert.equal(SLOT_B, 101);
});

test('one custom method: wrapper, dispatch, renamed entry point, markers gone', () => {
  const { source } = assembleVertex(vertexShader, { a: GOOD.vortex });
  assert.ok(source.includes('vec3 um_a_main(vec2 p, float amount)'));
  assert.ok(source.includes('vec3 um_a_run(vec2 p,float amount){'));
  assert.ok(source.includes('if(m>99.5&&m<100.5)return um_a_run(p,amount);'));
  assert.ok(!source.includes('userMethod'));
  assert.ok(!source.includes('//@CUSTOM'));
  assert.ok(source.indexOf('um_a_run(vec2') < source.indexOf('vec3 breakAt('), 'the wrapper is defined before breakAt');
  assert.ok(source.indexOf('vec3 breakAt(') < source.indexOf('return um_a_run(p,amount);'), 'the dispatch is inside breakAt');
});

test('the wrapper keeps results safe', () => {
  const { source } = assembleVertex(vertexShader, { a: GOOD.nanValue });
  for (const part of ['isnan(r)', 'isinf(r)', 'clamp(r,vec3(-8.),vec3(8.))', 'gKind=clamp(floor(gKind+.5),0.,9.)', 'smoothstep(0.,.03,amount)']) assert.ok(source.includes(part), part);
});

test('two custom methods use both slots', () => {
  const { source, map } = assembleVertex(vertexShader, { a: GOOD.vortex, b: GOOD.wave });
  assert.ok(source.includes('um_b_run') && source.includes('if(m>100.5&&m<101.5)return um_b_run(p,amount);'));
  assert.deepEqual(Object.keys(map), ['a', 'b']);
});

test('user code is inserted literally (no $-patterns of String.replace)', () => {
  const { source } = assembleVertex(vertexShader, { a: `/* $& $1 $$ */\n${GOOD.wave}` });
  assert.ok(source.includes('/* $& $1 $$ */'));
});

test('missing plug-in points are reported', () => {
  assert.throws(() => assembleVertex('void main(){}', { a: GOOD.wave }), /差し込み口/);
});

test('an error line from the GPU is turned back into a line of the user code', () => {
  const user = GUARD_PASSES_BUT_COMPILE_FAILS.undeclaredName;           // the error is on line 3 of this code
  const { source, map } = assembleVertex(vertexShader, { a: user });
  const prefix = '\n'.repeat(66);                                          // what three.js puts in front of our source (66 line breaks)
  const glLine = lineOf(source, 'undefinedThing') + 66 + 1;
  const [first] = explainLog(`ERROR: 0:${glLine}: 'undefinedThing' : undeclared identifier\n\0`, prefix, map);
  assert.deepEqual(first, { slot: 'a', line: 3, message: "'undefinedThing' : undeclared identifier" });
});

test('an error in the second method points at the second method', () => {
  const second = GUARD_PASSES_BUT_COMPILE_FAILS.undeclaredName;
  const { source, map } = assembleVertex(vertexShader, { a: GOOD.wave, b: second });
  const glLine = lineOf(source, 'undefinedThing') + 66 + 1;
  const [first] = explainLog(`ERROR: 0:${glLine}: 'undefinedThing' : undeclared identifier`, '\n'.repeat(66), map);
  assert.equal(first.slot, 'b');
  assert.equal(first.line, 3);
});

test('an error in our own wrapper has no user line', () => {
  const { source, map } = assembleVertex(vertexShader, { a: GOOD.wave });
  const glLine = lineOf(source, 'vec3 um_a_run(') + 66 + 1;
  const [first] = explainLog(`ERROR: 0:${glLine}: 'x' : boom`, '\n'.repeat(66), map);
  assert.deepEqual([first.slot, first.line], [null, null]);
});

test('lines that are not errors are skipped', () => {
  assert.deepEqual(explainLog('WARNING: 0:3: something\n\0', '\n'.repeat(66), {}), []);
  assert.deepEqual(explainLog('', '', {}), []);
  assert.deepEqual(explainLog(undefined, undefined, {}), []);
});
