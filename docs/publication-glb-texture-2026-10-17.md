# GLBのテクスチャをUVで直接貼る・なめらかな陰影 — 公開記録 2026-10-17

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の依頼（Tripo で作ったテクスチャ付きGLBが、UNFOLDではきれいな色にならない）で直して、既存の Cloudflare Worker `unfold` を更新した。

- 公開ソース：`3c6be08`（本体の main）。
- 公開時刻の有効バージョン：`c23397f2-9d9e-425e-80e1-498a05baba5b`
- 復旧先（直前の版・`58968a7`）：`0c0cba8d-9def-433d-86a7-ff4f9a5d09c9`
- 公開ファイル：24（変更24、追加・削除0。モジュールの `?v=` 上げを含む）。公開前に直前の本番 717/717 の SHA-256 一致を確認、公開後も 717/717 が SHA-256・Content-Type ともに一致（`/release.json` は `3c6be08`）。
- 配布物・照合記録：`releases/unfold-glb-texture-2026-10-17/`。このフォルダは Git 管理外。

## 原因
テクスチャを頂点ごとの色に置き換えていた。作者のモデルは約3.1万面・2048pxのテクスチャで、色の情報が約150分の1になり、模様が三角形の形ににじんでいた。陰影も三角形ごとでカクカクしていた。

## 変わったこと
1. ベースカラーテクスチャを、シェーダーがUVで直接読む（`uModelTex`・`modelUv`）。1枚ならそのまま（最大4096px、GLBの繰り返し設定どおり）、複数枚なら4096pxの1枚に並べる。頂点ごとには基本色×頂点カラーだけ。
2. GLBのなめらかな法線で陰影（`modelNormal`・`modelNormalAt`、立体にまとまるにつれて切り替わる）。
3. `model-layout.js` は追加の値を `opts.extras` で運び、三角形を平らな配列で持つ。拡張なしの結果は前と完全に同じ（`model-layout-ordered.test.mjs`）。100万面で約0.9秒→約0.3秒。

## 検証
- `node --test`（tools/test 以下）560/560。
- 手元のブラウザ：作者のアニメモデル（1枚モードで立体化、シーケンス）、写真と50%、テスト用GLB（テクスチャ・基本色・頂点カラー）、標準の形（ドーナツ）、組み込みの球（写真のまま）。コンソールエラーなし。
- 公開後の本番：カラー見本（テクスチャのビーチボール）の縞がくっきり。コンソールエラーなし。STUDIO の画面での描画は未確認（共通の `sequence-renderer.js` で、テクスチャを渡す処理を追加済み）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback 0c0cba8d-9def-433d-86a7-ff4f9a5d09c9 --config releases/unfold-glb-texture-2026-10-17/wrangler.json
```
