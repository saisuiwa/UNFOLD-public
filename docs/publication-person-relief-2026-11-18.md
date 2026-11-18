# 写真の浮き彫り「人物だけを立体にする」 — 公開記録 2026-11-18

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を更新した。GLB置き場（`unfold-glb`）は変えていない。

## サイト（`unfold`）
- 公開ソース：`0587c91`（本体の main）。`4b1a70c` の上。
- 公開時刻の有効バージョン：`f9105bcc-d2f0-4c22-8bd2-e53410567e03`
- 復旧先（直前の版・`ee6f027`）：`61bd15d5-6202-4639-8f2d-bdd0cde36df0`
- 公開前の照合：本番は直前の記録と 924/924 一致（`before-live-check.json`）。
- 公開ファイル：925（4 をアップロード）。追加0・変更4（`relief-shape.js`・`app.js`・`index.html`・`release.json`）・削除0。
- 公開後：全ファイルを plain `curl` で取得して 924/924 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-person-relief-2026-11-18/`（Git 管理外）。

## 変わったこと
作者の「人物の立体化の精度を上げたい」から、試作（`試作/2026-11-18_人物の形の立体/`、Git 管理外）で4通りを見比べ、作者が選んだ「奥行き＋ふくらみ＋光」を1枚モードに入れた。
- 03 立体 →「写真の浮き彫り」を作った後の設定に「人物だけを立体にする（人物の形・ふくらみ・光）」と「ふくらみ」（0〜100%、初めは 50%）。
- オンにすると、切り抜いた人物の形の中だけで浮き彫りを作る（`relief-shape.js` の `createReliefShape(..., {mask, puff})`）。高さは、人物の中で 0〜1 に広げた奥行きと、ふちから中へ丸く立ち上がる「ふくらみ」（ふちにも 0.3 の厚みを残す）を混ぜた物。人物の形の外にはマスを作らない（ふちはスパッと切れる）。人物の中のマスが約 42,000 になるよう、格子を細かくする（上限 110,000）。
- 絵のふちで切れている体は、そこを人物のふちとしない（細くならない）。
- 「人物のほうを立体にする」を自動でオンにする（人物のいない背景はその場に残る）。切り抜きが無い時は、奥行きから自動で作る。どちらも、オフに戻した時に一緒に元に戻す。切り抜きを入れ替えると、作り直す。
- 光は、今までの立体の光がそのまま当たる。「立体の舞台」とも合わせられる。

## 分かっている限り
- 横から大きく回すと、人物の中の段差（ホースと体の間など）が少し引き伸ばされる。
- 1枚モードだけ。シーケンスには無い。設定は作品に保存しない（浮き彫りと同じく絵ごと）。

## 検証
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 669 合格・失敗 0（`relief-shape.test.mjs` に、中からの距離と外の埋め方、人物の高さ（ふちの厚み・ふくらみ・混ぜ方）、人物の形だけの浮き彫り）。
- `node tools/test/person-relief-browser.mjs`（新しい確かめ・10 項目）：最初は絵ぜんぶの浮き彫り、オンで人物の中だけ・役目の入れ替え・奥行きから切り抜き、変化の前の絵はそのまま、背景がその場に残る、人物の立体が人物の側に立つ、ふくらみで作り直す、オフで元どおり。すべて PASS。
- まわりの確かめ：`relief-browser`（21）・`person-solid-browser`（14）・`depth-cutout-browser`（26）・`single-no-solid-browser`（11）PASS。`frame-stage-browser` は「🎲 で別の動きを選ぶ」が1回だけ外れ（ランダムで選ぶ所）、流し直して 59 項目すべて PASS。
- 作者の絵2枚（BiRefNet の切り抜き）で、本物の1枚モードを動かして動画にした。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=4b1a70c` 15 項目すべて PASS（`verify_daily.log`）。
- 公開後、同じ `person-relief-browser` の確かめを本番（https://unfold.saisuiwa.com）に向けて流し、新しい版であること・12 項目すべてと、足りないファイル・ページのエラーなしを確かめた（`live-check.png`）。奥行きは確かめから渡した（推定の仕組みは読み込んでいない）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback 61bd15d5-6202-4639-8f2d-bdd0cde36df0 --config releases/unfold-person-relief-2026-11-18/wrangler.json
```
戻した版では、「人物だけを立体にする」の設定が無くなる（浮き彫りは絵ぜんぶで作られる）。
