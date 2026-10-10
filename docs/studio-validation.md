# UNFOLD STUDIO validation

Implementation branch: `codex/studio-completion`; base `5977480`; dedicated worktree `~/Documents/Codex/2026-10-10/task-2/unfold-studio`. Main, the previous worktree and user browser data are preserved. No push, merge or publication.

Implementation and validation are complete through all22 tasks. The final independent review approves product commit `a8b5c89` with no unresolved Critical/Important findings. The required runner completed24/24 suites with exit0; two final supplemental suites (canvas guides and legacy sequence) also pass, and the integrated UI was rerun after the last product change. The runner enumerated its24 tests before those two additions; the next invocation includes all26. Final Node result:403pass,0fail,3preexisting skips. Library attachment delivery was completed through the formal direct-create fallback; see studio-followup.md.

## Environment and method

Mac arm64, macOS26.6.2 (25G83), Google Chrome154.0.8037.99, Node25.8.0. Browser tests use nonpersistent independent contexts and their own localhost server. The standard STUDIO runner uses SwiftShader for repeatability, so timing is not a native-GPU performance claim. Legacy workshop tests use their unchanged renderer launch flags.

All visual/media fixtures are locally generated gradients, shapes, original Japanese words and synthesized tones. No user media was sent anywhere. Real licensed songs, iPhone, other browsers and human listening are unverified.

The mixed fixture owns three960×540 PNG images, two asset IDs for the same8s640×360 H.264/AAC source (audio PTS begins at0.25s), one30s or180s48kHz mono WAV and one1s effect WAV. It uses at most three simultaneous scene layers; the song is mixed with linked source audio or effects. Separate audio tests cover the simultaneous three-role mix. The final30s export/decode stages took154.178s wide and123.389s tall while other validation jobs shared this Mac. These are observed test durations, not a performance guarantee.

Dependencies are Mediabunny1.61.3 (MPL2.0), p5.js2.3.3 (LGPL2.1) and esbuild0.25.10 (MIT); versions, source and license notices are tracked in `tools/studio-build` and `app/vendor`.

## Verified results

| Check | Observed result |
| --- | --- |
| Latest Node suite |403passed,0failed,3preexisting skips;406total |
|30s wide |1920×1080,30fps,H.264/AAC;900 decoded frames |
|30s tall |1080×1920,30fps,H.264/AAC;900 decoded frames |
| Continuous tall cuts |6–24s,9–11s,13–15s,18–20s; exact decoded frame counts and audio ends; original project unchanged |
| File roundtrip |Manifest and each owned asset hash verified after write/read |
|28s audiovisual marker |Video28.000000s, decoded SFX28.000104s;0.104ms difference |
|180s synthetic song |5400 decoded frames;8,640,000 audio samples; last video179.966667s; audio end180s |
|179s audiovisual marker |Video179.000000s, decoded SFX179.000104s;0.104ms difference |
| Saved180s → tall chorus |Reloaded owned assets;14–22s;240 decoded frames,384,000 audio samples |
|20 seek/effect switch cycles |Disposed compositor:0 layers,0 live output frames,0 remaining iframes |
| Observed JS heap at5/10/20 cycles |16,157,261 /34,767,399 /38,369,522 bytes; this is sampled heap, not whole-process/GPU memory or an export peak |
|180s export/decode + saved chorus stage |454.741s in final run (491.541s whole full-song test); output80,134,667bytes |
| Legacy sequence regression |Two images, original timed lyrics, main audio, Undo/Redo, file roundtrip, actual2s H.264/AAC export (60decoded frames), independent STUDIO project survives legacy clear |
| Legacy workshop regression |All4 existing suites pass;11 cards,4 surface motions,7 text motions × short/long/multiline × fonts,8 app handoffs |
| Editor interaction |Text add/save/reload, timing locks, tall-only layout, text-field Delete protection, linked video drag with single Undo, unchanged song/lyrics, invalid import atomicity, real AudioContext playback/view switches |

Machine-readable evidence and artifacts: `tools/out/studio/mixed-report.json`, `full-song-report.json`, `browser-suite-report.json`, logs, wide/tall/short/full-song MP4 files and UI PNG screenshots. Outputs are ignored generated files; source tests remain tracked.

## Important test-driven corrections

- Mac AAC encoder adds2112 priming samples. A per-codec synthetic impulse measures delay; packet timestamps retain negative decode preroll and the final packet duration is bounded. RED onset0.544125/end1.066667s; GREEN onset0.500125/end1.000000s for intended0.5/1s.
- Canvas2D readback backend changed between early and later p5 frames. `willReadFrequently:true` makes rewind pixel comparisons deterministic. Lost response removes the sandbox iframe and rejects pending requests.
- Preview safety guides now measure the actual canvas bounds in both aspect ratios; independent visual test passes within0.02px of the expected guide dimensions.
- Video drag integration test originally sent y1037px into a1000px viewport. Instrumented hit testing found no target; scrolling the clip into view makes the same actual drag/link/Undo test pass.
- The workshop read-only listing initially created an empty legacy method DB. A database inventory assertion caught it; the optional existing-only listing now preserves all legacy databases and localStorage.
- Playback audio decode failure initially left playing=true. The failure test now confirms rejection, playing=false and0 audio sources. View changes during playback retain exactly1 audio source.
- Overlapping front/end clip fades multiply using their saved origin and duration; split clips retain that origin instead of restarting the fade.

## Scope and limitations

The standalone UNFOLD renderer supports certified built-in/preset solids, owned GLB geometry and owned image-code snapshots. Text/silhouette geometry is rejected with a reason; it is not approximated. UNFOLD renders its horizontal composition inside the portrait layout. The user can change placement/scale/backdrop per view. p5 accepts the bundled deterministic preset; arbitrary p5 code is not accepted. Legacy shader/image-code/text-motion sources remain subject to explicit STUDIO approval, separate from legacy approvals.

Export uses bounded sequential fragmented MP4 writes through the file picker in MacChrome. Other-player compatibility, very large projects, device-specific codecs, real disk-full conditions and whole-process/GPU memory limits are not certified. Storage quota and cancellation paths are fault-injected against real browser transactions/sinks; actual device exhaustion is not claimed.

## Delivery status

Final UI PNGs and real audio/video demos are staged in `tools/out/studio/delivery/` with SHA-256 checksums and `attachment-handoff.json`. The prepared helper initially failed before preparation because it could not discover prepare_uploads. On the authorized follow-up, the current catalog exposed direct create with files batches. The formal fallback succeeded for all four files, and returned identities/xattrs were persisted locally. See studio-followup.md and delivery/library-results.json for exact IDs. No public share was created.

## Final reproducible checks

- `node --test tools/test/*.test.mjs tools/test/studio/*.test.mjs`:403pass,0fail,3existing skips (the same historic layout/key/shape comparison skips).
- `node tools/test/studio/run-browser.mjs`:24/24 mandatory suites at enumeration time, all exit0.
- `node tools/test/studio/guides-browser.mjs` and `node tools/test/studio/legacy-sequence-browser.mjs`:both PASS on final product code.
- Final `integration-ui-browser.mjs` rerun:PASS including real AudioContext playback and view switches.
- `git diff --check`:clean. Main remains5977480 and clean; no push/merge/publication.

All browser tests are complete; no test process needs resuming. All four generated files are now in Library; the parent can attach their returned file IDs without accessing the Mac paths.
