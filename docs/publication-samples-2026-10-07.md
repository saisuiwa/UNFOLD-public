# サンプル集・新サンプル2つの公開記録 — 2026-10-07

作者の承認を受けて、既存Cloudflare Worker `unfold` を更新した。

- 工房：https://unfold.saisuiwa.com/workshop
- サンプル集（新規）：https://unfold.saisuiwa.com/guide/samples.html
- 公開ソース：`e6e969fd9d0875c0d456b096e3fd76850a9c7035`（GitHubの `main` と同じ）。
- 公開バージョン：`6d3bf302-0de9-422f-9d65-b95b5db7d91c`（2026-10-07 13:38 UTC ＝ 22:38 JST）。
- 直前の公開バージョン：`9ef49bf7-ec76-43d7-a26f-506334c85022`（記録は `docs/publication-surface-effects-2026-10-06.md`）。
- 公開物：`releases/unfold-samples-2026-10-07/public/`。339ファイル、40,562,947バイト。配信取得対象は `_headers` を除く338ファイル。
- 既存Wrangler 4.131.1（新版4.148.0の案内が出たが更新していない）。dry-run成功後、`deploy --keep-vars` で67ファイル（追加36・更新31）をアップロード、271は既存。削除なし。
- GitHub pushなし（この記録のコミット後、確認のうえで行う）。旧版リリースとCloudflareバージョンを保持。

## 対象

前回の公開物（`releases/unfold-surface-effects-2026-10-06/public/`）をマニフェストのSHA-256で303/303確認してコピーし、Git管理済み `app/` の187ファイルだけを上書きした。

- 追加36：サンプル集 `guide/samples.html` と `guide/preview-play.js`、見本の画像・動画16種×2（`guide/samples/`）、`image-method-daily.js`、`code-motion-daily.js`。
- 更新31：うち21ファイルは `?v=` の数字の揃え直しだけ（`app.js`、`effects.js`、`index.html`、`sequence.html`、`sequence.js`、`workshop.html`、`workshop.js`、`lyric-*.js` の多くなど。`?v=` を無視すると前回と同一であることを確認）。中身が変わったのは10ファイル：`guide/index|methods|glb.html`、`guide/guide.css`、`method-samples.js`（サンプルの分類）、`method-editor.js`、`image-method-presets.js`、`code-motion-presets.js`、`lyric-motion.js`、`lyric-controls.js`。
- 新サンプル2つ（2026-10-07追加分）：画像・立体・物理の「渦に巻かれるタイル」、文字モーションの「色ずれが重なる」。どちらも各一覧の末尾。
- Git管理外だが公開物に入っている152ファイル（`guide/methods/*`、`guide/thumbs/*`）は前回のものを引き継ぎ、前回マニフェストと同一であることを確認した。
- Worker本体、既存のGLSL、CPU画像転送経路は変更していない。写真、曲、個人のプロジェクト、下書き、認証情報は含めていない（追加・更新ファイルの機密文字列検査も0件）。Netlify、GLB置き場のWorker、個人のブラウザ保存データには触れていない。

## 検証

- 公開前：Nodeテスト336件成功、失敗0。公開中のサイトが前回マニフェストと302/302一致していることを確認してから出した。
- 公開直後に2ファイル（`code-motion-editor.js` の内容、`guide/samples/method-petals.jpg` が404）が未反映だった。Cloudflareの反映待ちで、数秒後の取り直しで一致した。
- 公開URLの338ファイル全てが今回のSHA-256と一致（素の `curl`、および工房のChrome `fetch` の両方）。JS/CSS/HTMLのContent-Typeは `text/javascript`・`text/css`・`text/html`。サンプルのmp4は `video/mp4`、jpgは `image/jpeg`。
- `/`、`/sequence.html`、`/workshop`、`/guide/`、`/guide/samples.html`、`/guide/motions.html`、`/guide/code-motions.html`、`/guide/methods.html`、`/guide/glb.html` がすべて200で開く。
- サンプル集：見本画像16枚が全部読める。新サンプル2つが載っている。マウスを乗せると動画が再生される（新サンプル2つで確認、エラーなし）。390px幅で横はみ出しなし。
- 工房：「渦に巻かれるタイル」（画像・12個中12番目）と「色ずれが重なる」（文字・4個中4番目）が選べて、どちらも「確認できました。再生・追加・共有ができます。」になる。渦は0秒と6秒で同じ画素（画像へ戻る）、1.8秒で異なる画素。色ずれは0.4秒で文字が描かれる。
- 既存の公開確認（`tools/test/workshop-publication.mjs`）も合格：GLSL・画像JavaScript・文字JavaScriptの描画、保存、下書き復帰、1枚モードとシーケンスへの引き渡しとUndo、390px幅の横はみ出しなし。ページ例外0。

iPhone/Safari実機、Safariでの動画再生、長時間の動画書き出しは未検証。確認は一時的な隔離Chromeと合成入力のみで、個人のプロファイルは使っていない。

## 気づいた点（今回の公開の不具合ではない）

- **ナビの抜け**：`guide/motions.html` と `guide/code-motions.html` に「サンプル集」へのリンクがない（`main` の `e6e969f` の時点から）。リンクがあるのは `guide/index.html`、`methods.html`、`glb.html` の3ページ。直すなら `app/` を変更して次回の公開で出す。
- **HTMLの末尾に足されるビーコン**：Cloudflareのエッジが、ブラウザ風のリクエスト（`Accept: text/html` など）にWeb Analyticsのビーコン `<script … static.cloudflareinsights.com/beacon.min.js …>`（367バイト）をHTMLの末尾へ自動で足す。配信ファイルの中身とは別で、前から同じ。**SHA-256の確認は、素の `curl`（`Accept` を付けない）か `fetch` で行うこと**。Pythonの `urllib` を使うとHTMLが8個とも不一致に見える（標準のUser-Agentは403にもなる）。
- **隠しiframe**：工房でJavaScript系（画像・文字）のサンプルを動かすと、`sandbox="allow-scripts"` の隠しiframeが1つできる。画像メソッドと文字モーションを隔離して動かす仕組みで、今回の変更ではない（`image-method-runtime.js`、`code-motion-runtime.js` は前回と同一）。
- **`/favicon.ico` は404**：もともとファビコンを置いていない。前回の公開物にもない。

再確認用：`releases/unfold-samples-2026-10-07/checks/` に今回の確認スクリプトを置いた。`verify_live.py <マニフェスト>`（全ファイルのSHA-256とContent-Type）、`check-samples-live.mjs`（各ページ・サンプル集・工房の新サンプル）、`check-video.mjs`（動画の再生）。`tools/test/workshop-publication.mjs` は `UNFOLD_BASE_URL=https://unfold.saisuiwa.com/ UNFOLD_RELEASE_DIR=…/releases/unfold-samples-2026-10-07` で。

証跡：リリースフォルダの `manifest.json`、`dry-run-plan.txt`、`published-verification.json`、`published-browser.json`、`published-samples-check.json`、`published-samples-video.json`、公開画面PNG（`published-samples-page.png`、`published-samples-mobile.png`、`published-sample-image.png`、`published-sample-text.png` ほか）。

## 使い方と復旧

工房の「画像・立体・物理 JavaScript」「文字モーション」の一覧の末尾から新サンプルを選び、「＋ UNFOLDに追加」。サンプル集は https://unfold.saisuiwa.com/guide/samples.html 。

古い画面が残る場合は、編集中の作品を保存してから再読み込みする。サイトデータを削除する必要はない。

必要時の復旧（未実行）：

```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback 9ef49bf7-ec76-43d7-a26f-506334c85022 --config releases/unfold-samples-2026-10-07/wrangler.json --message 'Restore pre-samples-page version'
```

旧公開物は `releases/unfold-surface-effects-2026-10-06/` に保持。復旧後は `verify_live.py releases/unfold-surface-effects-2026-10-06/manifest.json` で302ファイルの一致を確認する。
