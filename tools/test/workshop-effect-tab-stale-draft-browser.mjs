// A draft stored by an OLDER workshop (before the effect shelf existed) has no `shelf`. It must not keep an effect off the "エフェクト" tab:
// the tab opens, the stored copy is listed on the right shelf, and the 文字モーション tab still works.
import assert from 'node:assert/strict';
import { startStaticServer } from '../lib/static-server.mjs';
import { launchBrowser } from '../lib/browser.mjs';

const server = await startStaticServer(), browser = await launchBrowser();
try {
  const probe = await browser.newPage();
  await probe.goto(`${server.url}/workshop.html`, { waitUntil: 'load' });
  const { effectIndex, textIndex, effectCount } = await probe.evaluate(async () => {
    const { CODE_MOTION_PRESETS } = await import('/code-motion-presets.js');
    return { effectIndex: CODE_MOTION_PRESETS.findIndex(p => p.shelf === 'effect'), textIndex: CODE_MOTION_PRESETS.findIndex(p => p.shelf !== 'effect'), effectCount: CODE_MOTION_PRESETS.filter(p => p.shelf === 'effect').length };
  });
  await probe.close();
  assert.ok(effectIndex > 0 && textIndex >= 0 && effectCount >= 18);

  const pressedOf = page => page.evaluate(() => [...document.querySelectorAll('.tabs [data-kind]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.kind));
  async function open(seedKeys, active) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript(({ keys, active }) => {
      const draft = key => ({ key, kind: 'text', name: 'old ' + key, source: 'return {update(){},dispose(){}};', words: 'a', font: 'gothic', color: '#78ddff', accent: '#d9f878', strength: .8, shape: 'sphere', params: {} });
      localStorage.setItem('unfold-workshop-drafts-v1', JSON.stringify({ active, drafts: Object.fromEntries(keys.map(k => [k, draft(k)])) }));
    }, { keys: seedKeys, active });
    const page = await ctx.newPage(), problems = [];
    page.on('pageerror', e => problems.push(String(e).slice(0, 200)));
    await page.goto(`${server.url}/workshop.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('main') && !document.querySelector('main').inert, null, { timeout: 30000 });
    return { ctx, page, problems };
  }
  const cards = page => page.evaluate(() => document.querySelectorAll('[data-card^="sample:text:"]').length);

  // 1) an old stored copy of an effect, not the open one: the effect tab must open
  {
    const effectKey = `sample:text:${effectIndex}`, { ctx, page, problems } = await open([effectKey], '');
    await page.locator('.tabs [data-kind="effect"]').click();
    assert.deepEqual(await pressedOf(page), ['effect'], 'the effect tab opens although an old copy of its first effect is stored');
    assert.equal(await page.locator('#engine-label').textContent(), 'EFFECT');
    assert.equal(await cards(page), effectCount);
    await page.locator('.tabs [data-kind="text"]').click();
    assert.deepEqual(await pressedOf(page), ['text'], 'and the 文字モーション tab still opens');
    assert.ok(await cards(page) >= 20);
    assert.deepEqual(problems, []);
    await ctx.close();
  }
  // 2) an old stored copy of an effect that was the open one at the last visit: it boots on the effect tab
  {
    const effectKey = `sample:text:${effectIndex}`, { ctx, page, problems } = await open([effectKey], effectKey);
    assert.deepEqual(await pressedOf(page), ['effect'], 'the workshop boots on the effect tab for an old stored effect');
    assert.equal(await page.locator('#engine-label').textContent(), 'EFFECT');
    await ctx.close();
    assert.deepEqual(problems, []);
  }
  // 3) an old stored copy of a text motion stays on the text tab (and an old effect copy next to it does not take the text tab over)
  {
    const textKey = `sample:text:${textIndex}`, effectKey = `sample:text:${effectIndex}`, { ctx, page, problems } = await open([effectKey, textKey], textKey);
    assert.deepEqual(await pressedOf(page), ['text']);
    await page.locator('.tabs [data-kind="effect"]').click();
    assert.deepEqual(await pressedOf(page), ['effect']);
    await page.locator('.tabs [data-kind="text"]').click();
    assert.deepEqual(await pressedOf(page), ['text'], 'the text tab does not land on an effect');
    assert.deepEqual(problems, []);
    await ctx.close();
  }
  console.log('PASS workshop effect tab with stale stored drafts');
} finally {
  await browser.close();
  await server.close();
}
