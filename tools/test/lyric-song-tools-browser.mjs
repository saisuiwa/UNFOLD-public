// The 05 曲・歌詞 tab's song tools and the ◆'s "how fast is this" help, in the sequence page:
//  曲を外す (lyrics stay, Undo brings the song back), the Suno mp3's own lyrics, 歌詞を曲に合わせる（自動） putting the heard times on the
//  lines (the result is fed in as the button would; the listening itself needs the 250MB Whisper, see SONG below), SRT で保存 (and read back),
//  and on a ◆: what its movement changes + 動きを全部元に戻す, and the length in seconds + back to the usual length.
//   UNFOLD_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/test/lyric-song-tools-browser.mjs
// SONG = a Suno mp3 with its lyrics inside (ID3 USLT); skipped when it is not on this computer.
import { existsSync, readFileSync } from 'node:fs';
import { launchBrowser } from '../lib/browser.mjs';
import { startStaticServer } from '../lib/static-server.mjs';
import { parseTimings } from '../../app/lyric-timings.js';

const SONG = process.env.UNFOLD_SUNO_SONG || '/Volumes/ORICO/MOTION_LAB_曲/歌合わせテスト_2026-10-31_Suno/夜のホーム_Suno.mp3';
const server = await startStaticServer();
const browser = await launchBrowser();
const failures = [];
const need = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
  const problems = [];
  page.on('pageerror', e => problems.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.goto(server.url + '/sequence.html');
  await page.waitForFunction(() => window.unfoldSeq && document.querySelector('#lyric-motion-controls'));
  await page.evaluate(() => document.querySelector('[data-tab="lyric"]').click());
  const lines = () => page.evaluate(() => (unfoldSeq.seq.lyricDocument?.events || []).filter(e => e.kind === 'line').map(e => ({ id: e.id, text: e.text, s: e.s, e: e.e, src: e.timingSource })));
  const removeBtn = () => page.evaluate(() => { const b = [...document.querySelectorAll('#lyric-motion-controls button')].find(b => b.textContent === '曲を外す'); return b ? { hidden: b.hidden, display: getComputedStyle(b).display } : null; });

  need((await removeBtn())?.display === 'none', '曲を外す is hidden while there is no song');
  const haveSong = existsSync(SONG);
  if (haveSong) {
    const b64 = readFileSync(SONG).toString('base64');
    await page.evaluate(async b64 => { const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); await unfoldSeq.loadAudio(new Blob([bytes], { type: 'audio/mpeg' }), '夜のホーム_Suno.mp3'); }, b64);
  } else {
    console.log('SKIP the Suno song (not here): a made-up tone instead');
    await page.evaluate(async () => { const ctx = new OfflineAudioContext(1, 48000 * 20, 48000), o = ctx.createOscillator(); o.connect(ctx.destination); o.start(); const buf = await ctx.startRendering();
      const wav = (b => { const d = b.getChannelData(0), out = new DataView(new ArrayBuffer(44 + d.length * 2)); const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
        w(0, 'RIFF'); out.setUint32(4, 36 + d.length * 2, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, 48000, true); out.setUint32(28, 96000, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, d.length * 2, true); d.forEach((x, i) => out.setInt16(44 + i * 2, x * 3000, true)); return out.buffer; })(buf);
      await unfoldSeq.loadAudio(new Blob([wav], { type: 'audio/wav' }), 'tone.wav');
      unfoldSeq.lyricAction({ type: 'text', value: '夜のホーム\n光を追いかけて\n明日へつなぐ' }); });
  }
  await page.waitForTimeout(500);
  const loaded = await lines();
  need(loaded.length >= 3, `the song's lyrics are in (${loaded.length} lines${haveSong ? ', from the Suno mp3' : ''})`);
  const status = await page.textContent('#lyric-motion-controls .lm-candidates + .lm-status');
  if (haveSong) need(/曲に入っていた(時刻付きの)?歌詞を取り込みました/.test(status), `the status says the lyrics inside the song were taken in: ${status}`);
  need((await removeBtn())?.display !== 'none', '曲を外す shows once a song is in');

  // 曲を外す → lyrics stay, Undo brings the song back
  await page.evaluate(() => [...document.querySelectorAll('#lyric-motion-controls button')].find(b => b.textContent === '曲を外す').click());
  await page.waitForTimeout(300);
  const gone = await page.evaluate(() => ({ buffer: !!unfoldSeq.seq.audioBuffer, name: unfoldSeq.seq.audioName, blob: !!unfoldSeq.seq.audioBlob }));
  need(!gone.buffer && !gone.name && !gone.blob, `曲を外す removes the song (${JSON.stringify(gone)})`);
  need((await lines()).length === loaded.length, 'the lyrics stay after 曲を外す');
  need((await removeBtn())?.display === 'none', '曲を外す hides again');
  await page.evaluate(() => unfoldSeq.undo());
  await page.waitForTimeout(300);
  need(await page.evaluate(() => !!unfoldSeq.seq.audioBuffer && !!unfoldSeq.seq.audioName), 'Undo brings the song back');

  // the auto button is there and asks for nothing without lyrics problems; feed it a result as it would
  need(await page.evaluate(() => !!document.querySelector('#auto-sync.lm-auto')), '歌詞を曲に合わせる（自動） is in 3 曲に合わせる');
  const fed = (await lines()).map((l, i) => ({ id: l.id, s: 2 + i * 3.5, e: 2 + i * 3.5 + 2.8 }));
  await page.evaluate(lines => unfoldSeq.lyricAction({ type: 'auto-timing', lines }), fed);
  const timed = await lines();
  need(timed.every((l, i) => l.s === fed[i].s && l.e === fed[i].e && l.src === 'auto'), 'the heard times land on the lines (source: auto)');
  await page.evaluate(() => unfoldSeq.undo());
  need(JSON.stringify((await lines()).map(l => l.s)) === JSON.stringify(loaded.map(l => l.s)), 'Undo puts the old times back');
  await page.evaluate(lines => unfoldSeq.lyricAction({ type: 'auto-timing', lines }), fed);

  // SRT で保存 → a file that reads back to the same lines and times
  const [download] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => [...document.querySelectorAll('#lyric-motion-controls button')].find(b => /SRTで保存/.test(b.textContent)).click())]);
  const srt = readFileSync(await download.path(), 'utf8');
  need(/\.srt$/.test(download.suggestedFilename()), `the file is .srt (${download.suggestedFilename()})`);
  const back = parseTimings(srt, 'x.srt');
  need(back.length === fed.length && back.every((c, i) => Math.abs(c.s - fed[i].s) < 1e-3 && Math.abs(c.e - fed[i].e) < 1e-3), `the SRT reads back to the same ${back.length} lines and times`);

  // a ◆: what its movement changes + one button back, and its length
  await page.evaluate(() => document.querySelector('[data-tab="edit"]').click());
  await page.evaluate(() => { unfoldSeq.timelineApi.select({ kind: 'tr', i: 0 }); });
  await page.waitForTimeout(300);
  const box = '#seq-inspector';
  if (await page.$(`${box} .solid-motion`)) {
    await page.evaluate(() => [...document.querySelectorAll('#seq-inspector .shot-actions button')].find(b => b.textContent === '中央で寄って戻す').click());
    await page.waitForTimeout(200);
    const shown = await page.evaluate(() => { const c = document.querySelector('#seq-inspector .solid-motion-changes'), r = document.querySelector('#seq-inspector .solid-motion-reset'); return { text: c.textContent, hidden: c.hidden || r.hidden }; });
    need(!shown.hidden && /カメラの移動/.test(shown.text), `the ◆ says what it changes: ${shown.text}`);
    await page.click(`${box} .solid-motion-reset`);
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => ({ cam: unfoldSeq.seq.transitions[0].shot?.camera?.enabled, hidden: document.querySelector('#seq-inspector .solid-motion-changes').hidden }));
    need(after.cam === false && after.hidden, `動きを全部元に戻す turns the camera move off (${JSON.stringify(after)})`);
    await page.evaluate(() => { unfoldSeq.seq.transitions[0].beats = 2; unfoldSeq.timelineApi.select({ kind: 'tr', i: 0 }); });
    await page.waitForTimeout(300);
    const len = await page.evaluate(() => ({ note: document.querySelector('#seq-inspector .len-note')?.textContent, short: document.querySelector('#seq-inspector .len-note')?.classList.contains('len-short'), btn: document.querySelector('#seq-inspector .len-reset')?.textContent }));
    need(/秒（2拍）/.test(len.note || '') && len.short && /拍に戻す/.test(len.btn || ''), `a short ◆ shows its seconds and a way back (${JSON.stringify(len)})`);
    await page.click(`${box} .len-reset`);
    await page.waitForTimeout(300);
    need(await page.evaluate(() => unfoldSeq.seq.transitions[0].beats) > 2, 'the ◆ is back to the usual length');
  } else need(false, 'the ◆ inspector shows 立体の動き');
  need(!problems.length, `no page errors ${problems.join(' | ')}`);
} finally {
  await browser.close(); server.close();
}
console.log(failures.length ? `${failures.length} FAILED` : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
