// The surface pack (焦げ穴と炎・電撃で消失 …) ships with the app: in the single-image page and in the sequence page it is in the method grid from the
// start — no blue frame, no ⚙ — it is never written to the browser's method library, and a transition that uses one exports (the image code runs).
import assert from 'node:assert/strict';
import { startStaticServer } from '../lib/static-server.mjs';
import { launchBrowser } from '../lib/browser.mjs';
const IDS = ['burn', 'ink', 'watercolor', 'frost', 'electric', 'acid', 'drip', 'weather'].map(k => `im-surface-${k}`);
const server = await startStaticServer(), browser = await launchBrowser();
try {
  const problems = [];
  const open = async (path, ready) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', e => problems.push(`${path}: ${String(e).slice(0, 200)}`));
    page.on('console', m => { if (m.type() === 'error' && !/favicon|status of 404/.test(m.text())) problems.push(`${path}: ${m.text().slice(0, 200)}`); });
    await page.goto(server.url + path, { waitUntil: 'load' });
    await page.waitForFunction(ready, null, { timeout: 60000 });
    return page;
  };
  const tiles = (page, grid, tag) => page.evaluate(({ grid, tag }) => ({
    ids: [...document.querySelectorAll(`${grid} button[data-method]`)].map(b => b.dataset.method),
    gears: document.querySelectorAll(`${grid} .tile-gear`).length,
    added: document.querySelectorAll(`${grid} button.added`).length,
    tag: document.querySelector(tag)?.textContent,
    names: Object.fromEntries([...document.querySelectorAll(`${grid} button[data-method^="im-surface"]`)].map(b => [b.dataset.method, b.textContent])),
  }), { grid, tag });

  // the single-image page
  const single = await open('/index.html', () => document.querySelectorAll('#methods button[data-method]').length >= 37);
  await single.waitForFunction(() => document.querySelector('#methods button[data-method="im-surface-burn"]'));
  const a = await tiles(single, '#methods', '#methods-tag');
  assert.deepEqual(a.ids.filter(k => k.startsWith('im-')), IDS, 'the eight tiles come right after the 37 built-in ones');
  assert.equal(a.ids.length, 45);
  assert.equal(a.tag.trim(), '45 METHODS');
  assert.equal(a.gears, 0, 'no ⚙ on a bundled tile');
  assert.equal(a.added, 0, 'no blue "added" frame');
  assert.match(a.names['im-surface-burn'], /焦げ穴と炎/);
  assert.match(a.names['im-surface-electric'], /電撃で消失/);
  assert.equal(new Set(Object.values(a.names)).size, 8);
  await single.locator('#methods button[data-method="im-surface-electric"]').click();
  await single.waitForFunction(() => window.unfold?.state?.method === 'im-surface-electric', null, { timeout: 15000 });
  assert.equal(await single.locator('#methods button[data-method="im-surface-electric"]').getAttribute('aria-pressed'), 'true');
  await single.close();

  // the sequence page
  const seq = await open('/sequence.html?empty', () => window.unfoldSeq && document.querySelector('#seq-methods button[data-method="im-surface-burn"]'));
  const b = await tiles(seq, '#seq-methods', '#seq-methods-tag');
  assert.deepEqual(b.ids.filter(k => k.startsWith('im-')), IDS);
  assert.equal(b.tag.trim(), '45 METHODS');
  assert.equal(b.gears, 0);
  // nothing of the pack was written to the library, but a user's method still is
  const stored = await seq.evaluate(async () => {
    window.unfoldMethods.registerCustom({ id: 'cm-bundled-test', name: 'テスト', vertex: 'vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }' });
    await window.unfoldMethods.persistence.flush();
    const db = await new Promise((res, rej) => { const r = indexedDB.open('unfold-method-library'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const keys = await new Promise((res, rej) => { const r = db.transaction('methods').objectStore('methods').getAllKeys(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    db.close();
    window.unfoldMethods.unregisterCustom('cm-bundled-test');
    return keys;
  });
  assert.ok(stored.includes('cm-bundled-test'), 'a user method is saved');
  assert.ok(!stored.some(k => String(k).startsWith('im-surface-')), `the bundled ones are not saved: ${stored}`);
  // a transition that uses one exports
  const size = await seq.evaluate(async () => {
    const u = window.unfoldSeq, s = u.seq;
    const pic = (bg, fg) => { const c = new OffscreenCanvas(640, 360), x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 640, 360); x.fillStyle = fg; for (let i = 0; i < 24; i++) x.fillRect((i * 71) % 560, (i * 37) % 300, 50 + (i * 13) % 70, 30 + (i * 29) % 60); return c.convertToBlob({ type: 'image/png' }); };
    await u.addImageBlob(await pic('#c8d2c0', '#2b6cb0'), 'a.png'); await u.addImageBlob(await pic('#1b2a49', '#f0c24b'), 'b.png');
    s.bpm = 120; s.holdBeats = 1; s.withAudio = false;
    s.transitions[0] = { method: 'im-surface-burn', method2: '', shape: 'none', text: '', font: 'gothic', beats: 4, viewX: 0, viewY: 0 };
    u.refreshUI(); await u.prepareShapes();
    const blob = await u.exportVideo({ fps: 10, quality: 360, look: 'std', format: 'webm', from: 0, to: 2.5 });
    return blob.size;
  });
  assert.ok(size > 5000, `the burn transition exported (${size} bytes)`);
  await seq.close();
  assert.deepEqual(problems, []);
  console.log('PASS bundled surface methods: 8 tiles in both pages (45 METHODS, no ⚙), not saved, a transition exports', JSON.stringify({ exportBytes: size }));
} finally { await browser.close(); await server.close(); }
