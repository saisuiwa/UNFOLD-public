# Image method Worker build

Pinned: Three.js 0.180.0, Troika Text 0.52.4, GSAP 3.13.0,
Rapier 3D compat 0.21.0 (embedded WASM), esbuild 0.25.10.
The existing GLSL renderer and lyric Worker are not upgraded.

From the repository root:

```sh
mkdir -p tools/image-code-build/.deps
cp tools/image-code-build/package*.json tools/image-code-build/.deps/
npm ci --prefix tools/image-code-build/.deps --ignore-scripts
node tools/image-code-build/build.mjs
```

Output: `app/vendor/image-method-worker.js`. No network dependencies at runtime.
Rapier's license is in `app/vendor/image-method/RAPIER-LICENSE.txt`.
The other bundled libraries use the existing notices in `app/vendor/code-motion/`.

## Verification

```sh
node --test tools/test/*.test.mjs
npm install --prefix tools/image-code-build/.test-deps --ignore-scripts --save-exact playwright-core@1.55.1
python3 -m http.server 8775 --bind 127.0.0.1
# In another terminal (installed macOS Google Chrome, isolated temporary profile):
node tools/test/image-method-browser.mjs
node tools/test/image-method-integration.mjs
node tools/test/image-method-edge.mjs
```

Browser tests create their own sample images and audio. No user assets are used.
Generated MP4s, screenshots and results go to ignored `tools/out/image-code-physics/`.

Solid extension tests use port 8776 with the repository root served locally:

```sh
python3 -m http.server 8776 --bind 127.0.0.1
node tools/test/image-solid-browser.mjs
node tools/test/image-solid-integration.mjs
node tools/test/image-solid-ui.mjs
node tools/test/image-solid-colour-browser.mjs
```

They generate a GLB fixture in memory and use isolated browser storage. No user assets are uploaded.
`image-solid-colour-browser.mjs` checks the 「GLBの色（写真と混ぜる）」 slider with image code: the model's base colour and texture show on the solid,
and 0 % (or a frame without `modelColor`) looks exactly as before.

GPU bitmap crash mitigation regression (serve repository root on port 8777):

```sh
node tools/test/image-bitmap-browser.mjs
```

This injects a failure for direct GPU-backed image flips and verifies CPU-backed
image transfer and the rendered image orientation. It does not reproduce a native Chrome crash.
