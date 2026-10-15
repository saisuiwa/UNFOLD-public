// The lyric timing page without an API key: a rough SRT is loaded, 「声の立ち上がりに合わせる」 moves every line to where the voice
// comes in (found from the song's own loudness, in the browser), and 「目安の時刻に戻す」 puts the rough times back.
import assert from 'node:assert/strict';
import {startStaticServer} from '../lib/static-server.mjs';
import {launchBrowser} from '../lib/browser.mjs';

const SR = 16000, truth = [[2, 4.5], [7, 9.5], [12, 15], [20, 23]];
const pcm = new Int16Array(SR * 30);                     // a pad and voice-like bursts at known times, as 16-bit mono
for (let i = 0; i < pcm.length; i++) {
  const t = i / SR;
  let v = 0.02 * (Math.sin(2 * Math.PI * 110 * t) + Math.sin(2 * Math.PI * 165 * t));
  for (const [a, b] of truth) {
    if (t < a - 0.05 || t > b + 0.15) continue;
    const env = Math.min(1, Math.max(0, (t - a) / 0.04 + 0.5)) * Math.min(1, Math.max(0, (b - t) / 0.12 + 0.5));
    for (const f of [330, 660, 1320, 2200]) v += 0.03 * env * Math.sin(2 * Math.PI * f * t);
  }
  pcm[i] = Math.round(Math.max(-1, Math.min(1, v)) * 32767);
}
const wav = Buffer.alloc(44 + pcm.length * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + pcm.length * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22); wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(pcm.length * 2, 40); Buffer.from(pcm.buffer).copy(wav, 44);
const stamp = t => { const ms = Math.round(t * 1000), p = (n, w = 2) => String(n).padStart(w, '0'); return `00:${p(Math.floor(ms / 60000))}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
const srt = '﻿' + truth.map(([s, e], i) => `${i + 1}\r\n${stamp(s - 0.8)} --> ${stamp(e - 0.8)}\r\nうた${i + 1}\r\n`).join('\r\n');

const server = await startStaticServer(), browser = await launchBrowser();
try {
  const page = await browser.newPage({viewport: {width: 1100, height: 1000}}), problems = [];
  page.on('pageerror', e => problems.push(String(e).slice(0, 200)));
  page.on('requestfailed', r => { if (!r.url().startsWith('blob:')) problems.push('failed ' + r.url()); });   // a saved file is a blob that the download takes
  await page.goto(server.url + '/lyric-sync/index.html', {waitUntil: 'load'});
  const times = () => page.locator('li.line input[type=number]').evaluateAll(els => els.map(e => Number(e.value)));
  assert.match(await page.locator('#keyless h2').textContent(), /APIキーなし/);

  // a file with no times is refused with a reason
  await page.locator('#rough').setInputFiles({name: 'plain.txt', mimeType: 'text/plain', buffer: Buffer.from('ただの歌詞\n', 'utf8')});
  await page.waitForFunction(() => /タイミングを読み取れませんでした/.test(document.getElementById('status').textContent));
  assert.equal(await page.locator('li.line').count(), 0);

  // the rough SRT: four lines, all marked as guesses, 0.8 s early
  await page.locator('#rough').setInputFiles({name: 'rough.srt', mimeType: 'application/x-subrip', buffer: Buffer.from(srt, 'utf8')});
  await page.waitForFunction(() => document.querySelectorAll('li.line').length === 4);
  assert.deepEqual(await times(), truth.map(([s]) => +(s - 0.8).toFixed(2)));
  assert.equal(await page.locator('li.line.guess').count(), 4);
  assert.equal(await page.locator('#unsnap').isHidden(), true);

  // without a song there is a clear message
  await page.locator('#snap').click();
  assert.match(await page.locator('#status').textContent(), /曲のファイルを選んでください/);

  // with the song: every line moves to where the voice comes in
  await page.locator('#audio').setInputFiles({name: 'song.wav', mimeType: 'audio/wav', buffer: wav});
  await page.locator('#snap').click();
  await page.waitForFunction(() => /4行のうち 4 行を、声の立ち上がりに合わせました/.test(document.getElementById('status').textContent), null, {timeout: 30000});
  (await times()).forEach((t, i) => assert.ok(Math.abs(t - truth[i][0]) <= 0.2, `line ${i + 1}: ${t} vs ${truth[i][0]}`));
  assert.equal(await page.locator('li.line.guess').count(), 0, 'all four are measured, none is a guess');
  assert.equal(await page.locator('#unsnap').isVisible(), true);
  assert.deepEqual(await page.locator('li.line input.t').evaluateAll(els => els.map(e => e.value)), ['うた1', 'うた2', 'うた3', 'うた4']);

  // the LRC that is saved carries the new times
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#lrc').click()]);
  const lrc = await (await import('node:fs/promises')).readFile(await download.path(), 'utf8');
  const first = lrc.split('\n')[0].match(/^\[(\d\d):(\d\d\.\d\d)\]うた1$/);
  assert.ok(first && Math.abs(Number(first[1]) * 60 + Number(first[2]) - truth[0][0]) <= 0.2, lrc.split('\n')[0]);

  // and the rough times come back
  await page.locator('#unsnap').click();
  assert.deepEqual(await times(), truth.map(([s]) => +(s - 0.8).toFixed(2)));
  assert.equal(await page.locator('li.line.guess').count(), 4);
  assert.deepEqual(problems, []);
  console.log('PASS lyric timing page without an API key: rough SRT loaded, lines snapped to the voice, rough times restored');
} finally { await browser.close(); await server.close(); }
