// How a picture sits in the frame, in the real sequence page: the import dialog, the slide panel, undo, save and load, and STUDIO's drawing of it.
// A test picture has a red band at its top, a blue band at its bottom and grey between, so "is the top cut off?" is a pixel, not an opinion.
//   node tools/test/slide-frame-browser.mjs
import assert from 'node:assert/strict';
import { launchBrowser } from '../lib/browser.mjs';
import { startStaticServer } from '../lib/static-server.mjs';

const server = await startStaticServer();
const browser = await launchBrowser();
const errors = [];
const log = msg => console.log('ok -', msg);
const RED = ([r, g, b]) => r > 150 && g < 110 && b < 110, BLUE = ([r, g, b]) => b > 150 && r < 110, GREY = ([r, g, b]) => r > 90 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25, BG = ([r]) => r < 45;
const is = (name, test, px) => assert.ok(test(px), `${name}: got rgb(${px})`);

async function open() {
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(`${server.url}/sequence.html?empty`);
  await page.waitForFunction(() => window.unfoldSeq);
  return page;
}
// a picture as a file: red band on top (10%), blue band at the bottom (10%), grey between
const picture = (page, w, h, name) => page.evaluate(async ([w, h, name]) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, w, h); x.fillStyle = '#e03030'; x.fillRect(0, 0, w, h * .1); x.fillStyle = '#3050e0'; x.fillRect(0, h * .9, w, h * .1);
  const bytes = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer());
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return { name, mimeType: 'image/png', base64: btoa(s) };
}, [w, h, name]).then(f => ({ name: f.name, mimeType: f.mimeType, buffer: Buffer.from(f.base64, 'base64') }));
// the colour of one pixel of slide i's frame (1920×1080), as the sequence really drew it
const px = (page, i, x, y) => page.evaluate(([i, x, y]) => {
  const q = unfoldSeq.seq, B = 60 / q.bpm; let t = 0;
  for (let k = 0; k < i; k++) t += (q.slides[k].hold ?? q.holdBeats) * B + q.transitions[k].beats * B;
  unfoldSeq.renderAt(t + .01);
  const d = q.slides[i].canvas.getContext('2d').getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]];
}, [i, x, y]);
const frames = page => page.evaluate(() => unfoldSeq.seq.slides.map(s => s.frame ? JSON.parse(JSON.stringify(s.frame)) : null));
const dialog = page => page.locator('.sfd');
const mode = (page, text) => page.locator('.sfd-modes label', { hasText: text }).click();
const press = (page, label) => page.locator('.sfd-actions button', { hasText: label }).click();
const gone = async page => { await dialog(page).waitFor({ state: 'detached' }); await page.waitForTimeout(300); };

try {
  // 0. the cut-off itself, with the old way of adding a picture (no frame): fill cuts the top and bottom, "whole" does not
  {
    const page = await open();
    await page.evaluate(async f => { await unfoldSeq.addImageBlob(new Blob([Uint8Array.from(atob(f), c => c.charCodeAt(0))], { type: 'image/png' }), 'tate'); }, (await picture(page, 540, 960, 'tate')).buffer.toString('base64'));
    is('a picture added without a frame, fill on: the top is cut off', GREY, await px(page, 0, 960, 40));
    await page.evaluate(() => { unfoldSeq.seq.fill = false; document.getElementById('seq-fill').checked = false; document.getElementById('seq-fill').dispatchEvent(new Event('change')); });
    is('fill off: the top is there', RED, await px(page, 0, 960, 40));
    is('fill off: the bottom is there', BLUE, await px(page, 0, 960, 1040));
    is('fill off: bars at the side', BG, await px(page, 0, 200, 540));
    log('without a frame the slide behaves as before (fill cuts, fill off shows all)');
    await page.close();
  }

  // 1. the dialog opens for a picture of another shape; "whole" is chosen first and shows everything
  {
    const page = await open();
    await page.locator('#seq-files').setInputFiles([await picture(page, 540, 960, 'tate.png')]);
    await dialog(page).waitFor();
    assert.equal(await page.locator('.sfd h2 small').count(), 0, 'one picture: no "1 / 1"');
    assert.ok(await page.locator('.sfd-modes label:has-text("全体を見せる") input').isChecked());
    assert.equal(await page.locator('.sfd-actions button', { hasText: '残り' }).count(), 0, 'nothing left to apply to');
    await press(page, '取り込む'); await gone(page);
    assert.deepEqual(await frames(page), [{ fit: 'contain' }]);
    is('whole: top', RED, await px(page, 0, 960, 40)); is('whole: bottom', BLUE, await px(page, 0, 960, 1040)); is('whole: side', BG, await px(page, 0, 200, 540));
    log('a 9:16 picture asks, and "全体を見せる" keeps its top and bottom');

    // the panel: adjust, then undo / redo
    await page.evaluate(() => { unfoldSeq.seq.selection = { kind: 'slide', i: 0 }; unfoldSeq.refreshUI(); });
    assert.match(await page.locator('[data-role=frame-state]').innerText(), /全体を見せる/);
    await page.getByRole('button', { name: /切り抜き・収め方を調整/ }).click();
    await dialog(page).waitFor();
    assert.ok(await page.locator('.sfd-modes label:has-text("全体を見せる") input').isChecked(), 'starts from what the slide has');
    assert.equal(await page.locator('.sfd h2 small').count(), 0);
    await mode(page, '画面いっぱいにする');
    await page.locator('.sfd-stage').focus();
    for (let k = 0; k < 40; k++) await page.keyboard.press('ArrowUp');          // 1% each: to the top of the picture
    await press(page, '決定'); await gone(page);
    let [f] = await frames(page);
    assert.equal(f.fit, 'cover'); assert.ok(f.crop.y < .001 && f.crop.w > .999, JSON.stringify(f));
    is('screen at the top: the top shows', RED, await px(page, 0, 960, 40)); is('screen: fills the frame', GREY, await px(page, 0, 200, 540));
    assert.match(await page.locator('[data-role=frame-state]').innerText(), /切り抜いて、画面いっぱい/);
    await page.evaluate(() => unfoldSeq.undo());
    assert.deepEqual(await frames(page), [{ fit: 'contain' }], 'undo');
    is('undo: bars are back', BG, await px(page, 0, 200, 540));
    await page.evaluate(() => unfoldSeq.redo());
    [f] = await frames(page); assert.equal(f.fit, 'cover');
    is('redo', GREY, await px(page, 0, 200, 540));
    log('the slide panel re-opens the dialog; undo and redo bring back the frame');

    // reset to the project-wide setting
    await page.getByRole('button', { name: /切り抜き・収め方を調整/ }).click();
    await dialog(page).waitFor();
    assert.ok(await page.locator('.sfd-modes label:has-text("画面いっぱいにする") input').isChecked(), 'a kept cut-out opens as a screen cut-out');
    await press(page, '全体設定に戻す'); await gone(page);
    assert.deepEqual(await frames(page), [null]);
    is('the project-wide setting again (fill on)', GREY, await px(page, 0, 960, 40));
    log('"全体設定に戻す" removes the frame');
    await page.close();
  }

  // 2. a free cut-out: a corner changes the size, all of the cut-out is shown
  {
    const page = await open();
    await page.locator('#seq-files').setInputFiles([await picture(page, 960, 540, 'plain16-9.png'), await picture(page, 1500, 500, 'yoko.png')]);
    await dialog(page).waitFor();
    assert.equal(await page.locator('.sfd h2 small').count(), 0, 'only the wide one is asked about');
    await mode(page, '自由に切り抜く');
    const before = await page.locator('.sfd-crop').boundingBox();
    const se = await page.locator('.sfd-crop i[data-h=se]').boundingBox();
    await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2); await page.mouse.down();
    await page.mouse.move(se.x + se.width / 2 - 60, se.y + se.height / 2 - 20, { steps: 5 }); await page.mouse.up();
    const after = await page.locator('.sfd-crop').boundingBox();
    assert.ok(after.width < before.width - 40 && after.height < before.height - 10 && Math.abs(after.x - before.x) < 2, 'the opposite corner stays, the size changes');
    assert.equal(await page.locator('.sfd-actions button', { hasText: '残り' }).isHidden(), true, 'a free cut-out is not carried over to others');
    await press(page, '取り込む'); await gone(page);
    const fs = await frames(page);
    assert.equal(fs[0], null, 'a picture of the frame\'s shape gets no frame');
    assert.equal(fs[1].fit, 'contain'); assert.ok(fs[1].crop && fs[1].crop.w < .8 && fs[1].crop.h < .8, JSON.stringify(fs[1]));
    is('the cut-out is shown whole, so bars above and below', BG, await px(page, 1, 960, 20));
    log('a free cut-out: dragging a corner, shown whole; a 16:9 picture is not asked about');
    await page.close();
  }

  // 3. several pictures: "残りも同じ設定で" asks once
  {
    const page = await open();
    await page.locator('#seq-files').setInputFiles([await picture(page, 540, 960, 'a.png'), await picture(page, 960, 540, 'b.png'), await picture(page, 600, 1000, 'c.png'), await picture(page, 3000, 1000, 'd.png')]);
    await dialog(page).waitFor();
    assert.match(await page.locator('.sfd h2 small').innerText(), /1 \/ 3/, 'three of the four are asked about');
    await mode(page, '画面いっぱいにする');
    assert.match(await page.locator('.sfd-actions button', { hasText: '残り' }).innerText(), /残り2枚/);
    await press(page, '残り');
    await gone(page);
    assert.equal(await dialog(page).count(), 0, 'asked once');
    const fs = await frames(page);
    assert.equal(fs.length, 4); assert.equal(fs[1], null);
    for (const k of [0, 2, 3]) assert.equal(fs[k].fit, 'cover', `slide ${k}`);
    assert.ok(fs[3].crop.h > .999 && fs[3].crop.w < .6, 'the wide one is cut to the screen\'s shape along its own width');
    for (const k of [0, 2, 3]) is(`slide ${k} fills the frame`, GREY, await px(page, k, 100, 540));
    log('"残りも同じ設定で" applies one choice to every other picture that needs it');
    await page.close();
  }

  // 4. backing out adds nothing; Escape too
  {
    const page = await open();
    await page.locator('#seq-files').setInputFiles([await picture(page, 540, 960, 'a.png'), await picture(page, 600, 1000, 'b.png')]);
    await dialog(page).waitFor(); await press(page, 'やめる'); await gone(page);
    assert.equal(await page.evaluate(() => unfoldSeq.seq.slides.length), 0);
    await page.locator('#seq-files').setInputFiles([await picture(page, 540, 960, 'a.png')]);
    await dialog(page).waitFor(); await page.keyboard.press('Escape'); await gone(page);
    assert.equal(await page.evaluate(() => unfoldSeq.seq.slides.length), 0);
    assert.equal(await page.evaluate(() => unfoldSeq.undo() ?? 'nothing'), 'nothing', 'nothing to undo: nothing was changed');
    log('やめる / Esc add nothing and leave no undo step');
    await page.close();
  }

  // 4b. two drops in a row are asked one after the other (never two dialogs at once); Enter decides; keys do not reach the page's shortcuts
  {
    const page = await open();
    await page.evaluate(() => { window.__keys = 0; addEventListener('keydown', e => { if (e.key === 'ArrowUp') window.__keys++; }); });
    await page.locator('#seq-files').setInputFiles([await picture(page, 540, 960, 'one.png')]);
    await page.locator('#seq-files').setInputFiles([await picture(page, 600, 1000, 'two.png')]);
    await dialog(page).first().waitFor();
    await page.waitForTimeout(600);
    assert.equal(await dialog(page).count(), 1, 'one dialog at a time');
    await mode(page, '画面いっぱいにする'); await page.locator('.sfd-stage').focus(); await page.keyboard.press('ArrowUp');
    assert.equal(await page.evaluate(() => window.__keys), 0, 'arrow keys stay in the dialog');
    await page.locator('.sfd-modes label:has-text("画面いっぱいにする") input').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.sfd').length === 1 && unfoldSeq.seq.slides.length === 1);   // the first was added, the next question is up
    await page.locator('.sfd-modes label:has-text("画面いっぱいにする") input').focus(); await page.keyboard.press('Enter'); await gone(page);
    assert.equal(await page.evaluate(() => unfoldSeq.seq.slides.length), 2, 'both were added');
    log('dialogs queue, Enter decides, and keys stay inside the dialog');
    await page.close();
  }

  // 5. dropping on the timeline and replacing a slide ask too; a replaced picture does not keep the old cut-out
  {
    const page = await open();
    await page.locator('#seq-files').setInputFiles([await picture(page, 960, 540, 'a.png')]);
    await page.waitForFunction(() => unfoldSeq.seq.slides.length === 1);
    const files = [await picture(page, 540, 960, 'tate.png')];
    const inserting = page.evaluate(async f => unfoldSeq.timelineApi.insertImages([new File([Uint8Array.from(atob(f.b), c => c.charCodeAt(0))], f.name, { type: 'image/png' })], 1), { b: files[0].buffer.toString('base64'), name: files[0].name });
    await dialog(page).waitFor(); await press(page, '取り込む'); await inserting; await gone(page);
    assert.deepEqual(await frames(page), [null, { fit: 'contain' }]);
    // replace the tall picture with a 16:9 one: no question, no stale frame
    const wide = await picture(page, 960, 540, 'b.png');
    await page.evaluate(async f => unfoldSeq.timelineApi.replaceSlide(1, new File([Uint8Array.from(atob(f), c => c.charCodeAt(0))], 'b.png', { type: 'image/png' })), wide.buffer.toString('base64'));
    await page.waitForFunction(() => unfoldSeq.seq.slides[1].name === 'b.png');
    assert.deepEqual(await frames(page), [null, null], 'the old frame is gone');
    // replace it with a tall one: asks again
    const tall = await picture(page, 540, 960, 'c.png');
    const replacing = page.evaluate(async f => unfoldSeq.timelineApi.replaceSlide(1, new File([Uint8Array.from(atob(f), c => c.charCodeAt(0))], 'c.png', { type: 'image/png' })), tall.buffer.toString('base64'));
    await dialog(page).waitFor(); await mode(page, '画面いっぱいにする'); await press(page, '取り込む'); await replacing; await gone(page);
    assert.equal((await frames(page))[1].fit, 'cover');
    log('inserting and replacing ask as well; a new picture does not inherit the old cut-out');
    await page.close();
  }

  // 6. save, load, duplicate, and the project-wide switch
  {
    const page = await open();
    await page.locator('#seq-files').setInputFiles([await picture(page, 540, 960, 'tate.png'), await picture(page, 960, 540, 'plain.png')]);
    await dialog(page).waitFor(); await mode(page, '画面いっぱいにする'); await press(page, '取り込む'); await gone(page);
    await page.evaluate(() => { unfoldSeq.seq.selection = { kind: 'slide', i: 0 }; unfoldSeq.refreshUI(); });
    await page.getByRole('button', { name: '複製' }).click();
    const copied = await frames(page);
    assert.equal(copied.length, 3); assert.deepEqual(copied[1], copied[0], 'a copy keeps the frame'); assert.equal(copied[2], null);
    const original = await frames(page);
    const back = await page.evaluate(async () => { const file = await unfoldSeq.exportProjectBlob(); await unfoldSeq.openProjectFile(new File([file], 'frame.unfold')); return unfoldSeq.seq.slides.map(s => s.frame ?? null); });
    assert.deepEqual(back, original, 'a .unfold file keeps every frame');
    // adjusting a slide that has no frame starts from what it shows now (fill is on: it fills the frame); the picture already has the frame's shape
    await page.evaluate(() => { unfoldSeq.seq.selection = { kind: 'slide', i: 2 }; unfoldSeq.refreshUI(); });
    await page.getByRole('button', { name: /切り抜き・収め方を調整/ }).click();
    await dialog(page).waitFor();
    assert.ok(await page.locator('.sfd-modes label:has-text("画面いっぱいにする") input').isChecked());
    assert.match(await page.locator('.sfd-note').innerText(), /収め方を選びます/);
    assert.equal(await page.locator('.sfd-actions button', { hasText: '全体設定に戻す' }).count(), 0, 'nothing to reset');
    await press(page, 'やめる'); await gone(page);
    // the project-wide switch moves slides that have no frame of their own, and leaves the others
    is('no frame, fill on: the middle fills', GREY, await px(page, 2, 100, 540));
    await page.evaluate(() => { document.getElementById('seq-fill').checked = false; document.getElementById('seq-fill').dispatchEvent(new Event('change')); });
    is('the framed slide does not follow the switch', GREY, await px(page, 0, 100, 540));
    log('frames survive save/load and duplicate; the project-wide switch leaves framed slides alone');
    // the file itself carries the frame (the header JSON comes first)
    const carries = await page.evaluate(async () => new TextDecoder().decode(new Uint8Array(await (await unfoldSeq.exportProjectBlob()).arrayBuffer()).slice(0, 20000)).includes('"crop"'));
    assert.ok(carries, 'the file really carries the crop');
    await page.close();
  }

  // 7. STUDIO draws a framed slide the same way (it has its own copy of the picture drawing)
  {
    const page = await open();
    const f = await picture(page, 540, 960, 'tate.png');
    const sample = await page.evaluate(async b64 => {
      const { createSequenceRenderer } = await import('/sequence-renderer.js');
      const blob = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' });
      const take = async frame => {
        const r = createSequenceRenderer({ assets: { get: async () => blob } });
        await r.prepare({ state: { settings: { fill: true, bg: '#111718' }, slides: [{ name: 't', img: 'a', ...(frame ? { frame } : {}) }], transitions: [] }, dependencies: ['a'] });
        const out = await r.render({ timeUs: 0, width: 640, height: 360 }), c = document.createElement('canvas'); c.width = 640; c.height = 360;
        const x = c.getContext('2d'); x.drawImage(out.bitmap, 0, 0);
        const at = (px, py) => [...x.getImageData(px, py, 1, 1).data.slice(0, 3)];
        const res = { top: at(320, 12), side: at(40, 180) }; out.close(); r.dispose(); return res;
      };
      return { none: await take(null), whole: await take({ fit: 'contain' }) };
    }, f.buffer.toString('base64'));
    is('STUDIO, no frame: the top is cut off as before', GREY, sample.none.top);
    is('STUDIO, whole: the top shows', RED, sample.whole.top);
    is('STUDIO, whole: bars at the side', BG, sample.whole.side);
    log('STUDIO draws the same frame');
    await page.close();
  }


  // 8. the single-picture page: the same dialog, and a picture shown whole stays whole
  {
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${server.url}/index.html`);
    await page.waitForFunction(() => window.unfold);
    const spx = (fx, fy) => page.evaluate(([fx, fy]) => {
      unfold.render();
      const c = document.querySelector('#scene'), o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
      const x = o.getContext('2d'); x.drawImage(c, 0, 0);
      const d = x.getImageData(Math.floor(c.width * fx), Math.floor(c.height * fy), 1, 1).data; return [d[0], d[1], d[2]];
    }, [fx, fy]);
    const tall = await picture(page, 540, 960, 'tate.png');
    // a script calling unfold.loadImage() is not stopped by a dialog; the picture fills the frame as it always did
    await page.evaluate(async b => { await unfold.loadImage(new File([Uint8Array.from(atob(b), c => c.charCodeAt(0))], 'tate.png', { type: 'image/png' })); }, tall.buffer.toString('base64'));
    assert.equal(await dialog(page).count(), 0); assert.equal(await page.evaluate(() => unfold.state.fit), 'cover');
    is('script import: the top is cut off as before', GREY, await spx(.5, .04));
    // choosing a file on the page asks
    await page.locator('#image-input').setInputFiles([tall]);
    await dialog(page).waitFor();
    assert.match(await page.locator('.sfd-note').innerText(), /16:9/);
    await press(page, '取り込む'); await gone(page);
    assert.equal(await page.evaluate(() => unfold.state.fit), 'contain');
    is('whole: the top shows', RED, await spx(.5, .04)); is('whole: the bottom shows', BLUE, await spx(.5, .96)); is('whole: bars at the side', BG, await spx(.05, .5));
    assert.match(await page.locator('#frame-state').innerText(), /全体を見せる/);
    // adjusting: screen cut-out, moved to the top
    await page.locator('#frame-adjust').click(); await dialog(page).waitFor();
    assert.ok(await page.locator('.sfd-modes label:has-text("全体を見せる") input').isChecked());
    await mode(page, '画面いっぱいにする'); await page.locator('.sfd-stage').focus();
    for (let k = 0; k < 40; k++) await page.keyboard.press('ArrowUp');
    await press(page, '決定'); await gone(page);
    assert.equal(await page.evaluate(() => unfold.state.fit), 'cover');
    is('cut out at the top: the top shows', RED, await spx(.5, .04)); is('cut out: fills the frame', GREY, await spx(.05, .5));
    assert.match(await page.locator('#frame-state').innerText(), /切り抜いて、画面いっぱい/);
    // a 16:9 picture is not asked about, and the sample has no adjust button
    await page.locator('#image-input').setInputFiles([await picture(page, 960, 540, 'plain.png')]);
    await page.waitForFunction(() => document.querySelector('#image-name').textContent === 'plain.png');
    assert.equal(await dialog(page).count(), 0);
    await page.locator('#demo').click();
    assert.equal(await page.locator('#frame-row').isHidden(), true);
    // dropping the picture asks as well, and backing out keeps the picture that was there
    await page.locator('#image-input').setInputFiles([tall]); await dialog(page).waitFor(); await press(page, 'やめる'); await gone(page);
    assert.equal(await page.locator('#image-name').innerText(), 'カラーテスト・サンプル');
    log('the single-picture page asks too, keeps a whole picture whole, and a script import is never stopped');
    await page.close();
  }

  // 9. STUDIO's 「UNFOLD を追加」 builds an UNFOLD from the first two pictures: one of another shape is shown whole instead of being cut off
  {
    const page = await open();
    const files = [await picture(page, 540, 960, 'tate.png'), await picture(page, 960, 540, 'yoko.png')];
    const slides = await page.evaluate(async fs => {
      const { createController } = await import('/studio/controller.js'), { openStudioStore } = await import('/studio/store.js');
      const c = createController({ store: await openStudioStore({ dbName: 'unfold-studio-frame-test' }) });
      await c.ready;
      await c.importMedia(fs.map(f => new File([Uint8Array.from(atob(f.b), ch => ch.charCodeAt(0))], f.name, { type: 'image/png' })));
      await c.addUnfold();
      const p = c.get().project;
      return Object.values(p.unfolds).at(-1).state.slides;
    }, files.map(f => ({ name: f.name, b: f.buffer.toString('base64') })));
    assert.equal(slides.length, 2);
    assert.deepEqual(slides.map(sl => sl.frame ?? null), [{ fit: 'contain' }, null], JSON.stringify(slides));
    log('STUDIO builds an UNFOLD that shows a tall picture whole and leaves a 16:9 one alone');
    await page.close();
  }

  assert.deepEqual(errors, [], 'no page errors');
  console.log('all passed');
} finally {
  await browser.close();
  await server.close();
}
