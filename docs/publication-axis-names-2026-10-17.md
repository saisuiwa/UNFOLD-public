# カット割りの軸の名前・参考ツールの名前の整理 — 公開記録 2026-10-17

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の依頼（用語を決め直す・参考にしたツールの名前をなくす）で、既存の Cloudflare Worker `unfold` を更新した。

- 公開ソース：`8751dcc`（本体の main）。
- 公開時刻の有効バージョン：`38ceabfe-9ea0-4e6c-bf9f-98d56a04a8b1`
- 復旧先（直前の版・`a2cfe86`）：`b42e2cb6-68a1-460e-8f75-f3adf00b9378`
- 公開ファイル：11（変更のみ）。公開前に直前の本番 759/759 の SHA-256 一致を確認、公開後も 759/759 が SHA-256・Content-Type ともに一致（`/release.json` は `8751dcc`）。公開した全ファイルに、参考ツールの名前が残っていないことを確認。
- 配布物・照合記録：`releases/unfold-axis-names-2026-10-17/`。このフォルダは Git 管理外。

## 決めた用語
- **軸**（カット割りの部品の大きな分け方）: IN（登場）・STAY（保持）・OUT（退場）・STYLE（字の描き方）・DECO（飾り）・BG（背景）・CAM（カメラ）・FX（画面効果）・TRANS（つなぎ）・STAGE（文字を載せる台）。コードの中のキー（`enter` `hold` `exit` `treat` `deco` `bg` `cam` `fx` `trans` `world`）は変えない。
- 「部類」という言葉は使わない。軸の下の、軸をまたいだ動きの種類は「動きの型」（手元の分析資料で使う）。

## 変わったこと
1. `studio/cuts/kit.js` の `AXES` を英語の名前に、`AXIS_HINTS` に添える日本語。サンプル集の部品の説明は「部品（IN・登場）」の形。
2. STUDIO の「カット割りの細かい設定」: CAM・FX・TRANS・STYLE・STAGE・STAGEの濃さ・DECO・STAGEの引き継ぎ（名前の下に日本語を小さく）。いまの案の要約は STAGE・DECO・CAM・FX・TRANS・BG。自動で直した内容のメモも同じ名前に。
3. コードのコメントと文書から参考ツールの名前をなくし、中立な言葉にした（本体の今のファイルに 0 件）。

## 検証
- `node --test`（tools/test 以下）565/565。`node tools/verify_daily.mjs` 全ステップ PASS。STUDIO のブラウザテスト cuts・cuts-free・lyric-cut が成功。設定欄の見た目を撮って確認。
- 公開後：全ファイルの一致と、配信中の `studio/omakase-panel.js` が新しい名前になっていることを確認。

## 公開用リポジトリについて（作り直した）
作者の判断（「過去の版からも消して。作り直して force-push していい」）で、反映の規則に置き換えを足して公開用リポジトリを作り直した。
- `public-mirror/replace-text.txt` に4行（ツールのページの URL・漢字の名前・作者の ID・ツールの名前。大文字小文字を問わない）、`replace-message.txt` に1行、`forbidden.txt` に2行（残っていたら止まる）。
- 作り直した写しで、全部の版の差分・コミットメッセージ・ファイル名に 0 件、いちばん新しい中身は本体と同じ（ツリーが一致）ことを確かめてから、`git push --force`（`99dbfdb` → `fe82c62`）。公開用のブランチは main だけ。
- これで過去のコミットの番号が全部変わった（対応は `public-mirror/commit-map.txt`）。この後の反映は、また早送り（新しいコミットが増えるだけ）になる。
- GitHub は、もう指されていない古いコミットを、番号を知っていれば少しの間見られることがある（いずれ消える）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback b42e2cb6-68a1-460e-8f75-f3adf00b9378 --config releases/unfold-axis-names-2026-10-17/wrangler.json
```
