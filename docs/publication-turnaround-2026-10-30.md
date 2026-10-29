# 立体の動き「振り向いて寄る」 — 公開記録 2026-10-30

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の OK（「公開で」、作例に使った骸骨の GLB は入れない）を受けて、既存の Cloudflare Worker `unfold` を更新した。

- 公開ソース：`9abc0a0`（本体の main）。10-29 の2回目（`03e5b65`、記録 `67e4260`）の上。
- 公開時刻の有効バージョン：`72e66e0e-3ee9-4580-89d4-09edc750ebe1`
- 復旧先（直前の版・`03e5b65`）：`9d5e413e-1e99-46f5-9024-84965cd2cacc`
- 公開前の照合：本番は直前の記録と 906/906 一致（`before-live-check.json`）。
- 公開ファイル：907（10 をアップロード、896 は使い回し）。追加0・変更10・削除0。作例の骸骨の GLB は、本体にも配布物にも入っていない。
- 公開後：全ファイルを plain `curl` で取得して 906/906 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-turnaround-2026-10-30/`（Git 管理外）。

## 変わったこと
1. 立体の動きに「振り向いて寄る」。拍ではなく立体の一生（できてから崩れるまで）に合わせて、横向きで現れ、こちらへ振り向き、近づいてくる。シーケンスでは◆を長くすると、振り向くのもゆっくりになる。
2. 人の形では 🎲おまかせ でも選ばれやすい。

## 検証
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 609 合格・失敗 0（横向き→正面→近づくを確かめるテストを追加）。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=03e5b65` 15 項目すべて PASS。
- 手元のシーケンスで、作例の骸骨（20拍の◆）が横向き→振り向き→近づく→崩れることを、書き出した動画のコマで確かめた。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback 9d5e413e-1e99-46f5-9024-84965cd2cacc --config releases/unfold-turnaround-2026-10-30/wrangler.json
```
