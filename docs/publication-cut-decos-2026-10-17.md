# カット割りの部品20個と「装飾」の軸 — 公開記録 2026-10-17

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の依頼（カット割りの素材を埋めていきたい・装飾の軸も作る）で、既存の Cloudflare Worker `unfold` を更新した。

- 公開ソース：`a2cfe86`（本体の main）。
- 公開時刻の有効バージョン：`b42e2cb6-68a1-460e-8f75-f3adf00b9378`
- 復旧先（直前の版・`5d72de8`）：`31b1b8e9-91f0-4509-a2b5-6c60543d7fea`
- 公開ファイル：49（追加41＝プレビュー40と `studio/cuts/decos.js`、変更8）。公開前に直前の本番 718/718 の SHA-256 一致を確認、公開後は 759/759 が SHA-256・Content-Type ともに一致（`/release.json` は `a2cfe86`）。
- 配布物・照合記録：`releases/unfold-cut-decos-2026-10-17/`。このフォルダは Git 管理外。

## 変わったこと
1. カット割りの部品20個（`daily-parts.js`）: 背景5・つなぎ5・保持4・登場2・退場2・カメラ1・画面効果1。サンプル集にプレビュー付きで並ぶ。
2. 新しい軸「装飾」（`studio/cuts/decos.js`）12種。カット割りの細かい設定に「装飾」（初期40%）。詳しくは `docs/lyric-cuts-2026-10-17.md` の「装飾の軸と、部品のまとめ足し」。
3. つなぎの描画にも作業用キャンバス（`tmp`）を渡す（手順書に書いてあったのに渡していなかった）。

## 検証
- `node tools/verify_daily.mjs`（日付指定なし・全部）: 全ステップ PASS（この Mac では Playwright の代わりに別プロジェクトの `playwright-core` と、インストール済みの Chrome を使った）。途中で、ちらつく粒（重なりで濃くなりすぎ）とピクセル転換（つなぎに tmp がなく、ピクセルにならない）が落ちたので直した。
- `node --test`（tools/test 以下）565/565。STUDIO のブラウザテスト cuts・cuts-fx・cuts-free・lyric-cut が成功。
- 公開後：全ファイルの一致、`studio/cuts/decos.js` の配信、サンプル集の新しいカード、設定の「装飾」を確認。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback 31b1b8e9-91f0-4509-a2b5-6c60543d7fea --config releases/unfold-cut-decos-2026-10-17/wrangler.json
```
