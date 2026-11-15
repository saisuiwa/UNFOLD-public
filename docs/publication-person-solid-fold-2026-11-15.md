# 「人物のほうを立体にする」のすき間の埋め方 — 公開記録 2026-11-15

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を更新した。GLB置き場（`unfold-glb`）は変えていない（`fff7d16b` のまま）。同じ日の3回目の公開。

## サイト（`unfold`）
- 公開ソース：`9a75c08`（本体の main）。`f43a972` の上。
- 公開時刻の有効バージョン：`61b875dd-478c-4ff9-9912-d90689873bce`
- 復旧先（直前の版・`c4438c3`）：`c0ad682e-40ac-4f09-9365-25a364a2e3fc`
- 公開前の照合：本番は直前の記録と 924/924 一致（`before-live-check.json`）。
- 公開ファイル：925（4 をアップロード）。追加0・変更4（`person-solid.js`・`app.js`（`?v=` だけ）・`index.html`（`?v=` だけ）・`release.json`）・削除0。
- 公開後：全ファイルを plain `curl` で取得して 924/924 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-person-solid-fold-2026-11-15/`（Git 管理外）。

## 変わったこと
作者の「まとめ動画で、手前の人物が球になる所は『絵柄を混ぜる』をオフにしてほしい」を受けて撮り直した時に、球の半分ほどが、ぼやけた灰色になっているのが分かった（「絵柄を混ぜる」がオンだと、タイルが混ざって目立たなかった）。
- 前：人物のまわりの四角の中のすき間を、いちばん近い人物の色で埋めて、ぼかしていた。
- 今：すき間の画素ごとに、いちばん近い人物の画素を鏡にして、反対側（人物の中）の絵を持ってくる。人物の柄が、ふちで折り返して外へ続く。折り返した先に人物がいない所だけ、今までどおり色で埋めてぼかす（`person-solid.js` の `wholePicture`。`gap` は「色だけで埋めた所」になった）。
- 四角の外を鏡写しでくり返す所と、平らな間は切り抜きの形のまま見える所は、変わらない。

## 検証
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 654 合格・失敗 0（`person-solid.test.mjs` に「広い所のとなりのすき間は、ふちで折り返した柄になる」）。
- `node tools/test/person-solid-browser.mjs` 14 項目すべて PASS。
- 作者の絵で、本物の1枚モードを「絵柄を混ぜる」オフで撮り直し、球の全面に人物の柄が出るのを見た（まとめ動画の ⑥）。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=f43a972` 15 項目すべて PASS（`verify_daily.log`）。
- 公開後、本番の `index.html` を新しいブラウザで開いて確かめた（`live-check.png`）：本番の `person-solid.js` が、すき間を折り返した柄で埋める（1つ外 = 1つ内、2つ外 = 2つ内、色だけの印は付かない）。しま模様の人物を立体にすると、まん中は2色のしま（黄 50%・赤 49%）で、背景が透けて見える所は 0%、まわりの背景はそのまま（100%）。ページのエラー・足りないファイルなし。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback c0ad682e-40ac-4f09-9365-25a364a2e3fc --config releases/unfold-person-solid-fold-2026-11-15/wrangler.json
```
戻した版では、すき間は前の埋め方（ぼかした色）になる。設定はそのまま使える。
