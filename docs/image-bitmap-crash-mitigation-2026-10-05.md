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

## Publication

Published the mitigation to https://unfold.saisuiwa.com/ after local verification.

- Source commit: `d235e9d26e56e4851be761cbde9d83d69a3cb10d`
- Cloudflare version: `e8720b64-ee47-4ed5-97b2-91fc8417c296`
- Previous version: `5e3de57c-334e-4d0a-9048-9b42a5fcda32`
- Release directory: `releases/unfold-image-crash-fix-2026-10-05/`
- All 285 public assets passed hash / MIME verification.
- Public Sequence smoke: six actual sphere/elephant clicks across the three bundled JS methods, waiting for returned Worker frames; 12 frames, zero crashes or page errors. This used only the public elephant model and synthetic images, in isolated browser storage.
- User reported the operation succeeded before this update. Therefore this release is a targeted mitigation, not evidence that the reported intermittent crash is conclusively fixed.
