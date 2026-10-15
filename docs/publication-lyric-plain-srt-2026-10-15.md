# 歌詞は常に一文字ずつ・SRT取り込み・APIキーなしのタイミング合わせ — 公開記録 2026-10-15

既存Cloudflare Worker `unfold` に公開した。公開ソースは `ec0e420`（`main` の `bf7f84b` ＋ 下の3つ）。

- 公開時刻の有効バージョン: `9b509c6d-701b-4a94-b38b-ee7c49311934`
- 復旧先（直前の版・`bf7f84b`）: `27994e4f-9515-4a36-ba6b-a8fb5da4f3b4`
- 公開ファイル: 23（追加2・変更21・削除0）。公開前に直前の本番 655/655 のSHA-256一致を確認、公開後は 657/657 一致（`/release.json` は `ec0e420`）。
- 配布物・照合記録: `releases/unfold-lyric-plain-srt-2026-10-15/`（`DRY-RUN.md`、`manifest.json`、`published-delivery.json`、`deploy.log`）。このフォルダは Git 管理外。

## 変わったこと
1. **シーケンス 05 曲・歌詞（`87637cb`）**: 歌詞は常に一文字ずつ（`plainLyricView` / `assignLyricMotions({plain:true})`）。「歌詞の見え方」の枠と「歌詞を表示」ボックスは無くなり、動きは STUDIO の「おまかせ」で決める。古い版で非表示にした歌詞は「歌詞を表示する」で戻せる。文書そのものは変えない（STUDIO には元のまま渡る）。
2. **`.srt` の取り込み（`4d9a95e`）**: 05 曲・歌詞の「歌詞ファイル（LRC / SRT / JSON / TXT）」で `.srt` を選べる。BOM・CRLF・番号なし・`.` の小数点・`<i>` などのタグを許し、複数行は `/` でつなぐ。開始と終了は秒。
3. **歌詞タイミング合わせ「APIキーなしで合わせる」（`42d7d6d`）**: 目安の SRT/LRC/JSON（無料のMP3→SRTサイトやWhisperなど）を読み込み、「声の立ち上がりに合わせる」で曲の声の帯域（約250〜3500 Hz）の大きさから各行の開始と終わりを動かす。ブラウザの中だけで処理し、曲は送らない。立ち上がりがはっきりしない行は「※推定」、「目安の時刻に戻す」で元に戻せる。
4. JSON/LRC/SRT の読み取りは `lyric-timings.js`（three.js なし）へ移し、`lyric-mv.js` が再エクスポートする。

## 検証
- Nodeテスト 402（399成功・3 skip・0失敗）。合流後のブラウザテスト `sequence-lyric-tab-browser` / `sequence-lyric-srt-browser` / `lyric-sync-snap-browser` 成功。
- `node tools/verify_daily.mjs`: 13ステップ中12成功。通らない1つは「the editor lists every sample under its group」で、`#method-samples` を10秒待つのに、この機械だと 8〜9 秒前後（忙しいと 15 秒）かかる。待ち時間を延ばして単独で同じ検査をすると成功（131項目・グループ一致）。変更前の `main` も同じ程度の時間（`main` 7.4/8.0/8.0 秒、合流後 8.5/8.1/9.3 秒）で、回帰ではなく待ち時間の問題として扱った。直してはいない。
- 公開後の本番（実Chrome）: シーケンス 05 の3セクション、`.srt` 取り込みで一文字ずつの行ができる、歌詞タイミング合わせの「APIキーなし」セクションで SRT が読める。ページ例外・4xx/5xx なし。

## 実曲での確認（公開前）
Codex が作った SRT は、実曲の歌い出しより平均約0.8秒早かった。ASR付きで補正した版を基準にすると、ページの「声の立ち上がりに合わせる」だけ（目安は元のSRT）で、27行中22行が0.3秒以内に合った。外れた行の多くは「※推定」になる。目安の時刻が1秒以上ずれている行は拾えないことがある。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback 27994e4f-9515-4a36-ba6b-a8fb5da4f3b4 --config releases/unfold-lyric-plain-srt-2026-10-15/wrangler.json
python3 releases/unfold-lyric-plain-srt-2026-10-15/verify_delivery.py before-manifest.json rollback-delivery.json
```

## メモ
- `main` のチェックアウトにあった別セッションの未コミット編集（25ファイル）は、公開前に `87637cb` としてコミットし、`main` を `ec0e420` へ早送りした。バックアップのパッチはセッションのノート置き場にある。`tools/methods/geo-grid-lyric-fixed.js`・`tile-burn-fixed.js`（10/14付け・未追跡）は今回の内容と関係がないので、そのまま残してある。
