# 自作メソッド ② ライブラリとエディタ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 自作メソッドをアプリの中で作って・直して・消して・ブラウザに保存できるようにする。「＋自作メソッド」タイルから開くエディタ（コード欄・ライブプレビュー・チェック表示）、タイルの⚙メニュー（編集・複製・削除・もう一度試す）、停止中などのバッジ、サンプル、AIに頼むひな形のコピー、下書き保存。

**Architecture:** 保存は「レジストリの変化を見て自動で書く」方式（`createPersistence`）。エディタ・コンソール・自動の `disabled` のどれで変わっても、レジストリ経由なら保存される。エディタは `<dialog>` を JS で作り、専用の小さな WebGL（`method-preview.js`）でプレビューする。コンパイル確認は計画①の `compileUserMethod`、簡易チェックは `checkSource`。タイルは1枚モードとシーケンスで共通の `method-tiles.js` が作る。

**Tech Stack:** バニラ JS（ES modules）、three.js r180、IndexedDB、`<dialog>`、テストは `node:test`、ブラウザ確認は Claude のブラウザペイン。

**設計書:** `docs/superpowers/specs/2026-10-02-custom-methods-design.md`（承認済み）／前の計画: `docs/superpowers/plans/2026-10-02-custom-methods-1-engine.md`（実行済み）

**この計画の外（計画③）:** 段2の試し描画（重さの比較・「何も映ってない」警告）、段3の見張り、段5のクラッシュ印、`.unfold` への同梱と取り込み時の隔離、書き出し前の準備待ち。

**このプロジェクトは git リポジトリではない。** コミットの代わりに、作業前に `app/` をバックアップし（Task 0）、最後に差分が意図した範囲か確認する（Task 10）。

**import の書き方（重要）:** 他のモジュールからも読まれるファイル（`method-registry.js`・`custom-method.js`・`method-guard.js`・`method-library.js`・`method-messages.js`・`method-samples.js`・`method-preview.js`・`method-editor.js`・`method-tiles.js`・`method-menu.js`）には `?v=` を付けない（ブラウザの中に別々の2つのコピーができて、登録した自作メソッドが見えなくなる）。

**プレビューの GPU コンテキスト（重要）:** `forceContextLoss()` で手放したコンテキストは、同じ `<canvas>` では作り直せない。エディタのプレビューは1回だけ作って使い回す（2回目に開くとエラーになり、コンパイルの結果も当てにならなかった。ブラウザ確認で見つけた）。

**確認用サーバー:** `preview_start` の Python は `/Volumes/ORICO` を読めない。`app/` と `tools/serve.py` をスクラッチパッドにコピーして配信する（Task 9）。ブラウザペインが非表示だと `addImageFromUrl`（画像のデコード）が止まるので、`unfoldSeq.addSlide(canvas, name)` を使う。

---

## ファイル構成

| ファイル | 変更 | 役割 |
|---|---|---|
| `app/method-library.js` | 新規 | IndexedDB への保存、`createPersistence`（レジストリの変化を自動で保存）、`sourceHash` |
| `app/method-messages.js` | 新規 | GPU のエラー文を、やさしい日本語にする |
| `app/method-samples.js` | 新規 | サンプル、新規用のコード、AIに頼むひな形 |
| `app/method-preview.js` | 新規 | エディタ用の小さなプレビュー（専用の WebGL） |
| `app/method-editor.js` | 新規 | `<dialog>` のエディタ |
| `app/method-menu.js` | 新規 | タイルの⚙メニュー |
| `app/method-tiles.js` | 新規 | メソッド一覧のタイル（両モード共通） |
| `app/method-editor.css` | 新規 | エディタ・タイル・メニューの見た目（両ページ共通） |
| `app/sequence.js` / `app/sequence.html` | 変更 | 共通タイル、エディタ、保存の開始、削除時の◆の戻し |
| `app/app.js` / `app/index.html` | 変更 | 同上（1枚モード） |
| `tools/test/library.test.mjs`、`messages.test.mjs`、`samples.test.mjs` | 新規 | 単体テスト |

---

### Task 0: バックアップ

**Files:**
- Create: `archive/app-before-custom-editor-2026-10-03/`

- [ ] **Step 1: コピーして確認する**

```bash
cp -R /Volumes/ORICO/UNFOLD/app /Volumes/ORICO/UNFOLD/archive/app-before-custom-editor-2026-10-03 && diff -rq /Volumes/ORICO/UNFOLD/app /Volumes/ORICO/UNFOLD/archive/app-before-custom-editor-2026-10-03 && echo SAME
```
Expected: `SAME`

---

### Task 1: `method-library.js`（保存）— TDD

**Files:**
- Create: `tools/test/library.test.mjs`
- Create: `app/method-library.js`

- [ ] **Step 1: 失敗するテストを書く**

`/Volumes/ORICO/UNFOLD/tools/test/library.test.mjs`:

```js
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
```

- [ ] **Step 2: 失敗を確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/library.test.mjs 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|^ℹ (pass|fail)" | head -3`
Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: 実装を書く**

`/Volumes/ORICO/UNFOLD/app/method-library.js`:

```js
// Saving custom methods in this browser (IndexedDB), the way model-library.js keeps GLB files.
// createPersistence() keeps a store in step with the registry: whatever is registered, changed or removed there is written here, so the editor,
// the console and the automatic "disabled" status all end up saved without each of them having to remember to.
import { listCustom, onRegistryChange, registerCustom, getCustom } from './method-registry.js';

const DATABASE = 'unfold-method-library', STORE = 'methods';

// SHA-256 of the code as hex. crypto.subtle only exists on https and localhost; elsewhere a plain FNV-1a hash stands in.
export async function sourceHash(text) {
  const data = new TextEncoder().encode(String(text));
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 2166136261;
  for (const b of data) { h ^= b; h = Math.imul(h, 16777619); }
  return `fnv-${(h >>> 0).toString(16)}`;
}

const signature = c => JSON.stringify([c.name, c.symbol, c.vertex, c.status, c.reason]);

export function createPersistence({ store, onError = () => {} }) {
  const persisted = new Map();    // id -> signature of what the store holds (or is about to hold)
  const created = new Map();      // id -> createdAt, kept across edits
  let queue = Promise.resolve(), stopListening = null;
  // writes run one after the other; `undo` puts the bookkeeping back when a write fails, so the next registry event retries it
  const enqueue = (job, undo) => { queue = queue.then(job).catch(error => { undo?.(); onError(error); }); };

  function sync() {
    const live = new Map(listCustom().map(c => [c.id, c]));
    for (const c of live.values()) {
      const sig = signature(c), before = persisted.get(c.id);
      if (before === sig) continue;
      persisted.set(c.id, sig);
      if (!created.has(c.id)) created.set(c.id, Date.now());
      const record = { id: c.id, name: c.name, symbol: c.symbol, vertex: c.vertex, look: null, params: [], status: c.status, reason: c.reason, createdAt: created.get(c.id), updatedAt: Date.now() };
      enqueue(async () => { await store.put({ ...record, hash: await sourceHash(c.vertex) }); }, () => { if (before === undefined) persisted.delete(c.id); else persisted.set(c.id, before); });
    }
    for (const [id, before] of [...persisted]) {
      if (live.has(id)) continue;
      persisted.delete(id);
      enqueue(() => store.delete(id), () => persisted.set(id, before));
    }
  }

  return {
    // registers every saved method; nothing is written back for them
    async load() {
      const records = await store.list();
      for (const r of records) {
        registerCustom({ id: r.id, name: r.name, symbol: r.symbol, vertex: r.vertex, status: r.status, reason: r.reason });
        persisted.set(r.id, signature(getCustom(r.id)));
        created.set(r.id, r.createdAt);
      }
      return records.length;
    },
    start() { stopListening ??= onRegistryChange(sync); },
    stop() { stopListening?.(); stopListening = null; },
    flush: () => queue,
  };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('このブラウザでは自作メソッドを保存できません。'));
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('自作メソッドの保存場所を開けませんでした。'));
  });
}

// the real store: { list(), put(record), delete(id) } on IndexedDB
export function openStore() {
  let opening = null;
  const run = async (mode, operate) => {
    const db = await (opening ??= openDatabase());
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      let result;
      operate(transaction.objectStore(STORE), value => { result = value; });
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error('自作メソッドの保存に失敗しました。'));
      transaction.onabort = () => reject(transaction.error || new Error('自作メソッドの保存が中断されました。'));
    });
  };
  return {
    list: () => run('readonly', (store, done) => { store.getAll().onsuccess = e => done(e.target.result.sort((a, b) => a.createdAt - b.createdAt)); }),
    put: record => run('readwrite', store => { store.put(record); }),
    delete: id => run('readwrite', store => { store.delete(id); }),
  };
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/library.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)|✖"`
Expected: `ℹ tests 7`、`ℹ pass 7`、`ℹ fail 0`

---

### Task 2: `method-messages.js`（GPU のエラーを日本語に）— TDD

**Files:**
- Create: `tools/test/messages.test.mjs`
- Create: `app/method-messages.js`

- [ ] **Step 1: 失敗するテストを書く**

`/Volumes/ORICO/UNFOLD/tools/test/messages.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { describeGlError } from '../../app/method-messages.js';

test('the common GPU compiler messages become plain Japanese', () => {
  assert.match(describeGlError("'undefinedThing' : undeclared identifier"), /「undefinedThing」という名前が見つかりません/);
  assert.match(describeGlError("'hash' : function already has a body"), /「hash」は、もともと用意されている関数と同じ名前/);
  assert.match(describeGlError("'}' : syntax error"), /書き方がおかしい/);
  assert.match(describeGlError("'=' : cannot convert from 'const 2-component vector of float' to 'float'"), /型が合っていません/);
  assert.match(describeGlError("'+' : wrong operand types - no operation '+' exists that takes a left-hand operand of type 'float' and a right operand of type 'vec2'"), /型の組み合わせが合っていません/);
  assert.match(describeGlError("'foo' : no matching overloaded function found"), /「foo」/);
  assert.match(describeGlError("'constructor' : not enough data provided for construction"), /値が足りません/);
});

test('an unknown message is returned as it is', () => {
  assert.equal(describeGlError("'x' : something new"), "'x' : something new");
  assert.equal(describeGlError(''), '');
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/messages.test.mjs 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|^ℹ (pass|fail)" | head -3`
Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: 実装を書く**

`/Volumes/ORICO/UNFOLD/app/method-messages.js`:

```js
// The GPU compiler's messages in plain Japanese. The editor shows the original text next to them.
const RULES = [
  [/^'(.+?)' : undeclared identifier/, m => `「${m[1]}」という名前が見つかりません（打ち間違いや、宣言し忘れかも）。`],
  [/^'(.+?)' : function already has a body/, m => `「${m[1]}」は、もともと用意されている関数と同じ名前です。別の名前にしてね。`],
  [/^'(.+?)' : redefinition/, m => `「${m[1]}」を2回宣言しています。`],
  [/syntax error/, () => '書き方がおかしい所があります（; ) { } の付け忘れなど）。'],
  [/cannot convert from '(.+?)' to '(.+?)'/, m => `型が合っていません（${m[1]} を ${m[2]} に入れようとしています）。`],
  [/wrong operand types/, () => '足し算や掛け算などで、型の組み合わせが合っていません（例: float と vec2 の混ぜ方）。'],
  [/^'(.+?)' : no matching overloaded function found/, m => `「${m[1]}」に渡している値の型や数が、合っていません。`],
  [/not enough data provided for construction/, () => 'vec2 や vec3 を作るときの値が足りません。'],
];

export function describeGlError(message) {
  for (const [pattern, describe] of RULES) {
    const m = pattern.exec(message);
    if (m) return describe(m);
  }
  return message;
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/messages.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)|✖"`
Expected: `ℹ pass 2`、`ℹ fail 0`

---

### Task 3: `method-samples.js`（サンプル・新規用のコード・AIに頼むひな形）— TDD

**Files:**
- Create: `tools/test/samples.test.mjs`
- Create: `app/method-samples.js`

- [ ] **Step 1: 失敗するテストを書く**

`/Volumes/ORICO/UNFOLD/tools/test/samples.test.mjs`:

```js
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
```

- [ ] **Step 2: 失敗を確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/samples.test.mjs 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|^ℹ (pass|fail)" | head -3`
Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: 実装を書く**

`/Volumes/ORICO/UNFOLD/app/method-samples.js`:

```js
// Starting points for the editor: ready-made methods, the code a new method starts with, and the text to give an AI chat.
import { LIMITS } from './method-guard.js';

export const NEW_METHOD_SOURCE = `// p: 画像の中の位置、amount: 崩れ具合（0 で元の絵、大きいほどよく崩れる）
// 戻り値: vec3(x, y, 奥行き)
vec3 userMethod(vec2 p, float amount) {
  vec2 q = p;
  q.y += sin(p.x * 4. + uTime * 2.) * .3 * amount;   // 波打つ
  return vec3(q, 0.);
}`;

export const SAMPLES = [
  { key: 'vortex', name: '渦に吸い込む', symbol: '渦', source: `// 中心に近いほど強く回して、中心へ縮める
vec3 userMethod(vec2 p, float amount) {
  float r = length(p);
  vec2 q = rot(amount * 3.4 / (r + .35)) * p * (1. - amount * .6 * exp(-r * .5));
  return vec3(q, -amount * .9 * exp(-r * r * .7));
}` },
  { key: 'wave', name: '波打つ', symbol: '波', source: `// 縦と横にゆらゆら揺らす
vec3 userMethod(vec2 p, float amount) {
  vec2 q = p;
  q.x += sin(p.y * 6. + uSeed) * amount * .6;
  q.y += sin(p.x * 5. + uSeed) * amount * .48;
  return vec3(q, 0.);
}` },
  { key: 'scatter', name: 'ばらばらに飛ぶ', symbol: 'ば', source: `// タイルごとにランダムに回って散らばる（cell はタイルの位置）
vec3 userMethod(vec2 p, float amount) {
  float n = hash(cell);
  vec2 center = (cell - .5) * uSize;
  vec2 q = center + rot((n - .5) * 6.28 * amount) * (p - center) * (1. - amount * .2);
  q += vec2(n - .5, hash(cell + 5.) - .5) * 2.0 * amount;
  return vec3(q, 0.);
}` },
  { key: 'sparkle', name: 'きらめく粒', symbol: '粒', source: `// 画像が小さな粒に分かれて、ちかちか光る（partC() は粒の中心）
vec3 userMethod(vec2 p, float amount) {
  vec2 c = partC();
  vec2 l = p - c;
  vec2 q = c + l * (1. + amount * .6) + vec2(ph(1.) - .5, ph(2.) - .5) * .25 * amount;
  float z = (ph(3.) - .5) * .6 * amount;
  gKind = 4.;                       // 粒の見た目: 4 = きらめき
  gGlow = amount * (.35 + .65 * sin(uTime * (3. + ph(4.) * 5.) + ph(5.) * 6.2832)) * .9;
  gLocal = 1.;                      // 粒ごとの形を使う
  return vec3(q, z);
}` },
];

// Text to paste into an AI chat: it explains what to write, and the rules the editor checks, so what comes back is likely to pass.
export const aiTemplate = () => `あなたは UNFOLD（画像が崩れて立体になるツール）の「崩れ方」を GLSL で書くアシスタントです。
次のルールを守って、userMethod 関数を1つだけ書いてください。

【関数の形】
vec3 userMethod(vec2 p, float amount) { ... }
- p: 画像の中の位置（16:9 の画像なら、横はおよそ -2.6〜2.6、縦はおよそ -1.5〜1.5）
- amount: 崩れ具合。0 のとき元の絵、大きいほどよく崩れる（おおよそ 0〜0.8）
- 戻り値: vec3(x, y, 奥行き)。p をそのまま返せば動きません。

【使える道具】
- hash(vec2): 0〜1 の乱数（同じ入力なら同じ値）
- rot(float 角度): 回転行列（mat2）。rot(a) * p のように使う
- cell: 画像を 16×16 に分けたタイルの位置（0〜1）。hash(cell) でタイルごとの乱数が作れる
- partC(): 粒（画像をさらに細かく分けた小さなかけら）の中心。p - partC() が粒の中での位置
- ph(float k): 粒ごとの乱数（k を変えると別の乱数）
- uSize（画像の大きさ）、uTime（秒）、uSeed（乱数の種）、uStrength（崩れの強さ）
- 粒の見た目: gKind に 1〜8 を入れると粒の形が変わる（1=星とハート 2=丸い点 3=泡 4=きらめき 5=網点 6=雨の筋 7=RGBずれ 8=花びら）。gAlpha（透明度 0〜1）、gGlow（光 0〜2）、gLocal = 1. で粒ごとの形を使う。

【守ること】
- ${LIMITS.maxChars} 文字以内。
- ループは userMethod の中だけで、for (int i = 0; i < 回数; i++) { ... } の形（回数は数字で1つあたり ${LIMITS.maxLoop} 回まで、入れ子も含めた合計で ${LIMITS.loopBudget} 回まで）。ループの中で i を書き換えない。
- while、do、goto、discard、main は使えない。# で始まる行（#define など）、uniform / attribute / varying / in / out の宣言、gl_ で始まる名前も使えない。
- 補助の関数を作ってもよい（ループは入れない）。名前は、上の道具（hash、rot など）と別にする。

【作りたい動き】
（ここに、作りたい崩れ方を書いてください。例: 「雷みたいにギザギザに割れる」）

【出力】
コードブロック1つだけ（説明は不要）。`;
```

- [ ] **Step 4: 通ることを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/samples.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)|✖"`
Expected: `ℹ pass 3`、`ℹ fail 0`

---

### Task 4: `method-preview.js`（エディタ用の小さなプレビュー）

画面に依存する部分（WebGL）なので、Node のテストは無し。ブラウザで確認する（Task 9）。

**Files:**
- Create: `app/method-preview.js`

- [ ] **Step 1: 書く**

`/Volumes/ORICO/UNFOLD/app/method-preview.js`:

```js
// A small preview of one custom method, for the editor: its own WebGL canvas, the same shaders and the same grid of tiles/grains as the real pages.
import * as THREE from './vendor/three.module.min.js';
import { assembleVertex } from './custom-method.js';

const TILES = 16, SUB = 5;

// the picture as 16×16 tiles of 5×5 grains (two triangles each), like the single-image page builds it
function gridGeometry(w, h) {
  const count = TILES * TILES * SUB * SUB * 6;
  const positions = new Float32Array(count * 3), uvs = new Float32Array(count * 2), cells = new Float32Array(count * 2), parts = new Float32Array(count * 4);
  let i = 0;
  const step = 1 / (TILES * SUB);
  for (let cy = 0; cy < TILES; cy++) for (let cx = 0; cx < TILES; cx++) for (let sy = 0; sy < SUB; sy++) for (let sx = 0; sx < SUB; sx++) {
    const u = (cx + sx / SUB) / TILES, v = (cy + sy / SUB) / TILES;
    for (const [du, dv] of [[0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]]) {
      const a = u + du * step, b = v + dv * step;
      positions.set([(a - .5) * w, (b - .5) * h, 0], i * 3);
      uvs.set([a, b], i * 2);
      cells.set([(cx + .5) / TILES, (cy + .5) / TILES], i * 2);
      parts.set([u + step / 2, v + step / 2, du, dv], i * 4);
      i++;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('cell', new THREE.BufferAttribute(cells, 2));
  geometry.setAttribute('part', new THREE.BufferAttribute(parts, 4));
  geometry.setAttribute('targetPosition', new THREE.BufferAttribute(new Float32Array(count * 3), 3));   // the preview never turns the picture into a solid
  return geometry;
}

// a colourful picture with letters, for when no picture is open
export function makeTestImage(width = 960, height = 540) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const g = canvas.getContext('2d');
  g.fillStyle = '#ebeada'; g.fillRect(0, 0, width, height);
  const colors = ['#ff7145', '#2855b9', '#cce876', '#eee9d6', '#678cc5', '#dc472c'];
  const cw = width / 8, ch = height / 4.5;
  for (let j = 0; j < 5; j++) for (let i = 0; i < 8; i++) { g.fillStyle = colors[(i + j * 2) % colors.length]; g.fillRect(i * cw, j * ch, cw, ch); }
  g.strokeStyle = '#172719'; g.lineWidth = 2;
  for (let x = 0; x < width; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, height); g.stroke(); }
  for (let y = 0; y < height; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(width, y); g.stroke(); }
  g.fillStyle = '#f1f0da'; g.fillRect(width * .08, height * .22, width * .84, height * .56);
  g.fillStyle = '#183625'; g.font = `bold ${Math.round(height * .3)}px sans-serif`; g.textAlign = 'center'; g.fillText('UNFOLD', width / 2, height * .6);
  return canvas;
}

export function createPreview(canvas, { vertexShader, fragmentShader }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor('#111718', 1);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4.8, 4.8, 2.7, -2.7, .1, 100);
  camera.position.z = 10;
  const uniforms = {
    uImage: { value: null }, uSize: { value: new THREE.Vector2(5.25, 2.95) }, uDistort: { value: 0 }, uForm: { value: 0 }, uStrength: { value: .75 },
    uDepth: { value: 1 }, uSeed: { value: 28 }, uMethod: { value: 0 }, uMethod2: { value: 0 }, uMethodMix: { value: 0 }, uProject: { value: 0 },
    uTime: { value: 0 }, uDraw: { value: 1 }, uThrough: { value: 0 }, uFade: { value: 1 }, uGlass: { value: 0 }, uShape: { value: 0 }, uPreset: { value: 0 }, uConceal: { value: 0 },
  };
  const makeMaterial = source => new THREE.ShaderMaterial({ uniforms, vertexShader: source, fragmentShader, side: THREE.DoubleSide, transparent: true });
  let material = makeMaterial(vertexShader), mesh = null, texture = null;

  function draw() { renderer.render(scene, camera); }

  return {
    renderer,
    resize(width, height) {
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      const aspect = width / height, h = Math.max(5.4, 6.8 / aspect);
      Object.assign(camera, { left: -h * aspect / 2, right: h * aspect / 2, top: h / 2, bottom: -h / 2 });
      camera.updateProjectionMatrix();
      draw();
    },
    setImage(image) {
      texture?.dispose();
      texture = new THREE.CanvasTexture(image);
      texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false; texture.colorSpace = THREE.SRGBColorSpace;
      const aspect = image.width / image.height, h = Math.min(3.65, 5.25 / aspect), w = h * aspect;
      uniforms.uImage.value = texture;
      uniforms.uSize.value.set(w, h);
      const previous = mesh?.geometry;
      if (!mesh) { mesh = new THREE.Mesh(gridGeometry(w, h), material); mesh.frustumCulled = false; scene.add(mesh); }
      else mesh.geometry = gridGeometry(w, h);
      previous?.dispose();
      draw();
    },
    // show the user's code (it must compile); setSource(null) goes back to the built-in default method
    setSource(source) {
      const next = source ? makeMaterial(assembleVertex(vertexShader, { a: source }).source) : makeMaterial(vertexShader);
      const previous = material;
      material = next;
      if (mesh) mesh.material = next;
      previous.dispose();
      uniforms.uMethod.value = source ? 100 : 0;
      draw();
    },
    setProgress(progress) {
      uniforms.uDistort.value = progress;
      uniforms.uTime.value = (performance.now() / 1000) % 1000;
      draw();
    },
    dispose() {
      texture?.dispose(); mesh?.geometry.dispose(); material.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
```

- [ ] **Step 2: 構文を確認する**

Run: `cd /Volumes/ORICO/UNFOLD/app && node --check method-preview.js 2>&1 | head -3; node -e "import('./method-preview.js').then(m => console.log(Object.keys(m).join(',')))" 2>&1 | grep -v MODULE_TYPELESS | head -2`
Expected: `makeTestImage,createPreview`（構文エラーなし。three.js も Node から読める）。

---

### Task 5: エディタの見た目とエディタ本体

**Files:**
- Create: `app/method-editor.css`
- Create: `app/method-editor.js`

- [ ] **Step 1: CSS を書く（エディタ・タイル・メニュー。両ページ共通）**

`/Volumes/ORICO/UNFOLD/app/method-editor.css`:

```css
/* shared by the single-image page and the sequence page: the custom-method editor, the extras of the method tiles, and the tile menu.
   The two pages name their colours differently, so every colour falls back through both names. */
.method-dialog, .method-menu, .method-tile {
  --m-panel: var(--panel, #171e1f); --m-line: var(--line, #2a3334); --m-ink: var(--ink, var(--text, #eef0e2));
  --m-dim: var(--dim, var(--muted, #96a19b)); --m-accent: var(--accent, var(--lime, #d9f878)); --m-added: var(--added, #7fd6ff); --m-warn: var(--warn, #ff8a6b);
}

/* tiles */
.method-tile { position: relative; display: flex; min-width: 0; }
.method-tile > button[data-method] { flex: 1; width: 100%; min-width: 0; }
.choice-grid .method-tile > .tile-gear {
  position: absolute; top: 3px; right: 3px; width: 22px; height: 22px; min-height: 0; padding: 0; display: grid; place-items: center;
  font-size: 12px; line-height: 1; border-radius: 6px; border: 1px solid transparent; background: rgba(17, 23, 24, .55); color: var(--m-dim); cursor: pointer;
}
.choice-grid .method-tile > .tile-gear:hover, .choice-grid .method-tile > .tile-gear:focus-visible { color: var(--m-added); border-color: var(--m-added); }
.choice-grid button.unusable { opacity: .65; border-style: dashed; }
.choice-grid button.unusable small { color: var(--m-warn); letter-spacing: 0; }
.choice-grid button.add-method { border-style: dashed; border-color: #3a6a82; color: var(--m-added); }
.choice-grid button.add-method:hover { border-color: var(--m-added); }

/* the menu of a custom tile */
.method-menu { position: fixed; z-index: 1000; min-width: 190px; max-width: 280px; padding: 10px; border-radius: 10px; border: 1px solid var(--m-line); background: var(--m-panel);
  color: var(--m-ink); box-shadow: 0 8px 28px rgba(0, 0, 0, .5); font-size: 12px; line-height: 1.5; }
.method-menu .mm-title { display: flex; align-items: center; gap: 6px; font-weight: 700; }
.method-menu .mm-badge { padding: 0 6px; border-radius: 8px; background: rgba(255, 138, 107, .18); color: var(--m-warn); font-size: 11px; font-weight: 400; }
.method-menu .mm-reason { margin: 6px 0 2px; color: var(--m-warn); word-break: break-word; }
.method-menu button { display: block; width: 100%; margin-top: 4px; padding: 6px 8px; text-align: left; border-radius: 6px; border: 1px solid var(--m-line); background: #1c2324; color: inherit; font: inherit; cursor: pointer; }
.method-menu button:hover { border-color: var(--m-added); }
.method-menu button.danger { color: var(--m-warn); }

/* the editor */
dialog.method-dialog { width: min(980px, 94vw); max-height: 92vh; padding: 0; border: 1px solid var(--m-line); border-radius: 14px; background: var(--m-panel); color: var(--m-ink);
  font: 13px/1.5 'DM Sans', 'Noto Sans JP', system-ui, sans-serif; overflow: hidden; }
dialog.method-dialog[open] { display: flex; flex-direction: column; }
dialog.method-dialog::backdrop { background: rgba(5, 8, 9, .72); }
.md-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--m-line); }
.md-head h2 { margin: 0; font-size: 15px; }
.md-x { width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--m-line); background: transparent; color: var(--m-dim); font-size: 16px; cursor: pointer; }
.md-body { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 14px; padding: 14px 16px; overflow: auto; }
@media (max-width: 760px) { .md-body { grid-template-columns: 1fr; } }
.md-col { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.md-fields { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.md-fields input, .md-fields select, .md-fields button { padding: 5px 8px; border-radius: 6px; border: 1px solid var(--m-line); background: #1c2324; color: inherit; font: inherit; }
.md-fields button { cursor: pointer; }
.md-fields button:hover { border-color: var(--m-added); }
#method-name { width: 150px; }
#method-symbol { width: 52px; text-align: center; }
.md-editor { display: grid; grid-template-columns: 38px minmax(0, 1fr); height: 320px; border: 1px solid var(--m-line); border-radius: 8px; overflow: hidden; background: #0e1415; }
.md-gutter { overflow: hidden; padding: 10px 6px; text-align: right; color: #5d6b66; background: #121a1b; font: 12px/18px ui-monospace, Menlo, Consolas, monospace; user-select: none; }
.md-gutter div.err { color: var(--m-warn); background: rgba(255, 138, 107, .16); }
.md-code { resize: none; border: 0; outline: 0; padding: 10px; background: transparent; color: inherit; font: 12px/18px ui-monospace, Menlo, Consolas, monospace; white-space: pre; overflow: auto; tab-size: 2; }
.md-checks { display: flex; flex-direction: column; gap: 2px; }
.md-check { display: flex; gap: 8px; align-items: center; color: var(--m-dim); }
.md-check .mark { width: 18px; text-align: center; font-weight: 700; }
.md-check.ok { color: var(--m-ink); } .md-check.ok .mark { color: var(--m-accent); }
.md-check.ng { color: var(--m-ink); } .md-check.ng .mark { color: var(--m-warn); }
.md-errors { margin: 0; padding-left: 18px; color: var(--m-warn); max-height: 110px; overflow: auto; }
.md-errors li { margin: 2px 0; }
.md-errors small { display: block; color: var(--m-dim); word-break: break-word; }
.md-canvas { width: 100%; aspect-ratio: 16 / 9; display: block; border-radius: 8px; border: 1px solid var(--m-line); background: #111718; }
.md-preview-controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; color: var(--m-dim); }
.md-preview-controls input[type=range] { flex: 1; min-width: 120px; accent-color: var(--m-accent); }
.md-hint { color: var(--m-dim); font-size: 12px; }
.md-hint summary { cursor: pointer; color: var(--m-added); }
.md-hint ul { margin: 4px 0 0; padding-left: 18px; }
.md-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--m-line); }
.md-foot button { padding: 7px 18px; border-radius: 8px; border: 1px solid var(--m-line); background: #1c2324; color: inherit; font: inherit; cursor: pointer; }
.md-foot button.primary { border-color: var(--m-accent); background: #2b3323; color: var(--m-accent); font-weight: 700; }
.md-foot button:disabled { opacity: .4; cursor: not-allowed; }
```

- [ ] **Step 2: エディタ本体を書く**

`/Volumes/ORICO/UNFOLD/app/method-editor.js`:

```js
// The custom-method editor: a <dialog> with a code box, a live preview and the checks that stand between the code and "save".
import { LIMITS, checkSource } from './method-guard.js';
import { compileUserMethod } from './custom-method.js';
import { getCustom, registerCustom } from './method-registry.js';
import { describeGlError } from './method-messages.js';
import { NEW_METHOD_SOURCE, SAMPLES, aiTemplate } from './method-samples.js';
import { createPreview, makeTestImage } from './method-preview.js';

const DRAFT_KEY = 'unfold-method-draft';
const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { return null; } };
const writeDraft = draft => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* private mode: no draft */ } };
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* nothing to clear */ } };
const newId = () => `cm-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`}`;

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}
const MARKS = { ok: '✓', ng: '✗', wait: '…', skip: '–' };

export function createMethodEditor({ vertexShader, fragmentShader, getPreviewImage = () => null, notify = () => {}, onSaved = () => {} }) {
  let ui = null, preview = null, current = { id: null }, frame = 0, timer = 0, token = 0, startedAt = 0;
  const results = { guard: null, compile: null, compiling: false };

  function build() {
    const close = el('button', { type: 'button', id: 'method-close', className: 'md-x', textContent: '×' });
    close.setAttribute('aria-label', '閉じる');
    const head = el('div', { className: 'md-head' }, el('h2', { id: 'method-title' }, '自作メソッド'), close);

    const name = el('input', { id: 'method-name', type: 'text', maxLength: 20, placeholder: '名前' });
    const symbol = el('input', { id: 'method-symbol', type: 'text', maxLength: 2, placeholder: '字' });
    symbol.title = 'タイルに出る1文字';
    const samples = el('select', { id: 'method-samples' }, el('option', { value: '', textContent: 'サンプルから…' }), ...SAMPLES.map(s => el('option', { value: s.key, textContent: s.name })));
    const ai = el('button', { type: 'button', id: 'method-ai', textContent: 'AIに頼むひな形をコピー' });
    const fields = el('div', { className: 'md-fields' }, name, symbol, samples, ai);

    const gutter = el('div', { id: 'method-gutter', className: 'md-gutter' });
    const code = el('textarea', { id: 'method-code', className: 'md-code', spellcheck: false, wrap: 'off' });
    code.setAttribute('autocapitalize', 'off'); code.setAttribute('autocomplete', 'off'); code.setAttribute('aria-label', 'コード');
    const editor = el('div', { className: 'md-editor' }, gutter, code);

    const guardRow = el('div', { id: 'method-guard', className: 'md-check' });
    const compileRow = el('div', { id: 'method-compile', className: 'md-check' });
    const errors = el('ul', { id: 'method-errors', className: 'md-errors' });
    const checks = el('div', { className: 'md-checks' }, guardRow, compileRow);
    const hint = el('details', { className: 'md-hint' }, el('summary', {}, '書き方のヒント'),
      el('ul', {},
        el('li', {}, '`vec3 userMethod(vec2 p, float amount)` を1つ書く。p は位置、amount は崩れ具合（0 で元の絵）。'),
        el('li', {}, `ループは userMethod の中だけで、for (int i = 0; i < 24; i++) の形。1つ${LIMITS.maxLoop}回まで、合計${LIMITS.loopBudget}回まで。`),
        el('li', {}, `while・do・discard・# の行・uniform の宣言は使えません。${LIMITS.maxChars}文字まで。`),
        el('li', {}, '道具: hash() rot() cell partC() ph() uTime uSeed uSize。粒の見た目は gKind（1〜8）で選びます。')));

    const canvas = el('canvas', { id: 'method-canvas', className: 'md-canvas' });
    const progress = el('input', { id: 'method-progress', type: 'range', min: 0, max: 100, value: 60 });
    progress.setAttribute('aria-label', '崩れ具合');
    const loop = el('input', { id: 'method-loop', type: 'checkbox', checked: true });
    const controls = el('div', { className: 'md-preview-controls' }, '崩れ具合', progress, el('label', {}, loop, ' 自動で動かす'));

    const left = el('div', { className: 'md-col' }, fields, editor, checks, errors, hint);
    const right = el('div', { className: 'md-col' }, canvas, controls);
    const save = el('button', { type: 'button', id: 'method-save', className: 'primary', textContent: '保存' });
    const cancel = el('button', { type: 'button', id: 'method-cancel', textContent: 'キャンセル' });
    const dialog = el('dialog', { id: 'method-dialog', className: 'method-dialog' }, head, el('div', { className: 'md-body' }, left, right), el('div', { className: 'md-foot' }, cancel, save));
    dialog.setAttribute('aria-labelledby', 'method-title');
    document.body.append(dialog);

    // the page's own shortcuts (space = play, ⌘Z = undo …) must not fire while typing here
    dialog.addEventListener('keydown', e => e.stopPropagation());
    code.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      code.setRangeText('  ', code.selectionStart, code.selectionEnd, 'end');
      onEdit();
    });
    code.addEventListener('input', onEdit);
    code.addEventListener('scroll', () => { gutter.scrollTop = code.scrollTop; });
    name.addEventListener('input', updateSave);
    symbol.addEventListener('input', updateSave);
    samples.addEventListener('change', () => {
      const sample = SAMPLES.find(s => s.key === samples.value);
      samples.value = '';
      if (!sample) return;
      code.value = sample.source;
      if (!name.value.trim()) { name.value = sample.name; symbol.value = sample.symbol; }
      onEdit();
    });
    ai.addEventListener('click', copyTemplate);
    progress.addEventListener('input', () => { loop.checked = false; });
    save.addEventListener('click', saveMethod);
    cancel.addEventListener('click', () => closeEditor());
    close.addEventListener('click', () => closeEditor());
    dialog.addEventListener('close', cleanup);
    return { dialog, name, symbol, samples, ai, gutter, code, guardRow, compileRow, errors, canvas, progress, loop, save };
  }

  function setRow(row, label, state) {
    row.className = `md-check ${state}`;
    row.replaceChildren(el('span', { className: 'mark', textContent: MARKS[state] }), label);
  }
  function renderGutter(marks) {
    const lines = ui.code.value.split('\n').length;
    ui.gutter.replaceChildren(...Array.from({ length: lines }, (_, i) => el('div', { className: marks.has(i + 1) ? 'err' : '', textContent: String(i + 1) })));
    ui.gutter.scrollTop = ui.code.scrollTop;
  }
  function updateSave() {
    ui.save.disabled = !(results.guard?.ok && results.compile && results.compile.length === 0 && !results.compiling);
  }
  function show() {
    const { guard, compile, compiling } = results;
    setRow(ui.guardRow, '書き方（簡易チェック）', guard ? (guard.ok ? 'ok' : 'ng') : 'wait');
    setRow(ui.compileRow, 'コンパイル（GPU）', !guard?.ok ? 'skip' : compiling || !compile ? 'wait' : compile.length ? 'ng' : 'ok');
    const items = [], marks = new Set();
    const item = (line, text, original = '') => el('li', {}, `${line ? `${line}行目: ` : ''}${text}`, ...(original ? [el('small', { textContent: original })] : []));
    for (const e of guard?.errors ?? []) { items.push(item(e.line, e.message)); if (e.line) marks.add(e.line); }
    for (const e of compile ?? []) { const ja = describeGlError(e.message); items.push(item(e.line, ja, ja === e.message ? '' : e.message)); if (e.line) marks.add(e.line); }
    ui.errors.replaceChildren(...items);
    renderGutter(marks);
    updateSave();
  }

  function onEdit() {
    results.guard = null; results.compile = null; results.compiling = false;
    clearTimeout(timer);
    timer = setTimeout(runChecks, 350);
    show();
  }
  async function runChecks() {
    if (!preview || !ui.dialog.open) return;
    const mine = ++token, source = ui.code.value;
    const guard = checkSource(source);
    results.guard = guard; results.compile = null; results.compiling = false;
    if (!guard.ok) { show(); return; }
    writeDraft({ id: current.id, name: ui.name.value, symbol: ui.symbol.value, source });
    results.compiling = true; show();
    let errors;
    try { errors = await compileUserMethod(preview.renderer, { vertexShader, fragmentShader, source }); }
    catch (error) { errors = [{ slot: null, line: null, message: String(error?.message || error) }]; }
    if (mine !== token || !ui.dialog.open) return;       // typed again meanwhile, or the editor was closed
    results.compiling = false; results.compile = errors;
    if (!errors.length) preview.setSource(source);
    show();
  }

  function saveMethod() {
    if (ui.save.disabled) return;
    const name = ui.name.value.trim().slice(0, 20) || '自作メソッド';
    const symbol = [...ui.symbol.value.trim()][0] || [...name][0];
    const id = current.id ?? newId();
    registerCustom({ id, name, symbol, vertex: ui.code.value });
    clearDraft();
    closeEditor();
    notify(`「${name}」を保存したよ。`);
    onSaved(id);
  }
  async function copyTemplate() {
    try { await navigator.clipboard.writeText(aiTemplate()); notify('AIに頼むひな形をコピーしたよ。チャットに貼って、作りたい動きを書き足してね。'); }
    catch { notify('コピーできませんでした。ブラウザの許可を確認してね。'); }
  }

  function tick(now) {
    frame = requestAnimationFrame(tick);
    if (!preview || !ui.dialog.open || document.hidden) return;
    if (ui.loop.checked) {
      const t = ((now - startedAt) / 4200) % 1;
      ui.progress.value = String(Math.round((t < .5 ? t * 2 : 2 - t * 2) * 100));
    }
    preview.setProgress(Number(ui.progress.value) / 100);
  }
  // the preview (and its GPU context) is made once and kept: a canvas whose context was given up can't get a new one,
  // and a compile that is still running must not lose its renderer under it
  function cleanup() {
    cancelAnimationFrame(frame); clearTimeout(timer); token++;
  }
  function closeEditor() {
    if (ui?.dialog.open) ui.dialog.close();      // fires "close" -> cleanup
    else cleanup();
  }

  function open({ id = null, copyOf = null } = {}) {
    if (ui?.dialog.open) return;
    ui ??= build();
    const base = getCustom(copyOf ?? id);
    const draft = copyOf ? null : readDraft();
    let start;
    if (draft && (draft.id ?? null) === (id ?? null)) { start = draft; notify('前回の下書きを復元したよ。'); }
    else if (base) start = { id: copyOf ? null : id, name: copyOf ? `${base.name}のコピー` : base.name, symbol: base.symbol, source: base.vertex };
    else start = { id: null, name: '', symbol: '', source: NEW_METHOD_SOURCE };
    current = { id: start.id ?? null };
    ui.name.value = start.name ?? ''; ui.symbol.value = start.symbol ?? ''; ui.code.value = start.source ?? '';
    results.guard = null; results.compile = null; results.compiling = false;
    ui.dialog.showModal();
    const box = ui.canvas.getBoundingClientRect();
    preview ??= createPreview(ui.canvas, { vertexShader, fragmentShader });
    preview.resize(Math.max(200, box.width), Math.max(112, box.width * 9 / 16));
    preview.setSource(null);
    preview.setImage(getPreviewImage() ?? makeTestImage());
    startedAt = performance.now();
    frame = requestAnimationFrame(tick);
    show();
    runChecks();
  }

  return { open, close: closeEditor, get isOpen() { return !!ui?.dialog.open; } };
}
```

- [ ] **Step 3: 構文を確認する**

Run: `cd /Volumes/ORICO/UNFOLD/app && S=/private/tmp/claude-501/-Volumes-ORICO-UNFOLD/e8107f15-5f2a-459b-a83e-4e6edb1a6f69/scratchpad && cp method-editor.js "$S/method-editor-check.mjs" && node --check "$S/method-editor-check.mjs" && echo SYNTAX_OK`
Expected: `SYNTAX_OK`

---

### Task 6: `method-menu.js` と `method-tiles.js`

**Files:**
- Create: `app/method-menu.js`
- Create: `app/method-tiles.js`

- [ ] **Step 1: メニューを書く**

`/Volumes/ORICO/UNFOLD/app/method-menu.js`:

```js
// The small menu behind the ⚙ of a custom tile: edit, copy, delete (asks twice), and "try again" for a method that was switched off.
import { getCustom, onRegistryChange, setCustomStatus } from './method-registry.js';

const STATUS_TEXT = { disabled: '停止中', quarantined: '未確認', crashed: '落ちた' };
export const statusText = status => STATUS_TEXT[status] ?? '';

let openMenu = null;
export function closeMethodMenu() { openMenu?.(); }

export function openMethodMenu(anchor, id, { onEdit, onDuplicate, onDelete }) {
  closeMethodMenu();
  const record = getCustom(id);
  if (!record) return;
  const menu = document.createElement('div');
  menu.className = 'method-menu'; menu.setAttribute('role', 'menu');
  const title = document.createElement('div');
  title.className = 'mm-title'; title.textContent = record.name;
  if (record.status !== 'ok') {
    const badge = document.createElement('span');
    badge.className = 'mm-badge'; badge.textContent = statusText(record.status);
    title.append(badge);
  }
  menu.append(title);
  if (record.status !== 'ok' && record.reason) {
    const reason = document.createElement('div');
    reason.className = 'mm-reason'; reason.textContent = record.reason;
    menu.append(reason);
  }
  const item = (label, action, className = '') => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'menuitem'); b.textContent = label;
    if (className) b.className = className;
    b.onclick = () => action(b);
    menu.append(b);
    return b;
  };
  if (record.status !== 'ok') item('もう一度試す', () => { closeMethodMenu(); setCustomStatus(id, 'ok', ''); });
  item('編集', () => { closeMethodMenu(); onEdit(id); });
  item('複製', () => { closeMethodMenu(); onDuplicate(id); });
  let armed = false, timer = 0;
  item('削除', b => {
    if (!armed) { armed = true; b.textContent = 'もう一度押すと削除します'; timer = setTimeout(() => { armed = false; b.textContent = '削除'; }, 3000); return; }
    clearTimeout(timer); closeMethodMenu(); onDelete(id);
  }, 'danger');
  document.body.append(menu);

  const box = anchor.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(box.left, innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(box.bottom + 4, innerHeight - menu.offsetHeight - 8))}px`;

  const away = e => { if (!menu.contains(e.target)) closeMethodMenu(); };
  const escape = e => { if (e.key === 'Escape') closeMethodMenu(); };
  const stopWatching = onRegistryChange(() => closeMethodMenu());
  setTimeout(() => { document.addEventListener('pointerdown', away, true); document.addEventListener('keydown', escape, true); }, 0);
  openMenu = () => {
    clearTimeout(timer); stopWatching();
    document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', escape, true);
    menu.remove(); openMenu = null;
  };
}
```

- [ ] **Step 2: タイルを書く**

`/Volumes/ORICO/UNFOLD/app/method-tiles.js`:

```js
// The tiles of the method grid, shared by the single-image page and the sequence page:
// the 29 built-in methods, then every custom one (blue frame, ⚙ menu, a badge when it is not usable), then the "＋自作メソッド" tile.
import { BUILTIN_KEYS, getCustom, isCustomKey, listCustom, methodIcon, methodLabel } from './method-registry.js';
import { statusText } from './method-menu.js';

function face(key) {
  const [symbol, en] = methodIcon(key);
  const sym = document.createElement('span');
  sym.className = 'symbol'; sym.textContent = symbol;
  const small = document.createElement('small');
  small.textContent = en;
  return [sym, methodLabel(key), small];
}

function tile(key, { onPick, onMenu }) {
  const button = document.createElement('button');
  button.type = 'button'; button.dataset.method = key; button.setAttribute('aria-pressed', 'false');
  button.append(...face(key));
  if (!isCustomKey(key)) { button.onclick = e => onPick(key, e); return button; }

  const record = getCustom(key), usable = record.status === 'ok';
  button.classList.add('added');
  if (!usable) { button.classList.add('unusable'); button.querySelector('small').textContent = statusText(record.status); }
  const gear = document.createElement('button');
  gear.type = 'button'; gear.className = 'tile-gear'; gear.textContent = '⚙';
  gear.title = `${record.name}のメニュー`; gear.setAttribute('aria-label', gear.title);
  button.onclick = e => (usable ? onPick(key, e) : onMenu(key, gear));
  gear.onclick = e => { e.stopPropagation(); onMenu(key, gear); };
  const wrap = document.createElement('div');
  wrap.className = 'method-tile';
  wrap.append(button, gear);
  return wrap;
}

function addTile(onAdd) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'add-method';
  const sym = document.createElement('span');
  sym.className = 'symbol'; sym.textContent = '＋';
  const small = document.createElement('small');
  small.textContent = 'NEW';
  button.append(sym, '自作メソッド', small);
  button.onclick = () => onAdd();
  return button;
}

// rebuilds the tiles only when the list (or a name, symbol or status in it) changed; returns whether it did
export function syncMethodTiles(grid, { onPick, onAdd, onMenu, tag = null }) {
  const keys = [...BUILTIN_KEYS, ...listCustom().map(c => c.id)];
  const signature = keys.map(k => `${k}|${methodLabel(k)}|${methodIcon(k)[0]}|${getCustom(k)?.status ?? ''}`).join(',');
  if (grid.dataset.signature === signature) return false;
  grid.dataset.signature = signature;
  grid.replaceChildren(...keys.map(k => tile(k, { onPick, onMenu })), addTile(onAdd));
  if (tag) tag.textContent = `${keys.length} METHODS`;
  return true;
}

// the buttons that stand for a method (the ⚙ and the "＋" tile are not among them)
export const methodButtons = grid => [...grid.querySelectorAll('button[data-method]')];
```

- [ ] **Step 3: 構文を確認する**

Run: `cd /Volumes/ORICO/UNFOLD/app && S=/private/tmp/claude-501/-Volumes-ORICO-UNFOLD/e8107f15-5f2a-459b-a83e-4e6edb1a6f69/scratchpad && for f in method-menu method-tiles; do cp $f.js "$S/$f-check.mjs" && node --check "$S/$f-check.mjs" && echo "$f SYNTAX_OK"; done`
Expected: `method-menu SYNTAX_OK`、`method-tiles SYNTAX_OK`

---

### Task 6b: 登録したらすぐコンパイルする（`custom-method.js`）— ブラウザ確認で見つけた不足

**見つかったこと：** 計画①は「追加時・読み込み時に事前コンパイルする」つもりだったのに、実際は「◆が使うとき」まで遅延していた。そのせいで、停止中のメソッドを「もう一度試す」で `ok` に戻しても、どの◆にも使われていないと、結果が分からないままだった。

**Files:**
- Modify: `tools/test/variants.test.mjs`、`app/custom-method.js`

- [ ] **Step 1: テストを直す・足す（先に失敗させる）**

`variants.test.mjs`：
1. 「registering the same id again」のテストで、`assert.equal(variants.count(), 0, 'the stale shader is gone');` を `assert.equal(variants.count(), 1, 'the stale shader is gone, the new one is already being prepared');` にする。
2. `after dispose …` のテストの前に、次の3つを足す。
   - 「a custom method is compiled as soon as it is registered, before any ◆ uses it」：`make` のあとで `registerCustom` → `count() === 1` → `tick` のあと `ready` が `['ok']`、`pick(...).uMethod === SLOT_A`。
   - 「a broken custom method is switched off right away, without being used」：失敗する `rule` で `registerCustom` → `tick` で `status === 'disabled'` と理由。`setCustomStatus(…, 'ok', '')`（もう一度試す）→ `tick` でまた `disabled`。
   - 「methods that are already registered when the variants are made are prepared too」：先に `registerCustom` → `make` → `count() === 1` → `tick` のあと `pick(...).uMethod === SLOT_A`。

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/variants.test.mjs 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ fail 4`

- [ ] **Step 2: 実装する**

1. import に `listCustom` を足す：`import { BUILTIN_IDS, DEFAULT_KEY, getCustom, isCustomKey, listCustom, onRegistryChange, resolveKey, setCustomStatus } from './method-registry.js';`
2. `createVariants` の中で、`const stopListening = onRegistryChange(prune);` を次に置き換える。
   ```js
     // every usable custom method gets its own shader as soon as it is registered (or tried again), not when a ◆ first needs it:
     // a broken one is switched off right away, and a working one is ready before it is used
     const prepareAll = () => { for (const c of listCustom()) if (c.status === 'ok') build([c.id]); };
     const stopListening = onRegistryChange(() => { prune(); prepareAll(); });
   ```
3. `return {` の直前に `prepareAll();` を足す（作った時点で登録済みのものも準備する）。

Run: `cd /Volumes/ORICO/UNFOLD && node --test "tools/test/*.test.mjs" 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `ℹ tests 78`、`ℹ pass 78`、`ℹ fail 0`

---

### Task 7: `sequence.js` と `sequence.html` に組み込む

**Files:**
- Modify: `app/sequence.js`、`app/sequence.html`

- [ ] **Step 1: import を直す**

old_string:
```
import { BUILTIN_KEYS, isCustomKey, listCustom, methodEntries, methodIcon, methodLabel, onRegistryChange, registerCustom, setCustomStatus, unregisterCustom } from './method-registry.js';
import { createVariants } from './custom-method.js';
```
new_string:
```
import { BUILTIN_KEYS, listCustom, methodEntries, methodLabel, onRegistryChange, registerCustom, setCustomStatus, unregisterCustom } from './method-registry.js';
import { createVariants } from './custom-method.js';
import { createPersistence, openStore } from './method-library.js';
import { createMethodEditor } from './method-editor.js';
import { openMethodMenu } from './method-menu.js';
import { methodButtons, syncMethodTiles } from './method-tiles.js';
```

- [ ] **Step 2: メソッド一覧（`renderMethodGrid`）を共通タイルで作る形に置き換える**

```bash
cd /Volumes/ORICO/UNFOLD/app && node -e "
const fs = require('fs');
let s = fs.readFileSync('sequence.js', 'utf8');
const start = s.indexOf(\"let methodGridSignature = '';\nfunction renderMethodGrid() {\");
const end = s.indexOf('function showTab(name) {');
if (start < 0 || end < start) throw new Error('renderMethodGrid not found');
const replacement = fs.readFileSync(process.argv[1], 'utf8');
s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync('sequence.js', s);
console.log('replaced', end - start, 'chars');
" /private/tmp/claude-501/-Volumes-ORICO-UNFOLD/e8107f15-5f2a-459b-a83e-4e6edb1a6f69/scratchpad/new-grid.js
```
（その前に、置き換え後のコードを上のパスに書く。次の内容）:

```js
function renderMethodGrid() {
  const grid = $('seq-methods');
  syncMethodTiles(grid, {
    tag: $('seq-methods-tag'),
    onAdd: () => methodEditor.open(),
    onMenu: (id, anchor) => openMethodMenu(anchor, id, { onEdit: key => methodEditor.open({ id: key }), onDuplicate: key => methodEditor.open({ copyOf: key }), onDelete: deleteCustomMethod }),
    onPick: (k, e) => {
      const j = targetTransition();
      if (j < 0) { notice('画像を2枚以上並べると、その間の◆に崩れ方を付けられるよ。'); return; }
      const tr = seq.transitions[j];
      edit(() => { if (e.shiftKey) tr.method2 = tr.method2 === k || tr.method === k ? '' : k; else tr.method = k; seq.selection = { kind: 'tr', i: j }; });
      showTab('edit');
    },
  });
  const j = targetTransition(), tr = seq.transitions[j];
  grid.classList.toggle('disabled', j < 0);
  for (const b of methodButtons(grid)) {
    b.setAttribute('aria-pressed', String(!!tr && tr.method === b.dataset.method));
    b.classList.toggle('second', !!tr && tr.method2 === b.dataset.method);
  }
  $('seq-methods-hint').textContent = j < 0 ? '画像を2枚以上並べると使えるよ。' : `◆ ${j + 1} → ${j + 2} に設定中（⇧＋クリックで「戻り方」）`;
}
// deleting a custom method: the ◆ that used it go back to the default method (like deleting a GLB), then the method is forgotten
function deleteCustomMethod(id) {
  const name = methodLabel(id);
  for (const tr of seq.transitions) { if (tr.method === id) tr.method = 'crumple'; if (tr.method2 === id) tr.method2 = ''; }
  unregisterCustom(id);
  refreshUI();
  notice(`「${name}」を削除しました。使っていた◆は「くしゃくしゃ」に戻しました。`);
}
```
Expected: `replaced …chars`。

- [ ] **Step 3: エディタと保存の開始、確認用の窓口**

1. old: `let renderer, scene, camera, perspCam, mesh, sceneBlur, backdrop, variants;`
   new: `let renderer, scene, camera, perspCam, mesh, sceneBlur, backdrop, variants, methodEditor, methodPersistence;`
2. old: `  onRegistryChange(() => { renderMethodGrid(); renderInspector(); if (!seq.playing) renderAt(seq.t); });`
   new:
   ```
     onRegistryChange(() => { renderMethodGrid(); renderInspector(); if (!seq.playing) renderAt(seq.t); });
     methodEditor = createMethodEditor({ vertexShader, fragmentShader, notify: notice, getPreviewImage: () => (seq.slides[0] ? slideCanvas(seq.slides[0]) : null) });
     // saved custom methods come back when the page opens; from then on every change in the registry is saved
     methodPersistence = createPersistence({ store: openStore(), onError: () => notice('自作メソッドをこのブラウザに保存できませんでした。') });
     methodPersistence.load().then(() => methodPersistence.start(), () => notice('保存した自作メソッドを読み込めませんでした。'));
   ```
3. old: `window.unfoldMethods = { registerCustom, unregisterCustom, setCustomStatus, listCustom, variants };`
   new: `window.unfoldMethods = { registerCustom, unregisterCustom, setCustomStatus, listCustom, variants, editor: methodEditor, persistence: methodPersistence };`

- [ ] **Step 4: `sequence.html` に CSS を足す**

old_string: `<script type="module" src="./sequence.js?v=47"></script>`
new_string: `<script type="module" src="./sequence.js?v=48"></script>`

そして `<head>` の中に、`</head>` の直前へ1行足す。
old_string: `</head>`（`sequence.html` に1か所）
new_string: `<link rel="stylesheet" href="./method-editor.css?v=1">\n</head>`

- [ ] **Step 5: 構文を確認する**

Run: `cd /Volumes/ORICO/UNFOLD/app && S=/private/tmp/claude-501/-Volumes-ORICO-UNFOLD/e8107f15-5f2a-459b-a83e-4e6edb1a6f69/scratchpad && cp sequence.js "$S/sequence-check.mjs" && node --check "$S/sequence-check.mjs" && echo SYNTAX_OK; grep -c "method-editor.css" sequence.html; grep -n "isCustomKey\|methodIcon" sequence.js | head -3`
Expected: `SYNTAX_OK`、`1`、`isCustomKey`・`methodIcon` の行は出ない。

---

### Task 8: `app.js`（1枚モード）と `index.html` に組み込む

**Files:**
- Modify: `app/app.js`、`app/index.html`

- [ ] **Step 1: import と変数**

1. old: `import {BUILTIN_KEYS,isCustomKey,listCustom,methodIcon,methodLabel,onRegistryChange,registerCustom,resolveKey,setCustomStatus,unregisterCustom} from './method-registry.js';`
   new:
   ```
   import {BUILTIN_KEYS,listCustom,onRegistryChange,registerCustom,resolveKey,setCustomStatus,unregisterCustom} from './method-registry.js';
   import {createPersistence,openStore} from './method-library.js';
   import {createMethodEditor} from './method-editor.js';
   import {openMethodMenu} from './method-menu.js';
   import {methodButtons,syncMethodTiles} from './method-tiles.js';
   ```
2. old: `let renderer,scene,camera,mesh,variants,texture,`
   new: `let renderer,scene,camera,mesh,variants,methodEditor,methodPersistence,texture,`

- [ ] **Step 2: タイルを共通のものに置き換える（`wireControls` の中）**

```bash
cd /Volumes/ORICO/UNFOLD/app && node -e "
const fs = require('fs');
let s = fs.readFileSync('app.js', 'utf8');
const click = \"\$('methods').addEventListener('click',e=>{const b=e.target.closest('[data-method]');if(b)setChoice('methods','method',b.dataset.method)});\";
const start = s.indexOf(click);
const marker = ';render()});';
const end = s.indexOf(marker, s.indexOf('onRegistryChange(()=>{state.method=resolveKey(state.method)', start)) + marker.length;
if (start < 0 || end < start) throw new Error('tile block not found');
s = s.slice(0, start) + fs.readFileSync(process.argv[1], 'utf8') + s.slice(end);
fs.writeFileSync('app.js', s);
console.log('replaced', end - start, 'chars');
" /private/tmp/claude-501/-Volumes-ORICO-UNFOLD/e8107f15-5f2a-459b-a83e-4e6edb1a6f69/scratchpad/new-tiles.js
```
（その前に、置き換え後のコードを上のパスに書く。次の内容。インデントは元に合わせて1文字）:

```js
 // the tiles come from the registry (shared with the sequence page): built-in methods, custom ones (blue frame, ⚙ menu), and the "＋自作メソッド" tile
 function renderMethodTiles(){
  syncMethodTiles($('methods'),{
   tag:$('methods-tag'),
   onAdd:()=>methodEditor.open(),
   onMenu:(id,anchor)=>openMethodMenu(anchor,id,{onEdit:key=>methodEditor.open({id:key}),onDuplicate:key=>methodEditor.open({copyOf:key}),onDelete:key=>{unregisterCustom(key);notice('自作メソッドを削除しました。')}}),
   onPick:key=>setChoice('methods','method',key),
  });
  methodButtons($('methods')).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.method===state.method)));
 }
 methodEditor=createMethodEditor({vertexShader,fragmentShader,notify:notice,getPreviewImage:()=>sourceCanvas});
 renderMethodTiles();
 onRegistryChange(()=>{state.method=resolveKey(state.method);renderMethodTiles();render()});
 // saved custom methods come back when the page opens; from then on every change in the registry is saved
 methodPersistence=createPersistence({store:openStore(),onError:()=>notice('自作メソッドをこのブラウザに保存できませんでした。')});
 methodPersistence.load().then(()=>methodPersistence.start(),()=>notice('保存した自作メソッドを読み込めませんでした。'));
 window.unfoldMethods.editor=methodEditor;window.unfoldMethods.persistence=methodPersistence;
```
Expected: `replaced …chars`。

- [ ] **Step 3: `setChoice` が⚙と「＋」のボタンに `aria-pressed` を付けないようにする**

old_string: `` `#${container} button`).forEach(b=>b.setAttribute('aria-pressed',b.dataset[key]===value));render(); ``（`render();` のあとで行が変わる）
new_string: `` `#${container} button:not(.tile-gear):not(.add-method)`).forEach(b=>b.setAttribute('aria-pressed',b.dataset[key]===value));render(); ``

- [ ] **Step 4: `window.unfoldMethods` の作られる順番に注意**

`window.unfoldMethods={...}` は `init`（`window.unfold={...}` の行）で作られるが、タイルの組み込みは `wireControls()`（その前）で実行される。`wireControls` の中で `window.unfoldMethods.editor=…` を書くと、まだ無いので失敗する。そこで、Step 2 の最後の行（`window.unfoldMethods.editor=…`）を削って、`window.unfold=…` の行へ足す。

old_string: `window.unfoldMethods={registerCustom,unregisterCustom,setCustomStatus,listCustom,get variants(){return variants}};`
new_string: `window.unfoldMethods={registerCustom,unregisterCustom,setCustomStatus,listCustom,get variants(){return variants},get editor(){return methodEditor},get persistence(){return methodPersistence}};`

そして、`app.js` から `window.unfoldMethods.editor=methodEditor;window.unfoldMethods.persistence=methodPersistence;` の1行を削除する。

Run: `cd /Volumes/ORICO/UNFOLD/app && grep -c "window.unfoldMethods.editor" app.js`
Expected: `0`

- [ ] **Step 5: `index.html`**

```bash
cd /Volumes/ORICO/UNFOLD/app && node -e "
const fs = require('fs');
let s = fs.readFileSync('index.html', 'utf8');
if (!s.includes('./app.js?v=44')) throw new Error('app.js version not found');
s = s.replace('./app.js?v=44', './app.js?v=45');
const link = '<link rel=\"stylesheet\" href=\"./style.css?v=8\">';
if (!s.includes(link)) throw new Error('style link not found');
s = s.replace(link, link + '\n  <link rel=\"stylesheet\" href=\"./method-editor.css?v=1\">');
fs.writeFileSync('index.html', s);
console.log('ok');
"
grep -c 'method-editor.css' index.html; grep -o 'app.js?v=45' index.html
S=/private/tmp/claude-501/-Volumes-ORICO-UNFOLD/e8107f15-5f2a-459b-a83e-4e6edb1a6f69/scratchpad && cp app.js "$S/app-check.mjs" && node --check "$S/app-check.mjs" && echo SYNTAX_OK; grep -c "isCustomKey\|methodIcon\|methodLabel" app.js
```
Expected: `ok`、`1`、`app.js?v=45`、`SYNTAX_OK`、最後の数は `0`。

- [ ] **Step 6: 単体テストを全部通す**

Run: `cd /Volumes/ORICO/UNFOLD && node --test "tools/test/*.test.mjs" 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `ℹ fail 0`（63 + 7 + 2 + 3 = 75）

---

### Task 9: ブラウザで確認する

**Files:** なし（確認だけ）。`.claude/launch.json` に一時的な設定を足し、最後に元へ戻す。

- [ ] **Step 1: コピーして、サーバーを起動する**

```bash
S=/private/tmp/claude-501/-Volumes-ORICO-UNFOLD/e8107f15-5f2a-459b-a83e-4e6edb1a6f69/scratchpad/unfold-preview
rm -rf "$S/app" && mkdir -p "$S/tools" && cp -R /Volumes/ORICO/UNFOLD/app "$S/app" && cp /Volumes/ORICO/UNFOLD/tools/serve.py "$S/tools/serve.py" && diff -rq /Volumes/ORICO/UNFOLD/app "$S/app" && echo COPY_SAME
```
`.claude/launch.json` に `{ "name": "unfold-serve", "runtimeExecutable": "python3", "runtimeArgs": ["<$S>/tools/serve.py"], "port": 8771 }` を足して `preview_start`（`<$S>` は上の絶対パス）。`navigate` で `http://localhost:8771/sequence.html?empty`。
Expected: `read_console_messages`（`onlyErrors: true`）が空。タイルが 29 個＋「＋自作メソッド」。

```js
({ tiles: document.querySelectorAll('#seq-methods button[data-method]').length, addTile: !!document.querySelector('#seq-methods button.add-method'), tag: document.getElementById('seq-methods-tag').textContent })
```
Expected: `{ tiles: 29, addTile: true, tag: '29 METHODS' }`

- [ ] **Step 2: 3枚入れて、エディタを開く（新規）**

```js
const mk = c => { const k = document.createElement('canvas'); k.width = 640; k.height = 360; const g = k.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 640, 360); g.fillStyle = '#fff'; g.font = '80px sans-serif'; g.fillText(c, 40, 200); return k; };
for (const c of ['#e55', '#5a5', '#55e']) unfoldSeq.addSlide(mk(c), c);
document.querySelector('#seq-methods button.add-method').click();
const wait = async fn => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > 6000) throw new Error('timeout'); await new Promise(r => setTimeout(r, 40)); } };
window.__w = wait;
await wait(() => document.getElementById('method-compile')?.classList.contains('ok'));
const px = (() => { const c = document.getElementById('method-canvas'); const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; const g = t.getContext('2d'); g.drawImage(c, 0, 0); const d = g.getImageData(0, 0, t.width, t.height).data; let nonDark = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) nonDark++; return nonDark; })();
({ open: document.getElementById('method-dialog').open, guard: document.getElementById('method-guard').className, compile: document.getElementById('method-compile').className, saveDisabled: document.getElementById('method-save').disabled, codeStart: document.getElementById('method-code').value.slice(0, 20), previewLitPixels: px > 1000 })
```
Expected: `open: true`、`guard: 'md-check ok'`、`compile: 'md-check ok'`、`saveDisabled: false`、`previewLitPixels: true`。

- [ ] **Step 3: 悪いコードは、それぞれ想定の所で止まる**

```js
const code = document.getElementById('method-code'), wait = window.__w;
const type = async text => { code.value = text; code.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 600)); };
const snap = () => ({ guard: document.getElementById('method-guard').className, compile: document.getElementById('method-compile').className, save: !document.getElementById('method-save').disabled, errors: [...document.querySelectorAll('#method-errors li')].map(li => li.textContent), errLines: [...document.querySelectorAll('#method-gutter .err')].map(d => d.textContent) });
await type('vec3 userMethod(vec2 p, float amount) { while (true) { } return vec3(p, 0.); }');
const hostile = snap();
await type('vec3 userMethod(vec2 p, float amount) {\n  float k = 1.0;\n  return vec3(p, undefinedThing);\n}');
await wait(() => document.getElementById('method-compile').classList.contains('ng'));
const compileError = snap();
await type('vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.) }');
await wait(() => document.getElementById('method-compile').classList.contains('ng'));
const syntax = snap();
({ hostile, compileError, syntax })
```
Expected:
- `hostile`: `guard: 'md-check ng'`、`compile: 'md-check skip'`、`save: false`、`errors` に `while` を含む行。
- `compileError`: `guard: 'md-check ok'`、`compile: 'md-check ng'`、`save: false`、`errors[0]` が `3行目: 「undefinedThing」という名前が見つかりません…`（原文の小さい行も付く）、`errLines: ['3']`。
- `syntax`: `compile: 'md-check ng'`、`errors[0]` が `1行目: 書き方がおかしい所があります…`。

- [ ] **Step 4: 良いコードを保存して、タイルが出る**

```js
const code = document.getElementById('method-code'), wait = window.__w;
const type = async text => { code.value = text; code.dispatchEvent(new Event('input', { bubbles: true })); };
await type(`vec3 userMethod(vec2 p, float amount) { float r = length(p); vec2 q = rot(amount * 3.4 / (r + .35)) * p * (1. - amount * .6 * exp(-r * .5)); return vec3(q, -amount * .9 * exp(-r * r * .7)); }`);
await wait(() => document.getElementById('method-compile').classList.contains('ok'));
const name = document.getElementById('method-name'), symbol = document.getElementById('method-symbol');
name.value = 'テスト渦'; name.dispatchEvent(new Event('input', { bubbles: true })); symbol.value = '渦'; symbol.dispatchEvent(new Event('input', { bubbles: true }));
document.getElementById('method-save').click();
await new Promise(r => setTimeout(r, 300));
await unfoldMethods.persistence.flush();
const rec = unfoldMethods.listCustom().find(c => c.name === 'テスト渦');
window.__savedId = rec?.id;
({ dialogOpen: document.getElementById('method-dialog').open, rec: rec && { status: rec.status, symbol: rec.symbol, rev: rec.rev }, tiles: document.querySelectorAll('#seq-methods button[data-method]').length, tag: document.getElementById('seq-methods-tag').textContent, gear: !!document.querySelector('#seq-methods .method-tile .tile-gear'), addAfter: document.querySelector('#seq-methods').lastElementChild.className, notice: document.getElementById('seq-notice').textContent })
```
Expected: `dialogOpen: false`、`rec: { status: 'ok', symbol: '渦', rev: 1 }`、`tiles: 30`、`tag: '30 METHODS'`、`gear: true`、`addAfter: 'add-method'`、`notice` に「保存したよ」。

- [ ] **Step 5: 保存されている（ページを開き直しても残る）**

`navigate` で `http://localhost:8771/sequence.html?empty`（開き直す）。続けて:

```js
const wait = async fn => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > 6000) throw new Error('timeout'); await new Promise(r => setTimeout(r, 40)); } };
await wait(() => unfoldMethods.listCustom().length > 0);
const rec = unfoldMethods.listCustom()[0];
({ count: unfoldMethods.listCustom().length, name: rec.name, status: rec.status, tiles: document.querySelectorAll('#seq-methods button[data-method]').length, customTile: document.querySelector('#seq-methods button.added')?.textContent })
```
Expected: `{ count: 1, name: 'テスト渦', status: 'ok', tiles: 30, customTile: '渦テスト渦CUSTOM' }`

- [ ] **Step 6: 使える（標準の「渦に吸い込み」と同じ絵）**

```js
const mk = c => { const k = document.createElement('canvas'); k.width = 640; k.height = 360; const g = k.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 640, 360); g.fillStyle = '#fff'; g.font = '80px sans-serif'; g.fillText(c, 40, 200); return k; };
for (const c of ['#e55', '#5a5', '#55e']) unfoldSeq.addSlide(mk(c), c);
const cv = document.getElementById('seq-canvas'), B = 60 / unfoldSeq.seq.bpm, t = 5 * B, tr = unfoldSeq.seq.transitions[0];
const grab = () => { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const g = c.getContext('2d'); g.drawImage(cv, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
const diff = (a, b) => { let max = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d > max) max = d; } return max; };
const wait = async fn => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > 6000) throw new Error('timeout'); await new Promise(r => setTimeout(r, 40)); } };
const id = unfoldMethods.listCustom()[0].id;
tr.method = 'vortex'; unfoldSeq.renderAt(t); const builtIn = grab();
tr.method = id; unfoldSeq.renderAt(t);
await wait(() => unfoldMethods.variants.pick(id).uMethod === 100);
unfoldSeq.renderAt(t);
window.__savedId = id;
({ maxDiff: diff(builtIn, grab()) })
```
Expected: `maxDiff` は 1 以下。

- [ ] **Step 7: ⚙メニューから編集・複製**

```js
const wait = async fn => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > 6000) throw new Error('timeout'); await new Promise(r => setTimeout(r, 40)); } };
document.querySelector('#seq-methods .method-tile .tile-gear').click();
await new Promise(r => setTimeout(r, 100));
const menu = document.querySelector('.method-menu');
const items = [...menu.querySelectorAll('button')].map(b => b.textContent);
// edit
[...menu.querySelectorAll('button')].find(b => b.textContent === '編集').click();
await wait(() => document.getElementById('method-compile')?.classList.contains('ok'));
const edit = { open: document.getElementById('method-dialog').open, name: document.getElementById('method-name').value, symbol: document.getElementById('method-symbol').value, hasCode: document.getElementById('method-code').value.includes('userMethod') };
// change the code a little and save: same id, new revision
const code = document.getElementById('method-code');
code.value = code.value.replace('3.4', '5.0'); code.dispatchEvent(new Event('input', { bubbles: true }));
await wait(() => { const c = document.getElementById('method-compile'); return c.classList.contains('ok') && !document.getElementById('method-save').disabled; });
document.getElementById('method-save').click();
await new Promise(r => setTimeout(r, 200));
await unfoldMethods.persistence.flush();
const after = unfoldMethods.listCustom();
const rec = after.find(c => c.id === window.__savedId);
// duplicate
document.querySelector('#seq-methods .method-tile .tile-gear').click();
await new Promise(r => setTimeout(r, 100));
[...document.querySelectorAll('.method-menu button')].find(b => b.textContent === '複製').click();
await wait(() => document.getElementById('method-compile')?.classList.contains('ok'));
const dup = { name: document.getElementById('method-name').value };
document.getElementById('method-save').click();
await new Promise(r => setTimeout(r, 200));
await unfoldMethods.persistence.flush();
({ items, edit, sameIdNewRev: rec && { rev: rec.rev, has50: rec.vertex.includes('5.0') }, countAfterEdit: after.length, dup, countAfterDup: unfoldMethods.listCustom().length })
```
Expected: `items: ['編集', '複製', '削除']`、`edit: { open: true, name: 'テスト渦', symbol: '渦', hasCode: true }`、`sameIdNewRev: { rev: 2 以上, has50: true }`、`countAfterEdit: 1`、`dup: { name: 'テスト渦のコピー' }`、`countAfterDup: 2`。

- [ ] **Step 8: 壊れたメソッドの「停止中」バッジと「もう一度試す」**

```js
const wait = async fn => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > 6000) throw new Error('timeout'); await new Promise(r => setTimeout(r, 40)); } };
const tr = unfoldSeq.seq.transitions[0], B = 60 / unfoldSeq.seq.bpm;
unfoldMethods.registerCustom({ id: 'cm-test-bad', name: '壊れ', symbol: '壊', vertex: 'vec3 userMethod(vec2 p, float amount) {\n  float k = 1.0;\n  return vec3(p, undefinedThing);\n}' });
tr.method = 'cm-test-bad'; unfoldSeq.renderAt(5 * B);
await wait(() => unfoldMethods.listCustom().find(c => c.id === 'cm-test-bad').status === 'disabled');
await new Promise(r => setTimeout(r, 100));
const badTile = [...document.querySelectorAll('#seq-methods button.unusable')].find(b => b.dataset.method === 'cm-test-bad');
const tile = { badge: badTile?.querySelector('small')?.textContent, unusable: !!badTile };
badTile.click();                                   // an unusable tile opens its menu instead of being used
await new Promise(r => setTimeout(r, 100));
const menu = document.querySelector('.method-menu');
const shown = { reason: menu?.querySelector('.mm-reason')?.textContent, items: [...menu.querySelectorAll('button')].map(b => b.textContent) };
[...menu.querySelectorAll('button')].find(b => b.textContent === 'もう一度試す').click();
await wait(() => unfoldMethods.listCustom().find(c => c.id === 'cm-test-bad').status === 'disabled' && !document.querySelector('.method-menu'));
({ tile, shown, afterRetry: unfoldMethods.listCustom().find(c => c.id === 'cm-test-bad').status })
```
Expected: `tile: { badge: '停止中', unusable: true }`、`shown.reason` が `3行目: 'undefinedThing' : undeclared identifier`、`shown.items` は `['もう一度試す', '編集', '複製', '削除']`、`afterRetry: 'disabled'`（もう一度コンパイルして、また失敗）。

- [ ] **Step 9: 削除（2回押す）で、◆が「くしゃくしゃ」に戻り、保存からも消える**

```js
const wait = async fn => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > 6000) throw new Error('timeout'); await new Promise(r => setTimeout(r, 40)); } };
const tr = unfoldSeq.seq.transitions[0];
const id = window.__savedId;
tr.method = id;
const gear = [...document.querySelectorAll('#seq-methods .method-tile')].find(w => w.querySelector('button[data-method]').dataset.method === id).querySelector('.tile-gear');
gear.click(); await new Promise(r => setTimeout(r, 100));
const del = [...document.querySelectorAll('.method-menu button')].find(b => b.textContent === '削除');
del.click();
const afterFirst = { text: del.textContent, stillThere: !!unfoldMethods.listCustom().find(c => c.id === id) };
del.click();
await new Promise(r => setTimeout(r, 200));
await unfoldMethods.persistence.flush();
({ afterFirst, gone: !unfoldMethods.listCustom().find(c => c.id === id), transitionBack: tr.method, menuClosed: !document.querySelector('.method-menu'), notice: document.getElementById('seq-notice').textContent })
```
Expected: `afterFirst: { text: 'もう一度押すと削除します', stillThere: true }`、`gone: true`、`transitionBack: 'crumple'`、`menuClosed: true`、`notice` に「削除しました」。

- [ ] **Step 10: 下書きの復元、サンプル、AIに頼むひな形**

```js
const wait = async fn => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > 6000) throw new Error('timeout'); await new Promise(r => setTimeout(r, 40)); } };
// draft: type something valid in a new editor, cancel, open again
document.querySelector('#seq-methods button.add-method').click();
await wait(() => document.getElementById('method-compile')?.classList.contains('ok'));
const code = document.getElementById('method-code');
code.value = '// my draft\nvec3 userMethod(vec2 p, float amount) { return vec3(p * (1. - amount * .1), 0.); }'; code.dispatchEvent(new Event('input', { bubbles: true }));
await wait(() => document.getElementById('method-compile').classList.contains('ok') && !!localStorage.getItem('unfold-method-draft'));
document.getElementById('method-cancel').click();
await new Promise(r => setTimeout(r, 100));
const closed = !document.getElementById('method-dialog').open;
document.querySelector('#seq-methods button.add-method').click();
await new Promise(r => setTimeout(r, 200));
const restored = { restored: document.getElementById('method-code').value.startsWith('// my draft'), notice: document.getElementById('seq-notice').textContent };
// samples: each one passes both checks
const select = document.getElementById('method-samples');
const sampleResults = {};
for (const opt of [...select.options].filter(o => o.value)) {
  select.value = opt.value; select.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 120));
  await wait(() => { const c = document.getElementById('method-compile'); return c.classList.contains('ok') || c.classList.contains('ng'); });
  sampleResults[opt.value] = document.getElementById('method-compile').className.replace('md-check ', '') + '/' + (document.getElementById('method-save').disabled ? 'save-off' : 'save-on');
}
// the AI template button: copies, or says why not
const copy = { ok: true };
try { document.getElementById('method-ai').click(); await new Promise(r => setTimeout(r, 200)); copy.notice = document.getElementById('seq-notice').textContent; } catch (e) { copy.ok = false; }
document.getElementById('method-cancel').click();
({ closed, restored, sampleResults, copy })
```
Expected: `closed: true`、`restored.restored: true`、`restored.notice` に「下書きを復元」、`sampleResults` は4つとも `'ok/save-on'`、`copy.notice` が「コピーしたよ」か「コピーできませんでした」のどちらか（ブラウザの許可しだい）。

- [ ] **Step 11: 見た目を目で確認する**

`resize_window`（1440×900）。エディタを開いて（`unfoldMethods.editor.open()`）、`computer {action: "screenshot"}`。
Expected: 左にコード欄（行番号つき）、チェック2行、ヒント。右にプレビューと「崩れ具合」スライダー。ボタンは「キャンセル」「保存」。続けて、メニューを開いた状態（`.tile-gear` をクリック）と、シーケンスの一覧（水色の枠の自作タイル、停止中のバッジ、最後の「＋自作メソッド」）も撮る。

- [ ] **Step 12: テスト用に作った自作メソッドを全部消す**

保存はサイトごと（`localhost:8771`）に1つなので、シーケンスで作った「テスト渦のコピー」や `cm-test-bad` が1枚モードにも出てしまう。確認の前に消しておく（消した分は IndexedDB からも消える）。

```js
for (const c of unfoldMethods.listCustom()) unfoldMethods.unregisterCustom(c.id);
await unfoldMethods.persistence.flush();
localStorage.removeItem('unfold-method-draft');
({ left: unfoldMethods.listCustom().length })
```
Expected: `{ left: 0 }`

- [ ] **Step 13: 1枚モード**

`navigate` で `http://localhost:8771/index.html`。`read_console_messages`（`onlyErrors: true`）が空であること。

```js
const wait = async fn => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > 6000) throw new Error('timeout'); await new Promise(r => setTimeout(r, 40)); } };
await wait(() => document.querySelectorAll('#methods button[data-method]').length >= 29);
const before = { tiles: document.querySelectorAll('#methods button[data-method]').length, add: !!document.querySelector('#methods button.add-method'), tag: document.getElementById('methods-tag').textContent, pressed: [...document.querySelectorAll('#methods button[aria-pressed=true]')].map(b => b.dataset.method) };
// create one through the editor
document.querySelector('#methods button.add-method').click();
await wait(() => document.getElementById('method-compile')?.classList.contains('ok'));
document.getElementById('method-name').value = '1枚用'; document.getElementById('method-symbol').value = '一';
document.getElementById('method-name').dispatchEvent(new Event('input', { bubbles: true }));
document.getElementById('method-save').click();
await new Promise(r => setTimeout(r, 200));
await unfoldMethods.persistence.flush();
const tile = [...document.querySelectorAll('#methods button.added')].find(b => b.textContent.includes('1枚用'));
tile.click();
await wait(() => unfoldMethods.variants.pick(unfold.state.method).uMethod === 100);
const after = { tiles: document.querySelectorAll('#methods button[data-method]').length, tag: document.getElementById('methods-tag').textContent, method: unfold.state.method.startsWith('cm-'), pressed: [...document.querySelectorAll('#methods button[aria-pressed=true]')].map(b => b.className), gearPressedAttr: document.querySelector('#methods .tile-gear').getAttribute('aria-pressed') };
// delete it again
const gear = tile.parentElement.querySelector('.tile-gear'); gear.click(); await new Promise(r => setTimeout(r, 100));
const del = [...document.querySelectorAll('.method-menu button')].find(b => b.textContent === '削除'); del.click(); del.click();
await new Promise(r => setTimeout(r, 200)); await unfoldMethods.persistence.flush();
({ before, after, afterDelete: { tiles: document.querySelectorAll('#methods button[data-method]').length, method: unfold.state.method, saved: unfoldMethods.listCustom().length } })
```
Expected: `before: { tiles: 29, add: true, tag: '29 METHODS', pressed: ['crumple'] }`、`after: { tiles: 30, tag: '30 METHODS', method: true, pressed: ['added'], gearPressedAttr: null }`、`afterDelete: { tiles: 29, method: 'crumple', saved: 0 }`。

- [ ] **Step 14: 標準の29個は変わっていない（もう一度、変更前と比べる）**

計画①の Step 11 と同じ手順。変更前の `app/` は、今回のバックアップ（`archive/app-before-custom-editor-2026-10-03/`）を別ポート（8772）で配信する。**同じタブ**で両方を開き、1枚モードは 29メソッド × `unfold.setTime(.2)`・`(.5)` の58点、シーケンスは `addSlide` で3枚入れて 29メソッド × ビート5・6・8・10 と `shatter`→`melt` のミックス（ビート6.5）の117点のハッシュを比べる。
Expected: 変更前と今のまとめが同じになる（キャンバスの大きさはタブで変わるので、**同じタブ**で両方を取る）。結果（2026-10-03）：1枚モード 58/58 一致（まとめ `55e1de86`）、シーケンス 117/117 一致（まとめ `2964a23`）。

- [ ] **Step 15: 片付ける**

1枚モードで作ったテスト用の自作メソッドも、削除済みであること（`unfoldMethods.listCustom().length` が 0。残っていれば `unregisterCustom` して `await unfoldMethods.persistence.flush()`）。`localStorage.removeItem('unfold-method-draft')`。`preview_stop`（起動した全サーバー）。`resize_window` を `desktop` に戻す。`.claude/launch.json` から `unfold-serve`・`unfold-old` の設定を消して、元の1設定に戻す。

---

### Task 10: 仕上げ

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README に更新メモを足す**

old_string: `公開サイト: https://unfold-test.netlify.app/`
new_string:
```
- 自作メソッドのエディタ（ローカルのみ・未公開）：メソッド一覧の最後の「＋自作メソッド」でエディタが開きます（1枚モード・シーケンス共通）。左にコード、右にプレビュー、下に「書き方のチェック」と「GPUでのコンパイル」の結果。サンプルから始める／AIに頼むひな形をコピー／下書きの自動保存つき。自作タイルは水色の枠で、⚙から編集・複製・削除・もう一度試す。保存先はこのブラウザ（IndexedDB）。仕組みは `app/method-editor.js`・`app/method-library.js` ほか。変更前の `app/` は `archive/app-before-custom-editor-2026-10-03/`。実装計画は `docs/superpowers/plans/2026-10-03-custom-methods-2-editor.md`。

公開サイト: https://unfold-test.netlify.app/
```

- [ ] **Step 2: 差分が意図した範囲か確認する**

Run: `cd /Volumes/ORICO/UNFOLD && diff -rq archive/app-before-custom-editor-2026-10-03 app`
Expected（この順で、これだけ）:
```
Files archive/app-before-custom-editor-2026-10-03/app.js and app/app.js differ
Files archive/app-before-custom-editor-2026-10-03/custom-method.js and app/custom-method.js differ
Files archive/app-before-custom-editor-2026-10-03/index.html and app/index.html differ
Only in app: method-editor.css
Only in app: method-editor.js
Only in app: method-library.js
Only in app: method-menu.js
Only in app: method-messages.js
Only in app: method-preview.js
Only in app: method-samples.js
Only in app: method-tiles.js
Files archive/app-before-custom-editor-2026-10-03/sequence.html and app/sequence.html differ
Files archive/app-before-custom-editor-2026-10-03/sequence.js and app/sequence.js differ
```
`project.js`・`motion.js`・`method-registry.js`・`method-guard.js` は出ない。

- [ ] **Step 3: 全部の単体テストを通す**

Run: `cd /Volumes/ORICO/UNFOLD && node --test "tools/test/*.test.mjs" 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `ℹ tests 78`、`ℹ fail 0`

- [ ] **Step 4: 公開について**

保存・エディタ・タイルは入ったが、段2の試し描画（重さ・「何も映ってない」）、段3の見張り、段5のクラッシュ印、`.unfold` の同梱と隔離は計画③。**公開は計画③のあとにする**（今の状態だと、重すぎるコードを書かれたときの最後の砦が無い）。

---

## 次の計画（この計画のあとで、実物に合わせて書く）

**③ 安全とプロジェクト**：段2の試し描画（試しメッシュで5段階を描いて、標準メソッドの重いものの4倍まで。全面透明／変化なしの警告）、段3の使用中の見張り（直近30フレームの中央値が基準の4倍かつ50ms以上で停止）、段5のクラッシュ印（`localStorage` の「試用中」、`pagehide` で消す、`webglcontextlost`）、`.unfold` への同梱（version 2）と取り込み時の隔離（`hash` で再利用／未確認で新しいid、バナー、「有効にする」）、書き出し前に自作メソッドのコンパイル完了を待つ（`exportVideo` と `startExport` の最初）。
