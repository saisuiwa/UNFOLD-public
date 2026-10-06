# 画像の質感エフェクト8種の公開記録 — 2026-10-06

作者の承認を受けて、既存Cloudflare Worker `unfold` を更新した。

- 工房：https://unfold.saisuiwa.com/workshop
- 1枚モード：https://unfold.saisuiwa.com/ 、シーケンス：https://unfold.saisuiwa.com/sequence
- 公開ソース：`59ff02d67952ee3667fe1b201c6a3b2f10c54252`（機能コミット `af0181e`）。
- 公開バージョン：`9ef49bf7-ec76-43d7-a26f-506334c85022`。
- 直前の公開バージョン：`7f1a9895-46a6-4637-9d35-d86364e271c9`。
- 公開物：`releases/unfold-surface-effects-2026-10-06/public/`。303ファイル、39,163,943バイト。配信取得対象は `_headers` を除く302ファイル。
- 既存Wrangler 4.131.1のdry-run成功後、`deploy --keep-vars` にて16ファイルの追加・更新を公開。Wranglerの内部パス込みの表示は312だが、物理ファイルは303、取得対象は302。
- GitHub pushなし。旧版リリースとCloudflareバージョンを保持。

## 対象

前の公開物をマニフェストのSHA-256で確認してコピーし、Git管理済み `app/` のみ上書きした。

新規は `image-surface-burn.js`、`image-surface-presets.js`、合成画像から作った見本JPEG8枚。更新は画像メソッド選択・工房・3つのHTMLエントリ。既存のGLSLやWorker本体、CPU画像転送経路は変更していない。写真、曲、個人のプロジェクト、下書き、認証情報は公開対象に含めていない。

## 検証

- 公開前：Nodeテスト321件成功、失敗0。
- 公開URLの302ファイル全てが今回のSHA-256と一致。JS/CSS/HTMLのContent-Typeも確認。
- 公開工房：GLSL・画像JavaScript・文字JavaScriptの描画、保存、下書き復帰を確認。1枚モードとシーケンスへの連携・Undoも確認。
- 追加8種類：実Worker描画、時刻1.8秒の異なる画素、逆シークの画素ハッシュ一致、0/6秒の画像復帰、強さ0、B画像への復帰を確認。8つのカード選択、立体化なしの初期設定、ライブラリ保存、従来エディタも確認。
- 8種類×1枚モード/シーケンスの16通りを公開URL上で適用し、Worker描画フレーム受信を確認。
- 実描画サムネイル8枚の表示、390px幅で横はみ出しなし。ページ例外・シェーダーエラー・クラッシュ0。

一時的な隔離Chromeと合成画像のみ使用。iPhone/Safari実機と長時間の動画書き出しは未検証。確認用のコードや画像はブラウザ内で処理し、個人のプロファイルを使っていない。

再確認用：`UNFOLD_BASE_URL=https://unfold.saisuiwa.com/` とともに `tools/test/workshop-publication.mjs`（`UNFOLD_RELEASE_DIR` で今回のリリースフォルダを指定）、`image-surface-browser.mjs`、`image-surface-integration.mjs`（後2つは `UNFOLD_TEST_OUT` で証跡フォルダを指定）。

証跡：リリースフォルダの `manifest.json`、`published-verification.json`、`published-browser.json`、公開画面PNG、`surface-check/results.json`、`surface-check/integration.json`、8種類のフレームと工房PNG。

## 使い方と復旧

工房の「画像・立体・物理 JavaScript」でカードを選び、「＋ UNFOLDに追加」。作品側では1枚モードの「立体化する」をオフ、シーケンスの形を「形にしない」にする。プレビューの形設定で既存作品を自動変更しない。開始・終了は画像へ戻る。

古い画面が残る場合は、編集中の作品を保存してから再読み込みする。サイトデータを削除する必要はない。

必要時の復旧（未実行）：

```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback 7f1a9895-46a6-4637-9d35-d86364e271c9 --config releases/unfold-surface-effects-2026-10-06/wrangler.json --message 'Restore pre-surface-effects workshop'
```

旧公開物は `releases/unfold-workshop-2026-10-06/` に保持。
