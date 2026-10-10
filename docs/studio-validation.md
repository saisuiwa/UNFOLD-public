# STUDIO validation (in progress)

Worktree: `~/Documents/Codex/2026-10-10/task-2/unfold-studio`; branch `codex/studio-completion`; base `5977480` (T1–T8 inherited through `59abbdd`). No push, merge or publication.

All browser tests launch Google Chrome in independent nonpersistent Playwright contexts. No user browser storage is cleared. Fixtures contain only programmatically generated graphics, original short Japanese lyrics, tones and effects.

## Verified before mixed integration

- Node suite: 401 passed, 0 failed, 3 preexisting skips (404 total).
- Audio: real AAC decoding, 44.1k mono→48k stereo, song/source/SFX mix, split and detach continuity, range fades.
- Canvas text/images: Japanese glyphs, color, half-open timing, backward seeks, image contain, missing/cancelled owned fonts.
- UNFOLD: actual shared legacy WebGL shader, sphere/fold, separately owned renderers, fixed image-code snapshots and owned font bytes, rewind and registry isolation.
- p5 2.3.3: actual local bundle, deterministic seed/time and rewind, opaque origin sandbox, CSP no network, response-timeout frame removal. `willReadFrequently` is required for Chrome CPU/GPU readback consistency.
- Composite/transport: actual z/opacity/background composition; old seek completion cannot publish; frame disposal.
- Actual MP4 H.264/AAC export: 30 decoded video frames at 320×180 for a 1-second range. Encoded video starts 0; original rendering starts 6s. Cancellation aborts rather than closes the sink.
- Mac AAC calibration: encoder adds 2112 priming samples. Synthetic impulse measures delay per codec; encoded preroll is retained at negative timestamps, final packet duration is bounded. Decoded tone intended at 0.5s appears at 0.500125s; audio/video end at 1s. Uncorrected test failed at onset 0.544125s and end 1.066667s.

## In progress

T18: 30s 1920×1080 and 1080×1920, portrait 6–24, 9–11, 13–15, 18–20, all H.264/AAC. Each output is fully decoded, checked for frame count/duration and saved locally. T19–T22, final independent review, final suite, screenshots and Library transfer are pending.

## Known scope and unverified aspects

The initial standalone UNFOLD renderer explicitly reports unsupported text/silhouette geometry; built-in and preset solids, GLB and image code use the supported path. Arbitrary p5 code is not accepted. Fragmented MP4 is optimized for bounded streaming writes; compatibility outside Mac Chrome is unverified. Human listening, iPhone and real licensed song material are unverified.
