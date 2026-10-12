// The trial render's first measurement on a fresh page: a fresh WebGL context is slow for its first quarter of a second, so the first method tried on a
// page used to come out "5 times heavier than the heaviest built-in" about every other time — also the petals sample, which IS that built-in.
// Fresh pages, first thing on each: the petals sample must not be refused (and must not be much heavier than the baseline it is made of);
// a really heavy method (inside the text check's loop limits) must still be refused, so the warm-up did not just make the check blind.
import assert from 'node:assert/strict';
import { startStaticServer } from '../lib/static-server.mjs';
import { launchBrowser } from '../lib/browser.mjs';
import { SAMPLES } from '../../app/method-samples.js';
import { checkSource } from '../../app/method-guard.js';

const PAGES = 6, HEAVY_ON = 2;
const body = `q += vec2(pow(abs(sin(q.y * float(IDX) + amount)) + 0.1, 1.7) * exp(-abs(q.x) * 0.3), log(abs(cos(q.x * float(IDX) - amount)) + 1.1) * sqrt(abs(q.y) + 0.2)) * 0.0008;
    q += vec2(atan(q.y + 0.3, q.x + 0.7), tanh(q.x * 2.0 + float(IDX))) * 0.0003;`;
const loop = v => `  for (int ${v} = 0; ${v} < 64; ${v}++) {\n    ${body.replaceAll('IDX', v)}\n  }\n`;
const HEAVY = `vec3 userMethod(vec2 p, float amount) {\n  vec2 q = p;\n${loop('i')}${loop('j')}${loop('k')}${loop('m')}  return vec3(q, amount * 0.1);\n}`;
assert.ok(checkSource(HEAVY).ok, 'the heavy method must be one the text check lets through (otherwise it would never reach the trial)');
const petals = SAMPLES.find(s => s.key === 'petals').source;

const server = await startStaticServer(), browser = await launchBrowser();
const seen = [];
try {
  for (let n = 0; n < PAGES; n++) {
    const page = await browser.newPage(), problems = [];
    page.on('pageerror', e => problems.push(String(e).slice(0, 200)));
    await page.goto(server.url + '/__tools/preview/method.html');
    await page.waitForFunction(() => window.previewReady === true, null, { timeout: 30000 });
    const out = await page.evaluate(async ({ petals, heavy, withHeavy }) => {
      const { vertexShader, fragmentShader } = await import('/motion.js');
      const { createTrial } = await import('/method-trial.js');
      const trial = createTrial({ vertexShader, fragmentShader });
      const first = await trial.run(petals);                       // the very first thing this page's trial does
      const slow = withHeavy ? await trial.run(heavy) : null;
      const pick = r => r && { stage: r.stage, heavy: r.heavy, ratio: r.ratio, customMs: r.customMs, baselineMs: r.baselineMs };
      return { first: pick(first), heavy: pick(slow) };
    }, { petals, heavy: HEAVY, withHeavy: n < HEAVY_ON });
    assert.deepEqual(problems, []);
    seen.push(out);
    assert.equal(out.first.heavy, false, `page ${n}: the petals sample was refused as too heavy (${out.first.stage}: ${out.first.ratio?.toFixed(2)}x, ${out.first.customMs.toFixed(2)} ms vs ${out.first.baselineMs.toFixed(2)} ms)`);
    assert.ok(out.first.ratio < 2.5, `page ${n}: the petals sample is the baseline itself, but came out ${out.first.ratio.toFixed(2)}x of it`);
    if (out.heavy) assert.equal(out.heavy.heavy, true, `page ${n}: a really heavy method was NOT refused (${out.heavy.stage}: ${out.heavy.ratio?.toFixed(2)}x)`);
    await page.close();
  }
  const ratios = seen.map(s => s.first.ratio.toFixed(2)).join(' ');
  const heavy = seen.filter(s => s.heavy).map(s => `${s.heavy.stage[0]}:${s.heavy.ratio.toFixed(1)}x`).join(' ');
  console.log(`PASS trial on ${PAGES} fresh pages: petals first = ${ratios}; heavy method refused (${heavy})`);
} finally { await browser.close(); await server.close(); }
