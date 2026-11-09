# 1枚モード「額縁から飛び出す」 — 公開記録 2026-11-09

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を更新した。GLB置き場（`unfold-glb`）は変えていない（`fff7d16b` のまま）。

## サイト（`unfold`）
- 公開ソース：`ef21292`（本体の main）。`0cfe88a` の上。
- 公開時刻の有効バージョン：`ebf771a2-2405-4cbc-ba99-1dbe5908e162`
- 復旧先（直前の版・`2519f3d`）：`fa180462-aff5-47d8-8462-12e34f3d406e`
- 公開前の照合：本番は直前の記録と 910/910 一致（`before-live-check.json`）。
- 公開ファイル：913（9 をアップロード、903 は使い回し）。追加2・変更7・削除0。
  - 追加：`frame-stage.js`（額縁・人物・傾き）、`cutout-align.js`（切り抜きの位置探し。MOTION LAB の `site/lab/cutout.js` から写した物）。
  - 変更：`app.js`・`index.html`・`style.css`、`image-method-worker-entry.js` と作り直した `vendor/image-method-worker.js`（`?v=5`、`image-method-runtime.js`）、`release.json`。
- 公開後：全ファイルを plain `curl` で取得して 912/912 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-frame-popout-2026-11-09/`（Git 管理外）。

## 変わったこと
1. **1枚モードの「03 立体」タブのいちばん下に「◇ 額縁から飛び出す」**。オンにすると、絵が壁（背景色）に掛けた額縁に入る。額縁は金・木・黒の細い額・白いマットの4種類で、キャンバスに描いた1枚の板（光は使わない）。
2. **立体が額縁の手前へ飛び出す**：額縁はそのままで、立体が形になるにつれて「飛び出す大きさ」（0〜100%、はじめは40%）だけ大きくなり、額縁にはみ出す。額縁の大きさ（画面の50〜95%、はじめは78%）も選べる。
3. **切り抜きの人物も飛び出す**：この絵から人物だけを切り抜いた透過PNGを入れると、元の絵のどこにあるかを自動で探して重ねる（切り抜く道具がまわりを詰めていても見つける）。絵が元のままの間は絵にぴったり重なり、絵が崩れはじめると手前へ出て、元どおりになる時に額縁へ戻る。人物は立体より手前、影は壁と絵に落ちる。
4. **額縁の傾き**：なし／ゆっくり左右に振れる／上が奥へ倒れる／右が手前に来る／左が手前に来る／ぐるっと回り込む、と 🎲 おまかせ、傾きの大きさ（6〜20度）。カメラが額縁のまわりを回り込むので、額縁・絵・立体・人物がいっしょに傾き、ずれない。傾いている間は遠近感のあるカメラで描く。絵が崩れはじめてから傾き、元どおりで正面に戻る（最初と最後の1枚は傾きなしと同じ）。
5. **JavaScript の画像メソッド**（爆砕と再誕など）でも額縁が見えるように、描く係（ワーカー）が額縁の時だけ背景を透明にする（`bgAlpha: 0`）。額縁を使わない時とシーケンスは今までどおり。
6. 額縁・傾きの設定はこのブラウザに残る（`unfold-single-frame`）。切り抜きは絵ごとなので、絵を変えたり、ページを開き直したりすると外れる。シーケンスにはまだ入れていない。

## 検証
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 610 合格・失敗 0（`tools/test/frame-stage.test.mjs`：設定の整え方、額縁が画面に収まる、人物と立体の飛び出し方、傾きの向きと最大20度、🎲、切り抜きの位置探し）。
- `node tools/test/frame-stage-browser.mjs`（新しいブラウザの確かめ）：オフは今までと同じ絵、オンで額縁と壁、飛び出す大きさで立体が額縁の外へ、切り抜きの位置（470, 90 を見つけ、色のずれ 0.2）、絵が元のままでは人物がぴったり重なる（0.04%）、崩れると手前に出る、JS の画像メソッドでも額縁が見える、傾きは最初と最後がまっすぐ（0.00%）で途中は傾く、🎲。すべて PASS。`omakase-button-browser.mjs`・`glb-colour-cutout-browser.mjs`・`image-solid-colour-browser.mjs` も PASS。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=0cfe88a` 15 項目すべて PASS（`verify_daily.log`）。
- Wrangler の dry-run：931 を読み込み（913 ファイル + 18 フォルダ）。
- 公開後、本番の `https://unfold.saisuiwa.com/` を新しいブラウザで開き、作者の絵と切り抜き（元の絵より横が詰まった物）で額縁をオンにして、切り抜きが左から 336.7px（色のずれ 3.4）で合い、傾き6種類が並び、「右が手前に来る」で立体と人物が傾いた額縁の手前に出ること、ページのエラーなしを確かめた（`live-check.png`）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback fa180462-aff5-47d8-8462-12e34f3d406e --config releases/unfold-frame-popout-2026-11-09/wrangler.json
```
戻した版では額縁の設定は読まれない（このブラウザに残った設定は害がない）。
