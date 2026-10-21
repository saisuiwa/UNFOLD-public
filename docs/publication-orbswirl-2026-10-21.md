# カット割りの背景「球を巡る光の渦」の直し — 公開記録 2026-10-21

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の承認を受けて、既存の Cloudflare Worker `unfold` を更新した。

- 公開ソース：`b708640`（本体の main。`280bce3` からの `app/` の違いは `studio/cuts/daily-parts.js` だけ）
- 公開時刻の有効バージョン：`5573d544-6cab-4d98-97bd-ac7248c753ba`
- 復旧先（直前の版・`280bce3`）：`183e7d0d-c35d-48dd-ac71-010aa15adeb7`
- 公開ファイル：2（追加0・変更2・削除0、約0.05MB）。公開前に直前の本番 836/836 の SHA-256 一致を確認、公開後は 836/836 一致（`/release.json` は `b708640`）。
- 本体の main を push した（`54d6395..b708640`）。
- 配布物・照合記録：`releases/unfold-orbswirl-2026-10-21/`（`DRY-RUN.md`、`dry-run-list.json`、`manifest.json`、`before-live-check.json`、`published-delivery.json`、`deploy.log`）。このフォルダは Git 管理外。

## 変わったこと
1. STUDIO のカット割り：毎日の部品の背景「球を巡る光の渦」（orbSwirl）が、作業用のキャンバスが無い時に、下の絵をほとんど塗りつぶしていた（不透明度 189）。紙吹雪・ちらつく粒と同じく、1つずつ同じ薄さで描くようにした（100。下に絵がある時の決まりは 130 以下）。作業用のキャンバスがある時の見た目は変わらない。

## 検証
- `node --test` 579/579。`node tools/verify_daily.mjs` 15ステップすべて PASS（公開ソースと同じ中身で）。
- `cuts-fx-browser` PASS（直す前は、ここで落ちてブラウザテストの続きが止まっていた）、`lyric-cut-browser` ok、`cuts-browser` は3回続けて PASS（その前に1回だけ落ちた。別のブラウザテストが同時に動いていた時で、落ちた時のメッセージは残していない）。
- 公開後：全ファイルを plain `curl` で取得して、836/836 が SHA-256・Content-Type ともに一致。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback 183e7d0d-c35d-48dd-ac71-010aa15adeb7 --config releases/unfold-orbswirl-2026-10-21/wrangler.json
python3 releases/unfold-orbswirl-2026-10-21/verify_delivery.py before-manifest.json rollback-delivery.json
```
