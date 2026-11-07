# 透過の画像でもGLBの色つき立体に穴が空かない — 公開記録 2026-11-07

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を更新した。GLB置き場（`unfold-glb`）は変えていない（`fff7d16b` のまま）。

## サイト（`unfold`）
- 公開ソース：`666f357`（本体の main）。`a60e4cf` の上。
- 公開時刻の有効バージョン：`a34856b2-e4d3-45aa-a460-b705bdeb3cc1`
- 復旧先（直前の版・`aeb7476`）：`b5512e3f-3556-44cb-9844-de30e5554ed4`
- 公開前の照合：本番は直前の記録と 906/906 一致（`before-live-check.json`）。
- 公開ファイル：907（14 をアップロード、892 は使い回し）。追加0・変更14・削除0。変更は `motion.js`・`image-method-solid.js`・`vendor/image-method-worker.js`（作り直し）と、`?v=` を上げた `app.js`・`effects.js`・`image-method-editor.js`・`image-method-runtime.js`・`index.html`・`sequence-renderer.js`・`sequence.html`・`sequence.js`・`studio/unfold-layer.js`・`workshop-preview.js`、`release.json`。
- 公開後：全ファイルを plain `curl` で取得して 906/906 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-glb-cutout-2026-11-07/`（Git 管理外。前の配布物から組み立てた）。

## 変わったこと
1. 背景を抜いた（透過の）画像で GLB の立体を色つきにすると、画像の透明な所がそのまま立体の穴になり、ボロボロに見えていた。GLB の色は画像の色を置き換えるのに、透け具合だけは画像のままだったため。
2. 「GLBの色」の割合だけ、点を不透明にするようにした（`motion.js` の `particleLook`、JS画像メソッドの立体は `image-method-solid.js`）。100% なら透過の画像でも穴が無く、下げると下げた分だけ画像の透け具合に戻る。
3. GLB を使っていない時、「GLBの色」0% の時、平らな写真の時の見た目は変わらない。

## 検証
- `node tools/test/glb-colour-cutout-browser.mjs`（新しいブラウザの確かめ。色つきの GLB を入れ、同じ大きさの透過の画像と背景ありの画像で立体の画素数を比べる）：透過 20008・背景あり 20008 で PASS（直す前は 17824 対 20008）。
- `node tools/test/image-solid-colour-browser.mjs` PASS（0% は前と同じ）。
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 609 合格・失敗 0。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs`：1回目は「GLSL samples」の `method-line-tangle` の重さが上限ちょうど（約4.0倍）で落ちた（`verify_daily-first-run.log`。今回の変更と関係のない、パソコンの混み具合）。決まりどおり1回だけ流し直して 15 項目すべて PASS（`verify_daily.log`）。
- Wrangler の dry-run：924 を読み込み（907 ファイル + 17 フォルダ、前回と同じ）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback b5512e3f-3556-44cb-9844-de30e5554ed4 --config releases/unfold-glb-cutout-2026-11-07/wrangler.json
```
置き場（`unfold-glb`）は今回変えていないので、戻すのはサイトだけでよい。
