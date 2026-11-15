// 「人物のほうを立体にする」(app/person-solid.js): with a cut-out, the roles can be swapped — the cut-out person breaks up and becomes the solid
// (whole: its gaps are filled with her own colours), the picture without her stays behind as it is, and the letters of 人物の後ろの文字 sit between the two.
//   UNFOLD_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/test/person-solid-browser.mjs [shot-dir]
import { launchBrowser } from '../lib/browser.mjs';
import { startStaticServer } from '../lib/static-server.mjs';

const shots = process.argv[2];
const server = await startStaticServer();
const browser = await launchBrowser();
const failures = [];
const need = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };
const W = 480;
// share of the pixels in a box (x0..x1, y0..y1 as parts of the frame) that pass the test
const share = (a, test, x0 = 0, x1 = 1, y0 = 0, y1 = 1) => { const H = a.length / 4 / W; let n = 0, all = 0; for (let i = 0; i < a.length; i += 4) { const p = i / 4, x = (p % W) / W, y = Math.floor(p / W) / H; if (x < x0 || x >= x1 || y < y0 || y >= y1) continue; all++; if (test(a[i], a[i + 1], a[i + 2])) n++; } return all ? n / all : 0; };
const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) n++; return n / (a.length / 4); };
const yellowish = (r, g, b) => r > 120 && g > 90 && b < 110 && r - b > 60, blueish = (r, g, b) => b > 90 && b - r > 40, red = (r, g, b) => r > 190 && g < 70 && b < 70;
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const problems = [];
  page.on('pageerror', e => problems.push(String(e)));
  await page.goto(server.url + '/index.html');
  await page.waitForFunction(() => window.unfold && document.getElementById('person-solid'));
  // a yellow person at the far left of a blue wall; its depth says she is near
  await page.evaluate(async () => {
    for (const k of ['unfold-single-depthcut', 'unfold-single-backtext', 'unfold-single-person-solid']) localStorage.removeItem(k);
    unfold.setPersonSolid(false); unfold.setBackText({ enabled: false });
    const c = document.createElement('canvas'); c.width = 960; c.height = 540; const x = c.getContext('2d');
    x.fillStyle = '#1f4e9c'; x.fillRect(0, 0, 960, 540); x.fillStyle = '#f1c40f'; x.beginPath(); x.ellipse(110, 290, 80, 200, 0, 0, Math.PI * 2); x.fill();
    await unfold.loadImage(new File([await new Promise(r => c.toBlob(r, 'image/png'))], 'one.png', { type: 'image/png' })); await new Promise(r => setTimeout(r, 300));
    const w = 96, h = 54, data = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { const e = Math.hypot(((xx + .5) / w * 960 - 110) / 80, ((y + .5) / h * 540 - 290) / 200); data[y * w + xx] = .8 * Math.min(1, Math.max(0, (1.12 - e) / .24)); }
    unfold.setReliefDepth({ w, h, data });
    await unfold.addDepthCut();
  });
  need(await page.evaluate(() => unfold.depthCutInfo().has && !document.getElementById('person-solid').checked), 'a cut-out is in, and the switch is off at first');
  const look = t => page.evaluate(async t => { unfold.setTime(t); unfold.render(); await new Promise(r => setTimeout(r, 60)); unfold.render(); const c = document.querySelector('#stage canvas') || document.querySelector('canvas'), o = document.createElement('canvas'); o.width = 480; o.height = Math.round(480 * c.height / c.width); const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, o.width, o.height); return [...x.getImageData(0, 0, o.width, o.height).data]; }, t);
  const WHOLE = .66, LEFT = [0, .2], MID = [.42, .58, .3, .7];
  const off = { start: await look(0), solid: await look(WHOLE), end: await look(1) };
  need(share(off.solid, yellowish, ...LEFT) > .25 && share(off.solid, yellowish, ...MID) < .1, `off: she stays in her place and the solid is made of the wall (left ${(share(off.solid, yellowish, ...LEFT) * 100).toFixed(0)}% yellow, middle ${(share(off.solid, yellowish, ...MID) * 100).toFixed(0)}%)`);
  await page.evaluate(() => document.getElementById('person-solid').click());
  need(await page.evaluate(() => unfold.state.personSolid && document.getElementById('person-plate').disabled && localStorage.getItem('unfold-single-person-solid') === '1'), 'on: kept in this browser; the other switch (which picture breaks up) is set aside');
  const on = { start: await look(0), breaking: await look(.3), solid: await look(WHOLE), end: await look(1) };
  need(diff(on.start, off.start) < .002 && diff(on.end, off.end) < .002, 'the whole picture at the start and at the end is as before');
  need(share(on.solid, yellowish, ...LEFT) < .03 && share(on.solid, blueish, ...LEFT) > .9, `on: she has left her place, the wall is whole there (left ${(share(on.solid, yellowish, ...LEFT) * 100).toFixed(0)}% yellow, ${(share(on.solid, blueish, ...LEFT) * 100).toFixed(0)}% blue)`);
  need(share(on.solid, yellowish, ...MID) > .9, `the solid is made of her, with no holes (middle ${(share(on.solid, yellowish, ...MID) * 100).toFixed(0)}% yellow)`);
  need(share(on.solid, blueish, .8, 1) > .9 && share(on.solid, blueish, 0, 1, 0, .08) > .7, 'the wall stays where it is, all round the solid');
  need(share(on.breaking, blueish) > .6 && share(on.breaking, yellowish) > .01 && share(on.breaking, yellowish) < .3, `while breaking up, only her own pieces fly over the still wall (${(share(on.breaking, yellowish) * 100).toFixed(0)}% yellow, ${(share(on.breaking, blueish) * 100).toFixed(0)}% blue)`);
  if (shots) { await look(WHOLE); await page.locator('#stage').screenshot({ path: `${shots}/person-solid.png` }); }
  // the letters: between the still wall and her solid
  await page.evaluate(() => unfold.setBackText({ enabled: true, mode: 'flow', text: 'SOLID', back: '#ff0000', backAlpha: 1, color: '#ff0000' }));
  const lettered = await look(WHOLE);
  need(share(lettered, red, .8, 1) > .9 && share(lettered, yellowish, ...MID) > .9, `the letters' layer covers the wall and is behind her solid (edge ${(share(lettered, red, .8, 1) * 100).toFixed(0)}% red, middle ${(share(lettered, yellowish, ...MID) * 100).toFixed(0)}% yellow)`);
  await page.evaluate(() => unfold.setBackText({ depthMove: 'time' }));
  need(await page.evaluate(() => document.getElementById('bt-status').textContent.includes('人物のほうを立体にする')), '奥行きの動き is not used meanwhile, and the status says so');
  await page.evaluate(() => unfold.setBackText({ enabled: false, depthMove: 'none' }));
  // a frame: the wall stays in the frame, her solid comes out of it
  await page.evaluate(() => unfold.setFrameStage({ enabled: true }));
  const framed = await look(WHOLE);
  if (shots) await page.locator('#stage').screenshot({ path: `${shots}/person-solid-framed.png` });
  need(share(framed, yellowish, ...MID) > .9 && share(framed, blueish) > .06 && share(framed, blueish, 0, .12) < .02, `in a frame too: her solid in front, the wall in the frame behind it (${(share(framed, blueish) * 100).toFixed(0)}% blue, none outside the frame)`);
  await page.evaluate(() => unfold.setFrameStage({ enabled: false }));
  // off again, and without a cut-out the switch changes nothing
  await page.evaluate(() => document.getElementById('person-solid').click());
  need(diff(await look(WHOLE), off.solid) < .01, 'off again = as before');
  await page.evaluate(() => { document.getElementById('person-solid').click(); document.getElementById('frame-cutout-remove').click(); });
  const bare = await look(WHOLE);
  await page.evaluate(() => document.getElementById('person-solid').click());
  need(diff(await look(WHOLE), bare) < .002, 'without a cut-out the switch changes nothing');
  need(problems.length === 0, `no page errors (${problems.join(' | ').slice(0, 300)})`);
  await page.evaluate(() => { for (const k of ['unfold-single-depthcut', 'unfold-single-backtext', 'unfold-single-person-solid']) localStorage.removeItem(k); });
} finally { await browser.close(); server.close(); }
if (failures.length) { console.error(`\n${failures.length} failed`); process.exit(1); }
console.log('\nall passed');
