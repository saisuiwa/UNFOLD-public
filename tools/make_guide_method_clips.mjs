// Makes the short clips (jpg + mp4, 400x224, 20 fps, 3 s) of the 「メソッド集」 page for built-in methods, through the real sequence page:
// two pictures, no shape ("立体化なし"), flow "reveal" — the same set-up the first 29 clips were made with.
//   node tools/make_guide_method_clips.mjs --keys=scrawl,tangle [--out=app/guide/methods] [--a=picture.png --b=picture.png] [--poster=scrawl:.2,tangle:.2] [--force]
// (the still picture is taken at .45 of the clip unless --poster says otherwise: the line-art methods erase their lines as they go, so they need an earlier moment)
// The two pictures default to the first and the last frame of an existing clip (app/guide/methods/crumple.mp4: harbour painting -> neon street).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { launchBrowser } from './lib/browser.mjs';
import { startStaticServer } from './lib/static-server.mjs';

const args = process.argv.slice(2), arg = n => (args.find(a => a.startsWith(`--${n}=`)) || '').slice(n.length + 3);
const keys = arg('keys').split(',').filter(Boolean), out = resolve(arg('out') || 'app/guide/methods'), force = args.includes('--force');
if (!keys.length) { console.error('--keys=key,key is needed'); process.exit(2); }
const work = mkdtempSync(join(tmpdir(), 'guide-clips-'));
let a = arg('a'), b = arg('b');
if (!a || !b) {
  const source = ['crumple.mp4', 'twist.mp4'].map(n => join(out, n)).find(existsSync) || '/Volumes/ORICO/UNFOLD/app/guide/methods/crumple.mp4';
  a = join(work, 'a.png'); b = join(work, 'b.png');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', source, '-vf', 'scale=1280:720:flags=lanczos', '-frames:v', '1', a]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-sseof', '-0.06', '-i', source, '-vf', 'scale=1280:720:flags=lanczos', '-frames:v', '1', b]);
}
mkdirSync(out, { recursive: true });
const FPS = 20, SECONDS = 3, POSTER = .45;
const posterOf = Object.fromEntries(arg('poster').split(',').filter(Boolean).map(x => { const [k, v] = x.split(':'); return [k, Number(v)]; }));
const server = await startStaticServer(), browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.error('pageerror', String(e).slice(0, 160)));
  await page.goto(server.url + '/sequence.html?empty', { waitUntil: 'load' });
  await page.waitForFunction(() => window.unfoldSeq, null, { timeout: 60000 });
  const toB64 = f => readFileSync(f).toString('base64');
  await page.evaluate(async ([ia, ib]) => {
    const blob = b64 => fetch('data:image/png;base64,' + b64).then(r => r.blob());
    await unfoldSeq.addImageBlob(await blob(ia), 'a.png'); await unfoldSeq.addImageBlob(await blob(ib), 'b.png');
  }, [toB64(a), toB64(b)]);
  for (const key of keys) {
    const dir = join(work, key); mkdirSync(dir, { recursive: true });
    if (!force && existsSync(join(out, key + '.mp4')) && existsSync(join(out, key + '.jpg'))) { console.log('skip ', key, '(exists; --force to make again)'); continue; }
    const info = await page.evaluate(async ({ key, FPS, SECONDS }) => {
      const s = unfoldSeq.seq;
      s.transitions.length = 0; s.transitions.push({ method: key, shape: 'none', flow: 'reveal', method2: '', text: '', font: 'gothic', beats: 8, viewX: 0, viewY: 0 });
      s.bpm = 120; s.holdBeats = 2; s.recording = true;
      const { evaluateSequenceFrame } = await import('/sequence-core.js');
      // the seconds where the change runs (progress 0 -> 1), mapped onto 3 s
      let t0 = null, t1 = null; const total = unfoldSeq.totalSeconds();
      for (let t = 0; t <= total; t += 1 / 60) { const f = evaluateSequenceFrame(s, Math.round(t * 1e6)); if (f.transitionIndex === 0) { if (t0 === null) t0 = t; t1 = t; } }
      return { t0, t1, total };
    }, { key, FPS, SECONDS });
    if (info.t0 === null) throw new Error('no transition found for ' + key);
    const frames = FPS * SECONDS;
    for (let i = 0; i < frames; i++) {
      const sec = info.t0 + (info.t1 - info.t0) * (i / (frames - 1));
      const data = await page.evaluate(sec => { unfoldSeq.renderAt(sec); return document.querySelector('canvas#seq-canvas, #stage canvas, canvas')?.toDataURL('image/png'); }, sec);
      require_(data, key);
      writeFrame(dir, i, data);
    }
    const posterIdx = Math.round((posterOf[key] ?? POSTER) * (frames - 1));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', join(dir, 'f%03d.png'), '-vf', 'scale=400:224:flags=lanczos', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '30', '-movflags', '+faststart', join(out, key + '.mp4')]);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(dir, String(posterIdx).padStart(3, '0').replace(/^/, 'f') + '.png'), '-vf', 'scale=400:224:flags=lanczos', '-q:v', '4', join(out, key + '.jpg')]);
    console.log('ok   ', key, `${frames} frames, transition ${info.t0.toFixed(2)}-${info.t1.toFixed(2)} s`);
  }
} finally { await browser.close(); await server.close(); rmSync(work, { recursive: true, force: true }); }
import { writeFileSync } from 'node:fs';
function writeFrame(dir, i, dataUrl) { writeFileSync(join(dir, 'f' + String(i).padStart(3, '0') + '.png'), Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')); }
function require_(v, key) { if (!v) throw new Error('no canvas data for ' + key); }
