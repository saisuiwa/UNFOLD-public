# 自作メソッド・エディタ改良 2026-10-04

ユーザー承認: 3プリセット（花びら・渦・立体ポップ）、エディタ内の画像変更、userMethodコピー、実amount表示と調整。ローカルブラウザで確認。公開やレンダラー追加改修は対象外。

## 使い方

`/Volumes/ORICO/UNFOLD` で `python3 tools/serve.py`。`http://127.0.0.1:8771/` → 「＋自作メソッド」。シーケンスでも同じ画面。

画像を変更 → 崩れ方プリセット → amount 0.00〜0.80 → コード編集 → userMethodをコピー。入力後350msで既存の簡易検査、GPUコンパイル、試し描画。新しい画像はエディタのプレビューだけに適用し、同じページ内の開閉では保持。「本体の画像に戻す」で戻る。ページ再読込では画像は保持しない。

コピー拒否時はコードを全選択し⌘C / Ctrl+Cを案内。エラー中は最後の正常プレビューを保持。新しい編集で以前の非同期コンパイルを直ちに無効化し、古い結果で保存可能になる競合も防止。

## 保護・範囲

Git管理がないため worktree は作らず、app全体を `archive/app-before-editor-workbench-20261004-140927/` に退避してから変更。

変更: `method-editor.js`, `method-preview.js`, `method-samples.js`, `method-editor.css`。読み込み版番号のみ: `app.js`, `sequence.js`, `index.html`, `sequence.html`。

プリセットは既存GLSL契約内。元のmotion.js、custom-method.js、guard、trial、安全検査は変更しない。追加のパッケージや購入・外部公開なし。

## 検証

- 追加前のNode全テスト: 227/227成功。
- 新規プリセットテストが追加前に失敗（Missing workbench preset: petals）。
- 実DOM/GPUブラウザテストが追加前に失敗（missing code copy）。
- 変更後のNode全テスト: 228/228成功。`node --test tools/test/*.test.mjs`。
- Chrome実ブラウザ: 次の6グループすべて成功（tools/test/editor-browser.html）。
  1. 追加コントロールとamount範囲
  2. 3プリセットGPUコンパイル、amount0で原画像画素一致、0.2/0.4/0.6/0.8で変形
  3. amount表示値
  4. GLSL構文エラーで正常プレビュー保持、修正後復帰
  5. clipboard拒否の代替選択と成功時コピー内容一致（拒否・成功APIはテストで差し替え）
  6. PNG画像変更、無効PNG拒否、コード保持・再適用・3回の開閉
- 本体画面で別途、コピー後のネイティブ⌘V結果がコピー前の立体ポップコードと一致。
- 1枚モードで立体ポップ/花びら、シーケンスで渦のGPU合格と表示を目視確認。両ページのブラウザerrorログなし。
- 独立レビュー: P1/P2なし。CSSの版クエリ重複1点を指摘、整理済み。

ブラウザテストの再実行: UNFOLDルートで `python3 -m http.server 8772 --bind 127.0.0.1`、`http://127.0.0.1:8772/tools/test/editor-browser.html` の Run browser checks。このテストは別オリジンで動かし、下書きとクリップボードAPIを実行後に戻す。

証拠: node-tests.txt、unfold-editor-browser-tests.jpg、unfold-editor-depth-pop.jpg、unfold-editor-petals.jpg、unfold-editor-sequence-vortex.jpg。

未検証: Safari/Firefox、動画書出しの全組合せ、巨大画像/縦長/透過画像の広範な回帰、実GPUクラッシュ。安全制約とクラッシュ復旧の既存処理は維持。画像はブラウザ内処理。既存ページのGoogle Fonts通信はそのまま。

## 描画・制作の改善助言（今回は実装しない）

現状 userMethod は既存頂点を動かす関数。粒子数・カメラ・材質・照明・描画パスの追加は別実装になる。8000文字、各ループ64/合計256、座標±8、粒形状0〜8等の意図的ガードは維持を推奨。

|案|期待する効果|負荷 / 難度|ソースの確認済み根拠|
|---|---|---|---|
|カメラ設定を活用|前後差と立体感を出す|小 / 低〜中|単画像app.js:358は平行投影固定、sequence.js:419には透視投影と画角調整が既存|
|粒密度と面数を別制御|軽い編集と高精細な出力を両立|軽量化なら減 / 中〜高|app.js:48は80×80粒、model-layout.js:51の粒設定はpart属性だけを変え、頂点数は減らさない|
|不透明・切抜き・半透明を分けて比較|重なった粒の欠けや透け方を改善|小〜大 / 中〜高|custom-method.js:101はDoubleSide/transparent:true、depthWriteは既定true。欠け発生は未検証の仮説。単純に全体depthWrite=falseにはしない|
|光の方向・陰影の強さ調整|面の傾きが読め、立体感を強める|小 / 低〜中|motion.js:442は固定方向、0.68〜1.0の疑似照明。通常のThree.jsライト追加だけでは変わらない|
|編集と出力の品質分離|編集の応答性、書出しの輪郭品質|編集負荷減・高品質出力増 / 中|effects.js:28のDOFは全解像度多点サンプル。sequence.js:541/583には2倍解像度縮小・固定時刻出力が既存|

改善後の見栄え・速度は未測定。優先順はカメラの既存設定活用 → 光調整 → 半透明の比較検証。ミップマップも縮小時の細線/ちらつき比較候補（現在LinearFilter・無効、メモリ約33%増）。
