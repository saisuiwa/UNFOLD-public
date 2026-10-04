# 自作メソッド ① エンジン Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 自作メソッド（GLSL）を登録すると、1枚モードとシーケンスの一覧に出て、選んで使える状態にする。標準29個は一切変えない。エディタ・保存・見張り・`.unfold` 同梱は、この計画の外（計画②③）。

**Architecture:** 標準の頂点シェーダー（`motion.js`）に差し込み口（2か所）を足し、自作メソッドごとに別の `ShaderMaterial`（`uniforms` は共有）を作る。コンパイルは非同期で、終わるまでは「くしゃくしゃ」で代わりに表示する。失敗したメソッドは自動で `disabled` にする。コードの簡易チェック（段1）は画面に依存しない純粋関数にして Node でテストする。

**Tech Stack:** バニラ JS（ES modules）、three.js r180（`vendor/`）、テストは `node:test`（Node 25）、ブラウザ確認は Claude のブラウザペイン。

**設計書:** `docs/superpowers/specs/2026-10-02-custom-methods-design.md`（承認済み）

**全体の分け方（3つの計画）**
1. **①エンジン（この計画）**：メソッド一覧の統合、差し込み口、メソッドごとのマテリアル、ラッパー、段1のチェック、コンソールから登録して使える。
2. ②ライブラリとエディタ：保存（IndexedDB）、「＋自作メソッド」タイル、`<dialog>` のエディタ、プレビュー、試し描画（段2）。
3. ③安全とプロジェクト：使用中の見張り（段3）、クラッシュ印（段5）、`.unfold` への同梱と取り込み時の隔離（段4）、書き出し前の準備待ち。

**このプロジェクトは git リポジトリではない。** コミットの代わりに、作業前に `app/` をバックアップし（Task 0）、最後に差分が意図した範囲か確認する（Task 9）。戻すときはバックアップを `app/` に戻す。

**import の書き方（重要）:** 他のモジュールからも読まれるファイル（`method-registry.js`・`custom-method.js`）には `?v=` を付けない。付けると、ブラウザの中に別々の2つのコピーが読み込まれて、登録した自作メソッドが見えなくなる（Node のテストでは書き方が揃うので気づけない。2026-10-02 のブラウザ確認で見つけた）。

**確認用サーバー（重要）:** `preview_start` の Python は macOS の権限で `/Volumes/ORICO` を読めない。`app/` と `tools/serve.py` をスクラッチパッドにコピーして、そのコピーを配信する（詳細は Task 8）。`app/` を直したら、確認の前にコピーし直すこと。

---

## ファイル構成

| ファイル | 変更 | 役割 |
|---|---|---|
| `app/method-registry.js` | 新規 | 標準29個と自作の一覧（キー・表示名・アイコン・状態）。変更の通知 |
| `app/method-guard.js` | 新規 | 段1：コードの簡易チェック（純粋関数） |
| `app/custom-method.js` | 新規 | 差し込み（ラッパー付き）、エラー行の変換、コンパイル確認、メソッドごとのマテリアル |
| `app/motion.js` | 変更 | 差し込み口2か所、「線で描かれる」の判定を28番だけに |
| `app/sequence.js` | 変更 | レジストリの利用、マテリアル切り替え、一覧に自作タイル、`window.unfoldMethods` |
| `app/app.js` | 変更 | 同上（1枚モード） |
| `app/index.html` / `app/sequence.html` / `app/style.css` | 変更 | 一覧の置き場、水色の枠、`?v=` の更新 |
| `app/effects.js` | 変更 | `motion.js` の `?v=` を更新（import の1行だけ） |
| `tools/test/*.test.mjs`、`tools/test/fixtures/methods.mjs` | 新規 | Node の単体テストと、サンプル／意地悪サンプル |

---

### Task 0: バックアップ

**Files:**
- Create: `archive/app-before-custom-engine-2026-10-02/`（`app/` のコピー）

- [ ] **Step 1: `app/` をコピーする**

```bash
cp -R /Volumes/ORICO/UNFOLD/app /Volumes/ORICO/UNFOLD/archive/app-before-custom-engine-2026-10-02
```

- [ ] **Step 2: コピーできたか確認する**

Run: `diff -rq /Volumes/ORICO/UNFOLD/app /Volumes/ORICO/UNFOLD/archive/app-before-custom-engine-2026-10-02 && echo SAME`
Expected: `SAME`

---

### Task 1: `method-registry.js` — TDD

標準29個の「キー・表示名・アイコン・英字」と、番号（`BUILTIN_METHODS` の並び順＝シェーダーの番号）を1か所にまとめる。自作メソッドの現在の一覧も持つ（保存は計画②）。

**Files:**
- Create: `tools/test/registry.test.mjs`
- Create: `app/method-registry.js`

- [ ] **Step 1: 失敗するテストを書く**

`/Volumes/ORICO/UNFOLD/tools/test/registry.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as R from '../../app/method-registry.js';

const OLD = new URL('../../archive/app-before-custom-engine-2026-10-02/', import.meta.url);

test('there are 29 built-in methods and the order is the shader id', () => {
  assert.equal(R.BUILTIN_KEYS.length, 29);
  assert.equal(R.BUILTIN_IDS.crumple, 0);
  assert.equal(R.BUILTIN_IDS.vortex, 10);
  assert.equal(R.BUILTIN_IDS.line, 28);
});

test('keys, labels, symbols and ids match the page before this change', { skip: !existsSync(new URL('index.html', OLD)) }, () => {
  const html = readFileSync(new URL('index.html', OLD), 'utf8');
  const buttons = [...html.matchAll(/<button data-method="([a-z]+)" aria-pressed="(?:true|false)"><span class="symbol">([^<]*)<\/span>([^<]*)<small>([^<]*)<\/small><\/button>/g)];
  assert.equal(buttons.length, 29);
  buttons.forEach(([, key, symbol, label, en], i) => assert.deepEqual([key, label, symbol, en], R.BUILTIN_METHODS[i], `method #${i}`));
  const appJs = readFileSync(new URL('app.js', OLD), 'utf8');
  const ids = JSON.parse(/const methodIds=(\{[^}]*\})/.exec(appJs)[1].replace(/([a-z]+):/g, '"$1":'));
  assert.deepEqual(R.BUILTIN_IDS, ids);
});

test('icons: built-in ones carry their English name, custom ones say CUSTOM', () => {
  assert.deepEqual(R.methodIcon('scatter'), ['⠿', 'SCATTER']);
  R.registerCustom({ id: 'cm-icon', name: 'x', symbol: '渦', vertex: 'v' });
  assert.deepEqual(R.methodIcon('cm-icon'), ['渦', 'CUSTOM']);
  R.unregisterCustom('cm-icon');
});

test('custom methods: register, status, resolve, labels and change events', () => {
  let changes = 0;
  const off = R.onRegistryChange(() => { changes++; });
  R.registerCustom({ id: 'cm-a', name: 'ためし', symbol: '渦巻', vertex: 'vec3 userMethod(vec2 p, float a) { return vec3(p, 0.); }' });
  assert.equal(R.getCustom('cm-a').symbol, '渦');           // one character only
  assert.equal(R.getCustom('cm-a').rev, 1);
  assert.equal(R.resolveKey('cm-a'), 'cm-a');
  assert.equal(R.methodLabel('cm-a'), 'ためし');
  R.registerCustom({ id: 'cm-a', name: 'ためし2', vertex: 'x' });
  assert.equal(R.getCustom('cm-a').rev, 2);                 // new code = new revision
  R.setCustomStatus('cm-a', 'quarantined', '未確認');
  assert.equal(R.getCustom('cm-a').rev, 2);                 // a status change is not a new revision
  assert.equal(R.resolveKey('cm-a'), 'crumple');
  assert.equal(R.isUsable('cm-a'), false);
  assert.deepEqual(R.methodEntries('cm-a').at(-1), ['cm-a', 'ためし2（使えません）']);
  assert.equal(R.methodEntries().some(([k]) => k === 'cm-a'), false);
  R.unregisterCustom('cm-a');
  assert.equal(R.getCustom('cm-a'), undefined);
  assert.equal(changes, 4);                                  // register, register, status, unregister
  off();
});

test('unknown or odd keys fall back to the default method', () => {
  for (const key of ['', undefined, null, 'nope', 'constructor', '__proto__', 'cm-missing']) assert.equal(R.resolveKey(key), 'crumple');
  assert.equal(R.resolveKey('twist'), 'twist');
});

test('custom ids must start with cm-', () => {
  assert.throws(() => R.registerCustom({ id: 'glb-1', name: 'x', vertex: '' }), /cm-/);
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/registry.test.mjs 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|^ℹ (pass|fail)"`
Expected: `ERR_MODULE_NOT_FOUND`（`method-registry.js` が無い）。

- [ ] **Step 3: 実装を書く**

`/Volumes/ORICO/UNFOLD/app/method-registry.js`:

```js
// Every 崩れ方 (method) in one place: the 29 built-in ones — their position in this list is the number the shader uses —
// and the custom ones users add. Saving custom methods is method-library.js's job; this module only keeps what is loaded now.
export const BUILTIN_METHODS = [
  ['crumple', 'くしゃくしゃ', '▱', 'CRUMPLE'], ['scatter', 'ばらばら', '⠿', 'SCATTER'], ['twist', 'ねじれ', '〰', 'TWIST'],
  ['wave', '波打ち', '≋', 'WAVE'], ['shatter', '砕ける', '✦', 'SHATTER'], ['peel', 'めくれ', '◸', 'PEEL'],
  ['melt', 'とける', '⌇', 'MELT'], ['fold', '折りたたみ', '⋀', 'FOLD'], ['shred', 'シュレッダー', '⦀', 'SHRED'],
  ['mosaic', 'モザイク', '▦', 'MOSAIC'], ['vortex', '渦に吸い込み', '◌', 'VORTEX'], ['confetti', '星とハート', '☆♡', 'CONFETTI'],
  ['dust', '塵になる', '⁘', 'DUST'], ['sparkle', 'きらめき', '✧', 'SPARKLE'], ['burst', '爆発', '✺', 'BURST'],
  ['swarm', '群れ', '⟳', 'SWARM'], ['rain', '雨', '⫶', 'RAIN'], ['snow', '雪', '❄', 'SNOW'],
  ['bubbles', '泡', '○', 'BUBBLES'], ['halftone', '網点', '⠶', 'HALFTONE'], ['ripple', '波紋', '◎', 'RIPPLE'],
  ['galaxy', '銀河', '✦', 'GALAXY'], ['tornado', '竜巻', '⌇', 'TORNADO'], ['wind', '風で飛ぶ', '≈', 'WIND'],
  ['blinds', 'ブラインド', '☰', 'BLINDS'], ['flip', 'タイル反転', '◧', 'FLIP'], ['glitch', 'グリッチ', '▚', 'GLITCH'],
  ['petals', '花びらが舞う', '❀', 'PETALS'], ['line', '線で描かれる', '✎', 'LINE DRAW'],
];
export const BUILTIN_KEYS = BUILTIN_METHODS.map(m => m[0]);
export const BUILTIN_IDS = Object.fromEntries(BUILTIN_KEYS.map((k, i) => [k, i]));
const BUILTIN_INFO = new Map(BUILTIN_METHODS.map(([key, label, symbol, en]) => [key, { label, symbol, en }]));
export const DEFAULT_KEY = 'crumple';
export const CUSTOM_PREFIX = 'cm-';
export const isCustomKey = key => typeof key === 'string' && key.startsWith(CUSTOM_PREFIX);

const customs = new Map(), listeners = new Set();
const emit = () => { for (const fn of [...listeners]) fn(); };
export function onRegistryChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// vertex: the user's GLSL (it defines userMethod). rev goes up whenever the code is registered again, so cached shaders can tell they are stale.
// status: 'ok' | 'quarantined' | 'disabled' | 'crashed' — only 'ok' ones are used.
export function registerCustom({ id, name, symbol = '◆', vertex, status = 'ok', reason = '' }) {
  if (!isCustomKey(id)) throw new Error(`自作メソッドのidは "${CUSTOM_PREFIX}" で始めてね: ${id}`);
  const previous = customs.get(id);
  customs.set(id, { id, name: name || id, symbol: [...String(symbol || '◆')][0], vertex: String(vertex ?? ''), status, reason, rev: (previous?.rev ?? 0) + 1 });
  emit();
}
export function unregisterCustom(id) { if (customs.delete(id)) emit(); }
export function setCustomStatus(id, status, reason = '') {
  const record = customs.get(id);
  if (!record) return;
  record.status = status; record.reason = reason;
  emit();
}
export const getCustom = id => customs.get(id);
export const listCustom = () => [...customs.values()];

export const isUsable = key => isCustomKey(key) ? customs.get(key)?.status === 'ok' : typeof key === 'string' && Object.hasOwn(BUILTIN_IDS, key);
// the key itself when it can be used, otherwise the default method (a deleted, unchecked or broken custom method degrades to this)
export const resolveKey = key => key && isUsable(key) ? key : DEFAULT_KEY;

export const methodLabel = key => BUILTIN_INFO.get(key)?.label ?? customs.get(key)?.name ?? String(key);
export function methodIcon(key) {
  const builtin = BUILTIN_INFO.get(key);
  if (builtin) return [builtin.symbol, builtin.en];
  const custom = customs.get(key);
  return custom ? [custom.symbol, 'CUSTOM'] : ['◆', String(key).toUpperCase()];
}
// [[key, label], ...] for <select>s: the built-in methods, then the usable custom ones. `current` stays in the list even when it can't be used.
export function methodEntries(current = '') {
  const entries = BUILTIN_METHODS.map(([key, label]) => [key, label]);
  for (const c of customs.values()) if (c.status === 'ok' || c.id === current) entries.push([c.id, c.status === 'ok' ? c.name : `${c.name}（使えません）`]);
  return entries;
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/registry.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)|✖"`
Expected: `ℹ tests 6`、`ℹ pass 6`、`ℹ fail 0`。

---

### Task 2: `method-guard.js`（段1）— TDD

**Files:**
- Create: `tools/test/fixtures/methods.mjs`
- Create: `tools/test/guard.test.mjs`
- Create: `app/method-guard.js`

- [ ] **Step 1: サンプルを書く**

`/Volumes/ORICO/UNFOLD/tools/test/fixtures/methods.mjs`:

```js
// Sample methods for the tests. GOOD ones pass the guard. HOSTILE ones must be stopped: `error` is a piece of the message we expect.
export const GOOD = {
  vortex: `vec3 userMethod(vec2 p, float amount) {
  float r = length(p);
  vec2 q = rot(amount * 3.4 / (r + .35)) * p * (1. - amount * .6 * exp(-r * .5));
  return vec3(q, -amount * .9 * exp(-r * r * .7));
}`,
  wave: `vec3 userMethod(vec2 p, float amount) {
  vec2 q = p;
  q.x += sin(p.y * 6. + uSeed) * amount * .6;
  q.y += sin(p.x * 5. + uSeed) * amount * .48;
  return vec3(q, 0.);
}`,
  loopAndHelper: `float wobble(float x) { return sin(x) * .5; }
vec3 userMethod(vec2 p, float amount) {
  vec2 q = p;
  for (int i = 0; i < 24; i++) {
    q += vec2(sin(float(i) + q.y), cos(float(i) + q.x)) * .01 * amount;
  }
  gKind = 2.;
  return vec3(q, wobble(amount));
}`,
  commentsAreIgnored: `// while (true) { discard; }
/* #define X 1
   uniform float u; */
vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }`,
  nanValue: `vec3 userMethod(vec2 p, float amount) { float z = 0.; return vec3(p / z, 0. / z); }`,
  hugeValue: `vec3 userMethod(vec2 p, float amount) { return vec3(p * 1e30, 1e30); }`,
};

const wrap = body => `vec3 userMethod(vec2 p, float amount) {\n  vec2 q = p;\n${body}\n  return vec3(q, 0.);\n}`;

export const HOSTILE = {
  empty: { src: '', error: '空' },
  tooLong: { src: `vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }\n// ${'a'.repeat(8100)}`, error: '8000' },
  whileTrue: { src: wrap('  while (true) { q.x += 1.; }'), error: 'while' },
  doWhile: { src: wrap('  do { q.x += 1.; } for (int i = 0; i < 1; i++) { }'), error: 'do' },
  nestedTooMany: { src: wrap('  for (int i = 0; i < 16; i++) {\n    for (int j = 0; j < 16; j++) { q.x += .001; }\n  }'), error: '合計' },
  fiveLoopsOf64: { src: wrap(Array.from({ length: 5 }, () => '  for (int i = 0; i < 64; i++) { q.x += .001; }').join('\n')), error: '合計' },
  loopTooLong: { src: wrap('  for (int i = 0; i < 100; i++) { q.x += .001; }'), error: '1つあたり' },
  loopVariableChanged: { src: wrap('  for (int i = 0; i < 10; i++) { i--; }'), error: 'ループ変数' },
  loopBoundNotLiteral: { src: wrap('  int n = 5;\n  for (int i = 0; i < n; i++) { q.x += .001; }'), error: '数字' },
  loopWithoutBraces: { src: wrap('  for (int i = 0; i < 4; i++) q.x += .001;'), error: '{ }' },
  loopInHelper: { src: `float helper(float x) {\n  for (int i = 0; i < 4; i++) { x += 1.; }\n  return x;\n}\nvec3 userMethod(vec2 p, float amount) { return vec3(p, helper(amount)); }`, error: 'の中だけで使えます' },
  discardStatement: { src: wrap('  discard;'), error: 'discard' },
  glPositionWrite: { src: wrap('  gl_Position = vec4(0.);'), error: 'gl_' },
  definePreprocessor: { src: `#define X 1\nvec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }`, error: '前処理' },
  uniformDeclaration: { src: `uniform float k;\nvec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }`, error: 'uniform' },
  inDeclaration: { src: `in float k;\nvec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }`, error: 'in' },
  mainRedefinition: { src: `void main() { }\nvec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }`, error: 'main' },
  noEntryPoint: { src: 'float helper(float x) { return x; }', error: 'userMethod' },
  twoEntryPoints: { src: `vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }\nvec3 userMethod(vec2 p, float amount) { return vec3(p, 1.); }`, error: 'userMethod' },
};

// These pass the guard on purpose: the guard is only a text check, the GPU compile and the trial render must catch them.
export const GUARD_PASSES_BUT_COMPILE_FAILS = {
  syntaxError: `vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.) }`,
  undeclaredName: `vec3 userMethod(vec2 p, float amount) {\n  float k = 1.0;\n  return vec3(p, undefinedThing);\n}`,
  clashesWithBuiltIn: `float hash(vec2 p) { return 0.; }\nvec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }`,
};
```

- [ ] **Step 2: 失敗するテストを書く**

`/Volumes/ORICO/UNFOLD/tools/test/guard.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSource, LIMITS } from '../../app/method-guard.js';
import { GOOD, HOSTILE, GUARD_PASSES_BUT_COMPILE_FAILS } from './fixtures/methods.mjs';

for (const [name, src] of Object.entries(GOOD)) {
  test(`good: ${name} passes`, () => {
    const result = checkSource(src);
    assert.deepEqual(result.errors, []);
    assert.equal(result.ok, true);
  });
}

for (const [name, { src, error }] of Object.entries(HOSTILE)) {
  test(`hostile: ${name} is stopped`, () => {
    const result = checkSource(src);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(e => e.message.includes(error)), `expected a message with "${error}", got ${JSON.stringify(result.errors)}`);
  });
}

for (const [name, src] of Object.entries(GUARD_PASSES_BUT_COMPILE_FAILS)) {
  test(`the guard is only a text check: ${name} passes (the GPU compile catches it)`, () => {
    assert.equal(checkSource(src).ok, true);
  });
}

test('errors carry the line number', () => {
  const result = checkSource(`vec3 userMethod(vec2 p, float amount) {\n  vec2 q = p;\n  discard;\n  return vec3(q, 0.);\n}`);
  assert.equal(result.errors[0].line, 3);
});

test('loops are counted: sum of how often each loop body runs', () => {
  assert.equal(checkSource(GOOD.loopAndHelper).loops, 24);
  assert.equal(checkSource(HOSTILE.nestedTooMany.src).loops, 16 + 16 * 16);
});

test('limits are the ones in the design', () => {
  assert.deepEqual(LIMITS, { maxChars: 8000, maxLoop: 64, loopBudget: 256 });
});
```

- [ ] **Step 3: テストが失敗することを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/guard.test.mjs 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|^ℹ (pass|fail)"`
Expected: `ERR_MODULE_NOT_FOUND`（`method-guard.js` が無い）。

- [ ] **Step 4: 実装を書く**

`/Volumes/ORICO/UNFOLD/app/method-guard.js`:

```js
// First line of defence for user-written methods: a quick look at the text — it is not a real GLSL parser.
// The real gatekeepers are the GPU compile and the trial render; this stops the obvious troubles before that.
export const LIMITS = { maxChars: 8000, maxLoop: 64, loopBudget: 256 };

const BANNED_WORDS = ['while', 'do', 'goto', 'discard', 'main', 'uniform', 'attribute', 'varying', 'layout', 'precision'];
const TOP_LEVEL_QUALIFIERS = ['in', 'out', 'inout'];
const ENTRY = /\bvec3\s+userMethod\s*\(\s*vec2\s+[A-Za-z_]\w*\s*,\s*float\s+[A-Za-z_]\w*\s*\)\s*\{/g;
// for (int i = A; i < B; i++)   also  i <= B, ++i, i += S — only counting up, with plain numbers
const FOR_HEAD = /^\s*int\s+([A-Za-z_]\w*)\s*=\s*(\d+)\s*;\s*\1\s*(<=|<)\s*(\d+)\s*;\s*(?:\1\s*\+\+|\+\+\s*\1|\1\s*\+=\s*(\d+))\s*$/;
const LOOP_FORM = 'ループは `for (int i = 0; i < 回数; i++)` の形（回数は数字）だけ使えます。';

// comments are blanked out (not removed) so that the line numbers stay the same
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, m => m.replace(/[^\n]/g, ' '));

function matchClose(code, openIndex, open, close) {
  let depth = 0;
  for (let i = openIndex; i < code.length; i++) {
    if (code[i] === open) depth++;
    else if (code[i] === close && --depth === 0) return i;
  }
  return -1;
}

// how many times the bodies of the loops in code[from, to) run, in total (nested loops multiply)
function scanLoops(code, from, to, multiplier, add) {
  let total = 0, position = from;
  const re = /\bfor\b/g;
  for (;;) {
    re.lastIndex = position;
    const found = re.exec(code);
    if (!found || found.index >= to) return total;
    const open = code.indexOf('(', found.index + 3);
    if (open < 0 || code.slice(found.index + 3, open).trim() !== '') { add(found.index, LOOP_FORM); return total; }
    const close = matchClose(code, open, '(', ')');
    if (close < 0 || close >= to) { add(found.index, LOOP_FORM); return total; }
    let b = close + 1;
    while (b < to && /\s/.test(code[b])) b++;
    if (code[b] !== '{') { add(found.index, '`for` の本体は `{ }` で囲んでください。'); position = close + 1; continue; }
    const end = matchClose(code, b, '{', '}'), bodyEnd = end < 0 ? to : end;
    const head = FOR_HEAD.exec(code.slice(open + 1, close));
    if (!head) { add(found.index, LOOP_FORM); position = bodyEnd + 1; continue; }
    const [, variable, start, op, limit, stepText] = head;
    const step = Number(stepText || 1);
    const count = step < 1 ? Infinity
      : op === '<' ? Math.max(0, Math.ceil((Number(limit) - Number(start)) / step))
      : Math.max(0, Math.floor((Number(limit) - Number(start)) / step) + 1);
    if (count > LIMITS.maxLoop) add(found.index, `ループの回数が多すぎます（1つあたり${LIMITS.maxLoop}回まで）。`);
    const body = code.slice(b + 1, bodyEnd);
    if (new RegExp(`\\b${variable}\\s*(?:=(?!=)|[-+*/%]=|\\+\\+|--)|(?:\\+\\+|--)\\s*${variable}\\b`).test(body)) {
      add(found.index, `ループ変数 \`${variable}\` は \`for\` の中で書き換えられません。`);
    }
    total += count * multiplier;
    total += scanLoops(code, b + 1, bodyEnd, multiplier * (Number.isFinite(count) ? count : 1), add);
    position = bodyEnd + 1;
  }
}

export function checkSource(source) {
  const text = String(source ?? '');
  if (!text.trim()) return { ok: false, errors: [{ line: null, message: 'コードが空です。' }], loops: 0 };
  if (text.length > LIMITS.maxChars) return { ok: false, errors: [{ line: null, message: `長すぎます（${LIMITS.maxChars}文字まで）。` }], loops: 0 };
  const code = stripComments(text);
  const errors = [];
  const add = (index, message) => errors.push({ line: index == null ? null : code.slice(0, index).split('\n').length, message });

  const hash = /#/.exec(code);
  if (hash) add(hash.index, '`#` で始まる行（前処理）は使えません。');
  for (const word of BANNED_WORDS) {
    const m = new RegExp(`\\b${word}\\b`).exec(code);
    if (m) add(m.index, `\`${word}\` は使えません。`);
  }
  const gl = /\bgl_\w*/.exec(code);
  if (gl) add(gl.index, '`gl_` で始まる名前は使えません。');

  // in / out / inout are fine inside a function's parentheses, but not as declarations at the top level
  let braces = 0, parens = 0;
  for (const m of code.matchAll(/[{}()]|\b[A-Za-z_]\w*\b/g)) {
    const token = m[0];
    if (token === '{') braces++;
    else if (token === '}') braces--;
    else if (token === '(') parens++;
    else if (token === ')') parens--;
    else if (braces === 0 && parens === 0 && TOP_LEVEL_QUALIFIERS.includes(token)) add(m.index, `\`${token}\` の宣言は使えません。`);
  }

  const entries = [...code.matchAll(ENTRY)];
  if (entries.length !== 1) add(null, '`vec3 userMethod(vec2 p, float amount)` を1つ書いてください。');
  const entry = entries.length === 1 ? entries[0] : null;
  const bodyOpen = entry ? entry.index + entry[0].length - 1 : -1;
  const bodyClose = entry ? matchClose(code, bodyOpen, '{', '}') : -1;
  const bodyEnd = bodyClose < 0 ? code.length : bodyClose;
  for (const m of code.matchAll(/\bfor\b/g)) {
    if (!entry || m.index < bodyOpen || m.index > bodyEnd) add(m.index, 'ループ（`for`）は `userMethod` の中だけで使えます。');
  }
  const loops = entry ? scanLoops(code, bodyOpen + 1, bodyEnd, 1, add) : 0;
  if (loops > LIMITS.loopBudget) add(null, `ループの実行回数の合計が多すぎます（${loops}回。${LIMITS.loopBudget}回まで）。`);
  return { ok: errors.length === 0, errors, loops };
}
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/guard.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)|✖"`
Expected: `ℹ tests 31`、`ℹ fail 0`（`✖` の行が出ない）。

---

### Task 3: `motion.js` — 差し込み口と「線で描かれる」の判定

**Files:**
- Modify: `app/motion.js`
- Create: `tools/test/motion-anchors.test.mjs`

- [ ] **Step 1: 失敗するテストを書く**

`/Volumes/ORICO/UNFOLD/tools/test/motion-anchors.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { vertexShader } from '../../app/motion.js';

const count = (s, part) => s.split(part).length - 1;

test('the vertex shader has the two places custom methods plug into, in the right order', () => {
  assert.equal(count(vertexShader, '//@CUSTOM_FUNCTIONS'), 1);
  assert.equal(count(vertexShader, '//@CUSTOM_DISPATCH'), 1);
  const functions = vertexShader.indexOf('//@CUSTOM_FUNCTIONS');
  const breakAt = vertexShader.indexOf('vec3 breakAt(float m,vec2 p,float amount){');
  const dispatch = vertexShader.indexOf('//@CUSTOM_DISPATCH');
  assert.ok(functions < breakAt && breakAt < dispatch, 'functions, then breakAt, then the dispatch inside it');
  // the functions have to come after the helpers a custom method may call
  for (const helper of ['float hash(vec2 p)', 'mat2 rot(float a)', 'vec2 partC()', 'float ph(float k)']) assert.ok(vertexShader.indexOf(helper) < functions, helper);
});

test('only method 28 (line) switches off the tile shuffle, numbers for custom methods do not', () => {
  assert.ok(vertexShader.includes('lineA=step(27.5,uMethod)*step(uMethod,28.5),lineB=step(27.5,uMethod2)*step(uMethod2,28.5)'));
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/motion-anchors.test.mjs 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ fail 2`

- [ ] **Step 3: `motion.js` を直す**

1. 差し込み口（`breakAt` の前と中）
   old_string:
   ```
   vec3 breakAt(float m,vec2 p,float amount){
     vec2 q=p;
   ```
   new_string:
   ```
   //@CUSTOM_FUNCTIONS
   vec3 breakAt(float m,vec2 p,float amount){
     //@CUSTOM_DISPATCH
     vec2 q=p;
   ```
2. 線で描かれる（28番）だけの判定
   old_string: `float lineA=step(27.5,uMethod),lineB=step(27.5,uMethod2);`
   new_string: `float lineA=step(27.5,uMethod)*step(uMethod,28.5),lineB=step(27.5,uMethod2)*step(uMethod2,28.5);`

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/motion-anchors.test.mjs 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 2`、`ℹ fail 0`

- [ ] **Step 5: 他のファイルの `motion.js` の版を上げる**

`motion.js` が変わったので、キャッシュ対策に3か所の import の `?v=21` を `?v=22` にする。
- `app/app.js`：old `from './motion.js?v=21';` → new `from './motion.js?v=22';`
- `app/sequence.js`：old `from './motion.js?v=21';` → new `from './motion.js?v=22';`
- `app/effects.js`：old `from './motion.js?v=21';` → new `from './motion.js?v=22';`

Run: `cd /Volumes/ORICO/UNFOLD/app && grep -rn "motion.js?v=" *.js | cut -c1-100`
Expected: 3行とも `?v=22`。

---

### Task 4: `custom-method.js` その1 — 差し込みとエラー行の変換（純粋な部分）— TDD

**Files:**
- Create: `tools/test/custom-method.test.mjs`
- Create: `app/custom-method.js`

- [ ] **Step 1: 失敗するテストを書く**

`/Volumes/ORICO/UNFOLD/tools/test/custom-method.test.mjs`:

```js
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
  for (const part of ['isnan(r)', 'isinf(r)', 'clamp(r,vec3(-8.),vec3(8.))', 'gKind=clamp(floor(gKind+.5),0.,8.)', 'smoothstep(0.,.03,amount)']) assert.ok(source.includes(part), part);
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/custom-method.test.mjs 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|^ℹ (pass|fail)"`
Expected: `ERR_MODULE_NOT_FOUND`（`custom-method.js` が無い）。

- [ ] **Step 3: 純粋な部分を書く**

`/Volumes/ORICO/UNFOLD/app/custom-method.js`（この Task では下の内容だけ。Task 5 で続きを足す）:

```js
// Custom methods: the user's GLSL is wrapped and plugged into the vertex shader of motion.js, one ShaderMaterial per custom method.
// A custom method lives in "slot" 100 (A) or 101 (B) of the shader — the numbers the shader's uMethod / uMethod2 get.
export const SLOT_A = 100, SLOT_B = 101;
const FUNCTIONS_MARK = '//@CUSTOM_FUNCTIONS', DISPATCH_MARK = '//@CUSTOM_DISPATCH';
const newlines = text => (text.match(/\n/g) || []).length;

// Whatever the user's code returns goes through here: NaN/Infinity -> the original position, positions are kept within ±8,
// the particle look values stay in their ranges, and when nothing is broken yet (amount ≈ 0) the picture is exactly the original.
const runner = slot => `vec3 um_${slot}_run(vec2 p,float amount){
  vec3 r=um_${slot}_main(p,amount);
  if(any(isnan(r))||any(isinf(r)))r=vec3(p,0.);
  r=clamp(r,vec3(-8.),vec3(8.));
  gKind=clamp(floor(gKind+.5),0.,8.);gAlpha=clamp(gAlpha,0.,1.);gGlow=clamp(gGlow,0.,2.);gLocal=step(.5,gLocal);
  return mix(vec3(p,0.),r,smoothstep(0.,.03,amount));
}`;

// Returns the vertex shader with the user's method(s) plugged in, and where the user's code sits (for translating GPU error lines):
// map[slot] = { start0: 0-based line of the user's first line in the assembled source, lines: how many lines the user's code has }
export function assembleVertex(base, { a = '', b = '' } = {}) {
  if (base.split(FUNCTIONS_MARK).length !== 2 || base.split(DISPATCH_MARK).length !== 2) {
    throw new Error('motion.js の差し込み口（//@CUSTOM_FUNCTIONS と //@CUSTOM_DISPATCH）が見つかりません。');
  }
  let functions = '', dispatch = '', cursor = newlines(base.slice(0, base.indexOf(FUNCTIONS_MARK)));
  const map = {};
  for (const [slot, source, number] of [['a', a, SLOT_A], ['b', b, SLOT_B]]) {
    if (!source) continue;
    const text = `\n${source.replace(/\buserMethod\b/g, `um_${slot}_main`)}\n${runner(slot)}\n`;
    map[slot] = { start0: cursor + 1, lines: newlines(source) + 1 };
    cursor += newlines(text);
    functions += text;
    dispatch += `if(m>${number - .5}&&m<${number + .5})return um_${slot}_run(p,amount);`;
  }
  // function replacers: the user's code may contain "$&" and the like
  return { source: base.replace(FUNCTIONS_MARK, () => functions).replace(DISPATCH_MARK, () => dispatch), map };
}

// GPU log -> [{ slot, line, message }]. `prefix` is what three.js puts in front of our source (its line count is the offset).
export function explainLog(log, prefix, map = {}) {
  const offset = newlines(prefix || '') + 1;
  const out = [];
  for (const raw of String(log || '').replace(/\0/g, '').split('\n')) {
    const m = /^ERROR:\s*\d+:(\d+):\s*(.*)$/.exec(raw.trim());
    if (!m) continue;
    const assembled = Number(m[1]) - offset;
    let found = null;
    for (const [slot, { start0, lines }] of Object.entries(map)) {
      const line = assembled - start0;
      if (line >= 1 && line <= lines) { found = { slot, line }; break; }
    }
    out.push({ slot: found?.slot ?? null, line: found?.line ?? null, message: m[2].trim() });
  }
  return out;
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/custom-method.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)|✖"`
Expected: `ℹ pass 10`、`ℹ fail 0`。

---

### Task 5: `custom-method.js` その2 — コンパイル確認とメソッドごとのマテリアル — TDD

コンパイルは three.js 側で遅延される。`compileAsync` のあとで `getUniforms()` を呼ぶと、失敗していれば `program.diagnostics.runnable === false` と、`diagnostics.vertexShader.log` / `.prefix` が取れる（r180 のブラウザで確認済み）。Node のテストでは、この形をまねた偽の `renderer` を使う。

**Files:**
- Modify: `app/custom-method.js`（末尾に追記）
- Create: `tools/test/variants.test.mjs`

- [ ] **Step 1: 失敗するテストを書く**

`/Volumes/ORICO/UNFOLD/tools/test/variants.test.mjs`:

```js
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
  assert.deepEqual({ ...variants.pick('twist', 'wave'), material: undefined }, { material: undefined, uMethod: 2, uMethod2: 3 });
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
  const pair = variants.pick('cm-a', 'cm-b');
  assert.equal(pair.uMethod, SLOT_A);
  assert.equal(pair.uMethod2, SLOT_B);
  assert.ok(pair.material.vertexShader.includes('um_a_run') && pair.material.vertexShader.includes('um_b_run'));
  const mixed = variants.pick('twist', 'cm-b');          // one custom + one built-in: a single-slot shader for cm-b
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
  const fallback = variants.pick('cm-a', 'cm-b');
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
  assert.equal(variants.count(), 0, 'the stale shader is gone');
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/variants.test.mjs 2>&1 | grep -E "createVariants|SyntaxError|^ℹ (pass|fail)" | head -3`
Expected: `createVariants` が export されていない、というエラー（`SyntaxError: ... does not provide an export named 'createVariants'`）。

- [ ] **Step 3: 実装を追記する**

`app/custom-method.js` の先頭（コメントの次）に import を足す。

old_string:
```
// Custom methods: the user's GLSL is wrapped and plugged into the vertex shader of motion.js, one ShaderMaterial per custom method.
// A custom method lives in "slot" 100 (A) or 101 (B) of the shader — the numbers the shader's uMethod / uMethod2 get.
export const SLOT_A = 100, SLOT_B = 101;
```
new_string:
```
// Custom methods: the user's GLSL is wrapped and plugged into the vertex shader of motion.js, one ShaderMaterial per custom method.
// A custom method lives in "slot" 100 (A) or 101 (B) of the shader — the numbers the shader's uMethod / uMethod2 get.
import * as THREE from './vendor/three.module.min.js';
import { BUILTIN_IDS, DEFAULT_KEY, getCustom, isCustomKey, onRegistryChange, resolveKey, setCustomStatus } from './method-registry.js';

export const SLOT_A = 100, SLOT_B = 101;
```

そして、ファイルの末尾に追記する:

```js

// three.js compiles lazily: after compileAsync the program only reports a failure once something asks for its uniforms.
// Resolves to program.diagnostics when the program failed, otherwise null.
export async function compileCheck(renderer, material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 10);
  // three.js prints the whole shader when it fails; we show our own message instead, so keep that one out of the console
  const log = console.error;
  console.error = (...args) => { if (!String(args[0]).startsWith('THREE.WebGLProgram')) log.apply(console, args); };
  try {
    await renderer.compileAsync(scene, camera);
    const program = renderer.properties.get(material).currentProgram;
    program.getUniforms();
    return program.diagnostics?.runnable === false ? program.diagnostics : null;
  } finally {
    console.error = log;
    geometry.dispose();
  }
}

const errorsOf = (diagnostics, map) => {
  const errors = explainLog(diagnostics.vertexShader?.log || diagnostics.programLog, diagnostics.vertexShader?.prefix, map);
  return errors.length ? errors : [{ slot: null, line: null, message: 'コンパイルに失敗しました。' }];
};

// Compile one user method on its own (the editor does this before saving). Resolves to [] when it compiles, otherwise to the errors.
export async function compileUserMethod(renderer, { vertexShader, fragmentShader, source }) {
  const { source: assembled, map } = assembleVertex(vertexShader, { a: source });
  const material = new THREE.ShaderMaterial({ uniforms: {}, vertexShader: assembled, fragmentShader });
  try {
    const diagnostics = await compileCheck(renderer, material);
    return diagnostics ? errorsOf(diagnostics, map) : [];
  } finally {
    material.dispose();
  }
}

// One ShaderMaterial per custom method (or pair of them), made from the same shader and sharing `uniforms` with `base`.
// pick(keyA, keyB) -> { material, uMethod, uMethod2 }: never returns a shader that is still compiling or has failed —
// the custom method that is not ready is replaced by the default method, so the picture never breaks. onReady(variant) fires when one finishes.
export function createVariants({ renderer, vertexShader, fragmentShader, uniforms, onReady = () => {} }) {
  const make = source => new THREE.ShaderMaterial({ uniforms, vertexShader: source, fragmentShader, side: THREE.DoubleSide, transparent: true });
  const base = make(vertexShader);
  const variants = new Map();          // "cm-a@1|cm-b@2" -> { ids, key, map, state: 'pending' | 'ok' | 'failed', errors, material }
  let disposed = false;
  const keyOf = ids => ids.map(id => `${id}@${getCustom(id)?.rev}`).join('|');

  // shaders of methods that were removed, changed or switched off are dropped
  const prune = () => {
    for (const [key, v] of variants) {
      if (v.ids.every(id => getCustom(id)?.status === 'ok') && key === keyOf(v.ids)) continue;
      v.material.dispose();
      variants.delete(key);
    }
  };
  const stopListening = onRegistryChange(prune);

  function settle(v) {
    if (disposed || variants.get(v.key) !== v) return;
    if (v.state === 'failed' && v.ids.length === 1) {   // a pair that fails is nobody's fault alone
      const e = v.errors[0];
      setCustomStatus(v.ids[0], 'disabled', e ? `${e.line ? `${e.line}行目: ` : ''}${e.message}` : 'コンパイルに失敗しました。');
    }
    onReady(v);
  }

  function build(ids) {
    const key = keyOf(ids);
    const known = variants.get(key);
    if (known) return known;
    const { source, map } = assembleVertex(vertexShader, { a: getCustom(ids[0]).vertex, b: ids[1] ? getCustom(ids[1]).vertex : '' });
    const v = { ids, key, map, state: 'pending', errors: [], material: make(source) };
    variants.set(key, v);
    compileCheck(renderer, v.material).then(
      diagnostics => { if (diagnostics) { v.state = 'failed'; v.errors = errorsOf(diagnostics, map); } else v.state = 'ok'; },
      error => { v.state = 'failed'; v.errors = [{ slot: null, line: null, message: String(error?.message || error) }]; },
    ).then(() => settle(v));
    return v;
  }

  function pick(keyA, keyB = '') {
    let a = keyA ? resolveKey(keyA) : DEFAULT_KEY, b = keyB ? resolveKey(keyB) : '';
    for (;;) {
      const ids = [...new Set([a, b].filter(isCustomKey))];
      if (!ids.length) return { material: base, uMethod: BUILTIN_IDS[a], uMethod2: b ? BUILTIN_IDS[b] : 0 };
      const v = build(ids);
      if (v.state === 'ok') {
        const number = key => ids.indexOf(key) === 0 ? SLOT_A : SLOT_B;
        return { material: v.material, uMethod: isCustomKey(a) ? number(a) : BUILTIN_IDS[a], uMethod2: !b ? 0 : isCustomKey(b) ? number(b) : BUILTIN_IDS[b] };
      }
      // still compiling, or failed: step back — the last custom method becomes the default method, then the first
      const give = ids[ids.length - 1];
      if (a === give) a = DEFAULT_KEY;
      if (b === give) b = DEFAULT_KEY;
    }
  }

  return {
    base, pick,
    count: () => variants.size,
    dispose() {
      disposed = true;
      stopListening();
      for (const v of variants.values()) v.material.dispose();
      variants.clear();
      base.dispose();
    },
  };
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/variants.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)|✖|not ok" | head`
Expected: `ℹ pass 9`、`ℹ fail 0`。

- [ ] **Step 5: ここまで全部のテストを通す**

Run: `cd /Volumes/ORICO/UNFOLD && node --test "tools/test/*.test.mjs" 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `ℹ fail 0`（`look-view.test.mjs` の5本も含む）。

---

### Task 6: `sequence.js` — シーケンスに組み込む

**Files:**
- Modify: `app/sequence.js`
- Modify: `app/sequence.html`

- [ ] **Step 1: import と、方法一覧の定義の置き換え**

1. import を足す。
   old_string: `import { lookView, lookViewText } from './look-view.js?v=1';`
   new_string:
   ```
   import { lookView, lookViewText } from './look-view.js?v=1';
   import { BUILTIN_KEYS, isCustomKey, listCustom, methodEntries, methodIcon, methodLabel, onRegistryChange, registerCustom, setCustomStatus, unregisterCustom } from './method-registry.js';
   import { createVariants } from './custom-method.js';
   ```
2. `effects.js` の版を上げる。
   old_string: `from './effects.js?v=26';` → new_string: `from './effects.js?v=27';`
3. `METHODS`・`METHOD_IDS`・`METHOD_ICONS` の定義を消す（日本語を含む長い塊なので、スクリプトで消す）。

```bash
cd /Volumes/ORICO/UNFOLD/app && node -e "
const fs = require('fs');
let s = fs.readFileSync('sequence.js', 'utf8');
const a = /const METHODS = \{[\s\S]*?\};\nconst METHOD_IDS = [^\n]*\n/;
const b = /\/\/ same symbols as the single-image mode\nconst METHOD_ICONS = \{[\s\S]*?\};\n/;
if (!a.test(s) || !b.test(s)) throw new Error('definition blocks not found');
s = s.replace(a, '// every method (the built-in ones and the ones users add) is listed in method-registry.js\n').replace(b, '');
fs.writeFileSync('sequence.js', s);
console.log('removed');
"
grep -n "METHOD_IDS\|METHOD_ICONS\|const METHODS" sequence.js | cut -c1-120
```
Expected: `removed`。その後の `grep` は `METHOD_IDS` と `METHOD_ICONS` の使用箇所（次の Step で直す）だけが残る。`const METHODS` は出ない。

- [ ] **Step 2: 使っている所を1つずつ直す**

1. old: `method: Object.keys(METHODS)[i % Object.keys(METHODS).length]`
   new: `method: BUILTIN_KEYS[i % BUILTIN_KEYS.length]`
2. old: `do { tr.method = pick(Object.keys(METHODS)); } while`
   new: `do { tr.method = pick(BUILTIN_KEYS); } while`
3. old: `pick(Object.keys(METHODS).filter(k => k !== tr.method))`
   new: `pick(BUILTIN_KEYS.filter(k => k !== tr.method))`
4. old: `${METHODS[seq.transitions[L.tr].method]}`
   new: `${methodLabel(seq.transitions[L.tr].method)}`
5. old: `const m = selectOf(Object.entries(METHODS), tr.method);`
   new: `const m = selectOf(methodEntries(tr.method), tr.method);`
6. old: `...Object.entries(METHODS).map(([k, v]) => [k, v + 'で戻る'])`
   new: `...methodEntries(tr.method2).map(([k, v]) => [k, v + 'で戻る'])`
7. old: `const label = METHODS[tr.method] + (tr.method2 ? '→' + METHODS[tr.method2] : '')`
   new: `const label = methodLabel(tr.method) + (tr.method2 ? '→' + methodLabel(tr.method2) : '')`

（ランダムに選ぶ所は標準の29個だけにして、自作は自動では選ばない。）

- [ ] **Step 3: メソッド一覧（`renderMethodGrid`）を、標準＋使える自作から作るようにする**

1. old: `function renderMethodGrid() {`
   new: `let methodGridSignature = '';\nfunction renderMethodGrid() {`
2. old: `  if (!grid.childElementCount) {`
   new:
   ```
     const keys = [...BUILTIN_KEYS, ...listCustom().filter(c => c.status === 'ok').map(c => c.id)];
     const signature = keys.map(k => `${k}|${methodLabel(k)}|${methodIcon(k)[0]}`).join(',');
     if (signature !== methodGridSignature) {
       methodGridSignature = signature;
       grid.replaceChildren();
   ```
3. old: `    for (const [k, label] of Object.entries(METHODS)) {`
   new: `    for (const k of keys) {`
4. old: `      b.dataset.method = k; b.setAttribute('aria-pressed', 'false');`
   new: `      b.dataset.method = k; b.setAttribute('aria-pressed', 'false');\n      if (isCustomKey(k)) b.classList.add('added');`
5. old: `sym.textContent = METHOD_ICONS[k]?.[0] || '◆';`
   new: `sym.textContent = methodIcon(k)[0];`
6. old: `en.textContent = METHOD_ICONS[k]?.[1] || k.toUpperCase();`
   new: `en.textContent = methodIcon(k)[1];`
7. old: `      b.append(sym, label, en);`
   new: `      b.append(sym, methodLabel(k), en);`
8. old: `$('seq-methods-tag').textContent = `${Object.keys(METHODS).length} METHODS`;`
   new: `$('seq-methods-tag').textContent = `${keys.length} METHODS`;`

- [ ] **Step 4: `renderAt` でマテリアルと番号を決める**

old_string:
```
  u.uSeed.value = 28 + (L.tr >= 0 ? L.tr * 37 : 0); u.uMethod.value = tr ? METHOD_IDS[tr.method] : 0;
  u.uMethod2.value = tr?.method2 ? METHOD_IDS[tr.method2] : 0; u.uMethodMix.value = tr?.method2 ? smooth(.30, .62, L.u) : 0;
```
new_string:
```
  // custom methods have their own shader: swap it in (uniforms are shared, so `u` stays valid)
  const pick = variants.pick(tr ? tr.method : '', tr?.method2 || '');
  if (mesh.material !== pick.material) mesh.material = pick.material;
  u.uSeed.value = 28 + (L.tr >= 0 ? L.tr * 37 : 0); u.uMethod.value = pick.uMethod;
  u.uMethod2.value = pick.uMethod2; u.uMethodMix.value = tr?.method2 ? smooth(.30, .62, L.u) : 0;
```

- [ ] **Step 5: 作る所（`variants`）と、登録の変化への反応、確認用の窓口**

1. old: `let renderer, scene, camera, perspCam, mesh, sceneBlur, backdrop;`
   new: `let renderer, scene, camera, perspCam, mesh, sceneBlur, backdrop, variants;`
2. old: `  mesh = new THREE.Mesh(geoCache.get('sphere'), new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.DoubleSide, transparent: true }));`
   new:
   ```
     variants = createVariants({ renderer, vertexShader, fragmentShader, uniforms, onReady: () => { if (!seq.playing) renderAt(seq.t); } });
     onRegistryChange(() => { renderMethodGrid(); renderInspector(); if (!seq.playing) renderAt(seq.t); });
     mesh = new THREE.Mesh(geoCache.get('sphere'), variants.base);
   ```
3. 確認用の窓口を `window.unfoldSeq = {...}` の次の行に足す。
   old_string: `renderAt, totalSeconds, exportWebM, refreshUI };`
   new_string: `renderAt, totalSeconds, exportWebM, refreshUI };\n  window.unfoldMethods = { registerCustom, unregisterCustom, setCustomStatus, listCustom, variants };`

- [ ] **Step 6: CSS と `?v=`**

`app/sequence.html`:
1. old: `  .choice-grid button.second { border-style:dashed; border-color:#8fb4d6; color:#bfe0ff; }`
   new:
   ```
     .choice-grid button.second { border-style:dashed; border-color:#8fb4d6; color:#bfe0ff; }
     .choice-grid button.added { border-color:#3a6a82; }
     .choice-grid button.added[aria-pressed=true] { border-color:var(--added); color:var(--added); background:#1d3440; }
   ```
2. old: `<script type="module" src="./sequence.js?v=46"></script>`
   new: `<script type="module" src="./sequence.js?v=47"></script>`

- [ ] **Step 7: 構文を確認する**

Run: `cd /Volumes/ORICO/UNFOLD/app && S=/private/tmp/claude-501/-Volumes-ORICO-UNFOLD/e8107f15-5f2a-459b-a83e-4e6edb1a6f69/scratchpad && cp sequence.js "$S/sequence-check.mjs" && node --check "$S/sequence-check.mjs" && echo SYNTAX_OK; grep -n "METHODS\b\|METHOD_IDS\|METHOD_ICONS" sequence.js | cut -c1-100`
Expected: `SYNTAX_OK`。`grep` は何も出ない（`METHODS` の語は残らない。コメント行の「method-registry.js」は `METHODS` を含まない）。

---

### Task 7: `app.js`（1枚モード）に組み込む

**Files:**
- Modify: `app/app.js`、`app/index.html`、`app/style.css`

- [ ] **Step 1: import・変数・古い番号表の削除**

1. old: `import {effectsAt,SceneBlur} from './effects.js?v=26';`
   new:
   ```
   import {effectsAt,SceneBlur} from './effects.js?v=27';
   import {BUILTIN_KEYS,isCustomKey,listCustom,methodIcon,methodLabel,onRegistryChange,registerCustom,resolveKey,setCustomStatus,unregisterCustom} from './method-registry.js';
   import {createVariants} from './custom-method.js';
   ```
2. old: `let renderer,scene,camera,mesh,texture,`
   new: `let renderer,scene,camera,mesh,variants,texture,`
3. 古い番号表を消す（`methodIds` はこの1か所でしか使われていない）。
   old: `methodIds={crumple:0,scatter:1,twist:2,wave:3,shatter:4,peel:5,melt:6,fold:7,shred:8,mosaic:9,vortex:10,confetti:11,dust:12,sparkle:13,burst:14,swarm:15,rain:16,snow:17,bubbles:18,halftone:19,ripple:20,galaxy:21,tornado:22,wind:23,blinds:24,flip:25,glitch:26,petals:27,line:28},`
   new: （空にする）

- [ ] **Step 2: 画像を読み込むたびに作るマテリアルを `variants` に**

1. old: `new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,side:THREE.DoubleSide,transparent:true})`
   new: `(variants?.dispose(),variants=createVariants({renderer,vertexShader,fragmentShader,uniforms,onReady:()=>render()}),variants.base)`
2. `render()` の中:
   - old: `const m=motionAt(state.t),u=mesh.material.uniforms;`
     new: `const m=motionAt(state.t),u=mesh.material.uniforms;const pick=variants.pick(state.method);if(mesh.material!==pick.material)mesh.material=pick.material;`
   - old: `u.uMethod.value=methodIds[state.method];`
     new: `u.uMethod.value=pick.uMethod;u.uMethod2.value=pick.uMethod2;`

- [ ] **Step 3: メソッドのタイルを、レジストリから作る**

1. old: `$('methods').addEventListener('click',e=>{const b=e.target.closest('[data-method]');if(b)setChoice('methods','method',b.dataset.method)});`
   new:
   ```
   $('methods').addEventListener('click',e=>{const b=e.target.closest('[data-method]');if(b)setChoice('methods','method',b.dataset.method)});
    // the tiles come from the registry: the 29 built-in methods plus the usable custom ones (blue frame)
    function renderMethodTiles(){
     const keys=[...BUILTIN_KEYS,...listCustom().filter(c=>c.status==='ok').map(c=>c.id)];
     const signature=keys.map(k=>`${k}|${methodLabel(k)}|${methodIcon(k)[0]}`).join(',');
     if($('methods').dataset.signature!==signature){
      $('methods').dataset.signature=signature;$('methods').replaceChildren();
      for(const k of keys){const [symbol,en]=methodIcon(k);const b=document.createElement('button');b.dataset.method=k;b.setAttribute('aria-pressed',String(k===state.method));if(isCustomKey(k))b.classList.add('added');
       const s=document.createElement('span');s.className='symbol';s.textContent=symbol;const small=document.createElement('small');small.textContent=en;b.append(s,methodLabel(k),small);$('methods').append(b)}
      $('methods-tag').textContent=`${keys.length} METHODS`;
     }
    }
    renderMethodTiles();
    onRegistryChange(()=>{state.method=resolveKey(state.method);renderMethodTiles();document.querySelectorAll('#methods button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.method===state.method)));render()});
   ```
2. 確認用の窓口。
   old: `window.unfold={state,motionAt,setTime,render,loadImage,outputSize};`
   new: `window.unfold={state,motionAt,setTime,render,loadImage,outputSize};window.unfoldMethods={registerCustom,unregisterCustom,setCustomStatus,listCustom,get variants(){return variants}};`

- [ ] **Step 4: HTML・CSS**

1. 静的な29個のボタンを消し、タグに id を付ける（`index.html` の1行が長いのでスクリプトで）。

```bash
cd /Volumes/ORICO/UNFOLD/app && node -e "
const fs = require('fs');
let s = fs.readFileSync('index.html', 'utf8');
const a = /(<div class=\"choice-grid\" id=\"methods\"[^>]*>)(?:<button data-method=[\s\S]*?<\/button>)+(<\/div>)/;
if (!a.test(s)) throw new Error('methods grid not found');
s = s.replace(a, '\$1\$2');
if (!s.includes('<span class=\"tag\">29 METHODS</span>')) throw new Error('tag not found');
s = s.replace('<span class=\"tag\">29 METHODS</span>', '<span class=\"tag\" id=\"methods-tag\">29 METHODS</span>');
s = s.replace('./app.js?v=43', './app.js?v=44').replace('./style.css?v=7', './style.css?v=8');
fs.writeFileSync('index.html', s);
console.log('ok');
"
grep -c 'data-method=' index.html; grep -o 'id="methods" role="group" aria-label="変形の種類"></div>' index.html; grep -o 'app.js?v=44\|style.css?v=8\|id="methods-tag"' index.html
```
Expected: `ok`、`data-method=` の数は `0`、空になった `#methods` の行、`app.js?v=44`・`style.css?v=8`・`id="methods-tag"` が出る。

2. `style.css` に水色の枠（`--added` は `style.css` に定義済み）。
   末尾に追記:
   ```css
   #methods button.added{border-color:#3a6a82}
   #methods button.added[aria-pressed=true]{border-color:var(--added);color:var(--added);background:#1d3440}
   ```
   （`>>` で追記してよい。）

- [ ] **Step 5: 構文を確認する**

Run: `cd /Volumes/ORICO/UNFOLD/app && S=/private/tmp/claude-501/-Volumes-ORICO-UNFOLD/e8107f15-5f2a-459b-a83e-4e6edb1a6f69/scratchpad && cp app.js "$S/app-check.mjs" && node --check "$S/app-check.mjs" && echo SYNTAX_OK; grep -c "methodIds" app.js`
Expected: `SYNTAX_OK`、`0`。

---

### Task 8: ブラウザで確認する

**Files:** なし（確認だけ）。`.claude/launch.json` に一時的な設定を足し、最後に元へ戻す。

- [ ] **Step 1: `app/` のコピーを作って、確認用サーバーを起動する**

```bash
S=/private/tmp/claude-501/-Volumes-ORICO-UNFOLD/e8107f15-5f2a-459b-a83e-4e6edb1a6f69/scratchpad/unfold-preview
rm -rf "$S/app" && mkdir -p "$S/tools" && cp -R /Volumes/ORICO/UNFOLD/app "$S/app" && cp /Volumes/ORICO/UNFOLD/tools/serve.py "$S/tools/serve.py" && diff -rq /Volumes/ORICO/UNFOLD/app "$S/app" && echo COPY_SAME
```
Expected: `COPY_SAME`。
`/Volumes/ORICO/UNFOLD/.claude/launch.json` の `configurations` に追加（確認が終わったら削除する）:
`{ "name": "unfold-serve", "runtimeExecutable": "python3", "runtimeArgs": ["/private/tmp/claude-501/-Volumes-ORICO-UNFOLD/e8107f15-5f2a-459b-a83e-4e6edb1a6f69/scratchpad/unfold-preview/tools/serve.py"], "port": 8771 }`
`preview_start` で `{name: "unfold-serve"}` を起動する。

- [ ] **Step 2: シーケンスを開いて、画像を3枚入れる**

`navigate` で `http://localhost:8771/sequence.html?empty`。`read_console_messages`（`onlyErrors: true`）が空であること。続けて `javascript_tool`:

```js
const mk = c => { const k = document.createElement('canvas'); k.width = 640; k.height = 360; const g = k.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 640, 360); g.fillStyle = '#fff'; g.font = '80px sans-serif'; g.fillText(c, 40, 200); return k.toDataURL(); };
for (const c of ['#e55', '#5a5', '#55e']) await unfoldSeq.addImageFromUrl(mk(c), c);
({ slides: unfoldSeq.seq.slides.length, tiles: document.querySelectorAll('#seq-methods button').length, tag: document.getElementById('seq-methods-tag').textContent, custom: unfoldMethods.listCustom().length })
```
Expected: `{ slides: 3, tiles: 29, tag: '29 METHODS', custom: 0 }`。

- [ ] **Step 3: 自作の「渦」が、標準の「渦に吸い込み」と同じ絵になる**

```js
const cv = document.getElementById('seq-canvas');
const grab = () => { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const g = c.getContext('2d'); g.drawImage(cv, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
const diff = (a, b) => { let max = 0, sum = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d > max) max = d; sum += d; } return { max, mean: +(sum / a.length).toFixed(5) }; };
const waitFor = async (fn, ms = 5000) => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > ms) throw new Error('timeout'); await new Promise(r => setTimeout(r, 30)); } };
const B = 60 / unfoldSeq.seq.bpm, t = 5 * B;   // 1枚目を4拍見せたあとの、ぐちゃぐちゃの途中
const tr = unfoldSeq.seq.transitions[0];
window.__h = { cv, grab, diff, waitFor, B, t, tr };
tr.method = 'twist'; unfoldSeq.renderAt(t); window.__h.twistBefore = grab();     // 標準の「ねじれ」を先に撮る（あとで変わっていないことの確認用）
tr.method = 'vortex'; unfoldSeq.renderAt(t); const builtIn = grab();
const vortex = `vec3 userMethod(vec2 p, float amount) { float r = length(p); vec2 q = rot(amount * 3.4 / (r + .35)) * p * (1. - amount * .6 * exp(-r * .5)); return vec3(q, -amount * .9 * exp(-r * r * .7)); }`;
unfoldMethods.registerCustom({ id: 'cm-test-vortex', name: 'テスト渦', symbol: '渦', vertex: vortex });
await waitFor(() => unfoldMethods.variants.pick('cm-test-vortex').material !== unfoldMethods.variants.base);
tr.method = 'cm-test-vortex'; unfoldSeq.renderAt(t); const custom = grab();
({ diff: diff(builtIn, custom), tiles: document.querySelectorAll('#seq-methods button').length, added: document.querySelectorAll('#seq-methods button.added').length, tag: document.getElementById('seq-methods-tag').textContent, label: document.querySelector('#seq-phase').textContent.slice(0, 30) })
```
Expected: `diff` は `{ max: 0, mean: 0 }`（または最大でも 1 程度）、`tiles: 30`、`added: 1`、`tag: '30 METHODS'`。「◆ 1 → 2 テスト渦 / …」のラベルが出る。

- [ ] **Step 4: 標準のメソッドは変わっていない**

```js
const { grab, diff, t, tr } = window.__h;
tr.method = 'twist'; unfoldSeq.renderAt(t);
diff(window.__h.twistBefore, grab())
```
Expected: `{ max: 0, mean: 0 }`

- [ ] **Step 5: 壊れたコードは自動で止まり、「くしゃくしゃ」で代わりに表示される**

```js
const { grab, diff, waitFor, t, tr } = window.__h;
unfoldMethods.registerCustom({ id: 'cm-test-bad', name: '壊れ', symbol: '壊', vertex: 'vec3 userMethod(vec2 p, float amount) {\n  float k = 1.0;\n  return vec3(p, undefinedThing);\n}' });
tr.method = 'cm-test-bad'; unfoldSeq.renderAt(t);
await waitFor(() => unfoldMethods.listCustom().find(c => c.id === 'cm-test-bad').status === 'disabled');
const bad = unfoldMethods.listCustom().find(c => c.id === 'cm-test-bad');
unfoldSeq.renderAt(t); const fallback = grab();
tr.method = 'crumple'; unfoldSeq.renderAt(t); const crumple = grab();
({ status: bad.status, reason: bad.reason, sameAsCrumple: diff(fallback, crumple), tiles: document.querySelectorAll('#seq-methods button').length })
```
Expected: `status: 'disabled'`、`reason` に `3行目` と `undefinedThing` と `undeclared identifier` が入る、`sameAsCrumple` は `{ max: 0, mean: 0 }`、`tiles: 30`（壊れたものは一覧に出ない）。`read_console_messages`（`onlyErrors: true`）は空のまま。

- [ ] **Step 6: 2つの自作を同時に使う（自作→自作）**

```js
const { waitFor, t, tr } = window.__h;
const wave = `vec3 userMethod(vec2 p, float amount) { vec2 q = p; q.x += sin(p.y * 6. + uSeed) * amount * .6; q.y += sin(p.x * 5. + uSeed) * amount * .48; return vec3(q, 0.); }`;
unfoldMethods.registerCustom({ id: 'cm-test-wave', name: 'テスト波', symbol: '波', vertex: wave });
tr.method = 'cm-test-vortex'; tr.method2 = 'cm-test-wave';
unfoldSeq.renderAt(t);
await waitFor(() => unfoldMethods.variants.pick('cm-test-vortex', 'cm-test-wave').uMethod2 === 101);
const pair = unfoldMethods.variants.pick('cm-test-vortex', 'cm-test-wave');
({ uMethod: pair.uMethod, uMethod2: pair.uMethod2, count: unfoldMethods.variants.count() })
```
Expected: `{ uMethod: 100, uMethod2: 101, count: 2 }`（`cm-test-vortex` 単体と、2つの組み合わせ。組み合わせの準備中は「後ろだけ「くしゃくしゃ」」で表示するので、`cm-test-wave` の単体のシェーダーは作られない）。

- [ ] **Step 7: 名前がぶつかる組み合わせは、後ろが「くしゃくしゃ」になる**

```js
const { waitFor, t, tr } = window.__h;
const helper = n => `float shared(float x) { return x * ${n}.; }\nvec3 userMethod(vec2 p, float amount) { return vec3(p * (1. + shared(amount) * .1), 0.); }`;
unfoldMethods.registerCustom({ id: 'cm-test-h1', name: 'H1', symbol: '1', vertex: helper(1) });
unfoldMethods.registerCustom({ id: 'cm-test-h2', name: 'H2', symbol: '2', vertex: helper(2) });
tr.method = 'cm-test-h1'; tr.method2 = 'cm-test-h2';
for (let i = 0; i < 4; i++) { unfoldSeq.renderAt(t); await new Promise(r => setTimeout(r, 300)); }
const r = unfoldMethods.variants.pick('cm-test-h1', 'cm-test-h2');
({ uMethod: r.uMethod, uMethod2: r.uMethod2, h1: unfoldMethods.listCustom().find(c => c.id === 'cm-test-h1').status, h2: unfoldMethods.listCustom().find(c => c.id === 'cm-test-h2').status })
```
Expected: `{ uMethod: 100, uMethod2: 0, h1: 'ok', h2: 'ok' }`（2つの組み合わせだけが失敗して、どちらのメソッドも止められない）。

- [ ] **Step 8: 消すと、使っていた◆は「くしゃくしゃ」に戻る**

```js
const { t, tr } = window.__h;
tr.method2 = ''; tr.method = 'cm-test-vortex';
unfoldMethods.unregisterCustom('cm-test-vortex'); unfoldSeq.renderAt(t);
({ tiles: document.querySelectorAll('#seq-methods button').length, pickedNumber: unfoldMethods.variants.pick('cm-test-vortex').uMethod })
```
Expected: `tiles` は 1 つ減る（自作の残りは `cm-test-wave`・`cm-test-h1`・`cm-test-h2` の 3 つ → 29 + 3 = 32）、`pickedNumber: 0`。

- [ ] **Step 9: エラー行の変換が実機でも合う（`compileUserMethod`）**

```js
const M = await import('/motion.js?v=22'), C = await import('/custom-method.js'), T = await import('/vendor/three.module.min.js');
const renderer = new T.WebGLRenderer({ canvas: document.createElement('canvas') });
const run = source => C.compileUserMethod(renderer, { vertexShader: M.vertexShader, fragmentShader: M.fragmentShader, source });
({ good: await run('vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }'),
   undeclared: await run('// 1\nvec3 userMethod(vec2 p, float amount) {\n  float k = 1.0;\n  return vec3(p, undefinedThing);\n}'),
   syntax: await run('vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.) }'),
   clash: await run('float hash(vec2 p) { return 0.; }\nvec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }') })
```
Expected:
- `good: []`
- `undeclared`: `[{ slot: 'a', line: 4, message: "'undefinedThing' : undeclared identifier" }]`
- `syntax`: `line: 1` の `syntax error`
- `clash`: `message` が `'hash' : function already has a body`、`line` は 1

- [ ] **Step 10: 1枚モード**

`navigate` で `http://localhost:8771/index.html`。`read_console_messages`（`onlyErrors: true`）が空であること。続けて `javascript_tool`:

```js
const tiles = () => [...document.querySelectorAll('#methods button')];
const before = { n: tiles().length, tag: document.getElementById('methods-tag').textContent, first: tiles()[0].dataset.method, pressed: tiles().filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.method) };
unfoldMethods.registerCustom({ id: 'cm-one', name: 'ひとつ', symbol: 'ひ', vertex: 'vec3 userMethod(vec2 p, float amount) { return vec3(p * (1. - amount * .3), 0.); }' });
const t0 = performance.now(); while (unfoldMethods.variants.pick('cm-one').uMethod !== 100) { if (performance.now() - t0 > 5000) throw new Error('timeout'); await new Promise(r => setTimeout(r, 30)); }
tiles().find(b => b.dataset.method === 'cm-one').click();
unfold.setTime?.(.2);
const after = { n: tiles().length, tag: document.getElementById('methods-tag').textContent, added: tiles().filter(b => b.classList.contains('added')).length, pressed: tiles().filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.method), method: unfold.state.method, materialIsVariant: unfoldMethods.variants.pick('cm-one').material !== unfoldMethods.variants.base };
unfoldMethods.unregisterCustom('cm-one');
({ before, after, afterRemoval: { n: tiles().length, method: unfold.state.method, pressed: tiles().filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.method) } })
```
Expected: `before` は `{ n: 29, tag: '29 METHODS', first: 'crumple', pressed: ['crumple'] }`。`after` は `{ n: 30, tag: '30 METHODS', added: 1, pressed: ['cm-one'], method: 'cm-one', materialIsVariant: true }`。`afterRemoval` は `{ n: 29, method: 'crumple', pressed: ['crumple'] }`。
`computer {action: "screenshot"}` で、1枚モードの一覧（29個のタイルが生成されたもの）を目で確認する。

- [ ] **Step 11: 標準の29個が1ピクセルも変わっていない（変更前のアプリと比べる）**

変更前の `app/`（`archive/app-before-custom-engine-2026-10-02/`）も別ポート（8772）で配信して、**同じタブ**で（画面サイズが同じになる）両方を読み込み、同じ手順で絵のハッシュを取って比べる。
- 1枚モード（`index.html`）：29メソッド × `unfold.setTime(.2)`・`(.5)` で `#scene` の絵（FNV-1a ハッシュ）を取る。58個が全部一致すること。
- シーケンス（`sequence.html?empty`）：3枚入れて、29メソッド × ビート5・6・8・10 に、`shatter`→`melt` のミックス（ビート6.5）を足した 117点が全部一致すること。ビート8 は立体の球でメソッドに依存しない絵になるので、ビート5・6・10 が実質の比較点。
- 結果（2026-10-02）：1枚モード 58/58 一致（まとめ `c7129bc`）、シーケンス 117/117 一致（まとめ `400c08b2`）。

ブラウザペインが非表示だと、`addImageFromUrl`（画像のデコード）が止まって `javascript_tool` が45秒でタイムアウトする。その場合は、キャンバスを直接スライドにする `unfoldSeq.addSlide(canvas, name)` を使うと、デコードなしで入れられる。

- [ ] **Step 12: 片付ける**

`preview_stop`（`preview_start` で返った `serverId`）。`.claude/launch.json` から `unfold-serve` の設定を消して、元の1設定に戻す。

---

### Task 9: 仕上げ

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README に更新メモを足す**

old_string: `公開サイト: https://unfold-test.netlify.app/`
new_string:
```
- 自作メソッドの土台（ローカルのみ・未公開）：崩れ方の一覧を `app/method-registry.js` に統合。ブラウザのコンソールから `unfoldMethods.registerCustom({ id: 'cm-…', name, symbol, vertex })` で GLSL の自作メソッドを登録すると、1枚モードとシーケンスの一覧に水色の枠で出て使えます（エディタ・保存・見張りは次の計画）。仕組みは `app/custom-method.js`、簡易チェックは `app/method-guard.js`。変更前の `app/` は `archive/app-before-custom-engine-2026-10-02/`。設計書は `docs/superpowers/specs/2026-10-02-custom-methods-design.md`。
- 単体テスト: `node --test "tools/test/*.test.mjs"`

公開サイト: https://unfold-test.netlify.app/
```

- [ ] **Step 2: 差分が意図した範囲か確認する**

Run: `cd /Volumes/ORICO/UNFOLD && diff -rq archive/app-before-custom-engine-2026-10-02 app`
Expected（この順で、これだけ）:
```
Files archive/app-before-custom-engine-2026-10-02/app.js and app/app.js differ
Only in app: custom-method.js
Files archive/app-before-custom-engine-2026-10-02/effects.js and app/effects.js differ
Files archive/app-before-custom-engine-2026-10-02/index.html and app/index.html differ
Only in app: method-guard.js
Only in app: method-registry.js
Files archive/app-before-custom-engine-2026-10-02/motion.js and app/motion.js differ
Files archive/app-before-custom-engine-2026-10-02/sequence.html and app/sequence.html differ
Files archive/app-before-custom-engine-2026-10-02/sequence.js and app/sequence.js differ
Files archive/app-before-custom-engine-2026-10-02/style.css and app/style.css differ
```
`project.js`・`timeline.js`・`lyric-mv.js`・`look-view.js` は出ない。

- [ ] **Step 3: 全部の単体テストをもう一度通す**

Run: `cd /Volumes/ORICO/UNFOLD && node --test "tools/test/*.test.mjs" 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `ℹ fail 0`。

- [ ] **Step 4: 公開について**

ローカルを直しただけでは、Netlify の公開サイトは変わらない（手動デプロイ）。この計画の時点では、エディタ・保存・見張りがまだ無いので、**公開は計画③までは見送る**。

---

## 次の計画（この計画のあとで、実物に合わせて書く）

- **② ライブラリとエディタ**：`method-library.js`（IndexedDB）、「＋自作メソッド」タイル、`<dialog>` のエディタ（コード欄・プレビュー・チェック表示）、サンプル、AI に頼むひな形、下書き保存。この計画の `compileUserMethod`（エラー行つき）と `checkSource`（段1）を使う。
- **③ 安全とプロジェクト**：段2の試し描画（重さの比較）、段3の見張り、段5のクラッシュ印、`.unfold` への同梱と取り込み時の隔離、書き出し前に自作メソッドのコンパイル完了を待つ（`exportVideo` と `startExport` の最初）。
