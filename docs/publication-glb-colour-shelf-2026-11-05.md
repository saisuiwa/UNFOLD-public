# GLB置き場をカラー版に — 公開記録 2026-11-05

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の OK（「置き場も差し替えて」）を受けて、GLB置き場の Worker `unfold-glb`（`glb.saisuiwa.com`）と、サイトの Worker `unfold` を更新した。

## GLB置き場（`unfold-glb`）
- 置いたもの：`models/tripo-publish-color/`（94個の GLB + `manifest.json` + `_headers`、約649MB、いちばん大きいファイル 8.4MB）。前の灰色の版は `models/tripo-publish/` に残してある。どちらも Git 管理外。
- 94個とも、Tripo で元のモデルに 2K のテクスチャをつけたもの（猫だけは、Tripo に元のモデルが残っていなかったので、置き場の GLB を上げ直してテクスチャをつけ、Tripo が回した向きと大きさを元に戻した）。面の数と大きさ（バウンディングボックス）は、94個すべて元の GLB と同じ。
- 公開時刻の有効バージョン：`fff7d16b-6f81-4316-b4a1-cdb8caa91eb3`
- 復旧先（直前の版・2026-10-03 にダッシュボードから置いた灰色の版）：`bfc88255-ce59-4683-ab19-8339b8c9e868`
- 公開前の照合：本番は `models/tripo-publish/` と 95/95 一致（`before-live-check.json`）。
- dry-run：96ファイル（追加0・変更95・削除0、`_headers` は同じ）。
- 公開後：全ファイルを plain `curl` で取得して 95/95 が SHA-256 一致、`Access-Control-Allow-Origin: *`、`.glb` は `model/gltf-binary`（`after-live-check.json`）。
- 今回から、置き場も Wrangler で出した（`releases/unfold-glb-colour-shelf-2026-11-05/wrangler.json`。`assets.directory` は `models/tripo-publish-color` を直接指す）。

## サイト（`unfold`）
- 公開ソース：`2045851`（本体の main）。`3ad8624` の上。
- 公開時刻の有効バージョン：`5777f43d-5986-4bf3-b7a2-c2abf238c707`
- 復旧先（直前の版・`9abc0a0`）：`72e66e0e-3ee9-4580-89d4-09edc750ebe1`
- 公開前の照合：本番は直前の記録と 906/906 一致（`before-live-check.json`）。
- 公開ファイル：907（98 をアップロード、808 は使い回し）。追加0・変更98・削除0。変更は、`guide/glb.html`・`guide/glb.js`・`guide/glb-catalog.json`・`release.json` と、カラーのサムネ94枚（`guide/thumbs/*.webp`。Git 管理外なので、`app/guide/thumbs/` から配布物に入れた）。
- 公開後：全ファイルを plain `curl` で取得して 906/906 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-glb-colour-site-2026-11-05/`（Git 管理外）。

## 変わったこと
1. GLB置き場の94個が、色（テクスチャ）つきになった。形は前と同じ。UNFOLD の「GLBの色（写真と混ぜる）」で、写真の色と混ぜたり、写真の色だけにしたりできる。
2. 説明ページ（`/guide/glb.html`）の文を「色（テクスチャ）つき」にし、サムネをカラーに、サイズ表示を新しいファイルに合わせた。
3. 「UNFOLDに追加」で GLB を取るときに `?v=colour` を付けた（置き場は1日キャッシュするので、前に取った灰色の版をブラウザが使い回さないように。置き場は `?` 以降を見ない）。
4. すでに「UNFOLDに追加」した人の手元の形は、灰色のまま（ブラウザに保存された物なので）。新しい色の形にするには、追加した形を削除してから、もう一度追加する。

## 検証
- 94個すべてを UNFOLD の1枚モード（`app/index.html`）で読み込み、「GLBの色」100% で色が出ること、ページのエラーがないことを確かめた（`models/tripo/テクスチャ付き/一覧_UNFOLDで確認.png`）。
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 609 合格・失敗 0。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=9abc0a0` 15 項目すべて PASS。
- 公開後、本番の `https://unfold.saisuiwa.com/guide/glb.html` からペンギンを「UNFOLDに追加」→ 1枚モードで色つきで出ることを確かめた（`live-check.jpg`。取りに行った URL は `https://glb.saisuiwa.com/animal/penguin.glb?v=colour`）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback bfc88255-ce59-4683-ab19-8339b8c9e868 --config releases/unfold-glb-colour-shelf-2026-11-05/wrangler.json
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback 72e66e0e-3ee9-4580-89d4-09edc750ebe1 --config releases/unfold-glb-colour-site-2026-11-05/wrangler.json
```
置き場だけ戻すと、説明ページは「色つき」と書いたまま灰色の GLB を配ることになるので、戻すときは両方戻す。
