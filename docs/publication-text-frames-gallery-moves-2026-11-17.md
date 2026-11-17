# 人物の後ろの文字・額縁・美術館の「移る時の動き」 — 公開記録 2026-11-17

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を更新した。GLB置き場（`unfold-glb`）は変えていない（`fff7d16b` のまま）。

## サイト（`unfold`）
- 公開ソース：`ee6f027`（本体の main）。`7afcf80` の上。
- 公開時刻の有効バージョン：`61bd15d5-6202-4639-8f2d-bdd0cde36df0`
- 復旧先（直前の版・`2d51965`）：`6a6dcde4-c456-4df9-a3d4-08a35341bb26`
- 公開前の照合：本番は直前の記録と 924/924 一致（`before-live-check.json`）。
- 公開ファイル：925（11 をアップロード）。追加0・変更11・削除0。`app.js`・`back-text.js`・`frame-stage.js`・`gallery-walk.js`・`index.html`・`sequence-renderer.js`・`sequence.html`・`sequence.js`・`studio/unfold-layer.js`・`style.css`・`release.json`。
- 公開後：全ファイルを plain `curl` で取得して 924/924 が SHA-256・Content-Type ともに一致（`_headers` を除く）。1回目で一致。
- 配布物・照合記録：`releases/unfold-text-frames-gallery-moves-2026-11-17/`（Git 管理外）。

## 変わったこと
- **人物の後ろの文字（1枚モード）**：出し方に6つを足した（縦に流れる・斜めのテープ・奥から迫ってくる・波打つ・落ちて積もる・散らばって集まる。出し方は全部で10）。配色セット（字の色・地の色・差し色をまとめて選ぶ、9組）と字の模様5つを足した（模様は全部で10）。差し色はテープの帯・グラデーション・覆う板などに使う。
- **額縁から飛び出す（1枚モード）**：額縁の種類に5つを足した（バロック・ネオン管・電球・ポラロイド・フィルムのコマ。全部で9）。額の色を選べるようにし（「元の色に戻す」つき）、重ねる飾り4つ（四隅に花とツタ・マスキングテープ・キラキラ・花びら）を足した。シーケンスの「美術館を歩く」でも、同じ額縁を使える。
- **美術館を歩く（シーケンス）**：「移る時の動き」を足した。立体が次の額縁へ移る時の動き方。
  - ふつうに渡る（初め。今までの作品の見え方は変わらない）
  - 立体に合わせる（おまかせ）：形の名前で選ぶ（ハート→ドクンドクン、風船・クラゲ→ふわふわ、紙飛行機・鳥・ロケット→ビューン、ウサギ・猫→ぴょんぴょん、魚・クジラ→すいすい、ほかの形→ふつう）。棚の GLB は日本語の名前、自分で入れた GLB はファイル名（`plane`・`balloon`・`heart` など）で見分ける。
  - ビューン：一度うしろへ引いてから一気に飛び、伸びて傾き、風の線を引いて、少し行き過ぎてから額に収まる。
  - ふわふわ：上へ浮いて、ゆらゆら揺れながら渡り、そっと降りる。カメラも一緒に上がる。
  - ドクンドクン：曲の拍に合わせて「ドク・ン」と脈打ち、そのたびに前へ押し出される。カメラも少し寄る。
  - ぴょんぴょん：3回跳ねて、着地でつぶれる。
  - すいすい：S字に泳ぎ、尾を振るように揺れる。
  - 再生中の表示（「1 → 2 …」の行）に、選ばれた動きの名前も出る。動きは作品と一緒に保存される。

## 検証
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 666 合格・失敗 0（足したテスト：文字の出し方・配色・模様、額縁の種類・色・飾り、移る時の動きのおまかせの選び方・どの動きも元の額で始まり次の額で終わる・ハートが拍に合う）。
- ブラウザでの確かめ：`back-text-browser`・`frame-stage-browser`・`gallery-walk-browser` すべて合格。前の機能の `dive-flow-browser`・`toon-look-browser`・`single-no-solid-browser`・`solid-stage-browser`・`relief-browser`（本物のモデルの部分は除く）・`glb-colour-cutout-browser` も合格。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=7afcf80` 15 項目すべて PASS（`verify_daily.log`）。
- 公開後、本番の `index.html` と `sequence.html` をブラウザで開いて確かめた（`live-check.json`・`live-check.png`）：ページのエラー・足りないファイルなし。出し方10・切り替わり方14・配色セット10・字の模様10・額縁の種類9・重ねる飾り5・移る時の動き7が並ぶ。本番の `release.json` は `ee6f027`。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback 6a6dcde4-c456-4df9-a3d4-08a35341bb26 --config releases/unfold-text-frames-gallery-moves-2026-11-17/wrangler.json
```
戻した版では、今回足した文字の出し方・配色・模様・額縁・飾り・移る時の動きが無くなる。保存した作品に入っている新しい設定は、読み込む時に初めの値（「ふつうに渡る」など）になる。
