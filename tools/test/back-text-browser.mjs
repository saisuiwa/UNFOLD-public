// 「人物の後ろの文字」(app/back-text.js): in the single-picture mode, big letters are drawn after the picture / the solid and before the cut-out person.
// Checks the panel, that the person stays in front, the three ways of showing them, every way of changing words, the loop, and that the settings are kept.
//   UNFOLD_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/test/back-text-browser.mjs [shot-dir]
import { launchBrowser } from '../lib/browser.mjs';
import { startStaticServer } from '../lib/static-server.mjs';

const shots = process.argv[2];
const server = await startStaticServer();
const browser = await launchBrowser();
const failures = [];
const need = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };
const diff = (a, b) => { let n = 0; for (let i = 0; i < a.d.length; i += 4) if (Math.abs(a.d[i] - b.d[i]) + Math.abs(a.d[i + 1] - b.d[i + 1]) + Math.abs(a.d[i + 2] - b.d[i + 2]) > 60) n++; return n / (a.d.length / 4); };
const at = (img, fx, fy) => { const i = (Math.round(fy * (img.h - 1)) * img.w + Math.round(fx * (img.w - 1))) * 4; return [img.d[i], img.d[i + 1], img.d[i + 2]]; };
const near = (c, rgb, tol = 40) => Math.abs(c[0] - rgb[0]) + Math.abs(c[1] - rgb[1]) + Math.abs(c[2] - rgb[2]) <= tol;
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const problems = [];
  page.on('pageerror', e => problems.push(String(e)));
  const open = async () => { await page.goto(server.url + '/index.html'); await page.waitForFunction(() => window.unfold && document.getElementById('bt-on')); };
  await open();
  // a made-up picture: a sky with a red "person" in the middle; and that person cut out on a smaller transparent canvas (as cut-out tools give)
  const loadPicture = () => page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 675; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 675); g.addColorStop(0, '#5fa8e0'); g.addColorStop(1, '#d8c79a'); x.fillStyle = g; x.fillRect(0, 0, 1200, 675);
    x.fillStyle = '#c0392b'; x.beginPath(); x.ellipse(600, 360, 150, 260, 0, 0, Math.PI * 2); x.fill();
    const blob = await new Promise(r => c.toBlob(r, 'image/png')); await unfold.loadImage(new File([blob], 'sky.png', { type: 'image/png' }));
    const k = document.createElement('canvas'); k.width = 340; k.height = 560; const y = k.getContext('2d');
    y.drawImage(c, 430, 90, 340, 560, 0, 0, 340, 560);
    const m = document.createElement('canvas'); m.width = 340; m.height = 560; const z = m.getContext('2d');
    z.fillStyle = '#000'; z.beginPath(); z.ellipse(170, 270, 150, 260, 0, 0, Math.PI * 2); z.fill();
    y.globalCompositeOperation = 'destination-in'; y.drawImage(m, 0, 0);
    window.__cut = await new Promise(r => k.toBlob(r, 'image/png'));
    await new Promise(r => setTimeout(r, 300));
  });
  await loadPicture();
  const look = t => page.evaluate(t => { unfold.setTime(t); unfold.render(); const c = document.getElementById('scene'), o = document.createElement('canvas'); o.width = 320; o.height = Math.round(320 * c.height / c.width); const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, o.width, o.height); return { w: o.width, h: o.height, d: [...x.getImageData(0, 0, o.width, o.height).data] }; }, t);
  const set = patch => page.evaluate(async patch => { unfold.setBackText(patch); await document.fonts.ready; await new Promise(r => setTimeout(r, 120)); unfold.render(); }, patch);
  const RED = [0xc0, 0x39, 0x2b];

  // ---- the panel
  need(await page.evaluate(() => { const s = document.getElementById('backtext-section'), p = document.getElementById('person-section'); return !!s && p.nextElementSibling === s && document.getElementById('bt-body').hidden && !document.getElementById('bt-on').checked && unfold.state.backText.enabled === false; }), 'the section sits right under 人物（切り抜き）, off and folded at first');
  const off = { a: await look(0), b: await look(.3), c: await look(.56) };
  await page.click('#bt-on');
  need(await page.evaluate(() => !document.getElementById('bt-body').hidden && unfold.state.backText.enabled === true), 'the checkbox turns it on and opens its settings');
  need(await page.evaluate(() => ['bt-mode', 'bt-trans', 'bt-font', 'bt-fill', 'bt-when', 'bt-dir'].every(id => document.getElementById(id).options.length >= 2) && document.getElementById('bt-trans').options.length === 14), 'the choices are filled in (14 ways of changing words)');
  await page.evaluate(() => { const t = document.getElementById('bt-text'); t.value = 'AB\nCD'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  need(await page.evaluate(() => unfold.state.backText.text === 'AB\nCD'), 'typing sets the words');
  need(/絵の上に出ています/.test(await page.evaluate(() => document.getElementById('bt-status').textContent)), 'without a cut-out it says the letters are on top of the picture');
  await set({ hold: 1, trans: 'cut' });
  const onB = await look(.3);
  need(diff(off.b, onB) > .08, `the letters are drawn over the picture (${(diff(off.b, onB) * 100).toFixed(1)}% of the pixels change)`);
  need(await page.evaluate(() => !document.getElementById('bt-giant-rows').hidden && document.getElementById('bt-flow-rows').hidden), '超デカ shows its own rows (切り替わり方, 1語の長さ), not the flowing ones');
  if (shots) await page.locator('#stage').screenshot({ path: `${shots}/backtext-over.png` });

  // ---- with a cut-out the person stays in front: fill the whole plane (地の濃さ 100%) and look at the person and beside her
  await page.evaluate(async () => unfold.useCutout(window.__cut));
  need(/間に出ています/.test(await page.evaluate(() => document.getElementById('bt-status').textContent)), 'with a cut-out it says the letters are between the picture and the person');
  await set({ backAlpha: 1, back: '#0000ff', color: '#00ff00' });
  for (const t of [0, .3, .56, 1]) {
    const img = await look(t);
    need(near(at(img, .5, .55), RED), `at ${t} the person is still in front of the letters and their ground (${at(img, .5, .55)})`);
    need(!near(at(img, .06, .5), at(t === .3 ? off.b : t === .56 ? off.c : off.a, .06, .5)) && (near(at(img, .06, .5), [0, 0, 255], 60) || near(at(img, .06, .5), [0, 255, 0], 60)), `at ${t} beside her it is the ground or a letter (${at(img, .06, .5)})`);
  }
  if (shots) { await look(.3); await page.locator('#stage').screenshot({ path: `${shots}/backtext-behind.png` }); }
  await set({ backAlpha: 0 });

  // ---- every way of changing words draws, half way through, something that is neither word at rest
  const timing = await page.evaluate(async () => { const m = await import('/back-text.js?v=1'); const s = unfold.state.backText, slot = m.backSlot(s, 0, unfold.state.duration); return { len: slot.len, T: slot.T, D: unfold.state.duration, kinds: Object.keys(m.BACK_TRANS), random: m.BACK_RANDOM }; });
  need(timing.kinds.length === 14 && timing.random.every(k => timing.kinds.includes(k)), 'the app and the module agree on the kinds');
  // (compared at the same moment, so the picture behind is the same: パッと替わる shows the new word at rest there)
  const mid = (timing.len * 3 + timing.T / 2) / timing.D;
  await set({ trans: 'cut' });
  const rest = await look(mid);
  need(diff(rest, await look(mid)) < .002, 'パッと替わる: the new word is simply there');
  for (const kind of timing.kinds.filter(k => k !== 'random' && k !== 'cut')) {
    await set({ trans: kind });
    const a = await look(mid);
    need(diff(a, rest) > .01, `${kind}: half way it is in between (${(diff(a, rest) * 100).toFixed(1)}% differ from the word at rest)`);
  }
  await set({ trans: 'random' });
  need(diff(await look(0), await look(1)) < .002, '超デカ, ずっと: the last frame is the first frame');

  // ---- flowing, and the wall: they move, and the clip ends where it began
  for (const mode of ['flow', 'wall']) {
    await set({ mode, speed: .2 });
    need(await page.evaluate(() => document.getElementById('bt-giant-rows').hidden && !document.getElementById('bt-flow-rows').hidden), `${mode}: the flowing rows show`);
    const a = await look(.30), b = await look(.33);
    need(diff(a, b) > .01, `${mode}: the letters move (${(diff(a, b) * 100).toFixed(1)}% differ between two moments)`);
    need(diff(await look(0), await look(1)) < .002, `${mode}: the last frame is the first frame`);
    need(near(at(await look(.3), .5, .55), RED), `${mode}: the person is in front`);
    if (shots) { await look(.3); await page.locator('#stage').screenshot({ path: `${shots}/backtext-${mode}.png` }); }
  }
  // the surfaces draw too (さびた鉄・金属・縁だけ), with a thickness
  await set({ mode: 'flow', depth: .6 });
  const solid = await look(.3);
  for (const fill of ['rust', 'metal', 'outline']) { await set({ fill }); need(diff(solid, await look(.3)) > .005, `${fill}: a different surface is drawn`); }
  need(await page.evaluate(() => document.getElementById('bt-color-row').hidden === false), 'the colour picker is back for 縁だけ');
  await set({ fill: 'rust' }); need(await page.evaluate(() => document.getElementById('bt-color-row').hidden), 'and hidden for さびた鉄 (it has its own colours)');
  if (shots) { await look(.3); await page.locator('#stage').screenshot({ path: `${shots}/backtext-rust.png` }); }

  // ---- 絵は動かさない: the picture stays whole all the way (no words here, so that only the picture is compared)
  await set({ text: '' });
  need(diff(await look(.3), off.a) > .05, 'normally the picture breaks up in the middle of the clip');
  await page.click('#bt-still');
  need(await page.evaluate(() => unfold.state.backText.still === true), 'the checkbox sets 絵は動かさない');
  need(diff(await look(.3), off.a) < .004 && diff(await look(.56), off.a) < .004 && diff(await look(.8), off.a) < .004, '絵は動かさない: the picture does not break up or become a solid');
  await set({ text: 'AB\nCD' });
  need(diff(await look(.3), await look(.33)) > .01 && near(at(await look(.3), .5, .55), RED), 'the letters still move behind the person over the still picture');
  if (shots) { await look(.3); await page.locator('#stage').screenshot({ path: `${shots}/backtext-still.png` }); }
  await page.click('#bt-still');
  need(await page.evaluate(() => unfold.state.backText.still === false), 'and it can be turned off again');

  // ---- 絵が変わっている間だけ: the two ends of the clip are the picture alone
  await set({ when: 'change', mode: 'giant', fill: 'solid', depth: 0 });
  const plain = await page.evaluate(async () => { const keep = unfold.state.backText.enabled; unfold.setBackText({ enabled: false }); return keep; });
  const bare = { a: await look(.02), z: await look(.98), m: await look(.3) };
  await set({ enabled: plain });
  need(diff(bare.a, await look(.02)) < .002 && diff(bare.z, await look(.98)) < .002, 'at the two ends there are no letters');
  need(diff(bare.m, await look(.3)) > .05, 'and in between there are');

  // ---- kept on this browser; off = nothing drawn
  await open(); await loadPicture();
  need(await page.evaluate(() => unfold.state.backText.enabled && unfold.state.backText.when === 'change' && document.getElementById('bt-on').checked && document.getElementById('bt-text').value === 'AB\nCD' && !document.getElementById('bt-body').hidden), 'after opening the page again the settings are still there');
  const again = await look(.3);
  await page.click('#bt-on');
  need(await page.evaluate(() => !unfold.state.backText.enabled && document.getElementById('bt-body').hidden), 'the checkbox turns it off');
  need(diff(again, await look(.3)) > .05 && diff(off.b, await look(.3)) < .002, 'off: the picture is drawn as it always was');
  need(problems.length === 0, `no page errors${problems.length ? ': ' + problems.join(' | ') : ''}`);
} finally {
  await browser.close(); await server.close();
}
if (failures.length) { console.log(`\n${failures.length} FAILED`); process.exit(1); }
console.log('\nALL PASSED');
