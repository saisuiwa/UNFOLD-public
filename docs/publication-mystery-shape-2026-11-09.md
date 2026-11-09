# 「絵柄を混ぜる」を 03 立体タブにも — 公開記録 2026-11-09

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を更新した。GLB置き場（`unfold-glb`）は変えていない（`fff7d16b` のまま）。

## サイト（`unfold`）
- 公開ソース：`dd5995d`（本体の main）。`fbfb602` の上。
- 公開時刻の有効バージョン：`e7c0c512-47b5-41b0-8f28-71a3f3e02478`
- 復旧先（直前の版・`3763776`）：`c818d566-ba8e-47be-b6a7-59b0eba3aa5e`
- 公開前の照合：本番は直前の記録と 913/913 一致（`before-live-check.json`）。
- 公開ファイル：914（3 をアップロード）。追加0・変更3（`app.js`・`index.html`・`release.json`）・削除0。
- 公開後：全ファイルを plain `curl` で取得して 913/913 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-mystery-shape-2026-11-09/`（Git 管理外）。

## 何があったか・変わったこと
作者が、試作の「絵がそのまま球に貼られた」見た目は UNFOLD でできるかと聞いた。できる：球などの形は絵を地球儀のように巻く作りで、市松模様に見えていたのは、はじめからオンの「絵柄を混ぜて、最後に見せる」（崩れている間と立体の間、絵を 16×16 の欠片に分けて混ぜる）のため。このチェックは「動画保存」タブの奥にあって見つけにくかったので、作者の希望で「03 立体にする」の見出しのすぐ下にも「絵柄を混ぜる（オフ：絵をそのまま立体に貼る）」を出した。2つは連動する（どちらで切り替えても同じ）。JavaScript の画像メソッドの時は、元のチェックと同じく使えない。

## 検証
- `node tools/test/mystery-shape-browser.mjs`（新しいブラウザの確かめ）：最初は両方オン、03 で外すと動画保存側も外れる・その逆、オフで立体に絵がそのまま貼られる、最初と最後の絵はどちらでも同じ。すべて PASS。`frame-stage-browser.mjs`・`single-no-solid-browser.mjs`・`solid-stage-browser.mjs` も PASS。
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 615 合格・失敗 0。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=fbfb602`：1回目は「メソッド工房」と「エディタの一覧（シーケンスのページを開く）」の2つが時間切れ（パソコンが混んでいた。今回変えた1枚モードとは関係しない。`verify_daily-first-run.log`）。決まりどおり1回だけ流し直して 15 項目すべて PASS（`verify_daily.log`）。
- 公開後、本番を新しいブラウザで開き、03 立体のチェックを外すと動画保存側も外れること、ページのエラーなしを確かめた（`live-check.png`）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback c818d566-ba8e-47be-b6a7-59b0eba3aa5e --config releases/unfold-mystery-shape-2026-11-09/wrangler.json
```
