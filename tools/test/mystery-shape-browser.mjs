// 「絵柄を混ぜる」 in 03 立体: the same switch as 動画保存's 「絵柄を混ぜて、最後に見せる」 (both stay in step), and off = the picture sits on the
// solid as it is (no 16×16 shuffle), the whole picture at the start and the end is the same either way.
//   UNFOLD_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/test/mystery-shape-browser.mjs
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
  await page.waitForFunction(() => window.unfold && document.getElementById('mystery-shape'));
  const look = t => page.evaluate(t => { unfold.setTime(t); unfold.render(); const c = document.getElementById('scene'), o = document.createElement('canvas'); o.width = 200; o.height = 112; const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, 200, 112); return [...x.getImageData(0, 0, 200, 112).data]; }, t);
  const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 40) n++; return n / (a.length / 4); };
  const both = () => page.evaluate(() => [document.getElementById('mystery-shape').checked, document.getElementById('mystery').checked, unfold.state.mystery]);
  need(JSON.stringify(await both()) === '[true,true,true]', 'both switches start on, like the setting');
  const onFlat = await look(.02), onSolid = await look(.62), onEnd = await look(.995);
  await page.click('#mystery-shape');
  need(JSON.stringify(await both()) === '[false,false,false]', 'turning it off in 03 立体 turns off 動画保存\'s one too');
  const offSolid = await look(.62);
  need(diff(offSolid, onSolid) > .02, `off: the solid shows the picture as it is (${(diff(offSolid, onSolid) * 100).toFixed(1)}% differ)`);
  need(diff(await look(.02), onFlat) < .01 && diff(await look(.995), onEnd) < .01, 'the whole picture at the start and the end is the same either way');
  await page.evaluate(() => { const m = document.getElementById('mystery'); m.checked = true; m.dispatchEvent(new Event('change')); });
  need(JSON.stringify(await both()) === '[true,true,true]', 'turning 動画保存\'s one on turns the 03 立体 one on too');
  need(diff(await look(.62), onSolid) < .01, 'on again = the same shuffled solid');
  need(!problems.length, `no page errors ${problems.join(' | ')}`);
} finally {
  await browser.close(); server.close();
}
console.log(failures.length ? `${failures.length} FAILED` : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
