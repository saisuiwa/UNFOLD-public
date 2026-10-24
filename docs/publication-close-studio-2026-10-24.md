# シーケンスから STUDIO への入口を閉じる — 公開記録 2026-10-24

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の承認を受けて、既存の Cloudflare Worker `unfold` を更新した。

- 公開ソース：`36f6d7b`（本体の main）。毎日のルーティンが 16:45 にダッシュボードから上げた `1e1292f`（毎日の部品 10-24）の上に、STUDIO の入口を閉じた分をのせた物。
- 公開時刻の有効バージョン：`3ba811f9-4470-4730-a169-847a92b87ad1`
- 復旧先（直前の版・`1e1292f`）：`34914884-47d8-4428-80cb-ff13f2c3d654`
- 公開ファイル：24 をアップロード（10-23 の記録から見て、追加16は 10-24 の部品の見本で、16:45 に公開ずみ。変更8）。公開後は 894/894 が SHA-256・Content-Type ともに一致（`/release.json` は `36f6d7b`）。
- 公開前の照合では、10-23 の記録（`f04c2df`）と 3 つが違った（`guide/samples.html`・`studio/cuts/daily-parts.js` は `1e1292f` と同じ中身。`release.json` は 16:45 の版になかった）。ダッシュボードから上げた 10-24 の部品の版で、取りこぼしはない。
- 配布物・照合記録：`releases/unfold-close-studio-2026-10-24/`（`before-live-check.json`、`dry-run-list.json`、`manifest.json`、`published-delivery.json`、`deploy.log`、`deployment-summary.json`）。このフォルダは Git 管理外。

## 変わったこと
1. シーケンス：「06 STUDIO」（曲・歌詞・画像・崩れ方を一式 STUDIO に送る）を外した。MV づくりは MOTION LAB へ移す。シーケンスで曲と歌詞まで入れて `.unfold` に保存し、MOTION LAB の「作品を開く」で開く（MOTION LAB `cd74d15`）。
2. 説明書（`guide/manual.html`）：画面は2つ（1枚モード・シーケンス）に。STUDIO の節は、前の作品のために残した画面の説明として残し、シーケンスの写真を撮り直した。
3. `studio.html` とエンジン（`app/studio/`）は残す。前に STUDIO で作った作品を開いて書き出すためと、MOTION LAB が毎時 `app/studio/cuts/` を写しているため。
4. 毎日の部品 10-24 の 8 個（16:45 に公開ずみの物と同じ）。

## 検証
- `node --test "tools/test/*.test.mjs"` 415 合格・失敗 0。`tools/test/sequence-lyric-tab-browser.mjs` 合格（`#studio-entry` がないこと）。
- 公開後：全ファイルを plain `curl` で取得して 894/894 一致。公開中のシーケンスの画面を開いて、「06 STUDIO」がないこと・タブ・起動・コンソールのエラーなしを確かめた。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback 34914884-47d8-4428-80cb-ff13f2c3d654 --config releases/unfold-close-studio-2026-10-24/wrangler.json
```
