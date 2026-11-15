// 「奥行きから切り抜きを作る」(app/depth-cutout.js): without a cut-out picture, the button makes one from the picture's depth and hands it to the same
// place as a cut-out file — so the letters of 人物の後ろの文字 pass behind what is near. The split can be moved and tilted; kept in this browser.
// The depth itself is given by the test (unfold.setReliefDepth), so no model is loaded.
//   UNFOLD_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/test/depth-cutout-browser.mjs [shot-dir]
import { launchBrowser } from '../lib/browser.mjs';
import { startStaticServer } from '../lib/static-server.mjs';

const shots = process.argv[2];
const server = await startStaticServer();
const browser = await launchBrowser();
const failures = [];
const need = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };
const share = (a, test, x0 = 0, x1 = 1) => { let n = 0, all = 0; const W = 480; for (let i = 0; i < a.length; i += 4) { const x = ((i / 4) % W) / W; if (x < x0 || x >= x1) continue; all++; if (test(a[i], a[i + 1], a[i + 2])) n++; } return all ? n / all : 0; };
const yellow = (r, g, b) => r > 190 && g > 150 && b < 110, red = (r, g, b) => r > 190 && g < 70 && b < 70;
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const problems = [];
  page.on('pageerror', e => problems.push(String(e)));
  await page.goto(server.url + '/index.html');
  await page.waitForFunction(() => window.unfold && document.getElementById('depth-cut-add'));
  // the picture: two yellow people (left and right) on a blue wall; its depth: coarse, the people near (the left one .8, the right one .6), the wall far
  const load = () => page.evaluate(async () => {
    for (const k of ['unfold-single-depthcut', 'unfold-single-backtext']) localStorage.removeItem(k);
    const c = document.createElement('canvas'); c.width = 960; c.height = 540; const x = c.getContext('2d');
    x.fillStyle = '#1f4e9c'; x.fillRect(0, 0, 960, 540); x.fillStyle = '#f1c40f'; for (const cx of [260, 700]) { x.beginPath(); x.ellipse(cx, 290, 90, 190, 0, 0, Math.PI * 2); x.fill(); }
    await unfold.loadImage(new File([await new Promise(r => c.toBlob(r, 'image/png'))], 'two.png', { type: 'image/png' })); await new Promise(r => setTimeout(r, 300));
    const w = 96, h = 54, data = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { const px = (xx + .5) / w * 960, py = (y + .5) / h * 540; let d = 0; for (const [cx, near] of [[260, .8], [700, .6]]) { const e = Math.hypot((px - cx) / 90, (py - 290) / 190); d = Math.max(d, near * Math.min(1, Math.max(0, (1.12 - e) / .24))); } data[y * w + xx] = d; }
    unfold.setReliefDepth({ w, h, data });
  });
  await load();
  const look = (t = 0) => page.evaluate(async t => { unfold.setTime(t); unfold.render(); await new Promise(r => setTimeout(r, 60)); unfold.render(); const c = document.querySelector('#stage canvas') || document.querySelector('canvas'), o = document.createElement('canvas'); o.width = 480; o.height = Math.round(480 * c.height / c.width); const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, o.width, o.height); return [...x.getImageData(0, 0, o.width, o.height).data]; }, t);
  const info = () => page.evaluate(() => ({ ...unfold.depthCutInfo(), body: !document.getElementById('depth-cut-body').hidden, status: document.getElementById('frame-cutout-status').textContent, remove: !document.getElementById('frame-cutout-remove').hidden, button: document.getElementById('depth-cut-add').textContent }));
  const first = await info();
  need(first.button.includes('奥行きから切り抜きを作る') && !first.body && !first.has, 'the button is there; its settings are folded and there is no cut-out yet');
  const plain = await look();
  // letters behind: a red plate fills the letters' layer, so everything that is not kept in front turns red
  await page.evaluate(() => unfold.setBackText({ enabled: true, mode: 'flow', text: 'DEPTH', still: true, back: '#ff0000', backAlpha: 1, color: '#ff0000' }));
  const covered = await look();
  need(share(covered, yellow) < share(plain, yellow) * .1 && share(covered, red) > .5, `without a cut-out the letters' layer covers the people (${(share(plain, yellow) * 100).toFixed(0)}% → ${(share(covered, yellow) * 100).toFixed(0)}% yellow)`);
  await page.click('#depth-cut-add');
  await page.waitForFunction(() => unfold.depthCutInfo().fromDepth, null, { timeout: 30000 });
  const made = await info();
  need(made.has && made.body && made.remove && made.status.includes('奥行きから') && !made.running, `the cut-out is made from the depth and its settings show (${made.status})`);
  const behind = await look();
  need(share(behind, yellow) > share(plain, yellow) * .85 && share(behind, red) > .4, `now the layer passes behind both people (${(share(behind, yellow) * 100).toFixed(0)}% yellow, ${(share(behind, red) * 100).toFixed(0)}% red)`);
  if (shots) await page.locator('#stage').screenshot({ path: `${shots}/depth-cut.png` });
  // the split: narrower = only the nearest (left, .8) person stays
  const slide = (id, v) => page.evaluate(([id, v]) => { const r = document.getElementById(id); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); return new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok))); }, [id, v]);
  await slide('depth-cut-range', 30);
  const narrow = await look();
  need(share(narrow, yellow, 0, .5) > share(plain, yellow, 0, .5) * .6 && share(narrow, yellow, .5, 1) < share(plain, yellow, .5, 1) * .15, `a narrower range keeps only the nearest person (left ${(share(narrow, yellow, 0, .5) * 100).toFixed(0)}%, right ${(share(narrow, yellow, .5, 1) * 100).toFixed(0)}% yellow)`);
  await slide('depth-cut-range', 5);
  need((await info()).status.includes('見つかりませんでした'), 'nothing left in front: it says so');
  await slide('depth-cut-range', 70);
  // tilt: at 50 % with a full tilt, the left person stays and the right one goes behind the split
  await slide('depth-cut-range', 50); await slide('depth-cut-tilt', 100);
  const tilted = await look(), label = await page.evaluate(() => document.getElementById('depth-cut-tilt-value').textContent);
  need(share(tilted, yellow, 0, .5) > share(plain, yellow, 0, .5) * .8 && share(tilted, yellow, .5, 1) < share(plain, yellow, .5, 1) * .15 && label.includes('右を奥あつかい'), `tilted: the left person stays in front, the letters pass in front of the right one (${label})`);
  await slide('depth-cut-tilt', -100);
  const other = await look();
  need(share(other, yellow, .5, 1) > share(plain, yellow, .5, 1) * .8, 'tilted the other way: the right person stays in front');
  await slide('depth-cut-tilt', 0); await slide('depth-cut-range', 70);
  await page.evaluate(() => document.getElementById('depth-cut-fine').click());
  await page.evaluate(() => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok))));
  const rough = await look();
  need(share(rough, yellow) > share(plain, yellow) * .8, 'without edge refining it still works');
  need(await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('unfold-single-depthcut')); return s.at === .3 && s.tilt === 0 && s.fine === false; }), 'the settings are kept in this browser');
  // while the picture breaks up, what was cut out stays where it is
  await page.evaluate(() => unfold.setBackText({ enabled: false }));
  const breaking = await look(.3);
  need(share(breaking, yellow) > share(plain, yellow) * .8, `the cut-out stays while the picture breaks up (${(share(breaking, yellow) * 100).toFixed(0)}% yellow at 30 %)`);
  // taking it out, and a new picture
  await page.click('#frame-cutout-remove');
  const gone = await info();
  need(!gone.has && !gone.fromDepth && !gone.body, 'taking it out folds the settings again');
  await page.click('#depth-cut-add'); await page.waitForFunction(() => unfold.depthCutInfo().fromDepth);
  await load();
  const fresh = await info();
  need(!fresh.has && !fresh.fromDepth && !fresh.body, 'a new picture has no cut-out');
  need(problems.length === 0, `no page errors (${problems.join(' | ').slice(0, 300)})`);
  await page.evaluate(() => { for (const k of ['unfold-single-depthcut', 'unfold-single-backtext']) localStorage.removeItem(k); });
} finally { await browser.close(); server.close(); }
if (failures.length) { console.error(`\n${failures.length} failed`); process.exit(1); }
console.log('\nall passed');
