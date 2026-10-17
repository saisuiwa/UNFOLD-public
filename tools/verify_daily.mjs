// The check that stands between a day's new samples and Git. It prints PASS / FAIL for each step and exits 1 if anything failed.
//   node tools/verify_daily.mjs                       everything, for all samples (a few minutes)
//   node tools/verify_daily.mjs --expect-new=2026-10-08
//        the daily run: the samples added on that day (Japan time) must be exactly one GLSL method, one JavaScript image method and at least
//        DAILY_CUT_PARTS_MIN parts of STUDIO's カット割り (since 2026-10-18; no new text code motion or effect);
//        the GPU check and the preview check then look at the samples added on that day or later (the older ones were checked on their day)
//   --base=REF   what the ?v= numbers are compared with (default origin/main)
// Steps: unit tests (tools/test and tools/test/studio) - the GLSL samples on the GPU (the editor's three checks, warnings count as failures) - the image methods and the text code motions in the app's own runtimes
//        - the cut parts in STUDIO's cut engine (drawn, readable, a veil over a picture) - previews (files, size, video format, decodes)
//        - generated pages are up to date - every page opens without errors - the samples page works - the editor lists the samples
//        - the method workshop lists and runs the new samples - the lyric panel lists the text motions - changed modules got a new ?v= - the daily log mentions every new sample.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { TEXT_MOTIONS } from '../app/lyric-motion.js';
import { versionedImport, versionedImportGrep } from './lib/module-version.mjs';
import { launchBrowser } from './lib/browser.mjs';
import { startStaticServer } from './lib/static-server.mjs';
import { CUT_PARTS_FROM, DAILY_GROUPS, DAILY_CUT_PARTS_MIN, MAX_BYTES, PREVIEW_DIR, catalog, previewFiles, sizeOf } from './lib/samples-catalog.mjs';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const FIRST_BATCH = '2026-10-04';                                   // the samples that were there before the daily routine (same as in build_guide_samples.mjs)
const args = process.argv.slice(2);
const baseRef = (args.find(a => a.startsWith('--base=')) || '').slice(7) || 'origin/main';
const expectNew = (args.find(a => a.startsWith('--expect-new=')) || '').slice(13);
if (expectNew && !/^\d{4}-\d{2}-\d{2}$/.test(expectNew)) { console.error('--expect-new needs a day like 2026-10-08'); process.exit(2); }
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);           // Japan time

const failures = [];
async function step(name, fn) {
  const started = Date.now();
  try {
    const note = await fn();
    console.log(`PASS ${name}${note ? ` — ${note}` : ''} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  } catch (error) {
    failures.push(name);
    console.log(`FAIL ${name}\n     ${String(error.message).split('\n').join('\n     ')}`);
  }
}
const need = (condition, message) => { if (!condition) throw new Error(message); };

const items = catalog();
const recent = expectNew ? items.filter(i => i.added >= expectNew) : items;          // what the slow steps look at

// ---- 1. unit tests
await step('unit tests', () => {
  // the STUDIO tests are run too: they check every part of the カット割り (the daily cut parts included) for its shape, its plan and its values
  const files = ['tools/test', 'tools/test/studio'].flatMap(dir => readdirSync(join(REPO, dir)).filter(f => f.endsWith('.test.mjs')).map(f => join(dir, f)));
  // tap: the counts below are read from its "# pass N" lines; newer Node versions print another format (ℹ pass N) when no reporter is named
  const run = spawnSync('node', ['--test', '--test-reporter=tap', ...files], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 });
  const count = key => Number((new RegExp(`^# ${key} (\\d+)`, 'm').exec(run.stdout) || [])[1] ?? NaN);
  const failed = [...run.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1]);
  need(run.status === 0 && count('fail') === 0, `${count('fail')} failed: ${failed.slice(0, 8).join(' | ')}\n${run.stdout.split('\n').filter(l => /^#\s+(Error|AssertionError)|expected|actual|message:/.test(l)).slice(0, 12).join('\n')}`);
  return `${count('pass')} passed, ${count('skipped')} skipped`;
});

// ---- 2. the quota of the day
if (expectNew) {
  // from 2026-10-18 the routine makes cut parts instead of a text code motion (the author, 2026-10-17); a day before that keeps the old quota
  const cutRule = expectNew >= CUT_PARTS_FROM;
  await step(cutRule ? `one new GLSL method, one image method and at least ${DAILY_CUT_PARTS_MIN} cut parts on ${expectNew}` : `exactly one new GLSL method, image method and text code motion on ${expectNew}`, () => {
    const added = items.filter(i => i.added === expectNew);
    const counts = Object.fromEntries([...DAILY_GROUPS, 'codetext', 'effect'].map(g => [g, added.filter(i => i.group === g).length]));
    need(counts.method === 1 && counts.image === 1, `added on ${expectNew}: method ${counts.method}, image ${counts.image} (each must be 1)`);
    if (cutRule) {
      need(counts.cutpart >= DAILY_CUT_PARTS_MIN, `added on ${expectNew}: ${counts.cutpart} cut parts (at least ${DAILY_CUT_PARTS_MIN})`);
      need(counts.codetext === 0 && counts.effect === 0, `added on ${expectNew}: codetext ${counts.codetext}, effect ${counts.effect} (from ${CUT_PARTS_FROM} the routine makes cut parts instead)`);
    } else need(counts.codetext === 1, `added on ${expectNew}: codetext ${counts.codetext} (must be 1 before ${CUT_PARTS_FROM})`);
    need(!items.some(i => i.added > expectNew), `something is dated after ${expectNew}: ${items.filter(i => i.added > expectNew).map(i => i.id).join(', ')}`);
    return added.filter(i => DAILY_GROUPS.includes(i.group)).map(i => i.id).join(', ');
  });
}

// ---- 3. previews (files)
await step(`previews: files, size, format, decoding (${recent.length} samples)`, () => {
  const problems = [];
  for (const item of recent) {
    const files = previewFiles(item.id);
    for (const [kind, file] of Object.entries(files)) {
      const size = sizeOf(file);
      if (!size) { problems.push(`${item.id}: no ${kind} (run node tools/make_sample_previews.mjs)`); continue; }
      if (size > MAX_BYTES[kind]) problems.push(`${item.id}: ${kind} is ${(size / 1024).toFixed(0)} KB (limit ${MAX_BYTES[kind] / 1024} KB)`);
    }
    if (!sizeOf(files.mp4) || !sizeOf(files.jpg)) continue;
    const probe = (file, entries) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', `stream=${entries}:format=duration`, '-of', 'json', file], { encoding: 'utf8' }));
    const v = probe(files.mp4, 'codec_name,pix_fmt,width,height'), j = probe(files.jpg, 'codec_name,width,height');
    if (v.streams[0]?.codec_name !== 'h264' || v.streams[0]?.pix_fmt !== 'yuv420p') problems.push(`${item.id}: the mp4 is not H.264 / yuv420p`);
    if (v.streams[0]?.width !== 480 || v.streams[0]?.height !== 270) problems.push(`${item.id}: the mp4 is not 480x270`);
    const seconds = Number(v.format?.duration);
    if (!(seconds >= 2 && seconds <= 6)) problems.push(`${item.id}: the mp4 is ${seconds} s long (2 to 6 s)`);
    if (j.streams[0]?.codec_name !== 'mjpeg' || j.streams[0]?.width !== 480 || j.streams[0]?.height !== 270) problems.push(`${item.id}: the jpg is not a 480x270 JPEG`);
    const decode = spawnSync('ffmpeg', ['-v', 'error', '-i', files.mp4, '-f', 'null', '-'], { encoding: 'utf8' });
    if (decode.status !== 0 || decode.stderr.trim()) problems.push(`${item.id}: the mp4 does not decode cleanly: ${decode.stderr.trim().split('\n')[0]}`);
  }
  const known = new Set(items.flatMap(i => [`${i.id}.jpg`, `${i.id}.mp4`]));
  for (const file of existsSync(PREVIEW_DIR) ? readdirSync(PREVIEW_DIR) : []) if (!known.has(file)) problems.push(`${file}: belongs to no sample (delete it)`);
  need(!problems.length, problems.join('\n'));
  return `${recent.length * 2} files`;
});

// ---- 4. generated pages are what the samples say
await step('generated pages are up to date', () => {
  const run = spawnSync('node', ['tools/build_guide_samples.mjs', '--check'], { cwd: REPO, encoding: 'utf8' });
  need(run.status === 0, run.stdout.trim() || run.stderr.trim());
  const methodsPage = join(REPO, 'app/guide/methods.html'), before = readFileSync(methodsPage, 'utf8');
  execFileSync('python3', ['tools/build_guide_methods.py'], { cwd: REPO });
  const after = readFileSync(methodsPage, 'utf8');
  if (after !== before) { writeFileSync(methodsPage, before); throw new Error('app/guide/methods.html is not what tools/build_guide_methods.py makes (run it)'); }
});

// ---- 5. the daily log
await step('the daily log mentions every sample added after the first batch', () => {
  const log = readFileSync(join(REPO, 'docs/daily-samples-log.md'), 'utf8');
  const missing = items.filter(i => i.added > FIRST_BATCH && !log.includes(`\`${i.id}\``)).map(i => i.id);
  need(!missing.length, `not in docs/daily-samples-log.md: ${missing.join(', ')}`);
});

// ---- 6. changed modules got a new ?v=
await step('every changed app module has a raised ?v= on its imports', () => {
  const git = (...a) => spawnSync('git', a, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (git('rev-parse', '--verify', '-q', baseRef).status !== 0) return `skipped (no ${baseRef} to compare with)`;
  const changed = git('diff', '--name-only', baseRef, '--', 'app').stdout.split('\n').filter(f => /^app\/[^/]+\.js$/.test(f));
  const pages = [...readdirSync(join(REPO, 'app')).filter(f => /\.(js|html)$/.test(f)).map(f => join(REPO, 'app', f))];
  const text = pages.map(f => readFileSync(f, 'utf8')).join('\n');
  const problems = [];
  for (const file of changed) {
    const base = file.slice(4), pattern = versionedImport(base);
    const now = [...text.matchAll(pattern)].map(m => Number(m[2]));
    const old = git('grep', '-h', '-o', '-E', versionedImportGrep(base), baseRef, '--', 'app').stdout.split('\n').filter(Boolean).map(s => Number(s.split('=')[1]));
    if (!old.length || !now.length) continue;                                           // nobody imports it with a ?v= (or it is new): nothing to raise
    if (Math.max(...now) <= Math.max(...old)) problems.push(`${file} changed but its imports still say ?v=${Math.max(...now)} (node tools/bump_module_version.mjs ${file})`);
    if (new Set(now).size > 1) problems.push(`${file} is imported with different ?v= numbers (${[...new Set(now)].join(', ')}): two copies would load`);
  }
  need(!problems.length, problems.join('\n'));
  return `${changed.length} changed modules`;
});

// ---- 7-9. in the browser
const server = await startStaticServer();
let browser = null;
try {
  browser = await launchBrowser();
  const newPage = async (viewport = { width: 1280, height: 900 }) => {
    const page = await browser.newPage({ viewport });
    page.problems = [];
    page.on('pageerror', e => page.problems.push(`error: ${String(e).slice(0, 200)}`));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.problems.push(`console: ${m.text().slice(0, 200)}`); });
    return page;
  };
  // what is missing in a clean clone on purpose: the old method gallery's videos, the GLB thumbnails, the browser's own favicon request
  const expectedMissing = path => path === '/favicon.ico' || path.startsWith('/guide/methods/') || /^\/guide\/(glb|thumbs?)\//.test(path);

  const PAGES = ['/index.html', '/sequence.html', '/workshop.html', '/guide/', '/guide/methods.html', '/guide/samples.html', '/guide/motions.html', '/guide/code-motions.html', '/guide/glb.html'];
  await step('every page opens without errors and without missing files', async () => {
    const problems = [];
    for (const path of PAGES) {
      server.requests.length = 0;
      const page = await newPage();
      await page.goto(server.url + path, { waitUntil: 'load' });
      await page.waitForTimeout(/^\/(index|sequence|workshop)/.test(path) ? 2500 : 600);
      const missing = [...new Set(server.requests.filter(r => r.status >= 400 && !expectedMissing(r.path.split('?')[0])).map(r => r.path))];
      for (const p of [...page.problems, ...missing.map(m => `missing file: ${m}`)]) problems.push(`${path}: ${p}`);
      await page.close();
    }
    need(!problems.length, problems.join('\n'));
    return `${PAGES.length} pages`;
  });

  const glsl = recent.filter(i => i.group === 'method' || i.group === 'graphic');
  await step(`GLSL samples pass the editor's checks on the GPU (${glsl.length})`, async () => {
    const page = await newPage();
    await page.goto(`${server.url}/__tools/preview/method.html`);
    await page.waitForFunction(() => window.previewReady === true, null, { timeout: 30000 });
    const problems = [];
    for (const item of glsl) {
      const result = await page.evaluate(source => window.previewMethod.verify(source), item.source);
      if (!result.ok) problems.push(`${item.id}: ${result.stage} — ${result.problems.join(' / ')}`);
      else if (result.warnings.length) problems.push(`${item.id}: warning — ${result.warnings.join(' / ')} (a sample must show a real change)`);
    }
    for (const p of page.problems) problems.push(`page: ${p}`);
    await page.close();
    need(!problems.length, problems.join('\n'));
  });

  const images = recent.filter(i => i.group === 'image');
  await step(`image methods run in the app's runtime and show an effect (${images.length})`, async () => {
    const page = await newPage();
    await page.goto(`${server.url}/__tools/preview/image.html`);
    await page.waitForFunction(() => window.previewReady === true, null, { timeout: 30000 });
    const problems = [];
    for (const item of images) {
      let frames;
      try { frames = await page.evaluate(code => window.previewImage.run(code), item.code); } catch (error) { problems.push(`${item.id}: ${String(error.message).split('\n')[0]}`); continue; }
      const at = t => frames.find(f => f.time === t);
      if (frames.some(f => f.ms > 5000)) problems.push(`${item.id}: a frame took ${Math.max(...frames.map(f => f.ms))} ms (limit 5000)`);
      if (at(1.8).changed < 2000) problems.push(`${item.id}: at 1.8 s only ${at(1.8).changed} pixels differ from the original picture (it must show an effect: 2000 or more)`);
      if (new Set(frames.map(f => f.hash)).size < 5) problems.push(`${item.id}: the picture hardly changes over the clip (${new Set(frames.map(f => f.hash)).size} different frames of ${frames.length})`);
    }
    for (const p of page.problems) problems.push(`page: ${p}`);
    await page.close();
    need(!problems.length, problems.join('\n'));
  });

  const codetexts = recent.filter(i => i.group === 'codetext' || i.group === 'effect');      // an effect is still a code motion: same runtime, same limits
  await step(`text code motions run, stay in the frame and fade out (${codetexts.length})`, async () => {
    const page = await newPage();
    await page.goto(`${server.url}/__tools/preview/code-text.html`);
    await page.waitForFunction(() => window.previewReady === true, null, { timeout: 30000 });
    const problems = [], W = 480, H = 270, times = [0, .45, .9, 1.5, 2.0, 2.8, 3.4];
    for (const item of codetexts) {
      let frames;
      try { frames = await page.evaluate(({ source, times }) => window.previewCodeText.run(source, { times }), { source: item.source, times }); } catch (error) { problems.push(`${item.id}: ${String(error.message).split('\n')[0]}`); continue; }
      const at = t => frames.find(f => f.time === t), mid = at(1.5), later = at(2.0), gone = at(3.4);
      if (frames.some(f => f.ms > 5000)) problems.push(`${item.id}: a frame took ${Math.max(...frames.map(f => f.ms))} ms (limit 5000)`);
      for (const f of [mid, later]) {
        if (f.pixels < 400) problems.push(`${item.id}: nothing readable at ${f.time} s in the middle of the line (${f.pixels} pixels)`);
        else if (f.pixels > W * H * .5) problems.push(`${item.id}: the text covers more than half of the picture at ${f.time} s`);
        else if (f.box[0] < W * .02 || f.box[1] < H * .02 || f.box[2] > W * .98 || f.box[3] > H * .98) problems.push(`${item.id}: the text touches the edge of the picture at ${f.time} s (${f.box.join(',')})`);
      }
      if (new Set([at(.45), at(.9), mid].map(f => f.hash)).size < 2) problems.push(`${item.id}: the picture does not change while the line comes in`);
      if (gone.pixels > mid.pixels * .05) problems.push(`${item.id}: still ${gone.pixels} pixels of text after the line has ended (it must fade out by its duration)`);
    }
    for (const p of page.problems) problems.push(`page: ${p}`);
    await page.close();
    need(!problems.length, problems.join('\n'));
  });

  const cutParts = recent.filter(i => i.group === 'cutpart');
  await step(`cut parts draw in STUDIO's cut engine, move, stay readable and stay a veil over a picture (${cutParts.length})`, async () => {
    const page = await newPage();
    await page.goto(`${server.url}/__tools/preview/cut-part.html`);
    await page.waitForFunction(() => window.previewReady === true, null, { timeout: 30000 });
    const problems = [], times = [0, .35, .45, .6, .9, 1.5, 2.0, 2.6, 3.0, 3.2, 3.4];
    for (const item of cutParts) {
      let frames, veil;
      try {
        frames = await page.evaluate(({ axis, key, text, times }) => window.previewCutPart.run(axis, key, { text, times }), { axis: item.axis, key: item.key, text: item.name, times });
        veil = await page.evaluate(({ axis, key }) => window.previewCutPart.transparent(axis, key), { axis: item.axis, key: item.key });
      } catch (error) { problems.push(`${item.id}: ${String(error.message).split('\n')[0]}`); continue; }
      const at = t => frames.find(f => f.time === t);
      if (frames.some(f => f.ms > 2000)) problems.push(`${item.id}: a frame took ${Math.round(Math.max(...frames.map(f => f.ms)))} ms (limit 2000)`);
      for (const t of [1.5, 2.0]) if (at(t).light < 400) problems.push(`${item.id}: the words are not readable at ${t} s (${at(t).light} light pixels)`);
      if (new Set(frames.filter(f => f.time > 0 && f.time < 3.3).map(f => f.hash)).size < 3) problems.push(`${item.id}: the picture hardly changes during the cut`);
      if (veil && item.axis === 'bg' && veil.maxA > 130) problems.push(`${item.id}: over a picture the background is not a veil (alpha up to ${veil.maxA}, limit 130)`);
      if (veil && item.axis === 'fx' && (veil.solid > .55 || veil.corner > 30)) problems.push(`${item.id}: over a picture the effect paints too much (${Math.round(veil.solid * 100)}% solid, corner alpha ${veil.corner})`);
      if (veil && item.axis === 'trans' && veil.solid > .7) problems.push(`${item.id}: over a picture the transition paints ${Math.round(veil.solid * 100)}% of it`);
    }
    for (const p of page.problems) problems.push(`page: ${p}`);
    await page.close();
    need(!problems.length, problems.join('\n'));
  });

  const kindOf = { method: 'glsl', graphic: 'glsl', image: 'image', codetext: 'text', effect: 'effect' }, inWorkshop = recent.filter(i => kindOf[i.group]);   // the preset text motions are not in the workshop
  await step(`the method workshop lists the new samples and runs each one itself (${inWorkshop.length})`, async () => {
    const page = await newPage({ width: 1440, height: 1000 });
    await page.goto(`${server.url}/workshop.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('main') && !document.querySelector('main').inert, null, { timeout: 30000 });
    const problems = [];
    for (const item of inWorkshop) {
      await page.locator(`[data-kind="${kindOf[item.group]}"]`).click();
      const card = await page.evaluate(({ kind, key, name }) => {
        const cards = [...document.querySelectorAll('[data-card^="sample:"]')];
        const hit = kind === 'glsl' ? cards.find(c => c.dataset.card === `sample:glsl:${key}`) : cards.find(c => c.querySelector('strong')?.textContent === name);
        return hit?.dataset.card || null;
      }, { kind: kindOf[item.group], key: item.key, name: item.name });
      if (!card) { problems.push(`${item.id}: not listed in the workshop's "${kindOf[item.group]}" samples`); continue; }
      await page.evaluate(() => { const s = document.querySelector('#status'); if (s) { s.dataset.state = ''; s.textContent = ''; } });
      await page.locator(`[data-card="${card}"]`).click();
      try { await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('#status')?.dataset.state), null, { timeout: 45000 }); } catch { problems.push(`${item.id}: the workshop did not finish its own check in 45 s`); continue; }
      const state = await page.locator('#status').getAttribute('data-state');
      if (state !== 'ready') problems.push(`${item.id}: the workshop's own check says "${(await page.locator('#status').textContent()).slice(0, 100)}"`);
    }
    for (const p of page.problems) problems.push(`page: ${p}`);
    await page.close();
    need(!problems.length, problems.join('\n'));
  });

  await step('samples page: cards, previews, hover, filter, phone width', async () => {
    const page = await newPage();
    await page.goto(`${server.url}/guide/samples.html`, { waitUntil: 'load' });
    const info = await page.evaluate(() => ({
      cards: document.querySelectorAll('.method').length,
      withPreview: [...document.querySelectorAll('.method .shot[data-clip] img')].length,
      groups: Object.fromEntries([...document.querySelectorAll('.method')].reduce((m, c) => m.set(c.dataset.cat, (m.get(c.dataset.cat) || 0) + 1), new Map())),
    }));
    need(info.cards === items.length && info.withPreview === items.length, `${info.cards} cards, ${info.withPreview} with a preview, ${items.length} samples`);
    const shot = page.locator('.shot[data-clip]').first();
    const box = await shot.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    need(await page.evaluate(() => !!document.querySelector('.shot.playing video[src]')), 'hovering a card did not start its video');
    await page.mouse.move(2, 2);
    await page.waitForTimeout(150);
    need(await page.evaluate(() => !document.querySelector('.shot.playing') && !document.querySelector('.shot video')), 'leaving the card did not stop its video');
    for (const [group] of Object.entries(info.groups)) {
      await page.click(`.chip[data-filter="${group}"]`);
      need(await page.evaluate(g => [...document.querySelectorAll('.method')].filter(m => !m.hidden).every(m => m.dataset.cat === g), group), `the filter for ${group} shows other cards`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    need(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'the page scrolls sideways at 390 px');
    for (const p of page.problems) throw new Error(p);
    await page.close();
    return `${info.cards} cards`;
  });

  await step('the editor lists every sample under its group', async () => {
    const page = await newPage();
    await page.goto(`${server.url}/sequence.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.unfoldMethods?.editor, null, { timeout: 30000 });
    // "＋自作メソッド" first asks GLSL or JavaScript; the presets are in the GLSL editor
    await page.evaluate(() => window.unfoldMethods.editor.open());
    await page.getByRole('button', { name: 'GLSLで作る' }).click();
    await page.waitForSelector('#method-samples', { state: 'attached', timeout: 10000 });
    const listed = await page.evaluate(() => {
      const out = [...document.querySelectorAll('#method-samples optgroup')].map(g => ({ label: g.label, options: [...g.querySelectorAll('option')].map(o => o.value) }));
      window.unfoldMethods.editor.close();
      return out;
    });
    const { SAMPLE_GROUPS } = await import('../app/method-samples.js');
    const problems = [];
    for (const [category, label] of SAMPLE_GROUPS) {
      const group = listed.find(g => g.label === label);
      const want = items.filter(i => i.group === category).map(i => i.key);
      if (!group) problems.push(`no group "${label}" in the editor`);
      else if (JSON.stringify(group.options) !== JSON.stringify(want)) problems.push(`group "${label}" lists ${group.options.join(',')} but the samples are ${want.join(',')}`);
    }
    for (const p of page.problems) problems.push(p);
    await page.close();
    need(!problems.length, problems.join('\n'));
  });

  // The sequence's lyric rows offer one motion only (一文字ずつ); every other motion is chosen in STUDIO's 動き tab (the user asked for this on 2026-10-11).
  await step('a lyric row in the sequence offers only 一文字ずつ, and it can be chosen', async () => {
    const page = await newPage({ width: 1440, height: 900 });
    await page.goto(`${server.url}/sequence.html`, { waitUntil: 'load' });
    await page.waitForSelector('button[data-tab="lyric"]');
    await page.click('button[data-tab="lyric"]');
    await page.fill('#lm-source', '[Verse]\nきみと、はじまる\nもういちど、*うた*を');
    await page.waitForFunction(() => document.querySelectorAll('#pane-lyric .lm-rows select').length > 0, null, { timeout: 10000 });
    const seen = await page.evaluate(async () => {
      const motionSelect = () => [...document.querySelectorAll('#pane-lyric .lm-rows select')].find(s => [...s.options].some(o => o.value === 'reveal'));
      const options = [...motionSelect().options].filter(o => o.value).map(o => `${o.value}:${o.text}`);   // a leading empty (disabled) option means "this line uses a motion decided in STUDIO"
      const select = motionSelect();
      select.value = 'reveal'; select.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      return { options, chosen: motionSelect().value, sections: document.querySelectorAll('#pane-lyric .lm-rows select[aria-label="この行の区分"]').length };
    });
    const want = [`reveal:${TEXT_MOTIONS.reveal.label}`];
    const problems = [];
    if (JSON.stringify(seen.options) !== JSON.stringify(want)) problems.push(`the select lists ${seen.options.join(', ')} but only ${want.join(', ')} is wanted`);
    if (seen.chosen !== 'reveal') problems.push(`choosing "reveal" did not stick (the select shows "${seen.chosen}")`);
    if (seen.sections) problems.push('the 区分 select is still there');
    for (const p of page.problems) problems.push(p);
    await page.close();
    need(!problems.length, problems.join('\n'));
  });
} finally {
  await browser?.close();
  await server.close();
}

console.log(failures.length ? `\n${failures.length} step(s) FAILED: ${failures.join('; ')}` : '\nAll steps passed.');
process.exit(failures.length ? 1 : 0);
