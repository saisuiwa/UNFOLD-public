# 額縁から飛び出す：飛び出した人物の動き — 公開記録 2026-11-09

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を更新した。GLB置き場（`unfold-glb`）は変えていない（`fff7d16b` のまま）。

## サイト（`unfold`）
- 公開ソース：`1b2b2e1`（本体の main）。`1ed6629` の上。
- 公開時刻の有効バージョン：`58528f7e-1f81-47ba-b378-ef5fefd0aef2`
- 復旧先（直前の版・`da9149d`）：`42410668-9689-4885-bdff-2aaa3b9fd620`
- 公開前の照合：本番は直前の記録と 912/912 一致（`before-live-check.json`）。
- 公開ファイル：913（4 をアップロード）。追加0・変更4（`app.js`・`frame-stage.js`・`index.html`・`release.json`）・削除0。
- 公開後：全ファイルを plain `curl` で取得して 912/912 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-person-moves-2026-11-09/`（Git 管理外）。

## 変わったこと
作者の「額縁と飛び出す絵の動きが一緒なので、逆に動いたり、ゆっくり前に出たり、少し下がったりできたら」を受けて、「飛び出す人物（切り抜き）」の箱に「飛び出した人物の動き」と 🎲 おまかせを足した（`frame-stage.js` の `PERSON_MOVES`・`personPose`）。
- 飛び出したまま（今までと同じ）
- 額縁と逆に動く：カメラの回り込みより大きく向きを変え、逆へずれる（額縁が傾かない時は、人物だけがゆっくり左右に向きを変える）
- ゆっくり前へ：時間をかけてじわじわ手前へ
- 前に出て、少し下がる：ぐっと出て、少しだけ戻る
- ふわふわ漂う：上下にゆれて、少し向きも変わる
どの動きも、絵が元のままの間（最初と最後）は人物が絵にぴったり重なる。設定は額縁の設定といっしょにこのブラウザに残る。

## 検証
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 612 合格・失敗 0（どの動きでも外に出ていない時は元の位置、逆に動く・前へ・少し下がる・漂うの向き、大きさの上限、🎲）。
- `node tools/test/frame-stage-browser.mjs`：5つの動きが並ぶ、全部で最初は絵にぴったり重なる、外に出ている間は5つとも違う、🎲。すべて PASS。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=1ed6629` 15 項目すべて PASS（`verify_daily.log`）。
- 公開後、本番を新しいブラウザで開き、作者の絵と切り抜きで、5つの動きが並び、「左右に振れる」×「額縁と逆に動く」を選べること、ページのエラーなしを確かめた（`live-check.png`）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback 42410668-9689-4885-bdff-2aaa3b9fd620 --config releases/unfold-person-moves-2026-11-09/wrangler.json
```
