import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../app/method-registry.js';
import { createPersistence } from '../../app/method-library.js';
import { registerBundledImageMethods, bundledImageMethodIds, bundledMethodIds, BUNDLED_GLSL_PICKS, BUNDLED_IMAGE_PICKS, BUNDLED_EXAMPLE_PICKS } from '../../app/bundled-image-methods.js';
import { checkSource } from '../../app/method-guard.js';
import { SAMPLES } from '../../app/method-samples.js';
import { SURFACE_METHOD_PRESETS } from '../../app/image-surface-presets.js';
import { collectMethods, usedMethodIds } from '../../app/method-project.js';

const reset = () => { for (const c of R.listCustom()) R.unregisterCustom(c.id); };
const fakeStore = () => {
  const rows = new Map(), log = [];
  return { rows, log, async list() { return [...rows.values()]; }, async put(r) { log.push(['put', r.id]); rows.set(r.id, { ...r }); }, async delete(id) { log.push(['delete', id]); rows.delete(id); } };
};

test('the surface pack is registered under fixed ids, usable, flagged as bundled, with its own caption', () => {
  reset();
  registerBundledImageMethods();
  const ids = bundledImageMethodIds();
  assert.equal(ids.length, SURFACE_METHOD_PRESETS.length + BUNDLED_IMAGE_PICKS.length + BUNDLED_EXAMPLE_PICKS.length, 'every pick was found');
  assert.equal(bundledMethodIds().length, ids.length + BUNDLED_GLSL_PICKS.length);
  assert.ok(ids.includes('im-surface-burn') && ids.includes('im-surface-electric'));
  for (const id of ids) {
    const c = R.getCustom(id);
    assert.ok(c, id);
    assert.equal(c.status, 'ok'); assert.equal(c.bundled, true); assert.equal(R.isBundled(id), true);
    assert.ok(R.isUsable(id) && R.isImageMethodKey(id) && c.code?.source, id);
    assert.ok(R.methodIcon(id)[1].length > 0 && R.methodIcon(id)[1] !== 'JS · PHYSICS' && R.methodIcon(id)[1] !== 'CUSTOM', `${id} has its own caption`);
  }
  assert.equal(R.methodLabel('im-surface-burn'), '焦げ穴と炎');
  assert.equal(R.methodLabel('im-surface-electric'), '電撃で消失');
  // the built-in 絵の具が垂れる is another method: no two tiles may carry the same name
  const names = [...R.BUILTIN_METHODS.map(m => m[1]), ...ids.map(id => R.methodLabel(id))];
  assert.equal(new Set(names).size, names.length, 'duplicate method names');
  reset();
});

test('the bundled GLSL methods are the samples that are not a built-in method, and each passes the editor\'s own check', () => {
  reset();
  registerBundledImageMethods();
  const builtin = new Set(R.BUILTIN_METHODS.map(m => m[0]));
  for (const [key] of BUNDLED_GLSL_PICKS) {
    assert.ok(!builtin.has(key), key + ' is already a built-in method');
    const sample = SAMPLES.find(s => s.key === key);
    assert.ok(sample, key);
    const id = R.CUSTOM_PREFIX + 'b-' + key, c = R.getCustom(id);
    assert.ok(c && c.bundled && c.status === 'ok' && c.vertex === sample.source && !c.code, id);
    assert.equal(checkSource(c.vertex).ok, true, key);
    assert.ok(R.methodIcon(id)[1] && R.methodIcon(id)[1] !== 'CUSTOM', id + ' has its own caption');
  }
  reset();
});

test('registering twice changes nothing but the revision (the page may do it again)', () => {
  reset();
  registerBundledImageMethods(); registerBundledImageMethods();
  assert.equal(R.listCustom().length, bundledMethodIds().length);
  reset();
});

test('bundled methods are never written to the library, and removing a user method still works beside them', async () => {
  reset();
  const store = fakeStore();
  const p = createPersistence({ store });
  registerBundledImageMethods();
  await p.load();
  p.start();
  R.registerCustom({ id: 'cm-user', name: 'mine', vertex: 'vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }' });
  R.setCustomStatus('im-surface-burn', 'disabled', 'slow');          // a status change of a bundled one is not saved either
  await p.flush();
  assert.deepEqual(store.log.map(x => x[1]), ['cm-user']);
  assert.deepEqual([...store.rows.keys()], ['cm-user']);
  R.unregisterCustom('cm-user');
  await p.flush();
  assert.deepEqual([...store.rows.keys()], []);
  p.stop(); reset();
});

test('a project that uses a bundled method carries its code, like any custom method', () => {
  reset();
  registerBundledImageMethods();
  const transitions = [{ method: 'im-surface-burn', method2: '' }, { method: 'crumple', method2: 'im-surface-electric' }];
  assert.deepEqual(usedMethodIds(transitions).sort(), ['im-surface-burn', 'im-surface-electric']);
  const out = collectMethods(transitions, R.getCustom);
  assert.equal(out.length, 2);
  assert.ok(out.every(m => m.engine === 'image-js' && m.code?.source));
  reset();
});
