# UNFOLD method workshop

User authorizes completion autonomously, including a separate page. No deployment or GitHub push.

A responsive /workshop.html combines selectable diagram cards, one real renderer, a code editor, errors, reference image and test images, palette copies, named browser saving and direct app handoff. Tabs distinguish GLSL image methods, JavaScript image/physics methods, and JavaScript text motions. Existing recipe motions and the 29 built-in examples remain accessible via the gallery. All preview and export contracts are reused, not replaced.

Cards have static block diagrams initially and an actual captured thumbnail after successful preview. Selecting a card loads its working draft without executing arbitrary JS. The card and primary action clearly offer “プレビュー”; only one renderer exists and code edits, switching, hidden tabs and force stop dispose it. Bundled GLSL can be previewed by explicit action too for consistent behavior. A diagram test image with a labeled grid makes the actual method movement legible; the user can replace it with A/B photos. Arbitrary code is never run for thumbnail generation alone.

Save keeps .unfoldmethod and .unfoldmotion formats and existing browser databases. New workshop-only drafts, references and thumbnails do not enter shared files. “UNFOLDに追加” saves and offers one-image and sequence app routes; an already open app receives a nonexecuting invitation to apply to the selected block. Applying to an existing project remains an explicit click and uses existing undo paths. No account service, public author uploads or cloud sync.

Palette offers eight existing lyric palettes, native picker, editable HEX, copies as HEX / JS hex / normalized GLSL vec3. Text color/accent are passed through the existing API; for image code colors are copied, not guessed/replaced. GLSL methods only return positions, so color copies are authoring aids, not a new color API.

Image input: PNG/JPEG/WebP, <=20MiB, <=80M decoded pixels, long edge <=2048 preview pixels. Reference image stays separate from render input unless explicitly assigned. Blob storage is IndexedDB. Draft text is saved on edits independently of execution, in a new key, never overwriting existing editor drafts. Failed storage is surfaced, not success. Imported code remains unconfirmed until explicit preview. A successful proof is invalidated by code/parameters/images edits.

Preserve CPU ImageData snapshot transfer in image-method-runtime.js. Keep GLSL guards, compile and trial; JS opaque iframe + Worker + existing timeouts. Force stop destroys runtime, while pause only suspends playback. No claim that JS isolation prevents native GPU crashes. Preview quality capped at 800x450 and uses one active runtime. Text preview fonts use bundled fonts.

Completion: 314 baseline tests plus behavior tests for draft state, colors, image bounds, save/import, local app handoff, GLSL/imageJS/text rendering, force stop and timeout recovery, repeated selection, mobile layout and screenshots. Build has no new dependencies; work stays on ORICO. No publish.
