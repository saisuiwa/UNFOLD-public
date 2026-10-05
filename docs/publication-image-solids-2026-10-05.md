# 2026-10-05 公開記録：JavaScript画像メソッドの立体・GLB接続

- 公開URL：https://unfold.saisuiwa.com/
- Worker：`unfold`（既存の公開先を更新）
- 公開ソース：`c502dae4688bea0503597b6657ea8f0fd6b657af`
- 新バージョン：`5e3de57c-334e-4d0a-9048-9b42a5fcda32`
- 直前のバージョン：`51788c21-2047-4da5-a03e-4234990d2a33`（切り戻し時の参照）
- 公開物：`releases/unfold-image-solids-2026-10-05/public/`、286ファイル、39,042,982バイト。`_headers` は配信メタデータのため照合対象は285ファイル。
- 公開方法：既存のWrangler 4.131.1でdry-run後に `deploy --keep-vars`。認証情報・個人の作業画像・曲・プロジェクトは公開物に含めない。Netlify、GLB置き場、GitHubは変更していない。

## 機能

JavaScript＋物理演算の画像メソッドを、選んだ立体・GLBへ集める機能を公開。1枚モードは「03 立体」、シーケンスは◆変形の「立体化する」で設定。コード編集画面にも立体プレビューを追加。

以前の作品で立体化がオフだった区間は、オンにして形を選び直す。操作と対応範囲は [画像コードメソッド](image-code-methods.md)、実装検証は [立体化検証](image-solid-verification-2026-10-05.md) を参照。

## 公開後検証

- 公開直前の全314テスト成功。
- 公開URLの285ファイルすべてでSHA-256一致。JS/CSS/HTMLのContent-Typeも確認。
- 隔離ChromeでテストGLBを生成し、公開サイトの1枚モードで追加、形切替、立体化オンオフ、編集画面でGLBプレビューを確認。
- 公開シーケンスで同じGLB・メソッドを使用。立体化オンオフ、Undo/Redo、.unfold書き出し・復元を確認。ページ例外0件。
- 初回の画面比較テストは読込途中の画像を採取して不一致になったため、ネットワーク読込完了を待って同じテストを再実行し成功。
- 証跡はリリースフォルダの `manifest.json`、`published-verification.json`、`published-browser.json`、`single-glb.png`、`sequence-glb.png`、`editor-glb.png`。

画面が古い場合は作業を保存して ⌘＋Shift＋R。サイトデータは消さない。
