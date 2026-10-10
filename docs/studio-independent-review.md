# STUDIO independent final review

Reviewed 2026-10-10. Baseline: `5977480..40490df09fdb9a16c9c15a4f5740213e69beeee7`, branch `codex/studio-completion`. Requirements: approved design revision 2 and 22-task implementation plan. This report describes the reviewed baseline, not the fixes the implementation agent began while receiving findings.

**Verdict: changes required.** No Critical finding. Seven confirmed Important findings: two P1 preservation/completeness failures and five P2 editing/resource failures. No product code was changed by this reviewer.

## Findings

### 1. P1 — Opening a valid project file discards outgoing unsaved changes

- Location: `app/studio/controller.js:62`, `openFile` immediately calls `activate(owned)`; `activate` resets history at line 26.
- Reproduction: browser-save project A with name `Saved title`; dispatch rename to `Unsaved newest title`; immediately open a valid empty STUDIO file before the one-second autosave fires. Reload A from the store.
- Observed in isolated Chrome: A still has `Saved title`; the current project is B and `history.canUndo` is false. The new edit is no longer recoverable through the editor. Unlike `newProject` and `openSaved`, this path does not save the outgoing project. A pending timer subsequently saves whichever project is current.
- Fix: validate/stage the incoming file, durably preserve a dirty outgoing writer project before switching, and retain the outgoing project if preservation fails. Include save-failure state, not just the literal `未保存` status, when deciding whether changes need preservation.
- Regression: rapid valid import after edit; failed outgoing save; invalid import retains current project and history.

### 2. P1 — First music import silently truncates a song when visuals already exist

- Location: `app/studio/controller.js:64`, both `firstMusic && !p.scenes.length` checks.
- Reproduction: create a default project, add text (which creates a scene), then import a 31-second WAV as the first main song.
- Observed in isolated Chrome with a real generated WAV: source duration `31000000`, project duration `30000000`, main-song end `30000000` microseconds. The same branch truncates an ordinary multi-minute song to the default 30 seconds. Full-project export cannot include the missing tail.
- Design section 3 requires the first main song to establish project length; no warning or explicit trim decision is presented here.
- Fix: handle first-song project length independently of whether visuals exist. If shortening would invalidate existing content, reject or present an explicit resolution rather than silently truncate music.
- Regression: first music after text/image, longer and shorter songs, existing locked tracks, complete source tail in the resulting timeline.

### 3. P2 — Duplicating a video drops its linked source audio

- Location: `app/studio/controller.js:56`, the duplicate branch creates only an `insertClip` command.
- Reproduction: select a video with enabled linked source audio and choose `配置を複製`; move the duplicate to an empty audible interval.
- Observed through the actual controller in isolated Chrome: two video clips, one audio row, zero audio rows linked to the duplicate. Audio gain, mute, track and fade settings are also absent from the copied placement.
- Fix: copy all linked audio rows to new IDs and the new clip ID in the same batch/Undo operation; retain source position, track, gain, mute and envelope. Detached audio should remain independent.
- Regression: duplicate/move/mix; mute and envelope preservation; one-step Undo restores the original graph.

### 4. P2 — Unlocked lyric dragging fails with `UNKNOWN_COMMAND`

- Location: `app/studio/controller.js:53`, baseline move command kind map omits `lyric`; `app/studio/timeline.js:5` sends `editSelected('move')` for lyric block drags.
- Reproduction: unlock lyrics, select a 1–2 second lyric, drag it to start at 3 seconds.
- Observed through the actual controller in isolated Chrome: `UNKNOWN_COMMAND` because the generated command type is `moveundefined`. The advertised unlocked timeline operation does not persist.
- Fix: dispatch `setLyricTiming` with the preserved duration and explicit timing source, retaining lock, overlap and range checks.
- Regression: actual lyric block drag, locked rejection, collision rejection, one-step Undo/Redo; avoid testing only numeric trim fields.

### 5. P2 — Disposing UNFOLD while assets load leaks subsequently created bitmaps

- Location: `app/sequence-renderer.js:254` and `:263`.
- Reproduction: start `prepare` for one image with `assets.get` pending; call `dispose`; resolve the asset; await preparation rejection; call `dispose` again.
- Observed with real Chrome `ImageBitmap`: `LAYER_DISPOSED`, one bitmap created after disposal, one bitmap still open (`width > 0`) after the second dispose. The first dispose closes the then-empty array, preparation later pushes a bitmap, and subsequent disposal returns early because `dead` is already true.
- Impact: fast seeks/edits/project switches during preparation retain decoded image resources. The same lifecycle needs guards around asynchronous model imports and render bitmap creation, not just completed renderer cycles.
- Fix: test cancellation/liveness immediately after awaited resource creation and close newly created resources before throwing; avoid publishing resources into a disposed owner. Ensure all partial preparation failures are cleaned up.
- Regression: disposal during delayed asset read and bitmap creation, cancellation during model load, repeated interrupted preparations. Completed prepare/render/dispose loops alone miss this race.

### 6. P2 — Audio trimming leaves the fade at the old clip boundary

- Location: `app/studio/audio-edits.js:27`; linked-video trim also goes through reconciliation without resizing the envelope.
- Reproduction: SFX interval 14–20 seconds, envelope `{originUs:14e6,durationUs:6e6,fadeOutUs:2e6,fadeInUs:0,points:[]}`. Trim its end to 17 seconds.
- Observed in a Node probe using `applyCommand` and `gainAt`: interval ends at `17000000`, envelope duration remains `6000000`, and gain immediately before the new end is `1`, followed by a hard cut. Inspector still offers a two-second fade but the fade is outside the audible interval.
- Design section 5 distinguishes trimming (fit/clamp fades to the new interval) from splitting (preserve the old continuous envelope). The latter is implemented; the former is missing.
- Fix: rebase and clamp clip-boundary fades for actual audio/video trim operations while preserving split continuity and scene masking semantics.
- Regression: trim both ends of standalone and linked source audio with fades, overlapping fade clamping, split continuity, and Undo.

### 7. P2 — Loaded short range is not hydrated into its editing fields

- Location: `app/studio/view.js:17–18`, `updateShort` selects the first saved short but only refreshes fade fields.
- Reproduction: mount/reload a project whose saved short is 6–24 seconds.
- Observed in isolated Chrome: summary is `00:06.000 → 00:24.000 / 18.000秒`; start input is `0`, end input is `15`. These fields do not represent the selected saved short. The confirm handler constructs the replacement short from those stale values, so editing a fade and confirming can replace the saved range with 0–15. The input/summary discrepancy was directly reproduced; the subsequent mutation was established from the confirm handler (the probe sampled state before the queued mutation completed).
- Fix: hydrate all short fields when selecting a short or changing projects. Track selected short/project identity and avoid unconditional input resets on playback-position emits. Reset selection when the previous short does not exist in the new project.
- Regression: reload 6–24 short, change only a fade and confirm, verify 6–24 remains; switch projects with different short IDs; edit during playback without input being reset.

## Review evidence and limits

- Read the approved specification, implementation plan, new STUDIO model/controller/storage/media/render/export/UI paths and changes to shared sequence/image/text/workshop code. Checked the baseline diff and targeted tests for the affected boundaries.
- Fresh isolated, nonpersistent Chrome probes confirmed findings 1–5 and the input discrepancy in finding 7; a fresh Node probe confirmed finding 6. Controller probes used the actual controller/store/commands with a no-op transport to isolate edits from rendering. Music duration used a real WAV/decoder; cancellation used a real ImageBitmap. No user media or user browser profile was accessed.
- The first local test-server attempt was blocked by sandbox loopback permissions; the normal escalation succeeded. A probe initially lacked an OffscreenCanvas rendering context; that probe setup was corrected and rerun successfully. These are test setup issues, not product findings.
- Parent-provided 402 passing Node tests, mixed/full-song exports, marker accuracy and completed lifecycle loops were not independently rerun by this reviewer. They support those tested paths but do not cover the failure cases above. The parent is rerunning the final suite and adding regression tests.
- Existing UI tests primarily cover one layout edit, text focus deletion, short creation and invalid-file rejection; they do not exercise outgoing dirty valid imports, video duplication, unlocked lyric drags, or restored-short input hydration. The duration fixture adds music before visual editing, masking finding 2. Resource tests chiefly exercise completed lifecycles, masking finding 5.
- Explicitly declared unsupported standalone text/silhouette geometry, fixed horizontal UNFOLD composition in tall output, arbitrary p5 code and non-Mac-Chrome compatibility were not treated as new defects. Human listening and licensed-song material remain outside the evidence available here.
- This is a baseline review, not a certification of concurrent fixes. Findings require regression tests and relevant final-suite checks before the parent declares the work complete. No push, merge or publication occurred.
