// 「アニメ調の立体」(app/toon-look.js): off = as before; on = the solid is shaded in two flat steps and has a line around it, only while it is whole.
// The line's width and colour can be set; width 0 leaves the cel shading alone. Kept in this browser (single picture) / saved with the project (sequence).
//   UNFOLD_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/test/toon-look-browser.mjs [shot-dir]
import { launchBrowser } from '../lib/browser.mjs';
import { startStaticServer } from '../lib/static-server.mjs';

const shots = process.argv[2];
const server = await startStaticServer();
const browser = await launchBrowser();
const failures = [];
const need = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };
const share = (a, test) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (test(a[i], a[i + 1], a[i + 2])) n++; return n / (a.length / 4); };
const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) n++; return n / (a.length / 4); };
const ink = (r, g, b) => r < 45 && g < 45 && b < 50, red = (r, g, b) => r > 170 && g < 70 && b < 70;
// a picture with no dark and no pure red in it: soft orange and blue bands
const PICTURE = `(() => { const c = document.createElement('canvas'); c.width = 960; c.height = 540; const x = c.getContext('2d'); for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? '#f0a35c' : '#7fb2e5'; x.fillRect(i * 80, 0, 80, 540); } return c; })()`;
try {
  // ---- the single picture page
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const problems = [];
  page.on('pageerror', e => problems.push(String(e)));
  await page.goto(server.url + '/index.html');
  await page.waitForFunction(() => window.unfold && document.getElementById('toon-on'));
  await page.evaluate(async picture => { localStorage.removeItem('unfold-single-toon'); const c = eval(picture); const blob = await new Promise(r => c.toBlob(r, 'image/png')); await unfold.loadImage(new File([blob], 'bands.png', { type: 'image/png' })); unfold.state.bg = '#cfd8dc'; await new Promise(r => setTimeout(r, 300)); }, PICTURE);
  const look = t => page.evaluate(async t => { unfold.setTime(t); unfold.render(); const c = document.querySelector('#stage canvas') || document.querySelector('canvas'), o = document.createElement('canvas'); o.width = 480; o.height = Math.round(480 * c.height / c.width); const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, o.width, o.height); return [...x.getImageData(0, 0, o.width, o.height).data]; }, t);
  const WHOLE = .66, LOOSE = .5, FLAT = 0;   // the solid is whole / still coming together / the picture
  const off = { whole: await look(WHOLE), loose: await look(LOOSE), flat: await look(FLAT) };
  need(share(off.whole, ink) < .001, `without the look there is no dark line (${(share(off.whole, ink) * 100).toFixed(2)}% dark)`);
  need(await page.evaluate(() => { const s = document.getElementById('toon-section'); return !!s && s.textContent.includes('アニメ調') && document.getElementById('toon-body').hidden; }), 'the section is there, its settings folded while it is off');
  await page.evaluate(() => document.getElementById('toon-on').click());
  need(await page.evaluate(() => unfold.state.toon.enabled && !document.getElementById('toon-body').hidden), 'turning it on shows its settings');
  const on = { whole: await look(WHOLE), loose: await look(LOOSE), flat: await look(FLAT) };
  need(share(on.whole, ink) > .0025, `the whole solid has a dark line around it (${(share(on.whole, ink) * 100).toFixed(2)}% dark)`);
  need(share(on.loose, ink) < .001, `no line while the pieces are still coming together (${(share(on.loose, ink) * 100).toFixed(2)}% dark)`);
  need(diff(on.flat, off.flat) < .001, 'the flat picture is untouched');
  if (shots) { await page.evaluate(t => { unfold.setTime(t); unfold.render(); }, WHOLE); await page.locator('#stage').screenshot({ path: `${shots}/toon-single.png` }); }
  // the line: colour and width
  await page.evaluate(() => { const c = document.getElementById('toon-colour'); c.value = '#ff0000'; c.dispatchEvent(new Event('input', { bubbles: true })); });
  const redLine = await look(WHOLE);
  need(share(redLine, red) > .0025 && share(redLine, ink) < .001, `the line takes the chosen colour (${(share(redLine, red) * 100).toFixed(2)}% red)`);
  await page.evaluate(() => { const r = document.getElementById('toon-line'); r.value = 100; r.dispatchEvent(new Event('input', { bubbles: true })); });
  const thick = await look(WHOLE);
  need(share(thick, red) > share(redLine, red) * 1.4, `a wider line covers more (${(share(redLine, red) * 100).toFixed(2)}% → ${(share(thick, red) * 100).toFixed(2)}%)`);
  await page.evaluate(() => { const r = document.getElementById('toon-line'); r.value = 0; r.dispatchEvent(new Event('input', { bubbles: true })); });
  const celOnly = await look(WHOLE);
  need(share(celOnly, red) < .001 && diff(celOnly, off.whole) > .03, `width 0: no line, the cel shading stays (${(diff(celOnly, off.whole) * 100).toFixed(0)}% of the frame differs from the plain solid)`);
  need(await page.evaluate(() => document.getElementById('toon-line-value').textContent === '線なし'), 'width 0 is shown as 線なし');
  await page.evaluate(() => document.getElementById('toon-cel').click());
  need(diff(await look(WHOLE), off.whole) < .002, 'no line and no cel shading = the plain solid');
  need(await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('unfold-single-toon')); return s.enabled === true && s.cel === false && s.line === 0 && s.colour === '#ff0000'; }), 'the setting is kept in this browser');
  await page.evaluate(() => document.getElementById('toon-on').click());
  need(diff(await look(WHOLE), off.whole) < .002, 'off again = as before');
  need(problems.length === 0, `single picture page: no page errors (${problems.join(' | ').slice(0, 300)})`);
  await page.evaluate(() => localStorage.removeItem('unfold-single-toon'));
  await page.close();

  // ---- the sequence
  const seq = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const seqProblems = [];
  seq.on('pageerror', e => seqProblems.push(String(e)));
  await seq.goto(server.url + '/sequence.html?empty');
  await seq.waitForFunction(() => window.unfoldSeq && document.getElementById('seq-toon'));
  await seq.evaluate(async picture => { for (let i = 0; i < 3; i++) unfoldSeq.addSlide(eval(picture), 'p' + (i + 1)); unfoldSeq.seq.bg = '#cfd8dc'; unfoldSeq.seq.transitions.forEach(t => { t.shape = 'sphere'; t.method = 'scatter'; }); await unfoldSeq.prepareShapes(); }, PICTURE);
  const seqLook = t => seq.evaluate(t => { unfoldSeq.renderAt(t); const c = document.getElementById('seq-canvas'), o = document.createElement('canvas'); o.width = 480; o.height = 270; const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, 480, 270); return [...x.getImageData(0, 0, 480, 270).data]; }, t);
  const T = await seq.evaluate(() => unfoldSeq.totalSeconds());
  await seq.evaluate(() => document.querySelector('[data-tab="look"]').click());
  need(await seq.evaluate(() => [...document.querySelectorAll('[data-toon-row]')].every(r => r.hidden)), 'sequence: the settings are folded while it is off');
  const plainFrames = []; for (let k = 0; k <= 60; k++) plainFrames.push(await seqLook(T * k / 60));
  need(plainFrames.every(f => share(f, ink) < .001), 'sequence: without the look there is no dark line anywhere');
  await seq.click('#seq-toon');
  need(await seq.evaluate(() => unfoldSeq.seq.toon.enabled && [...document.querySelectorAll('[data-toon-row]')].every(r => !r.hidden)), 'sequence: turning it on shows its settings');
  let best = 0, bestT = 0, holds = 0; for (let k = 0; k <= 60; k++) { const f = await seqLook(T * k / 60), s = share(f, ink); if (s > best) { best = s; bestT = T * k / 60; } if (s > .0015) holds++; }
  need(best > .0025 && holds >= 2 && holds < 40, `sequence: the line shows while a solid is whole and not otherwise (${(best * 100).toFixed(2)}% dark at ${bestT.toFixed(2)} s, in ${holds} of 61 moments)`);
  need(diff(await seqLook(0), plainFrames[0]) < .001, 'sequence: a held picture is untouched');
  if (shots) { await seq.evaluate(t => unfoldSeq.renderAt(t), bestT); await seq.locator('#seq-stage').screenshot({ path: `${shots}/toon-sequence.png` }); }
  const lined = await seqLook(bestT);
  await seq.click('#seq-toon-beat');
  let flashed = 0; for (let k = -6; k <= 6; k++) { const f = await seqLook(bestT + k * .05); if (share(f, ink) < share(lined, ink) * .5 && diff(f, plainFrames[0]) > .01) flashed++; }
  need(flashed > 0, `sequence: with 拍で光る the line leaves its dark colour around the beat (${flashed} of 13 moments)`);
  const saved = await seq.evaluate(() => unfoldSeq.projectSettings().toon);
  need(saved?.enabled === true && saved.beat === true && saved.cel === true, `sequence: saved with the project (${JSON.stringify(saved)})`);
  // together with the gallery and a dive: nothing breaks
  await seq.evaluate(async () => { unfoldSeq.seq.transitions[1].shape = 'none'; unfoldSeq.seq.transitions[1].flow = 'dive'; await unfoldSeq.prepareShapes(); });
  await seq.click('#seq-gallery');
  for (let k = 0; k <= 30; k++) await seqLook(T * k / 30);
  need(seqProblems.length === 0, `sequence: no page errors, also with the gallery and a dive (${seqProblems.join(' | ').slice(0, 300)})`);
} finally { await browser.close(); server.close(); }
if (failures.length) { console.error(`\n${failures.length} failed`); process.exit(1); }
console.log('\nall passed');
