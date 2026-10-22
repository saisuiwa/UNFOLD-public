# 画像の収め方（全体・切り抜き）と毎日の部品 10-22 — 公開記録 2026-10-22

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の承認を受けて、既存の Cloudflare Worker `unfold` を更新した。

- 公開ソース：`4152799`（本体の main。`6c8bcb4` までのクラウド・自動の作業の分 ＋ `bfa0ebe` cuts-free のテストの直し ＋ `4152799` 背景「厚みが回る輪」「奥へ進む螺旋」の直し）
- 公開時刻の有効バージョン：`239b806e-ac04-4242-a79c-b338974c9450`
- 復旧先（直前の版・`b708640`）：`5573d544-6cab-4d98-97bd-ac7248c753ba`
- 公開ファイル：43（追加30・変更13・削除0、約1.5MB）。公開前に直前の本番 836/836 の SHA-256 一致を確認、公開後は 866/866 一致（`/release.json` は `4152799`）。
- 本体の main を push した（`6c8bcb4..4152799`）。手元だけにあった cuts-free のテストの直し（`39ac7a5`）は、最新の main の上にのせ直して `bfa0ebe` にした。
- 配布物・照合記録：`releases/unfold-picture-fit-2026-10-22/`（`DRY-RUN.md`、`dry-run-list.json`、`manifest.json`、`before-live-check.json`、`published-delivery.json`、`deploy.log`）。このフォルダは Git 管理外。

## 変わったこと
1. シーケンスと1枚の画像のページ：16:9 と形の違う絵（縦長・横に長い絵・16:10 の画面写真など）を入れる・落とす・差し替える時に、「全体を見せる／画面いっぱいにする（位置と大きさ）／自由に切り抜く」を聞く（「残りも同じ設定で」もある）。スライドの欄から開き直せる。自動保存・`.unfold`・元に戻す・複製にも残り、前の作品の見た目は変わらない（`4596858`。`slide-frame.js`・`slide-frame-dialog.js` を追加、`app.js`・`sequence.js`・`sequence-renderer.js`・`project.js`・`style.css` などは ?v= を上げた）。
2. STUDIO：シーケンスの収め方を同じように描く。「UNFOLD を追加」で、形の違う絵を全体で見せる（`studio/controller.js`・`studio/unfold-layer.js`）。
3. カット割り：毎日の部品 14（背景 depthTorus・depthCoil、カメラ verticalSway、飾り brokenOrbits・dialTicks・orbitingGlints、登場 looseType、退場 lineUnzip、画面効果 rgbSplit・scanBeam・sliceShift・zoomGhost、保持 centerTintPulse、文字の置き方 twoLineRead）と、その見本の動画・写真（`4a245f1`・`f9d2374`・`6c8bcb4`）。
4. カット割りの背景「厚みが回る輪」「奥へ進む螺旋」：線の重なった所で下の絵を濃く塗りすぎていた（不透明度 最大 162／136。決まりは 130 以下）。線を作業用のキャンバスにまとめて描いてから、0.45 の薄さで一度だけ重ねる（最大 108／99。1本だけの所の濃さは前と同じ）（`4152799`）。

## 検証
- `node --test` 592/592（作業フォルダ）。`node tools/verify_daily.mjs` 15ステップすべて PASS（`4152799` で。直す前の中身では、1回目に「工房の見本128個」の途中でブラウザが閉じて止まり、2回目は 15/15）。
- STUDIO のブラウザテスト 60本：`bfa0ebe` で 59本合格（cuts-fx が「厚みが回る輪」で落ちた）。直したあと `4152799` で cuts-fx・cuts・cuts-free・lyric-cut・omakase が合格。`slide-frame-browser` も全部合格。
- 公開後：全ファイルを plain `curl` で取得して、866/866 が SHA-256・Content-Type ともに一致。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback 5573d544-6cab-4d98-97bd-ac7248c753ba --config releases/unfold-picture-fit-2026-10-22/wrangler.json
python3 releases/unfold-picture-fit-2026-10-22/verify_delivery.py before-manifest.json rollback-delivery.json
```
