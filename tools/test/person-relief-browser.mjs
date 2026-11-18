// 写真の浮き彫りの「人物だけを立体にする」(relief-shape.js mask): the relief is built only inside the person's cut-out (her depth + a rounded puff),
// the roles swap (人物のほうを立体にする: the person-less picture stays), and without a cut-out one is made from the depth. The depth is given by the test.
//   UNFOLD_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/test/person-relief-browser.mjs [shot-dir]
import { launchBrowser } from '../lib/browser.mjs';
import { startStaticServer } from '../lib/static-server.mjs';

const shots = process.argv[2];
const server = await startStaticServer();
const browser = await launchBrowser();
const failures = [];
const need = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };
const W = 480, share = (a, test, x0 = 0, x1 = 1) => { let n = 0, all = 0; for (let i = 0; i < a.length; i += 4) { const x = ((i / 4) % W) / W; if (x < x0 || x >= x1) continue; all++; if (test(a[i], a[i + 1], a[i + 2])) n++; } return all ? n / all : 0; };
const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) n++; return n / (a.length / 4); };
const yellowish = (r, g, b) => r > 120 && g > 90 && b < 110 && r - b > 60, blueish = (r, g, b) => b > 90 && b - r > 40;
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const problems = [];
  page.on('pageerror', e => problems.push(String(e)));
  await page.goto(server.url + '/index.html');
  await page.waitForFunction(() => window.unfold && document.getElementById('relief-person'));
  // a yellow person (rounded, near) at the left third of a blue wall (far)
  await page.evaluate(async () => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('unfold-single')) localStorage.removeItem(k);
    const c = document.createElement('canvas'); c.width = 960; c.height = 540; const x = c.getContext('2d');
    x.fillStyle = '#1f4e9c'; x.fillRect(0, 0, 960, 540); x.fillStyle = '#f1c40f'; x.beginPath(); x.ellipse(250, 290, 110, 210, 0, 0, Math.PI * 2); x.fill();
    await unfold.loadImage(new File([await new Promise(r => c.toBlob(r, 'image/png'))], 'one.png', { type: 'image/png' })); await new Promise(r => setTimeout(r, 300));
    const w = 96, h = 54, data = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { const e = Math.hypot(((xx + .5) / w * 960 - 250) / 110, ((y + .5) / h * 540 - 290) / 210); data[y * w + xx] = e < 1.12 ? .55 + .35 * Math.max(0, 1 - e) : .05; }
    unfold.setReliefDepth({ w, h, data }); unfold.state.mystery = false;
    document.getElementById('add-relief').click(); for (let i = 0; i < 100 && !unfold.reliefInfo().shape; i++) await new Promise(r => setTimeout(r, 100));
  });
  const look = t => page.evaluate(async t => { unfold.setTime(t); unfold.render(); await new Promise(r => setTimeout(r, 60)); unfold.render(); const c = document.querySelector('#stage canvas') || document.querySelector('canvas'), o = document.createElement('canvas'); o.width = 480; o.height = Math.round(480 * c.height / c.width); const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, o.width, o.height); return [...x.getImageData(0, 0, o.width, o.height).data]; }, t);
  const info = () => page.evaluate(() => ({ ...unfold.reliefInfo(), personSolid: unfold.state.personSolid, cut: unfold.depthCutInfo(), row: !document.getElementById('relief-puff-row').hidden, checked: document.getElementById('relief-person').checked, status: document.getElementById('model-status').textContent }));
  const full = await info();
  need(full.shape && !full.person && !full.checked && !full.row && !full.cut.has, 'a whole-picture relief at first; the switch is off and there is no cut-out');
  const plainWhole = await look(.6), start = await look(0);
  await page.click('#relief-person');
  const on = await info();
  need(on.person && on.checked && on.row && on.personSolid, `turning it on builds the relief from the person only and swaps the roles (${on.status})`);
  need(on.cut.has && on.cut.fromDepth, 'without a cut-out, one is made from the depth');
  need(on.cells > 5000 && on.cells < full.cells, `only her cells (${on.cells} of the picture's ${full.cells})`);
  need(diff(await look(0), start) < .002, 'the picture is untouched before the change');
  const whole = await look(.6);
  need(share(whole, blueish, .55, 1) > .95, `the right of the picture (the wall) stays where it is (${(share(whole, blueish, .55, 1) * 100).toFixed(0)}% blue)`);
  need(share(whole, yellowish, 0, .5) > .12 && share(whole, yellowish, .55, 1) < .01, `the person's solid stays on her side of the picture (left ${(share(whole, yellowish, 0, .5) * 100).toFixed(0)}% yellow)`);
  if (shots) await page.locator('#stage').screenshot({ path: `${shots}/person-relief.png` });
  // ふくらみ: another value remakes the shape
  const before = on.puff;
  await page.evaluate(() => { const r = document.getElementById('relief-puff'); r.value = 90; r.dispatchEvent(new Event('input', { bubbles: true })); return new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok))); });
  const puffed = await info();
  need(puffed.person && Math.abs(puffed.puff - .9) < 1e-6 && before === .5 && puffed.status.includes('90%'), `the puff slider remakes it (${before} → ${puffed.puff})`);
  // off again: the whole picture
  await page.click('#relief-person');
  const off = await info();
  need(!off.person && !off.row && off.cells === full.cells && !off.personSolid, 'off again: the whole-picture relief comes back, and the role swap it turned on goes off with it');
  need(diff(await look(.6), plainWhole) < .01, 'and it looks as before');
  need(problems.length === 0, `no page errors (${problems.join(' | ').slice(0, 300)})`);
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('unfold-single')) localStorage.removeItem(k); });
} finally { await browser.close(); server.close(); }
if (failures.length) { console.error(`\n${failures.length} failed`); process.exit(1); }
console.log('\nall passed');
