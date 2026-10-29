# ハロウィンの色つき形・立体の動き・立体の長さ — 公開記録 2026-10-29

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、既存の Cloudflare Worker `unfold` を更新した。

- 公開ソース：`c071624`（本体の main）。`722ed9f`（毎日の部品とカット割りのエンジンは MOTION LAB へ引っ越した）の上。
- 公開時刻の有効バージョン：`1226850c-6032-4125-aa1c-f1b15d104f1b`
- 復旧先（直前の版・`36f6d7b`）：`3ba811f9-4470-4730-a169-847a92b87ad1`
- 公開前の照合：本番は 10-24 の記録（`36f6d7b`）と 894/894 一致（`before-live-check.json`）。
- 公開ファイル：907（30 をアップロード、876 はアップロード済みの物を使い回し）。追加12（ハロウィンの GLB 10個・`solid-motion.js`・`solid-length.js`）、変更18（`studio/cuts/daily-parts.js` は `722ed9f` の分）、削除0。約77.8MB。
- 公開後：全ファイルを plain `curl` で取得して 906/906 が SHA-256・Content-Type ともに一致（`_headers` を除く。`/release.json` は `c071624`）。
- 配布物・照合記録：`releases/unfold-halloween-solid-motion-2026-10-29/`（`before-live-check.json`、`dry-run-list.json`、`manifest.json`、`published-delivery.json`、`deploy.log`、`deployment-summary.json`）。このフォルダは Git 管理外。

## 変わったこと
1. 色つきの形に、ハロウィンの10体（かぼちゃ・おばけ・魔女の帽子・黒猫・コウモリ・ドクロ・ほうき・魔女の大鍋・お菓子バケツ・お墓）。Tripo でテクスチャ付きで作った GLB（`assets/models/halloween/`、1体 1.2〜1.8MB、選んだ時に初めて読む）。
2. 立体の動き：立体になっている間だけ、形ごと動く12種類（ゆらゆら・ふわふわ・ぽよん・ぴょんぴょん・ぶるぶる・ぶらんこ・8の字に飛ぶ・ドキドキ・きょろきょろ・ひらひら舞う・ぐいっと寄る・ぷるぷる）と、形に合う動きを選ぶ 🎲おまかせ。1枚モードとシーケンスの◆で使え、シーケンスでは拍に合わせる。「なし」は今までと同じ絵。
3. 立体の長さ：立体ができる・崩れるのを速くして、そのぶん立体のままの時間を長くする（100%で約4倍）。変化の始まり・終わり・長さは変わらない。0%は今までと同じ絵。シーケンスではプロジェクトに保存。
4. シーケンスの `shot-motion.js` と `sequence-core.js` の読み込みに版番号を付けた（古い版がキャッシュに残って、新しい設定が効かないのを防ぐ）。

## 検証
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 607 合格・失敗 0。
- `tools/verify_daily.mjs --base=36f6d7b` 15 項目すべて PASS（このマシンには Playwright の同梱ブラウザがないので `UNFOLD_CHROMIUM` に Google Chrome を指定）。
- `tools/test/solid-motion-browser.mjs`・`tools/test/image-solid-colour-browser.mjs` 合格。立体の動き「なし」・立体の長さ 0% は、変更前の版と画素まで同じ（1枚モード・シーケンス）。
- 公開後：1枚モードでおばけ・🎲おまかせ・立体の長さ、シーケンスで立体の長さのスライダーが動き、コンソールのエラーなし。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback 3ba811f9-4470-4730-a169-847a92b87ad1 --config releases/unfold-halloween-solid-motion-2026-10-29/wrangler.json
```
