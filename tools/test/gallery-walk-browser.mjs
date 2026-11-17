// シーケンスの「美術館を歩く」(app/gallery-walk.js): off = exactly as before; on = each picture hangs in a frame on a wall, the camera walks from
// frame to frame with the change, the frames behind keep their pictures and the ones ahead wait dark; it is saved with the project; a JavaScript
// image method's change shows the frames too.
//   UNFOLD_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/test/gallery-walk-browser.mjs [shot-dir]
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
  // three plain pictures: red, green, blue
  await page.evaluate(async () => {
    for (const [i, col] of ['#c0392b', '#27ae60', '#2980b9'].entries()) { const c = document.createElement('canvas'); c.width = 960; c.height = 540; const x = c.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, 960, 540); x.fillStyle = '#fff'; x.font = '200px sans-serif'; x.fillText(String(i + 1), 420, 340); unfoldSeq.addSlide(c, 'p' + (i + 1)); }
    await unfoldSeq.prepareShapes();
  });
  const look = t => page.evaluate(t => { unfoldSeq.renderAt(t); const c = document.getElementById('seq-canvas'), o = document.createElement('canvas'); o.width = 240; o.height = 135; const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, 240, 135); return [...x.getImageData(0, 0, 240, 135).data]; }, t);
  const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 40) n++; return n / (a.length / 4); };
  const share = (a, test) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (test(a[i], a[i + 1], a[i + 2])) n++; return n / (a.length / 4); };
  const gold = (r, g, b) => r > 120 && g > 80 && b < 110 && r - b > 60, wood = (r, g, b) => r > 70 && r < 190 && g > 35 && g < 130 && b < 90 && r - b > 35 && r > g;
  const red = (r, g, b) => r > 150 && g < 90 && b < 90, green = (r, g, b) => g > 130 && r < 90 && b < 130, blue = (r, g, b) => b > 150 && r < 90 && g > 90 && g < 170;
  const times = await page.evaluate(() => { const L = unfoldSeq.timelineApi.layout?.() ?? null; return { total: unfoldSeq.totalSeconds() }; });
  const T = times.total, at = f => f * T;
  const offHold = await look(at(.02)), offMid = await look(at(.28)), offEnd = await look(at(.99));

  await page.evaluate(() => document.querySelector('[data-tab="look"]').click());   // 04 見た目
  await page.click('#seq-gallery');
  need(await page.evaluate(() => unfoldSeq.seq.gallery.enabled && [...document.querySelectorAll('[data-gallery-row]')].every(r => !r.hidden)), 'turning it on shows its settings');
  const hold1 = await look(at(.02));
  need(share(hold1, gold) > .02 && share(hold1, red) > .25 && share(hold1, red) < share(offHold, red) - .1, `picture 1 hangs in a gold frame, smaller than the screen (${(share(hold1, gold) * 100).toFixed(1)}% gold, ${(share(hold1, red) * 100).toFixed(0)}% red)`);
  const cam = t => page.evaluate(t => { unfoldSeq.renderAt(t); return unfoldSeq.galleryState(); }, t);
  const c0 = await cam(at(.02)), cMid = await cam(at(.25)), cEnd = await cam(at(.99));
  need(Math.abs(c0.x) < 1e-6 && cMid.x > c0.x + .5 && Math.abs(cEnd.x - 2 * cMid.gap) < 1e-6, `the camera walks along the wall: ${c0.x.toFixed(2)} → ${cMid.x.toFixed(2)} → ${cEnd.x.toFixed(2)} (frames ${cMid.gap.toFixed(2)} apart)`);
  need(JSON.stringify(c0.planes) === '[0,0,0]' && JSON.stringify(cEnd.planes) === '[1,1,0]', `the frames behind keep their pictures, the ones ahead wait (${JSON.stringify(c0.planes)} → ${JSON.stringify(cEnd.planes)})`);
  const end3 = await look(at(.99));
  need(share(end3, blue) > .25 && share(end3, red) < .02, `at the end the camera is at picture 3 (${(share(end3, blue) * 100).toFixed(0)}% blue)`);
  const hold2 = await look(at(.5));
  need(share(hold2, green) > .25 && share(hold2, wood) > .01, `picture 2 hangs in the next style of frame (${(share(hold2, green) * 100).toFixed(0)}% green, ${(share(hold2, wood) * 100).toFixed(1)}% wood)`);
  if (shots) { for (const [f, name] of [[.02, 'hold'], [.25, 'fly'], [.5, 'next']]) { await page.evaluate(t => unfoldSeq.renderAt(t), at(f)); await page.locator('#seq-stage').screenshot({ path: `${shots}/gallery-${name}.png` }); } }

  // settings: one style for all, saved with the project
  await page.selectOption('#seq-gallery-style', 'black');
  need(share(await look(at(.02)), gold) < .005, 'one style for every frame can be chosen');
  await page.selectOption('#seq-gallery-style', 'mix');
  const saved = await page.evaluate(() => unfoldSeq.projectSettings().gallery);
  need(saved?.enabled === true && saved.style === 'mix', `the gallery is saved with the project (${JSON.stringify(saved)})`);

  // a JavaScript image method as the first change: the frames still show (the worker draws on a clear background)
  const shatter = await page.evaluate(() => unfoldMethods.listCustom().find(r => r.name === '爆砕と再誕')?.id);
  if (shatter) {
    await page.evaluate(async id => { unfoldSeq.seq.transitions[0].method = id; await unfoldSeq.prepareShapes(); }, shatter);
    let js = await look(at(.25)); for (let i = 0; i < 25 && share(js, gold) + share(js, wood) < .01; i++) { await page.waitForTimeout(400); js = await look(at(.25)); }
    need(share(js, gold) + share(js, wood) > .01, `the frames show during a JavaScript image method's change (${((share(js, gold) + share(js, wood)) * 100).toFixed(1)}% frame)`);
    await page.evaluate(async () => { unfoldSeq.seq.transitions[0].method = 'crumple'; await unfoldSeq.prepareShapes(); });
  }

  // 移る時の動き: ふつう (as before) by default; 立体に合わせる picks from the shape; each move changes how the solid crosses
  need(await page.evaluate(() => document.getElementById('seq-gallery-move').options.length === 7 && unfoldSeq.seq.gallery.move === 'walk'), 'the 移る時の動き menu: 7 choices, ふつう by default');
  const walkMid = await look(at(.3)), walkState = await cam(at(.3)), shape0 = await page.evaluate(() => unfoldSeq.seq.transitions[0].shape);
  await page.evaluate(async () => { unfoldSeq.seq.transitions[0].shape = 'heart'; await unfoldSeq.prepareShapes(); });
  const heartWalk = await look(at(.3));
  await page.selectOption('#seq-gallery-move', 'auto');
  const phase = await page.evaluate(t => { unfoldSeq.renderAt(t); return document.getElementById('seq-phase').textContent; }, at(.3));
  const beatAt = async t => (await cam(t)).solid;
  // the first ◆: where it starts, its beats (8 by default: one thump pair per beat) and the length of a beat
  const tl = await page.evaluate(() => { const s = unfoldSeq.seq, B = 60 / s.bpm; return { start: (s.slides[0].hold ?? s.holdBeats) * B, beats: s.transitions[0].beats, B }; });
  const onBeat = b => tl.start + b * tl.B, step = tl.beats >= 8 ? 1 : .5, mid = tl.beats / 2;
  const thumpS = (await beatAt(onBeat(mid + .04 * step)))[2], restS = (await beatAt(onBeat(mid + .6 * step)))[2];
  need(thumpS > restS * 1.12, `ハート + 立体に合わせる = ドクンドクン: a thump just after the beat (${(thumpS / restS).toFixed(2)}× the size between thumps)`);
  need(/ドクンドクン/.test(phase), `the phase line says which move it picked (${phase.trim()})`);
  need(diff(await look(at(.3)), heartWalk) > .01, 'it crosses differently from ふつう');
  await page.selectOption('#seq-gallery-move', 'zoom');
  let wind = 0, lag = 0; for (const f of [.29, .3, .31, .32]) { const g = await cam(at(f)); wind = Math.max(wind, g.wind); lag = Math.max(lag, g.solid[0] - g.x); }
  need(wind >= 4 && lag > .2, `ビューン: wind lines while it dashes (${wind}), the camera a little behind (${lag.toFixed(2)})`);
  await page.selectOption('#seq-gallery-move', 'float');
  const fl = await cam(at(.3));
  need(fl.solid[1] > 1 && fl.y > .5, `ふわふわ: up high, the camera rising with it (solid y ${fl.solid[1].toFixed(2)}, camera y ${fl.y.toFixed(2)})`);
  for (const mv of ['hop', 'swim', 'beat', 'zoom', 'float']) { await page.selectOption('#seq-gallery-move', mv); const e = await cam(onBeat(tl.beats - .01)), s0 = await cam(onBeat(.01));
    need(Math.abs(e.x - walkState.gap) < .2 && Math.abs(s0.x) < .2 && e.wind === 0 && Math.abs(e.y) < .2, `${mv}: leaves frame 1 and arrives at frame 2 as before (camera ${s0.x.toFixed(2)} → ${e.x.toFixed(2)}, frames ${walkState.gap.toFixed(2)} apart)`); }
  need((await page.evaluate(() => unfoldSeq.projectSettings().gallery.move)) === 'float', 'the move is saved with the project');
  await page.selectOption('#seq-gallery-move', 'walk');
  await page.evaluate(async s => { unfoldSeq.seq.transitions[0].shape = s; await unfoldSeq.prepareShapes(); }, shape0);
  const back = await look(at(.3));
  need(diff(back, walkMid) < .01, `ふつう again draws what it drew before (${(diff(back, walkMid) * 100).toFixed(2)}% differ)`);

  await page.click('#seq-gallery');
  need(diff(await look(at(.02)), offHold) < .01 && diff(await look(at(.28)), offMid) < .01 && diff(await look(at(.99)), offEnd) < .01, 'turning it off draws exactly what was drawn before');
  need(!problems.length, `no page errors ${problems.join(' | ')}`);
} finally {
  await browser.close(); server.close();
}
console.log(failures.length ? `${failures.length} FAILED` : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
