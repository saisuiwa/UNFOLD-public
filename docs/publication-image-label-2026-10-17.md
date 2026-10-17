# 画像メソッドの「表示する文字」 — 公開記録 2026-10-17

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の依頼（爆砕と再誕の文字を変えたい）で、既存の Cloudflare Worker `unfold` を更新した。

- 公開ソース：`6627798`（本体の main）。
- 公開時刻の有効バージョン：`8accc32b-6c6b-49a5-893f-ea5179310cd0`
- 復旧先（直前の版・`3c6be08`）：`c23397f2-9d9e-425e-80e1-498a05baba5b`
- 公開ファイル：11（追加1 `image-label.js`・変更10）。公開前に直前の本番 717/717 の SHA-256 一致を確認、公開後は 718/718 が SHA-256・Content-Type ともに一致（`/release.json` は `6627798`）。
- 配布物・照合記録：`releases/unfold-image-label-2026-10-17/`。このフォルダは Git 管理外。

## 変わったこと
1. 文字が出る画像メソッド（コードが `params.label` を使うもの。爆砕と再誕など）に「表示する文字」欄。工房・1枚モード・シーケンス（◆ごと、`tr.label`）。空ならメソッドの元の文字。
2. 描画側（`image-method-layer.js`）は、使う場所ごとの設定（`input.params`）をメソッドの設定に重ねる。保存したメソッドは書き換えない。
3. 判定（`usesImageLabel`）は新しいモジュール `image-label.js` に置いた。手元の確認で、古い `image-method-format.js` がブラウザに残っていると新しい書き出しが見つからずにページが止まったため（本番は `max-age=0, must-revalidate` なので起きにくいが、念のため）。

## 検証
- `node --test`（tools/test 以下）560/560。
- 手元のブラウザ：工房（「Claude」でプレビュー）、1枚モード（入力した文字で描画、焦げ穴と炎・くしゃくしゃでは欄が出ない）、シーケンス（◆の文字で描画、◆の設定に欄と値）。
- 公開後の本番：1枚モードで爆砕と再誕の文字を「Claude」に変えて描画。コンソールエラーなし。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback c23397f2-9d9e-425e-80e1-498a05baba5b --config releases/unfold-image-label-2026-10-17/wrangler.json
```
