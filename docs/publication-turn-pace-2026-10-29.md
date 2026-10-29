# 立体の長さと回転の速さ・「回転させない」 — 公開記録 2026-10-29（2回目）

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、既存の Cloudflare Worker `unfold` を更新した。

- 公開ソース：`03e5b65`（本体の main）。同じ日の1回目（`c071624`、記録 `9bb6736`）の上。
- 公開時刻の有効バージョン：`9d5e413e-1e99-46f5-9024-84965cd2cacc`
- 復旧先（直前の版・`c071624`）：`1226850c-6032-4125-aa1c-f1b15d104f1b`
- 公開前の照合：本番は1回目の記録と 906/906 一致（`before-live-check.json`）。
- 公開ファイル：907（15 をアップロード、891 は使い回し）。追加0・変更15・削除0。
- 公開後：全ファイルを plain `curl` で取得して 906/906 が SHA-256・Content-Type ともに一致（`_headers` を除く）。出した直後は 900/906（6つがまだ前の中身）、続けて 905/906（`effects.js`）で、約2分後に全部そろった。
- 配布物・照合記録：`releases/unfold-turn-pace-2026-10-29/`（Git 管理外）。

## 変わったこと
1. 立体の長さを伸ばすと、◆の回転の残りが最後の短い時間に詰まって、急にぐるっと回っていた。回転（シーケンスの spin、1枚モードの turn）は、立体の長さをかける前の時間で回すようにした。立体の長さ 0% は今までと同じ。
2. 立体の動きの 🎲おまかせ の下に「回転させない」ボタン。押すと◆の間ずっと回らない（回転方向を指定する＋回転なし・0回と同じ）。もう一度押すと元の回転。

## 検証
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 608 合格・失敗 0（立体の長さを変えても回転の速さが同じことを確かめるテストを追加）。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=c071624` 15 項目すべて PASS。`tools/test/solid-motion-browser.mjs` 合格。
- 手元のシーケンスで「回転させない」の ON・OFF が設定に反映されることを確かめた（コンソールのエラーなし）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback 1226850c-6032-4125-aa1c-f1b15d104f1b --config releases/unfold-turn-pace-2026-10-29/wrangler.json
```
