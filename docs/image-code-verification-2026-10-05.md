# 画像コードメソッドの実装・検証記録

基準: main f88b47a。作業: codex/image-code-physics。
承認済み画像JS/Rapier拡張を実装。新しい任意パラメータUIは対象外。

## 完了内容

- 既存GLSLを保持して画像専用Three/Troika/GSAP/Rapier Workerを追加。
- ローカル画像A/B転送、シーン寸法・カメラ共有、文字と画像片の同一シーン描画。
- 3サンプル、編集・プレビュー、物理設定、コードコピー、名前付き追加、共有ファイル。
- 共通ライブラリ保存、未確認コードの隔離、.unfoldmethod v2、.unfold v4。
- 両モードのフレーム待機。1枚の新方式はWebCodecs、旧GLSLのMediaRecorderを維持。
- シーケンスの音声出力・範囲出力、書き出し中止、Undo/Redoを確認。

## 判断した初期範囲

- 既存立体形状へのモーフと既存画面効果は未対応と明示。GLSL側は維持。
- 異種メソッドは画像クロスフェード。頂点トポロジーの連続補間はしない。
- 巻き戻しはコードと物理を初期化し、固定1/60秒で再計算。
  作者変数も作り直して整合性を優先した。長い区間・多数物体は重くなるので、
  チェックポイント・軌跡ベイク・インスタンス描画の性能最適化は今回含めない。
- 承認済みアプリ改良としてローカル本体への統合を行う。公開・pushはしない。
  検証成果と既存未追跡資料を保護するため、作業フォルダは削除しない。

## 検証

`node --test tools/test/*.test.mjs`: 310/310 pass。

独立Chrome・localhost:8775・生成素材のみ。ユーザーのタブや画像・曲は使用していない。

- `image-method-browser.mjs`: 色・上下・SRGB中間色128/64/32が一致。
  全3サンプルで0→2→1→2の再描画ハッシュが一致。始点・終点一致、強さ0。
  往復時のTroika base material解放。無限ループの期限停止、iframe解放。
- `image-method-integration.mjs`: 編集UI→プレビュー→ブロック追加→再読込。
  1枚・シーケンスのMP4:1280×720、30fps、2秒。
  途中0.5〜1.5秒のMP4:1920×1080、60fps、H.264 60フレーム、AAC音声。
  ffprobeでは音声パケットを含め1.002667秒、ffmpeg全デコードでエラーなし。
  キャンセル後recording=false。作品v4へ保存・再読込。ブラウザエラー0件。
- `image-method-edge.mjs`: 両モードで絵柄シャッフルON/OFFの強さ0画素が一致。
  JS→GLSL、GLSL→JS、JS→JS、GLSL→GLSLを実際のミックス時間帯でWebM出力。
  UIからJS選択・Undo/Redo、未確認コードの出力拒否、勝手なGLSL置換防止。
- `git diff --check`: 問題なし。

## 独立レビューと修正

読み取り専用の別レビューで重要2件を指摘。レビュー側のChrome起動は制限で失敗したため、
実装側の独立Chromeで再現を確認してから修正し、上記テストで再確認した。

1. 強さ0で旧GLSLのconcealが露出: 画素差を確認(RED)、JS区間はconceal無効化(GREEN)。
2. Troika disposeはgeometryのみ: base material解放イベント未発火を確認(RED)、
   共有材質を一度ずつ解放しTroika派生材質のdisposeへ接続(GREEN)。

追加の最終確認で、1枚モードの既存registry通知が未確認JSをcrumpleへ変える挙動を
再現(RED)。画像コードのIDを維持し再確認を案内するよう修正(GREEN)。明示削除は通常選択へ戻る。

未修正のレビュー指摘はない。上記初期範囲はAPI手順にも記載。
生成MP4・スクリーンショット・JSON結果はworktreeのtools/out/image-code-physics/に保持。
