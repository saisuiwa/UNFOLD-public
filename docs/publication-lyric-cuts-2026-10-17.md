# STUDIO カット割り・6つのお願い・使い方ページ — 公開記録 2026-10-17

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

既存の Cloudflare Worker `unfold` に公開した。公開ソースは `780034d`（ブランチ `claude/lyric-cuts`。origin/main `4498104`＝毎日サンプル 2026-10-16 を取り込み済み）。

- 公開時刻の有効バージョン: `848fb944-5309-4412-9968-81ebf28ae863`
- 復旧先（直前の版・`ec0e420`）: `9b509c6d-701b-4a94-b38b-ee7c49311934`
- 公開ファイル: 50（追加24・変更26・削除0、約3.1MB）。公開前に直前の本番 657/657 のSHA-256一致を確認、公開後は 681/681 一致（`/release.json` は `780034d`）。
- 配布物・照合記録: `releases/unfold-lyric-cuts-2026-10-17/`（`DRY-RUN.md`、`manifest.json`、`published-delivery.json`、`deploy.log`）。このフォルダは Git 管理外。

## 変わったこと
1. **STUDIO おまかせ「カット割り」**（`app/studio/cuts/`）: 歌詞1行を短いカットに割り、カットごとに背景・カメラ・画面効果・つなぎ・字ごとの登場/保持/退場/加工・物の世界（チケット・フィルム・字幕帯…）を変える。計画は歌詞ごと（`lyric.cut`）と自由文字（`clip.settings.cut`）に保存。詳しくは `docs/lyric-cuts-2026-10-17.md`。
2. **6つのお願い**: 字幕帯の長さを文字に合わせる／「新しいMV」の確認と「↩ さっきの作品に戻る」・保存した作品の一覧に日時など／歌詞を選ぶと「✂ この歌詞をカット割りにする」・おまかせの演出は見えるボタン2つ／ショートは上のバーの窓へ／上のバーのボタンを役割ごとに色分け／使い方のページ。
3. **使い方のページ** `guide/manual.html`（写真8枚、`tools/manual/shoot.mjs` で撮り直せる）。ガイドのメニューに「使い方」、STUDIOの上のバーに「？」。guide.css?v=3（メニューの間隔を少し詰めた）。
4. 毎日サンプル 2026-10-16（ワイパーで払われる・ぴょんぴょん跳ねるタイル・水面にゆらいで止まる）。

## 検証
- Nodeテスト 557（554成功・3 skip・0失敗）。STUDIO ブラウザテスト 60本すべて成功（1本ずつ。reload-lease と marker は、ほかの重い処理と同時に走らせた時だけ1回落ち、単独では成功）。
- `node tools/verify_daily.mjs`: 13ステップすべて成功（この機械では Playwright を `NODE_PATH` で渡した）。
- 途中で直したテスト: `omakase.test.mjs` の「保存した動き」のテストが、10/16 の毎日サンプルで候補が1つ増えて origin/main でも落ちていた（種を探す形に）。見本の保存レシピに version:1 がなかった。
- 公開後の本番（実Chrome・ヘッドレス）: STUDIO の上のバーに4つの組・ショートのボタン・演出のボタン2つ、使い方のページの写真8枚、サンプル集134枚とメニューの「使い方」。本番のモジュールで、歌詞1行のカット計画（3カット）を作って描け、文字が出る。ページ例外・4xx/5xx なし。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback 9b509c6d-701b-4a94-b38b-ee7c49311934 --config releases/unfold-lyric-cuts-2026-10-17/wrangler.json
python3 releases/unfold-lyric-cuts-2026-10-17/verify_delivery.py before-manifest.json rollback-delivery.json
```
