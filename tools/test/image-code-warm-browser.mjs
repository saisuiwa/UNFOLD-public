// An image-code change (焦げ穴と炎 …) needs its worker prepared first, which takes a fraction of a second. For a quick change that was most of it: the
// fire only began about half-way through. The sequence now starts the worker while the picture before the change is still held (image-method-layer warm()).
// The check: while holding, before the change starts, a runtime already exists; it is let go again when no change follows.
import assert from 'node:assert/strict';
import { startStaticServer } from '../lib/static-server.mjs';
import { launchBrowser } from '../lib/browser.mjs';
const server = await startStaticServer(), browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), problems = [];
  page.on('pageerror', e => problems.push(String(e).slice(0, 200)));
  await page.goto(server.url + '/sequence.html?empty', { waitUntil: 'load' });
  await page.waitForFunction(() => window.unfoldSeq, null, { timeout: 60000 });
  const r = await page.evaluate(async () => {
    const u = window.unfoldSeq, s = u.seq, canvas = document.querySelector('#seq-canvas');
    const pic = (bg, fg) => { const c = new OffscreenCanvas(640, 360), x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 640, 360); x.fillStyle = fg; for (let i = 0; i < 24; i++) x.fillRect((i * 71) % 560, (i * 37) % 300, 50 + (i * 13) % 70, 30 + (i * 29) % 60); return c.convertToBlob({ type: 'image/png' }); };
    await u.addImageBlob(await pic('#c8d2c0', '#2b6cb0'), 'a.png'); await u.addImageBlob(await pic('#1b2a49', '#f0c24b'), 'b.png');
    s.bpm = 120; s.holdBeats = 6; s.withAudio = false; s.fill = true;            // 3 s of hold, then the change
    s.transitions[0] = { method: 'im-surface-burn', method2: '', shape: 'none', text: '', font: 'gothic', beats: 1, viewX: 0, viewY: 0 };
    u.refreshUI(); await u.prepareShapes();
    const runtimes = () => document.querySelectorAll('iframe[sandbox]').length;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const out = {};
    u.renderAt(0.2); await wait(150);
    out.holdStart = runtimes();                                                    // the first picture is held, the change is 2.8 s away
    u.renderAt(2.0); await wait(800); u.renderAt(2.0); await wait(200);
    out.holdBefore = runtimes();                                                   // still holding, 1 s before the change
    u.renderAt(3.25); await wait(600); u.renderAt(3.25);
    out.during = runtimes();
    u.renderAt(u.totalSeconds() - 0.2); await wait(300); u.renderAt(u.totalSeconds() - 0.2); await wait(200);
    out.after = runtimes();                                                        // holding the last picture: no change follows
    out.total = u.totalSeconds();
    return out;
  });
  console.log(JSON.stringify(r));
  assert.ok(r.holdBefore >= 1, `a runtime was started while holding, before the change (${JSON.stringify(r)})`);
  assert.equal(r.after, 0, `it is let go when no change follows (${JSON.stringify(r)})`);
  assert.deepEqual(problems, []);
  console.log('PASS image-code worker is started during the hold and released after the last change');
} finally { await browser.close(); await server.close(); }
