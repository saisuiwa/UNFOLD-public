# 1枚モード「立体化する」の直しと、描画が止まった時のお知らせ — 公開記録 2026-11-09

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を更新した。GLB置き場（`unfold-glb`）は変えていない（`fff7d16b` のまま）。

## サイト（`unfold`）
- 公開ソース：`da9149d`（本体の main）。`ba782f2` の上。
- 公開時刻の有効バージョン：`42410668-9689-4885-bdff-2aaa3b9fd620`
- 復旧先（直前の版・`ef21292`）：`ebf771a2-2405-4cbc-ba99-1dbe5908e162`
- 公開前の照合：本番は直前の記録と 912/912 一致（`before-live-check.json`）。
- 公開ファイル：913（4 をアップロード）。追加0・変更4（`app.js`・`index.html`・`style.css`・`release.json`）・削除0。
- 公開後：全ファイルを plain `curl` で取得して 912/912 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-no-solid-2026-11-09/`（Git 管理外）。

## 何があったか
作者が1枚モードで、立体化を飛ばして絵だけで遊ぼうと「立体化する」のチェックを外したら、画面が真っ暗になり、チェックもどこにあるか分からなくなった。
- チェックは JavaScript の画像メソッドを選んだ時だけ出る作りで、しかも崩れ方を一度選ぶまで作られていなかった。外したまま普通の崩れ方（シュレッダーなど）に変えると、チェックが見えなくなっていた。
- 真っ暗は、作者と同じ設定（遠近感 0.75・網点・プッシュイン・シェイク・色収差・シュレッダー）でも手元では再現しなかった。いちばん疑わしいのは Chrome の GPU が止まったこと（止まると画面は黒いままで、お知らせが出なかった）。以前も Chrome の再起動で直った例がある。

## 変わったこと
1. 「立体化する」は、ページを開いた時から「03 立体」タブのいちばん上に出る。どの崩れ方でも出て、外したままでも消えない。
2. 普通の崩れ方（GLSL）でも外せる。外すと、立体にならずに崩れたまま漂い、元の絵に戻る（真ん中の札は「03 / 崩れたまま」）。JavaScript の画像メソッドは今までどおり「コード演出」。
3. 描画が止まった（WebGL の描画が失われた）時は、画面に「描画が止まりました…」と「ページを開き直す」ボタンを出す。

## 検証
- `node tools/test/single-no-solid-browser.mjs`（新しいブラウザの確かめ）：チェックが最初から出る、シュレッダーで外しても出たまま、外すと真ん中は立体でなく真っ暗でもない、最後は元の絵と同じ（0.00%）、札が「崩れたまま」、崩れ方を変えても出たまま、付け直すと同じ立体（0.00%）、描画をわざと止めるとお知らせとボタン。すべて PASS。`frame-stage-browser.mjs`・`omakase-button-browser.mjs` も PASS。
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 610 合格・失敗 0。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=ba782f2` 15 項目すべて PASS（`verify_daily.log`）。
- 公開後、本番を新しいブラウザで開き、チェックが最初から出る、シュレッダーで外すと「03 / 崩れたまま」で絵が見える（28% が明るい）、チェックは出たまま、ページのエラーなしを確かめた（`live-check.png`）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback ebf771a2-2405-4cbc-ba99-1dbe5908e162 --config releases/unfold-no-solid-2026-11-09/wrangler.json
```
