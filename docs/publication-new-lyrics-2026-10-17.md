# 見本の歌詞の差し替え・カット割りの部品8個・公開用リポジトリ — 公開記録 2026-10-17

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の承認を受けて、既存の Cloudflare Worker `unfold` を更新し、ソースの公開用リポジトリ `saisuiwa/UNFOLD-public` を作った。

## サイト（unfold.saisuiwa.com）
- 公開ソース：`c99e262`（本体の main）。
- 公開時刻の有効バージョン：`955f1d37-d2c3-4ac4-9117-765731c91412`
- 復旧先（直前の版・`780034d`）：`848fb944-5309-4412-9968-81ebf28ae863`
- 公開ファイル：29（追加18・変更11・削除0、約1.7MB）。公開前に直前の本番 681/681 の SHA-256 一致を確認、公開後は 699/699 一致（`/release.json` は `c99e262`）。
- 配布物・照合記録：`releases/unfold-new-lyrics-2026-10-17/`（`DRY-RUN.md`、`dry-run-list.json`、`manifest.json`、`published-delivery.json`、`deploy.log`）。このフォルダは Git 管理外。

### 変わったこと
1. STUDIO のカット割りの見本の文（部品の検査に使う `plan.js` の `SAMPLE_CUT`）を、参考ツール のサンプルの文から、オリジナルの歌詞に差し替え。
2. 使い方のページの STUDIO の写真5枚（`guide/manual/studio-0`〜`4.jpg`）を、新しい歌詞で撮り直し。公開サイトの、ほかの文字のファイルにも古い見本の歌詞は残っていない。
3. まだ公開していなかった、カット割りの部品8個（`studio/cuts/daily-parts.js`・`kit.js` と、`glyphs.js`・`parts.js`・`worlds.js` の小さな受け口）と、サンプル集のプレビュー16個・`guide/samples.html`。

### 検証
- `node --test` 560/560、STUDIO のブラウザテスト（歌詞を使う6本）、`node tools/verify_daily.mjs` 14ステップ PASS（公開ソースと同じ中身で）。
- 公開後：全ファイルを plain `curl` で取得して、699/699 が SHA-256・Content-Type ともに一致。

### 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback 848fb944-5309-4412-9968-81ebf28ae863 --config releases/unfold-new-lyrics-2026-10-17/wrangler.json
python3 releases/unfold-new-lyrics-2026-10-17/verify_delivery.py before-manifest.json rollback-delivery.json
```

## 公開用リポジトリ（github.com/saisuiwa/UNFOLD-public）
- 本体（非公開の `saisuiwa/UNFOLD`）はそのまま。公開用は、本体の main を `node tools/public_mirror.mjs --push` で写したもの（手順は `docs/公開用リポジトリへの反映.md`）。
- 初回：本体の main `44edec0`（MIT ライセンスを追加したコミット）＝ 公開用の main `cfc784a`、186 コミット。1,510 個の文字のファイルの版とすべてのコミットメッセージを検査して、消したい言葉の残りなし。コミットのメールは noreply だけ。新しく clone して、最新のファイルが本体と同じことを確認。
- ライセンス：MIT（`LICENSE`、GitHub も MIT と認識）。`app/vendor/` の同梱ライブラリとフォントは、それぞれのライセンスに従う（README に注記）。
- 毎日のルーティンは、今までどおり本体に push する。公開用への反映は、毎回作者の OK を取ってから。
