import test from 'node:test';
import assert from 'node:assert/strict';
import { vertexShader, fragmentShader } from '../../app/motion.js';
import * as R from '../../app/method-registry.js';
import { createVariants, compileUserMethod, SLOT_A, SLOT_B } from '../../app/custom-method.js';
import { GOOD } from './fixtures/methods.mjs';

// A stand-in for THREE.WebGLRenderer: compileAsync does nothing, and the "program" reports what `rule` says about the shader.
// rule(vertexSource) -> undefined (compiled) or a diagnostics object (failed), like three.js sets program.diagnostics.
const fakeRenderer = rule => ({
  compileAsync: async () => {},
  properties: { get: material => ({ currentProgram: { getUniforms() {}, diagnostics: rule(material.vertexShader) } }) },
});
const failing = message => ({ runnable: false, programLog: '', vertexShader: { log: `ERROR: 0:90: ${message}\n\0`, prefix: '\n'.repeat(66) } });
const tick = () => new Promise(resolve => setImmediate(resolve));
const reset = () => { for (const c of R.listCustom()) R.unregisterCustom(c.id); };
const make = (rule, extra = {}) => {
  const uniforms = { uMethod: { value: 0 } };
  const ready = [];
  const variants = createVariants({ renderer: fakeRenderer(rule), vertexShader, fragmentShader, uniforms, onReady: v => ready.push(v.state), ...extra });
  return { variants, uniforms, ready };
};

test('without custom methods the base material is used and built-in numbers are returned', () => {
  reset();
  const { variants, uniforms } = make(() => undefined);
  assert.equal(variants.base.uniforms, uniforms, 'uniforms are shared, not copied');
  assert.deepEqual({ ...variants.pick('twist', 'wave'), material: undefined }, { material: undefined, uMethod: 2, uMethod2: 3, used: [] });
  assert.equal(variants.pick('twist').material, variants.base);
  assert.equal(variants.pick('').uMethod, 0, 'no method means the default');
  assert.equal(variants.pick('nope').uMethod, 0, 'an unknown method means the default');
  variants.dispose();
});

test('a custom method is used once it has compiled; until then the default method stands in', async () => {
  reset();
  R.registerCustom({ id: 'cm-v', name: 'V', vertex: GOOD.vortex });
  const { variants, uniforms, ready } = make(() => undefined);
  const first = variants.pick('cm-v');
  assert.equal(first.material, variants.base);
  assert.equal(first.uMethod, 0, 'still compiling: the default method');
  await tick();
  const second = variants.pick('cm-v');
  assert.notEqual(second.material, variants.base);
  assert.equal(second.material.uniforms, uniforms);
  assert.equal(second.uMethod, SLOT_A);
  assert.deepEqual(ready, ['ok']);
  assert.equal(variants.pick('cm-v').material, second.material, 'cached');
  assert.equal(variants.count(), 1);
  variants.dispose();
});

test('a custom method that fails to compile is disabled with the reason, and the default method stands in', async () => {
  reset();
  R.registerCustom({ id: 'cm-bad', name: 'Bad', vertex: GOOD.vortex });
  const { variants, ready } = make(() => failing("'x' : boom"));
  variants.pick('cm-bad');
  await tick();
  assert.equal(R.getCustom('cm-bad').status, 'disabled');
  assert.match(R.getCustom('cm-bad').reason, /boom/);
  assert.deepEqual(ready, ['failed']);
  assert.equal(variants.pick('cm-bad').material, variants.base);
  assert.equal(variants.pick('cm-bad').uMethod, 0);
  assert.equal(variants.count(), 0, 'the failed shader is thrown away');
  variants.dispose();
});

test('two custom methods share one shader with both slots', async () => {
  reset();
  R.registerCustom({ id: 'cm-a', name: 'A', vertex: GOOD.vortex });
  R.registerCustom({ id: 'cm-b', name: 'B', vertex: GOOD.wave });
  const { variants } = make(() => undefined);
  variants.pick('cm-a', 'cm-b');
  await tick();
  await tick();
  const pair = variants.pick('cm-a', 'cm-b');
  assert.equal(pair.uMethod, SLOT_A);
  assert.equal(pair.uMethod2, SLOT_B);
  assert.ok(pair.material.vertexShader.includes('um_a_run') && pair.material.vertexShader.includes('um_b_run'));
  variants.pick('twist', 'cm-b');          // one custom + one built-in: a single-slot shader for cm-b
  await tick();
  const single = variants.pick('twist', 'cm-b');
  assert.deepEqual([single.uMethod, single.uMethod2], [2, SLOT_A]);
  variants.dispose();
});

test('when two custom methods do not fit together the first one is kept and the second becomes the default', async () => {
  reset();
  R.registerCustom({ id: 'cm-a', name: 'A', vertex: GOOD.vortex });
  R.registerCustom({ id: 'cm-b', name: 'B', vertex: GOOD.wave });
  // only the shader that has both methods fails (for instance because both define the same helper function)
  const { variants } = make(vs => vs.includes('um_a_run') && vs.includes('um_b_run') ? failing("'helper' : function already has a body") : undefined);
  variants.pick('cm-a');
  await tick();
  variants.pick('cm-a', 'cm-b');
  await tick();
  const result = variants.pick('cm-a', 'cm-b');
  assert.equal(result.uMethod, SLOT_A);
  assert.equal(result.uMethod2, 0, 'the second method falls back to the default');
  assert.equal(R.getCustom('cm-a').status, 'ok');
  assert.equal(R.getCustom('cm-b').status, 'ok', 'neither method is blamed for the pair');
  variants.dispose();
});

test('registering the same id again (new code) replaces the cached shader', async () => {
  reset();
  R.registerCustom({ id: 'cm-r', name: 'R', vertex: GOOD.vortex });
  const { variants } = make(() => undefined);
  variants.pick('cm-r');
  await tick();
  const before = variants.pick('cm-r').material;
  R.registerCustom({ id: 'cm-r', name: 'R', vertex: GOOD.wave });
  assert.equal(variants.count(), 1, 'the stale shader is gone, the new one is already being prepared');
  variants.pick('cm-r');
  await tick();
  const after = variants.pick('cm-r').material;
  assert.notEqual(after, before);
  assert.ok(after.vertexShader.includes('sin(p.y * 6.'), 'the new code is in the new shader');
  variants.dispose();
});

test('removing a method or setting it to quarantined takes it out of use', async () => {
  reset();
  R.registerCustom({ id: 'cm-q', name: 'Q', vertex: GOOD.vortex });
  const { variants } = make(() => undefined);
  variants.pick('cm-q');
  await tick();
  assert.equal(variants.pick('cm-q').uMethod, SLOT_A);
  R.setCustomStatus('cm-q', 'quarantined', 'test');
  assert.equal(variants.count(), 0);
  assert.equal(variants.pick('cm-q').uMethod, 0);
  variants.dispose();
});

test('a custom method is compiled as soon as it is registered, before any ◆ uses it', async () => {
  reset();
  const { variants, ready } = make(() => undefined);
  R.registerCustom({ id: 'cm-early', name: 'E', vertex: GOOD.vortex });
  assert.equal(variants.count(), 1);
  await tick();
  assert.deepEqual(ready, ['ok']);
  assert.equal(variants.pick('cm-early').uMethod, SLOT_A, 'ready when a ◆ first asks for it');
  variants.dispose();
});

test('a broken custom method is switched off right away, without being used', async () => {
  reset();
  const { variants } = make(() => failing("'x' : boom"));
  R.registerCustom({ id: 'cm-early-bad', name: 'B', vertex: GOOD.vortex });
  await tick();
  assert.equal(R.getCustom('cm-early-bad').status, 'disabled');
  assert.match(R.getCustom('cm-early-bad').reason, /boom/);
  R.setCustomStatus('cm-early-bad', 'ok', '');         // "try again": it is compiled again straight away, and fails again
  await tick();
  assert.equal(R.getCustom('cm-early-bad').status, 'disabled');
  variants.dispose();
});

test('methods that are already registered when the variants are made are prepared too', async () => {
  reset();
  R.registerCustom({ id: 'cm-before', name: 'B', vertex: GOOD.vortex });
  const { variants } = make(() => undefined);
  assert.equal(variants.count(), 1);
  await tick();
  assert.equal(variants.pick('cm-before').uMethod, SLOT_A);
  variants.dispose();
});

test('pick says which custom methods are really in use (for the safety net)', async () => {
  reset();
  R.registerCustom({ id: 'cm-u1', name: 'U1', vertex: GOOD.vortex });
  R.registerCustom({ id: 'cm-u2', name: 'U2', vertex: GOOD.wave });
  const { variants } = make(() => undefined);
  assert.deepEqual(variants.pick('twist', 'wave').used, []);
  assert.deepEqual(variants.pick('cm-u1').used, [], 'still compiling: the default method stands in, nothing custom is drawn');
  await tick();
  assert.deepEqual(variants.pick('cm-u1').used, ['cm-u1']);
  assert.deepEqual(variants.pick('twist', 'cm-u2').used, ['cm-u2']);
  variants.pick('cm-u1', 'cm-u2');
  await tick();
  assert.deepEqual(variants.pick('cm-u1', 'cm-u2').used, ['cm-u1', 'cm-u2']);
  variants.dispose();
});

test('ready() resolves when nothing is compiling any more', async () => {
  reset();
  const { variants } = make(() => undefined);
  await variants.ready();                       // nothing pending: at once
  R.registerCustom({ id: 'cm-w', name: 'W', vertex: GOOD.vortex });
  assert.equal(variants.pick('cm-w').uMethod, 0, 'compiling');
  await variants.ready();
  assert.equal(variants.pick('cm-w').uMethod, SLOT_A, 'ready after the wait');
  variants.dispose();
});

test('ready() also resolves when the shader failed', async () => {
  reset();
  const { variants } = make(() => failing("'x' : boom"));
  R.registerCustom({ id: 'cm-wf', name: 'WF', vertex: GOOD.vortex });
  await variants.ready();
  assert.equal(R.getCustom('cm-wf').status, 'disabled');
  variants.dispose();
});

test('a shader that is removed while it is still compiling is disposed only after the compile has ended', async () => {
  reset();
  let release, material = null;
  const gate = new Promise(resolve => { release = resolve; });
  // like three.js: compileAsync polls the material until its program is ready, and fails if the material was disposed in the meantime
  const renderer = {
    compileAsync: async scene => { material = scene.children[0].material; await gate; },
    properties: { get: () => ({ currentProgram: { getUniforms() {}, diagnostics: undefined } }) },
  };
  const variants = createVariants({ renderer, vertexShader, fragmentShader, uniforms: {} });
  R.registerCustom({ id: 'cm-gone-early', name: 'G', vertex: GOOD.vortex });
  assert.ok(material, 'the compile has started');
  let disposed = false;
  material.addEventListener('dispose', () => { disposed = true; });
  R.unregisterCustom('cm-gone-early');
  assert.equal(variants.count(), 0, 'the shader is out of the list at once');
  assert.equal(disposed, false, 'but it is not disposed while the compile is still going');
  release();
  await tick();
  assert.equal(disposed, true, 'disposed once the compile ended');
  variants.dispose();
});

test('disposing everything while a shader is still compiling waits for that compile too', async () => {
  reset();
  let release, material = null;
  const gate = new Promise(resolve => { release = resolve; });
  const renderer = {
    compileAsync: async scene => { material = scene.children[0].material; await gate; },
    properties: { get: () => ({ currentProgram: { getUniforms() {}, diagnostics: undefined } }) },
  };
  R.registerCustom({ id: 'cm-pending-at-end', name: 'P', vertex: GOOD.vortex });
  const variants = createVariants({ renderer, vertexShader, fragmentShader, uniforms: {} });
  let disposed = false;
  material.addEventListener('dispose', () => { disposed = true; });
  variants.dispose();
  assert.equal(disposed, false);
  release();
  await tick();
  assert.equal(disposed, true);
  reset();
});

test('after dispose the registry can change without errors', () => {
  reset();
  const { variants } = make(() => undefined);
  variants.dispose();
  assert.doesNotThrow(() => R.registerCustom({ id: 'cm-z', name: 'Z', vertex: GOOD.vortex }));
  reset();
});

test('compileUserMethod: [] when it compiles, otherwise the errors with the user line', async () => {
  assert.deepEqual(await compileUserMethod(fakeRenderer(() => undefined), { vertexShader, fragmentShader, source: GOOD.vortex }), []);
  const errors = await compileUserMethod(fakeRenderer(() => failing("'x' : boom")), { vertexShader, fragmentShader, source: GOOD.vortex });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, "'x' : boom");
  const noLog = await compileUserMethod(fakeRenderer(() => ({ runnable: false, programLog: '' })), { vertexShader, fragmentShader, source: GOOD.vortex });
  assert.equal(noLog[0].message, 'コンパイルに失敗しました。');
});
