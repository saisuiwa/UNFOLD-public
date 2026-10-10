# Final status — all22 implementation tasks complete

Current worktree: `~/Documents/Codex/2026-10-10/task-2/unfold-studio`; branch `codex/studio-completion`; independently reviewed baseline product revision `a8b5c89` (subsequent plan-detail completion below). The chronological ledger below retains the previous worktree and pause history. Final delivery attachment subsequently succeeded through the formal direct-create fallback; see studio-followup.md.

# SDD ledger — plan: docs/superpowers/plans/2026-10-10-studio-implementation.md

Execution: user approved full implementation + fixed dependencies, inline executor with one final independent reviewer. No push, publication, merge or external user-media transfer.
Base: 5977480. Worktree: ~/Documents/Codex/2026-10-10/task/unfold-studio. Branch: codex/studio-editor.
Baseline: node --test --test-reporter=tap tools/test/*.test.mjs: 359 passed, 0 failed, 3 existing skips (default layout before ordered option; keys labels symbols ids before change; apple/ice cream before new shapes).
Ruling: Native worktree API unavailable in this connection; used git worktree in writable task root — preserves main and sandbox write scope — cost if wrong: attachment absent, location explicitly reported.
Ruling: Normalize task headings T1→Task 1 only so official task-start can extract briefs — approved technical content unchanged — cost if wrong: heading-link anchors differ.
Pre-flight T1→T2/T3/T4: immutable Project, integer absolute time, stable IDs; scene trim origin invariant, clip trim advances source offset. Consistent.
Pre-flight T3→T5/T6: history.refs + persistent protection before save/GC, history revision distinct from saved revision. Consistent; saved revision must be rebased on history restore.
Pre-flight T4→T8/T9: resolve linked clip time at read, original track PTS retained; envelope origin must move with content, not short start. Consistent.
Pre-flight T5/T6→T7: one DB transaction checks fence/revision and assets; file staging must not replace current until validated. Consistent.
Pre-flight T8→T9/T13/T17: video frames caller closes, PCM 48k stereo, raw track offsets retained. Consistent.
Pre-flight T10→T11/T13/T15: layouts owned separately; same glyph IDs and fixed seed; fallback contain for uncertified portrait. Consistent.
Pre-flight T12→T13/T14: pure evaluator vs DOM renderer; snapshot independently owned, no global registry save. Consistent.
Pre-flight T11/T13/T15→T16→T17: frame epochs, explicit projectUs separate from output timestamp, all abort resources closed. Consistent.
Pre-flight T18→T19/T20/T21: UI invokes same immutable commands, linked audio UI drag routes to video command, explicit audio-use choice. Consistent.
Pre-flight T22: real fixture output and legacy regression required; historical 362 counts are not claimed as 362 passes.
Dependency metadata verified official npm: mediabunny1.61.3 MPL-2.0; p5 2.3.3 LGPL-2.1; esbuild0.25.10 MIT.
Task 1: complete (commits 5977480..cd294df, tests: node --test --test-reporter=tap tools/test/studio/model-time.test.mjs → # duration_ms 67.784958)
Task 2: Ruling: remove linked audio on deleted visuals and clone links on split already in T2 — otherwise T1 reference validation rejects visual operations before T4 — cost if wrong: audio metadata integration begins one task earlier; timing reconciliation remains T4.
Task 2: complete (commits cd294df..0cd6bbb, tests: node --test --test-reporter=tap tools/test/studio/model-time.test.mjs tools/test/studio/commands.test.mjs → # duration_ms 70.878542)
Task 3: Ruling: added history.markSaved(revision) — saved revision must not roll back with Undo; otherwise optimistic save falsely conflicts — cost if wrong: controller must call this on confirmed save only.
Task 3: complete (commits 0cd6bbb..0d02702, tests: sh -c 'node --test --test-reporter=tap tools/test/studio/*.test.mjs' → # duration_ms 74.160417)
Task 4: complete (commits 0d02702..9e09cdb, tests: sh -c 'node --test --test-reporter=tap tools/test/studio/*.test.mjs' → # duration_ms 81.319042)
Task 5: Ruling: quota injected at native IDBObjectStore.put in tests instead of product faults flags — exercises real transactions without shipping test-only branches — cost if wrong: actual disk-full remains a separate real-device condition.
Task 5: Ruling: chunked SHA-256 identity (4MiB chunks) instead of whole-Blob arrayBuffer hash — bounds hashing memory for video — cost if wrong: external generic SHA-256 tools cannot compare directly; format names the algorithm.
Task 5: Ruling: moved reference collector from history to assets.js and injected T6 lease store primitives now — one GC ownership rule and shared transaction boundary — cost if wrong: slightly earlier interface exposure.
Task 5: complete (commits 9e09cdb..fadafe0, tests: node tools/test/studio/store-browser.mjs → PASS store: quota at asset/save, atomic manifest, saved+history+other-project GC, legacy sentinel, reload)
Task 6: complete (commits fadafe0..b65aae6, tests: sh -c 'node tools/test/studio/lease-browser.mjs && node tools/test/studio/store-browser.mjs' → PASS store: quota at asset/save, atomic manifest, saved+history+other-project GC, legacy sentinel, reload)
Task 7: Ruling: optional read-only dependency resolver for existing GLB/font bytes — legacy files omit them, so explicit MISSING_ASSET instead of replacement — cost if wrong: uncommon library versions may need manual resupply.
Task 7: Ruling: file export prunes unused metadata/snapshots and streams 4MiB chunks; manifest capped at16MiB — no Undo/cache payload and no full video allocation — cost if wrong: extremely large manifests are rejected explicitly.
Task 7: Ruling: legacy import calculates existing beat duration locally until T12 exposes shared evaluator; later remove duplicate — import precedes renderer extraction in plan — cost if wrong: drift until T12 parity test resolves it.
Task 7: complete (commits b65aae6..6e4703e, tests: sh -c 'node --test --test-reporter=tap tools/test/studio/file.test.mjs && node tools/test/studio/file-browser.mjs && node tools/test/studio/store-browser.mjs' → PASS store: quota at asset/save, atomic manifest, saved+history+other-project GC, legacy sentinel, reload)
Task 8: Ruling: allow frame:null before the video track first PTS — preserves a genuine initial gap instead of showing a future frame — cost if wrong: compositor must render background for null.
Task 8: Ruling: ignore rules needed explicit tools/studio-build JSON allowlist, added source/license notice — dependencies otherwise not tracked — cost if wrong: only these two manifests newly tracked.
Task 8: Ruling: corrected unsupported codec fixture to remove both MP4 sample-entry and esds codec declaration; demuxer was correctly finding AAC in esds — preserves real negative test rather than mocking canDecode — cost if wrong: unsupported fixture tests unknown codec rather than a particular commercial codec.
Task 8: Observation: AAC synthetic input has encoder padding (reported end4.068667 for intended4); T17 must verify exact output sample end/mux duration rather than assuming encoder buffers have no padding.
Task 8: complete (commits 6e4703e..59abbdd, tests: node tools/test/studio/media-browser.mjs → PASS media: H264/AAC, silence, unsupported audio, original PTS, rotation, 24/30/60/VFR, reverse/concurrent seek, cancellation, disposal)

Resume: 2026-10-10 task-2; copied existing T9 unfinished files and ledger. Original worktree preserved. New worktree ~/Documents/Codex/2026-10-10/task-2/unfold-studio branch codex/studio-completion at 59abbdd. Baseline 393 pass, 0 fail, 3 existing skip.
Task 9: Ruling: 44.1k→48k step assertion uses analytically computed linear interpolation 0.25*0.08125 at sample23999, then0.25 at24000 — old test incorrectly required zero before interpolated boundary — cost if wrong: linear resampling quality remains limited, no timestamp shift.
Task 9: complete (commits 59abbdd..1731e41, tests: node --test tools/test/studio/audio-mix.test.mjs → ℹ duration_ms 214.213208)
Task 10: complete (commits 1731e41..9a29f3e, tests: node --test tools/test/studio/layout-text.test.mjs → ℹ duration_ms 86.098542)
Task 11: complete (commits 9a29f3e..98ad4e7, tests: node --test tools/test/studio/layout-text.test.mjs → ℹ duration_ms 87.70125)
Task 12: complete (commits 98ad4e7..2cb9fba, tests: node --test tools/test/studio/sequence-core.test.mjs → ℹ duration_ms 65.720875)
Task 13: Ruling: image-method-runtime accepts optional owned fontBytes, passed through injected image layer resolver — required to avoid legacy font DB reads for STUDIO snapshots — cost if wrong: one additional backward-compatible file boundary.
Task 13: Ruling: shared drawSequenceVisual retains exact old rendering path; independent instances initially support built-in/preset/model shapes and image-code, explicitly reject text/silhouette geometry — these need separate owned font/shape adaptation — cost if wrong: some workshop shapes remain unavailable and must be labelled.
Task 13: complete (commits 2cb9fba..ea48d74, tests: node --test tools/test/studio/sequence-core.test.mjs → ℹ duration_ms 67.157583)
Task 14: complete (commits ea48d74..08c8039, tests: node --test tools/test/studio/unfold-edit.test.mjs → ℹ duration_ms 70.078792)
Task 15: provisional — primary rendering green, added fault fixture initialization timed out; not complete until fault test rerun. (commits 08c8039..bf648fd, tests: node --test tools/test/studio/layout-text.test.mjs → ℹ duration_ms 86.936042)
Task 15: complete — node tools/test/studio/p5-browser.mjs PASS actual p5 and lost-response timeout cleanup; Node suite 401 pass, 0 fail, 3 existing skips. Chrome Canvas2D backend switched after repeated readback; willReadFrequently:true fixed exact pixel determinism. Fault timeout 200ms was too short for iframe initialization; 2000ms exercises missing render response reliably.
Task 16: complete (commits f09aa7b..d1fa217, tests: node --test tools/test/studio/audio-mix.test.mjs → ℹ duration_ms 223.871167)
Task 17: Ruling: use native AudioEncoder plus Mediabunny EncodedAudioPacketSource with per-codec synthetic impulse latency calibration — Mac AAC had 2112 priming samples and 66.7ms tail; shift packet timestamp by measured delay, trim final packet duration, preserve decode preroll at negative timestamps — cost if wrong: other encoders must pass calibration, fragmented MP4 compatibility outside tested Chrome remains unverified. RED decoded onset .544125s/end1.066667; GREEN .500125s/end1.000000s for intended .5/1 seconds.
Task 17: complete (commits d1fa217..a3b543a, tests: node --test tools/test/studio/audio-mix.test.mjs → ℹ duration_ms 226.508042)
Task 18→19: Ruling: prepare UI tests while long full-HD mixed exports run; do not declare T18 complete until output checks finish — independent test authoring avoids idle time — cost if wrong: later mixed fixes may require UI rerun.

Task 18: complete — mixed-browser real full-HD wide/tall 30s and four cut ranges PASS. Each decoded every frame, AAC exact end, asset-hash file roundtrip. marker-browser: visual28s/audio28.000104s. Reports tools/out/studio/mixed-report.json and six MP4s.
Task 19: complete — ui-browser PASS add text, locks, browser save/reload, tall layout scope. Async add assertion waits for observable committed count. Node401 pass,0fail,3existing skips. Negative UI paths are extended with T20 integration.

Parent-requested pause: current HEAD fd998394bf61373c5be2830c138202bf2b29b9ea; T20/T21 product work uncommitted, T22 full-song + integration UI tests running (not passed yet). Fresh full Node suite402pass0fail3existing skips/405total. Durable resume docs/studio-resume-2026-10-10.md. Independent final review not begun.
Pause last observation: full-song printed PASS 5400frames/180s, marker delta0.104ms, disposal0; session exit still to inspect. integration-ui-browser failed wait after video drag; playback checks not reached. See durable resume last-observation section.
Resume: full-song process exited0; integrated UI drag failure traced to test coordinates y1037 outside viewport1000, pointer events hit no clip. scrollIntoViewIfNeeded fixes test, actual drag/link/singleUndo/AudioContext playback PASS.
Task 20: implementation complete; edit-ui and integration-ui PASS, draft preview/source replacement added for final suite. Overlapping fades multiply via original-origin envelope metadata; RED1 vs .25 then GREEN.
Task 21: implementation complete; workshop-browser PASS including11 examples/name/settings/uniqueIDs/no registry/localStorage mutation. Added DB-list invariant RED showed empty legacy DB creation; optional existingOnly read in savedWorkshopItems fixes it, GREEN.
Task 22: full-song180s5400frames, exactaudioend, marker0.104ms,20cycle resources0 PASS; legacy4suites PASS. Full-suite runner and final independent review pending.

## Final validation/review checkpoint

The approved single-developer execution completed implementation through T21; T22's full-song and legacy tests pass individually. Commit40490df fixes the review baseline. A fresh read-only final reviewer is inspecting base5977480..40490df; final browser runner covers all *-browser.mjs including inherited T5–T8, and final Node suite currently402pass0fail3preexisting skips. Final result and review corrections will be appended after they finish.

Rendering limitations are explicit, not silent substitution: standalone UNFOLD text/silhouette geometry unsupported; tall UNFOLD uses contained horizontal composition; arbitrary p5 code unsupported; MacChrome verified only. These are disclosed in the user report.

## Independent review and final corrections

Fresh independent review against 5977480 found seven Important issues, all fixed with regression tests in d1d903d: outgoing unsaved edits on import; first-song duration after visual placement; duplicate-video linked audio; unlocked lyric moves; late renderer bitmap disposal; trim/fade envelope endpoints; saved short input hydration. Follow-up identified a dirty lost-lease variant; eba725f adds a shared preservation guard for all three project-switch paths. RED→GREEN browser evidence also checks recovery by takeover+save. The reviewer independently passed the four regression browser tests and13 Node audio tests, and found no remaining Critical/Important issue at eba725f.

Visual QA then found safety guides measured against the preview panel. a8b5c89 tracks the actual canvas with a disconnected-on-dispose ResizeObserver. RED wide guide718.75px vs expected564.48px; GREEN wide564.469px and tall178.594px, both within0.02px of the expected dimensions. The independent reviewer checked this final product change and retained approval.

Added legacy-sequence-browser: real old UI application with two owned images, original Japanese lyrics, explicit0.25s lyric timing, original3s WAV, Undo/Redo, legacy file roundtrip, actual2s H.264/AAC export (60 decoded frames, nonzero decoded audio), and legacy clear preserving a separately saved STUDIO project. PASS. All contexts are nonpersistent and isolated from user browser storage.

The invalid-import UI assertion now first completes an explicit save so an unrelated queued autosave cannot change the manifest revision during the equality check. Invalid-file import still must leave the entire saved project unchanged. Full integrated UI PASS after the final guide change.

Task20: final acceptance complete — final integrated UI, edit UI, guide checks and full mixed suite PASS.
Task21: final acceptance complete — independent workshop snapshots, no old-storage mutation, existing four workshop suites PASS.
Task22: complete — required runner24/24 exit0 plus2 final supplemental browser suites; Node403pass0fail3existing skips. Final180s5400frames,8,640,000audio samples, audio end180s, marker delta0.104ms, final disposed layers/frames/iframes0. Export/decode+saved chorus454.741s; whole full-song suite491.541s. Reviewer approves a8b5c89 with no unresolved Critical/Important finding.

No running test remains. Main remains5977480 and clean. Only parent-side formal Library attachment remains; see tools/out/studio/delivery/attachment-handoff.json.

Follow-up: clarified that unsupported text/silhouette means UNFOLD target geometry, not ordinary lyric/text layers. Four generated artifacts now have confirmed Library IDs via formal direct-create batch fallback. Minor plan differences (all scenes expanded; external real-song test fixture importer absent) are documented in studio-followup.md, distinct from reviewer findings. No product change in this follow-up.

## Completion of the two follow-up plan details

Selected-scene UI: RED expected1 clip row but observed2; GREEN only the selected scene expands while all scene/global lyric/audio rows retain the same time scale. Separate playback highlight, scene/clip selection, global lyric selection, zoom alignment and unchanged project state are tested with the real controller. An additional RED showed unselected seek retaining sceneA instead of current sceneB; GREEN follows the playhead only while there is no explicit selection.

Explicit song input: RED full-song runner rejected UNFOLD_STUDIO_SONG_FIXTURE; new path-reader test also failed before its implementation. The runner now reads only the supplied regular file, probes its actual audio, retains original bytes/hash, derives frame-aligned project duration and preserves source end. Fast Chrome verification uses an original32.125s WAV (964frames,32133333us project,32125000us audio), and also checks the unchanged default180s synthetic route. Missing/non-file paths reject. The long acceptance uses only /tmp/UNFOLD-original-180.wav produced by the tracked generator, not a user song.

Follow-up acceptance complete: whole Node404pass0fail3existing skips; seven relevant browser suites plus full-song explicit-path PASS. Original180s WAV path produced5400frames, audio end180s, marker0.104ms, saved short240frames and disposed resources0. Library screenshots updated in place toversion1; videos unchanged. The two previously noted plan differences are closed. No running process, no push/merge/publication.
