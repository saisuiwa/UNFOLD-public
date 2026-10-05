# 2026-10-05 公開記録：画像JavaScriptメソッド・Rapier物理演算

- 公開URL：https://unfold.saisuiwa.com/
- Cloudflare Worker：`unfold`（既存の独自ドメインへ更新）
- 配信ソース：`864801b`（実装 `89bd03d` を含む）
- 公開バージョン：`51788c21-2047-4da5-a03e-4234990d2a33`
- 直前のバージョン：`91b3fce4-e8e7-492a-914f-bff66b872079`（切り戻し時の参照先）
- 公開物：`releases/unfold-image-code-2026-10-05/public/`。アプリ・同梱フォント・ガイド見本283ファイル、39,025,880バイト。`_headers` は配信メタデータとして処理され、実際に取得確認したファイルは282個。
- ユーザーの作業画像・曲・プロジェクトは公開物に含めていない。旧NetlifyとGLB置き場Workerは変更していない。

## 公開した機能

既存GLSLに加え、Three.js＋Troika Text＋GSAP＋Rapierの画像メソッドを追加。「＋自作メソッド」→「JavaScript＋物理演算で作る」から、プリセット・コード編集・プレビュー・ブロック追加を利用できる。1枚モードとシーケンスで共有。

API、現時点の制限、動画書き出し仕様は [画像コードメソッド](image-code-methods.md)、実装検証は [検証記録](image-code-verification-2026-10-05.md) を参照。

## 確認結果

- 公開直前のNodeテスト：310件成功、失敗0。
- 公開URLの全282ファイル：SHA-256が公開用コピーと一致。JS/CSS/HTMLのContent-Typeも確認済み。
- 公開URLを隔離したChromeで起動し、画像コードのプレビュー成功、ブロック追加、シーケンス共有、ガイド表示を確認。ページ例外0件。
- 証跡：リリースフォルダ内の `manifest.json`、`published-verification.json`、`published-browser.json`、`published-editor.png`。
- Python urllibのHTTP照合は403となったため、Chromeの同一オリジンfetchで全ファイルを改めて照合し成功した。

## 配信方法

既存認証済みWrangler 4.131.1で、リリースフォルダ内の `wrangler.json` を指定し、dry-run後に `deploy --keep-vars` で公開した。設定ファイルとマニフェストはリリースフォルダに保存。認証情報は公開物にもリポジトリにも含めない。

GitHubへのpushは実施していない。古い画面が残る場合はプロジェクトを書き出して保管してから ⌘＋Shift＋R で再読み込みする。サイトデータの削除は保存済みプロジェクトを消すので行わない。
