# シーケンスの◆の形「人物の立体」 — 公開記録 2026-11-19

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を更新した。GLB置き場（`unfold-glb`）は変えていない。

## サイト（`unfold`）
- 公開ソース：`9a5f988`（本体の main）。`06934b6` の上。
- 公開時刻の有効バージョン：`0946551d-b85e-47ed-a356-e32d164ce9d6`
- 復旧先（直前の版・`0587c91`）：`f9105bcc-d2f0-4c22-8bd2-e53410567e03`
- 公開前の照合：本番は直前の記録と 924/924 一致（`before-live-check.json`）。
- 公開ファイル：926。追加1（`seq-person-relief.js`）・変更6（`sequence.js`・`sequence-renderer.js`・`sequence.html`・`project.js`・`studio/unfold-layer.js`・`release.json`）・削除0。
- 公開後：全ファイルを plain `curl` で取得して 925/925 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-seq-person-relief-2026-11-19/`（Git 管理外）。

## 変わったこと
作者の「シーケンスにも人物だけの立体を入れて」から、1枚モードの「人物だけを立体にする」をシーケンスの◆に入れた。
- ◆の形に「◓ 人物の立体（今の画像の人物）」。その◆の前の画像に入れた人物の切り抜きの形の中だけが立体になる（`relief-shape.js` の人物だけの浮き彫り。絵ぜんぶと同じ位置に立つ）。
- 人物を抜いた絵（`cleanPlate`）はその場に残り、次の画像は、絵が入れ替わる時にその上へ重なって出てくる（後ろの板2枚）。立体の間はカメラを引かない（背景が画面いっぱいのまま）。立体は1枚モードの浮き彫りと同じく、左右にゆっくり1往復・上下にゆるく傾く。
- この形を選ぶと「立体は前の画像のまま」がオンになる（立体は崩れるまで人物の色。途中で入れ替えると二重写しのように見えたため）。オフにもできる。
- 立体は人物だけの絵（`person-solid.js`、すき間を本人の柄で埋めた物）を映し、形ができるにつれて切り抜きの透け（ふち）を埋める（`uWhole`）。
- ◆の設定に「奥行きを作る」：前の画像の手前・奥をこのブラウザの中で推定して画像に持たせる（白黒の絵として作品に保存・取り消しで戻せる）。切り抜きが無い時は、奥行きから切り抜きも作る。奥行きがある時は「ふくらみ」のつまみ（初めは 50%）で奥行きと混ぜる。奥行きが無い時は、ふくらみだけの丸い立体。
- 切り抜きが無い間は球で見せ、◆の説明でそう知らせる。

## 分かっている限り
- 「美術館を歩く」の間は、後ろの板を出さない（額の中に元の絵が見える）。STUDIO のシーケンス層では、シルエットと同じく使えない形（`UNSUPPORTED_SHAPE`）。
- 本物の奥行き推定（Hugging Face からの読み込み）は、シーケンスではまだ流していない（確かめでは奥行きを渡した）。
- 横から大きく回すと、人物の中の段差が少し引き伸ばされる（1枚モードと同じ）。

## 検証
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 672 合格・失敗 0（新しい `seq-person-relief.test.mjs`：ふくらみの割合、揺れの時間合わせ、白黒の絵との受け渡し）。
- `node tools/test/seq-person-relief-browser.mjs`（新しい確かめ・24 項目）：形の選び方、切り抜きなしの説明、人物だけの立体、◆の前後は元の絵のまま、背景がその場に残る、崩れるまで人物の色、入れ替えのオンオフ、揺れ、カメラを引かない、奥行き・ふくらみ・取り消し・作品ファイル、奥行きから切り抜き、美術館では出さない。すべて PASS。
- まわりの確かめ：`dive-flow-browser`（19）・`person-relief-browser`（11）・`relief-browser`（21）・`sequence-look-trans-browser`（1）PASS。
- 作者の絵（BiRefNet の切り抜き・奥行き）で本物のシーケンスを動かして動画にした（`試作/2026-11-18_シーケンスの人物の立体/`、Git 管理外）。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=06934b6` 15 項目すべて PASS（`verify_daily.log`）。
- 公開後、同じ確かめを本番（https://unfold.saisuiwa.com）に向けて流し、新しい版であること・24 項目すべてと、足りないファイル・ページのエラーなしを確かめた（`live-check.png`）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback f9105bcc-d2f0-4c22-8bd2-e53410567e03 --config releases/unfold-seq-person-relief-2026-11-19/wrangler.json
```
戻した版では◆の形「人物の立体」が無くなる。その形を使って保存した作品を戻した版で開いた時の見え方は、確かめていない。
