# 公開手順（Cloudflare：unfold.saisuiwa.com）

2026-10-04 作成。UNFOLD は静的ファイルだけなので、Cloudflare の Worker（静的アセット）`unfold` に置いて、`https://unfold.saisuiwa.com/` で公開しています。

- 公開先：Cloudflare ダッシュボード → Workers & Pages → `unfold`（`unfold.saisuiwa.workers.dev` と独自ドメイン `unfold.saisuiwa.com`）
- ドメイン：`saisuiwa.com`（Cloudflare Registrar、自動更新オン、期限 2027-10-04）
- 前の公開先（Netlify `unfold-test.netlify.app`）は、そのまま残してあります（古い版）。

## 更新するとき（Claude がやる手順）

1. `app/` を直して、`node --test "tools/test/*.test.mjs"` が全部通ることを確認。
2. ダッシュボードの `unfold` → **New deployment**（URL：`…/workers/services/update/unfold/production`）で「静的ファイルをアップロード」の画面を開く。
3. **`app/` の中のファイルを、フォルダの形を保ったまま**アップロードする。
   - 手でやるなら：「フォルダ」を押して `app` フォルダを選ぶだけ（いちばん簡単）。
   - Claude は、Chrome の自動操作でファイルを渡すため、フォルダの階層（`vendor/`、`guide/…`）が消える。そこで、ページに小さなフックを入れて、ファイル名から元の相対パスと正しい種類（Content-Type）を付け直している（`change` イベントを捕まえて、`webkitRelativePath` を持つファイルに差し替える）。
4. 「展開する（Deploy）」を押す。反映は数秒。
5. 確認：`https://unfold.saisuiwa.com/` と `…/sequence.html`、`…/guide/` を開く。`curl` で `Content-Type` が `text/javascript`／`text/css`／`text/html` になっているか、ファイルが `app/` と同じかを見る。

## 公開の確認（2026-10-04 のタイルの細かさの公開で使った方法）

- `app/` の全ファイルを `curl -sL https://unfold.saisuiwa.com/<パス>?t=<時刻>` で取って、手元とSHA-256が同じか、`.js`／`.css`／`.html` の `Content-Type` が正しいかを全部（214個）見る。8並列で数十秒。
- 「展開する」を押した直後は、新しいファイルがまだ404のことがある（数秒〜）。ボタンは画面の言語が英語→日本語に切り替わると位置がずれるので、**押したあとに新しいファイルが200になるまで待って、ならなければもう一度押す**。この日は1回目のクリックが、言語の切り替わりと重なって空振りした（画面は「展開する」のまま、最初のクリックは英語の「Deploy」の位置）。
- Claude の確認用のブラウザタブは「裏のタブ」になりやすく、保存済みのプロジェクトがあるシーケンス画面は、起動が終わらない（画像の `decode()` が終わらない）。表のタブでは動く。画面の起動までは、手元の確認（`curl` での一致確認＋同じファイルでの動作確認）で代えた。

## ハマりどころ（実際にハマったもの）

- **ファイルの種類は、最初にアップロードしたときのものが残る。** Cloudflare は同じ中身のファイルを使い回すので、最初に種類が間違ったまま上げると、同じ中身を上げ直しても直らない。直すには、中身を変える（例：末尾に改行を1つ足す）。2026-10-04 の最初の公開で、ルートの `.js`／`.css` が `application/octet-stream` になって、ページが真っ黒になった（`<script type=module>` は種類が違うと読み込まない）。
- **`app/_headers` が、この問題の本当の対策（2026-10-04 追加）。** `*.js`／`*.css`／`*.html` の `Content-Type` を、ファイルごとの記録とは関係なく指定する。これがなかった間、ガイドページを追加した3回目の公開で、中身が変わっていないルートの `.js`（約35個）と `method-editor.css` が最初の記録（`application/octet-stream`）に戻ってしまい、`https://unfold.saisuiwa.com/sequence.html` が起動しなかった（`Failed to fetch dynamically imported module`）。`_headers` を足して再公開したら、全部 `text/javascript`／`text/css` になった。**`_headers` は `app/` の中に置いたまま、毎回一緒にアップロードすること。**
- **直したあとも、すでに開いたことのあるブラウザは、古い種類のままキャッシュしていることがある。** 直らないときは、強制再読み込み（⌘＋Shift＋R）か、サイトデータの削除。Claude の確認では、`fetch(url, {cache:'reload'})` で各ファイルを取り直してから開いたら直った。
- **フォルダの階層が消える。** 「ファイル」で選ぶと、`vendor/…` が平らになって、サイトが壊れる。
- **「展開する」ボタンは、画面の言語（英語⇄日本語）が切り替わるたびに位置がずれる。** 押したあとに、一覧のぐるぐるが回っているのを確認する。
- 一度のアップロードは、Claude の道具では約10MBまで（`app/` は約7.4MB）。大きいファイル（GLB 約414MB）は、別の置き場にする（下）。
- ブラウザのタブが**非表示（裏のタブ）**だと、UNFOLD は画像の `decode()` が終わらず、起動が止まって画面が真っ黒になる。表示すれば動く（公開後の確認は、表のタブで）。

## GLB置き場（glb.saisuiwa.com）— 公開済み（2026-10-04）

- Worker `unfold-glb`（`unfold-glb.saisuiwa.workers.dev` と `glb.saisuiwa.com`）。94個の GLB が載っていて、全ファイルのバイト数が手元（`models/tripo-publish/`）と一致することを確認済み。
- `models/tripo-publish/`：94個の GLB（`animal/whale.glb` のようにグループ別・英語名）、`manifest.json`、`_headers`（どのサイトからでも読める CORS・キャッシュ・`.glb` の種類）。
- 説明ページ `https://unfold.saisuiwa.com/guide/glb.html` は、`https://glb.saisuiwa.com/manifest.json` が読めると「UNFOLDに追加」を使えるようにする（読めない間は「準備中」と出る）。
- GLBを足す／直すとき：`models/tripo-publish/` に置いて `manifest.json` と `app/guide/glb-catalog.json`（サムネは `app/guide/thumbs/`）を更新 → `unfold-glb` の New deployment で、フォルダごとアップロード → `unfold` 側も更新。
- 新しく置くとき：ダッシュボード → Workers & Pages → **作成** → 「静的ファイルをアップロード」→ 名前 `unfold-glb` → `models/tripo-publish` フォルダを選ぶ → 展開 → そのWorkerの「ドメイン」で `glb.saisuiwa.com` を追加。
- **Tripo のプランは確認済み（2026-10-04）：有料プランで作ったもの。** 有料プランで作った3Dモデルは、配布も含めて自由に使える（https://www.tripo3d.ai/help/privacy-policy/how-to-use-tripo-models-commercially ）。ただし、今の94個のうち、無料のトライアルや無料プランの時期に作ったものがあれば、その分は Tripo に権利が残るので、心配なら該当のものを外す。
- 置く作業の方法メモ（Claude がやった）：Claude の道具は1回約10MBまでしか渡せないので、GLB（約414MB）を2個ずつ47回に分けて、アップロード画面のページ内にためてから、最後に一度にまとめて渡した。作者が手で置くなら、フォルダを選ぶだけ。
- 確認：`curl -I https://glb.saisuiwa.com/animal/whale.glb` で `Access-Control-Allow-Origin: *` と `Content-Type: model/gltf-binary`。新しく作ったばかりの名前は、手元のDNSが「ない」と覚えていることがある（`--resolve glb.saisuiwa.com:443:<IP>` で回避、またはしばらく待つ）。

## Netlify（unfold-test.netlify.app）のデータの書き出し（2026-10-04）

保存データはURL（オリジン）ごとなので、新しいURLでは見えない。作者の Chrome の Netlify 側から、読み取りだけで書き出した（元のデータは消していない）。

- 保存GLB 3個 → `models/netlify-saved/`：`mushroom monster 3d model.glb`（26.8MB・96万面。テクスチャつき）、`衝撃波.glb`（元ファイルと同一）、`星屑のハート_大きめ.glb`
- プロジェクトの自動保存は、初期のサンプル4枚（ONE〜FOUR）だけだったので書き出さなかった。自作メソッドは0個。
- 新しい場所で使うには、アプリの「＋GLBを追加」で、このフォルダのファイルを選ぶ。
- 方法メモ：ページに `localhost` への通信の許可を聞かれて止まるので、IndexedDB から GLB を読んで、自前でZIP（無圧縮）にして、ブラウザの通常のダウンロードで落とした（日本語のファイル名は UTF-8 フラグつき）。
