// The built-in methods 29 and up (line art that breaks into scribbles, colours that bleed): each is listed, compiles in the real shader, and visibly
// changes the picture in the middle of a change. (The shader is the only place a typo in one of them would show up.)
import assert from 'node:assert/strict';
import { startStaticServer } from '../lib/static-server.mjs';
import { launchBrowser } from '../lib/browser.mjs';
const KEYS = ['scrawl', 'tangle', 'penshake', 'linefall', 'thread', 'bleed', 'drip', 'seep'];
const server = await startStaticServer(), browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), problems = [];
  page.on('pageerror', e => problems.push(String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') problems.push(m.text().slice(0, 200)); });
  await page.goto(server.url + '/sequence.html?empty', { waitUntil: 'load' });
  await page.waitForFunction(() => window.unfoldSeq, null, { timeout: 60000 });
  const result = await page.evaluate(async KEYS => {
    // two pictures with plenty of edges
    const picture = (bg, fg) => { const c = new OffscreenCanvas(960, 540), x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 960, 540); x.fillStyle = fg;
      for (let i = 0; i < 40; i++) { x.fillRect((i * 97) % 900, (i * 53) % 480, 40 + (i * 13) % 90, 30 + (i * 29) % 80); } x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(60, 60, 840, 420); return c.convertToBlob({ type: 'image/png' }); };
    await unfoldSeq.addImageBlob(await picture('#c8452f', '#2b6cb0'), 'a.png'); await unfoldSeq.addImageBlob(await picture('#1b2a49', '#f0c24b'), 'b.png');
    const s = unfoldSeq.seq, { evaluateSequenceFrame } = await import('/sequence-core.js'), canvas = document.querySelector('#seq-canvas');
    s.bpm = 120; s.holdBeats = 2; s.recording = true;
    const grab = sec => { unfoldSeq.renderAt(sec); const c = document.createElement('canvas'); c.width = 320; c.height = 180; const x = c.getContext('2d'); x.drawImage(canvas, 0, 0, 320, 180); return x.getImageData(0, 0, 320, 180).data; };
    const diff = (p, q) => { let n = 0; for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]) > 60) n++; return n; };
    const out = {};
    for (const key of KEYS) {
      s.transitions.length = 0; s.transitions.push({ method: key, shape: 'none', flow: 'reveal', method2: '', text: '', font: 'gothic', beats: 8, viewX: 0, viewY: 0 });
      let t0 = null, t1 = 0; for (let t = 0; t < unfoldSeq.totalSeconds(); t += 1 / 30) { if (evaluateSequenceFrame(s, Math.round(t * 1e6)).transitionIndex === 0) { t0 ??= t; t1 = t; } }
      const start = grab(t0), plain = grab(Math.max(0, t0 - .6));
      const middle = grab(t0 + (t1 - t0) * .22), later = grab(t0 + (t1 - t0) * .38);
      out[key] = { fromStart: diff(start, middle), fromPlain: diff(plain, middle), changesOn: diff(middle, later), pixels: 320 * 180 };
    }
    return out;
  }, KEYS);
  for (const key of KEYS) {
    const r = result[key];
    assert.ok(r.fromStart > r.pixels * .02, `${key}: the picture changes in the middle of the change (${r.fromStart} of ${r.pixels} pixels differ from the start)`);
    assert.ok(r.changesOn > r.pixels * .005, `${key}: it keeps moving (${r.changesOn})`);
  }
  const listed = await page.evaluate(async KEYS => { const R = await import('/method-registry.js'); return KEYS.map(k => [k, R.BUILTIN_IDS[k], R.methodLabel(k)]); }, KEYS);
  assert.deepEqual(listed.map(x => x[1]), [29, 30, 31, 32, 33, 34, 35, 36]);
  assert.ok(listed.every(x => x[2] && x[2] !== x[0]), 'every one has a Japanese label');
  assert.deepEqual(problems, []);
  console.log('PASS built-in methods 29-36: listed, compile, and change the picture', JSON.stringify(Object.fromEntries(KEYS.map(k => [k, result[k].fromStart]))));
} finally { await browser.close(); await server.close(); }
