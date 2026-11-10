# 立体の舞台：めまいショット — 公開記録 2026-11-10

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を更新した。GLB置き場（`unfold-glb`）は変えていない（`fff7d16b` のまま）。

## サイト（`unfold`）
- 公開ソース：`a5293c2`（本体の main）。`3e26d5e` の上。
- 公開時刻の有効バージョン：`fac34920-82a5-4afb-a2c8-11aaeaf87a4a`
- 復旧先（直前の版・`dd5995d`）：`e7c0c512-47b5-41b0-8f28-71a3f3e02478`
- 公開前の照合：本番は直前の記録と 913/913 一致（`before-live-check.json`）。
- 公開ファイル：914（5 をアップロード）。追加0・変更5（`app.js`・`solid-stage.js`・`index.html`・`style.css`・`release.json`）・削除0。
- 公開後：全ファイルを plain `curl` で取得して 913/913 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-vertigo-2026-11-10/`（Git 管理外）。

## 変わったこと
「◇ 立体の舞台」に「めまいショット」（なし／寄りながら引く（背景が遠ざかる）／引きながら寄る（背景が迫る））と「めまいの強さ」を足した（`solid-stage.js` の `vertigoAt`）。
- カメラが立体に近づきながらレンズを広げる（逆も）、映画のドリーズーム。立体は手前の面にあるので大きさは変わらず、後ろの背景だけが、奥にある物として計算した大きさ（1.0〜約1.8倍）で遠ざかる・迫る。立体そのものも、近くから見た強い遠近感に変わる。
- 立体になるにつれて効きはじめ、絵が元のままの間（最初と最後）は今までと同じ。額縁の傾きや「表示比較」の遠近感より、めまいショットの遠近感が優先する。
- 背景が動くのが見えるよう、「背景のぼかし」は弱め（10〜30%）が向く。

## 検証
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 616 合格・失敗 0（めまいの向き、絵が元のままなら遠近感なし、背景はいつも画面を覆う、強さ）。
- `node tools/test/solid-stage-browser.mjs`：めまいショットを選べる、立体の間は見た目が変わる・変わり続ける、最初と最後の絵は同じ。すべて PASS。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=3e26d5e` 15 項目すべて PASS（`verify_daily.log`）。
- 公開後、本番を新しいブラウザで開き、めまいショットの3つの選択肢が並び、「寄りながら引く」で立体の間（0.5 と 0.7）の画面が 88% 変わること、ページのエラーなしを確かめた（`live-check.png`）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback e7c0c512-47b5-41b0-8f28-71a3f3e02478 --config releases/unfold-vertigo-2026-11-10/wrangler.json
```
