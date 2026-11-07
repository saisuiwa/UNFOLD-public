# 立体の動き12個追加・「🎲 崩れ方と形をおまかせ」 — 公開記録 2026-11-08

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を2回更新した（1回目のあと、本番の確かめでボタンのホバー色の間違いが見つかったので、直して出し直した）。GLB置き場（`unfold-glb`）は変えていない（`fff7d16b` のまま）。

## サイト（`unfold`）
- 公開ソース：`2c0d8b2`（本体の main）。`979a9b0`（本体）→ `2c0d8b2`（ホバー色）の順。`29cc73b` の上。
- 公開時刻の有効バージョン：`7cc9848f-a284-444f-8863-b34ee1332f0f`
- 途中の版（`979a9b0`）：`71f3bd32-217b-4f8b-8258-fda0c92be5da`
- 復旧先（この記録の前の版・`666f357`）：`a34856b2-e4d3-45aa-a460-b705bdeb3cc1`
- 公開前の照合：本番は直前の記録と 906/906 一致（`releases/unfold-solid-motions-2026-11-08/before-live-check.json`）。
- 1回目：公開ファイル 907（11 をアップロード）。追加0・変更11・削除0。変更は `solid-motion.js`・`app.js`・`index.html`・`style.css`・`sequence.html` と、`?v=` を上げた `sequence.js`・`sequence-renderer.js`・`shot-motion.js`・`shot-motion-controls.js`・`studio/unfold-layer.js`、`release.json`。
- 2回目：公開ファイル 907（3 をアップロード）。追加0・変更3・削除0（`style.css`・`index.html`・`release.json`）。
- 公開後：どちらも全ファイルを plain `curl` で取得して 906/906 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-solid-motions-2026-11-08/` と `releases/unfold-solid-motions-2026-11-08-2/`（Git 管理外）。

## 変わったこと
1. 「立体の動き」に12個を追加して25個にした（`solid-motion.js`）：ぐらぐら・うなずく・おじぎ・首をかしげる・ノリノリ・のびちぢみ・ドスン・いないいないばあ・すいすい泳ぐ・ぐるっと回り込む・ころころ転がる・カクッとずれる。どれも休みの姿勢のまわりで動き、繰り返しのつなぎ目でも飛ばない。
2. 🎲 で形に合う動きとして選ばれやすい組み合わせを足した（人＝うなずく・おじぎ・首をかしげる・ノリノリ、おばけ＝いないいないばあ、かぼちゃ＝ドスン、球・りんご・ドーナツ＝ころころ転がる など）。
3. 「🎲 崩れ方と形をおまかせ」を、1枚モード・シーケンスとも「02 ぐちゃぐちゃにする」のすぐ下に、黄緑の大きなボタンで置いた。1枚モードには新しく足した（押すたびに標準の崩れ方と、標準・色つき・自分で足した形から、今と違うものを選ぶ）。シーケンスは前からのボタンを移して色をつけた（中身は同じ）。
4. 2回目：1枚モードではページ全体の「ボタンにマウスが乗ったら灰色」が勝って、押した直後のボタンが灰色に見えていた。乗った時も明るい黄緑にした。

## 検証
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 610 合格・失敗 0（新しい12個がつなぎ目で飛ばないかの確かめを足した）。
- `node tools/test/omakase-button-browser.mjs`（新しいブラウザの確かめ）：両方のページでボタンが02のすぐ下・黄緑（マウスを乗せても）、1枚モードで6回押して毎回別の崩れ方と形、新しい12個がどれも立体を動かす、ページのエラーなし。すべて PASS。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=29cc73b`（1回目の前）15 項目すべて PASS（`verify_daily.log`）。2回目は CSS の色だけなので、単体テストと上のブラウザの確かめで済ませた。
- Wrangler の dry-run：どちらも 924 を読み込み（907 ファイル + 17 フォルダ）。
- 公開後、本番の `https://unfold.saisuiwa.com/` と `/sequence.html` を新しいブラウザで開き、ボタンの文字と色、1枚モードで押すと崩れ方と形が変わること、立体の動きが25個並ぶこと、ページのエラーなしを確かめた（`live-single.png`）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback a34856b2-e4d3-45aa-a460-b705bdeb3cc1 --config releases/unfold-solid-motions-2026-11-08-2/wrangler.json
```
保存した作品に新しい動き（例 `nod`）が入っていると、戻した版では「なし」として開く（壊れはしない）。
