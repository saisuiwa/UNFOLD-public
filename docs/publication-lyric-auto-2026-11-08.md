# 曲を外す・歌詞を曲に合わせる（自動）・SRTで保存・◆の速さの戻し方 — 公開記録 2026-11-08

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を更新した。GLB置き場（`unfold-glb`）は変えていない（`fff7d16b` のまま）。

## サイト（`unfold`）
- 公開ソース：`2690985`（本体の main）。`1a160ae` の上。
- 公開時刻の有効バージョン：`8da11996-d44b-4ec8-be0f-6391589763db`
- 復旧先（直前の版・`2c0d8b2`）：`7cc9848f-a284-444f-8863-b34ee1332f0f`
- 公開前の照合：本番は直前の記録と 906/906 一致（`before-live-check.json`）。
- 公開ファイル：916（25 をアップロード、890 は使い回し）。追加9・変更17・削除0。
  - 追加：`lyric-auto/` の `auto-sync.js`・`lyric-align.js`・`lyric-listen.js`・`lyric-worker.js` と `vendor/`（`transformers-4.3.2.min.js`・`ort-1.31.0-dev.wasm.min.mjs`・`ort-wasm-simd-threaded.wasm`（約14MB）・ライセンス2つ）。MOTION LAB の `site/lab` と同じ物。
  - 変更：`sequence.js`・`sequence.html`・`lyric-controls.js`・`lyric-controls.css`・`lyric-project.js`・`lyric-document.js`・`shot-motion-controls.js`・`shot-motion.css`・`_headers`（`.mjs` と `.wasm` の Content-Type）と、`?v=` を上げた `app.js`・`index.html`・`studio.html`・`lyric-studio.js`・`project.js`・`code-motion-editor.js`・`workshop-preview.js`、`release.json`。
- 公開後：全ファイルを plain `curl` で取得して 915/915 が SHA-256・Content-Type ともに一致（`_headers` を除く）。`ort-wasm-simd-threaded.wasm` は `application/wasm`、`.mjs` は `text/javascript` で届く。
- 配布物・照合記録：`releases/unfold-lyric-auto-2026-11-08/`（Git 管理外）。

## 変わったこと
1. **曲を外す**（シーケンスの「05 曲・歌詞」→「1 曲を入れる」）：曲が入っている時だけ出る。歌詞と時刻は残り、元に戻すで曲も戻る。
2. **歌詞を曲に合わせる（自動）**（「3 曲に合わせる」）：MOTION LAB と同じ、ブラウザの中の Whisper（small・8bit）で曲の歌を聞き取り、歌詞の行の開始・終了を付ける（時刻の出どころは `auto`）。間奏・アウトロの見出しは、前の行の終わりから。曲はどこにも送らない。初めての時だけ、聞き取りの仕組み（約250MB）を Hugging Face から読み込み、あとはブラウザに残る。元に戻すで前の時刻に戻る。
3. **SRTで保存（字幕ファイル）**：歌詞の行と時刻を `曲名.srt` に。時刻は曲の秒、行の中の / は字幕の改行。読み込み直すと同じ行・時刻に戻る。
4. 曲のファイルに入っている歌詞（Suno の mp3 など）を取り込んだ時・入っていなかった時のお知らせに、「自動」で時刻を付けられることを書いた。
5. **◆の速さ**：「変形の長さ（拍）」の下に、今の秒数と、ほかの◆でいちばん多い長さを出す。それより短い時はオレンジで目立たせ、「↺ 変形の長さを○拍に戻す」で戻せる（短い◆ほど速く崩れて立体になる）。
6. **立体の動きの箱**（1枚モード・シーケンス）：元の動きから変えているもの（立体の動き・回転・カメラの移動の秒とズーム）を出し、「↺ 動きを全部元に戻す」で全部戻せる。畳んだ設定の奥のカメラの移動に気づきにくかったため。

## 検証
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 625 合格・失敗 0（MOTION LAB の時刻合わせのテスト15個を `tools/test/lyric-auto-align.test.mjs` として足した）。
- `node tools/test/lyric-song-tools-browser.mjs`（新しいブラウザの確かめ）：Suno の mp3 の歌詞14行が入る、曲を外す・元に戻す、自動の結果が行に入る（元に戻すで戻る）、SRT の保存と読み直し、◆の「変えているもの」と全部戻す、短い◆の秒数と戻す。すべて PASS。`node tools/test/omakase-button-browser.mjs` も PASS。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=1a160ae` 15 項目すべて PASS（`verify_daily.log`）。
- 本物の聞き取り：手元と本番（`https://unfold.saisuiwa.com/sequence.html`）の両方で、新しいブラウザに Suno の「夜のホーム」を入れて自動ボタンを押し、14行すべてが合った（聞き取り 41〜43 秒、ページのエラーなし、`live-check.png`）。Suno 自身の時刻（SRT）とのずれは、真ん中 0.14 秒・いちばん大きくて 0.49 秒。
- Wrangler の dry-run：935 を読み込み（916 ファイル + 19 フォルダ）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback 7cc9848f-a284-444f-8863-b34ee1332f0f --config releases/unfold-lyric-auto-2026-11-08/wrangler.json
```
戻した版では、自動で付けた時刻（出どころ `auto`）は「なし」として読まれるが、時刻そのものは残る。
