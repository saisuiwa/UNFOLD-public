# Isolated code motion runtime verification — 2026-10-04

Implemented parent client → opaque sandbox iframe → dedicated Worker. Bundled local Three 0.180.0, Troika 0.52.4 and GSAP 3.13.0. Host sends only source, lyric/runs, dimensions/style, font bytes and seed. Network CSP permits blob/data only; no main DOM or storage. Deadlines terminate the Worker and discard pending requests. Worker serializes rendering requests and transfers ImageBitmap. Parent validates bitmap type and closes stale replies. Default font uses parent-owned gothic.ttf. Code errors propagate explicitly.

Troika's bundled canvas allocation uses an OffscreenCanvas adapter; no DOM is exposed. CPU SDF generation and in-worker typesetting avoid nested Troika workers. Text sync completes immediately when no rebuild is needed. Whole-text createText inherits per-run colorRanges. API includes runs/duration and seeded random.

## Actual Chrome browser results

Test page: http://127.0.0.1:8774/tools/test/code-motion-runtime.html, isolated agent-created tab. All assertions passed:

- Japanese Three/Troika/GSAP rendered nontransparent bitmap.
- Seek .5 → 1 → .5 produced identical pixel hash 1487625066.
- Thrown source error rejected preparation.
- Infinite initialization loop timed out and terminated Worker.
- Infinite update loop timed out and terminated Worker.
- Worker source sees no document or localStorage.
- Fetch to HTTP localhost was rejected by CSP.
- Export bitmap returned exact 1280 × 720 dimensions.

Node --check passed for runtime and worker entry; git diff --check passed. Build creates ~872KB trusted worker bundle. Dependency license files and lock included.

Remaining verification belongs to parent integration: editor/save/project activation, host latest-frame behavior, PC font bridge, MP4 encoding/decoding. Arbitrary update(time) authors must derive animation state from absolute time for deterministic seeking. Font loader failures are surfaced through fatal error forwarding; fonts with unsupported glyphs can trigger blocked fallback and fail explicitly.
