# 自作メソッド ③b `.unfold` への同梱と取り込み時の隔離 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使っている自作メソッドを `.unfold` ファイルに同梱して、他の人のファイルを開いたときは、メソッドを**「未確認」の隔離状態**で取り込む。隔離中のコードは、作者が「有効にする」を押すまで、GPU に載せない。有効にするときは、書き方チェック・コンパイル・試し描画を通ったものだけが使える。

**Architecture:** 純粋な部品（`method-project.js`＝同梱・検査・id の付け替え、`method-verify.js` の `verifyMethod`＝確認の手順）を Node でテストする。取り込みは `restoreProject` の**前**に、`json` の中の◆の参照を付け替えてから渡す。隔離中のメソッドは `status: 'quarantined'` なので、`prepareAll`（登録時のコンパイル）・`pick`・書き出しの対象にならない。自分のブラウザの自動保存には同梱せず、ファイルへの書き出し（`exportFile`）だけに入れる。

**Tech Stack:** バニラ JS（ES modules）、IndexedDB、テストは `node:test`、ブラウザ確認は Claude のブラウザペイン。

**設計書:** `docs/superpowers/specs/2026-10-02-custom-methods-design.md`（段4）／前の計画: ①エンジン、②エディタ、③a 実行時の安全（実行済み）

**設計書からの小さな変更:**
- ファイルの `hash` は**信用しない**。取り込むとき、コードから自分で計算する（同梱するデータにも `hash` は入れない）。
- 「コードを見る」は、エディタを**自動チェックなし**で開く（落ちた下書きと同じ「チェックする」ボタン）。隔離中のコードを、見る前に GPU で動かさないため。
- 隔離中のメソッドには、メニューの「もう一度試す」（チェックなしで `ok` に戻す）を出さない。代わりに「有効にする」（確認してから `ok`）を出す。
- 確認の途中でブラウザが落ちたときは、そのメソッドは「未確認」のまま、理由に「確認の途中で落ちたみたい」と書く。

**このプロジェクトは git リポジトリではない。** 作業前に `app/` をバックアップし（Task 0）、最後に差分を確認する（Task 8）。

**import の書き方（重要）:** 他のモジュールから読まれるファイルには `?v=` を付けない。`method-project.js`・`method-verify.js`・`method-banner.js` も同じ。

**確認用サーバー:** `preview_start` の Python は `/Volumes/ORICO` を読めない。`app/` と `tools/serve.py` をスクラッチパッドにコピーして配信する。ブラウザペインが非表示だと `addImageFromUrl` が止まるので `unfoldSeq.addSlide(canvas, name)` を使う。開き直しのあとは、ページ内のエラーを `addEventListener('error', …)` で自分で捕まえる（コンソールの履歴は前のページの分が残る）。

---

## ファイル構成

| ファイル | 変更 | 役割 |
|---|---|---|
| `app/method-project.js` | 新規 | 同梱するメソッドの集め方・検査・id の付け替え（純粋） |
| `app/method-verify.js` | 新規 | 「有効にする」の確認（`verifyMethod`＝純粋に近い手順、`createEnabler`＝つなぎ） |
| `app/method-banner.js` | 新規 | 「未確認のメソッドが N 個あります」のバナー |
| `app/method-registry.js` | 変更 | `newCustomId()` |
| `app/method-safety.js` | 変更 | 確認中の印（`armVerify` / `disarmVerify`）と、その復帰 |
| `app/method-menu.js` | 変更 | 隔離中のメニュー（有効にする・コードを見る） |
| `app/method-editor.js` | 変更 | `open({ id, review: true })`＝自動チェックなしで開く |
| `app/project.js` | 変更 | `exportFile` が `state.methods` を同梱（version 2） |
| `app/sequence.js` / `sequence.html` | 変更 | 書き出し・取り込み・バナー・有効にする |
| `app/app.js` | 変更 | 1枚モードのメニューにも「有効にする」「コードを見る」 |
| `app/method-editor.css` | 変更 | バナーの見た目 |
| `tools/test/project-methods.test.mjs` ほか | 新規 | 単体テスト |

---

### Task 0: バックアップ

- [ ] **Step 1: コピーして確認する**

```bash
cp -R /Volumes/ORICO/UNFOLD/app /Volumes/ORICO/UNFOLD/archive/app-before-custom-project-2026-10-03 && diff -rq /Volumes/ORICO/UNFOLD/app /Volumes/ORICO/UNFOLD/archive/app-before-custom-project-2026-10-03 && echo SAME
```
Expected: `SAME`

---

### Task 1: `method-registry.js` — `newCustomId()` — TDD

**Files:**
- Modify: `tools/test/registry.test.mjs`、`app/method-registry.js`、`app/method-editor.js`

- [ ] **Step 1: テストを足す（先に失敗させる）**

`tools/test/registry.test.mjs` の末尾に足す:

```js
test('newCustomId makes ids that start with cm- and do not repeat', () => {
  const ids = new Set(Array.from({ length: 50 }, () => R.newCustomId()));
  assert.equal(ids.size, 50);
  for (const id of ids) assert.ok(R.isCustomKey(id) && id.length > R.CUSTOM_PREFIX.length + 8, id);
});
```

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/registry.test.mjs 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ fail 1`

- [ ] **Step 2: 実装する**

`app/method-registry.js` の `isCustomKey` の行の直後に足す:

```js
// a new id for a custom method (crypto.randomUUID exists on https and localhost; elsewhere a random string stands in)
export const newCustomId = () => `${CUSTOM_PREFIX}${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`}`;
```

`app/method-editor.js`：自前の `newId` を、これに置き換える。
1. old: `import { getCustom, registerCustom } from './method-registry.js';` → new: `import { getCustom, newCustomId, registerCustom } from './method-registry.js';`
2. old: `const newId = () => \`cm-${globalThis.crypto?.randomUUID?.() ?? \`${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}\`}\`;\n` → new: （空）
3. old: `const id = current.id ?? newId();` → new: `const id = current.id ?? newCustomId();`

Run: `cd /Volumes/ORICO/UNFOLD && node --test "tools/test/*.test.mjs" 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `ℹ fail 0`

---

### Task 2: `method-project.js`（同梱・検査・付け替え）— TDD

**Files:**
- Create: `tools/test/project-methods.test.mjs`
- Create: `app/method-project.js`

- [ ] **Step 1: 失敗するテストを書く**

`/Volumes/ORICO/UNFOLD/tools/test/project-methods.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROJECT_METHODS, collectMethods, planImport, projectVersion, remapTransitions, usedMethodIds, validateEmbedded } from '../../app/method-project.js';
import { sourceHash } from '../../app/method-library.js';
import { GOOD } from './fixtures/methods.mjs';

const tr = (method, method2 = '') => ({ method, method2, shape: 'sphere', beats: 8 });

test('usedMethodIds: the custom methods the transitions use, once each', () => {
  assert.deepEqual(usedMethodIds([tr('twist'), tr('cm-a', 'cm-b'), tr('cm-a'), tr('crumple', 'cm-c')]), ['cm-a', 'cm-b', 'cm-c']);
  assert.deepEqual(usedMethodIds([tr('twist', 'wave')]), []);
  assert.deepEqual(usedMethodIds(undefined), []);
  assert.deepEqual(usedMethodIds([null, {}, tr(undefined, null)]), []);
});

test('collectMethods: what goes into the file (no status, no hash; look and params stay empty)', () => {
  const local = { 'cm-a': { id: 'cm-a', name: 'A', symbol: 'あ', vertex: GOOD.vortex, status: 'ok', rev: 4, reason: '' }, 'cm-b': { id: 'cm-b', name: 'B', symbol: 'B', vertex: GOOD.wave, status: 'quarantined', rev: 1, reason: 'x' } };
  const methods = collectMethods([tr('cm-a'), tr('crumple', 'cm-b'), tr('cm-gone')], id => local[id]);
  assert.deepEqual(methods, [
    { id: 'cm-a', name: 'A', symbol: 'あ', vertex: GOOD.vortex, look: null, params: [] },
    { id: 'cm-b', name: 'B', symbol: 'B', vertex: GOOD.wave, look: null, params: [] },
  ]);
});

test('projectVersion is 2 only when methods are inside, so files without them stay readable by older pages', () => {
  assert.equal(projectVersion([]), 1);
  assert.equal(projectVersion(undefined), 1);
  assert.equal(projectVersion([{ id: 'cm-a' }]), 2);
});

const entry = (extra = {}) => ({ id: 'cm-x', name: 'X', symbol: 'エ', vertex: GOOD.vortex, ...extra });

test('validateEmbedded: a good list passes (and only the fields we use are kept)', () => {
  const { methods, problems } = validateEmbedded([entry({ hash: 'evil', status: 'ok', look: 'x', params: [1] })]);
  assert.deepEqual(problems, []);
  assert.deepEqual(methods, [{ id: 'cm-x', name: 'X', symbol: 'エ', vertex: GOOD.vortex }]);
});

test('validateEmbedded: nothing is fine; a list that is not a list is not', () => {
  assert.deepEqual(validateEmbedded(undefined), { methods: [], problems: [] });
  assert.deepEqual(validateEmbedded(null), { methods: [], problems: [] });
  assert.equal(validateEmbedded({ not: 'a list' }).methods.length, 0);
  assert.equal(validateEmbedded('oops').problems.length, 1);
});

test('validateEmbedded: bad entries are dropped one by one, with a reason', () => {
  const bad = [null, 5, 'x', entry({ id: 'glb-1' }), entry({ id: 42 }), entry({ id: 'cm-' + 'z'.repeat(100) }), entry({ vertex: '' }), entry({ vertex: 12 }),
    entry({ vertex: 'a'.repeat(PROJECT_METHODS.maxChars + 1) })];
  const { methods, problems } = validateEmbedded([...bad, entry({ id: 'cm-ok' })]);
  assert.deepEqual(methods.map(m => m.id), ['cm-ok']);
  assert.equal(problems.length, bad.length);
});

test('validateEmbedded: the same id twice is one method (the first)', () => {
  const { methods, problems } = validateEmbedded([entry({ vertex: 'first' }), entry({ vertex: 'second' })]);
  assert.deepEqual(methods.map(m => m.vertex), ['first']);
  assert.equal(problems.length, 1);
});

test('validateEmbedded: too many methods are cut off', () => {
  const many = Array.from({ length: PROJECT_METHODS.maxCount + 5 }, (_, i) => entry({ id: `cm-${i}` }));
  const { methods, problems } = validateEmbedded(many);
  assert.equal(methods.length, PROJECT_METHODS.maxCount);
  assert.equal(problems.length, 1);
});

test('validateEmbedded: names and symbols are cleaned up', () => {
  const { methods } = validateEmbedded([entry({ id: 'cm-1', name: '  ' + 'あ'.repeat(40) + '  ', symbol: '渦巻' }), entry({ id: 'cm-2', name: 5, symbol: null }), entry({ id: 'cm-3', name: '<b>x</b>', symbol: '' })]);
  assert.equal([...methods[0].name].length, PROJECT_METHODS.maxName);
  assert.equal(methods[0].symbol, '渦');
  assert.equal(methods[1].name, '取り込んだメソッド');
  assert.equal(methods[1].symbol, '取');
  assert.equal(methods[2].name, '<b>x</b>', 'text is kept as text (the page never puts it in as HTML)');
  assert.equal(methods[2].symbol, '<');
});

test('validateEmbedded: a file from a newer version is not guessed at', () => {
  const { methods, problems } = validateEmbedded([entry()], 3);
  assert.deepEqual(methods, []);
  assert.equal(problems.length, 1);
  assert.equal(validateEmbedded([entry()], 2).methods.length, 1);
  assert.equal(validateEmbedded([entry()], 1).methods.length, 1, 'the version is not trusted either way');
});

const idMaker = () => { let n = 0; return () => `cm-new${++n}`; };

test('planImport: code that is already here is reused (found by the code, not by the id)', async () => {
  const plan = await planImport({
    embedded: [{ id: 'cm-file-id', name: 'V', symbol: 'V', vertex: GOOD.vortex }],
    local: [{ id: 'cm-local-id', vertex: GOOD.vortex }, { id: 'cm-other', vertex: GOOD.wave }],
    hash: sourceHash, newId: idMaker(),
  });
  assert.deepEqual([...plan.map], [['cm-file-id', 'cm-local-id']]);
  assert.deepEqual(plan.reused, ['cm-local-id']);
  assert.deepEqual(plan.created, []);
});

test('planImport: code that is new gets a new id of its own', async () => {
  const plan = await planImport({ embedded: [{ id: 'cm-file-id', name: 'W', symbol: 'W', vertex: GOOD.wave }], local: [{ id: 'cm-local', vertex: GOOD.vortex }], hash: sourceHash, newId: idMaker() });
  assert.deepEqual([...plan.map], [['cm-file-id', 'cm-new1']]);
  assert.deepEqual(plan.created, [{ id: 'cm-new1', name: 'W', symbol: 'W', vertex: GOOD.wave }]);
  assert.deepEqual(plan.reused, []);
});

test('planImport: a file that says "cm-local" but brings other code does not touch the local method', async () => {
  const plan = await planImport({ embedded: [{ id: 'cm-local', name: 'Evil', symbol: 'E', vertex: GOOD.wave }], local: [{ id: 'cm-local', vertex: GOOD.vortex }], hash: sourceHash, newId: idMaker() });
  assert.equal(plan.map.get('cm-local'), 'cm-new1');
  assert.equal(plan.created.length, 1);
  assert.deepEqual(plan.reused, []);
});

test('planImport: the same code twice in a file is one method', async () => {
  const plan = await planImport({
    embedded: [{ id: 'cm-1', name: 'A', symbol: 'A', vertex: GOOD.wave }, { id: 'cm-2', name: 'B', symbol: 'B', vertex: GOOD.wave }],
    local: [], hash: sourceHash, newId: idMaker(),
  });
  assert.equal(plan.created.length, 1);
  assert.equal(plan.map.get('cm-1'), plan.map.get('cm-2'));
  assert.deepEqual(plan.reused, []);
});

test('remapTransitions: ids are replaced, everything else about a transition stays', () => {
  const map = new Map([['cm-file', 'cm-local']]);
  const out = remapTransitions([{ ...tr('cm-file', 'cm-file'), text: 'x', viewX: 3 }, tr('twist', 'wave')], map);
  assert.deepEqual(out[0], { method: 'cm-local', method2: 'cm-local', shape: 'sphere', beats: 8, text: 'x', viewX: 3 });
  assert.deepEqual(out[1], tr('twist', 'wave'));
});

test('remapTransitions: a custom id that the file did not bring becomes the default method (never a local method that happens to share the id)', () => {
  const out = remapTransitions([tr('cm-not-in-file', 'cm-not-in-file')], new Map());
  assert.equal(out[0].method, 'crumple');
  assert.equal(out[0].method2, '');
});

test('remapTransitions: odd input does not throw', () => {
  assert.deepEqual(remapTransitions(undefined, new Map()), []);
  assert.deepEqual(remapTransitions([null, 7], new Map()), [null, 7]);
});
```

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/project-methods.test.mjs 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|^ℹ (pass|fail)" | head -3`
Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 2: 実装を書く**

`/Volumes/ORICO/UNFOLD/app/method-project.js`:

```js
// Custom methods inside a .unfold file: which ones go in, how a file from someone else is checked, and how its ids are matched with what is here.
// A file is not trusted: only the fields we use are kept, sizes are limited, and the hash is worked out from the code (never read from the file).
import { LIMITS } from './method-guard.js';
import { CUSTOM_PREFIX, DEFAULT_KEY, isCustomKey } from './method-registry.js';

export const PROJECT_METHODS = { maxCount: 50, maxName: 20, maxId: 80, maxChars: LIMITS.maxChars, newestVersion: 2 };

// the custom methods the transitions use, once each
export function usedMethodIds(transitions) {
  const ids = new Set();
  for (const tr of transitions ?? []) for (const key of [tr?.method, tr?.method2]) if (isCustomKey(key)) ids.add(key);
  return [...ids];
}

// what goes into the file for those methods that exist here (look and params are for later)
export function collectMethods(transitions, getCustom) {
  const out = [];
  for (const id of usedMethodIds(transitions)) {
    const c = getCustom(id);
    if (c) out.push({ id: c.id, name: c.name, symbol: c.symbol, vertex: c.vertex, look: null, params: [] });
  }
  return out;
}

// 2 only when methods are inside, so a project without custom methods stays a version 1 file that older pages can open
export const projectVersion = methods => (methods?.length ? 2 : 1);

// `raw` is json.methods of a file somebody gave us. Returns the entries that are fine and a Japanese line for every one that was dropped.
export function validateEmbedded(raw, version = PROJECT_METHODS.newestVersion) {
  const methods = [], problems = [];
  if (raw === undefined || raw === null) return { methods, problems };
  if (typeof version === 'number' && version > PROJECT_METHODS.newestVersion) return { methods, problems: ['新しい形式のファイルなので、メソッドは取り込みませんでした。'] };
  if (!Array.isArray(raw)) return { methods, problems: ['メソッドの一覧の形が正しくないので、取り込みませんでした。'] };
  const seen = new Set();
  raw.forEach((m, i) => {
    const label = `${i + 1}番目のメソッド`;
    if (methods.length >= PROJECT_METHODS.maxCount) { if (methods.length === PROJECT_METHODS.maxCount && !seen.has('#cut')) { seen.add('#cut'); problems.push(`メソッドが多すぎます（${PROJECT_METHODS.maxCount}個まで）。残りは取り込みませんでした。`); } return; }
    if (!m || typeof m !== 'object') { problems.push(`${label}は、形が正しくありません。`); return; }
    if (typeof m.id !== 'string' || !m.id.startsWith(CUSTOM_PREFIX) || m.id.length > PROJECT_METHODS.maxId) { problems.push(`${label}は、idが正しくありません。`); return; }
    if (seen.has(m.id)) { problems.push(`${label}は、同じidが2回あるので取り込みませんでした。`); return; }
    if (typeof m.vertex !== 'string' || !m.vertex.trim()) { problems.push(`${label}は、コードがありません。`); return; }
    if (m.vertex.length > PROJECT_METHODS.maxChars) { problems.push(`${label}は、コードが長すぎます（${PROJECT_METHODS.maxChars}文字まで）。`); return; }
    seen.add(m.id);
    const name = (typeof m.name === 'string' ? m.name.trim() : '');
    const clipped = [...name].slice(0, PROJECT_METHODS.maxName).join('') || '取り込んだメソッド';
    const symbol = [...String(typeof m.symbol === 'string' ? m.symbol : '')][0] || [...clipped][0];
    methods.push({ id: m.id, name: clipped, symbol, vertex: m.vertex });
  });
  return { methods, problems };
}

// Which local method is each embedded one? By the code (hash), not by the id: the same code is reused, new code gets a new id of its own.
// local: [{ id, vertex }]. hash: async code -> string. newId: () => a new custom id. Returns { map: fileId -> localId, reused: [localId], created: [entry with its new id] }.
export async function planImport({ embedded, local, hash, newId }) {
  const byHash = new Map();
  for (const l of local) { const h = await hash(l.vertex); if (!byHash.has(h)) byHash.set(h, l.id); }
  const map = new Map(), reused = [], created = [], createdIds = new Set();
  for (const m of embedded) {
    const h = await hash(m.vertex), same = byHash.get(h);
    if (same) {
      map.set(m.id, same);
      if (!createdIds.has(same) && !reused.includes(same)) reused.push(same);
      continue;
    }
    const id = newId();
    map.set(m.id, id);
    byHash.set(h, id);
    createdIds.add(id);
    created.push({ ...m, id });
  }
  return { map, reused, created };
}

// the transitions with their custom ids replaced by the local ones; a custom id the file did not bring becomes the default method
export function remapTransitions(transitions, map) {
  const fix = key => (isCustomKey(key) ? (map.get(key) ?? null) : key);
  return (transitions ?? []).map(tr => {
    if (!tr || typeof tr !== 'object') return tr;
    return { ...tr, method: fix(tr.method) ?? DEFAULT_KEY, method2: fix(tr.method2) ?? '' };
  });
}
```

`validateEmbedded` の「多すぎる」の判定は、追加のあと `methods.length` が上限に達してから**次の1個**が来たときに、1回だけ理由を出す。上の書き方は読みにくいので、実装では次のようにする（同じ結果）:

```js
  let cut = false;
  raw.forEach((m, i) => {
    if (methods.length >= PROJECT_METHODS.maxCount) {
      if (!cut) { cut = true; problems.push(`メソッドが多すぎます（${PROJECT_METHODS.maxCount}個まで）。残りは取り込みませんでした。`); }
      return;
    }
    …（以下そのまま）
```

- [ ] **Step 3: 通ることを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/project-methods.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)|✖"`
Expected: `ℹ tests 17`、`ℹ pass 17`、`ℹ fail 0`

---

### Task 3: `method-verify.js`（有効にする）— TDD

**Files:**
- Create: `tools/test/verify.test.mjs`
- Create: `app/method-verify.js`

- [ ] **Step 1: 失敗するテストを書く**

`/Volumes/ORICO/UNFOLD/tools/test/verify.test.mjs`:

```js
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
```

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/verify.test.mjs 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|^ℹ (pass|fail)" | head -3`
Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 2: 実装を書く**

`/Volumes/ORICO/UNFOLD/app/method-verify.js`:

```js
// "有効にする": the checks an unchecked method (one that came in a file from someone else) has to pass before it may be used —
// the text check, the GPU compile and the trial render, the same three the editor runs before it saves.
import { checkSource } from './method-guard.js';
import { describeGlError } from './method-messages.js';
import { TRIAL } from './method-trial.js';
import { getCustom, setCustomStatus } from './method-registry.js';

const lineText = (line, text) => `${line ? `${line}行目: ` : ''}${text}`;

// deps: { compile(source) -> errors[] (compileUserMethod), trial(source) -> the result of the trial render }
// Resolves to { ok: true, warnings } or { ok: false, stage, problems }.
export async function verifyMethod(source, { compile, trial }) {
  const guard = checkSource(source);
  if (!guard.ok) return { ok: false, stage: 'guard', problems: guard.errors.map(e => lineText(e.line, e.message)) };
  let errors;
  try { errors = await compile(source); } catch (error) { errors = [{ line: null, message: String(error?.message || error) }]; }
  if (errors.length) return { ok: false, stage: 'compile', problems: errors.map(e => lineText(e.line, describeGlError(e.message))) };
  let result;
  try { result = await trial(source); } catch (error) { result = { failed: String(error?.message || error) }; }
  if (result.failed) return { ok: false, stage: 'trial', problems: [`試し描画に失敗しました（${result.failed}）`] };
  if (result.heavy) {
    const times = result.ratio == null ? '標準の重いメソッドよりずっと重い' : `標準の重いメソッドの約${result.ratio.toFixed(1)}倍`;
    return { ok: false, stage: 'trial', problems: [`重すぎます（${times}。${TRIAL.factor}倍まで）`] };
  }
  const warnings = [];
  if (result.blank) warnings.push('何も映っていません');
  if (result.unchanged) warnings.push('元の絵と変わっていません');
  return { ok: true, warnings };
}

// Switches an unchecked method on after it passed verifyMethod; if it did not, it stays unchecked and the reason is written on it.
// safety: armVerify(id) / disarmVerify(id) leave and wipe the "being tried" mark, so a browser that goes down meanwhile is noticed at the next start.
export function createEnabler({ compile, trial, safety = null, notify = () => {} }) {
  const running = new Set();
  return {
    async enable(id) {
      const record = getCustom(id);
      if (!record || record.status !== 'quarantined' || running.has(id)) return false;
      running.add(id);
      const { vertex, rev } = record;
      safety?.armVerify(id);
      let outcome;
      try { outcome = await verifyMethod(vertex, { compile, trial }); }
      finally { safety?.disarmVerify(id); running.delete(id); }
      const now = getCustom(id);
      if (!now || now.rev !== rev || now.status !== 'quarantined') return false;      // changed or removed meanwhile: that was a check of other code
      if (!outcome.ok) {
        setCustomStatus(id, 'quarantined', `確認できませんでした: ${outcome.problems.join(' ')}`);
        notify(`「${now.name}」は有効にできませんでした。${outcome.problems[0]}`);
        return false;
      }
      setCustomStatus(id, 'ok', '');
      notify(outcome.warnings.length ? `「${now.name}」を有効にしました（${outcome.warnings.join('・')}）。` : `「${now.name}」を有効にしました。`);
      return true;
    },
  };
}
```

- [ ] **Step 3: 通ることを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/verify.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)|✖"`
Expected: `ℹ tests 14`、`ℹ pass 14`、`ℹ fail 0`

---

### Task 4: `method-safety.js` — 確認中の印と復帰 — TDD

**Files:**
- Modify: `tools/test/safety.test.mjs`、`app/method-safety.js`

- [ ] **Step 1: テストを直す・足す（先に失敗させる）**

1. `recoverFromCrash` の戻り値に `verifying` が増えるので、既存の3つの `deepEqual` を直す。
   - `assert.deepEqual(result, { methods: ['cm-a'], draft: false });` → `assert.deepEqual(result, { methods: ['cm-a'], draft: false, verifying: [] });`
   - `assert.deepEqual(safety.recoverFromCrash(), { methods: [], draft: false });` → `assert.deepEqual(safety.recoverFromCrash(), { methods: [], draft: false, verifying: [] });`
   - `assert.deepEqual(safety.recoverFromCrash(), { methods: [], draft: true });` → `assert.deepEqual(safety.recoverFromCrash(), { methods: [], draft: true, verifying: [] });`
2. 新しいテストを、最後の `createSafety works when localStorage …` の前に足す。

```js
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
```

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/safety.test.mjs 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ fail` が 6 前後（3つの直した期待値＋新しい3つ）。

- [ ] **Step 2: 実装する**

`app/method-safety.js`：
1. `export const DRAFT_ID = 'draft';` の次の行に足す: `export const VERIFY_PREFIX = 'verify:';        // an unchecked method is marked like this while it is checked`
2. import に `getCustom, setCustomStatus` はある。`recoverFromCrash` を置き換える。
   old:
   ```js
       recoverFromCrash() {
         const marked = crashFlag.recover();
         const methods = stop(marked.filter(id => id !== DRAFT_ID), 'crashed', '前回このメソッドを使っていて、ブラウザが落ちたみたい');
         const draft = marked.includes(DRAFT_ID);
         if (draft) markDraftCrashed(storage);
         if (methods.length) notify(`前回、${names(methods)}を使っていてブラウザが落ちたみたい。止めてあるよ（⚙から、もう一度試せます）。`);
         else if (draft) notify('前回、エディタで試したコードでブラウザが落ちたみたい。下書きは残してあるよ。');
         return { methods, draft };
       },
   ```
   new:
   ```js
       recoverFromCrash() {
         const marked = crashFlag.recover();
         const isVerify = id => id.startsWith(VERIFY_PREFIX);
         const methods = stop(marked.filter(id => id !== DRAFT_ID && !isVerify(id)), 'crashed', '前回このメソッドを使っていて、ブラウザが落ちたみたい');
         const draft = marked.includes(DRAFT_ID);
         if (draft) markDraftCrashed(storage);
         // a method that was being checked stays unchecked ("crashed" could be switched back on without the checks)
         const verifying = marked.filter(isVerify).map(id => id.slice(VERIFY_PREFIX.length)).filter(id => getCustom(id)?.status === 'quarantined');
         for (const id of verifying) setCustomStatus(id, 'quarantined', '確認している途中でブラウザが落ちたみたい。コードを見直してから、もう一度確認してね。');
         if (methods.length) notify(`前回、${names(methods)}を使っていてブラウザが落ちたみたい。止めてあるよ（⚙から、もう一度試せます）。`);
         else if (verifying.length) notify(`前回、${names(verifying)}を確認している途中でブラウザが落ちたみたい。未確認のままにしてあるよ。`);
         else if (draft) notify('前回、エディタで試したコードでブラウザが落ちたみたい。下書きは残してあるよ。');
         return { methods, draft, verifying };
       },
   ```
3. `armDraft() {…}` の前に足す:
   ```js
       armVerify(id) { crashFlag.arm([VERIFY_PREFIX + id]); },
       disarmVerify(id) { crashFlag.release([VERIFY_PREFIX + id]); },
   ```

Run: `cd /Volumes/ORICO/UNFOLD && node --test "tools/test/*.test.mjs" 2>&1 | grep -E "^ℹ (tests|pass|fail)|✖"`
Expected: `ℹ fail 0`

---

### Task 5: メニュー・エディタ・バナー・`project.js`

画面に依存する部品。構文を確認して、動作は Task 7 のブラウザで確かめる。

**Files:**
- Modify: `app/method-menu.js`、`app/method-editor.js`、`app/project.js`、`app/method-editor.css`
- Create: `app/method-banner.js`

- [ ] **Step 1: `method-menu.js` — 隔離中のメニュー**

1. old: `export function openMethodMenu(anchor, id, { onEdit, onDuplicate, onDelete }) {`
   new: `export function openMethodMenu(anchor, id, { onEdit, onDuplicate, onDelete, onEnable = null, onReview = null }) {`
2. old: `  if (record.status !== 'ok') item('もう一度試す', () => { closeMethodMenu(); setCustomStatus(id, 'ok', ''); });\n  item('編集', () => { closeMethodMenu(); onEdit(id); });`
   new:
   ```js
     // an unchecked method (from a file of someone else) is not switched back on by "try again": it has to be checked, or read and saved
     if (record.status === 'quarantined') {
       item('有効にする（確認してから）', () => { closeMethodMenu(); onEnable?.(id); });
       item('コードを見る', () => { closeMethodMenu(); (onReview ?? onEdit)(id); });
     } else {
       if (record.status !== 'ok') item('もう一度試す', () => { closeMethodMenu(); setCustomStatus(id, 'ok', ''); });
       item('編集', () => { closeMethodMenu(); onEdit(id); });
     }
   ```

- [ ] **Step 2: `method-editor.js` — 自動チェックなしで開く**

1. `open` の引数とメッセージ。
   old: `  function open({ id = null, copyOf = null } = {}) {`
   new: `  function open({ id = null, copyOf = null, review = false } = {}) {`
2. 下書きは、読むだけのときは使わない。
   old: `    const draft = copyOf ? null : readDraft();`
   new: `    const draft = copyOf || review ? null : readDraft();`
3. 落ちた下書きと同じ「保留」にする。
   old: `    ui.recheck.hidden = !crashedDraft;`
   new: `    const hold = review ? '他の人から取り込んだメソッドです。コードを読んで、よければ「チェックする」を押してね（保存すると有効になります）。' : crashedDraft ? '前回このコードを試したときに、ブラウザが落ちたかもしれません。内容を見直してから「チェックする」を押してね。' : '';\n    crashedDraft = !!hold;\n    ui.recheck.hidden = !hold;`
4. old: `    if (crashedDraft) notify('前回このコードを試したときに、ブラウザが落ちたかもしれません。内容を見直してから「チェックする」を押してね。');\n    else runChecks();`
   new: `    if (hold) notify(hold);\n    else runChecks();`

   ※ `crashedDraft` は「チェックを保留する」状態の名前のまま使う（`onEdit` と「チェックする」ボタンが、これを解く）。

- [ ] **Step 3: `project.js` — 書き出しに同梱する**

old_string:
```js
export async function exportFile(state) {
  const { json, assets } = await toJSON(state);
```
new_string:
```js
export async function exportFile(state) {
  const { json, assets } = await toJSON(state);
  // custom methods go into files only (not into the autosave of this browser, which keeps its own library): version 2 only when there are some
  if (state.methods?.length) { json.methods = state.methods; json.version = 2; }
```

- [ ] **Step 4: `method-banner.js`**

`/Volumes/ORICO/UNFOLD/app/method-banner.js`:

```js
// The banner under the method grid: "N unchecked methods" with [コードを見る] [有効にする] for each. It follows the registry by itself.
import { listCustom, onRegistryChange } from './method-registry.js';

export function createQuarantineBanner(container, { onReview, onEnable }) {
  const busy = new Set();
  function render() {
    const list = listCustom().filter(c => c.status === 'quarantined');
    container.hidden = !list.length;
    if (!list.length) { container.replaceChildren(); return; }
    const title = document.createElement('div');
    title.className = 'qb-title';
    title.textContent = `未確認のメソッドが ${list.length} 個あります（他の人のファイルから取り込んだコードです）`;
    const note = document.createElement('div');
    note.className = 'qb-note';
    note.textContent = '確認が終わるまでは使われません。コードを読んでから、有効にしてね。';
    const rows = list.map(c => {
      const row = document.createElement('div');
      row.className = 'qb-row';
      const name = document.createElement('span');
      name.className = 'qb-name'; name.textContent = `${c.symbol} ${c.name}`;
      const view = document.createElement('button');
      view.type = 'button'; view.textContent = 'コードを見る'; view.onclick = () => onReview(c.id);
      const enable = document.createElement('button');
      enable.type = 'button'; enable.textContent = busy.has(c.id) ? '確認中…' : '有効にする'; enable.disabled = busy.has(c.id);
      enable.onclick = async () => { busy.add(c.id); render(); try { await onEnable(c.id); } finally { busy.delete(c.id); render(); } };
      row.append(name, view, enable);
      const wrap = document.createElement('div');
      wrap.append(row);
      // the reason of the last failed check (or the first note) is kept on the method, so it survives a reload
      if (c.reason) { const why = document.createElement('div'); why.className = 'qb-why'; why.textContent = c.reason; wrap.append(why); }
      return wrap;
    });
    container.replaceChildren(title, note, ...rows);
  }
  const stop = onRegistryChange(render);
  render();
  return { render, stop };
}
```

- [ ] **Step 5: CSS**

`method-editor.css` の末尾に足す:

```css
/* the banner for unchecked methods (sequence page) */
.quarantine { margin: 8px 0; padding: 10px; border-radius: 10px; border: 1px dashed var(--m-warn, #ff8a6b); background: rgba(255, 138, 107, .08); font-size: 12px; line-height: 1.5; }
.quarantine[hidden] { display: none; }
.quarantine { --m-warn: var(--warn, #ff8a6b); --m-line: var(--line, #2a3334); --m-ink: var(--ink, var(--text, #eef0e2)); --m-dim: var(--dim, var(--muted, #96a19b)); --m-added: var(--added, #7fd6ff); }
.quarantine .qb-title { font-weight: 700; color: var(--m-warn); }
.quarantine .qb-note { color: var(--m-dim); margin: 2px 0 6px; }
.quarantine .qb-row { display: flex; align-items: center; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
.quarantine .qb-name { flex: 1; min-width: 80px; color: var(--m-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.quarantine button { padding: 4px 9px; border-radius: 6px; border: 1px solid var(--m-line); background: #1c2324; color: inherit; font: inherit; cursor: pointer; }
.quarantine button:hover:not(:disabled) { border-color: var(--m-added); }
.quarantine button:disabled { opacity: .5; cursor: wait; }
.quarantine .qb-why { margin: 2px 0 4px; color: var(--m-warn); font-size: 11px; word-break: break-word; }
```

- [ ] **Step 6: 構文を確認する**

Run: `cd /Volumes/ORICO/UNFOLD/app && S=/private/tmp/claude-501/-Volumes-ORICO-UNFOLD/e8107f15-5f2a-459b-a83e-4e6edb1a6f69/scratchpad && for f in method-menu method-editor method-banner project; do cp $f.js "$S/$f-check.mjs" && node --check "$S/$f-check.mjs" && echo "$f SYNTAX_OK"; done`
Expected: 4つとも `SYNTAX_OK`

---

### Task 6: `sequence.js` / `sequence.html` / `app.js` につなぐ

**Files:**
- Modify: `app/sequence.js`、`app/sequence.html`、`app/app.js`

- [ ] **Step 1: シーケンスの HTML**

`sequence.html`（`#seq-methods` の次の行にバナーの置き場、`?v=` を上げる）:
1. old: `    <div class="choice-grid" id="seq-methods" role="group" aria-label="崩れ方"></div>`
   new: `    <div class="choice-grid" id="seq-methods" role="group" aria-label="崩れ方"></div>\n    <div class="quarantine" id="seq-quarantine" hidden></div>`
2. old: `sequence.js?v=48` → new: `sequence.js?v=49`

- [ ] **Step 2: シーケンス — import と、書き出しに同梱**

1. import を足す。
   old: `import { createTrial } from './method-trial.js';`
   new: `import { createTrial } from './method-trial.js';\nimport { collectMethods, planImport, remapTransitions, validateEmbedded } from './method-project.js';\nimport { createEnabler } from './method-verify.js';\nimport { createQuarantineBanner } from './method-banner.js';\nimport { compileUserMethod } from './custom-method.js';\nimport { sourceHash } from './method-library.js';`
2. `./method-registry.js` の import に `getCustom, newCustomId` を足す。
   old: `import { BUILTIN_KEYS, isCustomKey, isUsable, listCustom, methodEntries, methodLabel, onRegistryChange, registerCustom, setCustomStatus, unregisterCustom } from './method-registry.js';`
   new: `import { BUILTIN_KEYS, getCustom, isCustomKey, isUsable, listCustom, methodEntries, methodLabel, newCustomId, onRegistryChange, registerCustom, setCustomStatus, unregisterCustom } from './method-registry.js';`
3. `stateForSave()` に、使っている自作メソッドを足す。
   old: `    slides: seq.slides, transitions: seq.transitions, lyrics: seq.lyrics,\n    audio: seq.audioOwner ? { owner: seq.audioOwner, name: seq.audioName } : null,\n  };`
   new: `    slides: seq.slides, transitions: seq.transitions, lyrics: seq.lyrics,\n    audio: seq.audioOwner ? { owner: seq.audioOwner, name: seq.audioName } : null,\n    methods: collectMethods(seq.transitions, getCustom),     // goes into .unfold files only (exportFile); the autosave ignores it\n  };`

- [ ] **Step 3: シーケンス — 取り込み**

`importProject` を、ファイルを開く関数に分けて、隔離の準備を挟む。
old_string:
```js
function importProject() {
  const pick = document.createElement('input'); pick.type = 'file'; pick.accept = '.unfold';
  pick.onchange = async () => {
    const f = pick.files[0]; if (!f) return;
    try { stopPlay(); beginEdit(); const { json, blobs } = await importFile(f); await releaseSaveFile(); await restoreProject(json, blobs); history.clear(); flushSave(); notice('プロジェクトを開いたよ（ファイルへの自動保存は「保存先…」で選び直してね）'); }
    catch (e) { console.error(e); notice(e.message || '開けませんでした'); }
  };
  pick.click();
}
```
new_string:
```js
// The custom methods inside a file of someone else come in unchecked ('quarantined'): they are not compiled or drawn until the user
// enables them. Code that is already here (the same code) is reused. The ◆ of the file are pointed at the local ids before the project is restored.
async function prepareImportedMethods(json) {
  const { methods, problems } = validateEmbedded(json.methods, json.version);
  const plan = await planImport({ embedded: methods, local: listCustom().map(c => ({ id: c.id, vertex: c.vertex })), hash: sourceHash, newId: newCustomId });
  for (const m of plan.created) registerCustom({ id: m.id, name: m.name, symbol: m.symbol, vertex: m.vertex, status: 'quarantined', reason: 'ファイルから取り込みました。コードを確認してから有効にしてね。' });
  json.transitions = remapTransitions(json.transitions, plan.map);
  return { created: plan.created.length, reused: plan.reused.length, problems };
}
async function openProjectFile(f) {
  stopPlay(); beginEdit();
  const { json, blobs } = await importFile(f);
  const outcome = await prepareImportedMethods(json);
  await releaseSaveFile(); await restoreProject(json, blobs); history.clear(); flushSave();
  const extra = [outcome.created ? `未確認のメソッドが${outcome.created}個あります（他の人のコードです。確認してから有効にしてね）。` : '', outcome.problems.length ? `取り込めなかったメソッドが${outcome.problems.length}個あります。` : ''].filter(Boolean).join(' ');
  notice(`プロジェクトを開いたよ（ファイルへの自動保存は「保存先…」で選び直してね）${extra ? ' ' + extra : ''}`);
  return outcome;
}
function importProject() {
  const pick = document.createElement('input'); pick.type = 'file'; pick.accept = '.unfold';
  pick.onchange = async () => {
    const f = pick.files[0]; if (!f) return;
    try { await openProjectFile(f); }
    catch (e) { console.error(e); notice(e.message || '開けませんでした'); }
  };
  pick.click();
}
```

- [ ] **Step 4: シーケンス — 有効にする・バナー・メニュー・確認用の窓口**

1. 変数。
   old: `let renderer, scene, camera, perspCam, mesh, sceneBlur, backdrop, variants, methodEditor, methodPersistence, safety;`
   new: `let renderer, scene, camera, perspCam, mesh, sceneBlur, backdrop, variants, methodEditor, methodPersistence, safety, methodTrial, methodEnabler, quarantineBanner;`
2. 試し描画を共有して、確認係とバナーを作る。
   old: `  methodEditor = createMethodEditor({ vertexShader, fragmentShader, notify: notice, safety, trial: createTrial({ vertexShader, fragmentShader }), getPreviewImage: () => (seq.slides[0] ? slideCanvas(seq.slides[0]) : null) });`
   new:
   ```js
     methodTrial = createTrial({ vertexShader, fragmentShader });
     methodEditor = createMethodEditor({ vertexShader, fragmentShader, notify: notice, safety, trial: methodTrial, getPreviewImage: () => (seq.slides[0] ? slideCanvas(seq.slides[0]) : null) });
     methodEnabler = createEnabler({ compile: source => compileUserMethod(renderer, { vertexShader, fragmentShader, source }), trial: source => methodTrial.run(source), safety, notify: notice });
     quarantineBanner = createQuarantineBanner($('seq-quarantine'), { onReview: id => methodEditor.open({ id, review: true }), onEnable: id => methodEnabler.enable(id) });
   ```
3. メソッド一覧のメニューに、隔離中の項目をつなぐ。
   old: `onMenu: (id, anchor) => openMethodMenu(anchor, id, { onEdit: key => methodEditor.open({ id: key }), onDuplicate: key => methodEditor.open({ copyOf: key }), onDelete: deleteCustomMethod }),`
   new: `onMenu: (id, anchor) => openMethodMenu(anchor, id, { onEdit: key => methodEditor.open({ id: key }), onDuplicate: key => methodEditor.open({ copyOf: key }), onDelete: deleteCustomMethod, onEnable: key => methodEnabler.enable(key), onReview: key => methodEditor.open({ id: key, review: true }) }),`
4. 確認用の窓口。
   old: `editor: methodEditor, persistence: methodPersistence, safety };`
   new: `editor: methodEditor, persistence: methodPersistence, safety, enabler: methodEnabler };`
   old: `renderAt, totalSeconds, exportWebM, refreshUI };`（`window.unfoldSeq = {…}` の末尾）
   new: `renderAt, totalSeconds, exportWebM, refreshUI, exportProjectBlob: () => exportFile(stateForSave()), openProjectFile };`

- [ ] **Step 5: 1枚モード — メニューに隔離中の項目**

`app.js`:
1. old: `onMenu:(id,anchor)=>openMethodMenu(anchor,id,{onEdit:key=>methodEditor.open({id:key}),onDuplicate:key=>methodEditor.open({copyOf:key}),onDelete:key=>{unregisterCustom(key);notice('自作メソッドを削除しました。')}}),`
   new: `onMenu:(id,anchor)=>openMethodMenu(anchor,id,{onEdit:key=>methodEditor.open({id:key}),onDuplicate:key=>methodEditor.open({copyOf:key}),onDelete:key=>{unregisterCustom(key);notice('自作メソッドを削除しました。')},onEnable:key=>methodEnabler.enable(key),onReview:key=>methodEditor.open({id:key,review:true})}),`
2. import を足す。
   old: `import {createTrial} from './method-trial.js';`
   new: `import {createTrial} from './method-trial.js';\nimport {createEnabler} from './method-verify.js';\nimport {compileUserMethod} from './custom-method.js';`
3. 変数と作る所。
   old: `let renderer,scene,camera,mesh,variants,methodEditor,methodPersistence,safety,texture,`
   new: `let renderer,scene,camera,mesh,variants,methodEditor,methodPersistence,safety,methodEnabler,texture,`
   old: ` methodEditor=createMethodEditor({vertexShader,fragmentShader,notify:notice,safety,trial:createTrial({vertexShader,fragmentShader}),getPreviewImage:()=>sourceCanvas});`
   new: ` const methodTrial=createTrial({vertexShader,fragmentShader});\n methodEditor=createMethodEditor({vertexShader,fragmentShader,notify:notice,safety,trial:methodTrial,getPreviewImage:()=>sourceCanvas});\n methodEnabler=createEnabler({compile:source=>compileUserMethod(renderer,{vertexShader,fragmentShader,source}),trial:source=>methodTrial.run(source),safety,notify:notice});`
4. old: `get safety(){return safety}};`
   new: `get safety(){return safety},get enabler(){return methodEnabler}};`
5. `index.html` は変えない。

- [ ] **Step 6: 構文と単体テスト**

Run: `cd /Volumes/ORICO/UNFOLD/app && S=/private/tmp/claude-501/-Volumes-ORICO-UNFOLD/e8107f15-5f2a-459b-a83e-4e6edb1a6f69/scratchpad && for f in sequence app; do cp $f.js "$S/$f-check.mjs" && node --check "$S/$f-check.mjs" && echo "$f SYNTAX_OK"; done; cd .. && node --test "tools/test/*.test.mjs" 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `sequence SYNTAX_OK`、`app SYNTAX_OK`、`ℹ fail 0`

---

### Task 7: ブラウザで確認する

**Files:** なし（確認だけ）。`.claude/launch.json` は、先に読み直してから書く。

- [ ] **Step 1: コピーして、サーバーを起動する**

Task 5（③a）と同じ。`navigate` で `http://localhost:8771/sequence.html?empty`。エラーを自分で捕まえる:
```js
window.__errs = [];
addEventListener('error', e => window.__errs.push('error: ' + e.message));
addEventListener('unhandledrejection', e => window.__errs.push('rejection: ' + (e.reason?.message || e.reason)));
const wait = async fn => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > 8000) throw new Error('timeout'); await new Promise(r => setTimeout(r, 40)); } };
window.__w = wait;
({ hasQuarantineBox: !!document.getElementById('seq-quarantine'), hidden: document.getElementById('seq-quarantine').hidden, enabler: !!unfoldMethods.enabler })
```
Expected: `{ hasQuarantineBox: true, hidden: true, enabler: true }`

- [ ] **Step 2: 同梱（書き出し）**

3枚入れて、自作メソッドを2つ（1つは◆が使う、1つは使わない）作る。◆に使わせて、ファイルを作り、中身を調べる。

```js
const wait = window.__w;
const mk = c => { const k = document.createElement('canvas'); k.width = 640; k.height = 360; const g = k.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 640, 360); g.fillStyle = '#fff'; g.font = '80px sans-serif'; g.fillText(c, 40, 200); return k; };
for (const c of ['#e55', '#5a5', '#55e']) unfoldSeq.addSlide(mk(c), c);
const vortex = 'vec3 userMethod(vec2 p, float amount) { float r = length(p); vec2 q = rot(amount * 3.4 / (r + .35)) * p * (1. - amount * .6 * exp(-r * .5)); return vec3(q, -amount * .9 * exp(-r * r * .7)); }';
const wave = 'vec3 userMethod(vec2 p, float amount) { vec2 q = p; q.x += sin(p.y * 6. + uSeed) * amount * .6; return vec3(q, 0.); }';
unfoldMethods.registerCustom({ id: 'cm-used', name: '使う渦', symbol: '渦', vertex: vortex });
unfoldMethods.registerCustom({ id: 'cm-unused', name: '使わない波', symbol: '波', vertex: wave });
await wait(() => unfoldMethods.variants.pick('cm-used').uMethod === 100);
unfoldSeq.seq.transitions[0].method = 'cm-used';
const readFile = async blob => {
  const buf = await blob.arrayBuffer(), magic = 'UNFOLD-PROJECT-1\n'.length, n = new DataView(buf, magic, 4).getUint32(0, true);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(buf, magic + 4, n)));
};
const withMethods = await readFile(await unfoldSeq.exportProjectBlob());
unfoldSeq.seq.transitions[0].method = 'twist';
const without = await readFile(await unfoldSeq.exportProjectBlob());
unfoldSeq.seq.transitions[0].method = 'cm-used';
window.__readFile = readFile;
({ withMethods: { version: withMethods.version, methods: withMethods.methods?.map(m => ({ id: m.id, name: m.name, symbol: m.symbol, hasCode: m.vertex.includes('userMethod'), keys: Object.keys(m).sort().join() })) },
   without: { version: without.version, hasMethods: 'methods' in without }, errors: window.__errs })
```
Expected:
- `withMethods`: `version: 2`、`methods` は**使っている `cm-used` の1つだけ**（`cm-unused` は入らない）、`keys` は `id,look,name,params,symbol,vertex`（`status` や `hash` は入らない）。
- `without`: `version: 1`、`hasMethods: false`（使っていないときは version 1 のまま）。

- [ ] **Step 3: 自分のブラウザの自動保存には同梱されない**

```js
await unfoldSeq.flushSave();
const dbs = await new Promise((resolve, reject) => { const r = indexedDB.open('unfold-projects'); r.onsuccess = () => { const tx = r.result.transaction('projects'); const g = tx.objectStore('projects').get('current'); g.onsuccess = () => resolve(g.result); }; r.onerror = () => reject(r.error); });
({ autosaved: !!dbs, version: dbs?.version, hasMethods: dbs ? 'methods' in dbs : null })
```
Expected: `hasMethods: false`（`?empty` のページは自動保存しないので、`dbs` が `undefined` なら `autosaved: false` でもよい。その場合は、`?empty` を付けない別のタブで同じ確認をする）。

- [ ] **Step 4: 同じコードが手元にあるときは再利用（隔離されない）**

```js
const wait = window.__w;
const blob = await unfoldSeq.exportProjectBlob();
const file = new File([blob], 'mine.unfold');
const before = unfoldMethods.listCustom().map(c => c.id).sort();
const outcome = await unfoldSeq.openProjectFile(file);
await new Promise(r => setTimeout(r, 400));
const after = unfoldMethods.listCustom().map(c => c.id + ':' + c.status).sort();
({ outcome, before, after, transition: unfoldSeq.seq.transitions[0].method, bannerHidden: document.getElementById('seq-quarantine').hidden, errors: window.__errs })
```
Expected: `outcome: { created: 0, reused: 1, problems: [] }`、`after` は `before` と同じ id のまま（増えない）、`transition: 'cm-used'`、`bannerHidden: true`。

- [ ] **Step 5: 他の人のファイル（手元に無いコード）は隔離で入る**

```js
const wait = window.__w;
const blob = await unfoldSeq.exportProjectBlob();
const file = new File([blob], 'theirs.unfold');
unfoldMethods.unregisterCustom('cm-used'); unfoldMethods.unregisterCustom('cm-unused');       // as if this browser had never seen them
await unfoldMethods.persistence.flush();
const outcome = await unfoldSeq.openProjectFile(file);
await new Promise(r => setTimeout(r, 500));
await unfoldMethods.persistence.flush();
const rec = unfoldMethods.listCustom();
const q = rec[0];
const tile = [...document.querySelectorAll('#seq-methods button.unusable')].find(b => b.dataset.method === q?.id);
({ outcome, count: rec.length, status: q?.status, reason: q?.reason, newId: q?.id !== 'cm-used', transition: unfoldSeq.seq.transitions[0].method === q?.id, tileBadge: tile?.querySelector('small')?.textContent,
   bannerShown: !document.getElementById('seq-quarantine').hidden, bannerTitle: document.querySelector('#seq-quarantine .qb-title')?.textContent, compiled: unfoldMethods.variants.count(),
   notice: document.getElementById('seq-notice').textContent, errors: window.__errs })
```
Expected: `outcome.created: 1`、`status: 'quarantined'`、`newId: true`（ファイルの id とは別の、手元の新しい id）、`transition: true`（◆が新しい id を指す）、`tileBadge: '未確認'`、`bannerShown: true`、バナーに「未確認のメソッドが 1 個あります」、**`compiled: 0`**（隔離中のコードはコンパイルもされていない）、`notice` に「未確認のメソッドが1個あります」。

- [ ] **Step 6: 隔離中は使われない（◆は「くしゃくしゃ」、書き出しにも使われない）**

```js
const B = 60 / unfoldSeq.seq.bpm;
const q = unfoldMethods.listCustom()[0];
const cv = document.getElementById('seq-canvas');
const grab = () => { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const g = c.getContext('2d'); g.drawImage(cv, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
const diff = (a, b) => { let max = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d > max) max = d; } return max; };
const tr = unfoldSeq.seq.transitions[0];
tr.method = q.id; unfoldSeq.renderAt(5 * B); const quarantined = grab();
tr.method = 'crumple'; unfoldSeq.renderAt(5 * B); const crumple = grab();
tr.method = q.id;
({ sameAsCrumple: diff(quarantined, crumple), variantsBuilt: unfoldMethods.variants.count(), picked: unfoldMethods.variants.pick(q.id).uMethod })
```
Expected: `sameAsCrumple: 0`、`variantsBuilt: 0`、`picked: 0`。

- [ ] **Step 7: 「有効にする」（確認を通ったものだけが使える）**

バナーの「有効にする」ボタンを実際に押す。
```js
const wait = window.__w;
const q = unfoldMethods.listCustom()[0];
const button = [...document.querySelectorAll('#seq-quarantine .qb-row button')].find(b => b.textContent === '有効にする');
button.click();
await new Promise(r => setTimeout(r, 50));
const during = { text: [...document.querySelectorAll('#seq-quarantine .qb-row button')].map(b => b.textContent + (b.disabled ? '(off)' : '')), mark: JSON.parse(localStorage.getItem('unfold-method-trial') || 'null')?.ids ?? null };
await wait(() => unfoldMethods.listCustom().find(c => c.id === q.id).status === 'ok');
await new Promise(r => setTimeout(r, 400));
await unfoldMethods.persistence.flush();
({ during, status: unfoldMethods.listCustom().find(c => c.id === q.id).status, reason: unfoldMethods.listCustom().find(c => c.id === q.id).reason, bannerHidden: document.getElementById('seq-quarantine').hidden, markWiped: localStorage.getItem('unfold-method-trial') === null,
   picked: unfoldMethods.variants.pick(q.id).uMethod, notice: document.getElementById('seq-notice').textContent, errors: window.__errs })
```
Expected: `during` に `確認中…(off)`（押している間）、`mark` に `verify:<id>`。そのあと `status: 'ok'`、`reason: ''`、`bannerHidden: true`、`markWiped: true`、`picked: 100`、`notice` に「を有効にしました」。◆でこの自作メソッドを使うと、標準の「渦に吸い込み」と同じ絵（`maxDiff` ≦ 1）になる。

- [ ] **Step 8: 悪い他人のファイル**

`readFile` と同じ形式で、ファイルの中身を書き換えて作る。
```js
const wait = window.__w;
const MAGIC = 'UNFOLD-PROJECT-1\n';
const rewrite = async (blob, mutate) => {
  const buf = new Uint8Array(await blob.arrayBuffer()), n = new DataView(buf.buffer, MAGIC.length, 4).getUint32(0, true), start = MAGIC.length + 4;
  const json = JSON.parse(new TextDecoder().decode(buf.slice(start, start + n)));
  mutate(json);
  const head = new TextEncoder().encode(JSON.stringify(json)), len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, head.length, true);
  return new File([MAGIC, len, head, buf.slice(start + n)], 'evil.unfold');
};
window.__rewrite = rewrite;
for (const c of unfoldMethods.listCustom()) unfoldMethods.unregisterCustom(c.id);
await unfoldMethods.persistence.flush();
const good = 'vec3 userMethod(vec2 p, float amount) { return vec3(p * (1. - amount * .1), 0.); }';
const base = await unfoldSeq.exportProjectBlob();
const evil = await rewrite(base, j => {
  j.version = 2;
  j.methods = [
    { id: 'cm-loop', name: '無限ループ', symbol: '∞', vertex: 'vec3 userMethod(vec2 p, float amount) { while (true) { } return vec3(p, 0.); }', hash: 'trust-me', status: 'ok' },
    { id: 'cm-syntax', name: '文法', symbol: '文', vertex: 'vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.) }' },
    { id: 'cm-name', name: '<img src=x onerror=alert(1)>', symbol: '<', vertex: good },
    { id: 'glb-wrong', name: 'idが違う', vertex: good },
    { id: 'cm-huge', name: 'でかい', vertex: 'a'.repeat(9000) },
    'not an object',
  ];
  j.transitions = j.transitions.map((t, i) => (i === 0 ? { ...t, method: 'cm-loop', method2: 'cm-name' } : { ...t, method: 'cm-not-in-file' }));
});
const outcome = await unfoldSeq.openProjectFile(evil);
await new Promise(r => setTimeout(r, 600));
const list = unfoldMethods.listCustom();
const names = list.map(c => c.name);
const rows = [...document.querySelectorAll('#seq-quarantine .qb-name')].map(n => n.textContent);
({ outcome: { created: outcome.created, problems: outcome.problems.length }, statuses: list.map(c => c.status), names, bannerRows: rows,
   injected: !!document.querySelector('#seq-quarantine img, .method-tile img, #seq-methods img'), transitions: unfoldSeq.seq.transitions.map(t => [t.method === 'crumple' ? 'crumple' : unfoldMethods.listCustom().find(c => c.id === t.method)?.name ?? t.method, t.method2 === '' ? '' : unfoldMethods.listCustom().find(c => c.id === t.method2)?.name ?? t.method2]),
   compiled: unfoldMethods.variants.count(), errors: window.__errs })
```
Expected:
- `outcome.created: 3`（無限ループ・文法・名前に細工）、`problems: 3`（id が違う・大きすぎる・オブジェクトでない）。
- `statuses` は全部 `quarantined`（ファイルが `status: 'ok'` と言っても無視）。
- `names` の3つ目は、`<img src=x onerror=alert(1)>` が**文字のまま**（20文字に切られる）。`injected: false`（HTMLとして入っていない）。
- `transitions`: 1つ目の◆は、新しい id の「無限ループ」「名前に細工」を指す。2つ目の◆（ファイルに無い `cm-not-in-file`）は `['crumple', '']`。
- `compiled: 0`（隔離中のコードは、1つもコンパイルされていない＝GPU に載っていない）。

- [ ] **Step 9: 有効にできないものは、理由つきで未確認のまま**

```js
const wait = window.__w;
const byName = n => unfoldMethods.listCustom().find(c => c.name === n);
const result = {};
for (const name of ['無限ループ', '文法']) {
  const ok = await unfoldMethods.enabler.enable(byName(name).id);
  await new Promise(r => setTimeout(r, 200));
  result[name] = { ok, status: byName(name).status, reason: byName(name).reason };
}
const bannerWhy = [...document.querySelectorAll('#seq-quarantine .qb-why')].map(w => w.textContent);
({ result, bannerWhy, markWiped: localStorage.getItem('unfold-method-trial') === null, compiled: unfoldMethods.variants.count(), errors: window.__errs })
```
Expected:
- `無限ループ`: `ok: false`、`status: 'quarantined'`、`reason` に「確認できませんでした: 1行目: `while` は使えません。」。
- `文法`: `ok: false`、`status: 'quarantined'`、`reason` に「確認できませんでした: 1行目: 書き方がおかしい…」。
- どちらも GPU に載っていない（`compiled` は変わらず 0 のまま。文法エラーのコンパイルは確認用の別の場所で行われる）。
- バナーに、それぞれの理由が出る。`markWiped: true`。

- [ ] **Step 10: メニュー（「もう一度試す」が出ない）と、「コードを見る」**

```js
const wait = window.__w;
const q = unfoldMethods.listCustom().find(c => c.name === '無限ループ');
const tile = [...document.querySelectorAll('#seq-methods .method-tile')].find(w => w.querySelector('button[data-method]').dataset.method === q.id);
tile.querySelector('.tile-gear').click();
await new Promise(r => setTimeout(r, 120));
const items = [...document.querySelectorAll('.method-menu button')].map(b => b.textContent);
const reason = document.querySelector('.method-menu .mm-reason')?.textContent;
[...document.querySelectorAll('.method-menu button')].find(b => b.textContent === 'コードを見る').click();
await new Promise(r => setTimeout(r, 900));
const review = { open: document.getElementById('method-dialog').open, hasCode: document.getElementById('method-code').value.includes('while'), recheckShown: !document.getElementById('method-recheck').hidden,
  guard: document.getElementById('method-guard').className, compile: document.getElementById('method-compile').className, trial: document.getElementById('method-trial').className, save: !document.getElementById('method-save').disabled, notice: document.getElementById('seq-notice').textContent, compiled: unfoldMethods.variants.count() };
document.getElementById('method-recheck').click();
await new Promise(r => setTimeout(r, 800));
const afterCheck = { guard: document.getElementById('method-guard').className, errors: [...document.querySelectorAll('#method-errors li')].map(l => l.textContent), save: !document.getElementById('method-save').disabled };
document.getElementById('method-cancel').click();
localStorage.removeItem('unfold-method-draft');
({ items, reason, review, afterCheck, statusStill: unfoldMethods.listCustom().find(c => c.id === q.id).status })
```
Expected:
- `items`: `['有効にする（確認してから）', 'コードを見る', '複製', '削除']`（**「もう一度試す」は無い**）。
- `review`: `open: true`、`hasCode: true`、`recheckShown: true`、`guard`/`compile`/`trial` は**まだ走っていない**（`md-check` のまま）、`save: false`、`notice` に「他の人から取り込んだメソッドです」、`compiled: 0`。
- 「チェックする」を押すと、書き方チェックが走って `md-check ng`、エラーに「`while` は使えません」、`save: false`。
- 閉じたあとも `status` は `quarantined` のまま。

- [ ] **Step 11: 確認の途中でブラウザが落ちたとき（手で書いた印）**

```js
const q = unfoldMethods.listCustom().find(c => c.name === '文法');
unfoldMethods.registerCustom({ id: q.id, name: q.name, symbol: q.symbol, vertex: q.vertex, status: 'quarantined', reason: 'ファイルから取り込みました。' });
await new Promise(r => setTimeout(r, 300)); await unfoldMethods.persistence.flush();
localStorage.setItem('unfold-method-trial', JSON.stringify({ session: 'a-crashed-session', at: Date.now() - 5000, ids: ['verify:' + q.id] }));
q.id
```
ページを開き直す（`navigate`）。続けて:
```js
const wait = async fn => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > 8000) throw new Error('timeout'); await new Promise(r => setTimeout(r, 40)); } };
await wait(() => unfoldMethods.listCustom().some(c => /確認している途中/.test(c.reason)));
const rec = unfoldMethods.listCustom().find(c => /確認している途中/.test(c.reason));
({ status: rec.status, reason: rec.reason, notice: document.getElementById('seq-notice').textContent, bannerShown: !document.getElementById('seq-quarantine').hidden, markWiped: localStorage.getItem('unfold-method-trial') === null })
```
Expected: `status: 'quarantined'`（「落ちた」ではなく未確認のまま）、`reason` に「確認している途中でブラウザが落ちたみたい」、`notice` に「確認している途中でブラウザが落ちたみたい」、バナーに出ている、`markWiped: true`。

- [ ] **Step 12: 古い版の `.unfold`（version 1）と、未来の版**

```js
const wait = window.__w ?? (async fn => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > 8000) throw new Error('timeout'); await new Promise(r => setTimeout(r, 40)); } });
const MAGIC = 'UNFOLD-PROJECT-1\n';
const rewrite = async (blob, mutate) => {
  const buf = new Uint8Array(await blob.arrayBuffer()), n = new DataView(buf.buffer, MAGIC.length, 4).getUint32(0, true), start = MAGIC.length + 4;
  const json = JSON.parse(new TextDecoder().decode(buf.slice(start, start + n)));
  mutate(json);
  const head = new TextEncoder().encode(JSON.stringify(json)), len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, head.length, true);
  return new File([MAGIC, len, head, buf.slice(start + n)], 'x.unfold');
};
for (const c of unfoldMethods.listCustom()) unfoldMethods.unregisterCustom(c.id);
await unfoldMethods.persistence.flush();
const mk = c => { const k = document.createElement('canvas'); k.width = 640; k.height = 360; const g = k.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 640, 360); return k; };
if (!unfoldSeq.seq.slides.length) for (const c of ['#e55', '#5a5', '#55e']) unfoldSeq.addSlide(mk(c), c);
const base = await unfoldSeq.exportProjectBlob();
const v1 = await unfoldSeq.openProjectFile(await rewrite(base, j => { j.version = 1; delete j.methods; }));
const future = await unfoldSeq.openProjectFile(await rewrite(base, j => { j.version = 9; j.methods = [{ id: 'cm-f', name: 'F', symbol: 'F', vertex: 'vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }' }]; }));
({ v1, future: { created: future.created, problems: future.problems }, customs: unfoldMethods.listCustom().length, slides: unfoldSeq.seq.slides.length })
```
Expected: `v1: { created: 0, reused: 0, problems: [] }`（version 1 の古いファイルは今までどおり開ける）、`future: { created: 0, problems: ['新しい形式のファイルなので、メソッドは取り込みませんでした。'] }`、`customs: 0`、`slides` は 3。

- [ ] **Step 13: 1枚モードのメニュー**

テスト用のメソッドを全部消して、隔離中のものを1つ作る（`registerCustom({ …, status: 'quarantined' })`）。`navigate` で `http://localhost:8771/index.html`。⚙メニューが `['有効にする（確認してから）', 'コードを見る', '複製', '削除']`（「もう一度試す」なし）。「有効にする」で `ok` になる。コンソールエラーなし。

- [ ] **Step 14: 標準の29個は変わっていない（変更前と比べる）**

③a の Step 12 と同じ手順（変更前＝今回のバックアップ `archive/app-before-custom-project-2026-10-03/` を別ポート8772で配信、**同じタブ**で比べる）。1枚モード 58点、シーケンス 117点が全部一致（まとめは `55e1de86` と `2964a23`。キャンバスの大きさが変わったら、その値）。

- [ ] **Step 15: 片付ける**

テスト用の自作メソッド・`localStorage` の `unfold-method-draft`・`unfold-method-trial` を消す。`preview_stop`（全部）。`resize_window` を `desktop` に。`.claude/launch.json` を元の1設定に戻す。

---

### Task 8: 仕上げ

- [ ] **Step 1: README に更新メモを足す**

old_string: `公開サイト: https://unfold-test.netlify.app/`
new_string:
```
- 自作メソッドの `.unfold` への同梱と、取り込み時の隔離（ローカルのみ・未公開）：プロジェクトを書き出すと、◆が使っている自作メソッドだけがコードごと入ります（version 2。使っていなければ今までどおり version 1）。他の人のファイルを開くと、手元に無いコードは「未確認」で入り、**確認が終わるまでコンパイルも描画もされません**（同じコードが手元にあれば、それを使います）。シーケンスの方法一覧の下のバナーか、タイルの⚙から「有効にする」を押すと、書き方チェック・GPUのコンパイル・試し描画を通ったものだけが使えるようになります。「コードを見る」は、自動チェックなしでエディタを開きます。ファイルの `hash` や状態は信用せず、id・名前・コードの大きさも検査します。仕組みは `app/method-project.js`・`method-verify.js`・`method-banner.js`。変更前の `app/` は `archive/app-before-custom-project-2026-10-03/`。実装計画は `docs/superpowers/plans/2026-10-03-custom-methods-3b-project.md`。

公開サイト: https://unfold-test.netlify.app/
```

- [ ] **Step 2: 差分が意図した範囲か確認する**

Run: `cd /Volumes/ORICO/UNFOLD && diff -rq archive/app-before-custom-project-2026-10-03 app`
Expected（この順で、これだけ）:
```
Files archive/app-before-custom-project-2026-10-03/app.js and app/app.js differ
Only in app: method-banner.js
Files archive/app-before-custom-project-2026-10-03/method-editor.css and app/method-editor.css differ
Files archive/app-before-custom-project-2026-10-03/method-editor.js and app/method-editor.js differ
Files archive/app-before-custom-project-2026-10-03/method-menu.js and app/method-menu.js differ
Only in app: method-project.js
Files archive/app-before-custom-project-2026-10-03/method-registry.js and app/method-registry.js differ
Files archive/app-before-custom-project-2026-10-03/method-safety.js and app/method-safety.js differ
Only in app: method-verify.js
Files archive/app-before-custom-project-2026-10-03/project.js and app/project.js differ
Files archive/app-before-custom-project-2026-10-03/sequence.html and app/sequence.html differ
Files archive/app-before-custom-project-2026-10-03/sequence.js and app/sequence.js differ
```
`motion.js`・`custom-method.js`・`method-guard.js`・`method-library.js`・`index.html` は出ない。

- [ ] **Step 3: 全部の単体テストを通す**

Run: `cd /Volumes/ORICO/UNFOLD && node --test "tools/test/*.test.mjs" 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `ℹ fail 0`

- [ ] **Step 4: 公開について**

これで、自作メソッドの計画（①エンジン・②エディタ・③a 実行時の安全・③b ファイルの隔離）がそろう。**公開の前に、作者が確認すること**（別紙のチェックリストを、実行後に作る）。ローカルを直しただけでは Netlify は変わらない（手動デプロイ）。

---

## 実行結果（2026-10-03）

- 単体テスト 159 本が全部通過（①〜③a の 125 本＋③b で 34 本：registry 1、project-methods 17、verify 13、safety 3）。
- ブラウザ確認（Task 7 の Step 1〜14）は全部期待どおり。標準の29個は変更前と同じ絵：1枚モード 58/58 一致（まとめ `55e1de86`）、シーケンス 117/117 一致（まとめ `134c7e1e`。スライドの絵を今回は変えたので③aの値とは別。比べたのは同じタブでの変更前と今）。
- 自作の「渦」を有効にしたあと、標準の「渦に吸い込み」と画素差 0。隔離中のメソッドの絵は「くしゃくしゃ」と差 0（使われていない）、コンパイル数 0（GPU に載っていない）。
- 計画からの小さな違い：
  - `openProjectFile` は、`restoreProject` が失敗したら今回登録した隔離メソッドを取り消す（`createdIds`）。開けなかったファイルのバナーが残らない（壊れたファイルで確認済み）。
  - `sequence.js` の `project.js` の import を `?v=3` に（`?v=` は shared ではない `project.js` だけ）。
  - Step 9 の「`unfold-method-trial` が空」という期待は不正確：残っていたのは確認中の印（`verify:`）ではなく、直前に描いた有効なメソッドの通常の「試用中」印（30コマ未満）。`verify:` の印は確認のたびに消えていた。
  - 非表示のブラウザペインでは `project.js` の `img.decode()` が終わらず、`openProjectFile` が止まる（既存の挙動で、今回の変更とは無関係）。テストでは `HTMLImageElement.prototype.decode` を `onload` ベースに差し替えて確認した。
