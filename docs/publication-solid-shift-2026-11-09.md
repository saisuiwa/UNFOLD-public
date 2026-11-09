# 額縁から飛び出す：立体をずらす — 公開記録 2026-11-09

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を更新した。GLB置き場（`unfold-glb`）は変えていない（`fff7d16b` のまま）。

## サイト（`unfold`）
- 公開ソース：`034e280`（本体の main）。`554dcf5` の上。
- 公開時刻の有効バージョン：`8133ffd7-3ad1-4498-8df5-1fdbbf49d210`
- 復旧先（直前の版・`1b2b2e1`）：`58528f7e-1f81-47ba-b378-ef5fefd0aef2`
- 公開前の照合：本番は直前の記録と 912/912 一致（`before-live-check.json`）。
- 公開ファイル：913（5 をアップロード）。追加0・変更5（`app.js`・`frame-stage.js`・`index.html`・`style.css`・`release.json`）・削除0。
- 公開後：1回目の照合では `app.js` だけ前の版が返った（反映待ち）。1分おいた2回目で、全ファイル 912/912 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-solid-shift-2026-11-09/`（Git 管理外）。

## 変わったこと
作者が GLB の立体と切り抜きの人物を同時に飛び出させたら重なったので、「立体を右などにずらせたら、どっちも飛び出せる」を受けて足した。
- 「◇ 額縁から飛び出す」の「飛び出す大きさ」の下に「立体を左右にずらす」「立体を上下にずらす」（-100〜100%、絵の幅・高さの半分まで）と「真ん中に戻す」。
- 立体は形になるにつれてずれ、元の絵に戻る時に真ん中へ帰る（最初と最後の絵は今までと同じ）。JavaScript の画像メソッドでも同じ（ワーカーにはカメラの動きとして渡す）。
- `frame-stage.js` の `solidShift`、設定は `solidX`・`solidY`（このブラウザに残る）。

## 検証
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 613 合格・失敗 0（ずれは立体になる分だけ、最大で絵の半分）。
- `node tools/test/frame-stage-browser.mjs`：つまみで立体の真ん中が右へ（0.49 → 0.70）、最初と最後の絵は同じ、「真ん中に戻す」。すべて PASS。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=554dcf5` 15 項目すべて PASS（`verify_daily.log`）。
- 公開後、本番を新しいブラウザで開き、作者の絵と切り抜きで「立体を左右にずらす」85% が効くこと、つまみ・「真ん中に戻す」があること、ページのエラーなしを確かめた（`live-check.png`）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback 58528f7e-1f81-47ba-b378-ef5fefd0aef2 --config releases/unfold-solid-shift-2026-11-09/wrangler.json
```
