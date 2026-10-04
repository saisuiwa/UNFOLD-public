import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../app/method-registry.js';
import { FLAG_KEY, createCrashFlag } from '../../app/method-crashflag.js';
import { DRAFT_ID, DRAFT_KEY, createSafety } from '../../app/method-safety.js';

const memory = () => { const data = new Map(); return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, String(v)); }, removeItem: k => { data.delete(k); } }; };
const reset = () => { for (const c of R.listCustom()) R.unregisterCustom(c.id); };
const make = (storage = memory(), session = 'S') => {
  const notices = [];
  const safety = createSafety({ storage, notify: m => notices.push(m), crashFlag: createCrashFlag({ storage, session }) });
  return { safety, storage, notices };
};
const withMethods = (...ids) => { reset(); for (const id of ids) R.registerCustom({ id, name: id, vertex: 'v' }); };
const slowFrames = (safety, ms = 150, count = 30) => { let verdict = null; for (let i = 0; i < count; i++) verdict = safety.tick(ms) ?? verdict; return verdict; };

test('before a frame with custom methods the mark is left; after 30 frames it is gone', () => {
  withMethods('cm-a');
  const { safety, storage } = make();
  safety.beforeDraw(['cm-a']);
  assert.deepEqual(JSON.parse(storage.getItem(FLAG_KEY)).ids, ['cm-a']);
  for (let i = 0; i < 30; i++) safety.afterDraw();
  assert.equal(storage.getItem(FLAG_KEY), null);
  reset();
});

test('frames without custom methods leave no mark', () => {
  const { safety, storage } = make();
  safety.beforeDraw([]);
  safety.afterDraw();
  assert.equal(storage.getItem(FLAG_KEY), null);
});

test('30 slow frames while a custom method is on screen switch it off, with a reason, and say so once', () => {
  withMethods('cm-a', 'cm-b');
  const { safety, notices } = make();
  safety.beforeDraw(['cm-a']);
  assert.ok(slowFrames(safety));
  assert.equal(R.getCustom('cm-a').status, 'disabled');
  assert.match(R.getCustom('cm-a').reason, /重すぎ/);
  assert.equal(R.getCustom('cm-b').status, 'ok', 'only what was on screen');
  assert.equal(notices.length, 1);
  reset();
});

test('a method that was switched off for being slow is taken off the mark at once', () => {
  withMethods('cm-a', 'cm-b');
  const { safety, storage } = make();
  safety.beforeDraw(['cm-a', 'cm-b']);
  assert.ok(storage.getItem(FLAG_KEY));
  assert.ok(slowFrames(safety));
  assert.equal(storage.getItem(FLAG_KEY), null, 'both were switched off: nothing is on screen to be afraid of');
  reset();
});

test('a method that was switched off after a lost context is taken off the mark at once', () => {
  withMethods('cm-a');
  const { safety, storage } = make();
  safety.beforeDraw(['cm-a']);
  safety.contextLost();
  assert.equal(storage.getItem(FLAG_KEY), null);
  reset();
});

test("slow frames without a custom method on screen are nobody's fault", () => {
  withMethods('cm-a');
  const { safety, notices } = make();
  safety.beforeDraw([]);
  assert.equal(slowFrames(safety), null);
  assert.equal(R.getCustom('cm-a').status, 'ok');
  assert.deepEqual(notices, []);
  reset();
});

test('a lost GPU context marks what was on screen as crashed', () => {
  withMethods('cm-a', 'cm-b');
  const { safety, notices } = make();
  safety.beforeDraw(['cm-a', 'cm-b']);
  assert.deepEqual(safety.contextLost().sort(), ['cm-a', 'cm-b']);
  assert.equal(R.getCustom('cm-a').status, 'crashed');
  assert.equal(R.getCustom('cm-b').status, 'crashed');
  assert.equal(notices.length, 1);
  reset();
});

test('a method that is already switched off is not touched again', () => {
  withMethods('cm-a');
  R.setCustomStatus('cm-a', 'quarantined', 'x');
  const { safety } = make();
  safety.beforeDraw(['cm-a']);
  assert.deepEqual(safety.contextLost(), []);
  assert.equal(R.getCustom('cm-a').status, 'quarantined');
  reset();
});

test('at the next start a method that was marked is switched off as "crashed"', () => {
  withMethods('cm-a', 'cm-b');
  const storage = memory();
  const before = make(storage, 'OLD');
  before.safety.beforeDraw(['cm-a']);                          // ... and then the browser went down: no pagehide, no wipe
  const { safety, notices } = make(storage, 'NEW');
  const result = safety.recoverFromCrash();
  assert.deepEqual(result, { methods: ['cm-a'], draft: false, verifying: [] });
  assert.equal(R.getCustom('cm-a').status, 'crashed');
  assert.match(R.getCustom('cm-a').reason, /落ちた/);
  assert.equal(R.getCustom('cm-b').status, 'ok');
  assert.equal(notices.length, 1);
  assert.equal(storage.getItem(FLAG_KEY), null);
  reset();
});

test('a mark for a method that no longer exists is just forgotten', () => {
  reset();
  const storage = memory();
  make(storage, 'OLD').safety.beforeDraw(['cm-gone']);
  const { safety, notices } = make(storage, 'NEW');
  assert.deepEqual(safety.recoverFromCrash(), { methods: [], draft: false, verifying: [] });
  assert.deepEqual(notices, []);
});

test('a marked editor draft is kept but remembered as "crashed"', () => {
  reset();
  const storage = memory();
  storage.setItem(DRAFT_KEY, JSON.stringify({ id: null, name: 'x', symbol: 'x', source: 'code' }));
  const old = make(storage, 'OLD');
  old.safety.armDraft();
  const { safety, notices } = make(storage, 'NEW');
  assert.deepEqual(safety.recoverFromCrash(), { methods: [], draft: true, verifying: [] });
  assert.equal(JSON.parse(storage.getItem(DRAFT_KEY)).crashed, true);
  assert.equal(JSON.parse(storage.getItem(DRAFT_KEY)).source, 'code');
  assert.equal(notices.length, 1);
});

test('the editor draft is marked while it is tried, and released afterwards', () => {
  const { safety, storage } = make();
  safety.armDraft();
  assert.deepEqual(JSON.parse(storage.getItem(FLAG_KEY)).ids, [DRAFT_ID]);
  safety.disarmDraft();
  assert.equal(storage.getItem(FLAG_KEY), null);
  safety.armDraft();                                          // it can be marked again for the next try
  assert.ok(storage.getItem(FLAG_KEY));
});

test('while an unchecked method is being checked the mark is left; wiped when the check is over', () => {
  withMethods('cm-q');
  const { safety, storage } = make();
  safety.armVerify('cm-q');
  assert.deepEqual(JSON.parse(storage.getItem(FLAG_KEY)).ids, ['verify:cm-q']);
  safety.disarmVerify('cm-q');
  assert.equal(storage.getItem(FLAG_KEY), null);
  reset();
});

test('if the browser went down while an unchecked method was being checked, it stays unchecked and says so', () => {
  reset();
  R.registerCustom({ id: 'cm-q', name: 'Q', vertex: 'v', status: 'quarantined', reason: 'ファイルから取り込みました。' });
  const storage = memory();
  make(storage, 'OLD').safety.armVerify('cm-q');
  const { safety, notices } = make(storage, 'NEW');
  assert.deepEqual(safety.recoverFromCrash(), { methods: [], draft: false, verifying: ['cm-q'] });
  assert.equal(R.getCustom('cm-q').status, 'quarantined', 'not "crashed": that one could be switched back on without the checks');
  assert.match(R.getCustom('cm-q').reason, /確認.*落ちた/);
  assert.equal(notices.length, 1);
  reset();
});

test('a mark for checking a method that is gone, or already enabled, is just forgotten', () => {
  reset();
  R.registerCustom({ id: 'cm-fine', name: 'F', vertex: 'v' });
  const storage = memory();
  const old = make(storage, 'OLD');
  old.safety.armVerify('cm-fine');
  old.safety.armVerify('cm-gone');
  const { safety, notices } = make(storage, 'NEW');
  assert.deepEqual(safety.recoverFromCrash(), { methods: [], draft: false, verifying: [] });
  assert.equal(R.getCustom('cm-fine').status, 'ok');
  assert.deepEqual(notices, []);
  reset();
});

test('closing the page normally wipes the mark', () => {
  withMethods('cm-a');
  const { safety, storage } = make();
  safety.beforeDraw(['cm-a']);
  safety.pageHide();
  assert.equal(storage.getItem(FLAG_KEY), null);
  reset();
});

test('createSafety works when localStorage cannot even be read', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('SecurityError'); }, configurable: true });
  try {
    const safety = createSafety();
    assert.doesNotThrow(() => { safety.beforeDraw(['cm-x']); safety.afterDraw(); safety.pageHide(); safety.recoverFromCrash(); });
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original); else delete globalThis.localStorage;
  }
});
