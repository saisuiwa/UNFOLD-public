# UNFOLD STUDIO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存作品を保護しながら、1曲の横MVと同じ時間軸の縦ショートを、歌詞・UNFOLD・p5演出・動画元音声・効果音付きで編集・保存・出力できるSTUDIOを作る。

**Architecture:** 旧シーケンスの画面と保存は残し、STUDIOの編集モデル・保存DB・履歴を独立させる。共通時間軸に版別レイアウトを重ね、時刻指定の描画と同じ時刻規則の音声合成をプレビュー／出力で共有する。UNFOLD配置は設定コピーを持ち、旧レンダラーの必要箇所だけを抽出して接続する。

**Tech Stack:** 既存のブラウザES modules、HTML/CSS、Canvas/WebGL、Three.js 0.180.0、GSAP 3.13.0、Troika 0.52.4、Rapier 0.21.0、IndexedDB、Web Audio、WebCodecs、Node test、Playwright。追加提案はMediabunny 1.61.3とp5.js 2.3.3（後述の依存承認対象）。

**Spec:** 承認済み [2026-10-10-studio-design.md](../specs/2026-10-10-studio-design.md)、改訂2、Git `e7bc887fe02d7d87eca3e306613b573ce37172bd`。ローカル参照が開けない場合は [Libraryの設計書](https://chatgpt.com/api/library/files/libfile_9cc97baf5d848191be17a9104b52af3d/download)（この計画の基準はversion 1、SHA256 `7c3e2034231d72c5c4114f3f20abd132b76f01a5c1e4e4ab63af5c83064c6c29`）を併読する。

## Global Constraints

- 「横16:9と縦9:16、動画の元音声は初期必須で、後回しにしません。」
- 「主曲トラックと歌詞トラックに個別の位置ロックを設け、初期値はON。」
- 「位置ロックは『全編集禁止』ではありません。」歌詞外観と主曲音量は変更可。時刻・行構造変更・削除は明示解除まで拒否。
- 「初期は連続する1区間を選び、複数箇所の抜粋を連結する別編集時間軸は作りません。」この案と削除で後続を詰めない案は今回の計画作成前に承認済み。
- 「作品時刻=S＋出力時刻」。区間開始で歌詞・動画・p5・UNFOLDを再スタートしない。音声も同じ[S,E)を使う。
- 「境界フェードは既定OFF」。出力設定にだけ適用し、原版・元クリップは不変。
- 「リンクは初期値ON」。元音声は映像と同じ差分・使用区間で編集。主曲・歌詞・独立SFXは動かさない。
- 「旧`unfold-projects/current`、旧ファイルへの自動保存ハンドル、旧`clearAutosave`、旧未使用素材削除を一切呼びません。」STUDIO専用DBは `unfold-studio-projects`。
- 「原本を残し、STUDIOが所有するコピーを作ります。」UNFOLD再編集、工房更新、縦レイアウトが他配置・原本・横版へ意図せず波及しない。
- 検証寸法は横1920×1080／縦1080×1920・30fps。文字最大幅84%、一般余白左右8%／上下10%、文字縮小下限は短辺3%。SNS固有領域の保証ではない。
- 「任意p5.jsの無変更実行」「任意映像の完全自動再構図」「自動音量調整」「速度変更」は初期範囲外。
- CPU ImageData経由の画像転送、既存コードの隔離・明示確認・強制終了を維持。外部素材送信・クラウド処理・公開・pushを追加しない。
- 今回承認されたのは本計画の作成まで。全チェック欄は将来の作業で未実施。実装開始には本計画のレビューと実行方式の選択が必要。

## Review Focus

- F1: 短区間／長い曲の端数で、余分な1フレーム・音声サンプルや累積ずれが発生しない（T1、T9、T17）。
- F2: シーク直後・中止直後に遅れて返る動画／フォント／演出が、別の時刻・版へ混ざらない（T8、T11、T15、T16）。
- F3: タブ切替・編集権移譲中の遅い保存、容量不足、Undo素材の回収で既存データを失わない（T5、T6、T7）。
- F4: 結合文字・絵文字・長歌詞・固定横構図が縦で切れたり、改行で文字IDや強調時刻が変わらない（T10、T11、T13）。
- F5: 音声開始差のある動画、分割フェード、リンク解除と削除で二重音・無音・同期ずれを生まない（T4、T8、T9、T18）。

---

## ユーザー向けの実装順と確認ポイント

1. **作品を壊さない土台**：時間、位置ロック、Undo、別保存を作り、映像を編集しても曲と歌詞が動かないことを確認する。
2. **素材を正しく扱う部品**：画像・動画と元音声・文字・UNFOLD・p5を個別に検証。横縦の構図も別に持つ。
3. **30秒の混合MV**：曲・効果音・動画音声を混ぜ、横／縦・区間ショートを音付き出力。途中から始めても演出と音が一致することを確認する。
4. **操作できるSTUDIO**：制御盤風の画面、タイムライン、工房図鑑を接続し、実際の操作で同じ結果を確認する。
5. **1曲通しと旧機能**：長い作品の資源・待ち時間・音ずれを測定し、旧シーケンス・工房の回帰を確認する。

機能単位の実装者と独立レビュー担当を分け、合格した単位から進める方式を推奨する。保存・時間・描画の契約をまたぐ変更が多いためである。まだ担当を起動せず、本計画のレビューで停止する。納期や実時間以上の描画速度は約束しない。

## 0. 実行環境の事実と依存判断

確認基準はGit `e7bc887`。作業ツリーはクリーン。ルート `AGENTS.md`／`.agents/skills` は存在しない。NodeはこのMacでv25.8.0、Chrome実行ファイルと既存Playwright Coreのファイルの存在を確認した。**今回テストは実行していない。** 旧資料にある362件成功等は過去の記録であり、本計画の成功実績に転記しない。

既存のNodeコマンドは `node --test --test-reporter=tap tools/test/*.test.mjs`。既存ブラウザテストは固定ポートや過去worktree内のPlaywrightを参照するものがある。新STUDIOテストは以下の環境変数を受ける専用ヘルパーをT5で作り、旧テストのファイルを都合よく書き換えて成功扱いにしない。

```sh
export UNFOLD_PLAYWRIGHT_PATH=/Volumes/ORICO/UNFOLD/.worktrees/method-workshop/tools/image-code-build/.test-deps/node_modules/playwright-core/index.mjs
export UNFOLD_CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```

新ブラウザコマンドは各自が `tools/lib/static-server.mjs` で空きポートのサーバーを開始し、専用の非永続BrowserContextを作り、finallyで閉じる。ページは `/__tools/test/studio/host.html`。ユーザーの日常ブラウザや保存中作品をテスト対象にしない。ログ・映像・スクリーンショットは `tools/out/studio/`（既存ignore対象）へ保存し、要約だけを将来の検証報告へ記録する。

### 新依存の提案 — 今回は追加しない

| 提案 | 既存との差分と採用理由 | 承認・検証の境界 |
| --- | --- | --- |
| Mediabunny 1.61.3 | 現行は映像エンコード／自作muxのみ。入力動画のフレーム読取、トラック時刻、段階的な入出力のために採用する案 | T8着手前に本計画の依存採用を承認。配布版・ライセンス同梱・APIの適合を確認し、失敗時は別版へ自動変更せず計画へ戻す |
| p5.js 2.3.3 | 現行のThree/GSAP APIとは別の実行環境。承認済み1種類を時刻指定で描くためにローカル同梱 | T15着手前に依存採用を承認。p5.soundは使わず、音声はSTUDIO共通系に統一 |
| esbuild 0.25.10 | 既存と同じ版をSTUDIO用ビルドに固定 | `tools/studio-build/`へ分離し、既存image-code-buildの依存を更新しない |

各追加は実装承認時に上表を含めて確認する事項で、今回の計画作成承認をインストール承認と解釈しない。承認後は同じ内容を再確認しない。CDN実行・新サービス・サーバー音声処理は不要。候補のライセンス表示をコピーし、許諾判断が不明なら配布前に解消する。

Mediabunnyの入力は部分読取とトラック時刻を扱い、出力はメモリ／分割書込を選べるため、本計画のアダプター候補とした。実機性能は未確認。[公式入力](https://mediabunny.dev/guide/reading-media-files)、[公式出力](https://mediabunny.dev/guide/writing-media-files)、[版情報](https://raw.githubusercontent.com/Vanilagy/mediabunny/main/package.json)。p5の版は[公式配布案内](https://p5js.org/download/)、手動描画は[redraw](https://p5js.org/reference/p5/redraw/)を確認した。これは任意スケッチの巻き戻し互換を意味しない。

## 1. ファイル責務と共通契約

製品の新規モジュールは `app/studio/` にまとめる。既存製品への変更はT11の文字描画依存注入、T12/T13のシーケンス描画接続、T19の入口に限定し、無関係な整理をしない。各タスクのFilesはここからの正確なパスであり、記載のない製品ファイルを変更する時は理由をレビューに提示する。

| まとまり | 新規ファイル | 責務 |
| --- | --- | --- |
| 時間・編集 | `model.js`, `time.js`, `commands.js`, `history.js`, `audio-edits.js` | 保存可能なデータ、純粋な編集とUndo |
| 保存 | `assets.js`, `store.js`, `lease.js`, `file.js`, `legacy-import.js` | STUDIO所有素材、原子的保存、編集権、専用ファイル、旧読取 |
| 素材・音 | `media.js`, `audio-mix.js` | 動画の指定時刻読取、3種音声のサンプル合成 |
| 配置・文字 | `layout.js`, `text-layout.js`, `text-layer.js`, `image-layer.js` | 版別構図と文字IDを保った改行・描画 |
| UNFOLD | `unfold-layer.js`, `unfold-edit.js` | 旧描画への接続、配置ごとの作業コピー |
| p5 | `p5-runtime.js`, `p5-frame.html`, `p5-presets.js` | 隔離した手動描画と承認済み演出1種 |
| 合成・出力 | `compositor.js`, `transport.js`, `export.js` | 同時刻合成、共通時計、音付き区間出力 |
| UI | `controller.js`, `view.js`, `timeline.js`, `inspector.js`, `workshop.js` | コマンド発行、画面、工房配置。保存／時間を直接変更しない |

上表の相対パスは全て `app/studio/` 配下。旧描画から抽出する新規 `app/sequence-core.js`、`app/sequence-renderer.js`、入口 `app/studio.html`／`app/studio.css` は別に各タスクで指定する。

### DTOと時間（JSDocで定義。TypeScript導入を意味しない）

- `Us = number`: 安全な整数マイクロ秒。作品の時間は非負。区間は常に半開区間 `[startUs,endUs)`。`ViewId = 'wide'|'tall'`、fps=30、音声sampleRate=48000。
- `Project`: `{format:'unfold-studio',version:1,id,revision,durationUs,fps,bg,scenes,clips,lyrics,audio,locks,views,shorts,assets,unfolds}`。`locks={music:true,lyrics:true}` が新規既定。`revision` は保存版で、編集履歴版とは分ける。
- `Scene`: `{id,startUs,endUs,originUs}`。内部時刻 `localUs=projectUs-originUs`。左端トリムはstartUsだけ、移動はstart/end/originを同差分変更。
- `Clip`: `{id,name,sceneId,kind,startUs,endUs,sourceInUs,effectOriginUs,assetId?,unfoldId?,presetId?,text?,motion?,settings?,opacity,z,seed}`。start/endはシーン内部時刻。素材時刻は `sourceInUs+localUs-startUs`、演出時刻は `localUs-effectOriginUs`。左トリムでsourceInも補正し、分割でeffectOriginは維持する。
- `Lyric`: `{id,startUs,endUs,text,runs,motion,timingSource,opacity,z}`。絶対時刻。runsは既存の強調・色・文字IDを保持する。表示改行はtextを変えない。
- `AudioClip`: `{id,role:'music'|'sfx'|'source',assetId,trackId?,startUs,endUs,sourceInUs,linkClipId:null|string,muted,gain,envelope}`。リンク中の時間は映像から導出し保存値を別々に編集しない。解除時は可聴範囲の絶対時刻に固定する。
- `Envelope`: `{originUs,points:[{atUs,gain}]}`。分割は同じ基準点と曲線を保持し、使用区間だけを切る。UIのfade-in/out指定をこの点列へ変換する。元音声のPTS差は素材メタデータで保持。
- `View`: `{id,width,height,layout:Record<clipOrLyricId,Layout>,safe:{left:.08,right:.08,top:.10,bottom:.10}}`。`Layout={x,y,scale,rotation,anchor:'canvas'|{clipId},fit:'contain'|'cover'|'manual',focus:{x,y},backdrop:'solid'|'blur',textWidth:.84,fontScale:.03,breaks:[],camera?}`。画面比率基準の値を両版別に所有し、動的継承しない。
- `Short`: `{id,viewId,startUs,endUs,fadeInUs:0,fadeOutUs:0}`。作品を変えない出力設定。`AssetMeta={id,type,byteLength,hash,durationUs?,tracks?,rotation?}`。`UnfoldSnapshot={id,version:1,state,dependencies}` はバイトを除く旧描画状態と固定依存参照。
- `Issue={code,targetId?,message}`。検証失敗はIssue一覧を返し、実行系は `StudioError(code,issues)` で中止。`code` はタスクに記すものを固定し、未対応を正常データへ置換しない。

### 共通ポート

- `AssetReader.get(assetId:string):Promise<Blob>`、不足は `MISSING_ASSET`。バイトの返却で所有権は移動しない。
- `FrameRequest={projectUs,viewId,width,height,epoch,signal:AbortSignal}`。`LayerFrame={bitmap:ImageBitmap,close():void}`。全Layerは `prepare(clip,project,assets,signal):Promise<void>; render(request):Promise<LayerFrame>; dispose():void`。consumerがcloseし、古いepochの結果も必ずclose。
- `PCM={sampleRate:48000,channels:Float32Array[]}`。`MediaReader.videoFrame(assetId,sourceUs,signal):Promise<{frame:VideoFrame,ptsUs,endUs}>` と `audioBlock(assetId,trackId,sourceStartSample,frames,signal):Promise<PCM>`。存在しない時間は音声は0、映像は定義した保持／背景ルール。未対応はエラー。
- 各タスクのテスト断片は**将来のテスト例**。`node:test`と`node:assert/strict`を用い、Interfaces記載の名前をimportする。断片は抜粋で、テスト本体・fixtureは指定ファイルに作る。今回実行可能な製品コードを作る指示ではない。

### 所有権・UI状態の補足契約

- `AssetMeta` は `projectId` を必須とし、hashによる重複共有は同じprojectId内だけ。T5 `putAsset(blob,meta)` のmetaにprojectIdを渡す。別作品へ取り込む時は新IDで所有コピーを作る。
- T3 historyは `status():{canUndo,canRedo,undoLabel,redoLabel}` を返し、コマンドから「縦の配置変更」「共通の分割」等のラベルを記録する。
- T5 Storeへ `protect(ownerId,ids:Set<string>):Promise<void>` と `releaseProtection(ownerId):Promise<void>` を設ける。編集確定前に新draft/Undo参照を永続保護し、GCは保存全作品と全ownerの保護集合の和を使う。失権・タブ終了だけでは未保存draftの参照を消さない。不要draftの明示破棄時に解除する。
- T19 subscriberは `{project,viewId,projectUs,selection,historyStatus,saveState,leaseMode,issues,exportState}` を受ける。saveStateは `dirty|saving|saved|error`、exportStateは `idle|preparing|running|cancelled|error|done`。保存/出力の成功は完了イベント後だけ。
- T1の作品長はframe境界に確定して保存。T20の長さ縮小は映像/音声がはみ出す場合に `CONTENT_OUT_OF_RANGE` で拒否し、shortsだけが範囲外なら保持して出力を止める。入力のstart/end秒を暗黙に編集しない。

## 2. 依存順と独立した合格ゲート

| 段階 | タスク | 単独で検証できる成果／次への条件 |
| --- | --- | --- |
| A | T1〜T7 | 描画なしで時間・編集・ロック・Undo・保存／旧データ保護が合格 |
| B | T8〜T15 | 動画音声、合成音、横縦配置、文字、UNFOLD、p5を各テストページで個別に描画・評価 |
| C | T16〜T18 | UI完成を待たず、30秒の全素材と横縦・音声3種・区間出力を縦断検証 |
| D | T19〜T21 | 実操作、位置ロック、工房見本、再編集がCと同じエンジンを使う |
| E | T22 | 1曲通しと既存回帰、性能記録。全体レビュー後も公開しない |

T2←T1、T3←T2、T4←T3、T5←T1/T3、T6←T5、T7←T5/T6。T8←T1/T5、T9←T4/T8、T10←T1/T2、T11←T10、T12←現行コード、T13←T12/T8、T14←T7/T13、T15←T8/T10。T16←T8〜T15、T17←T9/T16、T18←T7/T17。T19←T18、T20←T19、T21←T14/T20、T22←T21。依存先が合格するまで統合しない。将来の並行実装はインターフェースを固定した部品だけで行い、同じファイルを複数担当で同時変更しない。

各タスクは「失敗テスト→最小実装→成功確認→対象だけローカルコミット→レビュー」を1単位とする。実行時は管理されたworktreeを用意し、タスクの途中変更を他タスクへ混ぜない。新テストの不在／関数未定義による失敗は最初の確認に限り有効。環境故障・コーデック不在は赤テストの成功ではなくブロッカーとして報告する。

## 3. 段階A — 時間・編集・保存

### T1: 時間と検証可能な作品モデル

**Files:** Create `app/studio/model.js`, `app/studio/time.js`; Test `tools/test/studio/model-time.test.mjs`, `tools/test/studio/fixtures.mjs`。

**Interfaces:** `createProject({id,durationUs}):Project`, `validateProject(p):Issue[]`, `StudioError`; `frameUs(index,fps=30):Us`, `rangeFrames(startUs,endUs,fps=30):{startFrame,endFrame,startUs,endUs}`, `outputProjectUs(range,index):Us`, `sceneLocalUs(scene,projectUs):Us`。rangeは入力秒を保持せず、開始はfloor／終了はceilでフレーム境界へ寄せた値を返す。UIはその実値を表示し、空区間と範囲外は拒否する。

- [ ] **赤テストを書く。** fixturesの `mixedProject()` は30秒、シーン0–8／8–14／14–22／22–30秒、歌詞12–16秒、SFX14秒、主曲30秒の固定データ。実装を呼んで期待値を生成しない。
```js
assert.deepEqual(createProject({id:'p',durationUs:30e6}).locks, {music:true,lyrics:true});
assert.equal(outputProjectUs(rangeFrames(6e6,24e6),0),6e6);
assert.equal(rangeFrames(1,2).endFrame-rangeFrames(1,2).startFrame,1);
assert.equal(frameUs(18000),600e6);
assert.throws(()=>rangeFrames(2e6,2e6),e=>e.code==='EMPTY_RANGE');
assert.equal(validateProject({...mixedProject(),scenes:overlappingScenes()})[0].code,'SCENE_OVERLAP');
```
同じファイルに負数、NaN、unsafe integer、重複ID、不在scene参照、範囲外レイアウト参照、1フレーム・600秒末尾の半開区間を追加する。`overlappingScenes()` はfixture内でs2開始を7秒にした固定配列。
- [ ] **赤を確認。** `node --test tools/test/studio/model-time.test.mjs` → 未実装exportでFAIL。
- [ ] **実装。** 上記2ファイルへ純粋関数を実装。フレーム時刻を整数indexから毎回算出し、繰返し加算しない。UI／DB／DOMをimportしない。
- [ ] **緑を確認。** 同じコマンド→全件PASS。
- [ ] **ローカルコミット。** `git add app/studio/model.js app/studio/time.js tools/test/studio/model-time.test.mjs tools/test/studio/fixtures.mjs`、`git commit -m "feat(studio): define project and absolute time contracts"`。

### T2: シーン・クリップの純粋編集

**Files:** Create `app/studio/commands.js`; Test `tools/test/studio/commands.test.mjs`。

**Interfaces:** Consumes T1。`applyCommand(p,command):{project:Project,changed:boolean}` は入力を変更せず、不正操作はStudioErrorで全件拒否。Command判別は `type`。`insertScene{scene}`、`insertClip{clip,layouts,assetMetas}`、`setClipContent{id,patch}`（text/motion/settings/opacity/z/seedのみ）、`moveScene{id,startUs}`、`trimScene{id,startUs,endUs}`、`splitScene{id,atUs,newId,idMap}`、`reorderScenes{ids,order}`、`deleteScene{id}`、`moveClip{id,startUs}`、`trimClip{id,startUs,endUs}`、`splitClip{id,atUs,newId,newUnfoldId?}`、`deleteClip{id}`、`setLayout{viewId,id,patch}`。idMapは分割で生成するclip／unfold IDの明示対応。T3/T4で同じ入口へ種類を追加する。

- [ ] **赤テスト。** s1の表示範囲を0–8秒から2–8秒へ左端トリムした時の内部時刻と、削除／並べ替えの非波及を固定する。
```js
assert.equal(applyCommand(p,{type:'trimScene',id:'s1',startUs:2e6,endUs:8e6}).project.scenes[0].originUs,0);
assert.equal(applyCommand(p,{type:'deleteScene',id:'s2'}).project.scenes.find(x=>x.id==='s3').startUs,14e6);
assert.throws(()=>applyCommand(p,{type:'moveScene',id:'s1',startUs:9e6}),e=>e.code==='SCENE_OVERLAP');
assert.deepEqual(afterSplit.views.tall.layout.right, beforeSplit.views.tall.layout.left);
assert.equal(afterSplit.clips.find(x=>x.id==='right').effectOriginUs, beforeSplit.clips[0].effectOriginUs);
```
`beforeSplit/afterSplit` はclip分割コマンド前後のfixture。連続シーンの並べ替えで各長さ・グループ両端を保存、隙間を含む選択は `NONCONTIGUOUS_REORDER`、1フレーム未満の分割は拒否、版別配置の深い独立コピー、削除が両版から消えることもassertする。UNFOLD snapshotの分割コピーIDも独立。
- [ ] **赤確認。** `node --test tools/test/studio/commands.test.mjs` → FAIL。
- [ ] **実装。** commands.jsでvalidate後に変更を確定。移動はoriginも同差分、トリムは表示境界のみ、分割は内部時刻・演出originを保持。隣接へ自動押出ししない。音声の追従規則はT4で追加するまでUIへ公開しない。
- [ ] **緑確認。** `node --test tools/test/studio/model-time.test.mjs tools/test/studio/commands.test.mjs` → PASS。
- [ ] **コミット。** `git add app/studio/commands.js tools/test/studio/commands.test.mjs`、`git commit -m "feat(studio): add non-ripple visual editing commands"`。

### T3: 位置ロックとUndo／Redo

**Files:** Create `app/studio/history.js`; Modify `app/studio/commands.js`; Test `tools/test/studio/history-locks.test.mjs`。

**Interfaces:** `createHistory(p):{get():Project,execute(command):void,undo():void,redo():void,refs():Set<string>,reset(p):void}`。追加Command: `setLock{track:'music'|'lyrics',locked}`、`setLyricText{id,text,runs}`（同じ行IDの修正）、`setLyricAppearance{id,patch}`、`setLyricTiming{id,startUs,endUs}`、`replaceLyrics{lyrics}`、`deleteLyric{id}`、`setAudioGain{id,gain}`、`batch{commands}`。UIの選択や表示版は履歴外。全音声の時間構造コマンドはT4に定義。

- [ ] **赤テスト。**
```js
assert.throws(()=>h.execute({type:'setLyricTiming',id:'l1',startUs:10e6,endUs:16e6}),e=>e.code==='TRACK_LOCKED');
h.execute({type:'setLyricText',id:'l1',text:'誤字修正',runs:[]}); assert.equal(h.get().lyrics[0].startUs,12e6);
h.execute({type:'setLock',track:'lyrics',locked:false}); h.undo(); assert.equal(h.get().locks.lyrics,true);
assert.throws(()=>h.execute({type:'batch',commands:[deleteVisual,deleteLockedLyric]}),e=>e.code==='TRACK_LOCKED');
assert.deepEqual(h.get(),beforeBatch);
```
fixtureでdeleteVisual/deleteLockedLyric/beforeBatchを明示。Undo→Redoの深い一致、Redo後新編集で枝消去、Undo参照素材はrefsに残る、ロック解除→時間編集→再ロック→Undoの逆順復元、ロック中の主曲音量変更可、主曲削除禁止をT4追加後も同じsuiteで検証する。
- [ ] **赤確認。** `node --test tools/test/studio/history-locks.test.mjs` → FAIL。
- [ ] **実装。** historyは確定済み状態の履歴を所有。batch全体を事前検証し部分適用しない。ユーザー操作のロック判定と過去状態の復元を混同しない。履歴を切るとrefsも更新する。
- [ ] **緑確認。** `node --test tools/test/studio/*.test.mjs` → PASS（この時点まで）。
- [ ] **コミット。** `git add app/studio/history.js app/studio/commands.js tools/test/studio/history-locks.test.mjs`、`git commit -m "feat(studio): protect track timing and add atomic undo"`。

### T4: 映像元音声のリンク編集と独立音声

**Files:** Create `app/studio/audio-edits.js`; Modify `app/studio/commands.js`; Test `tools/test/studio/audio-edits.test.mjs`, `tools/test/studio/history-locks.test.mjs`。

**Interfaces:** `resolveAudioSpan(p,audioId):{startUs,endUs,sourceInUs,envelope}`、`reconcileLinkedAudio(before,after):Project`。追加Command: `insertAudio{audio}`、`moveAudio{id,startUs}`、`trimAudio{id,startUs,endUs}`、`splitAudio{id,atUs,newId}`、`deleteAudio{id}`、`muteAudio{id,muted}`、`setEnvelope{id,envelope}`、`detachAudio{id,newId}`、`recreateSourceAudio{clipId,newId,allowDuplicate:false|true}`。リンク解除時は元リンクを除去しnewIdを独立音声にする。リンク音声への単独move/trimは `LINKED_AUDIO_EDIT`。

- [ ] **赤テスト。**
```js
assert.equal(resolveAudioSpan(moved,'aVideo').startUs,9e6);
assert.equal(detached.audio.some(a=>a.id==='aVideo'),false);
assert.equal(detached.audio.find(a=>a.id==='detached').linkClipId,null);
assert.deepEqual(resolveAudioSpan(detached,'detached'),audibleSpanBeforeDetach);
assert.equal(deletedLinked.audio.find(a=>a.id==='aVideo').muted,true);
assert.equal(deletedLinked.clips.some(c=>c.id==='cVideo'),true);
```
各値はmove／detach／deleteAudioコマンドの結果。追加assert: scene削除でリンク音声だけ消える、独立化後はscene削除でも残る、分割前後の包絡線値が境界両側で等しい、複製警告承認なし再生成は `DUPLICATE_AUDIO_CONFIRMATION`、主曲ロックで移動・分割・削除拒否、SFXは移動可、Undoで音声二重化ゼロ。
- [ ] **赤確認。** `node --test tools/test/studio/audio-edits.test.mjs tools/test/studio/history-locks.test.mjs` → FAIL。
- [ ] **実装。** sceneとclip双方の可視区間でリンク音声を切り、動画トラックの開始PTS差を保持。detachは可聴範囲とgain/envelope/muteをコピーする。リンク音声Deleteはmuteに解釈する。
- [ ] **緑確認。** `node --test tools/test/studio/*.test.mjs` → PASS。
- [ ] **コミット。** `git add app/studio/audio-edits.js app/studio/commands.js tools/test/studio/audio-edits.test.mjs tools/test/studio/history-locks.test.mjs`、`git commit -m "feat(studio): preserve linked source audio through edits"`。

### T5: 専用DBと素材所有・容量失敗時の保護

**Files:** Create `app/studio/assets.js`, `app/studio/store.js`, `tools/test/studio/browser-helper.mjs`, `tools/test/studio/host.html`; Test `tools/test/studio/store-browser.mjs`。

**Interfaces:** `openStudioStore({dbName='unfold-studio-projects',faults?}):Promise<Store>`。Store: `putAsset(blob,meta):Promise<AssetMeta>`, `get(id):Promise<Blob>`, `load(projectId):Promise<Project|null>`, `save(p,{expectedRevision,fence}):Promise<Project>`, `gc({protectedIds:Set<string>}):Promise<{deletedIds:string[]}>`, `close():void`。`collectAssetRefs(p):Set<string>` はunfold依存も辿る。saveのfence検証器はT6で接続（それまでは試験用固定fenceのみ）。`faults` はテスト依存注入、製品UIから設定不可。

- [ ] **赤テスト。** helperの `withStudioPage(fn):Promise<void>` で専用contextを起動。旧DBにsentinel、STUDIOに2作品＋Undoだけの素材を保存する。
```js
assert.deepEqual(await readLegacySentinel(page),legacyBefore);
assert.equal((await page.evaluate(runQuotaFailureCase)).errorCode,'QUOTA_EXCEEDED');
assert.equal((await page.evaluate(readLastSaved)).revision,1);
assert.deepEqual((await page.evaluate(gcWithHistoryRefs)).deletedIds,['orphan']);
assert.equal(await page.evaluate(reloadAndReadUndoAsset),true);
```
page内fixture関数はこのtestに置く。DOMException QuotaExceededErrorをblob登録時／最終save時それぞれ注入し、最後の保存manifestと素材が残る。素材欠損はMISSING_ASSET。古い保存候補の参照だけを使うGCを禁止し、全保存作品・draft・履歴の和集合を試験する。
- [ ] **赤確認。** `node tools/test/studio/store-browser.mjs` → 未実装でFAIL（環境起動失敗は別途解消）。
- [ ] **実装。** assetsは不変blob＋ID/hash所有、storeはprojects/assets/drafts/leasesの専用stores。blobを確保してからmanifestを原子的に切替、失敗時現行保持。GCは明示操作に限定しautosaveから呼ばない。試験helperは冒頭記載のenv／static serverを使い、contextとserverをfinallyで閉じる。
- [ ] **緑確認。** 同じコマンド→PASS、旧sentinel一致と再読込成功をログへ記録。
- [ ] **コミット。** `git add app/studio/assets.js app/studio/store.js tools/test/studio/browser-helper.mjs tools/test/studio/host.html tools/test/studio/store-browser.mjs`、`git commit -m "feat(studio): isolate durable project and asset storage"`。

### T6: 複数タブの編集権と遅延保存

**Files:** Create `app/studio/lease.js`; Modify `app/studio/store.js`; Test `tools/test/studio/lease-browser.mjs`。

**Interfaces:** `acquireLease(store,projectId,{ownerId,takeover:false|true,onLost}):Promise<Lease>`。Lease `{fence,mode:'writer'|'reader',renew():Promise<void>,release():Promise<void>}`。通常は先着writer、ユーザー明示takeoverはfence単調増加。更新間隔5秒、有効15秒は管理値であり編集データの期限ではない。BroadcastChannelは通知だけ、真の判定はsaveと同じDB transactionのfence＋revision比較。画面状態からの自動takeover禁止。

- [ ] **赤テスト。** 同じ非永続context内に2pageを用意し、遅い保存をbarrierで止める。
```js
assert.equal(tabBInitial.mode,'reader');
assert.ok(takeover.fence>tabA.fence);
assert.equal(await finishDelayedSaveFromA(),'STALE_WRITER');
assert.equal(await readSavedOwner(),'B');
assert.equal(await attemptStaleRevisionSave(),'REVISION_CONFLICT');
```
タブAのUndo後の保存も失権なら拒否、タブBへAのUndo履歴を混ぜない、reloadは保存済みのみ復元して履歴reset、タブclose／期限切れ再取得、Broadcast通知遅延でも旧writerが書けないことをassert。
- [ ] **赤確認。** `node tools/test/studio/lease-browser.mjs` → FAIL。
- [ ] **実装。** leaseのfenceをstore.saveが同transaction内で検証。失権時にUI操作を止める通知、未保存内容はdraftとして別IDに退避可能にし現行へ強制上書きしない。エラーでtakeoverを勝手に行わない。
- [ ] **緑確認。** `node tools/test/studio/lease-browser.mjs` と `node tools/test/studio/store-browser.mjs` → PASS。
- [ ] **コミット。** `git add app/studio/lease.js app/studio/store.js tools/test/studio/lease-browser.mjs`、`git commit -m "feat(studio): fence concurrent editors and stale saves"`。

### T7: 専用ファイルと旧作品の読み取り変換

**Files:** Create `app/studio/file.js`, `app/studio/legacy-import.js`; Test `tools/test/studio/file.test.mjs`, `tools/test/studio/file-browser.mjs`。

**Interfaces:** `writeStudioFile(p,assets,sink,{signal}):Promise<void>`、`readStudioFile(blob,{signal}):Promise<{project,blobs:Map<string,Blob>}>`、`importLegacy(blob,{projectId,includeMusic,includeLyrics}):Promise<{project,blobs,warnings:Issue[]}>`。sink `{write(Uint8Array):Promise<void>,close():Promise<void>,abort(reason):Promise<void>}`。`.unfoldstudio` v1は固定magic `UNFOLD-STUDIO-1\n`＋uint64 LEのmanifest UTF-8長＋manifest＋連続blob。manifestには相対offset/length/hash、シリアライズ済みProject、依存一覧。未知version拒否。旧v1〜v4の仕様はproject.jsを読むが、そのモジュール自体はimportしない。

- [ ] **赤テスト。**
```js
assert.deepEqual((await readStudioFile(encoded)).project,roundTripProject);
await assert.rejects(()=>readStudioFile(badVersion),e=>e.code==='UNSUPPORTED_VERSION');
await assert.rejects(()=>readStudioFile(badOffset),e=>e.code==='INVALID_ASSET_RANGE');
assert.equal(converted.project.format,'unfold-studio');
assert.equal(converted.project.views.tall.layout.cVideo.fit,'contain');
```
Nodeではmetadata／範囲／hash／重複ID検証、ブラウザでは旧v1〜v4 fixture読取・GLB/フォント不足の明示・ファイル中止・容量失敗・再読込で両版と音声設定復元・旧DB/file handle不変。極小manifest長、巨大長偽装、重複範囲を拒否。実バイト不足は `MISSING_ASSET`。変換を確定する前に全部validateし、現在作品を消さない。
- [ ] **赤確認。** `node --test tools/test/studio/file.test.mjs`、`node tools/test/studio/file-browser.mjs` → FAIL。
- [ ] **実装。** Blob.sliceで部分読取、書出しは逐次sink。旧変換は新project ID／新asset ID／配置snapshotを発行、原本の保存ハンドルを受け取らない。主曲／歌詞の取り込みは新規初回だけ明示選択、既存への追加はT14の配置のみ。編集候補は全検証後T5/T6へ保存。
- [ ] **緑確認。** 上記2コマンド＋ `node tools/test/studio/store-browser.mjs` → PASS。
- [ ] **コミット。** `git add app/studio/file.js app/studio/legacy-import.js tools/test/studio/file.test.mjs tools/test/studio/file-browser.mjs`、`git commit -m "feat(studio): round-trip independent project files safely"`。

## 4. 段階B — 素材・音声・描画の部品

### T8: 入力動画・元音声の指定時刻読取

**Files:** Create `app/studio/media.js`, `tools/studio-build/package.json`, `tools/studio-build/package-lock.json`, `tools/studio-build/build.mjs`, `app/vendor/studio-media.js`, `app/vendor/studio-media-LICENSE.txt`; Test `tools/test/studio/media-browser.mjs`, `tools/test/studio/media-fixtures.mjs`。

**Interfaces:** `createMediaReader(assets,{maxDecodedFrames=12,maxAudioSeconds=8}):MediaReader`（共通ポート）。追加 `probe(assetId):Promise<{video,audioTracks,durationUs,rotation,issues}>`, `dispose():void`, `stats():{videoFrames,audioSeconds,pending}`。sample位置は素材全体の時刻基準で、track最初のPTSとの差を消さない。test用 `makeMediaFixtures(page):Promise<Map<string,Blob>>` は目視可能な時刻番号と音のマーカーを持つMP4を生成する。

- [ ] **赤テスト。** H.264＋AAC、音声なし、音声decode非対応、回転90度、24/30/60fps、可変PTS、音声開始+250msのケースを入力する。先に環境のencoder/decoder対応を検査し、作れない必須fixtureはBLOCKEDとしPASSにしない。
```js
assert.equal(probed.rotation,90);
assert.equal(probed.audioTracks[0].startUs,250000);
assert.equal(await sampleBeforeAudioStart(),0);
assert.ok(frame.ptsUs<=requestedUs && requestedUs<frame.endUs);
assert.equal(await cancelledSeekCode(),'ABORTED');
assert.ok(readerStats.videoFrames<=12);
```
遅い2秒読取→早い1秒読取の完了順を逆転して呼出側が区別可能なこと、close後pendingゼロ、非対応音声を無音の成功に変換しないことをassert。
- [ ] **赤確認。** `node tools/test/studio/media-browser.mjs` → FAIL。
- [ ] **実装。** 依存採用承認済みなら、上記専用packageへ固定版を追加しlockfile／licenseを生成。`npm ci --prefix tools/studio-build`、`node tools/studio-build/build.mjs` でローカルbundle。MediabunnyのBlob入力／トラック／sinkをmedia.jsのポート内に隠す。必要範囲だけ復号しLRU解放、VideoFrame所有権を明確化。非対応音声はIssueを返し、使用指定中は出力をブロックする。
- [ ] **緑確認。** 同コマンド→全必須ケースPASS。dependencyの配布API差は版を黙って変更せず計画差分としてレビュー。
- [ ] **コミット。** `git add app/studio/media.js tools/studio-build/package.json tools/studio-build/package-lock.json tools/studio-build/build.mjs app/vendor/studio-media.js app/vendor/studio-media-LICENSE.txt tools/test/studio/media-browser.mjs tools/test/studio/media-fixtures.mjs`、`git commit -m "feat(studio): decode media with original track timestamps"`。

### T9: 3種類の音声を同じサンプル時計で合成

**Files:** Create `app/studio/audio-mix.js`; Test `tools/test/studio/audio-mix.test.mjs`, `tools/test/studio/audio-browser.mjs`。

**Interfaces:** Consumes T4 resolveAudioSpan、T8 audioBlock。`mixAudio(p,reader,{startSample,frames,short?,signal}):Promise<{pcm:PCM,peak:number}>`、`gainAt(envelope,projectUs):number`、`boundaryGain(short,projectUs):number`。startSampleは作品先頭から、出力timestampへの変換はT17。channel=2、monoは両chへ同値、多chは明示した標準stereo downmix。出力前peak>1を通知し、勝手なnormalize／duckingをしない。

- [ ] **赤テスト。** 読取ポートstubは既知のimpulseと定数PCMを返す。
```js
assert.equal(mixed.pcm.channels[0][14*48000],expectedMusicPlusSourcePlusSfx);
assert.deepEqual(shortWithoutFade.pcm.channels[0],full.pcm.channels[0].slice(6*48000,24*48000));
assert.equal(boundaryGain({...short,fadeInUs:2e6,fadeOutUs:2e6},short.startUs),0);
assert.equal(splitMixDifference,0);
assert.equal(mutedSourceMixDifference,0);
```
expected値はfixture定数の算術和、差は分割前後／ミュート素材なしとの差。フェード重複は積、範囲短縮時長さ制限、1フレーム=1600samples、600秒末尾、44.1k入力の48k変換、トラックPTS差、detached音声1回だけを検証。browserでは実AAC decodeとAudioContext再生用bufferの同じmix使用を確認。
- [ ] **赤確認。** `node --test tools/test/studio/audio-mix.test.mjs`、`node tools/test/studio/audio-browser.mjs` → FAIL。
- [ ] **実装。** sample整数indexから時刻算出、区間外0、半開境界、クリップ包絡線×音量×short係数を別々に適用。素材decodeと分割cacheはT8に限定、合成結果を全曲分永続保持しない。
- [ ] **緑確認。** 上記2コマンドとT4単体→PASS、合成前の同期はsample単位一致。
- [ ] **コミット。** `git add app/studio/audio-mix.js tools/test/studio/audio-mix.test.mjs tools/test/studio/audio-browser.mjs`、`git commit -m "feat(studio): mix song source audio and effects sample accurately"`。

### T10: 横縦の独立配置と文字の再改行

**Files:** Create `app/studio/layout.js`, `app/studio/text-layout.js`; Test `tools/test/studio/layout-text.test.mjs`。

**Interfaces:** `defaultLayout(viewId,kind):Layout`、`resolveLayout(p,viewId,id):Layout`、`fitRect(sourceSize,targetSize,layout):{source,dest}`、`layoutTextRuns({runs,layout,width,height,measure}):{lines,glyphs,issues}`。measureはフォント準備済みの純粋な幅測定。glyphに元run ID/grapheme IDとtimingを保持し、表示改行は追加位置情報だけ。設定不足時は初期化時に両版へ値を書き込み、その後継承しない。

- [ ] **赤テスト。**
```js
assert.equal(tallDefault.fit,'contain');
assert.equal(tallDefault.textWidth,.84);
assert.deepEqual(p.views.wide.layout.l1,wideBeforeTallEdit);
assert.deepEqual(wrapped.glyphs.map(g=>g.id),originalGlyphIds);
assert.ok(tooLong.issues.some(x=>x.code==='TEXT_OVERFLOW'));
assert.ok(tooLong.glyphs.every(g=>g.fontSize>=1080*.03));
```
600文字、日本語禁則、結合濁点、家族絵文字、英単語長文、明示改行、手動改行、親anchor、縦回転素材、cover焦点をfixtureで検証。文字が収まらない時は下限以下へ縮めず警告を返し、勝手に文字を削除しない。
- [ ] **赤確認。** `node --test tools/test/studio/layout-text.test.mjs` → FAIL。
- [ ] **実装。** レイアウトは比率、サイズは短辺基準。元の文字分割を既存lyric-documentの仕様と照合し、表示用wrapでrunsを作り直さない。一般safeは左右8%上下10%、SNS固有保証の文言を作らない。
- [ ] **緑確認。** 同コマンドとT2→PASS。
- [ ] **コミット。** `git add app/studio/layout.js app/studio/text-layout.js tools/test/studio/layout-text.test.mjs`、`git commit -m "feat(studio): keep portrait layout and lyric wrapping independent"`。

### T11: 画像・自由文字・歌詞レイヤー

**Files:** Create `app/studio/image-layer.js`, `app/studio/text-layer.js`; Modify `app/lyric-painter.js` の任意依存注入のみ; Test `tools/test/studio/text-image-browser.mjs`。

**Interfaces:** `createImageLayer():Layer`, `createTextLayer():Layer`（共通ポート）。文字LayerのprepareはClipまたはLyricを受ける。既存 `app/lyric-document.js`, `lyric-motion.js`, `lyric-scene.js`, `lyric-painter.js`, `lyric-fonts.js` の描画・文字処理を参照し、旧sequenceの再生時計を参照しない。既存 `createLyricPainter()` に後方互換の任意引数 `{fontCSS=lyricFontCSS,compileScene=compileLyricScene}` を追加し、STUDIOは所有font bytesをFontFaceで準備したresolverと、T10のglyph位置を既存scene nodeへ反映するcompilerを渡す。旧呼出しと既定レイアウトは不変。コード文字は既存 `codeFrameInput` / `createCodeMotionRuntime` を直接呼び、STUDIO所有font bytesを渡す。

- [ ] **赤テスト。** 12–16秒の歌詞を13/14/15秒でシーンをまたいで描き、各版の同時刻seek再描画を比較。
```js
assert.equal(frameAt11HasLyric,false);
assert.equal(frameAt14HasLyric,true);
assert.equal(frameAt16HasLyric,false);
assert.deepEqual(seekGlyphIds,playGlyphIds);
assert.equal(delayedFontWrongEpochPublished,false);
assert.equal(missingFontResult.code,'MISSING_ASSET');
```
画像containで四隅markerを保持、blurは同じ画像frameを使う、縦文字サイズ下限と警告、highlight時刻・既存文字モーションを画素検査＋snapshotで確認。字体差がテスト環境依存にならないようfixtureは同梱フォントを指定する。
- [ ] **赤確認。** `node tools/test/studio/text-image-browser.mjs` → FAIL。
- [ ] **実装。** T10 layoutを適用し、各描画にprojectUs／effect内部時刻を明示。font待ち・画像decodeはsignalとepochで無効化、不要bitmapをclose。初期コード文字演出は対応済みのみ、未対応を別演出へ置換しない。
- [ ] **緑確認。** 同コマンド→PASS、既存 `node --test tools/test/*.test.mjs` →PASS。
- [ ] **コミット。** `git add app/studio/image-layer.js app/studio/text-layer.js app/lyric-painter.js tools/test/studio/text-image-browser.mjs`、`git commit -m "feat(studio): render image and timed text layers"`。

### T12: 旧シーケンスの純粋計算を抽出

**Files:** Create `app/sequence-core.js`; Modify `app/sequence.js` の `backgroundSeconds`／区間探索／変形係数計算部分のみ; Test `tools/test/studio/sequence-core.test.mjs`。

**Interfaces:** `compileSequenceTiming(snapshot):{durationUs,segments}`、`evaluateSequenceFrame(snapshot,projectUs):{segmentIndex,localUs,progress,transform,background}`。snapshotは旧seqデータのシリアライズ可能部分で音声HTML要素を含まない。旧秒・beat単位はこの境界で変換。既存画面が使う計算も同じ関数へ差し替え、STUDIOからsequence.js全体をimportしない。

- [ ] **赤テスト。** 旧image/fold/morphの代表状態と境界の期待値を先に旧挙動から固定する。
```js
assert.equal(compileSequenceTiming(oldFixture).durationUs,8e6);
assert.deepEqual(evaluateSequenceFrame(oldFixture,4e6),goldenAt4);
assert.deepEqual(evaluateSequenceFrame(oldFixture,1e6),goldenAt1AfterRewind);
assert.equal(Object.hasOwn(evaluateSequenceFrame(oldFixture,0),'audio'),false);
```
goldenは旧式の出力をレビュー時に固定、抽出後の関数で生成しない。末尾・0秒・遷移境界・固定beat分割を網羅。DOMなしNode importが成功することをassert。
- [ ] **赤確認。** `node --test tools/test/studio/sequence-core.test.mjs` → FAIL。
- [ ] **実装。** 計算のみ移す。新しい時間モデルへ旧UIを全面移行しない。旧seqの構造・保存・音声の挙動は維持。
- [ ] **緑確認。** 同コマンド＋ `node --test tools/test/*.test.mjs` →PASS。
- [ ] **コミット。** `git add app/sequence-core.js app/sequence.js tools/test/studio/sequence-core.test.mjs`、`git commit -m "refactor: isolate pure sequence frame evaluation"`。

### T13: UNFOLDを独立した描画インスタンスへ接続

**Files:** Create `app/sequence-renderer.js`, `app/studio/unfold-layer.js`; Modify `app/sequence.js` のrenderAt描画呼出し境界、`app/image-method-layer.js` のcustom method解決依存注入; Test `tools/test/studio/unfold-render-browser.mjs`。

**Interfaces:** `createSequenceRenderer({assets,resolveMethod,resolveModel}):{prepare(snapshot,signal):Promise<void>,render({timeUs,width,height,camera,signal}):Promise<LayerFrame>,dispose():void}`、`createUnfoldLayer():Layer`。`createImageMethodLayer(renderer,{onReady,onError,resolveMethod=getCustom})` として既存factoryの全 `getCustom` 呼出しを注入可能にし、旧呼出しは既定resolverで同挙動。STUDIOはsnapshot内の固定method/modelのみ返す。`unfoldCapabilities(snapshot):{editable:boolean,portraitDirect:boolean,issues}`。

- [ ] **赤テスト。** 同じsnapshotのA/Bインスタンスへ別timeを渡し、巻戻し後の描画を比較。
```js
assert.equal(AAfterBRendered,AAtSameTimeBefore);
assert.equal(legacyRegistryAfter,legacyRegistryBefore);
assert.equal(unfoldCapabilities(uncertified).portraitDirect,false);
assert.equal(containedPortraitCornersVisible,4);
assert.equal(rewoundSameViewFrameHash,originalSameViewFrameHash);
```
CPU ImageData転送、同じseed物理の固定刻み巻戻し、フォント・GLB欠損停止、disposeのworker/bitmap解放、旧renderの代表画像一致を確認。初期対応集合を代表fold/morph/imageメソッドの実fixtureで固定し、非対応はIssueとして表示する。
- [ ] **赤確認。** `node tools/test/studio/unfold-render-browser.mjs` →FAIL。
- [ ] **実装。** T12評価を使いDOM状態やglobal seqを注入しない。既存workerのseed・fixedDT・CPU snapshot方式を維持。横固定は矩形containを全版に利用でき、認証済みだけ縦camera再描画を許す。透明背景を要求しない。
- [ ] **緑確認。** 同コマンド＋旧Node全件→PASS。
- [ ] **コミット。** `git add app/sequence-renderer.js app/studio/unfold-layer.js app/sequence.js app/image-method-layer.js tools/test/studio/unfold-render-browser.mjs`、`git commit -m "feat(studio): render isolated editable UNFOLD placements"`。

### T14: 配置コピーの再編集と適用／取消

**Files:** Create `app/studio/unfold-edit.js`; Modify `app/studio/commands.js`; Test `tools/test/studio/unfold-edit.test.mjs`, `tools/test/studio/unfold-edit-browser.mjs`。

**Interfaces:** `beginUnfoldEdit(p,clipId):{draft:UnfoldSnapshot,assets:Set<string>}`、`applyUnfoldEdit(p,clipId,draft):Command`、`cancelUnfoldEdit(session):void`。追加Command `replaceUnfold{id,snapshot,assetMetas}`、`insertUnfold{sceneId,clip,snapshot,layouts,assetMetas}`。編集は形／画像／主要演出設定を含む。global seqを共有しない専用フォームをT20で接続し、ここではtest UIから使用する。

- [ ] **赤テスト。**
```js
assert.notEqual(p.clips.find(c=>c.id==='A').unfoldId,p.clips.find(c=>c.id==='B').unfoldId);
assert.deepEqual(afterApply.unfolds[AId],beforeApply.unfolds[AId]);
assert.notDeepEqual(afterApply.unfolds[BId],beforeApply.unfolds[BId]);
assert.equal(afterApply.clips.find(c=>c.id==='B').endUs,beforeApply.clips.find(c=>c.id==='B').endUs);
h.undo(); assert.deepEqual(h.get(),beforeApply);
```
cancelでProject完全不変、Bの共通内容はBの横縦で更新しAは不変、B縦cameraはB横に無影響、内部尺短縮は末尾保持＋通知／延長は枠外clip、旧DB/工房不変、初期音声／歌詞二重取り込みなしをassert。
- [ ] **赤確認。** `node --test tools/test/studio/unfold-edit.test.mjs` と `node tools/test/studio/unfold-edit-browser.mjs` →FAIL。
- [ ] **実装。** 適用を1command/1Undoへ変換し、保存はT5経由。描画用snapshotを独立複製、内部尺を外側時間へ自動反映しない。キャンセルしたdraft素材はT5保護参照から外し即消去せず後日GC対象へ。
- [ ] **緑確認。** 上記2件＋T13→PASS。
- [ ] **コミット。** `git add app/studio/unfold-edit.js app/studio/commands.js tools/test/studio/unfold-edit.test.mjs tools/test/studio/unfold-edit-browser.mjs`、`git commit -m "feat(studio): edit placement snapshots with one-step apply"`。

### T15: 承認済みp5演出1種の時刻指定描画

**Files:** Create `app/studio/p5-runtime.js`, `app/studio/p5-frame.html`, `app/studio/p5-presets.js`, `app/vendor/studio-p5.js`, `app/vendor/studio-p5-LICENSE.txt`; Modify `tools/studio-build/package.json`, `tools/studio-build/package-lock.json`, `tools/studio-build/build.mjs`; Test `tools/test/studio/p5-browser.mjs`。

**Interfaces:** `createP5Layer({timeoutMs=5000}):Layer`、`P5_PRESETS` は `seeded-lights-v1` のみ。presetは `{id,version,portraitDirect:true,render(p,{timeUs,seed,width,height,anchor,settings})}`。sandbox iframe＋MessageChannelのrequest ID／epoch、noLoop＋await redraw、ImageDataまたはbitmap転送。wall clock／frameCountを演出進行へ使わない。

- [ ] **赤テスト。**
```js
assert.equal(hashAt7After12,hashAt7Initially);
assert.equal(hashAt7InShortStarting6,hashAt7Initially);
assert.equal(transparentCornerAlpha,0);
assert.equal(tallResult.width,1080);
assert.equal(hungPresetResult.code,'EFFECT_TIMEOUT');
assert.equal(await activeFramesAfterDispose(),0);
```
各hashは同版同サイズ同実行環境。別seedで差、anchor正規化、版切替の旧応答破棄、例外・強制終了・再試行、許可されないnetwork要求が実行されないことも検証。前フレーム蓄積演出をこの合格で対応済みとはしない。
- [ ] **赤確認。** `node tools/test/studio/p5-browser.mjs` →FAIL。
- [ ] **実装。** 承認済み固定依存だけbundleしlicense同梱。親が同梱bundleを読み、nonceつきinline scriptを埋めたsrcdoc iframeを作る。sandboxはallow-scriptsだけでallow-same-originなし、CSPはconnect-src noneとnonce許可、実行コードへ親DOMを渡さない。専用読み込み経路をtestで確認。seedと時刻から光の位置を直接求める。応答が止まればiframe破棄、原因配置を通知。任意コード入力欄や自動移植器は作らない。
- [ ] **緑確認。** 同コマンド→PASS。sandboxが既存build/pathで動くことも確認。
- [ ] **コミット。** `git add app/studio/p5-runtime.js app/studio/p5-frame.html app/studio/p5-presets.js app/vendor/studio-p5.js app/vendor/studio-p5-LICENSE.txt tools/studio-build/package.json tools/studio-build/package-lock.json tools/studio-build/build.mjs tools/test/studio/p5-browser.mjs`、`git commit -m "feat(studio): add deterministic sandboxed p5 preset"`。

## 5. 段階C — UIに先行する混合MVの合格

### T16: 共通の合成器とプレビュー時計

**Files:** Create `app/studio/compositor.js`, `app/studio/transport.js`; Test `tools/test/studio/compositor-browser.mjs`, `tools/test/studio/transport-browser.mjs`。

**Interfaces:** `createCompositor({assets,media,layerFactories}):{prepare(p,signal):Promise<void>,render(FrameRequest):Promise<LayerFrame>,dispose():void,stats():object}`。factoriesはT11/T13/T15。動画frameはT8を直接使用しT10配置適用。`createTransport({compositor,mix,clock,onFrame,onState}):{setProject(p):Promise<void>,seek(us):Promise<void>,play({startUs,endUs,short?}):Promise<void>,pause():void,setView(viewId):void,dispose():void}`。clockはAudioContext.currentTimeの注入ポート、再生中は音の時計を正、停止中は明示projectUs。別版小窓は同じprojectUsで低頻度描画、音を生成しない。

- [ ] **赤テスト。**
```js
assert.equal(publishedAfterSlowOldSeek.projectUs,1e6);
assert.equal(publishedAfterViewSwitch.viewId,'tall');
assert.equal(activeAudioSourcesWithCompareWindow,1);
assert.equal(frameAtGap.background,p.bg);
assert.deepEqual(seekFrameAt13,continuousFrameAt13);
assert.equal(allClosedAfterDispose,true);
```
Layer stubで完了順逆転を固定、実Layerで歌詞越境・重なりz/opacity・contain/cover/blur・p5とUNFOLD時刻を比較。同時seek→pause→view切替を20回行い古いframeをpublishせずcloseする。音声権限拒否はユーザー再生操作待ちに戻す。
- [ ] **赤確認。** `node tools/test/studio/compositor-browser.mjs`、`node tools/test/studio/transport-browser.mjs` →FAIL。
- [ ] **実装。** epochを操作毎に単調増加、frameを全Layerから受領後だけ合成。scene切替でglobal歌詞をresetしない。プレビュー解像度は横960×540／縦540×960を既定、比較検査時は両経路同サイズ。バッファ不足を隠して時計を進めず再準備状態を表示する。
- [ ] **緑確認。** 上記2コマンド→PASS、T11/T13/T15の再現性検査もPASS。
- [ ] **コミット。** `git add app/studio/compositor.js app/studio/transport.js tools/test/studio/compositor-browser.mjs tools/test/studio/transport-browser.mjs`、`git commit -m "feat(studio): compose preview layers on one audio clock"`。

### T17: 横縦・連続区間の音付き逐次出力

**Files:** Create `app/studio/export.js`; Test `tools/test/studio/export-browser.mjs`。

**Interfaces:** `exportCapabilities({format,width,height,fps,audio}):Promise<{supported,issues}>`、`exportStudio({project,viewId,range,format:'mp4'|'webm',compositor,media,sink,signal,onProgress}):Promise<{frames,audioSamples,durationUs}>`。rangeはT1確定区間＋fade、sinkはT7と同じ。Mediabunny出力とWebCodecsをT8 bundleから使用。MP4 H.264/AACを初期必須の検証形式とし、WebMは実機codec適合時のみ表示。黙って無音や別形式にしない。

- [ ] **赤テスト。**
```js
assert.equal(shortResult.frames,540);
assert.equal(shortResult.audioSamples,18*48000);
assert.equal(firstRenderProjectUs,6e6);
assert.equal(firstEncodedVideoTimestampUs,0);
assert.equal(renderCalls.at(-1).projectUs,23966667);
assert.equal(cancelledSink.closed,false); assert.equal(cancelledSink.aborted,true);
```
6–24秒、1frame、600秒の時刻だけを使うstub出力、非対応AAC、書込例外、途中中止、短区間fade重複を検証。実出力をT8で再decodeしtimestamp／音トラック／横縦寸法を確認。元Projectのdeep equalityを比較し、range外shortは `INVALID_SHORT_RANGE`、使用指定の読めない音声は `UNSUPPORTED_AUDIO` で停止。
- [ ] **赤確認。** `node tools/test/studio/export-browser.mjs` →FAIL。
- [ ] **実装。** compositorへS+k/fps、encoderへk/fpsを渡す。音声mixは作品sample位置を渡し、出力タイムスタンプだけ0へ。render→encode→backpressure→解放を逐次実行、メモリ全保持を既定にしない。File System Accessの明示保存先へstream、不可環境のメモリfallbackには事前の容量上限確認を置く。中止／例外はwriter.abortと全資源解放、成功表示はfinalize後だけ。
- [ ] **緑確認。** 同コマンド→PASS。codec非対応での中止はその異常系のPASSであり、必須MP4実出力が未確認なら機能全体はBLOCKED。
- [ ] **コミット。** `git add app/studio/export.js tools/test/studio/export-browser.mjs`、`git commit -m "feat(studio): export timestamp-preserving audiovisual ranges"`。

### T18: 30秒混合作品でエンジンの受入確認

**Files:** Create `tools/test/studio/mixed-fixture.mjs`; Test `tools/test/studio/mixed-browser.mjs`; Create `docs/studio-validation.md`（実測欄のみ、未測定を成功記載しない）。

**Interfaces:** `makeMixedFixture(page):Promise<{project,assets,markers}>` はT1の時刻配置にT8生成素材・同梱画像/font・T13対応snapshot・T15 presetを接続。`markers` は映像flashと音impulseの設計時刻。製品コードをtestの期待値に合わせるため変更する場合は該当Tへ戻す。

- [ ] **赤テスト。**
```js
assert.deepEqual(outputs.map(x=>[x.width,x.height,x.frames]),[[1920,1080,900],[1080,1920,900],[1080,1920,540]]);
assert.ok(outputs.every(x=>x.hasAudio));
assert.ok(decodedMarkers.every(x=>Math.abs(x.audioUs-x.videoUs)<=1e6/30));
assert.deepEqual(projectAfterShorts,projectBeforeShorts);
assert.deepEqual(reloadedProject,projectBeforeSave);
```
shortは6–24秒に加え9–11／13–15／18–20秒を出力。始点での動画元音声、歌詞、UNFOLD、p5の内部時刻が元再生と一致。12–16歌詞・14秒SFX・+250ms元音声差、mute/解除/Undo、長歌詞警告、BだけUNFOLD再編集、tall変更後wide不変、fade変更後原曲mix不変、cacheなしファイル往復を実施。
- [ ] **赤確認。** `node tools/test/studio/mixed-browser.mjs` →未接続受入箇所がFAIL。すでに全接続が満たされる場合は、testがエラー注入（旧epoch採用／音timestamp reset）を検出することを確認し、偽の製品不具合を作らない。
- [ ] **最小統合。** fixtureとtest hostだけで実エンジンを動かす。設計通りの時刻／寸法／音声を用い、報告に入力形式、対応codec、出力時間、メモリ観測方法、失敗と制約を記入。主UIの見栄えをこの合格条件へ加えない。
- [ ] **緑確認。** 同コマンド→全受入PASS。テスト動画を実際に再生し横縦構図と音を確認、結果ファイルとmarker検査ログをreportに紐付ける。未聴取なら聴感確認は未完と書く。
- [ ] **コミット。** `git add tools/test/studio/mixed-fixture.mjs tools/test/studio/mixed-browser.mjs docs/studio-validation.md`、`git commit -m "test(studio): verify mixed portrait and landscape music videos"`。

## 6. 段階D — 操作画面と工房

### T19: 独立STUDIO画面と状態・保存操作

**Files:** Create `app/studio.html`, `app/studio.css`, `app/studio/controller.js`, `app/studio/view.js`; Modify `app/sequence.html` の05入口表示／STUDIOリンクのみ; Test `tools/test/studio/ui-browser.mjs`。

**Interfaces:** `createController({store,lease,history,transport,exporter}):{dispatch(command):void,subscribe(fn):()=>void,openFile(file):Promise<void>,saveFile({chooseNew}):Promise<void>,importMedia(files,{sourceAudio:'use'|'mute'}):Promise<void>,setView(viewId):void,export(options):Promise<void>,dispose():void}`。`mountStudio(root,controller):{dispose():void}`。controllerはengine状態とUI選択を別所有。STUDIO専用file handleをメモリで所有し、旧linkを参照せず明示選択時だけ書き込む。

- [ ] **赤テスト。**
```js
assert.equal(await page.getByTestId('studio-time').textContent(),'00:00.000');
assert.equal(await page.getByTestId('music-lock').getAttribute('aria-pressed'),'true');
assert.equal(await countAudioSourcesAfterViewToggle(),1);
assert.deepEqual(await legacySentinel(),legacyBefore);
assert.equal(await currentProjectIdAfterBadImport(),currentBefore);
```
05入口から新画面へ遷移しても旧作品変換を実行しない、未保存／保存中／保存済み／失敗／読取専用、音声未選択の動画は配置できない、音声なしの表示、音声未対応で明示mute/差替を選べる、ファイル保存取消・拒否が成功にならない、再読込のロック／両版／short復元も操作で確認。
- [ ] **赤確認。** `node tools/test/studio/ui-browser.mjs` →FAIL。
- [ ] **実装。** 左素材/工房、中央選択版＋小さな比較、右設定、下timelineの構造とキーボードfocusを作る。出力欄は版／区間／完成尺／codec／音声／中止を明示。旧画面への戻りを残す。importはT2/T4 command経由、同時複数音声選択適用を用意。文字を小さくして詰め込まない。
- [ ] **緑確認。** 同コマンド→PASS、入口だけ変更した旧sequenceの手動基本操作も確認。
- [ ] **コミット。** `git add app/studio.html app/studio.css app/studio/controller.js app/studio/view.js app/sequence.html tools/test/studio/ui-browser.mjs`、`git commit -m "feat(studio): add independent editor screen and save states"`。

### T20: タイムライン・歌詞同期・配置再編集の実操作

**Files:** Create `app/studio/timeline.js`, `app/studio/inspector.js`; Modify `app/studio/controller.js`, `app/studio/view.js`, `app/studio/commands.js`, `app/studio.css`; Test `tools/test/studio/edit-ui-browser.mjs`。

**Interfaces:** `mountTimeline(root,controller):{render(state):void,dispose():void}`、`mountInspector(root,controller):{render(state):void,dispose():void}`。追加Command `setShort{short}`、`deleteShort{id}`、`setDuration{durationUs}`。歌詞text/timed/tap入力は既存lyric-document／lyric-timingの純粋処理からT3 replaceLyrics/setLyricTimingへ変換、ロック解除を要求。主曲・歌詞の同期を別の時計で実装しない。

- [ ] **赤テスト。**
```js
assert.equal(await musicStartAfterVisualReorder(),0);
assert.deepEqual(await lyricTimesAfterVisualDelete(),originalLyricTimes);
assert.equal(await sceneCountAfterDeleteInTextInput(),sceneCountBefore);
assert.equal(await undoLabelAfterTallMove(),'縦の配置変更');
assert.equal(await sourceAudioStartAfterLinkedRowDrag(),await videoStartAfterLinkedRowDrag());
assert.equal(await exportDisabledForOutOfRangeShort(),true);
```
同一目盛りでシーン展開／重なりレイヤー、分割・両端trim・空きへ移動・連続並べ替え、batchロック全拒否、波形と再生位置、SFX追加/フェード、linked行時間操作を映像commandに変換、detach/mute/Undo、tallのみ構図変更、overflow警告、tapの確定時刻、UNFOLD形/画像/演出設定の適用/取消を操作する。drag中はpreviewのみ、pointerupで1Undo。short設定で元Project内容は不変（shorts配列のみ変更）。
- [ ] **赤確認。** `node tools/test/studio/edit-ui-browser.mjs` →FAIL。
- [ ] **実装。** Inspectorは「共通」対「横/縦のみ」を表示し、対応なしの機能は理由つきdisabled。Undo/Redoは履歴ラベルを表示。shortフェード既定OFF、確定S/E/尺を表示。duration縮小でshortを勝手に動かさずエラー。UNFOLD専用編集フォームはT14 draftを編集しglobal seqに触れない。
- [ ] **緑確認。** 同コマンド＋T19＋T18→PASS。
- [ ] **コミット。** `git add app/studio/timeline.js app/studio/inspector.js app/studio/controller.js app/studio/view.js app/studio/commands.js app/studio.css tools/test/studio/edit-ui-browser.mjs`、`git commit -m "feat(studio): connect timeline edits and layout inspectors"`。

### T21: 工房図鑑から設定コピーを配置

**Files:** Create `app/studio/workshop.js`; Modify `app/studio/view.js`, `app/studio/controller.js`, `app/studio.css`; Test `tools/test/studio/workshop-browser.mjs`。

**Interfaces:** `listStudioExamples():Promise<Array<{id,name,thumbnail,kind,settings,capabilities,needsAssets,trust}>>`、`placeExample({exampleId,sceneId,startUs,assetBindings}):Promise<Command>`。既存 `workshop-examples.js`／`workshop-library.js`／`workshop-settings.js` を読取入口として使い、addWorkshopItem・global method登録は呼ばない。STUDIO内から従来workshop.htmlへの通常リンクだけ置き、工房の保存挙動を改変しない。

- [ ] **赤テスト。**
```js
assert.equal(codeExecutionsAfterListing,0);
assert.equal(placedClip.name,example.name);
assert.deepEqual(placedSnapshot.state.settings,example.settings);
assert.notEqual(firstPlacement.unfoldId,secondPlacement.unfoldId);
assert.deepEqual(await workshopStorageAfterPlacement(),workshopStorageBefore);
```
必要素材だけ差替欄、画像/文字カテゴリ、対応/固定横/未対応ラベル、外部コードの確認前実行ゼロ、確認取消で未配置、名/強さ/形/モーション引継ぎ、配置後の独立再編集を検証。
- [ ] **赤確認。** `node tools/test/studio/workshop-browser.mjs` →FAIL。
- [ ] **実装。** 保存済み見本のsnapshotを新IDへ複製、untrusted codeは既存確認規則を保持。図鑑を開くだけのライブ一斉描画禁止。配置のために主曲/歌詞ロックを解除しない。
- [ ] **緑確認。** 同コマンド＋T14＋T20→PASS。
- [ ] **コミット。** `git add app/studio/workshop.js app/studio/view.js app/studio/controller.js app/studio.css tools/test/studio/workshop-browser.mjs`、`git commit -m "feat(studio): place workshop examples as independent copies"`。

## 7. 段階E — 1曲実測・回帰・引き渡し

### T22: 1曲通し・資源回収・旧機能の回帰

**Files:** Create `tools/test/studio/full-song-browser.mjs`, `tools/test/studio/legacy-browser.mjs`, `tools/test/studio/run-browser.mjs`; Modify `docs/studio-validation.md`, `tools/test/workshop-collection-browser.mjs`, `tools/test/workshop-collection-surfaces.mjs`, `tools/test/workshop-collection-text.mjs`, `tools/test/workshop-collection-integration.mjs`（最後の4本は起動環境の指定だけ）。

**Interfaces:** run-browserはT5〜T22の全 `*-browser.mjs` を順次実行して非ゼロを伝播（自分自身を除外）。full-songは `UNFOLD_STUDIO_SONG_FIXTURE` 指定の利用許可済み曲素材、未指定なら180秒の合成音を使用し「実曲未検証」と記録。legacy-browserは既存試験の必要URLを明示して別サーバー起動し、環境不足をskip成功へ変えない。

- [ ] **赤テスト。** 新受入検査と故障注入を先に用意。
```js
assert.equal(fullSongDecodedEndFrame,expectedLastFrame);
assert.ok(Math.abs(lastAudioMarkerUs-lastVisualMarkerUs)<=1e6/30);
assert.equal(activeWorkersAfter20Cycles,initialActiveWorkers);
assert.equal(activeBitmapsAfterDispose,0);
assert.deepEqual(legacyProjectAfterStudioClear,legacyBefore);
assert.deepEqual(studioAssetsAfterLegacyClear,studioBefore);
```
20回seek/読込/演出切替→全disposeでアプリの生存資源カウンタを初期値へ戻す。heap/GPU総量はGCとブラウザで揺れるため定数一致を要求せず、5/10/20回の記録から増え続けないか確認。cache上限はT8をassert。故障注入でdispose漏れ／旧DB誤使用を検出できることを確認する。
- [ ] **赤確認。** `node tools/test/studio/full-song-browser.mjs`、`node tools/test/studio/legacy-browser.mjs` を実施。既に通る場合は対応する故障注入の検出を確認し、人工的な製品破壊はしない。
- [ ] **最小統合と計測。** 横全曲→保存再読込→縦サビショートの実操作を行う。現行旧Node一式と工房browser-collectionの4suiteを正しいURLで実行するrunnerを作る。旧sequenceの画像追加・歌詞入力/同期・主曲・Undo/保存読込・短い音付きexport、工房11作品のカード/試聴/配置、コード隔離・CPU画像転送をlegacyの受入対象として固定する。既存4suiteの固定Playwright import／ChromeパスだけをT5 helperと同じenv指定へ置換し、assertionは変えない。専用runnerは旧suiteへ正しいURLを渡す。元のworktreeパスが新checkoutに存在しないことを成功扱いにせず、結果の捏造やskipをしない。
- [ ] **緑確認。** `node --test --test-reporter=tap tools/test/*.test.mjs tools/test/studio/*.test.mjs`、`node tools/test/studio/run-browser.mjs` →全必須PASS。既存工房suiteを個別実行する場合は次の4本を使う：`node tools/test/workshop-collection-browser.mjs`、`node tools/test/workshop-collection-surfaces.mjs`、`node tools/test/workshop-collection-text.mjs`、`node tools/test/workshop-collection-integration.mjs`（実在名は実装開始時にも照合し、変更されていれば本計画を更新）。サーバーは `python3 -m http.server 8780 --bind 127.0.0.1 --directory app`、`UNFOLD_BASE_URL=http://127.0.0.1:8780/`。測定reportにMac/OS/Chrome、入力codec/尺/個数/解像度、Layer同時数、出力形式、所要時間、最大観測メモリ、cancel/回復結果、残る未対応を記録。速度や扱える上限はこの結果の範囲でのみ説明。
- [ ] **コミット。** `git add tools/test/studio/full-song-browser.mjs tools/test/studio/legacy-browser.mjs tools/test/studio/run-browser.mjs docs/studio-validation.md tools/test/workshop-collection-browser.mjs tools/test/workshop-collection-surfaces.mjs tools/test/workshop-collection-text.mjs tools/test/workshop-collection-integration.mjs`、`git commit -m "test(studio): record full-song limits and legacy regressions"`。独立した全差分レビューを受け、指摘修正と関連testまで終えてからユーザーへ報告。push・公開はこの計画に含めない。

## 8. 自己レビュー・受入対応表

単一計画とした理由は、横縦・元音声・独立保存を1つのMVで検証しないと初期実用版の合否を判断できないため。段階A/Bは単独テスト可能で、Cに先行して完成をレビューできる。別計画に分けて共通時間・所有権を重複定義しない。

| 設計の要件 | 実装／検証担当 |
| --- | --- |
| 独立画面、旧05存続、旧作品非破壊 | T5–T7、T19、T22 |
| シーンとレイヤー、非連動の主曲・歌詞、分割/trim/並べ替え | T1–T4、T20 |
| 横縦共通時間・独立構図、contain/blur/cover・一般余白 | T10–T13、T16、T20 |
| 連続区間ショート、途中状態・出力だけ0始まり | T1、T9、T15–T18 |
| 位置ロック、同じIDの歌詞修正、Undo/Redo・Delete対象 | T3、T4、T20 |
| 主曲/SFX/動画音声、PTS差、分割fade、detach、peak表示 | T4、T8、T9、T19、T20 |
| 歌詞入力・同期・強調/改行、シーン越境 | T3、T10、T11、T18、T20 |
| 配置ごとのUNFOLD再編集・適用/取消、枠尺維持 | T12–T14、T20、T21 |
| p5のseed/手動時刻/隔離/停止・限定対応 | T15、T16、T18 |
| DB/専用形式/素材コピー・Undo参照・quota・複数タブ | T5–T7、T19、T22 |
| 混合30秒・全曲・横縦・shortの音付き出力 | T17、T18、T22 |
| 工房図鑑・安全確認・見本設定引継ぎ | T21、T22 |
| F1 時間端数と最終sample/frame | T1、T9、T17 |
| F2 古いシーク/フォント/演出応答 | T8、T11、T15、T16 |
| F3 遅延保存・quota・タブとUndo参照 | T5、T6、T7 |
| F4 長歌詞/複合文字/縦固定構図 | T10、T11、T13 |
| F5 音声PTS差/分割fade/解除時の二重音 | T4、T8、T9、T18 |

自己レビューでは、変更先の実在パス、API名の受渡し、テスト境界、設計要件の担当を照合する。テスト例は実装コードを複写せず入力と観測結果を示している。チェック欄の実行はすべて未着手。現時点で製品の動作・速度・新依存の実機適合を確認したとの主張はない。

## 9. 実装開始前のレビューと停止点

計画の重大な未検証点は、Macの実codec経路、既存UNFOLD描画のglobal依存を限定抽出できる範囲、長尺のメモリ／書込挙動。T8/T13/T17/T22のゲートで具体的に検証し、失敗時に音声や縦版を初期範囲から黙って落とさない。既存の全特殊メソッド・任意p5・全入力形式への対応は保証しない。

ユーザーへの次の確認は**本計画の内容と実行方式**。方式は次の2つから選ぶ。

- **タスクごとに実装担当と独立レビュー担当を分ける（推奨）**：時間・保存・音声の境界ごとに合格させて次へ進む。最後に全体レビューも行う。
- **同じ担当で順に実装し、最後に独立レビューする**：文脈の引継ぎを減らせるが、タスク途中の独立確認は最後までない。

本計画に沿う実装・依存採用・上記方式への承認を受けるまで、担当起動、package追加、製品コード変更はしない。選択後は承認済み内容を繰り返し質問しない。公開・push・デプロイはどちらの方式にも含まない。
