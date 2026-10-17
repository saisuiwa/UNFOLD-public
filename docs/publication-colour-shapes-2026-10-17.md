# GLBを100MBまで・GLBの色・色つきの標準の形17種 — 公開記録 2026-10-17

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の依頼（「プッシュして公開して」）で、既存の Cloudflare Worker `unfold` を更新した。

- 公開ソース：`009e487`（本体の main）。
- 公開時刻の有効バージョン：`cd33bda6-724a-43c8-ba05-4a70fbb193b1`
- 復旧先（直前の版・`c99e262`）：`955f1d37-d2c3-4ac4-9117-765731c91412`
- 公開ファイル：43（追加18・変更25・削除0、約6.7MB。追加は GLB 17個と `colour-shapes.js`）。公開前に直前の本番 699/699 の SHA-256 一致を確認、公開後は 717/717 が SHA-256・Content-Type ともに一致（`/release.json` は `009e487`）。
- 配布物・照合記録：`releases/unfold-colour-shapes-2026-10-17/`（`dry-run-list.json`、`manifest.json`、`published-delivery.json`、`deploy.log`）。このフォルダは Git 管理外。

## 変わったこと
1. GLB の上限を 50MB → 100MB（1枚モード・シーケンス・GLB置き場）。
2. GLB の色（基本色×埋め込みテクスチャ×頂点カラー）を角ごとに読み、「GLBの色（写真と混ぜる）」スライダーで、立体になるにつれて写真と混ぜる。シーケンスは `seq.modelColor`（新しい作品は100%、前の作品は0%で開く）。
3. 色つきの標準の形17種（`app/colour-shapes.js`、`app/assets/models/*.glb`）。1枚モードの「03 立体にする」の形ボタン、シーケンスの形メニュー、STUDIO。名前と記号はその形の色。
4. 画面いっぱいの GLB（`asset.extras.unfold.fit = "frame"`）。紙吹雪・ハート吹雪は立体化中も引かない。
5. GLB の生成スクリプト `tools/make_colour_samples.py`・`tools/make_colour_sample_glb.py`。

## 検証
- `node --test`（tools/test 以下の79ファイル）560/560。
- 手元のブラウザ（アプリ内）：1枚モードとシーケンスで、テスト用GLB（テクスチャ・基本色・頂点カラー）、70MB のGLB、色の強さ 0/50/100%、組み込みの球が染まらないこと、17種のボタンと形メニュー、紙吹雪・ハート吹雪が画面いっぱいになること。コンソールエラーなし。
- 公開後の本番：17種のボタン、紙吹雪を選んで画面いっぱいに描けること、コンソールエラーなし。STUDIO の画面での描画は未確認（描画は共通の `sequence-renderer.js`、形の対応チェックに追加済み）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback 955f1d37-d2c3-4ac4-9117-765731c91412 --config releases/unfold-colour-shapes-2026-10-17/wrangler.json
```
