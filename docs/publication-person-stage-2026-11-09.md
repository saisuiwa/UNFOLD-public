# 人物を残して背景が崩れる・立体の舞台 — 公開記録 2026-11-09

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を更新した。GLB置き場（`unfold-glb`）は変えていない（`fff7d16b` のまま）。

## サイト（`unfold`）
- 公開ソース：`3763776`（本体の main）。`14da963` の上。
- 公開時刻の有効バージョン：`c818d566-ba8e-47be-b6a7-59b0eba3aa5e`
- 復旧先（直前の版・`034e280`）：`8133ffd7-3ad1-4498-8df5-1fdbbf49d210`
- 公開前の照合：45 秒の制限では大きい3つ（`lyric-auto/vendor/ort-wasm-simd-threaded.wasm`・`vendor/image-method-worker.js`・`vendor/motion-fonts/gothic.ttf`）が取り切れず時間切れになった（通信が遅かった。中身の違いではない）。この3つを 300 秒で取り直して一致し、本番は直前の記録と 912/912 一致（`before-live-check.json`・`before-live-check-retry.json`）。
- 公開ファイル：914（5 をアップロード）。追加1（`solid-stage.js`）・変更4（`app.js`・`frame-stage.js`・`index.html`・`release.json`）・削除0。
- 公開後：取る時間の上限を 240 秒にした `verify_delivery.py` で、1回目は `app.js` だけ前の版（反映待ち）、1分おいた2回目で全ファイル 913/913 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-person-stage-2026-11-09/`（Git 管理外）。

## 変わったこと
1. **人物（切り抜き）を独立**：「03 立体」タブに「◇ 人物（切り抜き）」。額縁がオフでも切り抜きを入れられる（前は額縁の中の設定で、入れると額縁がオンになった）。
2. **人物を残して背景が崩れる**：額縁なしで切り抜きを入れると、人物はその場に絵の大きさのまま残り（ほんの少しだけ息づく）、まわりの背景だけが崩れて人物の後ろで立体になる。人物を残す間はカメラが引かない（引くと人物も小さくなり、立体が人物に隠れた）。額縁ありでは今までどおり飛び出し、人物の動きに「その場に残る」も足した。
3. **人物のいない背景で崩す**（はじめはオン）：切り抜きの所を左右の色でつないで埋めた絵（`frame-stage.js` の `cleanPlate`）で崩すので、崩れていく絵に人物の分身が残らない。絵が元のままの間（最初と最後）は本物の絵。
4. **立体の舞台**（`solid-stage.js`、「◇ 立体の舞台（背景・床・影）」）：立体になっている間だけ、後ろにぼかした絵（絵／人物のいない背景／背景色のまま）、下に奥へ続く床と接地の影。背景のぼかしと、床と影のオン・オフ。最初と最後の絵は今までと同じ。JavaScript の画像メソッドでも出る（額縁と同じく、ワーカーが透明な背景で描く）。設定はこのブラウザに残る（`unfold-single-stage`）。

## 検証
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 615 合格・失敗 0（`solid-stage.test.mjs`、`frame-stage.test.mjs` に「その場に残る」）。
- `node tools/test/frame-stage-browser.mjs`：切り抜きは額縁なしでも残り、その箱は額縁の外、人物はその場（赤い体の位置が 0.517）、人物のいない背景で崩すと後ろの赤い欠片が減る（4115 → 2684）、最後は本物の絵。すべて PASS。
- `node tools/test/solid-stage-browser.mjs`（新しいブラウザの確かめ）：オフは今までどおり、オンで最初と最後は同じ（0.00%）、立体の間は背景で四隅が埋まる（無地 0%）、背景色のまま、床のオン・オフ、JavaScript の画像メソッドでも出る、オフに戻すと同じ。すべて PASS。`single-no-solid-browser.mjs`・`omakase-button-browser.mjs` も PASS。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=14da963` 15 項目すべて PASS（`verify_daily.log`）。
- 公開後、本番を新しいブラウザで開き、作者の絵と切り抜きで、額縁なしのまま人物が残り（額縁はオフのまま）、「人物のいない背景をぼかして」の舞台の前で「ばらばら」×「土星」の輪が人物のまわりに出ること、「03 立体」タブの並び（立体にする・立体の舞台・人物・額縁）、ページのエラーなしを確かめた（`live-check.png`）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback 8133ffd7-3ad1-4498-8df5-1fdbbf49d210 --config releases/unfold-person-stage-2026-11-09/wrangler.json
```
