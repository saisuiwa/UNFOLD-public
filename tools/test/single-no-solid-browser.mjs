// 1枚モードの「立体化する」: shown for every method (it used to show only with JavaScript image methods and hid itself while off), off = the
// picture stays broken up and comes back without a solid; and when the GPU stops drawing, the stage says so and offers a reload.
//   UNFOLD_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/test/single-no-solid-browser.mjs
import { launchBrowser } from '../lib/browser.mjs';
import { startStaticServer } from '../lib/static-server.mjs';

const server = await startStaticServer();
const browser = await launchBrowser();
const failures = [];
const need = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const problems = [];
  page.on('pageerror', e => problems.push(String(e)));
  await page.goto(server.url + '/index.html');
  await page.waitForFunction(() => window.unfold && window.unfoldMethods && document.getElementById('image-solid'));
  const shown = () => page.evaluate(() => !document.getElementById('image-solid-control').hidden && getComputedStyle(document.getElementById('image-solid-control')).display !== 'none');
  const look = t => page.evaluate(t => { unfold.setTime(t); unfold.render(); const c = document.getElementById('scene'), o = document.createElement('canvas'); o.width = 200; o.height = 112; const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, 200, 112); return [...x.getImageData(0, 0, 200, 112).data]; }, t);
  const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) n++; return n / (a.length / 4); };
  const lit = a => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] + a[i + 1] + a[i + 2] > 120) n++; return n / (a.length / 4); };

  await page.locator('[data-method="shred"]').first().click();
  need(await shown(), '「立体化する」 shows with a GLSL method (シュレッダー)');
  const solidMid = await look(.62), solidEnd = await look(.995);
  await page.click('#image-solid');
  need(await page.evaluate(() => unfold.state.imageSolid === false), 'unticking it turns 立体化 off');
  need(await shown(), 'it stays in sight while off');
  const flatMid = await look(.62), flatEnd = await look(.995);
  need(diff(flatMid, solidMid) > .05, `off: no solid in the middle (${(diff(flatMid, solidMid) * 100).toFixed(1)}% differ)`);
  need(lit(flatMid) > .2, `off: the broken-up picture is on screen, not black (${(lit(flatMid) * 100).toFixed(0)}% lit)`);
  need(diff(flatEnd, solidEnd) < .01, `off: it comes back to the same picture (${(diff(flatEnd, solidEnd) * 100).toFixed(2)}% differ)`);
  need(await page.evaluate(() => { unfold.setTime(.62); unfold.render(); return document.getElementById('phase-badge').textContent; }) === '03 / 崩れたまま', 'the badge says 崩れたまま');
  await page.locator('[data-method="crumple"]').first().click();
  need(await shown() && await page.evaluate(() => !document.getElementById('image-solid').checked), 'changing the method keeps it in sight, still off');
  await page.locator('[data-method="shred"]').first().click();
  await page.click('#image-solid');
  const back = diff(await look(.62), solidMid);
  need(back < .01, `ticking it again brings the same solid back (${(back * 100).toFixed(2)}% differ)`);

  // the GPU stops drawing: a message and a reload button instead of a silent black stage
  await page.evaluate(() => { const gl = document.getElementById('scene').getContext('webgl2') || document.getElementById('scene').getContext('webgl'); gl.getExtension('WEBGL_lose_context').loseContext(); });
  await page.waitForTimeout(300);
  const box = await page.evaluate(() => { const b = document.getElementById('stage-error'); return { hidden: b.hidden, text: b.textContent, button: !!b.querySelector('button.stage-reload') }; });
  need(!box.hidden && /描画が止まりました/.test(box.text) && box.button, `the stage says drawing stopped and offers a reload (${box.text.slice(0, 30)}…)`);
  need(!problems.length, `no page errors ${problems.join(' | ')}`);
} finally {
  await browser.close(); server.close();
}
console.log(failures.length ? `${failures.length} FAILED` : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
