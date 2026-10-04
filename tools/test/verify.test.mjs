import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../app/method-registry.js';
import { createEnabler, verifyMethod } from '../../app/method-verify.js';
import { GOOD, HOSTILE, GUARD_PASSES_BUT_COMPILE_FAILS } from './fixtures/methods.mjs';

const fine = { ratio: 1, heavy: false, blank: false, unchanged: false };
const deps = (over = {}) => ({ compile: async () => [], trial: async () => fine, ...over });

test('a good method passes all three checks', async () => {
  const r = await verifyMethod(GOOD.vortex, deps());
  assert.deepEqual(r, { ok: true, warnings: [] });
});

test('the text check stops it first (the GPU is not even asked)', async () => {
  let asked = 0;
  const r = await verifyMethod(HOSTILE.whileTrue.src, deps({ compile: async () => { asked++; return []; } }));
  assert.equal(r.ok, false);
  assert.equal(r.stage, 'guard');
  assert.match(r.problems[0], /while/);
  assert.equal(asked, 0);
});

test('the compile errors are told with their line', async () => {
  const r = await verifyMethod(GUARD_PASSES_BUT_COMPILE_FAILS.undeclaredName, deps({ compile: async () => [{ line: 3, message: "'undefinedThing' : undeclared identifier" }] }));
  assert.equal(r.ok, false);
  assert.equal(r.stage, 'compile');
  assert.match(r.problems[0], /^3行目: 「undefinedThing」という名前が見つかりません/);
});

test('too heavy is refused', async () => {
  const r = await verifyMethod(GOOD.vortex, deps({ trial: async () => ({ ...fine, heavy: true, ratio: 9.5 }) }));
  assert.equal(r.ok, false);
  assert.equal(r.stage, 'trial');
  assert.match(r.problems[0], /重すぎ.*9\.5倍/);
});

test('a trial that could not run is refused', async () => {
  const r = await verifyMethod(GOOD.vortex, deps({ trial: async () => ({ failed: 'boom' }) }));
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /boom/);
  const thrown = await verifyMethod(GOOD.vortex, deps({ trial: async () => { throw new Error('gpu said no'); } }));
  assert.equal(thrown.ok, false);
  assert.match(thrown.problems[0], /gpu said no/);
});

test('a compile step that throws is refused too', async () => {
  const r = await verifyMethod(GOOD.vortex, deps({ compile: async () => { throw new Error('lost'); } }));
  assert.equal(r.ok, false);
  assert.equal(r.stage, 'compile');
});

test('blank and unchanged are warnings, not refusals', async () => {
  const r = await verifyMethod(GOOD.vortex, deps({ trial: async () => ({ ...fine, blank: true, unchanged: true }) }));
  assert.equal(r.ok, true);
  assert.equal(r.warnings.length, 2);
});

// ---- the enabler: what happens to the registry
const reset = () => { for (const c of R.listCustom()) R.unregisterCustom(c.id); };
const spySafety = () => { const log = []; return { log, armVerify: id => log.push(['arm', id]), disarmVerify: id => log.push(['disarm', id]) }; };
const make = (over = {}) => {
  const notices = [], safety = spySafety();
  const enabler = createEnabler({ ...deps(), safety, notify: m => notices.push(m), ...over });
  return { enabler, notices, safety };
};
const quarantined = (id = 'cm-q', vertex = GOOD.vortex) => R.registerCustom({ id, name: id, vertex, status: 'quarantined', reason: 'ファイルから取り込みました。' });

test('enable: a method that passes becomes usable, and the mark is left and taken off around the check', async () => {
  reset(); quarantined();
  const { enabler, notices, safety } = make();
  assert.equal(await enabler.enable('cm-q'), true);
  assert.equal(R.getCustom('cm-q').status, 'ok');
  assert.equal(R.getCustom('cm-q').reason, '');
  assert.deepEqual(safety.log, [['arm', 'cm-q'], ['disarm', 'cm-q']]);
  assert.equal(notices.length, 1);
  reset();
});

test('enable: a method that fails stays unchecked, with the reason on it', async () => {
  reset(); quarantined('cm-q', HOSTILE.discardStatement.src);
  const { enabler, notices, safety } = make();
  assert.equal(await enabler.enable('cm-q'), false);
  assert.equal(R.getCustom('cm-q').status, 'quarantined');
  assert.match(R.getCustom('cm-q').reason, /確認できませんでした.*discard/);
  assert.deepEqual(safety.log, [['arm', 'cm-q'], ['disarm', 'cm-q']], 'the mark is taken off even when the check fails');
  assert.equal(notices.length, 1);
  reset();
});

test('enable: warnings are told but do not stop it', async () => {
  reset(); quarantined();
  const { enabler, notices } = make({ trial: async () => ({ ...fine, blank: true }) });
  assert.equal(await enabler.enable('cm-q'), true);
  assert.match(notices[0], /何も映っていません/);
  reset();
});

test('enable: only an unchecked method can be enabled this way', async () => {
  reset();
  R.registerCustom({ id: 'cm-ok', name: 'ok', vertex: GOOD.vortex });
  R.registerCustom({ id: 'cm-crashed', name: 'c', vertex: GOOD.vortex, status: 'crashed', reason: 'x' });
  const { enabler } = make();
  assert.equal(await enabler.enable('cm-ok'), false);
  assert.equal(await enabler.enable('cm-crashed'), false);
  assert.equal(await enabler.enable('cm-nobody'), false);
  assert.equal(R.getCustom('cm-crashed').status, 'crashed');
  reset();
});

test('enable: pressing twice does not run the checks twice at once', async () => {
  reset(); quarantined();
  let release, runs = 0;
  const gate = new Promise(r => { release = r; });
  const { enabler } = make({ compile: async () => { runs++; await gate; return []; } });
  const first = enabler.enable('cm-q'), second = enabler.enable('cm-q');
  assert.equal(await second, false);
  release();
  assert.equal(await first, true);
  assert.equal(runs, 1);
  reset();
});

test('enable: if the method was changed or removed while it was checked, nothing is switched on', async () => {
  reset(); quarantined();
  let release;
  const gate = new Promise(r => { release = r; });
  const { enabler } = make({ compile: async () => { await gate; return []; } });
  const running = enabler.enable('cm-q');
  R.registerCustom({ id: 'cm-q', name: 'q', vertex: GOOD.wave, status: 'quarantined', reason: 'changed' });   // new code: the check was of the old code
  release();
  assert.equal(await running, false);
  assert.equal(R.getCustom('cm-q').status, 'quarantined');
  reset();
});
