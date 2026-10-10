# メソッド工房：配布11作品の取り込みと自動設定（ローカル検証）

2026-10-10、ユーザー承認の工房改善。作業開始HEAD `a0f8fb0`。本番公開・外部pushは未実施。

## 使い方

- 工房の「画像・立体・物理」「文字モーション」でカードを選ぶ。名前・種類・コード・初期設定が入って、その場でプレビューする。
- 追加11作品のカード画像はMacで実際に描画したもの。既存サンプル10 GLSL・14画像・6文字のキーは維持し、新規は `sample:collection:<固定ID>`。追加後は10 GLSL・18画像・13文字。
- `.js` を「ファイルを読み込む」で選べる。今回の作例は名前を変更したファイルでもコード全体の一致で認識する。CRLF・先頭BOM・前後空白は無視。未知のJSはファイル名から名前を入れ、画像／文字の選択を求める。キャンセルでは何も変更しない。インポート直後はコードを実行しない。
- 検証用manifestや無関係なJSONは取り込まず、effects内のJSまたは専用共有ファイルを選ぶ案内を出す。
- 共有ファイルは既存の `.unfoldmethod`／`.unfoldmotion` を使用。コードと分離した任意の `workshop` 項目へshape・strength・wordsのみを検証して保存する。画像の物理paramsと文字の書体・配色・サイズ・速度は既存形式を維持。旧ファイルも読み込める。新しいworkshop項目付き文字共有ファイルは、未知項目を拒否する旧公開版では読み込めないので更新後のアプリが必要。
- 表面エフェクトの「このブロックに使う」は、1枚モードの立体化をOFF、シーケンスの選択中の◆だけを「形にしない」にする。通知だけでは作品を変更しない。シーケンスはUndo対応。形がnone以外の見本は既存作品の立体設定を勝手に変更しない。
- 保存済みの同じ定義の重複追加を抑えつつ、別カードで編集中の内容を保護する。異なるコードは別IDで保存し、旧作品の参照を保護する。

## 収録

画像：金継ぎ陶片、水滴レンズ、織り写真、銀箔うねり。
文字：こはく · 星を編む、墨の余韻、光の公転、信号の輪郭、花の記憶、弾力活字、活字輪転。

3つのLibrary原本は公式ヘルパーでこのMacへ取得。標準Pythonの型構文エラーは既存Python3.12で解消。原本・Library ID・SHA256記録は `tools/out/workshop-collection/originals/`。

実描画で、最初の文字5作品は長い日本語が1行に縮むことを検出。`overflowWrap: 'break-word'` を追加。配布時の元コードも `originalSources` で一致判定し、JS読み込みと元の専用共有ファイルの読み込みでは修正版のコードへ移す。名前・配色等の共有設定は維持。任意の自作コードを推測で書き換えない。

## 検証結果

- Node単体テスト362件成功、失敗0・スキップ0。追加テストは `tools/test/workshop-collection.test.mjs`。
- `workshop-collection-browser.mjs`：11カードの実描画、名前・種類・設定、既存番号付き下書き、未知JSの選択と取消、不正ファイル、インポートの非実行、重複読み込み・追加、独立した保存カードの未確定編集、強さだけの編集のリセット、両モード適用、他の◆保持、Undo、リロード、390px幅。
- `workshop-collection-surfaces.mjs`：4作品の実画素比較。開始・終了・強さゼロで原画一致、逆シークで同一画素、A/B切替。今回の測定範囲で最大フレーム時間16〜26ms（Mac Chrome 800×450、一般的性能保証ではない）。
- `workshop-collection-text.mjs`：7作品×短い日本語・長文・3行＝21ケース、ゴシック・明朝・丸文字、横長800×450と縦390×693。実Troika描画、持続中の文字範囲と折り返し、部分色と通常色の実画素、逆シークの画素一致。
- `workshop-collection-integration.mjs`：画像4作品を1枚とシーケンス両方へ適用、8ケースで自動立体化OFFと実worker描画。
- 既存の工房ブラウザ検証5本（browser / handoff / review / assets / extended）も成功。元ファイルは変更せず、実行コピーだけを現行ローカルURLと既存Playwrightへ向けた。保存中の切替、保存失敗、ID衝突、旧GLSL・物理・文字の適用、色、画像復元、停止とタイムアウトを確認。
- 独立レビューの指摘4点（再追加時の編集消失、通常プロジェクトインポート設定、GLSL設定、文字設定の重複判定）は修正・回帰テストで確認。再レビューでブロッカーなし。追加の軽微な強さリセット表示も修正・実ブラウザテスト済み。
- `git diff --check` 成功。

証跡：`tools/out/workshop-collection/index.html`、各PNG、`ui-results.json`、`surfaces/results.json`、`text/results.json`、`integration/integration.json`、`regressions/`、`unit-tests.tap`。

## 再実行

`python3 -m http.server 8780 --bind 127.0.0.1 --directory app` でローカル配信。

```
node --test --test-reporter=tap tools/test/*.test.mjs
node tools/test/workshop-collection-browser.mjs
node tools/test/workshop-collection-surfaces.mjs
node tools/test/workshop-collection-text.mjs
node tools/test/workshop-collection-integration.mjs
```

ブラウザテストはMacに既存のChromeと `.worktrees/method-workshop/tools/image-code-build/.test-deps/node_modules/playwright-core` を使用。依存の追加インストールなし。

## 未実施・次の範囲

本番配信・外部push、Safari/iPhone実機、11作品すべての動画書き出し、長時間の負荷試験は未実施。ユーザーの実画像・曲・保存中プロジェクトは使用・外部送信していない。

工場の制御盤風への広範なUI改修は別作業。今回の固定IDカタログは将来の検索・分類・見本画像を拡張できるよう分離し、既存の日次カタログは変更していない。

p5.jsの6作品は今回未追加。直接互換ではない。「文字が呼吸する」は文字JS、「光の膜をつくる」は画像JS＋ShaderMaterialに移植しやすい。「墨がにじむ」「波が重なる」は中程度。「流れを描く」「光をなぞる」は前フレーム依存を絶対時刻で再現できる形へ改める必要がある。タッチ機能は入力／記録再生APIが別途必要。画像変形ではなく生成アートなので背景素材か画像への重ね合わせかを別途設計する。
