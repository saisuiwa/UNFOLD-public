// Browser check for the GLB shelf's 「色つきに入れ替え」: a browser that still holds the old grey shelf copies gets the colour
// files put in place (same saved id, so works keep their model), and a GLB of your own with a shelf name is left alone.
//   UNFOLD_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/test/glb-shelf-replace-browser.mjs
// Needs the git-ignored models/tripo-publish (grey) and models/tripo-publish-color (colour) folders.
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { launchBrowser } from '../lib/browser.mjs';
import { startStaticServer } from '../lib/static-server.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const GREY = join(REPO, 'models/tripo-publish'), COLOUR = join(REPO, 'models/tripo-publish-color');
if (!existsSync(GREY) || !existsSync(COLOUR)) { console.log('SKIP: models/tripo-publish(-color) not here'); process.exit(0); }

// the stand-in GLB host (CORS like glb.saisuiwa.com)
const host = createServer((req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const file = join(COLOUR, path);
  if (!file.startsWith(COLOUR) || !existsSync(file)) { res.writeHead(404, { 'access-control-allow-origin': '*' }); res.end(); return; }
  res.writeHead(200, { 'access-control-allow-origin': '*', 'content-type': path.endsWith('.json') ? 'application/json' : 'model/gltf-binary' });
  res.end(readFileSync(file));
});
await new Promise(r => host.listen(0, '127.0.0.1', r));
const hostUrl = `http://127.0.0.1:${host.address().port}/`;
const server = await startStaticServer();
const browser = await launchBrowser();
const failures = [];
const need = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };

try {
  const page = await browser.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.goto(server.url + '/guide/glb.html');

  // seed: grey whale + grey penguin (as the old shelf saved them) and "my own" クジラ with other bytes
  const catalog = JSON.parse(readFileSync(join(REPO, 'app/guide/glb-catalog.json'), 'utf8'));
  const whale = catalog.models.find(m => m.id === 'whale'), second = catalog.models.find(m => m.id !== 'whale' && m.groupId === 'animal');
  const b64 = f => readFileSync(join(GREY, f)).toString('base64');
  const seeded = await page.evaluate(async ({ items }) => {
    const lib = await import('/model-library.js?v=5');
    for (const m of await lib.listModels()) await lib.deleteModel(m.id);
    const out = {};
    for (const it of items) {
      const buf = Uint8Array.from(atob(it.b64), c => c.charCodeAt(0)).buffer;
      out[it.key] = (await lib.saveModel(it.name, it.own ? buf.slice(0, 1000) : buf, 1, '', it.group)).id;
    }
    return out;
  }, { items: [
    { key: 'whale', name: whale.name, group: whale.group, b64: b64(whale.file) },
    { key: 'second', name: second.name, group: second.group, b64: b64(second.file) },
    { key: 'own', name: whale.name, group: '', b64: b64(whale.file), own: true },
  ] });

  await page.goto(`${server.url}/guide/glb.html?base=${encodeURIComponent(hostUrl)}`);
  await page.waitForFunction(() => document.querySelectorAll('#grid article').length > 0);
  const cardBtn = name => page.evaluate(n => [...document.querySelectorAll('#grid article')].find(a => a.querySelector('h3').textContent === n)?.querySelector('button')?.textContent, name);
  need(await cardBtn(whale.name) === '色つきに入れ替え', `grey ${whale.name} card offers 色つきに入れ替え`);
  need(await cardBtn(second.name) === '色つきに入れ替え', `grey ${second.name} card offers 色つきに入れ替え`);
  const third = catalog.models.find(m => m.id !== whale.id && m.id !== second.id);
  need(await cardBtn(third.name) === 'UNFOLDに追加', 'a model not saved still says UNFOLDに追加');
  const all = await page.evaluate(() => { const b = document.getElementById('replaceAll'); return { hidden: b.hidden, text: b.textContent }; });
  need(!all.hidden && /色なし2個/.test(all.text), `bulk button shows 2 (${all.text})`);

  await page.click('#replaceAll');
  await page.waitForFunction(() => /入れ替えました|入れ替えられません/.test(document.getElementById('status').textContent), null, { timeout: 120000 });
  const status = await page.textContent('#status');
  need(/2個を色つきに入れ替えました/.test(status), `status: ${status}`);

  const after = await page.evaluate(async () => {
    const lib = await import('/model-library.js?v=5');
    const list = await lib.listModels();
    const files = {};
    for (const m of list) {
      const r = await lib.getModel(m.id);
      let textures = -1;
      try { const len = new DataView(r.buffer).getUint32(12, true); textures = (JSON.parse(new TextDecoder().decode(new Uint8Array(r.buffer, 20, len))).textures || []).length; } catch { /* not a whole GLB (the stand-in) */ }
      files[m.id] = { bytes: m.bytes, fileBytes: r.buffer.byteLength, textures, thumb: !!m.thumb, group: m.group, name: m.name };
    }
    return { count: list.length, files };
  }).catch(e => ({ error: String(e) }));
  need(after.count === 3, `still 3 saved models (no duplicates): ${after.count}`);
  for (const [key, m] of [['whale', whale], ['second', second]]) {
    const f = after.files?.[seeded[key]];
    need(f && f.bytes === m.bytes && f.fileBytes === m.bytes && f.textures > 0, `${m.name} keeps its id and now holds the colour file (${JSON.stringify(f)})`);
    need(f && f.thumb && f.group === m.group && f.name === m.name, `${m.name} keeps name/group and has a thumbnail`);
  }
  const own = after.files?.[seeded.own];
  need(own && own.bytes === 1000, 'own GLB with the same name was not touched');
  need(await cardBtn(whale.name) === '追加済み ✓', 'card says 追加済み ✓ afterwards');
  need(await page.evaluate(() => document.getElementById('replaceAll').hidden), 'bulk button hidden afterwards');
  need(!problems.length, `no page errors ${problems.join(' | ')}`);

  await page.evaluate(async () => { const lib = await import('/model-library.js?v=5'); for (const m of await lib.listModels()) await lib.deleteModel(m.id); });
} finally {
  await browser.close(); server.close(); host.close();
}
console.log(failures.length ? `${failures.length} FAILED` : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
