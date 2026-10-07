# 画像の質感エフェクト8種

2026-10-06。ユーザー承認済みの「質感と派手な演出を混ぜた8種類」を既存の画像JavaScriptサンプルに追加。同日、追加の公開承認を受けて公開済み（[公開・検証記録](publication-surface-effects-2026-10-06.md)）。GitHub pushなし。既存の3つの物理サンプル、GLSL、描画Worker、CPU画像転送経路は変更していない。追加依存なし。

## 使う

[公開工房](https://unfold.saisuiwa.com/workshop) の **画像・立体・物理 JavaScript** を開く。ローカルで試す場合は `app/` を配信して `/workshop.html` を開く。カードを選ぶと「立体化なし」で実動プレビュー。「＋ UNFOLDに追加」でブラウザのライブラリに保存でき、コードのコピー・編集・共有にも対応。

- 焦げ穴と炎：画素単位の焦げ穴、赤熱する縁、炎・薄い煙・64個の火の粉。
- インクのにじみ：3つの染みが繊維に沿って広がる、濃淡のある染色。
- 水彩の溶け出し：流れによる画像のゆがみ、顔料がたまる縁、にじみと透過。
- 凍結と霜：不規則な凍結前線、結晶の面・細かな亀裂・6方向の小結晶。
- 電撃で消失：枝分かれする電撃、発光、色ずれと走査線を伴う消失。
- 酸の侵食：複数の反応点が穴になり、泡立つ黄緑色の縁が接合。
- 絵の具が垂れる：画像を引き延ばす粘性のある流れ、丸い流下端、光沢。
- 紙が風化する：繊維状の浸食、元画像の色を引き継ぐ360個の粒。

従来の「＋追加 → JavaScript＋物理演算で作る」にもサンプルが増える。選択時にソース・名前・パラメータ・プレビューの形が揃う。

**作品側の設定は別**。1枚モードは「03 立体」の「立体化する」をオフ。シーケンスは変形ブロックの形を「形にしない（崩れるだけ）」にする。正面で見たい場合は回転なし。工房のプレビュー設定が既存作品の形を勝手に変更することはない。

これらは画像表面用の演出で、GLBや立体用の別材質には引き継がれない。開始・終了は画像へ復帰する（シーケンスのB画像にも対応）。燃えたままで終了する機能ではない。物理の分割数・重力・反発・戻り方はこれらのシェーダー演出には使用しない。強さと絶対時刻から計算し、同じ時刻は同じ画素に戻る。色・細部はコード内の色定数・式で調整する。

## 実装

- `app/image-surface-presets.js`：共通ノイズ、7つの異なるfragment shader、風化の粒、サンプル定義。
- `app/image-surface-burn.js`：ユーザーが確認した焦げ穴コードを独立した編集可能な関数本体として保持。
- `app/image-method-presets.js`：既存3種類の後に8種類を追加。既存サンプルのインデックス維持。
- `app/workshop.js`：既定プレビューの形・実描画サムネイル、選択中のコードを参考にするAI依頼文。ShaderMaterialの色・透過の扱いも依頼文に明示。
- `app/image-method-editor.js`：サンプル選択時のパラメータ・形、作品側の設定説明。
- `app/assets/surface-previews/`：テストで描いた合成画像だけを使った320×180の見本8枚。ユーザー素材は含まない。

## 検証

追加前、8種類の存在テストとブラウザのサンプル選択テストは `0 !== 8` で失敗することを確認。その後実装。

- `node --test tools/test/*.test.mjs`：321件成功。
- `node tools/test/image-surface-browser.mjs`：8種類の実Worker描画、画素変化・異なる見た目、時刻1.8秒への逆シークのハッシュ一致、0/6秒の原画一致、強さ0、B画像への復帰、8カードの選択と形none、保存、従来エディタのパラメータ切替。ページ・GPUコンパイル・クラッシュのエラー0。
- `node tools/test/image-surface-integration.mjs`：8種類×1枚/シーケンスの16通りで、保存したメソッドを実際に適用しWorker描画を確認。画像表面用の設定を明示指定し、シーケンスのshape noneが維持されることも確認。見本画像のロード、390px幅での横はみ出しなし。エラー0。
- 見本8枚を目視比較。Mac版Chromeの検証であり、iPhone/Safari実機や長時間の動画書き出しは未検証。

検証途中に見つけたシェーダーの予約語とインク式の括弧は修正済み。正しい実描画とconsoleエラーなしを最終確認している。

証跡：`tools/out/surface-study/results.json`、`integration.json`、各時刻PNG、`comparison.png`、時刻を切り替えられる `index.html`。全て自作の合成画像。

## 再生成・配布

確認サーバー：`python3 -m http.server 8779 --bind 127.0.0.1 --directory app`。

ブラウザテスト後に実行：

```sh
node tools/methods/build-surface-previews.mjs
node tools/methods/build-surface-pack.mjs
node tools/methods/build-surface-gallery.mjs
```

見本生成に既存のImageMagick、ブラウザテストと比較ページの撮影に既存Playwright/Chromeを使用。テスト用Playwrightは `.worktrees/method-workshop/tools/image-code-build/.test-deps/` を参照する。

配布用生成物：`tools/out/surface-pack/画像の質感エフェクト8種.unfoldmethod`、個別の `.js` 8本、`使い方.txt`。共有ファイルは「ファイルを読み込む」で開く。JavaScript欄にJSONは貼らない。各 `.js` はコード欄に直接貼れる単独の関数本体。工房で取り込んだ共有ファイルには形の設定は同梱されないため、立体化なしを選んでプレビューする。
