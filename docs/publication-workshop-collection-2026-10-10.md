# 工房11作品と取り込み改善の公開記録 — 2026-10-10

作者の公開承認を受けて、既存Cloudflare Worker `unfold` を更新した。非公開の実験室Site、p5.js移植、制御盤UIは対象外。

- 工房：https://unfold.saisuiwa.com/workshop
- 1枚モード：https://unfold.saisuiwa.com/ 、シーケンス：https://unfold.saisuiwa.com/sequence
- 公開ソース：`dca149d2aac5f983a0d4f3310ced36fff58e034f`。
- 公開時刻：2026-10-10 01:14:06 UTC（10:14:06 JST）。
- 有効な公開バージョン：`a28e4078-cfb4-409c-893c-e54a7dedcb9a`、100%。公開後の `deployments list` で確認。
- 直前の公開バージョン：`ab8cb3ee-e1a6-415a-abbd-05518a1d5e4e`（2026-10-09 15:07 UTC）。
- 公開物：`releases/unfold-workshop-collection-2026-10-10/public/`、366ファイル、41,260,421バイト。
- 公開取得対象：配信ルールの `_headers` を除く365ファイル。
- 外部GitHub pushなし。費用・権限・バインディングの追加なし。

## 配布物の作成と照合

10月7日の既知リリースにある静的素材はSHA-256を検査して保持し、Gitの `dca149d` にある `app/` のファイルを `git show` から取り出して重ねた。`app/` の未管理ファイルを一括アップロードしていない。直前ソース `a0f8fb0` に対する13ファイル追加・13ファイル更新。

デプロイ前に現行サイトの352ファイルすべてが、直前ソース＋既知素材と一致することを確認した。現在の公開が古い10月7日版のままだと仮定せず、10月9日の変更を維持した。

個人の画像・音楽・下書き・作品ファイル・認証情報、LibraryのZIP原本と検証記録は公開フォルダに含まない。追加サムネイル11枚は合成画像と試し文から作った実描画。

既存Wrangler 4.131.1でdry-run成功後、既存設定と `--keep-vars` を使用して公開。Wranglerは57ファイルをアップロード、308ファイルを再利用した。配布物の実ファイル数と公開で取得するパス数は上記マニフェストが基準。

## 公開後の確認

すべて隔離されたChromeと合成画像・試し文で実施。ユーザーの実ブラウザ保存データは変更していない。

- **全365配信ファイル：SHA-256一致、欠落0。** JS・CSS・HTMLのContent-Typeも一致。`published-delivery.json`。
- **11見本カード：** 名前・種類・初期設定の自動入力と実描画。`browser/ui-results.json`、`browser-test.log`。
- **読み込み・保護：** 既知JS、未知JSの種類選択と取消、不正なmanifest／構文、読み込み時の非実行、重複読み込み・追加、別の保存カードの未確定編集保持、リロード、強さだけの変更のリセット、390px幅。
- **画像4作品×両モード＝8件：** 金継ぎ陶片・水滴レンズ・織り写真・銀箔うねり。1枚の立体化OFFとシーケンスの「形にしない」が自動で引き継がれ、実worker描画を確認。選択外の◆を維持しUndoも確認。`integration/integration.json`。
- **文字7作品×3ケース＝21件：** 短い日本語・長文・複数行、ゴシック・明朝・丸文字、横長と縦長。実Troikaの表示範囲、日本語折り返し、部分色／通常色の実画素、逆シークでの画素一致。`text/results.json`。
- **MVシーケンスの文字7作品：** 明朝・強調色・長い日本語で各モーションを実適用し描画。`lyric-sequence/results.json`、各PNG。文字モーションの適用先はシーケンスの歌詞（1枚モードには歌詞機能なし）。
- 上記検証のページ例外・クラッシュ0。アプリソースの公開後修正・再デプロイは不要だった。
- 公開直前のNodeテスト362件成功、失敗0・スキップ0。`unit-tests.tap`。

アプリ・ランタイムのローカル検証の詳細は [workshop-collection-2026-10-10.md](workshop-collection-2026-10-10.md)。Safari/iPhone実機、11作品すべての動画書き出し、長時間負荷試験は未実施。

## 証跡・再確認

`releases/unfold-workshop-collection-2026-10-10/`：`manifest.json`、`before-manifest.json`、`before-delivery.json`、`published-delivery.json`、`deploy.log`、`deployments-after.log`、各テストログ・実描画画像。

```
python3 releases/unfold-workshop-collection-2026-10-10/verify_delivery.py manifest.json published-delivery.json
UNFOLD_BASE_URL=https://unfold.saisuiwa.com/ node releases/unfold-workshop-collection-2026-10-10/checks/public-browser.mjs
UNFOLD_BASE_URL=https://unfold.saisuiwa.com/ node releases/unfold-workshop-collection-2026-10-10/checks/public-text.mjs
UNFOLD_BASE_URL=https://unfold.saisuiwa.com/ UNFOLD_TEST_OUT=/Volumes/ORICO/UNFOLD/releases/unfold-workshop-collection-2026-10-10/integration node tools/test/workshop-collection-integration.mjs
node releases/unfold-workshop-collection-2026-10-10/checks/public-lyric-sequence.mjs
```

## 使用と復旧

開いたままの工房は、編集中のものを保存してから再読み込みする。サイトデータの削除は不要。「画像・立体・物理」「文字モーション」で追加見本を選べる。

必要時だけ行う復旧（未実行）：

```
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback ab8cb3ee-e1a6-415a-abbd-05518a1d5e4e --config releases/unfold-workshop-collection-2026-10-10/wrangler.json --message 'Restore pre-collection workshop'
```

復旧後は `before-manifest.json` を使って352配信ファイルを照合する。
