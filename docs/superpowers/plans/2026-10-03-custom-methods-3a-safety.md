# 自作メソッド ③a 実行時の安全 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重すぎる・描画が止まる・ブラウザごと落ちる自作メソッドから、アプリと「次の起動」を守る。保存前の試し描画（重さの比較・何も映らない警告）、再生中の見張り、クラッシュ印と復帰、書き出し前のコンパイル待ち。

**Architecture:** 純粋な部品（`method-watchdog.js`・`method-crashflag.js`・`method-trial.js` の判定）を Node でテストし、それを `method-safety.js` がまとめる。画面側は、描画の直前・直後と再生ループから `safety` を呼ぶだけ。試し描画は専用の小さな WebGL（`createTrial`）で、標準の「一番重いメソッド」と同じ場で測って比べる。エディタの下書きも「落ちた」を覚えて、次に開いたときは自動でチェックを走らせない。

**Tech Stack:** バニラ JS（ES modules）、three.js r180、`localStorage`、テストは `node:test`、ブラウザ確認は Claude のブラウザペイン。

**設計書:** `docs/superpowers/specs/2026-10-02-custom-methods-design.md`（段2・段3・段5）／前の計画: ①エンジン、②エディタ（実行済み）

**この計画の外（計画③b）:** `.unfold` への同梱（version 2）と取り込み時の隔離（段4）。

**設計書からの小さな変更:** 試しメッシュは「本番の約1/16」ではなく、**粒を1タイルに1個にして約1/25**にする（`gridGeometry` の `sub` を 5→1。きりがよく、同じ形のまま小さくできるため）。しきい値（基準の4倍・見張りの50ms・試しの床 1ms／4ms）は初期値で、実測して調整する。

**実行して分かったこと・直したこと（2026-10-03。この計画書のコードは、下の点を直した最終版が `app/` にある）**
1. **計測の方法（Task 4・5）**：`gl.finish()` はブラウザの GPU を待ってくれず、1回ずつの描画はタイマーの細かさ（約0.1ms）より短くて、測った値が全部 0 になった。**1回描いて 1 ピクセルを `readPixels` する（これで待てる）→ まとめて何回か描いて割る**方式にした。さらに、重い自作コードだと測定だけで数秒かかってエディタが固まるので、先に1回の重さを見積もって **1サンプルが約8msになる回数**（最大100回、見積もりが200ms超なら測らず「重い」）にした。実行は 130〜460ms。
2. **基準のメソッド（Task 5）**：この GPU（フルサイズ、1回あたり）では、標準の29個は 0.05〜0.095ms で、ラウンドごとのばらつきの方が差より大きく、**どれが重いかは見分けられなかった**。一番重い側の `petals`（中央値 0.0945ms）を `baselineKey` にした。上限いっぱいのループの自作コード（256回）でも 0.6〜1.4ms。つまり**速い GPU では「基準の4倍」より床（フルサイズ 4ms）が実際の線**になり、遅い GPU ではどちらも効いて止まる。
3. **「何も変わらない」の判定（Task 4）**：標準シェーダーは崩れている間、奥行きの陰影で絵を少し暗くするので、「何もしないコード」でも始めの絵と比べると変わってしまう。**「何もしないメソッド」を同じ条件で描いた絵と比べる**（`judgeFrames` に `restMiddle` / `restEnd`）ようにした。
4. **クラッシュ印の消し方（Task 2・6）**：`pagehide`（普通にページを閉じる）が、**別のセッション（落ちたまま回収されていない印、別のタブの印）まで消していた**。印を消すのは、自分のセッションの印のときだけにした。また、止めたメソッドは、その場で印から外す（`release`）。
5. **コンパイル中のシェーダーを消さない（Task 3）**：起動時に保存済みを読み込んで、すぐ `recoverFromCrash` で「落ちた」にすると、コンパイル中のマテリアルを `dispose` して、three.js の待ちのタイマーが `reading 'isReady'` の例外を投げていた。コンパイル中のものは、**終わるまで `dispose` を待つ**（`prune` と `dispose()` の両方）。
6. **1枚モード**：`render()` は `wireControls()` より先に呼ばれるので、`safety` が無いときは `safety?.` で飛ばす。
7. **`createSafety` の既定のストレージ**：`localStorage` に触れるだけで例外になる環境があるので、`try` で包む。

**このプロジェクトは git リポジトリではない。** 作業前に `app/` をバックアップし（Task 0）、最後に差分を確認する（Task 10）。

**import の書き方（重要）:** 他のモジュールから読まれるファイルには `?v=` を付けない（ブラウザの中に2つのコピーができる）。`method-watchdog.js`・`method-crashflag.js`・`method-safety.js`・`method-trial.js` も同じ。

**確認用サーバー:** `preview_start` の Python は `/Volumes/ORICO` を読めない。`app/` と `tools/serve.py` をスクラッチパッドにコピーして配信する。ブラウザペインが非表示だと `addImageFromUrl` が止まるので `unfoldSeq.addSlide(canvas, name)` を使う。GPU を本当に固めるコードは、安全のため試さない（見張り・クラッシュ印は、偽のコマ時間や、手で書いた印で確かめる）。

---

## ファイル構成

| ファイル | 変更 | 役割 |
|---|---|---|
| `app/method-watchdog.js` | 新規 | コマ間隔の見張り（純粋） |
| `app/method-crashflag.js` | 新規 | クラッシュ印（`localStorage`。純粋＋注入できるストレージ） |
| `app/method-trial.js` | 新規 | 試し描画：判定（純粋）と、専用 WebGL での計測 |
| `app/method-safety.js` | 新規 | 上の部品をまとめる（描画の前後・再生ループ・コンテキスト喪失・起動時の復帰） |
| `app/custom-method.js` | 変更 | `pick` が `used`（使っている自作メソッドの id）を返す、`ready()` |
| `app/method-preview.js` | 変更 | `gridGeometry` を export、`sub` を引数に |
| `app/method-editor.js` / `method-editor.css` | 変更 | 試し描画の行、保存の条件、落ちた下書きの扱い |
| `app/sequence.js` / `app/app.js` | 変更 | `safety` と `trial` をつなぐ、書き出し前の待ち |
| `tools/test/watchdog.test.mjs` ほか | 新規 | 単体テスト |

---

### Task 0: バックアップ

- [ ] **Step 1: コピーして確認する**

```bash
cp -R /Volumes/ORICO/UNFOLD/app /Volumes/ORICO/UNFOLD/archive/app-before-custom-safety-2026-10-03 && diff -rq /Volumes/ORICO/UNFOLD/app /Volumes/ORICO/UNFOLD/archive/app-before-custom-safety-2026-10-03 && echo SAME
```
Expected: `SAME`

---

### Task 1: `method-watchdog.js`（見張り）— TDD

**Files:**
- Create: `tools/test/watchdog.test.mjs`
- Create: `app/method-watchdog.js`

- [ ] **Step 1: 失敗するテストを書く**

`/Volumes/ORICO/UNFOLD/tools/test/watchdog.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { WATCHDOG, createWatchdog } from '../../app/method-watchdog.js';

const feed = (dog, ms, count, custom) => { let verdict = null; for (let i = 0; i < count; i++) verdict = dog.frame(ms, custom) ?? verdict; return verdict; };

test('the limits are the ones in the design', () => {
  assert.equal(WATCHDOG.window, 30);
  assert.equal(WATCHDOG.factor, 4);
  assert.equal(WATCHDOG.floorMs, 50);
});

test('smooth frames with a custom method are fine', () => {
  const dog = createWatchdog();
  assert.equal(feed(dog, 17, 100, true), null);
});

test('30 slow frames with a custom method are a verdict (at the 30th, not before)', () => {
  const dog = createWatchdog();
  assert.equal(feed(dog, 120, 29, true), null);
  const verdict = dog.frame(120, true);
  assert.equal(verdict.median, 120);
  assert.ok(verdict.limit < 120);
});

test('slow but under the floor (50 ms) is fine, even when it is more than 4x the baseline', () => {
  const dog = createWatchdog();
  assert.equal(feed(dog, 45, 60, true), null);
});

test('the baseline comes from frames without custom methods: a slow screen is allowed to be slow', () => {
  const dog = createWatchdog();
  feed(dog, 40, 12, false);                       // a 25 fps screen: 4 x 40 = 160 ms is the limit
  assert.equal(feed(dog, 120, 40, true), null);
  assert.ok(feed(dog, 200, 30, true));
});

test('the median is used, so a few spikes do not count', () => {
  const dog = createWatchdog();
  for (let i = 0; i < 29; i++) assert.equal(dog.frame(i % 6 === 0 ? 300 : 20, true), null);
  assert.equal(dog.frame(20, true), null);
});

test('a hidden tab (a huge gap) or a nonsense value is ignored', () => {
  const dog = createWatchdog();
  assert.equal(feed(dog, 5000, 100, true), null);
  assert.equal(feed(dog, 0, 100, true), null);
  assert.equal(feed(dog, -3, 100, true), null);
  assert.equal(feed(dog, NaN, 100, true), null);
});

test('after a verdict it starts over (it does not repeat at the next frame)', () => {
  const dog = createWatchdog();
  assert.ok(feed(dog, 150, 30, true));
  assert.equal(dog.frame(150, true), null);
});

test('reset forgets everything', () => {
  const dog = createWatchdog();
  feed(dog, 150, 29, true);
  dog.reset();
  assert.equal(dog.frame(150, true), null);
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/watchdog.test.mjs 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|^ℹ (pass|fail)" | head -3`
Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: 実装を書く**

`/Volumes/ORICO/UNFOLD/app/method-watchdog.js`:

```js
// Watches the time between frames while custom methods are on screen, and says when they are too slow to keep.
export const WATCHDOG = { window: 30, factor: 4, floorMs: 50, nominalMs: 1000 / 60, maxGapMs: 1000 };

const median = values => {
  const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export function createWatchdog(options = {}) {
  const o = { ...WATCHDOG, ...options };
  const base = [], custom = [];
  const push = (list, value) => { list.push(value); if (list.length > o.window) list.shift(); };
  return {
    // deltaMs: time since the previous frame. isCustom: a custom method was drawn in this frame.
    // Returns null, or { median, baseline, limit } once the last 30 frames with custom methods are slower than the limit:
    // 4 x the usual frame time (without custom methods; 1/60 s when that is not known yet) and at least 50 ms.
    frame(deltaMs, isCustom) {
      if (!(deltaMs > 0) || deltaMs > o.maxGapMs) return null;      // a hidden tab or a pause is not slowness
      if (!isCustom) { push(base, deltaMs); return null; }
      push(custom, deltaMs);
      if (custom.length < o.window) return null;
      const baseline = base.length >= 10 ? Math.max(o.nominalMs, median(base)) : o.nominalMs;
      const limit = Math.max(o.floorMs, o.factor * baseline), typical = median(custom);
      if (typical <= limit) return null;
      custom.length = 0;
      return { median: typical, baseline, limit };
    },
    reset() { base.length = 0; custom.length = 0; },
  };
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/watchdog.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)|✖"`
Expected: `ℹ tests 9`、`ℹ pass 9`、`ℹ fail 0`

---

### Task 2: `method-crashflag.js`（クラッシュ印）— TDD

**Files:**
- Create: `tools/test/crashflag.test.mjs`
- Create: `app/method-crashflag.js`

- [ ] **Step 1: 失敗するテストを書く**

`/Volumes/ORICO/UNFOLD/tools/test/crashflag.test.mjs`:

```js
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
```

- [ ] **Step 2: 失敗を確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/crashflag.test.mjs 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|^ℹ (pass|fail)" | head -3`
Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: 実装を書く**

`/Volumes/ORICO/UNFOLD/app/method-crashflag.js`:

```js
// A mark in localStorage that says "a custom method is being tried". It is written before the method is first drawn and wiped again once the
// method has survived some frames — or when the page is closed normally. If the mark is still there at the next start, the browser went down
// while the method was on screen (a frozen GPU gives no chance to run any code), and that method must not be used again unless the user says so.
export const FLAG_KEY = 'unfold-method-trial';

export function createCrashFlag({ storage, session = Math.random().toString(36).slice(2), now = Date.now, framesToConfirm = 30 }) {
  const armed = new Map();        // id -> frames drawn since it was armed
  const confirmed = new Set();    // ids that survived in this session: never marked again
  const write = () => {
    try {
      if (armed.size) storage.setItem(FLAG_KEY, JSON.stringify({ session, at: now(), ids: [...armed.keys()] }));
      else storage.removeItem(FLAG_KEY);
    } catch { /* storage unavailable: no mark */ }
  };
  return {
    session,
    // call before a frame with these custom methods is drawn
    arm(ids) {
      let changed = false;
      for (const id of ids) if (!armed.has(id) && !confirmed.has(id)) { armed.set(id, 0); changed = true; }
      if (changed) write();
    },
    // call after a frame was drawn
    frame() {
      if (!armed.size) return;
      let changed = false;
      for (const [id, count] of armed) {
        if (count + 1 >= framesToConfirm) { armed.delete(id); confirmed.add(id); changed = true; }
        else armed.set(id, count + 1);
      }
      if (changed) write();
    },
    // take ids off the mark without saying they proved themselves (they can be marked again)
    release(ids) {
      let changed = false;
      for (const id of ids) changed = armed.delete(id) || changed;
      if (changed) write();
    },
    clear() { armed.clear(); write(); },
    // the ids a previous session left marked (the mark is wiped); the mark of this very session is not "left behind"
    recover() {
      let raw = null;
      try { raw = storage.getItem(FLAG_KEY); } catch { return []; }
      if (raw === null) return [];
      let left = null;
      try { left = JSON.parse(raw); } catch { /* a broken mark */ }
      if (left?.session === session) return [];
      try { storage.removeItem(FLAG_KEY); } catch { /* nothing to wipe */ }
      return Array.isArray(left?.ids) ? left.ids.filter(id => typeof id === 'string') : [];
    },
  };
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/crashflag.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)|✖"`
Expected: `ℹ tests 9`、`ℹ pass 9`、`ℹ fail 0`

---

### Task 3: `custom-method.js` — `pick` が `used` を返す、`ready()` — TDD

**Files:**
- Modify: `tools/test/variants.test.mjs`、`app/custom-method.js`

- [ ] **Step 1: テストを足す（先に失敗させる）**

`tools/test/variants.test.mjs` の、`test('after dispose the registry can change without errors'` の前に足す:

```js
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
```

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/variants.test.mjs 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ fail 3`

- [ ] **Step 2: 実装する**

`app/custom-method.js` の `pick` の戻り値と `ready()`:

1. `if (!ids.length) return { material: base, uMethod: BUILTIN_IDS[a], uMethod2: b ? BUILTIN_IDS[b] : 0 };`
   → `if (!ids.length) return { material: base, uMethod: BUILTIN_IDS[a], uMethod2: b ? BUILTIN_IDS[b] : 0, used: [] };`
2. `return { material: v.material, uMethod: isCustomKey(a) ? number(a) : BUILTIN_IDS[a], uMethod2: !b ? 0 : isCustomKey(b) ? number(b) : BUILTIN_IDS[b] };`
   → `return { material: v.material, uMethod: isCustomKey(a) ? number(a) : BUILTIN_IDS[a], uMethod2: !b ? 0 : isCustomKey(b) ? number(b) : BUILTIN_IDS[b], used: [...ids] };`
3. 返すオブジェクトに `ready` を足す。old: `    base, pick,\n    count: () => variants.size,` → new:
   ```js
       base, pick,
       count: () => variants.size,
       // resolves once no shader is compiling any more (a failed one counts as finished); used before exporting a video
       ready: () => new Promise(resolve => {
         const check = () => ([...variants.values()].some(v => v.state === 'pending') ? setTimeout(check, 20) : resolve());
         check();
       }),
   ```
   また、`pick` の関数コメント（`// pick(keyA, keyB) -> { material, uMethod, uMethod2 }…`）を `{ material, uMethod, uMethod2, used }` に直す。

- [ ] **Step 3: 通ることを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test "tools/test/*.test.mjs" 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `ℹ fail 0`

---

### Task 4: `method-trial.js`（試し描画）— 判定は TDD、計測はブラウザ

**Files:**
- Create: `tools/test/trial.test.mjs`
- Create: `app/method-trial.js`
- Modify: `app/method-preview.js`

- [ ] **Step 1: 判定の失敗するテストを書く**

`/Volumes/ORICO/UNFOLD/tools/test/trial.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { TRIAL, median, judgeTrial, judgeFrames } from '../../app/method-trial.js';

test('the limits are the ones in the design', () => {
  assert.equal(TRIAL.factor, 4);
  assert.deepEqual(TRIAL.progresses, [0, .25, .5, .75, 1]);
  assert.equal(TRIAL.runs, 3);
});

test('median', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([7]), 7);
});

test('too heavy means more than 4x the baseline AND above the floor', () => {
  assert.deepEqual(judgeTrial({ customMs: 5, baselineMs: 1, floorMs: 1 }), { ratio: 5, heavy: true });
  assert.equal(judgeTrial({ customMs: 4, baselineMs: 1, floorMs: 1 }).heavy, false, 'exactly 4x is allowed');
  assert.equal(judgeTrial({ customMs: .8, baselineMs: .1, floorMs: 1 }).heavy, false, 'tiny numbers are noise: under the floor');
  assert.equal(judgeTrial({ customMs: 9, baselineMs: 1, floorMs: 1, factor: 10 }).heavy, false, 'the factor can be changed');
});

test('a baseline too small to measure still gives an answer', () => {
  const r = judgeTrial({ customMs: 3, baselineMs: 0, floorMs: 1 });
  assert.equal(r.heavy, true);
  assert.equal(r.ratio, null);
  assert.equal(judgeTrial({ customMs: .5, baselineMs: 0, floorMs: 1 }).heavy, false);
});

const frame = (fill, size = 12) => Uint8Array.from({ length: size * 4 }, (_, i) => (i % 4 === 3 ? 255 : fill));

test('blank: the picture is gone halfway through', () => {
  const rest = frame(10), nothing = frame(10);
  assert.deepEqual(judgeFrames({ start: rest, middle: nothing, end: nothing }), { blank: true, unchanged: true });
});

test('unchanged: the picture never moves', () => {
  const picture = Uint8Array.from({ length: 48 }, (_, i) => (i % 4 === 3 ? 255 : (i * 7) % 200 + 20));
  assert.deepEqual(judgeFrames({ start: picture, middle: picture, end: picture }), { blank: false, unchanged: true });
});

test('a method that changes the picture is neither', () => {
  const a = Uint8Array.from({ length: 48 }, (_, i) => (i % 4 === 3 ? 255 : (i * 7) % 200 + 20));
  const b = Uint8Array.from({ length: 48 }, (_, i) => (i % 4 === 3 ? 255 : (i * 11) % 200 + 20));
  assert.deepEqual(judgeFrames({ start: a, middle: b, end: a }), { blank: false, unchanged: false });
});

test('changing only at the end still counts as changing', () => {
  const a = Uint8Array.from({ length: 48 }, (_, i) => (i % 4 === 3 ? 255 : (i * 7) % 200 + 20));
  const b = Uint8Array.from({ length: 48 }, (_, i) => (i % 4 === 3 ? 255 : (i * 11) % 200 + 20));
  assert.equal(judgeFrames({ start: a, middle: a, end: b }).unchanged, false);
});
```

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/trial.test.mjs 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|^ℹ (pass|fail)" | head -3`
Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 2: `method-preview.js` の `gridGeometry` を export して、粒の数を引数にする**

1. old: `function gridGeometry(w, h) {\n  const count = TILES * TILES * SUB * SUB * 6;`
   new: `export function gridGeometry(w, h, sub = SUB) {\n  const count = TILES * TILES * sub * sub * 6;`
2. old: `  const step = 1 / (TILES * SUB);`
   new: `  const step = 1 / (TILES * sub);`
3. old: `for (let sy = 0; sy < SUB; sy++) for (let sx = 0; sx < SUB; sx++) {\n    const u = (cx + sx / SUB) / TILES, v = (cy + sy / SUB) / TILES;`
   new: `for (let sy = 0; sy < sub; sy++) for (let sx = 0; sx < sub; sx++) {\n    const u = (cx + sx / sub) / TILES, v = (cy + sy / sub) / TILES;`

- [ ] **Step 3: `method-trial.js` を書く**

`/Volumes/ORICO/UNFOLD/app/method-trial.js`:

```js
// The trial render: before a custom method is saved (or switched on), draw it on a small canvas and see two things —
// whether it is too heavy (compared with the heaviest built-in method, measured on the same GPU at the same time),
// and whether it shows anything at all. It is the second gatekeeper after the compile; the first is the text check.
import * as THREE from './vendor/three.module.min.js';
import { assembleVertex, compileCheck } from './custom-method.js';
import { BUILTIN_IDS } from './method-registry.js';
import { gridGeometry, makeTestImage } from './method-preview.js';

// factor: how many times heavier than the baseline is still fine. floors: below these numbers the timer is only noise.
// baselineKey: the heaviest built-in method (chosen by measuring all 29, see the plan).
export const TRIAL = { factor: 4, smallFloorMs: 1, fullFloorMs: 4, baselineKey: 'galaxy', progresses: [0, .25, .5, .75, 1], runs: 3, smallSub: 1, fullSub: 5, width: 160, height: 90 };

export const median = values => {
  const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// heavy: more than `factor` times the baseline and above the floor. ratio is null when the baseline was too small to measure.
export function judgeTrial({ customMs, baselineMs, floorMs, factor = TRIAL.factor }) {
  return { ratio: baselineMs > 0 ? customMs / baselineMs : null, heavy: customMs > Math.max(floorMs, factor * baselineMs) };
}

const sameFrame = (a, b, tolerance = 0.5) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length <= tolerance;
};
// start / middle / end: pixels (RGBA) at the start, halfway and at the end of the breaking up.
// blank: nothing but the background is left halfway. unchanged: the picture looks the same all the way through.
export function judgeFrames({ start, middle, end }) {
  const background = [start[0], start[1], start[2]];
  let blank = true;
  for (let i = 0; i < middle.length && blank; i += 4) blank = Math.abs(middle[i] - background[0]) <= 2 && Math.abs(middle[i + 1] - background[1]) <= 2 && Math.abs(middle[i + 2] - background[2]) <= 2;
  return { blank, unchanged: sameFrame(start, middle) && sameFrame(start, end) };
}

export function createTrial({ vertexShader, fragmentShader }) {
  let rig = null;
  const baselines = {};            // 'small' | 'full' -> ms, measured once per page

  function build() {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(TRIAL.width, TRIAL.height, false);
    renderer.setClearColor('#111718', 1);
    const aspect = TRIAL.width / TRIAL.height, h = Math.min(3.65, 5.25 / aspect), w = h * aspect, view = Math.max(5.4, 6.8 / aspect);
    const camera = new THREE.OrthographicCamera(-view * aspect / 2, view * aspect / 2, view / 2, -view / 2, .1, 100);
    camera.position.z = 10;
    const texture = new THREE.CanvasTexture(makeTestImage(320, 180));
    texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false; texture.colorSpace = THREE.SRGBColorSpace;
    const uniforms = {
      uImage: { value: texture }, uSize: { value: new THREE.Vector2(w, h) }, uDistort: { value: 0 }, uForm: { value: 0 }, uStrength: { value: .75 },
      uDepth: { value: 1 }, uSeed: { value: 28 }, uMethod: { value: 0 }, uMethod2: { value: 0 }, uMethodMix: { value: 0 }, uProject: { value: 0 },
      uTime: { value: 1.5 }, uDraw: { value: 1 }, uThrough: { value: 0 }, uFade: { value: 1 }, uGlass: { value: 0 }, uShape: { value: 0 }, uPreset: { value: 0 }, uConceal: { value: 0 },
    };
    const material = source => new THREE.ShaderMaterial({ uniforms, vertexShader: source, fragmentShader, side: THREE.DoubleSide, transparent: true });
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(gridGeometry(w, h, TRIAL.smallSub), material(vertexShader));
    mesh.frustumCulled = false;
    scene.add(mesh);
    return {
      renderer, scene, camera, uniforms, mesh, w, h, gl: renderer.getContext(), material,
      geometry: { small: mesh.geometry, full: gridGeometry(w, h, TRIAL.fullSub) },
      base: mesh.material,
    };
  }

  // median time of a few renders at every step of the breaking up (the GPU is waited for with finish())
  function time(material, geometry, uMethod) {
    const { renderer, scene, camera, uniforms, mesh, gl } = rig;
    mesh.material = material; mesh.geometry = geometry; uniforms.uMethod.value = uMethod;
    uniforms.uDistort.value = .5; renderer.render(scene, camera); gl.finish();          // the first render uploads everything
    const times = [];
    for (const p of TRIAL.progresses) {
      uniforms.uDistort.value = p;
      for (let i = 0; i < TRIAL.runs; i++) { const t0 = performance.now(); renderer.render(scene, camera); gl.finish(); times.push(performance.now() - t0); }
    }
    return median(times);
  }
  function pixels(material, geometry, uMethod, progress) {
    const { renderer, scene, camera, uniforms, mesh, gl } = rig;
    mesh.material = material; mesh.geometry = geometry; uniforms.uMethod.value = uMethod; uniforms.uDistort.value = progress;
    renderer.render(scene, camera);
    const out = new Uint8Array(TRIAL.width * TRIAL.height * 4);
    gl.readPixels(0, 0, TRIAL.width, TRIAL.height, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return out;
  }
  const baseline = size => (baselines[size] ??= time(rig.base, rig.geometry[size], BUILTIN_IDS[TRIAL.baselineKey]));

  return {
    // Resolves to { stage, heavy, ratio, customMs, baselineMs, blank, unchanged }; the options are for tests.
    async run(source, { factor = TRIAL.factor, smallFloorMs = TRIAL.smallFloorMs, fullFloorMs = TRIAL.fullFloorMs } = {}) {
      rig ??= build();
      const material = rig.material(assembleVertex(vertexShader, { a: source }).source);
      try {
        const diagnostics = await compileCheck(rig.renderer, material);
        if (diagnostics) throw new Error('コンパイルできませんでした');
        const small = judgeTrial({ customMs: time(material, rig.geometry.small, 100), baselineMs: baseline('small'), floorMs: smallFloorMs, factor });
        const smallResult = { stage: 'small', customMs: small.customMs, baselineMs: baselines.small, ratio: small.ratio, heavy: small.heavy };
        if (small.heavy) return { ...smallResult, blank: false, unchanged: false };
        const customMs = time(material, rig.geometry.full, 100);
        const full = judgeTrial({ customMs, baselineMs: baseline('full'), floorMs: fullFloorMs, factor });
        const look = judgeFrames({
          start: pixels(material, rig.geometry.full, 100, 0), middle: pixels(material, rig.geometry.full, 100, .5), end: pixels(material, rig.geometry.full, 100, 1),
        });
        return { stage: 'full', customMs, baselineMs: baselines.full, ratio: full.ratio, heavy: full.heavy, ...look };
      } finally {
        material.dispose();
      }
    },
    // how long every built-in method takes on the small and the full mesh (to choose the baseline); returns { key: { small, full } }
    measureBuiltins() {
      rig ??= build();
      const out = {};
      for (const [key, id] of Object.entries(BUILTIN_IDS)) out[key] = { small: time(rig.base, rig.geometry.small, id), full: time(rig.base, rig.geometry.full, id) };
      return out;
    },
  };
}
```

`run` の中で `small.customMs` を参照しているが、`judgeTrial` は `customMs` を返さない。次のように直す（`customMs` は別に持つ）:

```js
        const smallMs = time(material, rig.geometry.small, 100);
        const small = judgeTrial({ customMs: smallMs, baselineMs: baseline('small'), floorMs: smallFloorMs, factor });
        const smallResult = { stage: 'small', customMs: smallMs, baselineMs: baselines.small, ratio: small.ratio, heavy: small.heavy };
```

- [ ] **Step 4: 判定のテストが通ることを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/trial.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)|✖"`
Expected: `ℹ tests 8`、`ℹ pass 8`、`ℹ fail 0`

Run: `cd /Volumes/ORICO/UNFOLD/app && node --check method-trial.js && echo SYNTAX_OK`
Expected: `SYNTAX_OK`

---

### Task 5: 標準の29個を測って、基準にする一番重いメソッドを決める（ブラウザ）

**Files:**
- Modify: `app/method-trial.js`（`TRIAL.baselineKey`）

- [ ] **Step 1: 確認用サーバーを起動して、シーケンスを開く**

```bash
S=/private/tmp/claude-501/-Volumes-ORICO-UNFOLD/e8107f15-5f2a-459b-a83e-4e6edb1a6f69/scratchpad/unfold-preview
rm -rf "$S/app" && mkdir -p "$S/tools" && cp -R /Volumes/ORICO/UNFOLD/app "$S/app" && cp /Volumes/ORICO/UNFOLD/tools/serve.py "$S/tools/serve.py" && diff -rq /Volumes/ORICO/UNFOLD/app "$S/app" && echo COPY_SAME
```
`.claude/launch.json`（先に読み直す）に `{ "name": "unfold-serve", "runtimeExecutable": "python3", "runtimeArgs": ["<$S>/tools/serve.py"], "port": 8771 }` を足して `preview_start`。`navigate` で `http://localhost:8771/sequence.html?empty`。

- [ ] **Step 2: 29個を測る**

```js
const M = await import('/motion.js?v=22'), T = await import('/method-trial.js');
const trial = T.createTrial({ vertexShader: M.vertexShader, fragmentShader: M.fragmentShader });
const rounds = [];
for (let i = 0; i < 3; i++) rounds.push(trial.measureBuiltins());           // 3 rounds, to see how steady the numbers are
const keys = Object.keys(rounds[0]);
const table = keys.map(k => ({ k, small: +T.median(rounds.map(r => r[k].small)).toFixed(3), full: +T.median(rounds.map(r => r[k].full)).toFixed(3) }));
window.__table = table;
({ heaviestFull: [...table].sort((a, b) => b.full - a.full).slice(0, 5), heaviestSmall: [...table].sort((a, b) => b.small - a.small).slice(0, 5), lightest: [...table].sort((a, b) => a.full - b.full).slice(0, 3) })
```
Expected: 一番重いものが、はっきり分かる（上位5つが見える）。

- [ ] **Step 3: 一番重いものを基準にする**

`heaviestFull` の先頭のキーを、`app/method-trial.js` の `baselineKey` に書く（今の初期値は `'galaxy'`）。
- もし上位2つの差が小さいときは、`small` でも上位のもの（両方の段で重いもの）を選ぶ。
- 数字は GPU によって違うので、結果を計画書の「結果」欄に書き残す。

結果（2026-10-03、この GPU）：一番重い側は `petals`（中央値 約0.0945ms）。上の「実行して分かったこと」の 2 を参照。

---

### Task 6: `method-safety.js`（まとめ役）— TDD

**Files:**
- Create: `tools/test/safety.test.mjs`
- Create: `app/method-safety.js`

- [ ] **Step 1: 失敗するテストを書く**

`/Volumes/ORICO/UNFOLD/tools/test/safety.test.mjs`:

```js
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

test('slow frames without a custom method on screen are nobody\'s fault', () => {
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
  assert.deepEqual(result, { methods: ['cm-a'], draft: false });
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
  assert.deepEqual(safety.recoverFromCrash(), { methods: [], draft: false });
  assert.deepEqual(notices, []);
});

test('a marked editor draft is kept but remembered as "crashed"', () => {
  reset();
  const storage = memory();
  storage.setItem(DRAFT_KEY, JSON.stringify({ id: null, name: 'x', symbol: 'x', source: 'code' }));
  const old = make(storage, 'OLD');
  old.safety.armDraft();
  const { safety, notices } = make(storage, 'NEW');
  assert.deepEqual(safety.recoverFromCrash(), { methods: [], draft: true });
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

test('closing the page normally wipes the mark', () => {
  withMethods('cm-a');
  const { safety, storage } = make();
  safety.beforeDraw(['cm-a']);
  safety.pageHide();
  assert.equal(storage.getItem(FLAG_KEY), null);
  reset();
});
```

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/safety.test.mjs 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|^ℹ (pass|fail)" | head -3`
Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 2: 実装を書く**

`/Volumes/ORICO/UNFOLD/app/method-safety.js`:

```js
// The safety net for custom methods while they run: the mark that survives a browser crash, the watch on frame times, and what to do when
// the GPU context is lost. The pages call it right before / after a frame is drawn, once per animation frame, and once at start.
import { getCustom, setCustomStatus } from './method-registry.js';
import { createCrashFlag } from './method-crashflag.js';
import { createWatchdog } from './method-watchdog.js';

export const DRAFT_KEY = 'unfold-method-draft';       // the editor keeps the code being written here
export const DRAFT_ID = 'draft';                      // the editor draft is marked like a method while it is tried

function markDraftCrashed(storage) {
  try {
    const draft = JSON.parse(storage.getItem(DRAFT_KEY));
    if (draft) storage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, crashed: true }));
  } catch { /* no draft, or no storage */ }
}

export function createSafety({ storage = globalThis.localStorage, notify = () => {}, crashFlag = createCrashFlag({ storage }), watchdog = createWatchdog() } = {}) {
  let lastUsed = [];
  // switch off the ones that are still in use (the others already are something else); returns the ids that were switched off
  const stop = (ids, status, reason) => {
    const hit = ids.filter(id => getCustom(id)?.status === 'ok');
    for (const id of hit) setCustomStatus(id, status, reason);
    return hit;
  };
  const names = ids => ids.map(id => `「${getCustom(id)?.name ?? id}」`).join('');
  return {
    crashFlag, watchdog,
    get lastUsed() { return lastUsed; },
    // right before a frame is drawn: `used` = the custom methods in it (from variants.pick). Leaves the mark.
    beforeDraw(used) { lastUsed = used; if (used.length) crashFlag.arm(used); },
    afterDraw() { if (lastUsed.length) crashFlag.frame(); },
    // once per animation frame while playing: the time since the last frame
    tick(deltaMs) {
      const verdict = watchdog.frame(deltaMs, lastUsed.length > 0);
      if (!verdict) return null;
      const hit = stop(lastUsed, 'disabled', `重すぎるので止めました（1コマ約${Math.round(verdict.median)}ミリ秒）`);
      if (hit.length) notify(`${names(hit)}が重すぎたので止めました。タイルの⚙から、もう一度試せます。`);
      return verdict;
    },
    contextLost() {
      const hit = stop(lastUsed, 'crashed', '描画が止まった（GPUが落ちた）ので、使うのをやめました');
      if (hit.length) notify(`描画が止まったので、${names(hit)}を止めました。`);
      return hit;
    },
    // at start, after the saved methods are loaded: whatever was marked when the last session ended did not end well
    recoverFromCrash() {
      const marked = crashFlag.recover();
      const methods = stop(marked.filter(id => id !== DRAFT_ID), 'crashed', '前回このメソッドを使っていて、ブラウザが落ちたみたい');
      const draft = marked.includes(DRAFT_ID);
      if (draft) markDraftCrashed(storage);
      if (methods.length) notify(`前回、${names(methods)}を使っていてブラウザが落ちたみたい。止めてあるよ（⚙から、もう一度試せます）。`);
      else if (draft) notify('前回、エディタで試したコードでブラウザが落ちたみたい。下書きは残してあるよ。');
      return { methods, draft };
    },
    armDraft() { crashFlag.arm([DRAFT_ID]); },
    disarmDraft() { crashFlag.release([DRAFT_ID]); },
    pageHide() { crashFlag.clear(); },
  };
}
```

- [ ] **Step 3: 通ることを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test "tools/test/*.test.mjs" 2>&1 | grep -E "^ℹ (tests|pass|fail)|✖"`
Expected: `ℹ fail 0`（最終的に 125 本）

---

### Task 7: エディタに試し描画と「落ちた下書き」を組み込む

**Files:**
- Modify: `app/method-editor.js`、`app/method-editor.css`

- [ ] **Step 1: import とオプション**

1. old: `import { createPreview, makeTestImage } from './method-preview.js';`
   new: `import { createPreview, makeTestImage } from './method-preview.js';\nimport { TRIAL } from './method-trial.js';\nimport { DRAFT_KEY } from './method-safety.js';`
2. old: `const DRAFT_KEY = 'unfold-method-draft';\n`（定数の定義。`method-safety.js` から読むので消す）
   new: （空）
3. old: `export function createMethodEditor({ vertexShader, fragmentShader, getPreviewImage = () => null, notify = () => {}, onSaved = () => {} }) {`
   new: `export function createMethodEditor({ vertexShader, fragmentShader, getPreviewImage = () => null, notify = () => {}, onSaved = () => {}, trial = null, safety = null }) {`
4. old: `const MARKS = { ok: '✓', ng: '✗', wait: '…', skip: '–' };`
   new: `const MARKS = { ok: '✓', ng: '✗', wait: '…', skip: '–', warn: '!' };`
5. old: `  const results = { guard: null, compile: null, compiling: false };`
   new:
   ```js
     const results = { guard: null, compile: null, compiling: false, trial: null, trialing: false };
     let armed = 0, crashedDraft = false;
     // the draft is marked while it is compiled and tried; two checks can overlap, so count
     const arm = () => { if (armed++ === 0) safety?.armDraft(); };
     const disarm = () => { if (--armed === 0) safety?.disarmDraft(); };
   ```

- [ ] **Step 2: 画面に「試し描画」の行と「チェックする」ボタンを足す**

1. old: `    const compileRow = el('div', { id: 'method-compile', className: 'md-check' });`
   new: `    const compileRow = el('div', { id: 'method-compile', className: 'md-check' });\n    const trialRow = el('div', { id: 'method-trial', className: 'md-check' });\n    const recheck = el('button', { type: 'button', id: 'method-recheck', className: 'md-recheck', textContent: 'チェックする', hidden: true });`
2. old: `    const checks = el('div', { className: 'md-checks' }, guardRow, compileRow);`
   new: `    const checks = el('div', { className: 'md-checks' }, guardRow, compileRow, trialRow, recheck);`
3. old: `    return { dialog, name, symbol, samples, ai, gutter, code, guardRow, compileRow, errors, canvas, progress, loop, save };`
   new: `    recheck.addEventListener('click', () => { crashedDraft = false; recheck.hidden = true; runChecks(); });\n    return { dialog, name, symbol, samples, ai, gutter, code, guardRow, compileRow, trialRow, recheck, errors, canvas, progress, loop, save };`

- [ ] **Step 3: 保存の条件と表示**

1. `updateSave` を置き換える。
   old: `    ui.save.disabled = !(results.guard?.ok && results.compile && results.compile.length === 0 && !results.compiling);`
   new: `    const tried = !trial || (results.trial && !results.trial.heavy && !results.trial.failed && !results.trialing);\n    ui.save.disabled = !(results.guard?.ok && results.compile && results.compile.length === 0 && !results.compiling && tried);`
2. `show` の中、コンパイルの行（`setRow(ui.compileRow, …)`）のすぐ後ろに足す。
   old: `    setRow(ui.compileRow, 'コンパイル（GPU）', !guard?.ok ? 'skip' : compiling || !compile ? 'wait' : compile.length ? 'ng' : 'ok');`
   new:
   ```js
       setRow(ui.compileRow, 'コンパイル（GPU）', !guard?.ok ? 'skip' : compiling || !compile ? 'wait' : compile.length ? 'ng' : 'ok');
       ui.trialRow.hidden = !trial;
       if (trial) { const [state, text] = trialSummary(); setRow(ui.trialRow, text, state); }
   ```
3. `show` の前に、`trialSummary` を足す（`function show() {` の直前）。
   ```js
     // [state, text] for the trial-render row
     function trialSummary() {
       const { guard, compile, trial: t, trialing } = results;
       if (!guard?.ok || !compile || compile.length) return ['skip', '試し描画（重さ・映り方）'];
       if (trialing || !t) return ['wait', '試し描画（重さ・映り方）'];
       const times = t.ratio == null ? '' : `標準の重いメソッドの約${t.ratio.toFixed(1)}倍`;
       if (t.failed) return ['ng', `試し描画に失敗しました（${t.failed}）`];
       if (t.heavy) return ['ng', `重すぎます（${times || '標準の重いメソッドよりずっと重い'}。${TRIAL.factor}倍まで）`];
       if (t.blank) return ['warn', '何も映っていません（保存はできます）'];
       if (t.unchanged) return ['warn', '元の絵と変わっていません（保存はできます）'];
       return ['ok', `試し描画（重さ ${times || 'ごく軽い'}）`];
     }
   ```
4. `onEdit` の先頭で、「落ちた下書き」の状態を解く。
   old: `  function onEdit() {\n    results.guard = null; results.compile = null; results.compiling = false;`
   new: `  function onEdit() {\n    crashedDraft = false; ui.recheck.hidden = true;\n    results.guard = null; results.compile = null; results.compiling = false; results.trial = null; results.trialing = false;`

- [ ] **Step 4: `runChecks` に、印と試し描画を組み込む**

`runChecks` を、次の内容に置き換える（`async function runChecks() {` から、その閉じ `}` まで）:

```js
  async function runChecks() {
    if (!preview || !ui.dialog.open) return;
    const mine = ++token, source = ui.code.value;
    const guard = checkSource(source);
    results.guard = guard; results.compile = null; results.compiling = false; results.trial = null; results.trialing = false;
    if (!guard.ok) { show(); return; }
    writeDraft({ id: current.id, name: ui.name.value, symbol: ui.symbol.value, source });
    arm();
    results.compiling = true; show();
    let errors;
    try { errors = await compileUserMethod(preview.renderer, { vertexShader, fragmentShader, source }); }
    catch (error) { errors = [{ slot: null, line: null, message: String(error?.message || error) }]; }
    if (mine !== token || !ui.dialog.open) { disarm(); return; }       // typed again meanwhile, or the editor was closed
    results.compiling = false; results.compile = errors;
    if (errors.length) { disarm(); show(); return; }
    preview.setSource(source);
    if (!trial) { disarm(); show(); return; }
    results.trialing = true; show();
    let outcome;
    try { outcome = await trial.run(source); }
    catch (error) { outcome = { failed: String(error?.message || error) }; }
    disarm();
    if (mine !== token || !ui.dialog.open) return;
    results.trialing = false; results.trial = outcome;
    show();
  }
```

- [ ] **Step 5: 落ちた下書きは、自動でチェックしない**

`open` の中:
1. old: `    if (draft && (draft.id ?? null) === (id ?? null)) { start = draft; notify('前回の下書きを復元したよ。'); }`
   new: `    crashedDraft = false;\n    if (draft && (draft.id ?? null) === (id ?? null)) { start = draft; crashedDraft = !!draft.crashed; if (!crashedDraft) notify('前回の下書きを復元したよ。'); }`
2. old: `    results.guard = null; results.compile = null; results.compiling = false;\n    ui.dialog.showModal();`
   new: `    results.guard = null; results.compile = null; results.compiling = false; results.trial = null; results.trialing = false;\n    ui.recheck.hidden = !crashedDraft;\n    ui.dialog.showModal();`
3. open の最後の `show();\n    runChecks();` を置き換える。
   old: `    show();\n    runChecks();\n  }`
   new:
   ```js
       show();
       if (crashedDraft) notify('前回このコードを試したときに、ブラウザが落ちたかもしれません。内容を見直してから「チェックする」を押してね。');
       else runChecks();
     }
   ```

- [ ] **Step 6: CSS**

`method-editor.css` に足す:

```css
.md-check.warn { color: var(--m-ink); } .md-check.warn .mark { color: #ffb347; }
.md-recheck { align-self: flex-start; margin-top: 4px; padding: 5px 12px; border-radius: 6px; border: 1px solid var(--m-warn); background: transparent; color: var(--m-warn); font: inherit; cursor: pointer; }
.md-recheck[hidden] { display: none; }
```

- [ ] **Step 7: 構文を確認する**

Run: `cd /Volumes/ORICO/UNFOLD/app && S=/private/tmp/claude-501/-Volumes-ORICO-UNFOLD/e8107f15-5f2a-459b-a83e-4e6edb1a6f69/scratchpad && cp method-editor.js "$S/method-editor-check.mjs" && node --check "$S/method-editor-check.mjs" && echo SYNTAX_OK; grep -c "DRAFT_KEY" method-editor.js`
Expected: `SYNTAX_OK`、`DRAFT_KEY` の数は 3 前後（import と使用箇所）。

---

### Task 8: `sequence.js` と `app.js` に、見張り・印・書き出し前の待ちをつなぐ

**Files:**
- Modify: `app/sequence.js`、`app/app.js`

- [ ] **Step 1: シーケンス — import と作る所**

1. old: `import { createMethodEditor } from './method-editor.js';`
   new: `import { createMethodEditor } from './method-editor.js';\nimport { createSafety } from './method-safety.js';\nimport { createTrial } from './method-trial.js';`
2. old: `let renderer, scene, camera, perspCam, mesh, sceneBlur, backdrop, variants, methodEditor, methodPersistence;`
   new: `let renderer, scene, camera, perspCam, mesh, sceneBlur, backdrop, variants, methodEditor, methodPersistence, safety;`
3. エディタの作成と、保存の読み込みを直す。
   old: `  methodEditor = createMethodEditor({ vertexShader, fragmentShader, notify: notice, getPreviewImage: () => (seq.slides[0] ? slideCanvas(seq.slides[0]) : null) });`
   new: `  safety = createSafety({ notify: notice });\n  methodEditor = createMethodEditor({ vertexShader, fragmentShader, notify: notice, safety, trial: createTrial({ vertexShader, fragmentShader }), getPreviewImage: () => (seq.slides[0] ? slideCanvas(seq.slides[0]) : null) });`
   old: `  methodPersistence.load().then(() => methodPersistence.start(), () => notice('保存した自作メソッドを読み込めませんでした。'));`
   new: `  // saving starts first, so that what recoverFromCrash switches off is saved too\n  methodPersistence.load().then(() => { methodPersistence.start(); safety.recoverFromCrash(); }, () => notice('保存した自作メソッドを読み込めませんでした。'));\n  addEventListener('pagehide', () => safety.pageHide());\n  $('seq-canvas').addEventListener('webglcontextlost', () => safety.contextLost());`
4. old: `editor: methodEditor, persistence: methodPersistence };`
   new: `editor: methodEditor, persistence: methodPersistence, safety };`

- [ ] **Step 2: シーケンス — 描画の前後と再生ループ**

1. `renderAt`：`pick` の直後に印を、描画の直後にコマを数える。
   old: `  if (mesh.material !== pick.material) mesh.material = pick.material;`
   new: `  if (mesh.material !== pick.material) mesh.material = pick.material;\n  safety.beforeDraw(pick.used);`
   old: `  sceneBlur.render(scene, view, fx.blur, fx.glitch, fx.chroma, sec, { ...fx, neonColor: seq.fx.neonColor });`
   new: `  sceneBlur.render(scene, view, fx.blur, fx.glitch, fx.chroma, sec, { ...fx, neonColor: seq.fx.neonColor });\n  safety.afterDraw();`
2. 再生ループ：コマ間隔を測る。
   old: `function tick(now) {\n  if (seq.playing && !seq.recording) {`
   new: `let lastTickAt = 0;\nfunction tick(now) {\n  // the time between animation frames, for the watch on custom methods (only while playing, never while exporting)\n  if (seq.playing && !seq.recording && lastTickAt && !document.hidden) safety.tick(now - lastTickAt);\n  lastTickAt = now;\n  if (seq.playing && !seq.recording) {`
3. 書き出し前に、自作メソッドのコンパイルを待つ。
   old: `  if (!('VideoEncoder' in window)) throw new Error('このブラウザは WebCodecs に対応していません（Chrome で開いてね）');\n  await prepareShapes();`
   new: `  if (!('VideoEncoder' in window)) throw new Error('このブラウザは WebCodecs に対応していません（Chrome で開いてね）');\n  await variants.ready();      // a custom method that is still compiling would be exported as the default method\n  const switchedOff = seq.transitions.filter(tr => [tr.method, tr.method2].some(k => k && isCustomKey(k) && !isUsable(k))).length;\n  if (switchedOff) notice(\`止まっている自作メソッドを使う◆が${switchedOff}か所あります。「くしゃくしゃ」で書き出します。\`);\n  await prepareShapes();`
   そのため import に `isCustomKey, isUsable` を足す。
   old: `import { BUILTIN_KEYS, listCustom, methodEntries, methodLabel, onRegistryChange, registerCustom, setCustomStatus, unregisterCustom } from './method-registry.js';`
   new: `import { BUILTIN_KEYS, isCustomKey, isUsable, listCustom, methodEntries, methodLabel, onRegistryChange, registerCustom, setCustomStatus, unregisterCustom } from './method-registry.js';`

- [ ] **Step 3: 1枚モード**

1. old: `import {createMethodEditor} from './method-editor.js';`
   new: `import {createMethodEditor} from './method-editor.js';\nimport {createSafety} from './method-safety.js';\nimport {createTrial} from './method-trial.js';`
2. old: `let renderer,scene,camera,mesh,variants,methodEditor,methodPersistence,texture,`
   new: `let renderer,scene,camera,mesh,variants,methodEditor,methodPersistence,safety,texture,`
3. old: ` methodEditor=createMethodEditor({vertexShader,fragmentShader,notify:notice,getPreviewImage:()=>sourceCanvas});`
   new: ` safety=createSafety({notify:notice});\n methodEditor=createMethodEditor({vertexShader,fragmentShader,notify:notice,safety,trial:createTrial({vertexShader,fragmentShader}),getPreviewImage:()=>sourceCanvas});`
4. old: ` methodPersistence.load().then(()=>methodPersistence.start(),()=>notice('保存した自作メソッドを読み込めませんでした。'));`
   new: ` // saving starts first, so that what recoverFromCrash switches off is saved too\n methodPersistence.load().then(()=>{methodPersistence.start();safety.recoverFromCrash()},()=>notice('保存した自作メソッドを読み込めませんでした。'));\n addEventListener('pagehide',()=>safety.pageHide());`
5. old: `get persistence(){return methodPersistence}};`
   new: `get persistence(){return methodPersistence},get safety(){return safety}};`
6. `render()`：`pick` の直後に印を入れる。
   old: `const pick=variants.pick(state.method);if(mesh.material!==pick.material)mesh.material=pick.material;`
   new: `const pick=variants.pick(state.method);if(mesh.material!==pick.material)mesh.material=pick.material;safety.beforeDraw(pick.used);`
7. `render()` の描画の直後にコマを数える、再生ループでコマ間隔を測る、コンテキスト喪失、書き出し前の待ち。**実物を見て場所を決める**（`app.js` は1行が長い）。

Run: `cd /Volumes/ORICO/UNFOLD/app && grep -n "sceneBlur.render\|function render" app.js | cut -c1-120`
→ `render()` の中の最後の描画呼び出しの直後に `safety.afterDraw();` を足す。
→ `tick` の `previous=now;` の所で、`if(state.playing&&!state.recording&&!document.hidden)safety.tick(now-previous)` を `previous=now` の**前**に足す（`const dt=Math.min((now-previous)/1000,.1);` の直後）。
→ `renderer=new THREE.WebGLRenderer(…)` の行のあとに `$('scene').addEventListener('webglcontextlost',()=>safety.contextLost());`。ただし `safety` は `wireControls()` で作るので、`safety?.contextLost()` と書く。
→ `async function startExport(){` の最初（`showInspectorPane('export');` の後）に `await variants.ready();` を足す。

- [ ] **Step 4: 構文と単体テスト**

Run: `cd /Volumes/ORICO/UNFOLD/app && S=/private/tmp/claude-501/-Volumes-ORICO-UNFOLD/e8107f15-5f2a-459b-a83e-4e6edb1a6f69/scratchpad && for f in sequence app; do cp $f.js "$S/$f-check.mjs" && node --check "$S/$f-check.mjs" && echo "$f SYNTAX_OK"; done; cd .. && node --test "tools/test/*.test.mjs" 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `sequence SYNTAX_OK`、`app SYNTAX_OK`、`ℹ fail 0`

---

### Task 9: ブラウザで確認する

**Files:** なし（確認だけ）。`.claude/launch.json` は先に読み直してから書く。

- [ ] **Step 1: コピーして、サーバーを起動する**

Task 5 の Step 1 と同じ（コピーし直す）。`navigate` で `http://localhost:8771/sequence.html?empty`。`read_console_messages`（`onlyErrors: true`）が空。エラーを自分で捕まえる仕掛けも入れる:
```js
window.__errs = [];
addEventListener('error', e => window.__errs.push('error: ' + e.message));
addEventListener('unhandledrejection', e => window.__errs.push('rejection: ' + (e.reason?.message || e.reason)));
({ safety: !!unfoldMethods.safety, tiles: document.querySelectorAll('#seq-methods button[data-method]').length })
```
Expected: `{ safety: true, tiles: 29 }`

- [ ] **Step 2: 試し描画の計測（サンプル・何も映らない・変わらない・重い扱い）**

```js
const M = await import('/motion.js?v=22'), T = await import('/method-trial.js');
const trial = T.createTrial({ vertexShader: M.vertexShader, fragmentShader: M.fragmentShader });
const S = await import('/method-samples.js');
const src = k => S.SAMPLES.find(s => s.key === k).source;
const out = {};
for (const k of ['vortex', 'wave', 'scatter', 'sparkle']) { const r = await trial.run(src(k)); out[k] = { stage: r.stage, ratio: r.ratio && +r.ratio.toFixed(2), ms: +r.customMs.toFixed(3), base: +r.baselineMs.toFixed(3), heavy: r.heavy, blank: r.blank, unchanged: r.unchanged }; }
const identity = await trial.run('vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }');
const offscreen = await trial.run('vec3 userMethod(vec2 p, float amount) { return vec3(p + vec2(100., 0.), 0.); }');
const forcedHeavy = await trial.run(src('vortex'), { factor: 0.0001, smallFloorMs: 0, fullFloorMs: 0 });
({ out, identity: { blank: identity.blank, unchanged: identity.unchanged, heavy: identity.heavy }, offscreen: { blank: offscreen.blank, heavy: offscreen.heavy }, forcedHeavy: { stage: forcedHeavy.stage, heavy: forcedHeavy.heavy } })
```
Expected:
- 4つのサンプルとも `heavy: false`、`blank: false`、`unchanged: false`（`ratio` と `ms` が出る）。
- `identity`: `unchanged: true`、`blank: false`。
- `offscreen`: `blank: true`（絵が画面の外へ出ていく）。
- `forcedHeavy`: `stage: 'small'`、`heavy: true`（しきい値を極端に下げると、小さい方で止まる）。

- [ ] **Step 3: 重いコードの様子を見る（上限いっぱいのループ）**

```js
const M = await import('/motion.js?v=22'), T = await import('/method-trial.js');
const trial = T.createTrial({ vertexShader: M.vertexShader, fragmentShader: M.fragmentShader });
const G = await import('/method-guard.js');
const heavy = `vec3 userMethod(vec2 p, float amount) {
  vec2 q = p;
  for (int i = 0; i < 16; i++) {
    for (int j = 0; j < 15; j++) {
      q += vec2(sin(q.y * 3.1 + float(i)), cos(q.x * 2.7 + float(j))) * .0004 * amount;
    }
  }
  return vec3(q, 0.);
}`;
const guard = G.checkSource(heavy);
const r = await trial.run(heavy);
({ guardOk: guard.ok, loops: guard.loops, stage: r.stage, ratio: r.ratio && +r.ratio.toFixed(2), ms: +r.customMs.toFixed(3), base: +r.baselineMs.toFixed(3), heavy: r.heavy })
```
Expected: `guardOk: true`、`loops: 256`。`ratio` と `heavy` はこの GPU での実測値（計画書に書き残す）。

- [ ] **Step 4: エディタに「試し描画」の行が出て、保存の条件になる**

3枚入れて、エディタを開く（`document.querySelector('#seq-methods button.add-method').click()`）。
```js
const wait = async fn => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > 8000) throw new Error('timeout'); await new Promise(r => setTimeout(r, 40)); } };
window.__w = wait;
await wait(() => document.getElementById('method-trial')?.className.includes('ok') || document.getElementById('method-trial')?.className.includes('warn') || document.getElementById('method-trial')?.className.includes('ng'));
const row = () => ({ cls: document.getElementById('method-trial').className, text: document.getElementById('method-trial').textContent, save: !document.getElementById('method-save').disabled });
const starter = row();
const code = document.getElementById('method-code');
const type = async text => { code.value = text; code.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 500)); await wait(() => { const c = document.getElementById('method-trial').className; return c.includes('ok') || c.includes('warn') || c.includes('ng') || c.includes('skip'); }); };
await type('vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }');
const unchanged = row();
await type('vec3 userMethod(vec2 p, float amount) { return vec3(p + vec2(100., 0.), 0.); }');
const blank = row();
const T = await import('/method-trial.js');
const saved = { ...T.TRIAL };
T.TRIAL.factor = 0.0001; T.TRIAL.smallFloorMs = 0; T.TRIAL.fullFloorMs = 0;
await type('vec3 userMethod(vec2 p, float amount) { return vec3(p * (1. - amount * .1), 0.); }');
const heavy = row();
Object.assign(T.TRIAL, saved);
({ starter, unchanged, blank, heavy })
```
Expected:
- `starter`: `md-check ok`、`試し描画（重さ …）`、`save: true`。
- `unchanged`: `md-check warn`、「元の絵と変わっていません（保存はできます）」、`save: true`。
- `blank`: `md-check warn`、「何も映っていません（保存はできます）」、`save: true`。
- `heavy`（しきい値を下げた状態）: `md-check ng`、「重すぎます…」、**`save: false`**。
その後 `document.getElementById('method-cancel').click()` で閉じる。`window.__errs` が空。

- [ ] **Step 5: 見張り（偽のコマ時間で）**

```js
const wait = async fn => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > 6000) throw new Error('timeout'); await new Promise(r => setTimeout(r, 40)); } };
unfoldMethods.registerCustom({ id: 'cm-slow', name: '重い', symbol: '重', vertex: 'vec3 userMethod(vec2 p, float amount) { return vec3(p * (1. - amount * .1), 0.); }' });
await wait(() => unfoldMethods.variants.pick('cm-slow').uMethod === 100);
const safety = unfoldMethods.safety;
safety.beforeDraw(['cm-slow']);                                   // "a custom method is on screen"
for (let i = 0; i < 29; i++) safety.tick(120);
const before = unfoldMethods.listCustom().find(c => c.id === 'cm-slow').status;
safety.tick(120);                                                 // the 30th slow frame
await new Promise(r => setTimeout(r, 200));
const rec = unfoldMethods.listCustom().find(c => c.id === 'cm-slow');
const tile = [...document.querySelectorAll('#seq-methods button.unusable')].find(b => b.dataset.method === 'cm-slow');
({ before, status: rec.status, reason: rec.reason, badge: tile?.querySelector('small')?.textContent, notice: document.getElementById('seq-notice').textContent, pickNow: unfoldMethods.variants.pick('cm-slow').uMethod, errors: window.__errs })
```
Expected: `before: 'ok'`、`status: 'disabled'`、`reason` に「重すぎる」、`badge: '停止中'`、`notice` に「重すぎたので止めました」、`pickNow: 0`。

- [ ] **Step 6: 本物の再生で、正常な自作メソッドは止まらない**

```js
const wait = async fn => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > 6000) throw new Error('timeout'); await new Promise(r => setTimeout(r, 40)); } };
const mk = c => { const k = document.createElement('canvas'); k.width = 640; k.height = 360; const g = k.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 640, 360); return k; };
for (const c of ['#e55', '#5a5', '#55e']) unfoldSeq.addSlide(mk(c), c);
unfoldMethods.registerCustom({ id: 'cm-fine', name: '軽い', symbol: '軽', vertex: 'vec3 userMethod(vec2 p, float amount) { return vec3(p * (1. - amount * .2), 0.); }' });
await wait(() => unfoldMethods.variants.pick('cm-fine').uMethod === 100);
unfoldSeq.seq.transitions[0].method = 'cm-fine';
unfoldSeq.seq.t = 4.2 * 60 / unfoldSeq.seq.bpm;
document.getElementById('seq-play').click();
await new Promise(r => setTimeout(r, 3500));
document.getElementById('seq-play').click();
const flag = localStorage.getItem('unfold-method-trial');
({ status: unfoldMethods.listCustom().find(c => c.id === 'cm-fine').status, markWiped: flag === null, t: +unfoldSeq.seq.t.toFixed(2), errors: window.__errs })
```
Expected: `status: 'ok'`（正常なメソッドを、約3.5秒再生しても止まらない）、`markWiped: true`（30コマ以上描けたので印は消えている）。

- [ ] **Step 7: クラッシュ印（手で書いた印で）**

```js
unfoldMethods.registerCustom({ id: 'cm-marked', name: '印あり', symbol: '印', vertex: 'vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }' });
await unfoldMethods.persistence.flush();
localStorage.setItem('unfold-method-trial', JSON.stringify({ session: 'a-crashed-session', at: Date.now() - 5000, ids: ['cm-marked'] }));
({ stored: localStorage.getItem('unfold-method-trial') !== null })
```
ページを開き直す（`navigate` で `http://localhost:8771/sequence.html?empty`）。続けて:
```js
const wait = async fn => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > 6000) throw new Error('timeout'); await new Promise(r => setTimeout(r, 40)); } };
await wait(() => unfoldMethods.listCustom().find(c => c.id === 'cm-marked')?.status === 'crashed');
await unfoldMethods.persistence.flush();
const rec = unfoldMethods.listCustom().find(c => c.id === 'cm-marked');
const tile = [...document.querySelectorAll('#seq-methods button.unusable')].find(b => b.dataset.method === 'cm-marked');
({ status: rec.status, reason: rec.reason, badge: tile?.querySelector('small')?.textContent, notice: document.getElementById('seq-notice').textContent, markWiped: localStorage.getItem('unfold-method-trial') === null,
   others: unfoldMethods.listCustom().filter(c => c.id !== 'cm-marked').map(c => c.name + ':' + c.status) })
```
Expected: `status: 'crashed'`、`reason` に「落ちた」、`badge: '落ちた'`、`notice` に「ブラウザが落ちたみたい」、`markWiped: true`、`others` は `ok` のもの（`cm-slow` は前の Step で `disabled` のまま）。
もう一度ページを開き直しても `cm-marked` は `crashed` のまま（保存されている）。メニューの「もう一度試す」で `ok` に戻せる。

- [ ] **Step 8: 落ちた下書きは自動でチェックしない**

```js
const old = JSON.stringify({ id: null, name: '落ちるかも', symbol: '危', source: 'vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }' });
localStorage.setItem('unfold-method-draft', old);
localStorage.setItem('unfold-method-trial', JSON.stringify({ session: 'a-crashed-session', at: Date.now() - 5000, ids: ['draft'] }));
true
```
ページを開き直して、少し待つ。続けて:
```js
await new Promise(r => setTimeout(r, 800));
const draft = JSON.parse(localStorage.getItem('unfold-method-draft'));
const notice1 = document.getElementById('seq-notice').textContent;
document.querySelector('#seq-methods button.add-method').click();
await new Promise(r => setTimeout(r, 800));
const wait = async fn => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > 6000) throw new Error('timeout'); await new Promise(r => setTimeout(r, 40)); } };
const opened = { name: document.getElementById('method-name').value, restored: document.getElementById('method-code').value.includes('return vec3(p, 0.)'), recheckShown: !document.getElementById('method-recheck').hidden,
  guard: document.getElementById('method-guard').className, compile: document.getElementById('method-compile').className, save: !document.getElementById('method-save').disabled, notice: document.getElementById('seq-notice').textContent };
document.getElementById('method-recheck').click();
await wait(() => document.getElementById('method-trial').className.includes('ok') || document.getElementById('method-trial').className.includes('warn'));
const afterRecheck = { recheckHidden: document.getElementById('method-recheck').hidden, compile: document.getElementById('method-compile').className, save: !document.getElementById('method-save').disabled };
document.getElementById('method-cancel').click();
localStorage.removeItem('unfold-method-draft');
({ draftCrashed: draft.crashed, notice1, opened, afterRecheck })
```
Expected: `draftCrashed: true`、`notice1` に「エディタで試したコードでブラウザが落ちたみたい」、`opened`: `recheckShown: true`、`restored: true`、`guard`/`compile` は **まだ `md-check`（自動では走っていない）**、`save: false`、`notice` に「見直してから「チェックする」」。`afterRecheck`: `recheckHidden: true`、`compile: 'md-check ok'`（押すと走る）。

- [ ] **Step 9: GPU コンテキストの喪失**

```js
const cv = document.getElementById('seq-canvas'), gl = cv.getContext('webgl2');
const ext = gl.getExtension('WEBGL_lose_context');
unfoldMethods.registerCustom({ id: 'cm-ctx', name: '喪失', symbol: '喪', vertex: 'vec3 userMethod(vec2 p, float amount) { return vec3(p * (1. - amount * .1), 0.); }' });
await new Promise(r => setTimeout(r, 400));
unfoldMethods.safety.beforeDraw(['cm-ctx']);
ext.loseContext();
await new Promise(r => setTimeout(r, 300));
const status = unfoldMethods.listCustom().find(c => c.id === 'cm-ctx').status;
ext.restoreContext();
await new Promise(r => setTimeout(r, 500));
({ status, notice: document.getElementById('seq-notice').textContent, errors: window.__errs })
```
Expected: `status: 'crashed'`。そのあと `restoreContext()` で描画が戻る（ページを開き直さなくても使える）。

- [ ] **Step 10: 書き出し前の待ち**

```js
unfoldMethods.registerCustom({ id: 'cm-late', name: '遅れ', symbol: '遅', vertex: 'vec3 userMethod(vec2 p, float amount) { return vec3(p * (1. - amount * .3), 0.); }' });
const before = unfoldMethods.variants.pick('cm-late').uMethod;      // still compiling: the default method stands in
await unfoldMethods.variants.ready();
({ before, after: unfoldMethods.variants.pick('cm-late').uMethod })
```
Expected: `{ before: 0, after: 100 }`（`ready()` を待つと、書き出しの最初の1コマから自作メソッドで描ける）。

- [ ] **Step 11: 1枚モード**

テスト用に作った自作メソッドを全部消す（`for (const c of unfoldMethods.listCustom()) unfoldMethods.unregisterCustom(c.id); await unfoldMethods.persistence.flush();`）。`navigate` で `http://localhost:8771/index.html`。コンソールエラーなし。`unfoldMethods.safety` がある。自作を1つ登録して選び、`unfold.setTime(.2)` で描き、`unfoldMethods.safety.lastUsed` が自作の id になる。`safety.tick(120)` を30回で `disabled` になり、`unfold.state.method` は `crumple` のままか、描画は「くしゃくしゃ」で続く。エディタを開いて、試し描画の行が出る。

- [ ] **Step 12: 標準の29個は変わっていない（変更前と比べる）**

計画②の Step 14 と同じ手順（変更前＝今回のバックアップ `archive/app-before-custom-safety-2026-10-03/` を別ポート8772で配信、同じタブで比べる）。1枚モード 58点、シーケンス 117点が全部一致すること。

- [ ] **Step 13: 片付ける**

テスト用の自作メソッド・`localStorage` の `unfold-method-draft`・`unfold-method-trial` を消す。`preview_stop`（全部）。`resize_window` を `desktop` に。`.claude/launch.json` を元の1設定に戻す。

---

### Task 10: 仕上げ

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README に更新メモを足す**

old_string: `公開サイト: https://unfold-test.netlify.app/`
new_string:
```
- 自作メソッドの安全装置（ローカルのみ・未公開）：エディタに「試し描画」を追加（標準の一番重いメソッドと同じ場で測って4倍まで／何も映らない・変わらないは警告）。再生中にコマ間隔が基準の4倍かつ50ms以上のまま30コマ続くと、その自作メソッドを自動で止めます（「停止中」）。使い始める前に `localStorage` へ「試用中」の印を書き、30コマ描けたら消します。ブラウザごと落ちたときは、次の起動で印が残っているメソッドを「落ちた」にして止め、エディタの下書きは自動でチェックしません。書き出しの前に、自作メソッドのコンパイル完了を待ちます。仕組みは `app/method-safety.js`・`method-watchdog.js`・`method-crashflag.js`・`method-trial.js`。変更前の `app/` は `archive/app-before-custom-safety-2026-10-03/`。実装計画は `docs/superpowers/plans/2026-10-03-custom-methods-3a-safety.md`。

公開サイト: https://unfold-test.netlify.app/
```

- [ ] **Step 2: 差分が意図した範囲か確認する**

Run: `cd /Volumes/ORICO/UNFOLD && diff -rq archive/app-before-custom-safety-2026-10-03 app`
Expected（この順で、これだけ）:
```
Files archive/app-before-custom-safety-2026-10-03/app.js and app/app.js differ
Files archive/app-before-custom-safety-2026-10-03/custom-method.js and app/custom-method.js differ
Files archive/app-before-custom-safety-2026-10-03/method-editor.css and app/method-editor.css differ
Files archive/app-before-custom-safety-2026-10-03/method-editor.js and app/method-editor.js differ
Only in app: method-crashflag.js
Files archive/app-before-custom-safety-2026-10-03/method-preview.js and app/method-preview.js differ
Only in app: method-safety.js
Only in app: method-trial.js
Only in app: method-watchdog.js
Files archive/app-before-custom-safety-2026-10-03/sequence.js and app/sequence.js differ
```
`project.js`・`motion.js`・`method-registry.js`・`method-guard.js`・`method-library.js`・`index.html`・`sequence.html` は出ない。

- [ ] **Step 3: 全部の単体テストを通す**

Run: `cd /Volumes/ORICO/UNFOLD && node --test "tools/test/*.test.mjs" 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `ℹ fail 0`

- [ ] **Step 4: 公開について**

これで、実行時の安全（試し描画・見張り・クラッシュ印・書き出し前の待ち）が入る。残りは**計画③b（`.unfold` への同梱と取り込み時の隔離）**。知らない人のコードが入ってくる道はこの `.unfold` だけなので、**公開は③bのあと**にする。

---

## 次の計画

**③b `.unfold` への同梱と取り込み時の隔離（段4）**：使っている自作メソッドだけを `json.methods` に同梱（version 2。使っていなければ version 1 のまま）、開くときは `hash` が同じローカルのメソッドを再利用、無ければ「未確認」の隔離状態で新しい id を作って◆の参照を付け替える。「未確認のメソッドが N 個あるよ［コードを見る］［有効にする］」のバナー。「有効にする」は、書き方チェック・コンパイル・試し描画を通ったものだけ使えるようにする。形式・サイズ・version の検査。
