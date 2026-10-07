# 「編集したサンプルを元に戻す」と文字モーション集のナビの公開記録 — 2026-10-07

作者の承認を受けて、既存Cloudflare Worker `unfold` を更新した。

- 工房：https://unfold.saisuiwa.com/workshop
- 公開ソース：`8fead5e7790f367ea392b4af977f678d2cd86346`。**この記録を書いた時点では GitHub へ未push**（この記録のコミットと一緒にpushする）。
- 公開バージョン：`5d33e8d8-15db-420d-a6d7-32ab1241f374`（2026-10-07 14:08 UTC ＝ 23:08 JST）。
- 直前の公開バージョン：`6d3bf302-0de9-422f-9d65-b95b5db7d91c`（記録は `docs/publication-samples-2026-10-07.md`）。
- 公開物：`releases/unfold-sample-reset-2026-10-07/public/`。339ファイル、配信取得対象は `_headers` を除く338ファイル。
- 既存Wrangler 4.131.1のdry-run成功後、`deploy --keep-vars` で5ファイル（更新のみ。追加0・削除0）をアップロード、333は既存。
- 旧版リリースとCloudflareバージョンを保持。

## きっかけ

作者から「きらめく粒」（画像の崩れ方 GLSL）と「リボンの波」（文字モーション）がエラーになる、とスクショが来た。

- どちらのエディタにも、画像メソッド用のコード（`createImageTiles` を使う、`// 1. タイルの生成` コメントつきの複数行）が入っていた。エラーは `createImageTiles is not a function`（文字）と `` `vec3 userMethod(vec2 p, float amount)` を1つ書いてください ``（GLSL）。
- 公開サイトを**まっさらなブラウザ**で開くと、全サンプル（GLSL 8・画像 12・文字 4）がエラーなしで動く。サンプル本体の問題ではなかった。
- 工房は、サンプルに保存済みの下書きがあるとサンプルの代わりにそれを表示する。サンプルのキーとカード名のまま、中身だけを画像メソッド用コードにした下書きを作ると、**スクショと同じカード（「SAMPLE」「図解 · タップして試す」）と同じエラー文が再現した**。
- 元のサンプルへ戻す手段が無かった（サイトデータの削除しかなかった）。これが本当の穴。
- **作者のブラウザの中身は見ていない。誰（何）がその下書きを書き換えたかは未確認。** コードの書式は、このアプリのサンプルではなくAIが書いたもののようだった。この版を公開した後は、ボタンで戻せる。

## 変更（5ファイル）

- 編集したサンプルのカードに「EDITED」「編集した版 · 元に戻せます」を出す。
- 編集したサンプルを開くと、保存ボタンの並びに「元のサンプルに戻す」を出す。押すと確認が出て、承諾すると下書きを捨てて元のサンプルを開き、実際に再生して確認する。キャンセルなら何も変えない。残したい編集は先に「コピーを作る」で別の下書きにする（コピーはサンプルではないのでボタンは出ない）。
- 「編集済み」の判定は `sampleEdited()`（`workshop-data.js`）：編集した印があるか、コード・種類・名前がサンプルと違うとき。テスト付き。
- カードの表示は、編集済みかどうかが切り替わったときだけ一覧を描き直す（手で編集した直後に「SAMPLE」のまま残らないように）。
- `guide/motions.html` のナビに「サンプル集」を追加（index / methods / glb と同じ並び）。

更新ファイル：`workshop.js`、`workshop.html`（`workshop.js` の `?v=3 → 4`）、`workshop-data.js`、`workshop.css`、`guide/motions.html`。Worker本体、描画、既存のサンプル・サンプル集は変更していない。写真、曲、個人のプロジェクト、下書き、認証情報は含めていない（更新ファイルの機密文字列検査0件）。Netlify、GLB置き場のWorker、個人のブラウザ保存データには触れていない。

## 検証

- 公開前：Nodeテスト337件成功（1件追加）、失敗0。既存の工房ブラウザテスト5本（基本・引き渡し・レビュー・画像素材・拡張）合格。日次チェック `tools/verify_daily.mjs` は全ステップ合格（`?v=` の上げ漏れ、ページ9枚、GPU、工房、サンプル集、エディタ、歌詞パネル）。公開中のサイトが直前マニフェストと338/338一致していることを確認してから出した。
- 公開直後は反映待ちで、1回目4件・2回目2件が未一致、3回目（デプロイから1分ほど後）に**338ファイル全てがSHA-256一致**（素の `curl`）。JS/CSS/HTMLのContent-Typeは正常。
- 既存の公開確認（`tools/test/workshop-publication.mjs`）合格：338ファイル一致、3方式の描画・保存・復帰、1枚モード・シーケンスへの引き渡しとUndo、390px幅で横はみ出しなし、エラー0。
- 公開サイトで、作者と同じ壊れた下書き（`sample:text:2`、`sample:glsl:sparkle`）を作って確認：カードが「EDITED」になる／ボタンが出る／プレビューで元のエラーが出る／キャンセルで変わらない／承諾で元のサンプルに戻り「確認できました」／カードが「SAMPLE」＋実際の描画に戻る／再読み込み後も戻ったまま。手で編集したサンプル（ボタン＋EDITED→戻す）、未編集サンプル（ボタンなし）、コピー（ボタンなし）、390px幅（横はみ出しなし）も確認。
- `/`、`/sequence.html`、`/workshop`、`/guide/`、`/guide/samples.html`、`/guide/motions.html`、`/guide/code-motions.html`、`/guide/methods.html`、`/guide/glb.html` がすべて200。`/guide/motions.html` から「サンプル集」へのリンクが出る。サンプル集の画像16枚が読める、新サンプル2つの動画が再生される、工房で「渦に巻かれるタイル」「色ずれが重なる」が「確認できました」になる。エラー0。

iPhone/Safari実機、Safariでの動画再生、長時間の動画書き出しは未検証。確認は一時的な隔離Chromeと合成入力のみで、個人のプロファイルは使っていない。

## 気づいた点（今回は直していない）

- **日次チェックが、この Mac（Node v25）では「unit tests」だけ落ちる**：`tools/verify_daily.mjs` は `node --test` の出力から `# pass N` / `# fail N`（TAP形式）を読むが、Node v25 はパイプ越しでも `ℹ pass N` 形式で出すため読めず、`NaN failed` になる。テスト自体は成功している。`NODE_OPTIONS='--test-reporter=tap'` を付けて流すと全ステップ合格。直すなら `spawnSync` の引数に `--test-reporter=tap` を足す（クラウドのルーティンが使う検査スクリプトなので、作者の確認のうえで）。また、この Mac では playwright が入っていないため、`NODE_PATH` の仮置き場と `UNFOLD_CHROMIUM` が必要だった。
- **工房・本体のヘッダーから、サンプル集へ直接は行けない**（`/guide/` の説明ページからは行ける）。
- **`guide/code-motions.html` にはサイトのナビ自体がない**（独立した解説ページ）。「サンプル集」リンクの抜けではない。前回の記録（`publication-samples-2026-10-07.md`）の「`motions.html` と `code-motions.html` にリンクがない」は、`motions.html` だけが正しい。
- **公開直後は反映に数十秒かかることがある**（前回に続き、今回も3回目の確認で一致）。
- HTMLの末尾にCloudflareのWeb Analyticsビーコンが足される件、隠しiframe、`/favicon.ico` の404は前回の記録のとおり（変更なし）。SHA-256の確認は素の `curl` で。

再確認用：`releases/unfold-sample-reset-2026-10-07/checks/`。`verify_live.py <マニフェスト>`（全ファイルのSHA-256とContent-Type）、`check-reset.mjs`（`app/` をローカルで配信して確認）、`check-reset-live.mjs`（公開サイト上で、壊れた下書きから元に戻す流れ）、`check-samples-live-2.mjs`（各ページ・サンプル集・工房の新サンプル）、`check-video-2.mjs`（動画の再生）。`tools/test/workshop-publication.mjs` は `UNFOLD_BASE_URL=https://unfold.saisuiwa.com/ UNFOLD_RELEASE_DIR=…/releases/unfold-sample-reset-2026-10-07` で。

証跡：リリースフォルダの `manifest.json`、`dry-run-plan.txt`、`published-verification.json`、`published-browser.json`、`published-samples-check.json`、`published-samples-video.json`、`reset-check.json`、`reset-before.png`（EDITEDとエラー）、`reset-after.png`（戻した後）、`reset-phone.png`、公開画面PNG。

## 使い方と復旧

作者の「きらめく粒」「リボンの波」は、工房を開いてカードを選び、「元のサンプルに戻す」を押す（サイトデータを消す必要はない）。編集を残したいサンプルは、先に「コピーを作る」。

古い画面が残る場合は、編集中の作品を保存してから再読み込みする。

必要時の復旧（未実行）：

```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback 6d3bf302-0de9-422f-9d65-b95b5db7d91c --config releases/unfold-sample-reset-2026-10-07/wrangler.json --message 'Restore pre-sample-reset version'
```

旧公開物は `releases/unfold-samples-2026-10-07/` に保持。復旧後は `verify_live.py releases/unfold-samples-2026-10-07/manifest.json` で338ファイルの一致を確認する。
