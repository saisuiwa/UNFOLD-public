# メソッド工房の公開記録 — 2026-10-06

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の公開承認を受け、既存のCloudflare Worker `unfold` と独自ドメインを更新。

- 工房の正規URL：**https://unfold.saisuiwa.com/workshop**（`/workshop.html` からリダイレクト）。
- 本体：https://unfold.saisuiwa.com/ 、シーケンス：https://unfold.saisuiwa.com/sequence
- ソース：`4ac4af5ac8f96e414e0efa5ebd93799f558b8c54`。承認済み `codex/method-workshop` / `f32e311` をmainへFast-forwardし、既存の読み込み番号を更新。
- 公開バージョン：`7f1a9895-46a6-4637-9d35-d86364e271c9`。
- 直前のバージョン：`e8720b64-ee47-4ed5-97b2-91fc8417c296`（画像転送クラッシュ対策）。
- 公開物：`releases/unfold-workshop-2026-10-06/public/`、293ファイル、39,092,901バイト。`_headers`を除く取得対象は292ファイル。
- 既存Wrangler 4.131.1でdry-run成功後、`deploy --keep-vars`。GitHubへのpushなし。旧Netlify・GLB置き場のWorker・個人のブラウザ保存データは変更していない。

## 公開対象の確認

直前の公開マニフェストで全ファイルのSHA-256を確認した公開物を基に、Git管理済みの `app/` ソース・配布フォントのみ重ねた。新規配信パスは7個の工房HTML/CSS/JSだけ。個人の作業画像・楽曲・下書き・プロジェクト・認証ファイルをコピーしていない。見本画像・動画と必要な配布依存ファイルは従来の公開物を保持。

## 公開後の検証

- 統合後Nodeテスト：**320件成功、失敗0**。
- 公開URLの**292ファイルすべてSHA-256一致**。JS/CSS/HTMLのContent-Typeも一致。
- 隔離したChromeで、GLSL・画像JavaScript／物理・文字JavaScriptの各サンプルをカードから選択。プレビューで時刻0と3秒の画素変化を確認し、実描画サムネイル生成も確認。
- 3方式とも「UNFOLDに追加」で保存。各回の再読み込みで名前・下書きが復元され、未実行状態になることを確認。IndexedDBに画像系2件、文字ライブラリに1件が保持された。
- 1枚モードでGLSL・画像JavaScriptを明示適用。画像JavaScriptは実際のWorker描画フレーム受信まで確認。
- シーケンスの選択◆へ画像JavaScriptを適用して描画・Undo。選択した歌詞へ文字JavaScriptを適用して描画・Undo。通知だけでは勝手に適用しない。
- 390px幅でカード、プレビュー、コード、配色、保存領域を目視確認。document幅390pxで横はみ出しなし。
- 公開ブラウザテストのページ例外・クラッシュ：**0件**。

公開後テスト：`tools/test/workshop-publication.mjs`。合成画像と同梱コードだけを隔離した一時ブラウザで使い、個人のプロファイルは開いていない。スマホ検証はChromeの390pxビューポートであり、iPhone/Safari実機検証ではない。

証跡（Git対象外）：リリースフォルダの `manifest.json`、`published-verification.json`、`published-browser.json`、`published-glsl.png`、`published-image.png`、`published-text.png`、`published-single.png`、`published-sequence-text.png`、`published-mobile-preview.png`、`published-mobile-editor.png`。

## 保存と利用上の範囲

工房は同じサイト・同じブラウザのライブラリへ追加する。ローカル版や別端末の保存領域とは自動同期しない。別の環境へ渡す場合は `.unfoldmethod` / `.unfoldmotion` を使用。

既存GLSL、旧メソッド定義、CPU ImageData経由の画像転送対策は保持。既存コードを変更した工房の保存は新しいIDを発行し、旧作品で使用中の定義を残す。以前報告されたネイティブクラッシュは本人のコードで未再現のため完全解決とは断定しない。3方式のJavaScript描画には既存のOffscreenCanvas等のブラウザ機能が必要。

古い画面が残る場合は作品を保存してから再読み込みする。サイトデータの削除は行わない。

## 復旧手段

前の公開物 `releases/unfold-image-crash-fix-2026-10-05/` とCloudflareバージョンを保持。必要な場合、リポジトリルートで既存CLIから直前の版へ戻せる（今回は実行していない）：

```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback e8720b64-ee47-4ed5-97b2-91fc8417c296 --config releases/unfold-workshop-2026-10-06/wrangler.json --message 'Restore pre-workshop release'
```

または前の公開フォルダを同じ設定で再公開する。ブラウザ内の作品・ライブラリはサーバーへの配信更新では削除されない。
