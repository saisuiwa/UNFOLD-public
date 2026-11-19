// シーケンスの◆の形「人物の立体」(app/seq-person-relief.js): only the person cut out of the picture before the ◆ becomes the solid (her shape, puffed,
// with the picture's depth when the slide has one), the picture without her stays where it is and the next picture comes in over it as they swap.
// The change starts on the first picture and ends on the next. The depth is given by the test (the real one is made in the browser by depth-auto/).
//   UNFOLD_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/test/seq-person-relief-browser.mjs [shot-dir]
import { launchBrowser } from '../lib/browser.mjs';
import { startStaticServer } from '../lib/static-server.mjs';

const shots = process.argv[2];
const server = await startStaticServer();
const browser = await launchBrowser();
const failures = [];
const need = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };
const W = 240, H = 135;
const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 40) n++; return n / (a.length / 4); };
const share = (a, test, x0 = 0, x1 = 1) => { let n = 0, all = 0; for (let i = 0; i < a.length; i += 4) { const x = ((i / 4) % W) / W; if (x < x0 || x >= x1) continue; all++; if (test(a[i], a[i + 1], a[i + 2])) n++; } return all ? n / all : 0; };
const yellow = (r, g, b) => r > 150 && g > 110 && b < 110 && r - b > 60, green = (r, g, b) => g > 120 && r < 100 && b < 130, blue = (r, g, b) => b > 80 && b - r > 30;
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const problems = [];
  page.on('pageerror', e => problems.push(String(e)));
  await page.goto(server.url + '/sequence.html?empty');
  await page.waitForFunction(() => window.unfoldSeq && document.getElementById('seq-gallery'));
  // picture 1: a striped blue wall with a yellow "person" right of the middle; picture 2: plain green; the cut-out = the yellow person alone
  await page.evaluate(async () => {
    const person = x => { x.fillStyle = '#f1c40f'; x.beginPath(); x.ellipse(620, 300, 110, 200, 0, 0, Math.PI * 2); x.fill(); };
    const a = document.createElement('canvas'); a.width = 960; a.height = 540; { const x = a.getContext('2d'); x.fillStyle = '#1f4e9c'; x.fillRect(0, 0, 960, 540); x.fillStyle = '#17386f'; for (let i = 0; i < 12; i++) x.fillRect(i * 80, 0, 40, 540); person(x); }
    const b = document.createElement('canvas'); b.width = 960; b.height = 540; { const x = b.getContext('2d'); x.fillStyle = '#27ae60'; x.fillRect(0, 0, 960, 540); }
    const c = document.createElement('canvas'); c.width = 960; c.height = 540; person(c.getContext('2d'));
    const blobOf = cv => new Promise(r => cv.toBlob(r, 'image/png'));
    await unfoldSeq.addImageBlob(await blobOf(a), 'p1'); await unfoldSeq.addImageBlob(await blobOf(b), 'p2');
    window.cutBlob = await blobOf(c);
    // a depth for picture 1 (its own size): the person near and rounded, the wall far
    const w = 96, h = 54, data = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { const e = Math.hypot(((xx + .5) / w * 960 - 620) / 110, ((y + .5) / h * 540 - 300) / 200); data[y * w + xx] = e < 1.1 ? .55 + .4 * Math.max(0, 1 - e) : .05; }
    window.depthField = { w, h, data };
    unfoldSeq.seq.transitions[0].method = 'crumple';
    await unfoldSeq.prepareShapes();
  });
  // the ◆'s times from the project itself
  const span = await page.evaluate(() => { const s = unfoldSeq.seq, b = 60 / s.bpm, start = (s.slides[0].hold ?? s.holdBeats) * b; return { start, len: s.transitions[0].beats * b, total: unfoldSeq.totalSeconds() }; });
  const at = u => span.start + span.len * u;
  const look = t => page.evaluate(t => { unfoldSeq.renderAt(t); const c = document.getElementById('seq-canvas'), o = document.createElement('canvas'); o.width = 240; o.height = 135; const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, 240, 135); return [...x.getImageData(0, 0, 240, 135).data]; }, t);
  const state = t => page.evaluate(t => { unfoldSeq.seq.t = t; unfoldSeq.renderAt(t); return unfoldSeq.personState(); }, t);
  const plainA = await look(.05), plainB = await look(span.total - .01);

  // the shape is offered among the ◆'s shapes
  await page.evaluate(() => unfoldSeq.timelineApi.select({ kind: 'tr', i: 0 }));
  const button = await page.evaluate(() => { const b = [...document.querySelectorAll('.shape-grid button')].find(b => b.textContent.includes('人物の立体')); if (b) b.click(); return !!b; });
  need(button && await page.evaluate(() => unfoldSeq.seq.transitions[0].shape === 'person' && unfoldSeq.seq.transitions[0].lateSwap === true), 'the ◆ offers 「人物の立体」 as a shape; choosing it sets it, with 「立体は前の画像のまま」 on');
  const noCut = await page.evaluate(() => ({ note: document.querySelector('[data-role="person-note"]')?.textContent ?? '', make: document.querySelector('[data-role="person-depth-make"]')?.textContent ?? '' }));
  need(noCut.note.includes('切り抜きがありません') && noCut.make.includes('切り抜きも作る'), `without a cut-out the ◆ says so and offers to make one from the depth (${noCut.make})`);
  const noStage = await state(at(.52));
  need(!noStage.stage && !noStage.shape, 'without a cut-out it is shown as the sphere (no person stage)');

  // with the cut-out: her shape only, the picture without her stays behind, then the next picture
  await page.evaluate(async () => { await unfoldSeq.setSlideCut(0, new File([window.cutBlob], 'cut.png', { type: 'image/png' })); await unfoldSeq.prepareShapes(); unfoldSeq.timelineApi.select({ kind: 'tr', i: 0 }); });
  const formed = await state(at(.52));
  need(formed.stage && formed.shape?.person && formed.shape.cells > 3000 && formed.shape.puff === 1, `with a cut-out the solid is her shape alone (${formed.shape?.cells} cells, ふくらみ only: ${formed.shape?.puff})`);
  need(formed.own && formed.whole > .9, `her solid shows her own picture, all of its colour (uWhole ${formed.whole?.toFixed(2)})`);
  need(await page.evaluate(() => document.querySelector('[data-role="person-note"]')?.textContent.includes('ふくらんだ立体')), 'the ◆ explains what it does');
  need(diff(await look(at(0)), plainA) < .01, 'the change starts on the first picture as it is');
  need(diff(await look(at(.999)), plainB) < .01 && diff(await look(span.total - .01), plainB) < .005, 'and ends on the next picture as it is');
  const solid = await look(at(.48)), late = await look(at(.62)), swapped = await look(at(.9));
  need(share(solid, blue, 0, .4) > .9, `while she is the solid, the wall stays where it is (left ${(share(solid, blue, 0, .4) * 100).toFixed(0)}% blue)`);
  need(share(solid, yellow, .45, .9) > .08 && share(late, yellow, .45, .9) > .08 && share(late, blue, 0, .4) > .9, `her solid stays her own picture on her side until it comes apart (${(share(solid, yellow, .45, .9) * 100).toFixed(0)}% → ${(share(late, yellow, .45, .9) * 100).toFixed(0)}% yellow)`);
  need(share(swapped, green, 0, .4) > .9, `after the swap the next picture is behind (left ${(share(swapped, green, 0, .4) * 100).toFixed(0)}% green)`);
  await page.evaluate(() => { const box = [...document.querySelectorAll('label')].find(l => l.textContent === '立体は前の画像のまま').parentElement.querySelector('input'); box.checked = false; box.dispatchEvent(new Event('change', { bubbles: true })); });
  const early = await look(at(.62));
  need(await page.evaluate(() => unfoldSeq.seq.transitions[0].lateSwap !== true) && share(early, green, 0, .4) > .9, `with 「立体は前の画像のまま」 off, the next picture comes in while she is the solid (left ${(share(early, green, 0, .4) * 100).toFixed(0)}% green)`);
  await page.evaluate(() => { unfoldSeq.undo(); unfoldSeq.timelineApi.select({ kind: 'tr', i: 0 }); });
  const s1 = await state(at(.47)), s2 = await state(at(.55)), hold = await state(.05);
  need(Math.abs(s1.rotation[1] - s2.rotation[1]) > .05, `the solid swings while it is formed (${s1.rotation[1].toFixed(2)} → ${s2.rotation[1].toFixed(2)} rad)`);
  need(s1.zoom >= hold.zoom * .999, `the camera is not pulled back (the background keeps filling the view: zoom ${hold.zoom.toFixed(2)} → ${s1.zoom.toFixed(2)})`);
  if (shots) for (const u of [.2, .4, .48, .55, .62, .8]) { await page.evaluate(t => unfoldSeq.renderAt(t), at(u)); await page.locator('#seq-stage').screenshot({ path: `${shots}/seq-person-${u}.png` }); }

  // the depth: kept with the picture, the shape mixes it with the ふくらみ (a slider), one Undo takes it out, saved with the project
  need(await page.evaluate(() => unfoldSeq.applySlideDepth(0, window.depthField)), 'a depth is taken for the picture');
  await page.evaluate(async () => { await unfoldSeq.prepareShapes(); unfoldSeq.timelineApi.select({ kind: 'tr', i: 0 }); });
  const deep = await state(at(.52));
  const ui = await page.evaluate(() => ({ puff: !!document.querySelector('[data-role="person-puff"]'), make: document.querySelector('[data-role="person-depth-make"]')?.textContent ?? '', note: document.querySelector('[data-role="person-note"]')?.textContent ?? '' }));
  need(deep.shape?.person && Math.abs(deep.shape.puff - .5) < 1e-6 && ui.puff && ui.make.includes('作り直す') && ui.note.includes('奥行きとふくらみ'), `with the depth the shape mixes it in (ふくらみ ${deep.shape?.puff}) and the ◆ shows the ふくらみ slider`);
  await page.evaluate(() => { const r = document.querySelector('[data-role="person-puff"]'); r.value = 20; r.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.evaluate(() => unfoldSeq.prepareShapes());
  const less = await state(at(.52));
  need(Math.abs(less.shape?.puff - .2) < 1e-6 && Math.abs(await page.evaluate(() => unfoldSeq.seq.transitions[0].puff) - .2) < 1e-6, `the slider remakes the shape (ふくらみ ${less.shape?.puff})`);
  const file = await page.evaluate(async () => { window.projectBlob = await unfoldSeq.exportProjectBlob(); return window.projectBlob.size; });
  await page.evaluate(() => { unfoldSeq.undo(); unfoldSeq.undo(); });
  need(await page.evaluate(() => !unfoldSeq.seq.slides[0].depth && !!unfoldSeq.seq.slides[0].cut), 'Undo takes the depth out again (the cut-out stays)');
  await page.evaluate(() => unfoldSeq.openProjectFile(new File([window.projectBlob], 'person.unfold')));
  await page.evaluate(() => unfoldSeq.prepareShapes());
  const back = await state(at(.52));
  need(await page.evaluate(() => !!unfoldSeq.seq.slides[0].depth && !!unfoldSeq.seq.slides[0].cut && unfoldSeq.seq.transitions[0].shape === 'person') && Math.abs(back.shape?.puff - .2) < 1e-6, `the depth, the cut-out and the shape come back from a saved project file (${file} bytes)`);

  // no cut-out but a depth: the cut-out is made from the depth
  await page.evaluate(() => { unfoldSeq.timelineApi.select({ kind: 'slide', i: 0 }); [...document.querySelectorAll('[data-role="slide-cut"] button')].find(b => b.textContent.includes('外す')).click(); });
  need(await page.evaluate(() => !unfoldSeq.seq.slides[0].cut), 'the cut-out can be taken off');
  await page.evaluate(() => unfoldSeq.applySlideDepth(0, window.depthField));
  await page.evaluate(() => unfoldSeq.prepareShapes());
  const made = await state(at(.52));
  need(await page.evaluate(() => !!unfoldSeq.seq.slides[0].cut) && made.stage && made.shape?.person, 'with no cut-out, making the depth also makes one from it, and her solid is there');
  const madeSolid = await look(at(.48));
  need(share(madeSolid, blue, 0, .4) > .9 && share(madeSolid, yellow, .45, .9) > .08, 'the cut-out from the depth finds her');

  // the gallery wall draws the pictures in their frames: no person stage there
  await page.evaluate(() => { unfoldSeq.seq.gallery.enabled = true; });
  need(!(await state(at(.52))).stage, 'on the gallery wall there is no person stage');
  await page.evaluate(() => { unfoldSeq.seq.gallery.enabled = false; });
  need(problems.length === 0, `no page errors (${problems.join(' | ').slice(0, 300)})`);
} finally { await browser.close(); server.close(); }
if (failures.length) { console.error(`\n${failures.length} failed`); process.exit(1); }
