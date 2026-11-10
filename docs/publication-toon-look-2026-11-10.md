# 「アニメ調の立体」（セル塗り・輪郭線） — 公開記録 2026-11-10

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を更新した。GLB置き場（`unfold-glb`）は変えていない（`fff7d16b` のまま）。

## サイト（`unfold`）
- 公開ソース：`fae592e`（本体の main）。`585a303` の上。
- 公開時刻の有効バージョン：`e510dedd-b5a5-4a8a-8255-098e2949d36e`
- 復旧先（直前の版・`0518ba7`）：`47e1a93f-6642-4230-b54f-9a7dd1eb2d93`
- 公開前の照合：本番は直前の記録と 915/915 一致（`before-live-check.json`）。
- 公開ファイル：917（17 をアップロード）。追加1（`toon-look.js`）・変更16・削除0。変更のうち中身が変わったのは `render-look.js`・`app.js`・`index.html`・`sequence-renderer.js`・`sequence.js`・`sequence.html`・`release.json`。残り（`motion.js`・`effects.js`・`method-preview.js`・`method-trial.js`・`method-editor.js`・`image-method-editor.js`・`render-look-controls.js`・`workshop-preview.js`・`studio/unfold-layer.js`）は読み込みの `?v=` だけ。
- 公開後：全ファイルを plain `curl` で取得して 916/916 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-toon-look-2026-11-10/`（Git 管理外）。

## 変わったこと
作者と試作（`試作/2026-11-10_飛び込む・アニメ調/`、Git 管理外）で見た目を確かめてから、1枚モードとシーケンスに入れた。
- 1枚モード：「◇ アニメ調の立体（セル塗り・輪郭線）」。設定はそのブラウザに残る。
- シーケンス：「04 見た目」の「アニメ調の立体（セル塗りと輪郭線）」。設定（`toon`）は作品（.unfold）に保存する。前の作品は「オフ」。
- 設定：セル塗りのオン・オフ、陰の濃さ、輪郭線の太さ（0 で線なし）、輪郭線の色。シーケンスだけ「輪郭線が拍で光る」（拍ごとに線が太くなり、明るい色に変わる）。
- セル塗り：絵の粒のシェーダーの光の計算（`render-look.js` の `surfaceLight`）を「明るい・暗い」の2段にする（`uToon`・`uToonShade`）。どのページのシェーダーにも入るが、オンにするのは1枚モードとシーケンスだけ。
- 輪郭線（`toon-look.js` の `createOutline`）：立体だけを別の画像（色と奥行き）に撮り、画面と同じ大きさの板がその縁を拾って線を描く。外側のふち（立体がある／ない の境目）と、内側の段差（奥行きが急に変わる所）。板は場面の中で立体のすぐ後に描くので、画面の効果（ぼかし・発光など）は線にもかかり、1枚モードの人物（切り抜き）は線の手前に来る。
- 線は、立体が出来上がっている間だけ出る。粒が閉じきる前（形の進み 99.9 % でも粒は1〜2ピクセル離れている）に線を出すと立体の全部が縁になって真っ黒になるため。「立体の長さ」を長くすると線の出る時間も長くなる。

## 分かっている限り
- なめらかな法線のない形（球などの組み込みの形、雪だるまなどのカラーの形）は、陰の境目が粒の大きさでギザギザになる。色つきのGLB（フィギュア）はなめらか。
- 初めの線の色は黒に近いので、暗い背景では外側の線が見えない（説明文に「線の色を明るくするか、拍で光るを使う」と書いた）。
- JavaScript の画像メソッド（ワーカーが描く）と、STUDIO の共有レンダラーには付かない。

## 検証
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 627 合格・失敗 0（`toon-look.test.mjs`：設定、シェーダーへの渡し方、線が出るのは出来上がった立体だけ、拍で光る）。
- `node tools/test/toon-look-browser.mjs`（新しいブラウザの確かめ）：オフは今までと同じ絵、オンで出来上がった立体に線、粒が集まる途中は線なし、平らな絵はそのまま、線の色と太さ、太さ 0 でセル塗りだけ、線もセル塗りもなしは元の立体、ブラウザに残る、シーケンスでも同じ・拍で光る・作品に保存、美術館と飛び込むを一緒にしてもエラーなし。22 項目すべて PASS。
- 描画まわりの確かめを流し直し：`gallery-walk-browser`（11）・`dive-flow-browser`（19）・`solid-stage-browser`（13）・`frame-stage-browser`（39）すべて PASS。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=585a303` 15 項目すべて PASS（`verify_daily.log`）。
- 公開後、本番の `index.html` と `sequence.html` を新しいブラウザで開き、オフで暗い線なし（0%）、オンで出来上がった立体に線（1枚モード 0.35%・シーケンス 0.37%）、粒が集まる途中は線なし、設定の行が出ること、保存されること、ページのエラー・足りないファイルなしを確かめた（`live-check.png`）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback 47e1a93f-6642-4230-b54f-9a7dd1eb2d93 --config releases/unfold-toon-look-2026-11-10/wrangler.json
```
戻した版では、作品に入ったアニメ調の設定は読まれない（作品は今までどおり開く）。
