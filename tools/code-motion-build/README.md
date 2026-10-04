# Code motion bundle

Run from repository root with Node 20+: `npm install --prefix tools/code-motion-build/.deps --ignore-scripts --save-exact three@0.180.0 troika-three-text@0.52.4 gsap@3.13.0 esbuild@0.25.10`, then `node tools/code-motion-build/build.mjs`.
The build directory is ignored and never deployed. Runtime dependencies are bundled locally; no CDN. Preserve license notices in app/vendor/code-motion.

Fallback font is parent-owned app/vendor/motion-fonts/gothic.ttf; license accompanies those assets.
