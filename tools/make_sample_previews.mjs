// Makes the preview picture (.jpg) and the short video (.mp4) of every sample on the samples page, into app/guide/samples/.
// The method samples are drawn by the editor's own preview and the text motions by the app's own lyric overlay, so what the page shows is what the app does.
//   node tools/make_sample_previews.mjs                 only the samples that have no preview yet
//   node tools/make_sample_previews.mjs --force         all of them again
//   node tools/make_sample_previews.mjs --only=petals   only the ones whose id or key matches (comma separated; ids look like method-petals)
//   --crf=N   the video quality (higher = smaller file, default 33)
// Needs: Chromium (through Playwright) and ffmpeg with libx264.
// What draws each kind: method / graphic -> the editor's preview; image -> the image method runtime (physics, surface effects); codetext / effect -> the code motion runtime; text -> the lyric overlay.
//   cutpart -> STUDIO's cut engine (tools/preview/cut-part.html): the part's name drawn with only that part, the other axes plain.
//   The words in the preview of a text motion are the sample's own name ("とろけてたれる" melts), so the motion is understood at a glance; an effect keeps a neutral lyric because it decorates any text.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchBrowser } from './lib/browser.mjs';
import { startStaticServer } from './lib/static-server.mjs';
import { MAX_BYTES, PREVIEW_DIR, catalog, previewFiles, sizeOf } from './lib/samples-catalog.mjs';

const FPS = 24;
const IMAGE = { fps: 20, frames: 116, poster: 1.8 };                                       // a 6 second clip of the app's runtime, shown 0 -> 5.75 s; the poster is at 1.8 s unless the sample says otherwise
const METHOD = { frames: 58, maxAmount: .8, posterAmount: .45, posterTime: 1 };            // 0 -> 0.8 -> 0 in 2.4 s: it breaks and comes back
const TEXT = { text: 'きみと、*はじまる*', start: .3, end: 3.3, duration: 3.6, size: 150, poster: .2 };   // the poster is taken just after the line starts (0.2 s in, or the motion's own `poster`), where the presets still look different

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = (args.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const crf = Number((args.find(a => a.startsWith('--crf=')) || '').slice(6)) || 33;
const wanted = catalog().filter(item => (only.length ? only.some(o => item.id === o || item.key === o) : force || !sizeOf(previewFiles(item.id).jpg) || !sizeOf(previewFiles(item.id).mp4)));
if (!wanted.length) { console.log('every sample already has its preview (use --force to make them again)'); process.exit(0); }

const decode = url => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
const smooth = k => k * k * (3 - 2 * k);

mkdirSync(PREVIEW_DIR, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'unfold-preview-'));
const server = await startStaticServer();
const browser = await launchBrowser();
let failed = 0;
try {
  for (const item of wanted) {
    const page = await browser.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
    const problems = [];
    page.on('pageerror', e => problems.push(String(e).slice(0, 200)));
    try {
      const isText = item.group === 'text', page_ = { text: 'text', codetext: 'code-text', effect: 'code-text', image: 'image', cutpart: 'cut-part' }[item.group] || 'method';
      await page.goto(`${server.url}/__tools/preview/${page_}.html`);
      await page.waitForFunction(() => window.previewReady === true, null, { timeout: 30000 });
      let shots, poster, fps = FPS;
      if (item.group === 'codetext' || item.group === 'effect') {
        const times = Array.from({ length: Math.round(TEXT.duration * FPS) }, (_, i) => i / FPS), at = TEXT.start + (item.poster ?? TEXT.poster);
        const words = item.group === 'codetext' ? item.name : TEXT.text;
        const run = (opts) => page.evaluate(({ source, opts }) => window.previewCodeText.run(source, opts), { source: item.source, opts: { text: words, start: TEXT.start, end: TEXT.end, keep: true, ...opts } });
        shots = (await run({ times })).map(f => f.url);
        poster = (await run({ times: [at], quality: .88 }))[0].url;
      } else if (item.group === 'cutpart') {
        const clip = await page.evaluate(() => window.previewCutPart.CLIP), times = Array.from({ length: Math.round(clip.duration * FPS) }, (_, i) => i / FPS);
        const at = clip.start + (item.poster ?? await page.evaluate(({ axis, key, text }) => window.previewCutPart.poster(axis, key, text), { axis: item.axis, key: item.key, text: item.name }));
        const run = opts => page.evaluate(({ axis, key, opts }) => window.previewCutPart.run(axis, key, opts), { axis: item.axis, key: item.key, opts: { text: item.name, keep: true, ...opts } });
        shots = (await run({ times })).map(f => f.url);
        poster = (await run({ times: [at], quality: .88 }))[0].url;
      } else if (item.group === 'image') {
        fps = IMAGE.fps;
        const times = Array.from({ length: IMAGE.frames }, (_, i) => i / IMAGE.fps), run = opts => page.evaluate(({ code, opts }) => window.previewImage.run(code, opts), { code: item.code, opts: { keep: true, ...opts } });
        shots = (await run({ times })).map(f => f.url);
        poster = (await run({ times: [item.poster ?? IMAGE.poster], quality: .88 }))[0].url;
      } else if (isText) {
        await page.evaluate(opts => window.previewText.load(opts), { text: item.name, preset: item.key, start: TEXT.start, end: TEXT.end, size: TEXT.size, duration: TEXT.duration });
        const frames = Math.round(TEXT.duration * FPS);
        shots = await page.evaluate(({ frames, fps }) => Array.from({ length: frames }, (_, i) => window.previewText.shot(i / fps)), { frames, fps: FPS });
        poster = await page.evaluate(t => window.previewText.shot(t, .88), TEXT.start + (item.poster ?? TEXT.poster));
      } else {
        const loaded = await page.evaluate(source => window.previewMethod.load(source), item.source);
        if (!loaded.ok) throw new Error(`does not compile: ${loaded.errors.join(' / ')}`);
        shots = await page.evaluate(({ n, fps, max }) => Array.from({ length: n }, (_, i) => {
          const k = 1 - Math.abs(2 * i / (n - 1) - 1);
          return window.previewMethod.shot(max * k * k * (3 - 2 * k), i / fps);
        }), { n: METHOD.frames, fps: FPS, max: METHOD.maxAmount });
        poster = await page.evaluate(({ a, t }) => window.previewMethod.shot(a, t, .88), { a: item.poster ?? METHOD.posterAmount, t: METHOD.posterTime });
      }
      // a sample that shows nothing new is not worth a preview: the first frame and the middle one must differ
      if (shots[0] === shots[shots.length >> 1] || poster === shots[0]) throw new Error('the picture does not change');

      const dir = mkdtempSync(join(work, `${item.id}-`));
      shots.forEach((url, i) => writeFileSync(join(dir, `f${String(i).padStart(3, '0')}.jpg`), decode(url)));
      const files = previewFiles(item.id);
      writeFileSync(join(dir, 'poster.jpg'), decode(poster));
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%03d.jpg'), '-vf', 'scale=in_range=pc:out_range=tv',   // JPEG frames are full range; newer ffmpeg keeps that range and ffprobe then reports yuvj420p, which the gate rejects
        '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf),
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', join(dir, 'out.mp4')]);
      copyFileSync(join(dir, 'poster.jpg'), files.jpg);   // copy, not rename: the work folder can be on another disk than the repository
      copyFileSync(join(dir, 'out.mp4'), files.mp4);
      const jpg = sizeOf(files.jpg), mp4 = sizeOf(files.mp4);
      const over = [jpg > MAX_BYTES.jpg && `jpg ${jpg} > ${MAX_BYTES.jpg}`, mp4 > MAX_BYTES.mp4 && `mp4 ${mp4} > ${MAX_BYTES.mp4}`].filter(Boolean);
      if (over.length) throw new Error(`too big (${over.join(', ')})`);
      console.log(`ok   ${item.id}: ${shots.length} frames, jpg ${(jpg / 1024).toFixed(0)} KB, mp4 ${(mp4 / 1024).toFixed(0)} KB`);
      if (problems.length) console.log(`     (page said: ${problems.join(' | ')})`);
    } catch (error) {
      failed++;
      console.error(`FAIL ${item.id}: ${error.message}${problems.length ? ` (page: ${problems.join(' | ')})` : ''}`);
    } finally { await page.close(); }
  }
} finally {
  await browser.close();
  await server.close();
  rmSync(work, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
