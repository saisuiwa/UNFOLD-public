import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../app/method-registry.js';
import { createPersistence, sourceHash } from '../../app/method-library.js';

const reset = () => { for (const c of R.listCustom()) R.unregisterCustom(c.id); };
// An in-memory stand-in for the IndexedDB store: same three methods.
const fakeStore = (initial = []) => {
  const rows = new Map(initial.map(r => [r.id, { ...r }]));
  const log = [];
  return {
    rows, log,
    async list() { return [...rows.values()].map(r => ({ ...r })); },
    async put(record) { log.push(['put', record.id]); rows.set(record.id, { ...record }); },
    async delete(id) { log.push(['delete', id]); rows.delete(id); },
  };
};
const saved = (id, extra = {}) => ({ id, name: 'N', symbol: 'S', vertex: 'code', look: null, params: [], status: 'ok', reason: '', createdAt: 1000, hash: 'h', ...extra });

test('sourceHash is the SHA-256 of the code', async () => {
  assert.equal(await sourceHash('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.notEqual(await sourceHash('abc'), await sourceHash('abcd'));
});

test('load registers what was saved and writes nothing back', async () => {
  reset();
  const store = fakeStore([saved('cm-a'), saved('cm-b', { status: 'disabled', reason: '3行目: x' })]);
  const p = createPersistence({ store });
  assert.equal(await p.load(), 2);
  p.start();
  assert.equal(R.getCustom('cm-b').status, 'disabled');
  assert.equal(R.getCustom('cm-b').reason, '3行目: x');
  R.setCustomStatus('cm-a', 'ok', '');             // nothing actually changed
  await p.flush();
  assert.deepEqual(store.log, []);
  p.stop(); reset();
});

test('a new method is saved with its hash; editing it keeps createdAt', async () => {
  reset();
  const store = fakeStore();
  const p = createPersistence({ store });
  await p.load(); p.start();
  R.registerCustom({ id: 'cm-n', name: '新', symbol: '新', vertex: 'abc' });
  await p.flush();
  const first = store.rows.get('cm-n');
  assert.equal(first.hash, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.deepEqual([first.name, first.symbol, first.vertex, first.status, first.look, first.params], ['新', '新', 'abc', 'ok', null, []]);
  R.registerCustom({ id: 'cm-n', name: '新', symbol: '新', vertex: 'abcd' });
  await p.flush();
  const second = store.rows.get('cm-n');
  assert.equal(second.createdAt, first.createdAt);
  assert.notEqual(second.hash, first.hash);
  assert.deepEqual(store.log.map(l => l[0]), ['put', 'put']);
  p.stop(); reset();
});

test('a status change (for instance "disabled" after a failed compile) is saved with its reason', async () => {
  reset();
  const store = fakeStore();
  const p = createPersistence({ store });
  await p.load(); p.start();
  R.registerCustom({ id: 'cm-s', name: 'S', vertex: 'x' });
  await p.flush();
  R.setCustomStatus('cm-s', 'disabled', '3行目: boom');
  await p.flush();
  assert.deepEqual([store.rows.get('cm-s').status, store.rows.get('cm-s').reason], ['disabled', '3行目: boom']);
  p.stop(); reset();
});

test('removing a method removes it from the store', async () => {
  reset();
  const store = fakeStore([saved('cm-gone')]);
  const p = createPersistence({ store });
  await p.load(); p.start();
  R.unregisterCustom('cm-gone');
  await p.flush();
  assert.equal(store.rows.has('cm-gone'), false);
  assert.deepEqual(store.log, [['delete', 'cm-gone']]);
  p.stop(); reset();
});

test('a failed write is reported, and the next change tries again', async () => {
  reset();
  const store = fakeStore();
  const realPut = store.put;
  let calls = 0;
  store.put = async record => { if (calls++ === 0) throw new Error('disk full'); return realPut(record); };
  const errors = [];
  const p = createPersistence({ store, onError: e => errors.push(e.message) });
  await p.load(); p.start();
  R.registerCustom({ id: 'cm-f', name: 'F', vertex: 'one' });
  await p.flush();
  assert.deepEqual(errors, ['disk full']);
  assert.equal(store.rows.has('cm-f'), false);
  R.setCustomStatus('cm-f', 'ok', '');             // any later registry event brings the unsaved method up again
  await p.flush();
  assert.equal(store.rows.get('cm-f').vertex, 'one');
  p.stop(); reset();
});

test('after stop the registry can change without writes', async () => {
  reset();
  const store = fakeStore();
  const p = createPersistence({ store });
  await p.load(); p.start(); p.stop();
  R.registerCustom({ id: 'cm-z', name: 'Z', vertex: 'x' });
  await p.flush();
  assert.deepEqual(store.log, []);
  reset();
});
