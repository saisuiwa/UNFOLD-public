# 画像JSメソッドでも「GLBの色（写真と混ぜる）」が効く・毎日の部品（10-19〜10-21） — 公開記録 2026-10-21

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の不具合の報告（1枚モードで、ハート吹雪 × 爆砕と再誕にすると、「GLBの色」を 0% にしても 100% にしても見た目が同じ）を直して、作者の OK を受けて既存の Cloudflare Worker `unfold` を更新した。前回の公開のあとに main に入った、毎日の部品作りの 10-19・10-20・10-21 の部品と、その「言い方」（`c016a18` 〜 `4d26ddb`）も、この公開で一緒に出る。

- 公開ソース：`ca2b783`（本体の main）。
- 公開時刻の有効バージョン：`609282eb-f9f7-4949-8d0f-d4f1b91fc6ee`
- 復旧先（直前の版・`f2c4ad4`）：`183f4cb5-674b-4c39-97d9-6135deb6a529`
- 公開ファイル：76（追加62・変更14・削除0、約7.35MB。うち 5.2MB は `vendor/image-method-worker.js`）。公開前に直前の本番 773/773 の SHA-256 一致を確認、公開後は 835/835 が SHA-256・Content-Type ともに一致（`/release.json` は `ca2b783`）。
- 配布物・照合記録：`releases/unfold-glb-colour-2026-10-21/`（`DRY-RUN.md`、`dry-run-list.json`、`manifest.json`、`published-delivery.json`、`deploy.log`）。このフォルダは Git 管理外。

## 直したこと
- 原因：画像JSメソッドの経路（`image-method-target.js` → `image-method-runtime.js` → ワーカーの `image-method-solid.js`）は、立体の位置とUVしかワーカーへ渡していなかった。GLB の色・テクスチャ・スライダーの値が届かず、色つきの標準の形でも追加した GLB でも、1枚モードでもシーケンスでも、写真の色だけが貼られていた。GLSL のメソッド（くしゃくしゃ など）は前から効いていた。
- 直し方：立体の形が GLB の色（と、テクスチャがある時はテクスチャとその座標）を一緒に持ち、ワーカーの立体のシェーダーが、GLSL と同じ式で、立体になるにつれて混ぜる。量は 1枚モードの `state.modelColor`、シーケンスの `seq.modelColor`。STUDIO は今までどおり写真だけ（既定 0）。
- 0%、色のない形、値を渡さない画面（編集画面・メソッド工房）は、修正前と同じ画素。

## 検証
- `node --test`（tools/test 以下）571/571。`node tools/verify_daily.mjs` 全手順 PASS。
- ブラウザ：新しい `tools/test/image-solid-colour-browser.mjs`（テクスチャの向き・基本色・0%と値なしが前と同じ・平らな絵は色が付かない・1枚モードとシーケンス）と、画像メソッド・面の効果・シーケンス・STUDIO の描画のテストが成功。`image-solid-ui.mjs` は、修正前のコードでも同じ所（プロジェクトを開き直すと、テスト用のメソッドが同梱の `im-tile-bounce` に読み替わる）で失敗する、テストの側の古い期待値（今回の変更とは関係なし）。
- 公開後：本番で、1枚モードとシーケンスのハート吹雪 × 爆砕と再誕が、100% で GLB の色（平均 `[222,69,127]`）、0% で写真の色（`[36,137,138]`）。手元と同じ値。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback 183f4cb5-674b-4c39-97d9-6135deb6a529 --config releases/unfold-glb-colour-2026-10-21/wrangler.json
python3 releases/unfold-glb-colour-2026-10-21/verify_delivery.py before-manifest.json rollback-delivery.json
```
