// The method workshop's "エフェクト" tab: the effects (text code motions marked shelf:'effect') are listed there and not on the "文字モーション" tab;
// a copy made on the effect tab stays on it, also after a reload; the other tabs are as before.
import assert from 'node:assert/strict';
import { startStaticServer } from '../lib/static-server.mjs';
import { launchBrowser } from '../lib/browser.mjs';

const server = await startStaticServer(), browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const problems = [];
  page.on('pageerror', e => problems.push(String(e).slice(0, 200)));
  await page.goto(`${server.url}/workshop.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('main') && !document.querySelector('main').inert, null, { timeout: 30000 });

  // the four tabs, in this order
  const tabs = await page.evaluate(() => [...document.querySelectorAll('.tabs [data-kind]')].map(b => [b.dataset.kind, b.firstChild.textContent.trim()]));
  assert.deepEqual(tabs, [['glsl', '画像の崩れ方'], ['image', '画像・立体・物理'], ['text', '文字モーション'], ['effect', 'エフェクト']]);

  const presets = await page.evaluate(async () => {
    const { CODE_MOTION_PRESETS } = await import('/code-motion-presets.js');
    return CODE_MOTION_PRESETS.map(p => ({ name: p.name, effect: p.shelf === 'effect' }));
  });
  const effectNames = presets.filter(p => p.effect).map(p => p.name), motionNames = presets.filter(p => !p.effect).map(p => p.name);
  assert.ok(effectNames.length >= 18 && motionNames.length >= 20);
  const listed = () => page.evaluate(() => [...document.querySelectorAll('[data-card^="sample:text:"]')].map(c => c.querySelector('strong').textContent));
  const state = () => page.evaluate(() => ({
    pressed: [...document.querySelectorAll('.tabs [data-kind]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.kind),
    engine: document.querySelector('#engine-label').textContent, note: !document.querySelector('#shelf-note').hidden,
  }));

  // effect tab
  await page.locator('[data-kind="effect"]').click();
  assert.deepEqual((await listed()).sort(), [...effectNames].sort(), 'the effect tab lists exactly the effects');
  assert.deepEqual(await state(), { pressed: ['effect'], engine: 'EFFECT', note: true });
  // text motion tab
  await page.locator('[data-kind="text"]').click();
  assert.deepEqual((await listed()).sort(), [...motionNames].sort(), 'the text motion tab lists the other presets only');
  assert.deepEqual(await state(), { pressed: ['text'], engine: 'TEXT MOTION', note: false });

  // an effect opens in the same editor, and its copy stays on the effect tab (also after a reload)
  await page.locator('[data-kind="effect"]').click();
  await page.locator('[data-card^="sample:text:"]', { hasText: 'キーを打って現れる' }).first().click();
  assert.equal(await page.locator('#name').inputValue(), 'キーを打って現れる');
  assert.match(await page.locator('#code').inputValue(), /KEYFRAG/);
  await page.locator('#duplicate').click();
  assert.equal(await page.locator('#name').inputValue(), 'キーを打って現れる コピー');
  assert.deepEqual(await state(), { pressed: ['effect'], engine: 'EFFECT', note: true }, 'the copy is on the effect tab');
  assert.equal(await page.locator('[data-card^="draft:"]').count(), 1);
  await page.locator('[data-kind="text"]').click();
  assert.equal(await page.locator('[data-card^="draft:"]').count(), 0, 'the copy is not on the text motion tab');
  await page.locator('[data-kind="effect"]').click();
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('main') && !document.querySelector('main').inert, null, { timeout: 30000 });
  assert.deepEqual(await state(), { pressed: ['effect'], engine: 'EFFECT', note: true }, 'the open copy brings the effect tab back after a reload');
  assert.equal(await page.locator('#name').inputValue(), 'キーを打って現れる コピー');

  // a brand-new draft made on the effect tab starts from an effect, not from a text motion
  await page.locator('#new-draft').click();
  assert.equal(await page.locator('#name').inputValue(), '新しいエフェクト');
  assert.deepEqual(await state(), { pressed: ['effect'], engine: 'EFFECT', note: true });

  // the other tabs still behave
  for (const kind of ['glsl', 'image']) {
    await page.locator(`[data-kind="${kind}"]`).click();
    assert.deepEqual((await state()).pressed, [kind]);
    assert.ok(await page.locator('[data-card^="sample:"]').count() > 0, `${kind} still lists samples`);
  }
  assert.deepEqual(problems, [], 'no page errors');
  console.log(`PASS workshop effect tab: ${effectNames.length} effects / ${motionNames.length} text motions split, copies stay on their tab`);
} finally {
  await browser.close();
  await server.close();
}
