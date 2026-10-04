import test from 'node:test';
import assert from 'node:assert/strict';
import { FLAG_KEY, createCrashFlag } from '../../app/method-crashflag.js';

const memory = () => { const data = new Map(); return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, String(v)); }, removeItem: k => { data.delete(k); } }; };

test('arming leaves a mark with the ids and the session', () => {
  const storage = memory();
  const flag = createCrashFlag({ storage, session: 'A', now: () => 1234 });
  flag.arm(['cm-1', 'cm-2']);
  assert.deepEqual(JSON.parse(storage.getItem(FLAG_KEY)), { session: 'A', at: 1234, ids: ['cm-1', 'cm-2'] });
});

test('a method that survives 30 drawn frames is wiped from the mark, and never marked again in this session', () => {
  const storage = memory();
  const flag = createCrashFlag({ storage, session: 'A' });
  flag.arm(['cm-1']);
  for (let i = 0; i < 29; i++) flag.frame();
  assert.ok(storage.getItem(FLAG_KEY), 'still marked at 29');
  flag.frame();
  assert.equal(storage.getItem(FLAG_KEY), null);
  flag.arm(['cm-1']);
  assert.equal(storage.getItem(FLAG_KEY), null, 'it already proved itself');
});

test('methods are counted separately: one that is armed later stays marked longer', () => {
  const storage = memory();
  const flag = createCrashFlag({ storage, session: 'A' });
  flag.arm(['cm-1']);
  for (let i = 0; i < 20; i++) flag.frame();
  flag.arm(['cm-2']);
  for (let i = 0; i < 10; i++) flag.frame();
  assert.deepEqual(JSON.parse(storage.getItem(FLAG_KEY)).ids, ['cm-2']);
});

test('clear (closing the page normally) wipes the mark', () => {
  const storage = memory();
  const flag = createCrashFlag({ storage, session: 'A' });
  flag.arm(['cm-1']);
  flag.clear();
  assert.equal(storage.getItem(FLAG_KEY), null);
});

test('closing a page does not wipe the mark of another session (another tab, or a crashed one)', () => {
  const storage = memory();
  createCrashFlag({ storage, session: 'OTHER' }).arm(['cm-9']);
  const closing = createCrashFlag({ storage, session: 'MINE' });
  closing.clear();
  assert.deepEqual(JSON.parse(storage.getItem(FLAG_KEY)).ids, ['cm-9']);
  closing.arm(['cm-1']);                 // ... but once this session writes its own mark, it is this session's to wipe
  closing.clear();
  assert.equal(storage.getItem(FLAG_KEY), null);
});

test('release takes some ids off the mark but lets them be marked again (the editor draft)', () => {
  const storage = memory();
  const flag = createCrashFlag({ storage, session: 'A' });
  flag.arm(['draft', 'cm-1']);
  flag.release(['draft']);
  assert.deepEqual(JSON.parse(storage.getItem(FLAG_KEY)).ids, ['cm-1']);
  flag.arm(['draft']);
  assert.deepEqual(JSON.parse(storage.getItem(FLAG_KEY)).ids, ['cm-1', 'draft']);
});

test('recover returns what a previous session left behind, and wipes it', () => {
  const storage = memory();
  createCrashFlag({ storage, session: 'OLD' }).arm(['cm-9']);
  const next = createCrashFlag({ storage, session: 'NEW' });
  assert.deepEqual(next.recover(), ['cm-9']);
  assert.equal(storage.getItem(FLAG_KEY), null);
  assert.deepEqual(next.recover(), []);
});

test('the mark of this very session is not "left behind"', () => {
  const storage = memory();
  const flag = createCrashFlag({ storage, session: 'A' });
  flag.arm(['cm-1']);
  assert.deepEqual(flag.recover(), []);
  assert.ok(storage.getItem(FLAG_KEY));
});

test('a broken mark is wiped and means nothing', () => {
  const storage = memory();
  storage.setItem(FLAG_KEY, '{not json');
  assert.deepEqual(createCrashFlag({ storage, session: 'A' }).recover(), []);
  assert.equal(storage.getItem(FLAG_KEY), null);
  storage.setItem(FLAG_KEY, JSON.stringify({ session: 'OLD', ids: 'oops' }));
  assert.deepEqual(createCrashFlag({ storage, session: 'A' }).recover(), []);
});

test('a storage that throws (private mode) does not break anything', () => {
  const broken = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); }, removeItem() { throw new Error('no'); } };
  const flag = createCrashFlag({ storage: broken, session: 'A' });
  assert.doesNotThrow(() => { flag.arm(['cm-1']); flag.frame(); flag.clear(); flag.release(['cm-1']); });
  assert.deepEqual(flag.recover(), []);
});
