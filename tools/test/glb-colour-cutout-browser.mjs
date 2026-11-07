// 「GLBの色」 100 % with a cut-out (transparent) picture: the solid must be whole. The GLB's colour is opaque, so the picture's
// transparent parts must not punch holes in it (they did until 2026-11-07). The solid from a transparent picture must cover the same
// pixels as from the same picture on an opaque background.
//   UNFOLD_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/test/glb-colour-cutout-browser.mjs
// Needs the git-ignored models/tripo-publish-color folder (skips without it).
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from '../lib/browser.mjs';
import { startStaticServer } from '../lib/static-server.mjs';
const GLB = fileURLToPath(new URL('../../models/tripo-publish-color/person/swordswoman.glb', import.meta.url));
if (!existsSync(GLB)) { console.log('SKIP: models/tripo-publish-color not here'); process.exit(0); }
const glb = readFileSync(GLB).toString('base64');
const server = await startStaticServer(); const browser = await launchBrowser();
const results = {}, errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(server.url + '/index.html');
  await page.evaluate(async g => { const lib = await import('/model-library.js?v=5'); for (const m of await lib.listModels()) await lib.deleteModel(m.id); const buf = Uint8Array.from(atob(g), c => c.charCodeAt(0)).buffer; await lib.saveModel('刀を構える女性', buf, 1, '', '人物'); }, glb);
  await page.reload(); await page.waitForFunction(() => window.unfold && document.querySelector('#imported-shapes button'), null, { timeout: 30000 });
  await page.click('#imported-shapes button');
  await page.waitForFunction(() => /読み込みました/.test(document.getElementById('model-status').textContent), null, { timeout: 60000 });
  for (const bg of ['transparent', 'opaque']) {
    const png = await page.evaluate(async bg => {
      const c = document.createElement('canvas'); c.width = 755; c.height = 1184; const x = c.getContext('2d');
      if (bg === 'opaque') { x.fillStyle = '#cfcfcf'; x.fillRect(0, 0, 755, 1184); }
      x.fillStyle = '#e8e0d0'; x.beginPath(); x.ellipse(380, 300, 120, 180, 0, 0, 7); x.fill();
      x.fillStyle = '#23263f'; x.beginPath(); x.moveTo(250, 500); x.lineTo(520, 500); x.lineTo(700, 1150); x.lineTo(100, 1150); x.fill();
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      await unfold.loadImage(new File([blob], bg + '.png', { type: 'image/png' }));
      await new Promise(r => setTimeout(r, 400));
      unfold.setTime(.62); await new Promise(r => setTimeout(r, 300)); unfold.render();
      const gl = document.querySelector('canvas'); const o = document.createElement('canvas'); o.width = gl.width; o.height = gl.height; const ox = o.getContext('2d'); ox.drawImage(gl, 0, 0);
      const d = ox.getImageData(0, 0, o.width, o.height).data; const b = [d[0], d[1], d[2]]; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - b[0]) + Math.abs(d[i + 1] - b[1]) + Math.abs(d[i + 2] - b[2]) > 24) n++;
      return { n};
    }, bg);
    results[bg] = png.n;
  }
  await page.evaluate(async () => { const lib = await import('/model-library.js?v=5'); for (const m of await lib.listModels()) await lib.deleteModel(m.id); });
} finally { await browser.close(); server.close(); }
const ok = results.opaque > 1000 && results.transparent >= results.opaque * .99 && !errors.length;
console.log(`${ok ? 'PASS' : 'FAIL'} solid pixels: transparent picture ${results.transparent}, opaque picture ${results.opaque}${errors.length ? ' errors: ' + errors.join(' | ') : ''}`);
process.exit(ok ? 0 : 1);
