# STUDIO「新しいMV」の素材の窓 — 公開記録 2026-10-21

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の承認を受けて、既存の Cloudflare Worker `unfold` を更新した。

- 公開ソース：`280bce3`（本体の main。`32c9cb0` テストの直し ＋ `280bce3` STUDIO の新しいMVの窓）
- 公開時刻の有効バージョン：`183e7d0d-c35d-48dd-ac71-010aa15adeb7`
- 復旧先（直前の版・`ca2b783`）：`609282eb-f9f7-4949-8d0f-d4f1b91fc6ee`
- 公開ファイル：7（追加1・変更6・削除0、約0.14MB）。公開前に直前の本番 835/835 の SHA-256 一致を確認（スクリプトで 831、通信が切れた4つは手で確かめ直した）、公開後は 836/836 一致（`/release.json` は `280bce3`）。
- 配布物・照合記録：`releases/unfold-new-mv-flow-2026-10-21/`（`DRY-RUN.md`、`dry-run-list.json`、`manifest.json`、`published-delivery.json`、`deploy.log`）。このフォルダは Git 管理外。

## 変わったこと
1. STUDIO で「新しいMV」を押すと、「新しいMVの素材」の窓が開く。歌（MP3 など）、歌詞ファイル（LRC / SRT / JSON / TXT）、画像・動画を選べる。何も選ばずに「あとで入れる」で始めてもよい（`studio/lyric-file.js` を追加、`studio/controller.js`・`view.js`・`omakase-panel.js`・`studio.css`）。
2. 素材の欄からも、あとで「♪ 歌を入れる」「歌詞ファイルを入れる」ができる。
3. 使い方のページ（`guide/manual.html`）に、新しい窓の説明。

## 検証
- `node --test` 579/579。`node tools/verify_daily.mjs` 15ステップすべて PASS（公開ソースと同じ中身で）。
- 公開後：全ファイルを plain `curl` で取得して、836/836 が SHA-256・Content-Type ともに一致。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback 609282eb-f9f7-4949-8d0f-d4f1b91fc6ee --config releases/unfold-new-mv-flow-2026-10-21/wrangler.json
python3 releases/unfold-new-mv-flow-2026-10-21/verify_delivery.py before-manifest.json rollback-delivery.json
```
