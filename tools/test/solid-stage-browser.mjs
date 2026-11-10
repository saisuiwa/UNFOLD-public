// 1枚モードの「立体の舞台」(app/solid-stage.js): off = as before; on = the whole picture is as before at the start and the end, and while it is
// a solid there is a backdrop (no plain background left) and a floor; 背景色のまま leaves the background colour; also with a JavaScript image method.
//   UNFOLD_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/test/solid-stage-browser.mjs
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
  await page.waitForFunction(() => window.unfold && window.unfoldStage && window.unfoldMethods);
  await page.evaluate(() => localStorage.removeItem('unfold-single-stage'));
  const look = t => page.evaluate(t => { unfold.setTime(t); unfold.render(); const c = document.getElementById('scene'), o = document.createElement('canvas'); o.width = 200; o.height = 112; const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, 200, 112); return [...x.getImageData(0, 0, 200, 112).data]; }, t);
  const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 40) n++; return n / (a.length / 4); };
  // the share of the corners (where only background shows around a solid) that is the plain background colour #111718
  const plainCorners = a => { let n = 0, all = 0; for (let y = 0; y < 112; y++) for (let x = 0; x < 200; x++) { if (!((x < 30 || x > 170) && (y < 25 || y > 87))) continue; all++; const i = (y * 200 + x) * 4; if (Math.abs(a[i] - 0x11) + Math.abs(a[i + 1] - 0x17) + Math.abs(a[i + 2] - 0x18) < 12) n++; } return n / all; };

  const offFlat = await look(.02), offSolid = await look(.62), offEnd = await look(.995);
  need(plainCorners(offSolid) > .8, `without the stage the corners are the plain background (${(plainCorners(offSolid) * 100).toFixed(0)}%)`);
  await page.click('#stage-on');
  need(await page.evaluate(() => unfold.state.stage.enabled && !document.getElementById('stage-body').hidden), 'turning it on shows its settings');
  const onFlat = await look(.02), onSolid = await look(.62), onEnd = await look(.995);
  need(diff(onFlat, offFlat) < .01 && diff(onEnd, offEnd) < .01, `the whole picture at the start and the end is as before (${(diff(onFlat, offFlat) * 100).toFixed(2)}% / ${(diff(onEnd, offEnd) * 100).toFixed(2)}%)`);
  need(plainCorners(onSolid) < .2, `while it is a solid, a backdrop fills the corners (${(plainCorners(onSolid) * 100).toFixed(0)}% plain left)`);
  await page.selectOption('#stage-backdrop', 'none');
  const noneSolid = await look(.62);
  need(plainCorners(noneSolid) > plainCorners(onSolid) + .2, `背景色のまま leaves the background colour behind the solid (${(plainCorners(noneSolid) * 100).toFixed(0)}% plain)`);
  await page.click('#stage-floor');
  const noFloor = await look(.62);
  need(diff(noFloor, noneSolid) > .01, 'the floor and the shadow can be turned off');
  await page.click('#stage-floor'); await page.selectOption('#stage-backdrop', 'picture');
  // めまいショット: the solid phase changes (lens and backdrop), the whole picture at the start and the end does not
  const plainMid = await look(.62);
  await page.selectOption('#stage-vertigo', 'in');
  need(await page.evaluate(() => unfold.state.stage.vertigo === 'in' && !document.getElementById('stage-vertigo-row').hidden), 'めまいショット can be chosen, and its strength shows');
  need(diff(await look(.62), plainMid) > .03, 'めまいショット changes the look while it is a solid');
  need(diff(await look(.5), await look(.7)) > .03, 'the look keeps changing across the solid (the camera is moving)');
  need(diff(await look(.02), offFlat) < .01 && diff(await look(.995), offEnd) < .01, 'with めまいショット the whole picture at the start and the end is as before');
  await page.selectOption('#stage-vertigo', 'none');
  // a JavaScript image method: the worker draws on a clear background, so the stage shows behind its solid
  const shatter = await page.evaluate(() => unfoldMethods.listCustom().find(r => r.name === '爆砕と再誕')?.id);
  if (shatter) {
    await page.locator(`[data-method="${shatter}"]`).first().click();
    let js = await look(.62); for (let i = 0; i < 20 && plainCorners(js) > .2; i++) { await page.waitForTimeout(400); js = await look(.62); }
    need(plainCorners(js) < .2, `the stage shows with a JavaScript image method too (${(plainCorners(js) * 100).toFixed(0)}% plain)`);
    await page.locator('[data-method="crumple"]').first().click();
  }
  await page.click('#stage-on');
  need(diff(await look(.62), offSolid) < .01, 'turning it off draws exactly what was drawn before');
  need(!problems.length, `no page errors ${problems.join(' | ')}`);
  await page.evaluate(() => localStorage.removeItem('unfold-single-stage'));
} finally {
  await browser.close(); server.close();
}
console.log(failures.length ? `${failures.length} FAILED` : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
