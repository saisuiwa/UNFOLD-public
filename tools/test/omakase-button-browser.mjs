// 「🎲 崩れ方と形をおまかせ」 sits right under 02 on both pages and picks another method and shape each time; 立体の動き lists all 25 motions
// and each of them draws without page errors.
//   UNFOLD_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/test/omakase-button-browser.mjs [shot-dir]
import { launchBrowser } from '../lib/browser.mjs';
import { startStaticServer } from '../lib/static-server.mjs';
import { SOLID_MOTIONS } from '../../app/solid-motion.js';

const shots = process.argv[2];
const server = await startStaticServer();
const browser = await launchBrowser();
const failures = [];
const need = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };
try {
  // ---- 1枚モード
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const problems = [];
  page.on('pageerror', e => problems.push(String(e)));
  await page.goto(server.url + '/index.html');
  await page.waitForFunction(() => window.unfold && document.querySelectorAll('#methods [data-method]').length > 10);
  const place = await page.evaluate(() => { const b = document.getElementById('omakase'), title = b.previousElementSibling, grid = b.nextElementSibling;
    return { afterTitle: title?.classList.contains('section-title') && /02/.test(title.textContent), beforeGrid: grid?.id === 'methods', bg: getComputedStyle(b).backgroundColor, text: b.textContent }; });
  need(place.afterTitle && place.beforeGrid, `1枚モード: the button is right under 02 (${JSON.stringify(place)})`);
  need(place.bg === 'rgb(217, 248, 120)', `1枚モード: the button is lime (${place.bg})`);
  const seen = new Set();
  let before = await page.evaluate(() => [unfold.state.method, unfold.state.shape]);
  for (let i = 0; i < 6; i++) {
    await page.click('#omakase');
    await page.waitForFunction(() => !document.querySelector('#shapes [data-shape][disabled]'), null, { timeout: 60000 });
    await page.waitForTimeout(150);
    const now = await page.evaluate(() => [unfold.state.method, unfold.state.shape]);
    need(now[0] !== before[0] && now[1] !== before[1], `1枚モード: click ${i + 1} picks another method and shape (${before} -> ${now})`);
    const pressed = await page.evaluate(() => [document.querySelector('#methods [aria-pressed="true"]')?.dataset.method, document.querySelector('[data-shape][aria-pressed="true"]')?.dataset.shape]);
    need(pressed[0] === now[0] && pressed[1] === now[1], `1枚モード: the tiles show the pick (${pressed})`);
    seen.add(now.join('/')); before = now;
  }
  need(seen.size >= 4, `1枚モード: the picks vary (${seen.size} different)`);
  if (shots) await page.locator('.controls').screenshot({ path: `${shots}/single-02.png` });

  // 立体の動き: 25 motions, each draws while the solid is whole
  const opts = await page.evaluate(() => [...document.querySelectorAll('[data-shot="motion.kind"] option')].map(o => o.textContent));
  need(opts.length === SOLID_MOTIONS.length + 1 && SOLID_MOTIONS.length === 25, `立体の動き lists ${opts.length - 1} motions`);
  await page.locator('[data-shape="sphere"]').first().click();
  await page.locator('[data-method="crumple"]').first().click();
  await page.evaluate(() => unfold.setTime(.62));
  const look = () => page.evaluate(() => { unfold.render(); const c = document.getElementById('scene'), o = document.createElement('canvas'); o.width = 160; o.height = 90; o.getContext('2d').drawImage(c, 0, 0, 160, 90); return o.toDataURL(); });
  const setKind = kind => page.evaluate(kind => { const k = document.querySelector('[data-shot="motion.kind"]'); k.value = kind; k.dispatchEvent(new Event('change')); }, kind);
  await setKind('none'); const still = await look();
  for (const [id, name] of SOLID_MOTIONS.slice(13)) {
    await setKind(id);
    let moved = false;
    for (const t of [.6, .62, .64, .66]) { await page.evaluate(t => unfold.setTime(t), t); if (await look() !== still) { moved = true; break; } }
    need(moved, `${name} (${id}) moves the solid`);
    await page.evaluate(() => unfold.setTime(.62));
  }
  await setKind('none');
  need(!problems.length, `1枚モード: no page errors ${problems.join(' | ')}`);

  // ---- シーケンス
  const seq = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const seqProblems = [];
  seq.on('pageerror', e => seqProblems.push(String(e)));
  await seq.goto(server.url + '/sequence.html');
  await seq.waitForFunction(() => window.unfoldSeq && document.querySelectorAll('#seq-methods [data-method]').length > 10);
  const sp = await seq.evaluate(() => { const b = document.getElementById('seq-shuffle'); return { afterHint: b.previousElementSibling?.id === 'seq-methods-hint', beforeGrid: b.nextElementSibling?.id === 'seq-methods', bg: getComputedStyle(b).backgroundColor, text: b.textContent }; });
  need(sp.afterHint && sp.beforeGrid, `シーケンス: the button is right under 02's hint (${JSON.stringify(sp)})`);
  need(sp.bg === 'rgb(217, 248, 120)' && /🎲/.test(sp.text), `シーケンス: lime with 🎲 (${sp.bg} ${sp.text})`);
  const plan = () => seq.evaluate(() => JSON.stringify(unfoldSeq.seq.transitions.map(t => [t.method, t.shape])));
  const p0 = await plan();
  await seq.click('#seq-shuffle'); await seq.waitForTimeout(1500);
  const p1 = await plan();
  need(p1 !== p0, `シーケンス: おまかせ changes the plan (${p0} -> ${p1})`);
  if (shots) await seq.locator('aside.left').screenshot({ path: `${shots}/sequence-02.png` });
  need(!seqProblems.length, `シーケンス: no page errors ${seqProblems.join(' | ')}`);
} finally {
  await browser.close(); server.close();
}
console.log(failures.length ? `${failures.length} FAILED` : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
