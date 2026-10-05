# JavaScript image method crash mitigation — 2026-10-05

User report: Chrome error 11 when selecting a newly authored JavaScript image method / the elephant GLB in Sequence. Later the same operation succeeded without an update. The exact custom method source is not yet available.

## Evidence and limits

Three local Chrome 154.0.8037.93 dumps share a renderer-main null dereference at Framework +0xadf96d8 (address 0x70). The instruction sequence matches the accelerated bitmap-transform path accessing a shared-image usage field. Chromium's [StaticBitmapImageTransform::ApplyWithBlit](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/platform/graphics/static_bitmap_image_transform.cc) contains this pattern. This is a source/assembly correlation, not a symbolicated proof of the exact cause.

Our runtime calls createImageBitmap(canvas, {imageOrientation:'flipY'}) each time a method/solid requires a new Worker. That invokes the native transformation path. The mitigation snapshots pixels into ImageData first, keeping the flip/transfer independent of the source GPU shared image. The extra readback runs at preparation, not each animation frame. Image orientation, colors and existing method code remain compatible; large inputs add preparation-time CPU/memory work.

The original native crash was not reproduced in the isolated test browser. Do not call this a confirmed complete resolution. No user storage was reset, and no user assets or dumps were uploaded.

## Verification

- 314 Node tests passed, zero failures.
- New tools/test/image-bitmap-browser.mjs: simulate unavailable direct GPU-backed flip; before mitigation runtime preparation failed; after mitigation it renders successfully with zero unsafe conversions. Red top / blue bottom pixels are exact, proving the image orientation is retained. This is a fault-injection regression, not a native-crash reproduction.
- Existing image-solid-browser tests passed: built-in shapes, imported GLB, reverse seek, image endpoints, zero-strength solid, late-created and hidden pieces; no leaked iframes.
- Public elephant GLB: 191,498 original triangles, downloaded only. Headful Chrome / Apple M4 Metal / deviceScaleFactor 2. Twelve switches between sphere and elephant across three bundled JavaScript presets, waiting for real Worker frames: 24 frames, no crash before or after mitigation. Earlier rapid-switch tests also did not reproduce the crash.

Remaining confirmation: the user's newly authored method and project have not been reproduced. If it recurs, capture that method and the selection/playback state; do not clear browser storage.
