// 「写真の浮き彫り」(app/relief-shape.js + depth-auto/): the 03 立体 tab button makes a solid from the picture's depth, the near things come forward, the amount slider
// changes it in place, and a new picture drops it. The depth is made in the browser by a real model when UNFOLD_DEPTH_MODEL_DIR holds it (otherwise that part is skipped):
//   UNFOLD_DEPTH_MODEL_DIR=<folder with onnx-community/depth-anything-v2-small/resolve/main/{config.json,preprocessor_config.json,onnx/model_quantized.onnx}>
//   UNFOLD_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/test/relief-browser.mjs [shot-dir]
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { launchBrowser } from '../lib/browser.mjs';
import { startStaticServer } from '../lib/static-server.mjs';

const shots = process.argv[2];
const MODEL_DIR = process.env.UNFOLD_DEPTH_MODEL_DIR || '';
const server = await startStaticServer();
const browser = await launchBrowser();
const failures = [];
const need = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };
const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) n++; return n / (a.length / 4); };
// a picture of vertical colour bands with a white disc in the middle (so that a wrongly placed solid shows as a different picture)
const PICTURE = `(() => { const c = document.createElement('canvas'); c.width = 960; c.height = 540; const x = c.getContext('2d'); for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? '#f0a35c' : '#3a7bd5'; x.fillRect(i * 80, 0, 80, 540); } x.fillStyle = '#fff'; x.beginPath(); x.arc(520, 270, 120, 0, 7); x.fill(); return c; })()`;
let modelHost = null, modelServer = null, modelRequests = 0;
if (MODEL_DIR) {
  modelServer = createServer((req, res) => {
    modelRequests++;
    const f = MODEL_DIR + decodeURIComponent(req.url.split('?')[0]);
    try { const s = statSync(f); res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Length': s.size, 'Content-Type': 'application/octet-stream' }); createReadStream(f).pipe(res); }
    catch { res.writeHead(404, { 'Access-Control-Allow-Origin': '*' }); res.end(); }
  });
  await new Promise(r => modelServer.listen(0, '127.0.0.1', r));
  modelHost = `http://127.0.0.1:${modelServer.address().port}/`;
}
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const problems = [];
  page.on('pageerror', e => problems.push(String(e)));
  let confirms = 0;
  page.on('dialog', d => { confirms++; d.accept(); });
  await page.goto(server.url + '/index.html');
  await page.waitForFunction(() => window.unfold && document.getElementById('add-relief'));
  const load = () => page.evaluate(async picture => { const c = eval(picture); const blob = await new Promise(r => c.toBlob(r, 'image/png')); await unfold.loadImage(new File([blob], 'bands.png', { type: 'image/png' })); unfold.state.bg = '#cfd8dc'; await new Promise(r => setTimeout(r, 300)); }, PICTURE);
  await load();
  const look = t => page.evaluate(async t => { unfold.setTime(t); unfold.render(); const c = document.querySelector('#stage canvas') || document.querySelector('canvas'), o = document.createElement('canvas'); o.width = 480; o.height = Math.round(480 * c.height / c.width); const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, o.width, o.height); return [...x.getImageData(0, 0, o.width, o.height).data]; }, t);
  const info = () => page.evaluate(() => unfold.reliefInfo());
  const setRange = (id, v) => page.evaluate(([id, v]) => { const s = document.getElementById(id); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]);

  need(await page.evaluate(() => { const b = document.getElementById('add-relief'); return !!b && b.offsetParent !== null && document.getElementById('relief-body').hidden; }), 'the button is on the page and the amount slider is folded until there is a relief');
  need((await info()).shape === false, 'no relief shape yet');

  // ---- a known depth (a near disc where the white disc is, far elsewhere): the solid sits exactly on the picture
  const W = 96, H = 54, depth = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) depth[y * W + x] = Math.hypot(x - 52, y - 27) < 12 ? 1 : 0;
  await page.evaluate(([w, h, d]) => unfold.setReliefDepth({ w, h, data: Float32Array.from(d) }), [W, H, [...depth]]);
  await page.evaluate(() => document.getElementById('add-relief').click());
  await page.waitForFunction(() => unfold.reliefInfo().shape, null, { timeout: 30000 });
  need(confirms === 0, 'with the depth already made it does not ask (nothing to download)');
  need(await page.evaluate(() => { const b = document.querySelector('#imported-shapes [data-shape="relief"]'); return !!b && b.textContent.includes('写真の浮き彫り') && b.textContent.includes('浮き彫り') && b.getAttribute('aria-pressed') === 'true' && unfold.state.shape === 'relief'; }), 'the shape is added to the list and chosen');
  need(await page.evaluate(() => !document.getElementById('relief-body').hidden), 'the amount slider shows');
  // face the camera straight on (the shapes turn a little by default; the swing is off here) and compare the solid with the picture
  await page.evaluate(() => { unfold.state.viewY = -.12; unfold.state.viewX = .06; for (const id of ['relief-swing', 'relief-tilt']) { const s = document.getElementById(id); s.value = 0; s.dispatchEvent(new Event('input', { bubbles: true })); } });
  const SOLID = await page.evaluate(() => unfold.state.t);
  const flat = await look(0), solid = await look(SOLID);
  need(diff(flat, solid) < .04, `seen from the front the relief is the picture itself (${(diff(flat, solid) * 100).toFixed(2)}% of the pixels differ)`);
  if (shots) { await page.evaluate(t => { unfold.setTime(t); unfold.render(); }, SOLID); await page.locator('#stage').screenshot({ path: `${shots}/relief-front.png` }); }
  // a little to the side the near disc moves against the bands
  await page.evaluate(() => { unfold.state.viewY = .25; });
  const side = await look(SOLID);
  need(diff(solid, side) > .01, `turned a little, the disc comes forward and the picture changes (${(diff(solid, side) * 100).toFixed(2)}% differ)`);
  if (shots) { await page.evaluate(t => { unfold.setTime(t); unfold.render(); }, SOLID); await page.locator('#stage').screenshot({ path: `${shots}/relief-side.png` }); }
  // the swing: while the solid is whole it turns slowly one way and the other (the picture changes); the slider can stop it
  const at = w => page.evaluate(async w => { const m = await import('/motion.js?v=35'); return m.chaosTime(w, unfold.state.chaosLength, unfold.state.solidLength); }, w);
  const tA = await at(.525), tB = await at(.675);
  await page.evaluate(() => { unfold.state.viewY = -.12; unfold.state.viewX = .06; const s = document.getElementById('relief-swing'); s.value = 60; s.dispatchEvent(new Event('input', { bubbles: true })); });
  const right2 = await look(tA), left2 = await look(tB);
  need(diff(right2, left2) > .02, `the two ends of the swing look different (${(diff(right2, left2) * 100).toFixed(2)}% differ)`);
  if (shots) { await page.evaluate(t => { unfold.setTime(t); unfold.render(); }, tA); await page.locator('#stage').screenshot({ path: `${shots}/relief-swing-right.png` }); await page.evaluate(t => { unfold.setTime(t); unfold.render(); }, tB); await page.locator('#stage').screenshot({ path: `${shots}/relief-swing-left.png` }); }
  await page.evaluate(() => { const s = document.getElementById('relief-swing'); s.value = 0; s.dispatchEvent(new Event('input', { bubbles: true })); });
  const tC = await at(.57), tD = await at(.64);   // both fully formed (the solid is still settling at .525)
  need(await page.evaluate(() => document.getElementById('relief-swing-value').textContent) === 'OFF' && diff(await look(tC), await look(tD)) < .002, 'swing OFF keeps it still');
  // the tilt (up and down): the same time window, a quarter turn behind; the middle of the swing is where it leans most
  const t60 = await at(.60);
  await setRange('relief-tilt', 100);
  const nod = await look(t60);
  need(await page.evaluate(() => document.getElementById('relief-tilt-value').textContent) === '100%' && Math.abs(await page.evaluate(() => unfold.state.reliefTilt) - 1) < 1e-9, 'the tilt slider sets the tilt');
  await setRange('relief-tilt', 0);
  const level = await look(t60);
  need(diff(nod, level) > .02, `leaning up and down changes the picture (${(diff(nod, level) * 100).toFixed(2)}% differ)`);
  need(await page.evaluate(() => document.getElementById('relief-tilt-value').textContent) === 'OFF' && diff(await look(tC), await look(tD)) < .002, 'tilt OFF keeps it still too');
  await setRange('relief-tilt', 100);
  if (shots) { await page.evaluate(t => { unfold.setTime(t); unfold.render(); }, t60); await page.locator('#stage').screenshot({ path: `${shots}/relief-tilt-mid.png` }); }
  await setRange('relief-tilt', 0);
  await page.evaluate(() => { unfold.state.viewY = .25; });
  // the amount: in place, no rebuild
  await page.evaluate(() => { const s = document.getElementById('relief-amount'); s.value = 50; s.dispatchEvent(new Event('input', { bubbles: true })); });
  need((await info()).amount === .5 && await page.evaluate(() => document.getElementById('relief-amount-value').textContent) === '50%', 'the slider sets the amount to half');
  const half = await look(SOLID);
  need(diff(side, half) > .002, `half the amount draws a different picture from the side (${(diff(side, half) * 100).toFixed(2)}% differ)`);
  await page.evaluate(() => { const s = document.getElementById('relief-amount'); s.value = 100; s.dispatchEvent(new Event('input', { bubbles: true })); });
  need(diff(side, await look(SOLID)) < .0005, 'back to 100% it is as before');
  // pressing it again replaces the shape instead of adding a second one
  await page.evaluate(() => document.getElementById('add-relief').click());
  await page.waitForTimeout(400);
  need(await page.evaluate(() => document.querySelectorAll('#imported-shapes [data-shape="relief"]').length) === 1, 'a second press keeps one relief shape');
  // a new picture drops the relief and its depth
  await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 640; c.height = 640; c.getContext('2d').fillRect(0, 0, 640, 640); const blob = await new Promise(r => c.toBlob(r, 'image/png')); await unfold.loadImage(new File([blob], 'other.png', { type: 'image/png' })); await new Promise(r => setTimeout(r, 300)); });
  const after = await info();
  need(!after.shape && !after.depth && await page.evaluate(() => !document.querySelector('#imported-shapes [data-shape="relief"]') && unfold.state.shape !== 'relief' && document.getElementById('relief-body').hidden), 'a new picture drops the relief, its depth and the slider');

  // ---- the real model, in the browser worker (only when it is on this machine)
  if (modelHost) {
    await load();
    await page.evaluate(h => unfold.setReliefHost(h), modelHost);
    const t0 = Date.now();
    await page.evaluate(() => document.getElementById('add-relief').click());
    await page.waitForFunction(() => /読み込んでいます|推定しています/.test(document.getElementById('model-status').textContent) || unfold.reliefInfo().shape, null, { timeout: 30000 });
    need(confirms === 1, 'the first time (model not on this browser yet) it asks before downloading');
    need(await page.evaluate(() => unfold.reliefInfo().running || unfold.reliefInfo().shape), 'it runs in the background (the page stays usable)');
    await page.waitForFunction(() => unfold.reliefInfo().shape, null, { timeout: 120000 });
    console.log(`  the model ran in ${((Date.now() - t0) / 1000).toFixed(1)} s (${modelRequests} requests to the model host)`);
    const got = await info();
    need(got.shape && got.depth && got.amount === 1 && !got.running, 'the depth came back and became a relief shape');
    need(/浮き彫りを作りました/.test(await page.evaluate(() => document.getElementById('model-status').textContent)), 'the status says it is done');
    const before = modelRequests;
    await page.evaluate(() => { const b = document.querySelector('#imported-shapes [data-shape="relief"]'); document.getElementById('remove-model').click(); });
    await page.evaluate(() => document.getElementById('add-relief').click());
    await page.waitForFunction(() => unfold.reliefInfo().shape, null, { timeout: 30000 });
    need(modelRequests === before && confirms === 1, 'making it again for the same picture does not run the model or ask again');
    // stop in the middle: the model is cached by now, so make the picture new (depth gone) and press, then press again at once
    await load();
    await page.evaluate(() => document.getElementById('add-relief').click());
    await page.waitForTimeout(150);
    await page.evaluate(() => document.getElementById('add-relief').click());
    await page.waitForFunction(() => !unfold.reliefInfo().running, null, { timeout: 30000 });
    await page.waitForTimeout(300);
    const stopped = await info();
    need(!stopped.running && (stopped.shape === false || stopped.shape === true), 'pressing it again while it runs stops it cleanly (no stuck button)');
    need(await page.evaluate(() => document.getElementById('add-relief').textContent.includes('写真の奥行き') && !('busy' in document.getElementById('add-relief').dataset)), 'the button is back to its first label');
  } else console.log('SKIP the real-model part (set UNFOLD_DEPTH_MODEL_DIR)');
  need(problems.length === 0, `no page errors${problems.length ? ': ' + problems.join(' | ') : ''}`);
} finally {
  await browser.close(); await server.close(); modelServer?.close();
}
if (failures.length) { console.log(`\n${failures.length} FAILED`); process.exit(1); }
console.log('\nALL PASSED');
