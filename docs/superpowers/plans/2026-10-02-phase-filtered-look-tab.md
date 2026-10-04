# 「04 見た目」の区間出し分け Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** シーケンスの右パネル「04 見た目」に、プレイヘッドの位置（ぐちゃぐちゃ／立体化／画像）で効く設定だけを表示する。

**Architecture:** 各行に `data-phase`（`chaos` / `form` / `chaos form`）を付け、`#pane-look` の `data-view` 属性に応じて CSS だけで隠す。どの表示にするかは、`updateTransport` が毎フレーム求めている `phaseOf(L)` から決める。判定と文言は、画面に依存しない小さな ES モジュール `look-view.js` に切り出して Node でテストする。

**Tech Stack:** バニラ JS（ES modules）、three.js は触らない、テストは `node:test`（Node 25）。ブラウザ確認は Claude のブラウザペイン（`preview_start` / `javascript_tool`）。

**設計書:** `docs/superpowers/specs/2026-10-02-phase-filtered-look-tab-design.md`（承認済み）

**このプロジェクトは git リポジトリではない。** コミットの代わりに、作業前に `app/` をバックアップし（Task 0）、最後に差分が意図した3ファイルだけか確認する（Task 6）。戻すときはバックアップを `app/` に戻す。

---

## ファイル構成

| ファイル | 変更 | 役割 |
|---|---|---|
| `app/look-view.js` | 新規 | 表示モードと区間から「どの表示か」と文言を返す純粋関数 |
| `tools/test/look-view.test.mjs` | 新規 | 上の単体テスト |
| `app/sequence.html` | 変更 | 切り替えの UI、各行の `data-phase` と丸、隠す CSS、`sequence.js` の `?v=` を 45→46 |
| `app/sequence.js` | 変更 | `FX_UI`/`CAM_UI` に区間の欄、`slider()` が `data-phase` と丸を付ける、`applyLookView()`、`updateTransport`/`stopPlay`/`wire` からの呼び出し |
| `README.md` | 変更 | 2026-10-02 の更新メモ |

`project.js` と、保存・読み込みのコードは**変えない**（設定値・`.unfold` の形式は同じ）。

---

### Task 0: バックアップ

**Files:**
- Create: `archive/app-before-phase-filter-2026-10-02/`（`app/` のコピー）

- [ ] **Step 1: `app/` をコピーする**

```bash
cp -R /Volumes/ORICO/UNFOLD/app /Volumes/ORICO/UNFOLD/archive/app-before-phase-filter-2026-10-02
```

- [ ] **Step 2: コピーできたか確認する**

Run: `ls /Volumes/ORICO/UNFOLD/archive/app-before-phase-filter-2026-10-02 | head -5 && diff -rq /Volumes/ORICO/UNFOLD/app /Volumes/ORICO/UNFOLD/archive/app-before-phase-filter-2026-10-02 && echo SAME`
Expected: ファイル名が並び、最後に `SAME`（差分なし）。

---

### Task 1: `look-view.js`（純粋関数）と単体テスト — TDD

**Files:**
- Create: `tools/test/look-view.test.mjs`
- Create: `app/look-view.js`

- [ ] **Step 1: 失敗するテストを書く**

`/Volumes/ORICO/UNFOLD/tools/test/look-view.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { lookView, lookViewText } from '../../app/look-view.js';

test('auto follows the phase under the playhead', () => {
  assert.equal(lookView('auto', 'chaos'), 'chaos');
  assert.equal(lookView('auto', 'form'), 'form');
});

test('outside chaos and form the picture is simply shown: image', () => {
  assert.equal(lookView('auto', null), 'image');
  assert.equal(lookView('auto', undefined), 'image');
});

test('all mode ignores the phase', () => {
  assert.equal(lookView('all', 'chaos'), 'all');
  assert.equal(lookView('all', 'form'), 'all');
  assert.equal(lookView('all', null), 'all');
});

test('the text names the current view', () => {
  assert.equal(lookViewText('chaos').label, 'いま：ぐちゃぐちゃ');
  assert.equal(lookViewText('form').label, 'いま：立体化');
  assert.equal(lookViewText('image').label, 'いま：画像');
  assert.equal(lookViewText('all').label, 'すべての設定を表示中');
});

test('only the image view carries the hint about moving to a ◆ section', () => {
  assert.match(lookViewText('image').hint, /◆の区間/);
  for (const v of ['chaos', 'form', 'all']) assert.equal(lookViewText(v).hint, '');
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/look-view.test.mjs`
Expected: FAIL（`Cannot find module '.../app/look-view.js'`、`ERR_MODULE_NOT_FOUND`）。

- [ ] **Step 3: 最小の実装を書く**

`/Volumes/ORICO/UNFOLD/app/look-view.js`:

```js
// Which settings the 04 見た目 tab shows for the part of the video under the playhead.
// phase: 'chaos' | 'form' | null (null = a picture is simply shown). mode: 'auto' | 'all'.
export function lookView(mode, phase) {
  if (mode === 'all') return 'all';
  return phase === 'chaos' || phase === 'form' ? phase : 'image';
}

const NAMES = { chaos: 'ぐちゃぐちゃ', form: '立体化', image: '画像' };

export function lookViewText(view) {
  if (view === 'all') return { label: 'すべての設定を表示中', hint: '' };
  return { label: `いま：${NAMES[view]}`, hint: view === 'image' ? '◆の区間にプレイヘッドを動かすと、変形の設定が出るよ' : '' };
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/look-view.test.mjs`
Expected: `ℹ pass 5`、`ℹ fail 0`（Node 25 の既定の表示形式。`✔` が5行並ぶ）。

---

### Task 2: `sequence.html` — 切り替えの UI、`data-phase`、丸、CSS

**Files:**
- Modify: `app/sequence.html`（`<style>` 内、`#pane-look` 内、`<script>` 行）

- [ ] **Step 1: 隠す CSS と切り替えの CSS を足す**

`.phase-dot { ... }` の行（`.phase-chip.form, .phase-dot.form` の次の行）の直後に追加する。

old_string:
```
  .phase-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; vertical-align:middle; }
```
new_string:
```
  .phase-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; vertical-align:middle; }
  /* 04 見た目: show only the settings that work where the playhead is (data-view is set by applyLookView) */
  #pane-look[data-view="image"] [data-phase] { display:none; }
  #pane-look[data-view="chaos"] [data-phase]:not([data-phase~="chaos"]) { display:none; }
  #pane-look[data-view="form"] [data-phase]:not([data-phase~="form"]) { display:none; }
  .look-view { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:4px; }
  #look-mode { display:flex; }
  #look-mode button { background:#1c2324; color:var(--dim); border:1px solid var(--line); padding:4px 12px; font:inherit; font-size:11px; cursor:pointer; }
  #look-mode button:first-child { border-radius:7px 0 0 7px; }
  #look-mode button:last-child { border-radius:0 7px 7px 0; border-left:0; }
  #look-mode button[aria-pressed=true] { color:var(--accent); border-color:#6f8a30; background:#2b3323; font-weight:700; }
  #look-view-label { font-size:12px; color:var(--dim); }
  #look-view-hint { margin:2px 0 8px; }
  #look-view-hint:empty { display:none; }
```

- [ ] **Step 2: 切り替えの UI を `#pane-look` の先頭に足す**

old_string:
```
  <div class="pane" id="pane-look" hidden>
    <h2>リズム</h2>
```
new_string:
```
  <div class="pane" id="pane-look" data-view="image" hidden>
    <div class="look-view"><div id="look-mode" role="group" aria-label="表示する設定"><button type="button" data-mode="auto" aria-pressed="true">自動</button><button type="button" data-mode="all" aria-pressed="false">すべて</button></div><span id="look-view-label"></span></div>
    <p class="hint" id="look-view-hint"></p>
    <h2>リズム</h2>
```

- [ ] **Step 3: 静的な行に `data-phase` と丸を付ける（7行）**

次の7回の置き換えをそれぞれ行う（old は行の先頭部分だけで一意）。

1. 崩れの強さ
   - old: `<div class="row"><label>崩れの強さ</label>`
   - new: `<div class="row" data-phase="chaos"><label><span class="phase-dot chaos"></span>崩れの強さ</label>`
2. ぐちゃぐちゃ中の引き（丸は既にある）
   - old: `<div class="row"><label><span class="phase-dot chaos"></span>ぐちゃぐちゃ中の引き</label>`
   - new: `<div class="row" data-phase="chaos"><label><span class="phase-dot chaos"></span>ぐちゃぐちゃ中の引き</label>`
3. 立体化中の引き（丸は既にある）
   - old: `<div class="row"><label><span class="phase-dot form"></span>立体化中の引き</label>`
   - new: `<div class="row" data-phase="form"><label><span class="phase-dot form"></span>立体化中の引き</label>`
4. 粒の細かさ
   - old: `<div class="row"><label>粒の細かさ（GLB・文字）</label>`
   - new: `<div class="row" data-phase="chaos"><label><span class="phase-dot chaos"></span>粒の細かさ（GLB・文字）</label>`
5. プッシュイン
   - old: `<div class="row"><label>プッシュイン</label>`
   - new: `<div class="row" data-phase="form"><label><span class="phase-dot form"></span>プッシュイン</label>`
6. 拍のパルス（両方）
   - old: `<div class="row"><label>拍のパルス</label>`
   - new: `<div class="row" data-phase="chaos form"><label><span class="phase-dot chaos"></span><span class="phase-dot form"></span>拍のパルス</label>`
7. シルエット感度
   - old: `<div class="row"><label>シルエット感度</label>`
   - new: `<div class="row" data-phase="form"><label><span class="phase-dot form"></span>シルエット感度</label>`

- [ ] **Step 4: キャッシュ対策に `sequence.js` のバージョンを上げる**

old_string: `<script type="module" src="./sequence.js?v=45"></script>`
new_string: `<script type="module" src="./sequence.js?v=46"></script>`

- [ ] **Step 5: 確認する**

Run: `cd /Volumes/ORICO/UNFOLD/app && grep -c 'data-phase=' sequence.html && grep -n 'id="look-mode"\|id="look-view-label"\|id="look-view-hint"\|data-view="image"\|sequence.js?v=46' sequence.html | cut -c1-120`
Expected: 先頭の数が `7`、続けて `look-mode` / `look-view-label` / `look-view-hint` / `data-view="image"` / `sequence.js?v=46` の各行が1回ずつ出る。

---

### Task 3: `sequence.js` — 演出・カメラの行に区間の欄

**Files:**
- Modify: `app/sequence.js`（`FX_UI`・`CAM_UI`・`slider()`・`renderFxPanel()`）

- [ ] **Step 1: ボケと回り込みに区間を書く**

1. old: `['bokeh', 'ボケ', '手前・奥に飛んだかけらがぼける（ピントは画像の面）']`
   new: `['bokeh', 'ボケ', '手前・奥に飛んだかけらがぼける（ピントは画像の面）', 'chaos form']`
2. old: `['orbit', '回り込み', '立体化の間、カメラが回り込む']`
   new: `['orbit', '回り込み', '立体化の間、カメラが回り込む', 'form']`

- [ ] **Step 2: `slider()` が `data-phase` と丸を付けるようにする**

old_string:
```
function slider(label, hint, value, onInput, onStart) {
  const wrap = document.createElement('div'); wrap.className = 'fx-row';
  const head = document.createElement('div'); head.className = 'fx-head';
  const name = document.createElement('span'); name.textContent = label;
```
new_string:
```
// the coloured dots in front of a setting: orange = while breaking up, purple = while solid (same colours as the timeline bands)
function phaseDots(phase) {
  return (phase || '').split(' ').filter(Boolean).map(p => Object.assign(document.createElement('span'), { className: 'phase-dot ' + p }));
}
function slider(label, hint, value, onInput, onStart, phase) {
  const wrap = document.createElement('div'); wrap.className = 'fx-row';
  if (phase) wrap.dataset.phase = phase;
  const head = document.createElement('div'); head.className = 'fx-head';
  const name = document.createElement('span'); name.textContent = label; name.prepend(...phaseDots(phase));
```

- [ ] **Step 3: `renderFxPanel()` から区間を渡し、作り直したあとに表示を合わせる**

1. old: `for (const [k, label, hint] of FX_UI) box.append(slider(label, hint, seq.fx[k], v => { seq.fx[k] = v; renderAt(seq.t); scheduleSave(); }));`
   new: `for (const [k, label, hint, phase] of FX_UI) box.append(slider(label, hint, seq.fx[k], v => { seq.fx[k] = v; renderAt(seq.t); scheduleSave(); }, undefined, phase));`
2. old: `for (const [k, label, hint] of CAM_UI) box.append(slider(label, hint, seq.cam[k], v => { seq.cam[k] = v; renderAt(seq.t); scheduleSave(); }));`
   new: `for (const [k, label, hint, phase] of CAM_UI) box.append(slider(label, hint, seq.cam[k], v => { seq.cam[k] = v; renderAt(seq.t); scheduleSave(); }, undefined, phase));`
3. `renderFxPanel()` の最後（`box.append(reset);` の直後）に1行足す。
   old: `  box.append(reset);\n}`
   new: `  box.append(reset);\n  applyLookView();\n}`

（◆ごとの上書き＝`slider(...)` の3つ目の呼び出し `const row = slider(label + ...` は引数を変えない。`phase` は undefined のままで、`data-phase` も丸も付かない。）

- [ ] **Step 4: 確認する**

Run: `cd /Volumes/ORICO/UNFOLD/app && grep -n "'chaos form'\|'form'\]" sequence.js | cut -c1-140; grep -n "function phaseDots\|function slider(\|undefined, phase" sequence.js | cut -c1-120`
Expected: `bokeh` の行と `orbit` の行、`phaseDots`・`slider(` の定義、`undefined, phase` の2行（演出とカメラ）が出る。※`applyLookView` はまだ未定義なので、このままブラウザで開くと動かない（Task 4 で定義する）。

---

### Task 4: `sequence.js` — 表示の判定・切り替え・各フック

**Files:**
- Modify: `app/sequence.js`（import、`phaseOf` の近く、`updateTransport`、`stopPlay`、`wire`）

- [ ] **Step 1: import を足す**

old_string: `import { createTimeline } from './timeline.js?v=4';`
new_string:
```
import { createTimeline } from './timeline.js?v=4';
import { lookView, lookViewText } from './look-view.js?v=1';
```

- [ ] **Step 2: 状態と `applyLookView()` を `phaseOf` の下に足す**

old_string:
```
function shapeLabel(tr) {
```
new_string:
```
// the 04 見た目 tab shows only what works where the playhead is (docs/superpowers/specs/2026-10-02-phase-filtered-look-tab-design.md).
// lookMode is not saved: reopening starts in 'auto'.
let lookMode = 'auto', lookPhase = null, lookDragging = false;
function applyLookView() {
  const pane = $('pane-look');
  // never change the panel during playback or while a control in it is held
  if (!pane || seq.playing || lookDragging) return;
  const view = lookView(lookMode, lookPhase), { label, hint } = lookViewText(view);
  pane.dataset.view = view;
  $('look-view-label').textContent = label;
  $('look-view-hint').textContent = hint;
  for (const b of document.querySelectorAll('#look-mode [data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === lookMode));
}
function shapeLabel(tr) {
```

- [ ] **Step 3: `updateTransport` で区間を覚えて反映する**

old_string:
```
  if (ph) $('seq-phase').append(Object.assign(document.createElement('span'), { className: 'phase-chip ' + ph, textContent: PHASE_LABELS[ph] }));
```
new_string:
```
  if (ph) $('seq-phase').append(Object.assign(document.createElement('span'), { className: 'phase-chip ' + ph, textContent: PHASE_LABELS[ph] }));
  lookPhase = ph;
  applyLookView();
```

- [ ] **Step 4: 再生を止めたときに反映する**

old_string: `function stopPlay() { seq.playing = false; seq.audio?.pause(); $('seq-play').textContent = '▶'; }`
new_string: `function stopPlay() { seq.playing = false; seq.audio?.pause(); $('seq-play').textContent = '▶'; applyLookView(); }`

- [ ] **Step 5: 切り替えボタンとドラッグ中の見張りを `wire()` に足す**

old_string:
```
  document.querySelectorAll('.tabs [data-tab]').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });
  renderFxPanel();
```
new_string:
```
  document.querySelectorAll('.tabs [data-tab]').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });
  for (const b of document.querySelectorAll('#look-mode [data-mode]')) b.onclick = () => { lookMode = b.dataset.mode; applyLookView(); };
  $('pane-look').addEventListener('pointerdown', () => { lookDragging = true; }, true);
  const lookRelease = () => { if (lookDragging) { lookDragging = false; applyLookView(); } };
  addEventListener('pointerup', lookRelease);
  addEventListener('pointercancel', lookRelease);
  renderFxPanel();
```

- [ ] **Step 6: 確認する**

Run: `cd /Volumes/ORICO/UNFOLD/app && node --check sequence.js 2>&1 | head -3; grep -n "applyLookView()" sequence.js | cut -c1-110`
Expected: `node --check` は構文エラーなし（何も出ないか、ESM の注意だけ）。`applyLookView()` が、`renderFxPanel`・`updateTransport`・`stopPlay`・`wire`（ボタンと `lookRelease`）・定義の各行に出る。

---

### Task 5: ブラウザで確認する

**Files:**
- Modify: `.claude/launch.json`（確認用サーバーを追加）

- [ ] **Step 1: 確認用サーバーの設定を足して起動する**

`/Volumes/ORICO/UNFOLD/.claude/launch.json` の `configurations` に追加（既存の `unfold` はそのまま）:

```json
{ "name": "unfold-serve", "runtimeExecutable": "python3", "runtimeArgs": ["tools/serve.py"], "port": 8771 }
```

**実際にやってみて分かったこと（2026-10-02）**：`preview_start` の Python は macOS の権限で `/Volumes/ORICO` を読めず、`Operation not permitted` で起動に失敗した（絶対パスでも同じ）。そのため、`app/` と `tools/serve.py` をスクラッチパッド（`/private/tmp/claude-501/.../scratchpad/unfold-preview/`）にコピーして、そのコピーの `serve.py` を `runtimeArgs` に書いた。コピー元を直したら、起動前にコピーし直すこと。確認が終わったら `launch.json` は元の1設定に戻す（`unfold-serve` は残さない）。

`preview_start` で `{name: "unfold-serve"}` を起動し、`navigate` で `http://localhost:8771/sequence.html?empty` を開く。`?empty` で前回の自動保存を読み込まない。ブラウザペインは Chrome とは別なので、作者の保存データには触れない。
Expected: エラーなしで開く。`read_console_messages`（`onlyErrors: true`）が空。

- [ ] **Step 2: テスト用の画像3枚を入れて「04 見た目」を開く**

`javascript_tool` で実行:

```js
const mk = c => { const k = document.createElement('canvas'); k.width = 640; k.height = 360; const g = k.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 640, 360); g.fillStyle = '#fff'; g.font = '80px sans-serif'; g.fillText(c, 40, 200); return k.toDataURL(); };
for (const c of ['#e55', '#5a5', '#55e']) await unfoldSeq.addImageFromUrl(mk(c), c);
document.querySelector('[data-tab=look]').click();
({ slides: unfoldSeq.seq.slides.length, transitions: unfoldSeq.seq.transitions.length, view: document.getElementById('pane-look').dataset.view })
```
Expected: `{ slides: 3, transitions: 2, view: 'image' }`。

- [ ] **Step 3: 表示の並びを確認する（設計書の確認 1〜4）**

```js
const pane = document.getElementById('pane-look'), seen = [];
for (let t = 0; t <= unfoldSeq.totalSeconds(); t += 0.05) { unfoldSeq.renderAt(t); if (seen.at(-1) !== pane.dataset.view) seen.push(pane.dataset.view); }
seen
```
Expected: `["image","chaos","form","chaos","image","chaos","form","chaos","image"]`。

- [ ] **Step 4: 行の数を確認する（設計書の確認 1〜3）**

```js
const rows = () => [...document.querySelectorAll('#pane-look [data-phase]')].filter(e => e.offsetParent !== null).map(e => e.dataset.phase);
const at = t => { unfoldSeq.renderAt(t); return rows(); };
const B = 60 / unfoldSeq.seq.bpm, T = b => b * B;   // 1枚目は4拍見せてから、8拍の変形
({ image: at(T(2)).length, chaos: at(T(5)), form: at(T(8)), tail: at(T(11)).length })
```
Expected:
- `image: 0`
- `chaos`: 配列で `"chaos"` が3つ、`"chaos form"` が2つ（計5）
- `form`: `"form"` が4つ、`"chaos form"` が2つ（計6）
- `tail: 0`

- [ ] **Step 5: 「すべて」と「自動」（確認 7）**

```js
document.querySelector('#look-mode [data-mode=all]').click();
const all = rows().length, label = document.getElementById('look-view-label').textContent;
document.querySelector('#look-mode [data-mode=auto]').click();
({ all, label, back: rows().length, label2: document.getElementById('look-view-label').textContent })
```
Expected: `all: 9`、`label: 'すべての設定を表示中'`、`back` は今のプレイヘッドの表示に応じた数（`at(T(11))` の直後なら 0）、`label2: 'いま：画像'`。

- [ ] **Step 6: 立体化なしの◆（確認 8）**

```js
const oldShape = unfoldSeq.seq.transitions[0].shape;
unfoldSeq.seq.transitions[0].shape = 'none';
const seen2 = [];
for (let t = 0; t <= unfoldSeq.totalSeconds() / 2; t += 0.05) { unfoldSeq.renderAt(t); if (seen2.at(-1) !== pane.dataset.view) seen2.push(pane.dataset.view); }
unfoldSeq.seq.transitions[0].shape = oldShape;
seen2
```
Expected: 配列に `"form"` が含まれない（`["image","chaos","image"]` のような並び）。

- [ ] **Step 7: 再生中は変わらない（確認 6）**

```js
unfoldSeq.renderAt(0); document.getElementById('seq-scrub').value = 0; unfoldSeq.seq.t = 0;
const start = pane.dataset.view;
document.getElementById('seq-play').click();
const during = new Set();
for (let i = 0; i < 70; i++) { await new Promise(r => setTimeout(r, 200)); during.add(pane.dataset.view); }
document.getElementById('seq-play').click();
({ start, during: [...during], playingNow: unfoldSeq.seq.playing, after: pane.dataset.view, chip: document.querySelector('#seq-phase .phase-chip')?.textContent ?? null })
```
Expected: `during` は `["image"]` だけ（約14秒の再生中に ぐちゃぐちゃ・立体化 を通っても変わらない）。`playingNow: false`。`after` は止めた位置の区間（チップが `ぐちゃぐちゃ` なら `chaos`、`立体化` なら `form`、チップが無ければ `image`）。

- [ ] **Step 8: ドラッグ中は変わらず、離すと反映（確認 9）**

```js
unfoldSeq.renderAt(0);
pane.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
unfoldSeq.renderAt(T(5));
const held = pane.dataset.view;
window.dispatchEvent(new PointerEvent('pointerup'));
({ held, released: pane.dataset.view })
```
Expected: `held: 'image'`、`released: 'chaos'`。

- [ ] **Step 9: 画像のクリップをクリック（確認 5）**

タイムラインの2枚目の画像クリップを `computer` でクリックする（`find` で `.tl-clip` を探して `ref` でクリック）。
Expected: プレイヘッドが2枚目へ移り、`#pane-look` の `data-view` が `image`。

- [ ] **Step 10: 見た目を目で確認する**

`computer {action: "screenshot"}` を、(a) 画像表示、(b) ぐちゃぐちゃ（`at(T(5))` のあと）、(c) 立体化（`at(T(8))` のあと）、(d) 「すべて」で撮る。
Expected: 丸の色（橙・紫）が行の先頭に揃って付いている。ボケとパルスは橙と紫の2つ。ラベルが折り返しで崩れていない。「いま：…」の表示と、画像のときだけヒントの1行がある。

- [ ] **Step 11: コンソールにエラーが無いこと**

`read_console_messages`（`onlyErrors: true`）。
Expected: 空。

- [ ] **Step 12: サーバーを止める**

`preview_stop`（`preview_start` で返った `serverId`）。

---

### Task 6: 仕上げ

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README に更新メモを足す**

old_string: `公開サイト: https://unfold-test.netlify.app/`
new_string:
```
## 2026-10-02 の更新（ローカルのみ・未公開）

- シーケンスの「04 見た目」が、プレイヘッドの位置（ぐちゃぐちゃ／立体化／画像）で効く設定だけを表示するように。橙の丸＝ぐちゃぐちゃ、紫の丸＝立体化、丸なし＝いつでも。一番上の「自動／すべて」で全部出せます。判定は `phaseOf()`、文言は `app/look-view.js`。変更前の `app/` は `archive/app-before-phase-filter-2026-10-02/`。設計書は `docs/superpowers/specs/2026-10-02-phase-filtered-look-tab-design.md`。
- 単体テスト: `node --test tools/test/look-view.test.mjs`

公開サイト: https://unfold-test.netlify.app/
```

- [ ] **Step 2: 差分が意図した範囲だけか確認する**

Run: `cd /Volumes/ORICO/UNFOLD && diff -rq archive/app-before-phase-filter-2026-10-02 app`
Expected: 次の3行だけ（`project.js` など他は出ない）:
```
Only in app: look-view.js
Files archive/app-before-phase-filter-2026-10-02/sequence.html and app/sequence.html differ
Files archive/app-before-phase-filter-2026-10-02/sequence.js and app/sequence.js differ
```

- [ ] **Step 3: 単体テストをもう一度通す**

Run: `cd /Volumes/ORICO/UNFOLD && node --test tools/test/look-view.test.mjs`
Expected: `# pass 5`、`# fail 0`。

- [ ] **Step 4: 公開について伝える**

ローカルを直しただけでは、Netlify の公開サイトは変わらない（手動デプロイ）。公開するには `app/` の中身で ZIP を作り、`unfold-test` へアップロードする。**公開は作者の判断**（この計画では行わない）。
