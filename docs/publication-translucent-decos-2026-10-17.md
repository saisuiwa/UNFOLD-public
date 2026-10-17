# カット割りの透ける DECO 9個 — 公開記録 2026-10-17

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の依頼（DECO はインパクトが大きいので、少し透けたもの・ガラスっぽいもの・薄い付箋も）で、既存の Cloudflare Worker `unfold` を更新した。

- 公開ソース：`350bac7`（本体の main）。
- 公開時刻の有効バージョン：`1475f1a9-7a70-41be-9509-3cce24ef6037`
- 復旧先（直前の版・`8751dcc`）：`38ceabfe-9ea0-4e6c-bf9f-98d56a04a8b1`
- 公開ファイル：2（変更のみ。`studio/cuts/decos.js` と `release.json`）。公開前に直前の本番 759/759 の SHA-256 一致を確認、公開後も 759/759 が SHA-256・Content-Type ともに一致（`/release.json` は `350bac7`）。
- 配布物・照合記録：`releases/unfold-translucent-decos-2026-10-17/`。このフォルダは Git 管理外。

## 足した DECO（12 → 21）
面で覆うものは、どれも文字の後ろ（`back`）に淡く描く。文字の上に描くのはシャボン玉の線だけ。

| キー | 名前 | 中身 | 雰囲気 |
|---|---|---|---|
| `paleSticky` | 薄い付箋 | 少し透けた付箋が、少し大きめから貼られる。角が折れ、ときどきテープ | ポップ・エモ・しっとり |
| `stickyStack` | 付箋の重なり | 色の違う薄い付箋が2枚、ずれて重なる | ポップ・グラフィック・エモ |
| `maskingTape` | マスキングテープ | 字の対角の2つの角に、ふちがギザギザの透けたテープ | ポップ・エモ・グラフィック |
| `frostedGlass` | すりガラスの板 | 角の丸い半透明の板。粒と、斜めに流れる光 | しっとり・グラフィック・エモ |
| `glassBubbles` | シャボン玉 | 字のまわりに、ガラスのような玉が浮かぶ（線だけ） | しっとり・エモ・ポップ |
| `softHalo` | 透ける光の輪 | 字の後ろが淡く光り、ゆっくり息づく | しっとり・エモ |
| `veilCircles` | 透ける丸の重なり | 透けた大きな丸が3つ重なって、ゆっくり回る | グラフィック・しっとり・ポップ |
| `prismStreak` | 虹色の反射 | 淡い虹色の帯が、字の後ろを斜めに横切る | エモ・グラフィック・グリッチ |
| `tracingPaper` | 薄紙 | ふちが破れた薄い紙が、横から滑り込む | しっとり・エモ・グラフィック |

## 検証
- `node --test`（tools/test 以下）565/565。`node tools/verify_daily.mjs` 全ステップ PASS。
- 9個を、暗い背景と写真のような背景で並べて撮り、字が読めること・透けていることを確認。手元の部品ラボの見本にも出ることを確認。
- 公開後：全ファイルの一致と、配信中の `studio/cuts/decos.js` に新しい部品があることを確認。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback 38ceabfe-9ea0-4e6c-bf9f-98d56a04a8b1 --config releases/unfold-translucent-decos-2026-10-17/wrangler.json
```
