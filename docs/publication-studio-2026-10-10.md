# STUDIOの本体統合・公開記録 — 2026-10-10

作者の明示的な承認を受けて、検証済みSTUDIOをmainへ早送り統合し、既存Cloudflare Worker `unfold` に公開した。GitHub pushなし。個人の素材・作品・テスト・作業記録・認証情報は公開していない。

- STUDIO: https://unfold.saisuiwa.com/studio
- 旧シーケンス: https://unfold.saisuiwa.com/sequence （05 STUDIOから移動）
- 工房: https://unfold.saisuiwa.com/workshop
- 公開ソース: `0bc28e570dbfd192f87991ba55b220c587526df8`
- 完成コード `44ca5b0` に、公式 `bump_module_version.mjs` による旧シーケンスのキャッシュ更新だけを追加した。
- Cloudflare公開時刻: 2026-10-10 06:11:57 UTC。
- 有効なバージョン: `173e0e1e-47ce-4869-bfe9-350761f6d2f1`、100%。
- 復旧先: `a28e4078-cfb4-409c-893c-e54a7dedcb9a` （直前の工房11作品版）。
- mainは変更前 `5977480` からfast-forward。既存差分なしを確認。専用ブランチ `codex/studio-completion` とworktreeは保持。
- 公開後のREADME・本記録などの文書コミットは公開ソースに含めない。公開版は `/release.json` と各アプリファイルのSHA-256で確認できる。

## 配布物と検証

直前の公開365ファイルを実URLから取得して全ハッシュ一致を確認した。既知リリースの同梱静的素材をハッシュ検証して保持し、今回コミットのGit管理下 `app/` だけを `git show` から重ねた。削除された管理ファイルも差分に従う。作業ディレクトリや未管理のユーザー素材を一括配布していない。

配布物は408ファイル、43,161,087バイト。`_headers` を除く公開取得対象407ファイルはすべてSHA-256一致、欠落0、JS/CSS/HTMLのMIME一致。追加の `release.json` はアプリ名と公開コミットのみ。Wranglerの「421 files」は実装上ディレクトリ13個も数えた表示で、ファイル監査の基準はmanifestの408件。

Mediabunny1.61.3 / p5.js2.3.3 / esbuild0.25.10を再ビルドし、管理済み生成物との差分なし。既存Wrangler4.131.1と既存設定、`--keep-vars` を使用しdry-run成功後に公開。52ファイルをアップロード、355ファイルを再利用。バインディング・公開先・権限の追加なし。

## 実行結果

すべて独立したChrome BrowserContextと合成素材を使用し、ユーザーの実ブラウザ保存データには触れていない。

- キャッシュ更新後の専用worktree全Nodeテスト: 404成功、0失敗、3既存skip。
- main統合後の全Nodeテスト: **407成功、0失敗、0skip**。mainには既存の比較用素材があるため、worktreeで省略される3件も実行された。
- キャッシュ更新後のSTUDIO UI、編集UI、実UNFOLDを含む統合UI成功。
- 旧工房4系列の回帰: 11見本と取り込み保護、画像4作品実描画、文字7作品×3ケース・書体・色・逆シーク、工房から両モードへの8連携が成功。
- 配布物そのものをローカルで実操作してから、**本番URLでも同じ検証を再実行**。
- 本番05入口、横縦切替、工房「弾力活字」の名前と設定をコピーする配置、曲・歌詞の位置固定、縦のXのみ変更し横を保持、合成曲を含むブラウザ保存・再読込、自己完結した作品ファイルの読込検証が成功。
- 本番UIから横1920×1080の8秒MP4（240フレーム）と縦1080×1920の2〜4秒切出しMP4（60フレーム）を出力。実H.264/AACを全フレーム・音声デコードし、映像と音声の終端は8秒/2秒、音声RMSは約0.060/0.060、実画素ありを確認。ネイティブ保存先ダイアログのみテスト用メモリsinkに置換し、レンダラー・エンコーダー・muxerは製品コードを使用した。
- 本番工房→1枚モード／旧シーケンス: 金継ぎ陶片・水滴レンズ・織り写真・銀箔うねり、8連携の実worker描画成功。
- 本番STUDIO・旧連携ともページ例外・クラッシュ0。
- 30秒混合と180秒全曲相当の検証は公開前の完成コードで実施済み。公開サイトで180秒全体を再出力したとの主張はしない。詳細は [実装検証](studio-validation.md)。

## 利用上の注意・未検証

再読み込み時に前ページの編集権限解放が間に合わないと、保存作品が読取専用で開くことがある。書き込み権限は自動で奪わず、「このタブで編集」で明示的に取得すると、保存済みの素材・配置を保持して編集とファイル保存に戻れる。本番でこの復帰手順も確認済み。サイトデータを消す必要はない。

開いたままの旧画面は作品を保存してから再読み込みする。p5は同梱演出1種。縦のUNFOLDは横構図を収める方式で、文字／シルエットを変形先にする機能は未対応。普通の文字・歌詞レイヤーは対応。実曲、iPhone、他ブラウザ、人による試聴、長時間の実GPUメモリ負荷は未検証。

## 証跡と復旧

`releases/unfold-studio-2026-10-10/` に配布物、前後manifest、SHA検証結果、dry-run/deploy/deploymentsログ、main全テスト、実URLテストスクリプト、実画面PNGと出力MP4を保存。`public/` 以外は公開していない。

- `browser/report.json`: 本番STUDIO検証。`browser/studio-wide.png`、`browser/studio-tall.png`、`browser/public-wide.mp4`、`browser/public-short-tall.mp4`。
- `legacy-integration/integration.json`: 本番旧工房8連携。
- `preflight-browser/`: 公開前の同一配布物検証。
- `published-delivery.json`: 全407配信ファイルの照合。

再確認:

```sh
python3 releases/unfold-studio-2026-10-10/verify_delivery.py manifest.json published-delivery.json
UNFOLD_BASE_URL=https://unfold.saisuiwa.com/ node releases/unfold-studio-2026-10-10/checks/studio-public.mjs
```

必要時のみ行う復旧（今回は未実行）:

```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback a28e4078-cfb4-409c-893c-e54a7dedcb9a --config releases/unfold-studio-2026-10-10/wrangler.json --message 'Restore pre-STUDIO workshop release'
python3 releases/unfold-studio-2026-10-10/verify_delivery.py before-manifest.json rollback-delivery.json
```

復旧は公開ファイルだけを戻し、ローカルSTUDIOのIndexedDBを削除しない。
