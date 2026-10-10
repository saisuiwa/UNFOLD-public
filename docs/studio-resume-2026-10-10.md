> Historical pause record. Work resumed and supersedes this checkpoint; see studio-implementation-log.md and studio-validation.md for final status.

# STUDIO implementation checkpoint — parent-requested pause

The parent explicitly requested a progress-only turn ending, without cancelling implementation authorization. This is not a completion report.

## Location and ownership

- Worktree: `~/Documents/Codex/2026-10-10/task-2/unfold-studio`
- Branch: `codex/studio-completion`
- Committed HEAD: `fd998394bf61373c5be2830c138202bf2b29b9ea`
- Original `/Volumes/ORICO/UNFOLD` main and earlier worktree `~/Documents/Codex/2026-10-10/task/unfold-studio` are preserved.
- T1–T8 inherited from prior implementation through `59abbdd`; current branch adds T9–T19.
- Uncommitted T20/T21 and T22 test work remains intentionally in this dedicated worktree. Do not discard or recreate it.
- No push, merge, publication, paid API, or user media transfer.

## Evidence already obtained

- T9–T17 individual Node and real Chrome browser tests passed; details and RED/GREEN evidence in `.superpowers/sdd/2026-10-10-studio-implementation/progress.md` and earlier commits.
- T18: real 30-second Full-HD H.264/AAC output in wide and tall. Four portrait cut ranges (6–24,9–11,13–15,18–20) fully decoded; exact frame counts, audio end and file/asset hash roundtrip checked. `tools/out/studio/mixed-report.json` and six MP4 files.
- `marker-browser.mjs`: 28-second visual flash vs SFX at 28.0001041667 seconds, approximately 0.104 ms difference.
- T19: independent page, initial locks, text insertion, browser save/reload and tall-only scope passed `ui-browser.mjs`.
- T20 work: `edit-ui-browser.mjs` passed tall-only X without changing wide, text-input Delete safety, short range and explicit lyric timing unlock. Last log `/tmp/studio-t20-final.log`.
- T21 work: `workshop-browser.mjs` passed 11 examples, inherited names/settings, unique placement IDs, no global registry or localStorage mutation. Log `/tmp/studio-t21-green.log`.
- New overlapping fade unit test failed at expected .25 vs actual1, then passed with multiplicative duration-based fades. `/tmp/studio-fade-{red,green}.log`.
- Existing four workshop browser suites all passed, with only launch environment plumbing changed. `tools/out/studio/legacy-run.log`.
- Earlier full Node suite: 401 pass, 0 fail, 3 existing skips/404 total. Current pause suite includes added fade test, see `/tmp/studio-pause-node.log`.
- Browser tests use independent nonpersistent contexts. Actual pixels/audio decode were used for media claims; transport stale-response test also uses an injected compositor and is not represented as full render proof.

## Active tests at pause / first resume step

1. `node tools/test/studio/full-song-browser.mjs`, exec session `58251`; log `tools/out/studio/full-song-run.log`. It builds 180 seconds of original synthetic audio, runs 20 compositor seek/effect-switch cycles, then exports and fully decodes 5400 Full-HD frames, checks a last-second visual/audio marker, saves/reloads and exports an eight-second tall chorus. At checkpoint it had printed its start message; no PASS yet. Do not report complete until exit status and assertions are checked. Expected artifacts `full-song.mp4`, `song-short.mp4`, `full-song-report.json`.
2. `node tools/test/studio/integration-ui-browser.mjs`, exec session `70532`; log `/tmp/studio-integration-ui.log`. Uses real mixed fixture and editor, captures wide/tall screenshots, tests linked drag/Undo, unchanged song/lyrics, invalid file import atomicity, real AudioContext playback with view switches. No PASS yet at checkpoint.
3. Pause Node suite exec session `82560`; `/tmp/studio-pause-node.log`.

Poll these sessions and inspect logs before starting duplicate work. If a session is unavailable, inspect process ownership and artifacts; do not kill unrelated Chrome processes.

## Current uncommitted implementation

- Timeline/inspector DOM, scoped layout controls, shared-time scene/layer/lyric/audio rows, drag/trim/split/delete/duplicate, linked audio routing, fades, source offsets, view-only line breaks, UNFOLD draft apply/cancel, explicit lyric/tap timing.
- Short range editor with persisted start/end/fades and separate portrait export.
- Workshop list and independent snapshot insertion; separate STUDIO code approvals; shared legacy codeFrameInput for text effects.
- New project/browser project picker; legacy UNFOLD placement copies assets/settings, basic sphere/fold placement; waveform and static same-time comparison.
- Fixes for asset import atomic undo, unsupported source audio preflight, transparent video/p5 canvas initialization, owned fonts, legacy GLSL vertex field.
- T22 full-song and legacy runners. `run-browser.mjs` still not created.

## Known follow-up work — do not mark complete yet

- Finish T20/T21 broader integration/negative checks and inspect real screenshots. The last drag fix sets drag mode before selection causes a rerender; current integration test will validate it.
- Inspect workshop import side effect: `studio/workshop.js` imports `workshop-library.js`, whose top-level `const store=openStore()` may create the legacy method DB on entry. Need a lazy/read-only listing path, preserving old tests, without writing legacy data. This was identified but not changed before pause.
- Controller full-project legacy import confirms code but legacy-import quarantines method status; insertion path sets status ok after confirmation, opening path may need the same verified normalization.
- Ensure audio overlapping fade metadata validation, split/trim continuity and displayed values match spec. Existing point-envelope tests remain passing.
- Improve exact UI coverage: failed/cancelled file save, read-only takeover, source-audio explicit selection/mute, per-placement UNFOLD draft preview, one-Undo imports, branch screenshots after final code.
- Check transport playback failure cleanup and exact source counts during view changes; existing stale-seek test alone is insufficient.
- Plan requires final `run-browser.mjs` sequential required tests, final Node+browser runs, durable all-22 progress/rulings and validation report with environment/memory/time.
- Independent review has NOT been started. User expressly authorized one fresh final reviewer only; requesting-code-review skill was read. Spawn one review-only agent with fresh context after implementation stabilizes, base5977480 through final HEAD/diff; fix Critical/Important findings, rerun final tests. No per-task implementer agents.
- `docs/studio-validation.md` is still marked in progress and needs final verified measurements and limitations.
- Library upload/attachment has NOT been attempted. Only generated artifacts may be transferred. Read Library skill before flow. If unavailable, return exact local artifacts and transfer limitation.
- Unsupported standalone UNFOLD text/silhouette geometry is explicit. Built-in/preset solids, GLB, image code are supported; arbitrary p5 not accepted. iPhone, non-Chrome playback, human listening and licensed real-song input remain unverified. Do not hide these limits.

## Commands

Working directory must be this dedicated worktree. Browser commands require `sandbox_permissions: require_escalated` because localhost listen/Chrome are unavailable in sandbox. Git commits also need escalation for common Git metadata on `/Volumes/ORICO/UNFOLD`. These authorized operations have been approved; no extra user confirmation needed.

```
node --test --test-reporter=tap tools/test/*.test.mjs tools/test/studio/*.test.mjs
node tools/test/studio/ui-browser.mjs
node tools/test/studio/edit-ui-browser.mjs
node tools/test/studio/workshop-browser.mjs
node tools/test/studio/integration-ui-browser.mjs
node tools/test/studio/legacy-browser.mjs
```

Approved dependencies bundled: Mediabunny1.61.3, p5.js2.3.3, esbuild0.25.10; licenses in vendor and tools/studio-build.

## Last observation immediately before turn end

- Full-song test now printed PASS: 5400 frames / 8,640,000 audio samples / exact180s end; last marker video179s, audio179.0001041667s. 20-cycle disposal layers0/liveFrames0/iframes0. Heap samples5/10/20:26,648,918 /41,340,091 /41,366,607 bytes. Full-song plus short rendering/decode stage376.0233s. full-song.mp4 80,134,667 bytes; eight-second portrait short240frames. Check process exit/session58251 and report file on resume.
- integration-ui-browser FAILED at waitForFunction after real timeline video drag (expected cVideo.startUs to change; timeout30s). Screenshots had already been produced. This is the first concrete resume bug. Inspect timeline pointer selection/rerender/capture and test fixture initial clip time; do not bypass assertion. Playback assertions later in this test did NOT run.
- Final pause Node suite:402PASS /0FAIL /3preexisting skips /405total.
