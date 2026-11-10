# シーケンス「美術館を歩く」 — 公開記録 2026-11-10

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の「公開して」を受けて、サイトの Worker `unfold` を更新した。GLB置き場（`unfold-glb`）は変えていない（`fff7d16b` のまま）。

## サイト（`unfold`）
- 公開ソース：`e7aaa62`（本体の main）。`6bac7c6` の上。
- 公開時刻の有効バージョン：`8050acb0-2c0f-4129-9b9d-54aedb9b2988`
- 復旧先（直前の版・`a5293c2`）：`fac34920-82a5-4afb-a2c8-11aaeaf87a4a`
- 公開前の照合：本番は直前の記録と 913/913 一致（`before-live-check.json`）。
- 公開ファイル：915（6 をアップロード）。追加1（`gallery-walk.js`）・変更5（`sequence-renderer.js`・`sequence.js`・`sequence.html`・`studio/unfold-layer.js`（`?v=` だけ）・`release.json`）・削除0。
- 公開後：全ファイルを plain `curl` で取得して 914/914 が SHA-256・Content-Type ともに一致（`_headers` を除く）。
- 配布物・照合記録：`releases/unfold-gallery-walk-2026-11-10/`（Git 管理外）。

## 変わったこと
作者と試作（`試作/2026-11-10_美術館を歩く/`、Git 管理外）で見た目を確かめてから、シーケンスに入れた。「04 見た目」タブの「美術館を歩く（額縁から額縁へ）」。
- 絵の枚数だけ、壁（背景色）に額縁が横に並ぶ（`gallery-walk.js`。額縁の板は1枚モードの `frame-stage.js` の `drawFrame`）。額縁は「順にかえる」（金 → 木 → 黒 → 白マット）か1種類。
- 今の絵は、いつもの絵の粒（メッシュ）が額縁の位置で描く。◆の間、立体は額縁の手前へ（「立体が飛び出す大きさ」だけ大きく）出て、少し弧を描いて次の額縁へ動き、次の絵になる。立体なしの◆（通り抜け・JavaScript の画像メソッド）は変化のまん中で渡り、「めくって見せる」はその場で崩れる（次の絵はもう次の額縁に掛かっている）。
- カメラは立体に寄り添って壁の横を歩く（立体が画面の端で切れないように）。歩く間は遠近感のあるカメラで少し先を向く（「歩く時にカメラが先を向く」）。
- 通り過ぎた額縁には絵が残り（出ていった絵は、立体が去ってから戻る）、まだ行っていない額縁は絵が来るまで暗い。
- 美術館の間は、絵ごとのカメラ・Ken Burns・引きの設定・◆のカメラの移動は使わない。◆ごとの崩れ方・形・拍・立体の動きは今までどおり。
- JavaScript の画像メソッドの◆でも額縁が見える（ワーカーが透明な背景で描き、額縁の位置へカメラをずらす）。
- 設定（`gallery`: オン・額縁の種類・大きさ・飛び出す大きさ・先を向く強さ）は作品（.unfold）に保存する。前の作品は「オフ」。STUDIO の共有レンダラーには額縁を渡していない（STUDIO では今までどおり）。

## 検証
- `node --test "tools/test/*.test.mjs" "tools/test/studio/*.test.mjs"` 620 合格・失敗 0（`gallery-walk.test.mjs`：設定、額縁が画面に収まり隣と触れない、立体とカメラの位置、どの額縁に絵を見せるか）。
- `node tools/test/gallery-walk-browser.mjs`（新しいブラウザの確かめ）：オフは今までと同じ絵、オンで絵が金の額縁に入る、カメラが壁を歩く（0 → 0.75 → 18.38、額縁の間隔 9.19）、通り過ぎた額縁に絵が残る、次の絵は次の種類の額縁、1種類にできる、作品に保存される、JavaScript の画像メソッドの◆でも額縁が見える。すべて PASS。
- `UNFOLD_CHROMIUM=<Google Chrome> node tools/verify_daily.mjs --base=6bac7c6` 15 項目すべて PASS（`verify_daily.log`）。
- 公開後、本番の `sequence.html` を新しいブラウザで開き、絵3枚を入れて美術館をオンにし、カメラの位置（0 → 0.75 → 18.38）、最後に通り過ぎた2つの額縁に絵が残ること、設定の5行が出ること、作品の設定に保存されること、ページのエラーなしを確かめた（`live-check.png`）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback fac34920-82a5-4afb-a2c8-11aaeaf87a4a --config releases/unfold-gallery-walk-2026-11-10/wrangler.json
```
戻した版では、作品に入った美術館の設定は読まれない（作品は今までどおり開く）。
