# JavaScript画像メソッド・物理演算

2026-10-05 / 立体接続版。既存GLSLメソッドは従来通り使えます。

## 操作

1. メソッド一覧の「＋ 自作メソッド」から「JavaScript＋物理演算で作る」。
2. サンプルを選び、画像とコードをプレビュー。時刻スライダーで巻き戻しも確認。
3. 重力、反発、横の分割数、ランダムの種、戻り方を設定し、もう一度プレビュー。
4. 名前を付けてブロックに追加し、一覧から選択。1枚モードとシーケンスで共用します。
5. 「メソッドファイルを書き出す」で .unfoldmethod を交換できます。
   読み込んだコードは未確認状態です。編集画面でプレビュー・保存すると使えます。

サンプルは「タイルが落ちて跳ねる」「爆発して元へ戻る」「画像片と文字がぶつかる」。
戻り方は逆再生、または配置を整えて戻る方式です。
TTF / OTF / WOFFと、ブラウザが許可するPCフォントを使用できます。
別PCへ共有したフォントの実体は含まれないので、同じフォントを選び直してください。

## 立体化と現在の範囲

画像A → コード・物理演出 → 選んだ立体 → 画像B。1枚モードはB=Aです。
「03 立体」（1枚）／◆変形の「立体化する」（シーケンス）でオン・オフ、球・ハート・プリセット・追加GLB・立体文字・シルエットを選べます。旧作品で「形にしない」だった区間はそのままなので、立体化するをオンにしてください。
コード編集画面の「プレビューの立体」で球・ハートなど、または作品で選んだ形を試せます。このプレビュー設定はメソッド自体には保存しません。作品の形は本体で指定します。

`createImagePlane` / `createImageTiles` で作った画像片は、コードを書き換えなくてもホストが選んだ形へ集めます。各片の現在の位置・回転・スケール（親Groupを含む）からターゲットの各頂点へGPUで補間し、GLBの三角形を間引きません。途中で追加された画像片も対応を更新します。非表示の片や親Groupは集合開始時に急に表示せず、formに合わせて現れ、form=1では完成した形を表示します。崩す強さが0でも、立体化をオンにしていれば選んだ形になります。
独自のTHREEメッシュ、画像片の頂点を直接変形する処理、独自シェーダーの変形は、この自動集合で追跡しません。対応する画像片がないUV領域は元の平面から集まります。文字など補助オブジェクトはコード側の表示を維持します。
集合は表示上の補間です。Rapierの剛体は元の物理軌道を計算し続け、集合したGLB表面への衝突判定は生成しません。
絵柄シャッフルと既存の材質・画面効果は新シーンには適用しません。
回転方向・カメラ移動は本体の設定を使えます。
既存GLSLとのミックスとJS同士のミックスは映像のクロスフェードです。
画像コード内の文字と画像片には奥行きがありますが、既存MV歌詞は前面レイヤーです。

プレビューが重い場合は分割数を下げてください。標準12分割、通常84〜数百個の剛体です。
上限1024物体、150文字メッシュ、コード32000文字、物理時間180秒。
処理期限を超えたWorkerは停止します。作者コードの負荷を無制限に処理する仕組みではありません。

## コードAPI

外側の関数宣言やimportではなく、`api`を引数に持つ関数の本体を書きます。

- `THREE`, `Text`, `gsap`, `RAPIER`：同梱版。描画器はホスト管理です。
- `scene`, `root`：シーンと、ホストの回転を受けるグループ。物体はrootへ追加します。
- `size.width/height`：画像面のワールド寸法。歌詞APIのpxとは別です。
- `images.a/b`：読み込んだ画像テクスチャ。外部URLは不要です。
- `createImagePlane({width,height,uv})`：画像面をrootへ追加。uv=[u0,v0,u1,v1]。
- `createImageTiles({columns,rows})`：`{mesh,home,width,height,index}`の配列。
  画像UVを保持し、A/Bの切替は基盤が設定します。
- `createText(text,style)`：選択書体のTroika文字。fontSizeもワールド単位。
- `params`：columns / gravity / bounce / seed / returnMode / label / font。
  この初期版は固定項目です。自由な調整項目からUIを生成するAPIではありません。
- `seed`, `random()`：初期化時に使う再現可能な乱数。
- `physics.world`：Rapier World。stepはホストが所有します。
- `physics.bind(mesh,{size,fixed,velocity,angular,restitution,position})`：箱の当たり判定と剛体を作り描画に対応付けます。sizeは箱の全寸法。
- `physics.floor(y)`：見えない床の当たり判定。
- `physics.at(step,callback)`：正の整数stepで一度実行。物理の衝撃に使います。
- `returnTime(frame)` / `assemble(frame)` / `smooth(x)`：戻り演出の補助。

返り値：`{timeline, physicsTime(frame), update(frame), beforeStep(step), afterStep(step), dispose()}`。
timeline / update / physics.bindで作った物体のいずれかが必要です。
GSAPは`paused:true`で作ります。コールバックを抑制して絶対時刻へseekします。

frame: clipTime, duration, progress(0〜1), amount, form(0〜1、立体への集合率), phase(enter/exit),
direction(+1/-1), imageMix(0〜1), width, height, bg, camera, rootQuaternion, depth, seed。
width/heightは出力ピクセル数で、物理の寸法・乱数を変える用途には使いません。
amountは強さと時間の包絡で、amountとformが両方0の場合、および区間両端では基盤が元の平面画像を描きます。
それ以外の強さの反映は作者updateが担当します。

step: index / time / dt。固定1/60秒で進め、表示時は位置・回転を補間します。
`physicsTime`を省略するとclipTimeで進みます。逆シークは初期状態から再計算します。
独自変数・乱数・GSAPも初期化し直すため、スナップショットだけの復元は使いません。
現在は軌跡ベイク／チェックポイント最適化をしていません。

updateは同じframeなら同じ表示を代入してください。+=の累積、Date.now、Math.random、
requestAnimationFrame、自動GSAP再生、update内でのworld.stepは再現性を壊します。
文字・Geometry・Materialは初期化時に作って再利用し、独自資源はdisposeで解放します。
任意のJSの決定性を静的検査で保証しているわけではありません。

## 保存・出力

画像コードはim-系ID。コード・版・物理設定をまとめて保存し、内容が異なる設定は別メソッドとして扱います。
.unfoldmethodは画像コード入りのみv2、.unfold作品は画像コード入りのみv4。
GLSLファイルv1と旧作品v1〜3も読み込めます。欠けた画像コードを別のGLSLへ置換して出力しません。

1枚モードの新方式とシーケンスは、各フレームの画像演算完了を待ってWebCodecsへ渡します。
ChromeのlocalhostまたはHTTPSで使ってください。1枚モードは30fps、シーケンスは30/60fps。
旧1枚GLSLのMediaRecorder経路は保持しています。
シーケンスの音声・歌詞合成・途中範囲出力を維持し、書き出し中止にも対応します。

依存版：Three 0.180.0 / Troika 0.52.4 / GSAP 3.13.0 / Rapier compat 0.21.0。
画像はローカルで処理し、依存コード・WASMは同梱します。
