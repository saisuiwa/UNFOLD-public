# サイトの整理（文字系を非公開・歌詞タイミングを削除・説明と使い方の見直し） — 公開記録 2026-11-08

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を更新した。GLB置き場（`unfold-glb`）は変えていない（`fff7d16b` のまま）。

## サイト（`unfold`）
- 公開ソース：`2519f3d`（本体の main）。`7bee719` の上。
- 公開時刻の有効バージョン：`fa180462-aff5-47d8-8462-12e34f3d406e`
- 復旧先（直前の版・`2690985`）：`8da11996-d44b-4ec8-be0f-6391589763db`
- 公開前の照合：本番は直前の記録と 915/915 一致（`before-live-check.json`）。
- 公開ファイル：911（12 をアップロード、898 は使い回し）。追加0・変更12・削除5。
  - 変更：`guide/index.html`・`guide/manual.html`・`guide/samples.html`・`guide/methods.html`・`guide/glb.html`・`guide/code-motions.html`・`workshop.html`・`workshop.js`・`lyric-controls.js`・`sequence.js`・`sequence.html`、`release.json`。
  - 削除：`guide/motions.html`・`guide/motions.js`（モーション集）、`lyric-sync/index.html`・`align.js`・`snap.js`（歌詞タイミング）。本番で5つとも 404 を確かめた。
- 公開後：全ファイルを plain `curl` で取得して 910/910 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-site-cleanup-2026-11-08/`（Git 管理外）。

## 変わったこと
1. **シーケンスの「05 曲・歌詞」→「3 曲に合わせる」**：ElevenLabs の歌詞タイミングへのリンクと説明、「タップで合わせる」「途中から再開」・TAP の枠、「タイミングを保存」を外した。残りは「歌詞を曲に合わせる（自動）」「SRTで保存」「動画の書き出しへ」。合わない所はタイムラインの歌詞の箱で直す。
2. **サンプル集**：「崩れ方」「グラフィックモーション」「画像・立体・物理（JavaScript）」の29個だけを載せる（`tools/lib/samples-catalog.mjs` の `PUBLIC_GROUPS`）。文字モーション（コード）・エフェクト・カット割りの部品・文字の動き（かんたん設定）は載せない。見本の動画は、毎日の確かめと部品づくりが使うので、サーバーに残している（どこからもリンクしない）。
3. **メソッド工房**：「文字モーション」「エフェクト」のタブを外した（`workshop.js` の `HIDDEN_VIEWS`。そのどちらかを開いたままだった下書きは、最初のサンプルで開く）。「組み合わせで作る文字モーション →」のリンクも外し、上のメニューを「説明・メソッド集・サンプル集・GLB置き場」にした。
4. **モーション集**：サイトから外して `docs/非公開ページ/guide/` に移した（戻し方は `docs/非公開ページ/README.md`）。そのページにあった「歌詞MVで使う」ボタンも消えた。
5. **歌詞タイミング**（`lyric-sync/`）：削除。「歌詞を曲に合わせる（自動）」に置きかわった。テスト3つ（`lyric-sync.test.mjs`・`lyric-snap.test.mjs`・`lyric-sync-snap-browser.mjs`）も消した。
6. **メニュー**：全部のページから「モーション集」「歌詞タイミング」を外した（`build_guide_samples.mjs`・`build_guide_methods.py` の作るページも）。
7. **説明**：崩れ方60種類以上と 🎲 おまかせ、色つきの立体と25種類の立体の動き、歌詞の自動の時刻合わせと SRT、曲は送らない（初回だけ約250MBの聞き取りの仕組みを読み込む）を書いた。歌詞MVの項目は外した。
8. **使い方**：写真の番号はそのまま、おまかせ・立体の動き・◆で変えられることを足し、「◆の動きが速い・元に戻したい時」と「曲と歌詞（05 曲・歌詞タブ）」を足した。STUDIO は「前に作った作品のために画面を残しています」の短い説明だけにした。
9. **毎日の確かめ**（`tools/verify_daily.mjs`）：見るページからモーション集とコードモーションの書き方を外して使い方を足し、サンプル集は載せる分類だけ、工房は GLSL と画像だけを見るようにした。毎日の部品づくりの手順書（`docs/daily-samples-routine.md`）に、部品はサンプル集に出ないことを書いた。
10. 工房のテスト：エフェクトのタブのテスト2つを消し、`workshop-browser.mjs`・`workshop-extended.mjs` は「タブが無い」を確かめる形にした。

## 検証
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 603 合格・失敗 0（消したテストの分だけ減った）。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=7bee719` 15 項目すべて PASS（`verify_daily.log`。サンプル集 29 枚、工房 29 個）。
- `node tools/test/lyric-song-tools-browser.mjs`、`workshop-browser.mjs`・`workshop-extended.mjs`（8778 番で配って）すべて PASS。
- Wrangler の dry-run：930 を読み込み（911 ファイル + 19 フォルダ）。
- 公開後、本番を新しいブラウザで開き、説明・使い方・サンプル集のメニューが「説明・使い方・メソッド集・サンプル集・GLB置き場・メソッド工房」、サンプル集 29 枚、工房のタブが GLSL と画像だけ、「3 曲に合わせる」のボタンが自動・SRT・書き出しだけ、ページのエラーなしを確かめた（`live-check.png`）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback 8da11996-d44b-4ec8-be0f-6391589763db --config releases/unfold-site-cleanup-2026-11-08/wrangler.json
```
