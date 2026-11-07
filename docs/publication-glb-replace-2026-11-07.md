# GLB置き場「色つきに入れ替え」 — 公開記録 2026-11-07

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を更新した。GLB置き場（`unfold-glb`）は変えていない（`fff7d16b` のまま）。

## サイト（`unfold`）
- 公開ソース：`aeb7476`（本体の main）。`22306bf` の上。
- 公開時刻の有効バージョン：`b5512e3f-3556-44cb-9844-de30e5554ed4`
- 復旧先（直前の版・`2045851`）：`5777f43d-5986-4bf3-b7a2-c2abf238c707`
- 公開前の照合：本番は直前の記録と 906/906 一致（`before-live-check.json`）。
- 公開ファイル：907（14 をアップロード、892 は使い回し）。追加0・変更14・削除0。変更は `guide/glb.html`・`guide/glb.js`・`guide/glb-catalog.json`・`guide/guide.css`・`model-library.js` と、`?v=` を上げた `app.js`・`index.html`・`model-thumb.js`・`sequence.html`・`sequence.js`・`workshop-preview.js`・`workshop.html`・`workshop.js`、`release.json`。
- 公開後：全ファイルを plain `curl` で取得して 906/906 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-glb-replace-2026-11-07/`（Git 管理外。前の配布物から組み立て、サムネは `app/guide/thumbs/` から入れた）。

## 変わったこと
1. 前に「UNFOLDに追加」した色なし（灰色）の版が入っている形は、置き場のカードの枠が金色になり、「入っているのは色なしの古い版」と出て、ボタンが「色つきに入れ替え」になる。
2. 上に「表示中の色なしN個を色つきに入れ替え」が出て、まとめて入れ替えられる。
3. 入れ替えは、保存した形を消さずに中身だけ差し替える（`model-library.js` の `replaceModelFile`）。id・名前・グループ・並びはそのままなので、その形を使っている作品やシーケンスも、開き直すと色つきになる。100個までの枠も使わない。
4. 見分け方：カタログに前の灰色の版のバイト数（`greyBytes`）を足し、「同じ名前」かつ「そのバイト数ぴったり」の物だけを古い版とする。同じ名前でも、自分で入れた GLB は触らない。
5. 2026-11-05 の記録の「新しい色の形にするには、削除してからもう一度追加する」は、この入れ替えで不要になった。

## 検証
- `node tools/test/glb-shelf-replace-browser.mjs`（新しいブラウザの確かめ。灰色の2個と同じ名前の自分の GLB を入れておき、まとめて入れ替え → 2個が同じ id のまま色つき・サムネつき、自分の GLB はそのまま、重複なし）14 項目すべて PASS。
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 609 合格・失敗 0。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=22306bf` 15 項目すべて PASS（`verify_daily.log`）。
- Wrangler の dry-run：924 を読み込み（907 ファイル + 17 フォルダ、前回と同じ）。
- 公開後、本番の `https://unfold.saisuiwa.com/guide/glb.html` を新しいブラウザで開き、灰色のクジラを入れておいて「色なし1個を色つきに入れ替え」→ `https://glb.saisuiwa.com/animal/whale.glb?v=colour` を取って、同じ id のまま 6912196 バイト・テクスチャ1枚になり、形の数は1のまま、ページのエラーなし（`live-check.png`）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback 5777f43d-5986-4bf3-b7a2-c2abf238c707 --config releases/unfold-glb-replace-2026-11-07/wrangler.json
```
置き場（`unfold-glb`）は今回変えていないので、戻すのはサイトだけでよい。入れ替え済みの人の手元の形は色つきのまま残る（戻しても困らない）。
