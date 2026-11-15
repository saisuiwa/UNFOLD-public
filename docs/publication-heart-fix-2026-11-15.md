# ハートの形の修正 — 公開記録 2026-11-15

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を更新した。GLB置き場（`unfold-glb`）は変えていない（`fff7d16b` のまま）。同じ日の4回目の公開。

## サイト（`unfold`）
- 公開ソース：`2d51965`（本体の main）。`8849c48` の上。
- 公開時刻の有効バージョン：`6a6dcde4-c456-4df9-a3d4-08a35341bb26`
- 復旧先（直前の版・`9a75c08`）：`61b875dd-478c-4ff9-9912-d90689873bce`
- 公開前の照合：本番は直前の記録と 924/924 一致（`before-live-check.json`）。
- 公開ファイル：925（13 をアップロード）。追加0・変更13・削除0。中身が変わったのは `shape-target.js`・`vendor/image-method-worker.js`（作り直し）・`motion.js`（読み込みに `?v=2`）・`release.json`。残り（`app.js`・`index.html`・`effects.js`・`image-method-editor.js`・`sequence-renderer.js`・`sequence.js`・`sequence.html`・`studio/unfold-layer.js`・`workshop-preview.js`）は読み込みの `?v=` だけ。
- 公開後：全ファイルを plain `curl` で取得して 924/924 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-heart-fix-2026-11-15/`（Git 管理外）。

## 変わったこと
紹介動画を撮り直している時に、作者が「ハートが❤️になっていない」と気づいた。調べると、組み込みの形「ハート」の式が `16.*pow(sin(a),3.)` だった。GLSL の `pow(x, y)` は x がマイナスの時の結果が決まっていないので、GPU によってはハートの左半分（`sin(a)` がマイナスの側）が描かれない。
- 確かめに使うブラウザ（ソフトで描く SwiftShader）では、左半分が消えていた。
- 作者の Mac の GPU（ANGLE Metal、Apple M4）では、もともと両側とも出ていた（`--use-angle=metal` で確かめた）。
- 式を `float sa=sin(a); … 16.*sa*sa*sa` に直した。どの GPU でも同じ結果になる。見た目は、今まで正しく出ていた GPU では変わらない。
- 同じ式を使う、JavaScript の画像メソッドのワーカー（`vendor/image-method-worker.js`）も作り直した。
- `motion.js` の `shape-target.js` の読み込みに `?v=2` を付けた（今まで番号が無く、古い物がブラウザに残るおそれがあった）。

## 検証
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 656 合格・失敗 0（新しい `shape-target.test.mjs`：形の式で、マイナスになりうる値を `pow` に渡していない／ハートは左右が鏡写し）。
- 直す前後を、ソフトで描くブラウザの1枚モードで撮って見比べた（前：右半分だけ、後：ハート全体）。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=8849c48` 15 項目すべて PASS（`verify_daily.log`）。
- 公開後、本番の `index.html` を、左半分が消えていた方式のブラウザ（SwiftShader）で開いて確かめた（`live-check.png`）：ハートの明るい画素は左 6944・右 7074 で両側そろう（星は 5145・5207、球は 8128・7948）。本番の `shape-target.js` とワーカーに `pow(sin` は残っていない。`sequence.html` も開く。ページのエラー・足りないファイルなし。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback 61b875dd-478c-4ff9-9912-d90689873bce --config releases/unfold-heart-fix-2026-11-15/wrangler.json
```
戻した版では、ハートの式が前の物に戻る（GPU によっては左半分が出ない）。
