# かんたん歌詞MV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 曲・埋め込み歌詞・構成見出しを読み取り、おまかせの2Dテキストモーションを既存UNFOLD映像へ重ね、曲付き動画まで簡単に作れるようにする。

**Architecture:** 背景の3D描画は維持し、歌詞を独立したドキュメントと前面オーバーレイとして扱う。文章解析・タイミング・動きの計算は純粋関数、UIとThree.js合成は別モジュール。seq-canvasに合成してから既存のVideoFrame出力を使う。

**Tech Stack:** 現行の静的HTML/CSS/ES modules、同梱Three.js、Canvas 2D、Web Audio、WebCodecs、IndexedDB、Node標準test。新しいランタイム依存・サーバー・外部APIは追加しない。

**Spec:** `docs/superpowers/specs/2026-10-04-lyric-motion-design.md`（2026-10-04ユーザー了承済み）

## Global Constraints

- 「今回の入口はシーケンスの歌詞MVタブ。」
- 「1枚モードへ音楽・歌詞編集画面を追加することは今回の対象外。」
- 「曲と歌詞を入れ、文字の動く見本をすぐ確認できる。」
- 「歌詞を3D形状にする方式は新しい制作画面から廃止」
- 「原文と見出しの順序は必ず保存する。」
- 「見出しから正確な秒数・歌唱位置を推測したとは扱わない。」
- 「歌詞のタイミング変更は背景のカットを動かさない。」
- 「音楽・歌詞・画像を外部サービスへ送信しない。」
- 「元の音楽ファイルは書き換えない。」
- 「外部公開は今回含めない。」
- 作業物・バックアップ・成果物は `/Volumes/ORICO/UNFOLD/` にまとめる。Gitリポジトリではないため、Git初期化・コミットはせずタスクごとに検証記録を残す。
- 最新ユーザー確認：今回の歌詞は前面。立体の後ろに配置する／立体に遮蔽させる機能は追加しない。背景を一枚の不透明動画にした後での単なるレイヤー入替では、立体の輪郭だけを使った遮蔽はできない。

## Review Focus

1. 同じ歌詞が複数回登場しても、修正時に別のサビの時刻・固定設定を流用しない（Task 1）。
2. 曲A抽出中に曲Bを選択、またはプロジェクト復元した場合、Aの歌詞で上書きしない（Task 2/6）。
3. 1曲全体がタグのない1行、絵文字・結合文字・長文の場合も、フリーズや文字切れを起こさない（Task 1/4）。
4. 曲の開始offset、背景なし、曲末に届かない背景でも、音声と文字と動画尺が一致する（Task 3/5）。
5. 素材の不足した旧プロジェクト、保存中の再読み込み、未同期の途中終了でも、旧データを失わない（Task 6/7）。

---

## File structure / 接続する現行箇所

Create:

| ファイル | 責務 |
|---|---|
| `app/lyric-document.js` | 原文・見出し・行ID・強調の解析と正規化 |
| `app/audio-lyrics.js` | 埋め込み歌詞抽出の入口と候補統一 |
| `app/audio-lyrics-id3.js` | ID3のバイト解析とMPEG時刻変換 |
| `app/audio-lyrics-mp4.js` | MP4 box走査と©lyr抽出 |
| `app/lyric-timing.js` | 歌詞の時刻解決、タップ同期状態、曲尺 |
| `app/lyric-motion.js` | おまかせ演出と時刻依存の描画指示 |
| `app/lyric-overlay.js` | 文字レイアウト・透過Canvas・Three.js合成 |
| `app/lyric-controls.js` / `app/lyric-controls.css` | 段階的な操作画面 |
| `app/lyric-project.js` | 保存データ正規化と旧歌詞MV変換 |
| `tools/test/lyric-*.test.mjs`, `audio-lyrics.test.mjs` | 下記タスクの単体検証 |
| `tools/test/lyric-motion-browser.html` | 独立したサンプル・人工音声によるブラウザ検証 |

Modify:

- `app/sequence.html`: pane-lyric、旧タップoverlay、CSS/JSキャッシュ版。
- `app/sequence.js`: seq、loadAudio、totalSeconds、renderAt、exportVideo、snapshot/restore、stateForSave/restoreProject、旧lyric UI bindings。
- `app/project.js`: JSONに新ドキュメントを保存しversion 3を維持する。
- `app/timeline.js`: 歌詞・構成区間の表示と独立した操作。
- `README.md`: 操作と検証記録へのリンク。

既存 `lyric-mv.js` は旧作品の互換描画とtempo/font関数のため残す。旧buildLyricMVを新規制作から呼ばない。新機能のロジックをsequence.js内へ大きな塊で追加しない。

## Shared contracts

全純粋関数は入力を変更せず、新しいオブジェクトを返す。未確定秒はNaNでなくnullを保存する。

- `Section = 'intro'|'verse'|'prechorus'|'chorus'|'bridge'|'instrumental'|'outro'|'unknown'`。
- `Event = {id, kind:'line'|'section', raw, text, runs:[{text,emphasis}], section, decision:'pending'|'lyric'|'instruction', s:number|null, e:number|null, timingSource:'none'|'provisional'|'embedded'|'file'|'tap'|'manual', words?:[{text,s}], locked:boolean, motion:MotionChoice|null}`。
- `MotionChoice = {preset:'float'|'slide'|'reveal'|'pop'|'emphasis', direction:'left'|'right'|'up'|'down', color:string, emphasisColor:string, size:number, position:'center'|'bottom', font:string, speed:number}`。sizeは1080p基準のpx（初期64、32〜160）、speedは0.5〜2（初期1）。
- `LyricDocument = {version:1, enabled:boolean, sourceText:string, events:Event[], style:'readable'|'pop'|'soft', seed:number, maxHold:number, durationMode:'song'|'sequence', issues:[{code,eventId?,message}]}`。初期maxHold=6秒、durationMode='song'。
- `TimedEvent = Event & {start:number,end:number,provisional:boolean}`。曲の先頭からの秒数。
- `Candidate = {id,format:'id3'|'mp4',language:string,description:string,text:string,lines:[{s:number,e?:number,t:string,words?:[{text,s}]}],synced:boolean,warnings:string[]}`。
- `Extraction = {candidates:Candidate[],warnings:string[]}`。
- `getTimings(document,duration): {events:TimedEvent[],issues:Issue[]}`。Issueは上記issues要素。
- `renderAt(videoSec)` は歌詞を `videoSec + seq.offset` で評価。描画計算にDate.now、可変フレーム積算、Math.randomを使わない。

### Task 1: 原文と見出しを失わない歌詞ドキュメント

**Files:** Create `app/lyric-document.js`; Test `tools/test/lyric-document.test.mjs`。

**Interfaces:**
- Produces `parseLyrics(sourceText:string, previous:LyricDocument|null=null):LyricDocument`。
- Produces `importTimedLyrics(lines:Candidate['lines'], source:'embedded'|'file'):LyricDocument`。
- Produces `resolveUnknown(document,id,decision:'lyric'|'instruction'):LyricDocument`。
- Produces `cleanLyricDocument(value:unknown):LyricDocument|null`。

- [ ] Step 1: 失敗するテストを追加。`parseLyrics('【サビ】\n*空*へ/飛ぶ').events` はsection=chorusの見出しと歌詞1行、歌詞のtextは`空へ\n飛ぶ`、空のrunだけemphasis=true。sourceTextは完全一致。[Verse 2]、全角括弧、日本語別名も検証。`君の【声】`は通常行、`[Whispered]`はpending。instrumental直後の文章にissueがあることを検証。
- [ ] Step 2: `node --test tools/test/lyric-document.test.mjs` → 新API未定義でFAILを確認。
- [ ] Step 3: 上記APIを実装。空行は原文に保持するが表示行にしない。前後関係を含む行順照合で既存IDを引き継ぎ、重複本文だけのMapで時刻を結び付けない。強調記号の不完全な組は文字として残す。見出しはspecの別名表だけを認識する。
- [ ] Step 4: 回帰例を追加。`[Chorus]\n同じ歌詞\n[Verse]\n別の歌詞\n[Chorus]\n同じ歌詞` の後半だけを変更し、前半の時刻・ID・lockedを保持する。文頭追記も照合する。絵文字・結合文字のrawが失われないことをassert。
- [ ] Step 5: 同コマンド → 全PASS。結果をタスク記録へ保存する。

### Task 2: 音楽ファイルの埋め込み歌詞抽出

**Files:** Create `app/audio-lyrics.js`, `audio-lyrics-id3.js`, `audio-lyrics-mp4.js`; Test `tools/test/audio-lyrics.test.mjs`; fixture生成 `tools/test/fixtures/audio-tags.mjs`。

**Interfaces:**
- Consumes Task 1 `importTimedLyrics`（UI適用時に使用）。
- Produces `extractAudioLyrics(file:Blob,{signal?:AbortSignal}={}):Promise<Extraction>`。
- Produces `readID3(bytes:Uint8Array):Extraction`、`readMP4Lyrics(bytes:Uint8Array):Extraction`。
- Produces `createImportGate():{next():number,isCurrent(token:number):boolean,invalidate():void}`（曲切替・復元用）。

- [ ] Step 1: 人工タグのテストを追加。USLT(UTF-16LE日本語)/v2.4 UTF-8/v2.2 ULT、SYLT milliseconds 0/1250ms、SLT、©lyr通常文／LRCから文章と秒数をassert。LRCは`[00:01.25]声`→s=1.25。複数言語候補を両方保持する。
- [ ] Step 2: `node --test tools/test/audio-lyrics.test.mjs` → FAILを確認。
- [ ] Step 3: APIを実装。ID3フレームサイズ、syncsafe、unsynchronisation、拡張ヘッダ、UTF-16終端を扱う。最大メタデータ8MiB、1候補100,000文字、最大2,000表示イベント、MP4ネスト深さ16とし、超過はwarningで打ち切る。MP4の64bit長・size=0・mdatスキップを扱い、メディア全体をタグ用にメモリへ読むことを避ける。MP3フレーム単位SYLTは有効フレームのサンプル数／サンプルレートを積算し、変換不能時はsynced=false。
- [ ] Step 4: 破損長、巨大APIC、ゼロ長box、圧縮フレーム、未対応FLAC、Abort、A→B token競合を追加。解析不能でrejectして音楽を壊すのでなく、warningsを返す（Abortだけは中断）。サイズ超過の文字を黙って同期済みにしない。
- [ ] Step 5: 同テスト → 全PASS。サンプル音楽や実ユーザー歌詞をfixtureに混ぜない。検証記録を保存する。

### Task 3: 曲時刻・間奏・仮配置・タップ同期

**Files:** Create `app/lyric-timing.js`; Test `tools/test/lyric-timing-motion.test.mjs`。

**Interfaces:**
- Consumes LyricDocument。
- Produces `getTimings(document,duration:number):{events:TimedEvent[],issues:Issue[]}`。
- Produces `activeLyric(document,songSec:number,duration:number):TimedEvent|null`。
- Produces `movieDuration({document,audioDuration,offset,backgroundDuration}):number`。
- Produces `createTapSession(document,duration):{current():Event|null,tap(songSec):void,back():number,stop():LyricDocument,resume():void}`。
- Produces `moveLyric(document,id,deltaSeconds):LyricDocument`。

- [ ] Step 1: 境界テストを追加。歌詞s=1、間奏s=3、次歌詞s=8ならactiveLyric(2)は歌詞、3〜8未満はnull。e=2があれば2で消える。終了未指定の歌詞は最大6秒。曲未入力の仮配置は12秒、全仮行はprovisional=true。
- [ ] Step 2: `node --test tools/test/lyric-timing-motion.test.mjs` → FAILを確認。
- [ ] Step 3: 各APIを実装。既知時刻を固定し、未定イベントは前後の既知境界の間に仮配置。全未定なら均等配置。構成見出しが連続するときは区間開始イベントをまとめ、実歌詞のあるintro/outroは歌詞を消さない。同期セッションは歌詞と必要な無表示区間開始を列挙し、途中終了でも記録済み秒を保持する。
- [ ] Step 4: offset=2、audioDuration=30、backgroundDuration=10、songモードならmovieDuration=28をassert。offset=-2なら32（冒頭2秒は無音）。不正な負値・逆順・同時刻行はissuesを返す。単語同時刻はまとまる。tap→stop→resume→back、0.1秒修正も検証。
- [ ] Step 5: 同テスト → 全PASS。曲全体の長さを文字列末尾だけから推測しない。検証記録を保存する。

### Task 4: 読みやすい文字レイアウトと再現可能なモーション

**Files:** Create `app/lyric-motion.js`, `app/lyric-overlay.js`; Test `tools/test/lyric-motion.test.mjs`; browser harnessの初期版 `tools/test/lyric-motion-browser.html`。

**Interfaces:**
- Consumes TimedEvent、MotionChoice。
- Produces `assignLyricMotions(document,{style,seed}):LyricDocument`（locked行は同一設定）。
- Produces `motionAt(event,songSec,bpm):{opacity:number,x:number,y:number,scale:number,reveal:number,emphasis:number}`（x,yは文字サイズ基準）。
- Produces `layoutText(runs,{width,height,font,size,measure}):{lines:[{runs,width}],size:number,bounds:{x,y,width,height}}`。
- Produces `createLyricOverlay(renderer):{prepare(document):Promise<void>,render(document,songSec,{duration,bpm,width,height}):void,dispose():void}`。

- [ ] Step 1: 純粋テストを追加。同seed・同秒のmotionAtが厳密一致、開始前／終了後opacity=0、途中で0..1内、全5presetで差があること。chorusはverseより大きめ、同じサビstyleを共有、lockedは再抽選で不変。layoutTextで200文字日本語・結合文字・絵文字の全字が安全域に収まることをassert。
- [ ] Step 2: `node --test tools/test/lyric-motion.test.mjs` → FAILを確認。
- [ ] Step 3: 計算APIを実装。Intl.Segmenterがなければ結合記号・サロゲートを保つfallbackを用意。端から5%の安全域、中央／下部配置、size32〜160、speed0.5〜2。文字の入退場は行の表示区間を超えず短い行では時間を縮める。おまかせはreadable/pop/softの3スタイルと5presetに限定する。
- [ ] Step 4: overlay実装。透過CanvasTextureを専用正射影quadへ載せ、既存sceneBlur後にalpha合成。フォントは既存FONTS/ensureFontを使用しprepareで待つ。rendererのautoClear・target・viewport・scissorを復元する。背景カメラ・照明・ポスト処理を文字へ適用しない。無表示時は何も描かず文字残像を残さない。
- [ ] Step 5: 純粋テストPASS後、harnessで同一秒の前後シーク一致、文字なしで背景pixel一致、720/1080/縦長の安全域、フォントロード後の配置を確認する。結果を保存する。

### Task 5: 背景を維持したプレビューと音声付き書き出し

**Files:** Modify `app/sequence.js`のseq/renderAt/totalSeconds/exportVideo/再生制御、`app/timeline.js`の曲尺。Extend browser harness。

**Interfaces:**
- Consumes Task 3/4 APIs。
- Adds `seq.lyricDocument:LyricDocument|null`。
- Produces `setLyricDocument(document:LyricDocument|null):void`（内部状態反映、UI更新、保存予約）。
- Keeps existing `renderAt(sec)`, `exportVideo(options)`, `totalSeconds()` exports。
- Extracts private `backgroundSeconds():number`（従来のtotalSecondsの式）。

- [ ] Step 1: harnessで新文字documentを設定し、背景0枚／1枚／複数枚に歌詞が出るテストを追加。サンプルの背景とtr.shot設定がsetLyricDocument前後で不変、歌詞OFFで背景pixel一致をassert。実装前FAILを保存。
- [ ] Step 2: seq.lyricDocumentと合成を接続。renderAtの空背景早期returnでもoverlayを描く。背景が短い場合locateは最終画像を保持し、背景時刻のcamera算出を既存終点へclampする。totalSecondsはmovieDurationを使い、歌詞なしの従来作品は従来尺を返す。
- [ ] Step 3: exportVideoはoverlay.prepareを待ち、最終seq-canvasを既存エンコーダへ渡す。resizeや高画質2倍にも対応。書き出し中は歌詞・曲の変更を禁止し、例外時もrendererサイズと編集状態を復元する。
- [ ] Step 4: offset=-2等の音声先頭欠落を補正。encodeAudioは映像時間に対応するPCMを作り、曲の範囲外は無音を埋める。音声の冒頭2秒を詰めない。AAC不可は音なし成功ではなく選べるWebM代替を提示する。
- [ ] Step 5: 人工音声（既知時刻のクリック）と短い歌詞で720p MP4を出力し、音声トラック・正負offset・代表フレームを確認。背景だけの既存書き出しも検証して記録する。

### Task 6: 「歌詞・曲」のかんたん操作と独立タイムライン

**Files:** Create `app/lyric-controls.js`, `app/lyric-controls.css`; Modify `sequence.html`, `sequence.js` loadAudio/旧lyr-handlers/keyboard/timelineApi、`timeline.js`。

**Interfaces:**
- Consumes Task 1〜5 APIs。
- Produces `createLyricControls({getState,onAction}):{element,refresh():void,dispose():void}`。
- `getState()`→`{document,audioName,audioDuration,playing,recording,songSec,extraction,status}`。
- `onAction(action)` uses `{type:'audio',file}`, `{type:'text',value}`, `{type:'import',file}`, `{type:'candidate',id}`, `{type:'shuffle',style}`, `{type:'edit',id,patch}`, `{type:'resolve',id,decision}`, `{type:'tap-start'|'tap-now'|'tap-back'|'tap-stop'|'tap-resume'|'play'|'pause'|'export'}`。
- Extends timeline `api.state()` with `lyricMode:'legacy'|'overlay'`、lyrics表示項目のid/section/isBoundary; drag callbacks resolve ID, not stale index。

- [ ] Step 1: harnessのUIテストを追加。曲なしで歌詞を貼りおまかせ→12秒の仮見本、曲を入れる→曲尺へ変更、歌詞が空なら候補反映、入力済みなら候補ボタンだけ、抽出中に手入力しても上書きしない。実装前FAIL。
- [ ] Step 2: pane-lyricを4段階UIへ置換。旧lyr-* bindingsを移し、旧MV生成ボタンを取り除く。基本画面にBPM/拍を出さない。テンポ検出は背景のbpmを書き換えず、歌詞モーション用値として保存する（下記保存設定に含める）。曲・歌詞・プレビューは一画面で操作可能にする。
- [ ] Step 3: onActionを履歴トランザクション経由で実装。入力debounce、tap継続・戻り・終了、unknownの解決、固定・再抽選・0.1秒移動、書体/色/位置/速度の詳細を実装。Spaceはtap操作中だけtap、それ以外は従来再生に使う。テキスト入力中のSpace/Backspaceを奪わない。
- [ ] Step 4: loadAudioにgateを接続。曲選択ごとにnext、プロジェクト復元・新規でinvalidate。選択開始から反映時までの歌詞編集revisionも確認し、入力開始後には自動反映しない。自動復元中は抽出結果を適用しない。ObjectURLを不要時に破棄する。
- [ ] Step 5: 新歌詞タイムラインはoffset換算とsection表示に対応し、歌詞→背景linkを無効化。1行の移動や間奏開始位置変更で背景のclips/transitions/shotを変えない。未同期／未分類の行を出力前にまとめて示し、仮タイミングでの出力は明示操作で可能にする。
- [ ] Step 6: 実ブラウザでA→B読込競合、編集済み候補取込みUndo、タップ途中停止と再開、固定行維持、長文、日本語IME、保存ボタン遷移を確認し記録する。

### Task 7: 保存互換・履歴・旧3D歌詞MVの変換

**Files:** Create `app/lyric-project.js`; Modify `app/project.js`とsequence snapshot/restore/stateForSave/restoreProject/exportProject; Test `tools/test/lyric-project.test.mjs`。

**Interfaces:**
- Consumes cleanLyricDocument、importTimedLyrics。
- Produces `cleanLyricSettings(value):{bpm:number,phase:number}`（背景bpmとは独立。初期は読込時のseq.bpm/phaseを渡す）。
- Produces `convertLegacyLyrics({slides,transitions,lyrics,lyricOpts}):{slides,transitions,document}`（入力は変更しない）。
- stateForSave adds `lyricDocument`, `settings.lyricMotion:{bpm,phase}`。history snapshotもdocument/lyricMotion/audioOwner/audioName/audioBufferを保持し、履歴復元用に元Blob参照を保持する。Blobはbase64へ変換しない。

- [ ] Step 1: メモリ上のexportFile/importFileテストを追加。version3でdocumentのsourceText/IDs/timingSource/motion/lockedと新shot、custom methodsが往復。version1/2にdocumentがなくても旧作品が開く。raw歌詞に`<img onerror=...>`があってもUIはtextContentで文字扱い、というbrowser assertionも追加。実装前FAIL。
- [ ] Step 2: project.jsでstate.lyricDocumentを正規化して保存し、存在すればversion3。既存のcustom methods設定がversionを2に戻さないよう最大必要versionを採用する。import時の未知versionは未対応と表示し、読めたふりで再保存しない。
- [ ] Step 3: snapshot/restoreとnewProjectに新状態を含める。音声restoreは抽出を走らせず、Blobでaudio要素を作り直し同期を回復する。歌詞編集、音楽置換、motion再抽選をUndo/Redoできる。autosaveと.unfoldで同じ状態を保存する。
- [ ] Step 4: 旧作品はlegacy描画で維持し、旧歌詞編集操作の代わりに「テキストモーション版を作る」を表示。押したときだけconvertLegacyLyricsを使い、旧lyric.img→通常img、なければ背景色、歌詞由来text形状だけshape='none'へ変更する。一般のユーザー作成3D文字は変換対象にしない。歌詞lineIdで由来を判断する。
- [ ] Step 5: 変換前に元プロジェクトへリンクした保存先を解除し、新版を別名保存にする。旧ファイルは変更しない。素材欠落・同文繰り返し・Undo→Redo・再読み込み復元を検証する。
- [ ] Step 6: `node --test tools/test/lyric-project.test.mjs` → PASS、実ブラウザのIndexedDB復元／旧形式読込も確認し記録する。

### Task 8: 全体検証・独立レビュー・成果物

**Files:** Complete `tools/test/lyric-motion-browser.html`; Add `docs/verification-lyric-motion-2026-10-04/REPORT.md`と画像・動画・ログ; Modify README。

**Interfaces:** 既存API、Task 1〜7のUI／保存を通した利用者操作。

- [ ] Step 1: 変更開始前に作った `archive/app-before-lyric-motion-<日時>/` を比較基準として使う。まだなければ実装開始前に取得すること（このステップまで待たない）。ユーザーが開いている作業タブは再読み込みしない。検証用originでサンプルを使う。
- [ ] Step 2: `node --test tools/test/*.test.mjs` を実行し全PASS。既存242件から減らさない。browser harnessで全PASSを保存する。
- [ ] Step 3: Chromeで「曲ドロップ→埋め込み歌詞反映→サビ認識→おまかせ→一行修正→間奏→同期途中再開→保存復元→MP4」の一連を実操作で検証。機能ごとに同じチェックを不要に反復しない。
- [ ] Step 4: 720p/1080p、音あり、正負offset、縦長のプレビュー、長文、背景0/1/複数、文字OFF旧版pixel比較を実施。ffprobeで音声と長さ、抽出フレームで代表歌詞と背景の重なりを確認。Safari・モバイル未検証ならその範囲を明記する。
- [ ] Step 5: 一人の新しいレビュー担当にspec・plan・変更範囲・テスト結果を渡して独立レビュー。重要な指摘を修正し、関係するチェックを再実行。実行方式でタスクごとのレビューを採る場合も最後の全体レビューは行う。
- [ ] Step 6: キャッシュ版を更新し、localhost:8771で最新画面を確認。READMEに操作方法・互換・対応歌詞形式・検証記録リンクを書く。公開用ZIPや外部サイトは更新しない。
- [ ] Step 7: ORICO内に画面写真・サンプルMP4・検証記録を保存。新しい画面を開いたタブを残し、実施した内容と未対応範囲を利用者へ報告する。

## 主要な回帰テストの固定例

以下のassertは各タスクのテストへ含める。追加の境界例は各タスクの手順に従う。

```js
// Task 1: 見出しは本文にせず、原文を保持
const source = '【サビ】\n*空*へ/飛ぶ';
const parsed = parseLyrics(source);
assert.equal(parsed.sourceText, source);
assert.equal(parsed.events[0].kind, 'section');
assert.equal(parsed.events[0].section, 'chorus');
assert.equal(parsed.events[1].text, '空へ\n飛ぶ');
assert.equal(parsed.events[1].runs[0].emphasis, true);

// Task 2: 曲を切り替えたら旧結果を採用しない
const gate = createImportGate();
const a = gate.next(), b = gate.next();
assert.equal(gate.isCurrent(a), false);
assert.equal(gate.isCurrent(b), true);
gate.invalidate();
assert.equal(gate.isCurrent(b), false);

// Task 3: 曲の開始を前へ2秒ずらした映像尺
assert.equal(movieDuration({
  document: {...parsed, durationMode: 'song'},
  audioDuration: 30, offset: -2, backgroundDuration: 10,
}), 32);

// Task 4: 固定した行を再抽選で変えない
const first = assignLyricMotions(parsed, {style: 'pop', seed: 7});
first.events[1].locked = true;
const second = assignLyricMotions(first, {style: 'soft', seed: 19});
assert.deepEqual(second.events[1].motion, first.events[1].motion);

// Task 7: 同期や固定を含むドキュメントの保存往復
const original = {...baseProjectFixture, lyricDocument: first};
const {json} = await importFile(await exportFile(original));
assert.equal(json.version, 3);
assert.deepEqual(json.lyricDocument, cleanLyricDocument(first));
```

Task 7の`baseProjectFixture`はassetsなし・slides=[]・transitions=[]・lyrics=[]・audio=null・settings={}から作成する。別のcaseで人工画像Blobと音声Blobを登録しassetsの往復も確認する。UIでは`data-lyric-role="text"`／`"shuffle"`／`"tap"`／`"status"`を安定した検証フックとして付け、実利用者の入力と同じイベントから操作する。

## 作業開始前のバックアップと実行方法

設計確認後の計画レビューが完了したら、まずapp/と変更対象tools/test/を日時付きでarchive/にコピーする。ORICO書き込みは実行環境に応じて範囲を限定した承認付きコマンドを使用する。依存インストール・公開・ユーザー曲の外部送信は不要。

推奨はNative（このセッションで順に実装し、最後に独立レビュー）。解析→時刻→描画→UI→保存の接続が多く、同じ担当が一貫して調整すると重複作業が少ない。ユーザーが希望すれば、同じ計画をタスク単位の担当分担＋都度レビューで実施できる。

## Plan self-review

- Spec coverage: 見出しTask1、抽出Task2、時刻Task3、文字Task4、出力Task5、かんたん画面Task6、互換Task7、全体検証Task8。
- Spec補足: テンポの自動検出で背景の拍・カット尺を変えないため、歌詞専用bpm/phaseを保存する。これは背景を維持する要件の実装上の分離。
- Types: Event.s/eはnull可、TimedEvent.start/endは有限秒、曲基準を統一。IDで編集し、インデックスのずれを避ける。
- Review Focus: 5項目とも上記タスクに回帰テストを割り当て済み。
- Depth: 今回は前面2D。将来の3D遮蔽は別機能として扱う。rendererやshaderに未使用の背面モードを追加しない。
