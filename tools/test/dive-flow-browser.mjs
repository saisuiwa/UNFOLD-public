// シーケンスの◆の流れ方「絵の中へ飛び込む」(app/dive-stage.js): the change starts and ends on the plain pictures; in between the camera goes into the
// picture (the person's cut-out passes by, when the slide has one) and a light covers the cut to the next picture. A slide's cut-out is added with a
// button, undone with Undo, and saved with the project. In the gallery the dive goes into one frame and comes out of the next.
//   UNFOLD_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/test/dive-flow-browser.mjs [shot-dir]
import { launchBrowser } from '../lib/browser.mjs';
import { startStaticServer } from '../lib/static-server.mjs';

const shots = process.argv[2];
const server = await startStaticServer();
const browser = await launchBrowser();
const failures = [];
const need = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const problems = [];
  page.on('pageerror', e => problems.push(String(e)));
  await page.goto(server.url + '/sequence.html?empty');
  await page.waitForFunction(() => window.unfoldSeq && document.getElementById('seq-gallery'));
  // picture 1: a blue field with a yellow "person" right of the middle; picture 2: plain green; the cut-out = the yellow person alone
  await page.evaluate(async () => {
    const person = x => { x.fillStyle = '#f1c40f'; x.beginPath(); x.ellipse(620, 300, 110, 200, 0, 0, Math.PI * 2); x.fill(); };
    const a = document.createElement('canvas'); a.width = 960; a.height = 540; { const x = a.getContext('2d'); x.fillStyle = '#1f4e9c'; x.fillRect(0, 0, 960, 540); x.fillStyle = '#17386f'; for (let i = 0; i < 12; i++) x.fillRect(i * 80, 0, 40, 540); person(x); }
    const b = document.createElement('canvas'); b.width = 960; b.height = 540; { const x = b.getContext('2d'); x.fillStyle = '#27ae60'; x.fillRect(0, 0, 960, 540); }
    const c = document.createElement('canvas'); c.width = 960; c.height = 540; person(c.getContext('2d'));
    unfoldSeq.addSlide(a, 'p1'); unfoldSeq.addSlide(b, 'p2');
    window.cutBlob = await new Promise(r => c.toBlob(r, 'image/png')); window.plainBlob = await new Promise(r => b.toBlob(r, 'image/png'));
    await unfoldSeq.prepareShapes();
  });
  const look = t => page.evaluate(t => { unfoldSeq.renderAt(t); const c = document.getElementById('seq-canvas'), o = document.createElement('canvas'); o.width = 240; o.height = 135; const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, 240, 135); return [...x.getImageData(0, 0, 240, 135).data]; }, t);
  const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 40) n++; return n / (a.length / 4); };
  const share = (a, test) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (test(a[i], a[i + 1], a[i + 2])) n++; return n / (a.length / 4); };
  const yellow = (r, g, b) => r > 180 && g > 140 && b < 110, green = (r, g, b) => g > 130 && r < 90 && b < 130, white = (r, g, b) => r > 215 && g > 215 && b > 215;
  const gold = (r, g, b) => r > 120 && g > 80 && b < 110 && r - b > 60, wood = (r, g, b) => r > 70 && r < 190 && g > 35 && g < 130 && b < 90 && r - b > 35 && r > g;
  const span = { total: await page.evaluate(() => unfoldSeq.totalSeconds()) };
  // the first change, found from the pictures themselves: the first and last moment the frame is not one of the two plain pictures
  const T = span.total, plainA = await look(0), plainB = await look(T - .01);
  let t0 = null, t1 = null; for (let t = 0; t < T; t += T / 80) { const f = await look(t); if (diff(f, plainA) > .01 && diff(f, plainB) > .01) { t0 ??= t; t1 = t; } }
  need(t0 !== null && t1 > t0, `the change is found on the timeline (${t0?.toFixed(2)}–${t1?.toFixed(2)} s of ${T.toFixed(2)} s)`);
  const at = u => t0 + (t1 - t0) * u;

  // the flow is offered for a change without a solid
  await page.evaluate(() => { unfoldSeq.seq.transitions[0].shape = 'none'; unfoldSeq.timelineApi.select({ kind: 'tr', i: 0 }); });
  const offered = await page.evaluate(() => [...document.querySelectorAll('select')].some(s => [...s.options].some(o => o.value === 'dive' && o.textContent.includes('絵の中へ飛び込む'))));
  need(offered, 'a change without a solid offers 「絵の中へ飛び込む」 as a way to flow');
  await page.evaluate(() => { const s = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'dive')); s.value = 'dive'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  need(await page.evaluate(() => unfoldSeq.seq.transitions[0].flow === 'dive' && unfoldSeq.timelineApi.transitionInfo(0).label.includes('⤓')), 'choosing it sets the flow, and the ◆ shows ⤓');

  // without a cut-out: straight into the picture, the light, the next picture
  const d0 = await look(0), dEnd = await look(T - .01);
  need(diff(d0, plainA) < .005 && diff(dEnd, plainB) < .005, 'before and after the change the pictures are as they are');
  const far = await look(at(.2)), near = await look(at(.5)), lit = await look(at(.68)), after = await look(at(.95));
  need(share(near, yellow) > share(far, yellow) * 1.3, `the camera goes in: the person grows (${(share(far, yellow) * 100).toFixed(0)}% → ${(share(near, yellow) * 100).toFixed(0)}%)`);
  need(share(lit, white) > .7, `a light covers the cut to the next picture (${(share(lit, white) * 100).toFixed(0)}% white)`);
  need(share(after, green) > .6, `then the next picture is there (${(share(after, green) * 100).toFixed(0)}% green)`);

  // the cut-out: a button on the slide, placed by itself, one Undo takes it out, it is saved with the project
  await page.evaluate(() => unfoldSeq.timelineApi.select({ kind: 'slide', i: 0 }));
  need(await page.evaluate(() => !!document.querySelector('[data-role="slide-cut"] button')?.textContent.includes('人物の切り抜きを入れる')), 'a picture has a button for its person cut-out');
  await page.evaluate(() => unfoldSeq.setSlideCut(0, new File([window.plainBlob], 'plain.png', { type: 'image/png' })));
  need(await page.evaluate(() => !unfoldSeq.seq.slides[0].cut), 'a picture without clear parts is not taken as a cut-out');
  await page.evaluate(() => unfoldSeq.setSlideCut(0, new File([window.cutBlob], 'cut.png', { type: 'image/png' })));
  const cut = await page.evaluate(() => { const s = unfoldSeq.seq.slides[0], c = unfoldSeq.slideCut(s); return { has: !!s.cut, canvas: !!c, fit: s.cutFit, row: document.querySelector('[data-role="slide-cut"]')?.textContent ?? '' }; });
  need(cut.has && cut.canvas && cut.fit < 30 && cut.row.includes('入れ替える') && cut.row.includes('外す') && cut.row.includes('人物の位置に合わせました'), `the cut-out is kept with the picture and placed on the person (fit ${cut.fit?.toFixed?.(1)})`);
  need(diff(await look(0), plainA) < .005, 'with a cut-out the held picture is still as it is');
  const passing = await look(at(.5)), past = await look(at(.6));
  need(diff(passing, near) > .03, `with a cut-out the camera passes beside the person (the frame differs by ${(diff(passing, near) * 100).toFixed(0)}%)`);
  need(share(past, yellow) < share(near, yellow) * .5, `the person is behind the camera before the light (${(share(past, yellow) * 100).toFixed(0)}% yellow)`);
  if (shots) for (const u of [.1, .3, .5, .6, .68, .85]) { await page.evaluate(t => unfoldSeq.renderAt(t), at(u)); await page.locator('#seq-stage').screenshot({ path: `${shots}/dive-${u}.png` }); }
  const file = await page.evaluate(async () => { window.projectBlob = await unfoldSeq.exportProjectBlob(); return { size: window.projectBlob.size }; });
  await page.evaluate(() => unfoldSeq.undo());
  need(await page.evaluate(() => !unfoldSeq.seq.slides[0].cut && !unfoldSeq.slideCut(unfoldSeq.seq.slides[0])), 'one Undo takes the cut-out out again');
  await page.evaluate(() => unfoldSeq.openProjectFile(new File([window.projectBlob], 'dive.unfold')));
  const back = await page.evaluate(() => ({ cut: !!unfoldSeq.seq.slides[0].cut, flow: unfoldSeq.seq.transitions[0].flow, canvas: !!unfoldSeq.slideCut(unfoldSeq.seq.slides[0]) }));
  need(back.cut && back.canvas && back.flow === 'dive', `the cut-out and the flow come back from a saved project file (${JSON.stringify(back)}, ${file.size} bytes)`);
  await page.evaluate(() => unfoldSeq.prepareShapes());
  need(diff(await look(at(.5)), passing) < .03, 'the reopened project draws the same dive');

  // the gallery: into the frame it hangs in, out of the next one
  await page.evaluate(() => document.querySelector('[data-tab="look"]').click());
  await page.click('#seq-gallery');
  const g0 = await look(0), gIn = await look(at(.5)), gEnd = await look(T - .01);
  const cam = t => page.evaluate(t => { unfoldSeq.renderAt(t); return unfoldSeq.galleryState(); }, t);
  const c0 = await cam(0), cEnd = await cam(T - .01);
  need(share(g0, gold) > .02 && share(gIn, gold) + share(gIn, wood) < .01, `in the gallery the dive leaves the frame behind (${(share(g0, gold) * 100).toFixed(1)}% gold → ${((share(gIn, gold) + share(gIn, wood)) * 100).toFixed(1)}%)`);
  need(Math.abs(c0.x) < 1e-6 && Math.abs(cEnd.x - cEnd.gap) < 1e-6 && share(gEnd, green) > .25 && share(gEnd, wood) > .01, `and comes out at the next frame (camera ${c0.x.toFixed(2)} → ${cEnd.x.toFixed(2)}, ${(share(gEnd, green) * 100).toFixed(0)}% green)`);
  if (shots) for (const u of [.05, .5, .9]) { await page.evaluate(t => unfoldSeq.renderAt(t), at(u)); await page.locator('#seq-stage').screenshot({ path: `${shots}/dive-gallery-${u}.png` }); }
  need(problems.length === 0, `no page errors (${problems.join(' | ').slice(0, 300)})`);
} finally { await browser.close(); server.close(); }
if (failures.length) { console.error(`\n${failures.length} failed`); process.exit(1); }
console.log('\nall passed');
