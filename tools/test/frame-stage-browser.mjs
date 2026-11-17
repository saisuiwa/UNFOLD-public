// 1枚モードの「額縁から飛び出す」(app/frame-stage.js): the frame shows around the picture (also with a JavaScript image method, whose worker
// then draws on a clear background), the solid grows past the frame as it forms, and a cut-out is found on the picture, sits exactly on it while
// the picture is whole and steps out as the picture breaks. Off = exactly as before.
//   UNFOLD_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/test/frame-stage-browser.mjs [shot-dir]
import { launchBrowser } from '../lib/browser.mjs';
import { startStaticServer } from '../lib/static-server.mjs';

const shots = process.argv[2];
const server = await startStaticServer();
const browser = await launchBrowser();
const failures = [];
const need = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const problems = [];
  page.on('pageerror', e => problems.push(String(e)));
  await page.goto(server.url + '/index.html');
  await page.waitForFunction(() => window.unfold && window.unfoldMethods && document.getElementById('frame-on'));
  await page.evaluate(() => { localStorage.removeItem('unfold-single-frame'); });
  // a made-up picture: a blue-green sky with a red "person" in it; and that person cut out on a smaller transparent canvas (as cut-out tools give)
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 675; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 675); g.addColorStop(0, '#5fa8e0'); g.addColorStop(1, '#d8c79a'); x.fillStyle = g; x.fillRect(0, 0, 1200, 675);
    x.fillStyle = '#c0392b'; x.beginPath(); x.ellipse(640, 360, 150, 260, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#f5d76e'; x.beginPath(); x.arc(640, 180, 70, 0, Math.PI * 2); x.fill();
    const blob = await new Promise(r => c.toBlob(r, 'image/png')); await unfold.loadImage(new File([blob], 'sky.png', { type: 'image/png' }));
    const k = document.createElement('canvas'); k.width = 340; k.height = 560; const y = k.getContext('2d');
    y.drawImage(c, 470, 90, 340, 560, 0, 0, 340, 560);
    const m = document.createElement('canvas'); m.width = 340; m.height = 560; const z = m.getContext('2d');
    z.fillStyle = '#000'; z.beginPath(); z.ellipse(170, 270, 150, 260, 0, 0, Math.PI * 2); z.fill(); z.beginPath(); z.arc(170, 90, 70, 0, Math.PI * 2); z.fill();
    y.globalCompositeOperation = 'destination-in'; y.drawImage(m, 0, 0);
    window.__cut = await new Promise(r => k.toBlob(r, 'image/png'));
  });
  const look = t => page.evaluate(t => { unfold.setTime(t); unfold.render(); const c = document.getElementById('scene'), o = document.createElement('canvas'); o.width = 320; o.height = Math.round(320 * c.height / c.width); const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, o.width, o.height); return { w: o.width, h: o.height, d: [...x.getImageData(0, 0, o.width, o.height).data] }; }, t);
  const bg = [0x11, 0x17, 0x18];
  const notBg = (img, inside = () => true) => { let n = 0; for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { if (!inside(x, y, img)) continue; const i = (y * img.w + x) * 4; if (Math.abs(img.d[i] - bg[0]) + Math.abs(img.d[i + 1] - bg[1]) + Math.abs(img.d[i + 2] - bg[2]) > 40) n++; } return n; };
  const gold = img => { let n = 0; for (let i = 0; i < img.d.length; i += 4) { const [r, g, b] = [img.d[i], img.d[i + 1], img.d[i + 2]]; if (r > 120 && g > 80 && b < 110 && r - b > 60) n++; } return n; };
  const diff = (a, b) => { let n = 0; for (let i = 0; i < a.d.length; i += 4) if (Math.abs(a.d[i] - b.d[i]) + Math.abs(a.d[i + 1] - b.d[i + 1]) + Math.abs(a.d[i + 2] - b.d[i + 2]) > 60) n++; return n / (a.d.length / 4); };
  const settle = async t => { await page.waitForTimeout(400); let last = JSON.stringify((await look(t)).d.slice(0, 4000)); for (let i = 0; i < 25; i++) { await page.waitForTimeout(350); const now = JSON.stringify((await look(t)).d.slice(0, 4000)); if (now === last) return look(t); last = now; } return look(t); };

  // off = as before
  const offFlat = await look(.02);
  need(gold(offFlat) < 400, `no frame while it is off (the yellow head counts a little) (${gold(offFlat)} gold pixels)`);
  need((await page.evaluate(() => document.getElementById('frame-body').hidden)), 'the frame settings are folded while it is off');

  await page.click('#frame-on');
  need(await page.evaluate(() => unfold.state.frameStage.enabled && !document.getElementById('frame-body').hidden), 'turning it on shows the settings');
  need(await page.evaluate(() => JSON.parse(localStorage.getItem('unfold-single-frame')).enabled === true), 'the setting is kept in this browser');
  const onFlat = await look(.02);
  need(gold(onFlat) > 1500, `the gold frame shows around the picture (${gold(onFlat)} gold pixels)`);
  // the frame's opening: the picture is smaller than the screen now, so the edges are wall
  need(notBg(onFlat, (x, y, i) => x < 6 || x > i.w - 7) < notBg(offFlat, (x, y, i) => x < 6 || x > i.w - 7) * .2, 'the picture sits inside the frame, the wall shows at the sides');
  if (shots) await page.locator('#stage').screenshot({ path: `${shots}/frame-flat.png` });

  // the solid grows past the frame: compare 0% and 100% 飛び出す大きさ at the solid
  await page.evaluate(() => { const r = document.getElementById('frame-pop'); r.value = 0; r.dispatchEvent(new Event('input')); });
  const small = await look(.62);
  await page.evaluate(() => { const r = document.getElementById('frame-pop'); r.value = 100; r.dispatchEvent(new Event('input')); });
  const big = await look(.62);
  const outside = (img) => notBg(img, (x, y, i) => y < i.h * .12 || y > i.h * .88);   // above and below the frame
  need(outside(big) > outside(small) + 200, `the solid comes out past the frame with 飛び出す大きさ (${outside(small)} → ${outside(big)} pixels beyond the frame)`);
  await page.evaluate(() => { const r = document.getElementById('frame-pop'); r.value = 40; r.dispatchEvent(new Event('input')); });
  if (shots) await page.locator('#stage').screenshot({ path: `${shots}/frame-solid.png` });

  // the cut-out: found on the picture, exactly on it while whole, out of the frame as the picture breaks
  const at = await page.evaluate(async () => unfold.useCutout(window.__cut));
  need(Math.abs(at.x - 470) <= 3 && Math.abs(at.y - 90) <= 3 && at.err < 30, `the cut-out is found where it was cut (${JSON.stringify(at)})`);
  need(await page.evaluate(() => !document.getElementById('frame-cutout-remove').hidden && /合わせました/.test(document.getElementById('frame-cutout-status').textContent)), 'the panel says it was placed, and offers 外す');
  const withCutFlat = await look(.02);
  need(diff(withCutFlat, onFlat) < .01, `while the picture is whole the person sits exactly on it (${(diff(withCutFlat, onFlat) * 100).toFixed(2)}% pixels differ)`);
  await page.click('#frame-cutout-remove');
  const noCutBreak = await look(.3);
  await page.evaluate(async () => unfold.useCutout(window.__cut));
  const cutBreak = await look(.3);
  need(diff(cutBreak, noCutBreak) > .02, `as the picture breaks the person steps out in front (${(diff(cutBreak, noCutBreak) * 100).toFixed(1)}% pixels differ)`);
  if (shots) { await page.evaluate(() => { unfold.setTime(.3); unfold.render(); }); await page.locator('#stage').screenshot({ path: `${shots}/frame-person.png` }); }

  // the person's own move: every move still lands exactly on the picture while it is whole, and the moves differ while it is out
  const moves = await page.evaluate(() => [...document.getElementById('frame-person-move').options].map(o => o.value));
  need(moves.join() === 'pop,forward,counter,nudge,float,stay', `the person's moves are listed (${moves})`);
  const outLooks = [];
  for (const move of moves) {
    await page.selectOption('#frame-person-move', move);
    need(diff(await look(.02), onFlat) < .01, `${move}: still exactly on the picture while it is whole`);
    outLooks.push(await look(.6));
  }
  need(outLooks.slice(1).every(l => diff(l, outLooks[0]) > .005), 'each move puts the person somewhere else while it is out');
  await page.click('#frame-person-dice');
  need(await page.evaluate(() => unfold.state.frameStage.personMove !== 'float'), `🎲 picks another move (${await page.evaluate(() => unfold.state.frameStage.personMove)})`);
  await page.selectOption('#frame-person-move', 'pop');

  // a JavaScript image method: its worker draws on a clear background, so the frame still shows
  const shatter = await page.evaluate(() => unfoldMethods.listCustom().find(r => r.name === '爆砕と再誕')?.id);
  need(!!shatter, '爆砕と再誕 is bundled');
  if (shatter) {
    await page.locator(`[data-method="${shatter}"]`).first().click();
    const jsFlat = await settle(.02), jsSolid = await settle(.62);
    need(gold(jsFlat) > 1500 && gold(jsSolid) > 800, `the frame shows with a JavaScript image method too (${gold(jsFlat)} / ${gold(jsSolid)} gold pixels)`);
    if (shots) await page.locator('#stage').screenshot({ path: `${shots}/frame-js.png` });
    await page.locator('[data-method="crumple"]').first().click();
  }

  // 立体を左右にずらす: the solid moves right as it forms, the whole picture is as before
  const centreX = img => { let sx = 0, n = 0; for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const i = (y * img.w + x) * 4; if (Math.abs(img.d[i] - bg[0]) + Math.abs(img.d[i + 1] - bg[1]) + Math.abs(img.d[i + 2] - bg[2]) > 40 && !(img.d[i] > 120 && img.d[i + 1] > 80 && img.d[i + 2] < 110 && img.d[i] - img.d[i + 2] > 60)) { sx += x; n++; } } return sx / Math.max(1, n) / img.w; };
  await page.click('#frame-cutout-remove');
  const midSolid = await look(.62), flatBefore = await look(.02);
  await page.evaluate(() => { const r = document.getElementById('frame-solid-x'); r.value = 80; r.dispatchEvent(new Event('input')); });
  need(await page.evaluate(() => unfold.state.frameStage.solidX === .8 && document.getElementById('frame-solid-x-value').textContent === '80%'), 'the slider sets 立体を左右にずらす');
  const midRight = await look(.62);
  need(centreX(midRight) > centreX(midSolid) + .08, `the solid moves right (${centreX(midSolid).toFixed(2)} → ${centreX(midRight).toFixed(2)})`);
  need(diff(await look(.02), flatBefore) < .01 && diff(await look(.995), await (async () => { await page.click('#frame-solid-reset'); return look(.995); })()) < .01, 'the whole picture at the start and the end is as before');
  need(await page.evaluate(() => unfold.state.frameStage.solidX === 0), '真ん中に戻す puts it back');
  await page.evaluate(async () => unfold.useCutout(window.__cut));

  // 額縁の傾き: straight while the picture is whole (the first and last frames are as before), turned while it changes
  const straightFlat = await look(.02), straightBreak = await look(.3);
  await page.selectOption('#frame-tilt', 'rightFront');
  need(await page.evaluate(() => unfold.state.frameStage.tilt === 'rightFront' && !document.getElementById('frame-tilt-amount-row').hidden), 'a tilt can be chosen, and its size shows');
  const tiltFlat = await look(.02), tiltBreak = await look(.3), tiltEnd = await look(.995), straightEnd = await (async () => { await page.selectOption('#frame-tilt', 'none'); return look(.995); })();
  need(diff(tiltFlat, straightFlat) < .01 && diff(tiltEnd, straightEnd) < .01, `with a tilt the whole picture is still straight at the start and the end (${(diff(tiltFlat, straightFlat) * 100).toFixed(2)}% / ${(diff(tiltEnd, straightEnd) * 100).toFixed(2)}% differ)`);
  need(diff(tiltBreak, straightBreak) > .05, `while it changes the frame is turned (${(diff(tiltBreak, straightBreak) * 100).toFixed(1)}% differ)`);
  await page.click('#frame-tilt-dice');
  need(await page.evaluate(() => !['none'].includes(unfold.state.frameStage.tilt)), `🎲 picks a tilt (${await page.evaluate(() => unfold.state.frameStage.tilt)})`);
  if (shots) { await page.selectOption('#frame-tilt', 'rightFront'); await page.evaluate(() => { unfold.setTime(.62); unfold.render(); }); await page.locator('#stage').screenshot({ path: `${shots}/frame-tilt.png` }); }
  await page.selectOption('#frame-tilt', 'none');

  // off again = the picture fills the screen as before
  await page.click('#frame-on');
  const offAgain = await look(.02);
  need(diff(offAgain, offFlat) < .01, `turning it off draws exactly what was drawn before (${(diff(offAgain, offFlat) * 100).toFixed(2)}% differ)`);
  // 人物（切り抜き） without the frame: the cut-out is still in (it no longer needs the frame), the person stays where she is while the
  // rest breaks, and the breaking picture carries no copy of her (the person-free background)
  need(await page.evaluate(() => !document.getElementById('frame-cutout-remove').hidden), 'the cut-out stays in with the frame off (its own section)');
  need(await page.evaluate(() => !!document.querySelector('#person-section #frame-cutout-add') && !document.getElementById('person-section').closest('#frame-body')), 'the cut-out has its own section, outside the frame settings');
  const stayFlat = await look(.02);
  need(diff(stayFlat, offFlat) < .01, `the whole picture is as before with the cut-out in (${(diff(stayFlat, offFlat) * 100).toFixed(2)}% differ)`);
  const stayBreak = await look(.3);
  await page.click('#frame-cutout-remove');
  const plainBreak = await look(.3);
  need(diff(stayBreak, plainBreak) > .02, `the person stays on screen while the picture breaks (${(diff(stayBreak, plainBreak) * 100).toFixed(1)}% differ from no cut-out)`);
  // the person stays put: the red body is still where it was in the picture (the middle of the frame, 640 of 1200)
  const redAt = img => { let sx = 0, n = 0; for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const i = (y * img.w + x) * 4; if (img.d[i] > 150 && img.d[i + 1] < 90 && img.d[i + 2] < 90) { sx += x; n++; } } return { x: sx / Math.max(1, n) / img.w, n }; };
  await page.evaluate(async () => unfold.useCutout(window.__cut));
  const r = redAt(await look(.6));
  need(r.n > 200 && Math.abs(r.x - 640 / 1200) < .05, `the person stays where she was (${r.x.toFixed(3)}, ${r.n} red pixels)`);
  // with the person-free background, the breaking picture is not red where she was; without it, it is (a copy breaks behind her)
  await page.evaluate(() => { document.getElementById('person-plate').click(); });
  const withCopy = await look(.3);
  await page.evaluate(() => { document.getElementById('person-plate').click(); });
  const noCopy = await look(.3);
  need(redAt(withCopy).n > redAt(noCopy).n, `崩れる時は、人物のいない背景で崩す: fewer red pieces behind her (${redAt(noCopy).n} vs ${redAt(withCopy).n} without it)`);
  need(diff(await look(.995), offFlat) < .01, 'the last frame is the real picture again');

  // ---- 2026-11-17: the new frames, the frame colour and the decorations
  await page.click('#frame-cutout-remove');
  await page.evaluate(() => unfold.setFrameStage({ enabled: true, style: 'gold', color: '', deco: 'none', tilt: 'none' }));
  const goldFlat = await look(.02);
  need(await page.evaluate(() => document.getElementById('frame-style').options.length === 9 && document.getElementById('frame-deco').options.length === 5), 'the menus offer 9 frames and 5 decorations');
  for (const style of ['baroque', 'neon', 'bulbs', 'polaroid', 'film']) {
    await page.evaluate(s => { const el = document.getElementById('frame-style'); el.value = s; el.dispatchEvent(new Event('change')); }, style);
    const img = await look(.02);
    need(await page.evaluate(s => unfold.state.frameStage.style === s, style) && diff(img, goldFlat) > .02, `${style}: a different frame is drawn (${(diff(img, goldFlat) * 100).toFixed(1)}% differ from the gold one)`);
    if (style === 'bulbs') { const a = await look(.0), b = await look(.0185); need(diff(a, b) > .002, `bulbs: the lights move on (${(diff(a, b) * 100).toFixed(2)}% differ a moment later)`); need(diff(a, await look(1)) < .003, 'bulbs: the clip ends with the lights as it began'); }
    if (shots) await page.locator('#stage').screenshot({ path: `${shots}/frame-${style}.png` });
  }
  await page.evaluate(() => unfold.setFrameStage({ style: 'gold' }));
  need(await page.evaluate(() => document.getElementById('frame-color').value === '#c79a3c' && document.getElementById('frame-color-reset').hidden), 'the colour picker shows the gold frame’s own colour');
  await page.evaluate(() => { const el = document.getElementById('frame-color'); el.value = '#3060d0'; el.dispatchEvent(new Event('input')); });
  const blue = await look(.02);
  need(await page.evaluate(() => unfold.state.frameStage.color === '#3060d0' && !document.getElementById('frame-color-reset').hidden) && gold(blue) < gold(goldFlat) * .3, `a colour of your own repaints the frame (${gold(goldFlat)} → ${gold(blue)} gold pixels)`);
  await page.click('#frame-color-reset');
  need(await page.evaluate(() => unfold.state.frameStage.color === '') && diff(await look(.02), goldFlat) < .003, 'and 元の色に戻す brings the gold back');
  for (const deco of ['flowers', 'tape', 'sparkle', 'petals']) {
    await page.evaluate(d => { const el = document.getElementById('frame-deco'); el.value = d; el.dispatchEvent(new Event('change')); }, deco);
    const img = await look(.02);
    need(diff(img, goldFlat) > (deco === 'sparkle' ? .001 : .003), `${deco}: the decoration is drawn over the frame (${(diff(img, goldFlat) * 100).toFixed(2)}% differ)`);
    if (deco === 'sparkle' || deco === 'petals') { need(diff(img, await look(.05)) > .001, `${deco}: it moves`); need(diff(await look(0), await look(1)) < .003, `${deco}: the last frame is the first frame`); }
    if (shots) await page.locator('#stage').screenshot({ path: `${shots}/frame-deco-${deco}.png` });
  }
  await page.evaluate(() => unfold.setFrameStage({ enabled: false }));
  need(diff(await look(.02), offFlat) < .01, 'frame off: no decoration either');
  await page.evaluate(() => unfold.setFrameStage({ deco: 'none', style: 'gold' }));
  need(!problems.length, `no page errors ${problems.join(' | ')}`);
  await page.evaluate(() => localStorage.removeItem('unfold-single-frame'));
} finally {
  await browser.close(); server.close();
}
console.log(failures.length ? `${failures.length} FAILED` : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
