// Editor-style timeline under the stage: image clips with ◆ transitions between them, the song waveform and the lyric lines.
// It only draws and interprets gestures; every change goes through the `api` handed in by sequence.js.
const DEFAULT_LYRIC_HEIGHT = 72;
const RULER_H = 24, HEAD_W = 64, EDGE = 7;

export function createTimeline(root, api) {
  const el = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; parent?.append(e); return e; };
  const TRACK_H = { img: 64, aud: 48, lyr: DEFAULT_LYRIC_HEIGHT };
  root.replaceChildren();
  const heightHandle=el('div','tl-height-handle',root);
  heightHandle.tabIndex=0;heightHandle.setAttribute('role','separator');heightHandle.setAttribute('aria-orientation','horizontal');heightHandle.setAttribute('aria-label','歌詞タイムラインの高さ');heightHandle.title='上へドラッグで歌詞を広く表示・上下キーで調整・ダブルクリックで戻す';
  const bar = el('div', 'tl-bar', root);
  const body = el('div', 'tl-body', root);
  const heads = el('div', 'tl-heads', body);
  for (const [k, label] of [['ruler', ''], ['img', '画像'], ['aud', '音声'], ['lyr', '歌詞']]) {
    const h = el('div', 'tl-head', heads); h.textContent = label; h.style.height = (k === 'ruler' ? RULER_H : TRACK_H[k]) + 'px';
  }
  const scroller = el('div', 'tl-scroll', body);
  const content = el('div', 'tl-content', scroller);
  const ruler = el('canvas', 'tl-ruler', scroller);
  const imgTrack = el('div', 'tl-track tl-img', content);
  const audTrack = el('div', 'tl-track tl-aud', content);
  const wave = el('canvas', 'tl-wave', scroller);
  const lyrTrack = el('div', 'tl-track tl-lyr', content);
  const playhead = el('div', 'tl-playhead', scroller);
  const marker = el('div', 'tl-marker', content);
  imgTrack.style.top = RULER_H + 'px'; imgTrack.style.height = TRACK_H.img + 'px';
  audTrack.style.top = RULER_H + TRACK_H.img + 'px'; audTrack.style.height = TRACK_H.aud + 'px';
  lyrTrack.style.top = RULER_H + TRACK_H.img + TRACK_H.aud + 'px'; lyrTrack.style.height = TRACK_H.lyr + 'px';
  let totalH = RULER_H + TRACK_H.img + TRACK_H.aud + TRACK_H.lyr;
  content.style.height = totalH + 'px';

  // toolbar
  const button = (label, title, fn) => { const b = el('button', 'btn', bar); b.textContent = label; b.title = title; b.onclick = fn; return b; };
  const undoB = button('↶', '元に戻す（⌘/Ctrl+Z）', () => api.undo());
  const redoB = button('↷', 'やり直す（⇧⌘Z / Ctrl+Y）', () => api.redo());
  el('span', 'tl-sep', bar);
  button('－', '縮小', () => zoomAt(0.7, scroller.clientWidth / 2));
  button('＋', '拡大（⌘/Ctrl+ホイールでも）', () => zoomAt(1.4, scroller.clientWidth / 2));
  button('全体', '全体を表示', () => fit());
  el('span', 'tl-sep', bar);
  const linkB = el('label', 'tl-toggle', bar);
  const linkIn = el('input', '', linkB); linkIn.type = 'checkbox';
  linkB.append(' 歌詞と画像を連動');
  linkIn.onchange = () => api.setLink(linkIn.checked);
  const snapB = el('label', 'tl-toggle', bar);
  const snapIn = el('input', '', snapB); snapIn.type = 'checkbox'; snapIn.checked = true;
  snapB.append(' 拍に吸着');
  el('span', 'tl-sep', bar);
  button('書き出し', 'プロジェクトを1つのファイルに保存', () => api.exportProject());
  button('読み込み', '保存したプロジェクトファイル（.unfold）を開く', () => api.importProject());
  button('新規', '空のシーケンスから始める（自動保存も空にする）', () => api.newProject());
  button('保存先…', 'パソコンのファイルにも自動で保存する（ブラウザのデータが消えても残る）', () => api.chooseSaveFile());
  const status = el('span', 'tl-status', bar);

  let pps = 20, total = 0, sel = null, drag = null, lay = null, peaks = null, peakRate = 200;

  const snapBeat = b => snapIn.checked ? Math.round(b * 2) / 2 : b;
  const x2t = x => (x + scroller.scrollLeft) / pps;
  const clientX2t = cx => x2t(cx - scroller.getBoundingClientRect().left);

  function fit() {
    const w = Math.max(200, scroller.clientWidth - 20);
    pps = Math.max(2, Math.min(400, w / Math.max(5, total)));
    scroller.scrollLeft = 0;
    render();
  }
  function zoomAt(f, anchorX) {
    const t = x2t(anchorX);
    pps = Math.max(2, Math.min(400, pps * f));
    render();
    scroller.scrollLeft = Math.max(0, t * pps - anchorX);
    drawCanvases();
  }

  // ------------------------------------------------------------ drawing --
  function render() {
    lay = api.layout();
    total = lay.total;
    const width = Math.max(scroller.clientWidth, (total + 4) * pps);
    content.style.width = width + 'px';
    const s = api.state();
    linkIn.checked = !!s.link;linkB.hidden=s.lyricMode==='overlay';
    undoB.disabled = !s.canUndo; redoB.disabled = !s.canRedo;
    sel = s.selection;
    // images + transitions
    imgTrack.replaceChildren();
    lay.slides.forEach((sl, i) => {
      const clip = el('div', 'tl-clip' + (sel?.kind === 'slide' && sel.i === i ? ' sel' : ''), imgTrack);
      clip.style.left = sl.start * pps + 'px'; clip.style.width = Math.max(4, (sl.end - sl.start) * pps) + 'px';
      clip.dataset.kind = 'slide'; clip.dataset.i = i;
      const info = api.slideInfo(i);
      if (info.thumb) { const im = el('img', '', clip); im.src = info.thumb; im.draggable = false; }
      const name = el('span', 'tl-name', clip); name.textContent = `${i + 1}  ${info.name}`;
      if (info.lyric) clip.classList.add('lyric');
      el('div', 'tl-edge right', clip).dataset.edge = 'hold';
    });
    lay.transitions.forEach((tr, i) => {
      const b = el('div', 'tl-trans' + (sel?.kind === 'tr' && sel.i === i ? ' sel' : ''), imgTrack);
      b.style.left = tr.start * pps + 'px'; b.style.width = Math.max(6, (tr.end - tr.start) * pps) + 'px';
      b.dataset.kind = 'tr'; b.dataset.i = i;
      const info = api.transitionInfo(i);
      b.title = info.title;
      const lab = el('span', 'tl-name', b); lab.textContent = '◆ ' + info.label;
      if (info.flat) b.classList.add('flat');
      // a thin strip under the label: amber = ぐちゃぐちゃ, violet = 立体化 (matches the two "引き" sliders)
      if (info.bands?.length) el('div', 'tl-phases', b).style.background = 'linear-gradient(90deg,' +
        info.bands.map(([k, a, z]) => `transparent ${a}%,var(--phase-${k}) ${a}%,var(--phase-${k}) ${z}%,transparent ${z}%`).join(',') + ')';
      el('div', 'tl-edge left', b).dataset.edge = 'trStart';
      el('div', 'tl-edge right', b).dataset.edge = 'trEnd';
    });
    // lyrics (song time → video time)
    lyrTrack.replaceChildren();
    const L = s.lyrics;
    L.forEach((l, i) => {
      if (!Number.isFinite(l.s)) return;
      const start = l.s - s.offset;
      const end = Number.isFinite(l.e) ? l.e - s.offset : (Number.isFinite(L[i + 1]?.s) ? L[i + 1].s - s.offset : start + 2);
      const b = el('div', 'tl-lyric'+(l.isBoundary?' boundary':'') + (sel?.kind === 'lyric' && sel.i === i ? ' sel' : '') + (l.k === 'chorus' ? ' chorus' : '') + (api.isLinked(i) ? ' linked' : ''), lyrTrack);
      b.style.left = start * pps + 'px'; b.style.width = Math.max(8, (end - start) * pps - 2) + 'px';
      b.dataset.kind = 'lyric'; b.dataset.i = i;
      b.textContent = l.t.replace(/\//g, ' ');
      b.title = `${l.t}
${l.s.toFixed(2)} - ${(end+s.offset).toFixed(2)}秒
中央をドラッグで移動・左右の端で長さ調整`;
      if(s.lyricMode==='overlay'&&!l.isBoundary){
        el('div','tl-edge left',b).dataset.edge='lyricStart';
        el('div','tl-edge right',b).dataset.edge='lyricEnd';
      }
    });
    // audio block
    audTrack.replaceChildren();
    if (s.audioDuration) {
      const a = el('div', 'tl-audio', audTrack);
      a.style.left = -s.offset * pps + 'px'; a.style.width = s.audioDuration * pps + 'px';
      a.dataset.kind = 'audio';
      a.title = 'ドラッグで曲の開始位置をずらす';
      if (!peaks || peaks.buffer !== s.audioBuffer) peaks = computePeaks(s.audioBuffer);
    } else peaks = null;
    status.textContent = s.status || '';
    drawCanvases();
    setTime(s.t, false);
  }
  function computePeaks(buffer) {
    if (!buffer) return null;
    const ch = buffer.getChannelData(0), per = Math.max(1, Math.floor(buffer.sampleRate / peakRate)), n = Math.floor(ch.length / per);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) { let m = 0; for (let j = i * per; j < (i + 1) * per; j += 4) m = Math.max(m, Math.abs(ch[j])); out[i] = m; }
    return { buffer, data: out };
  }
  function drawCanvases() {
    const w = scroller.clientWidth, dpr = Math.min(2, devicePixelRatio || 1);
    for (const [c, h, top] of [[ruler, RULER_H, 0], [wave, TRACK_H.aud, RULER_H + TRACK_H.img]]) {
      c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
      c.style.left = scroller.scrollLeft + 'px'; c.style.top = top + 'px';
    }
    const s = api.state(), x0 = scroller.scrollLeft;
    // ruler: seconds, and beats when zoomed in enough
    let g = ruler.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#141b1c'; g.fillRect(0, 0, w, RULER_H);
    const B = 60 / s.bpm;
    if (B * pps > 6) {
      g.fillStyle = '#2c3a37';
      const first = Math.ceil((x0 / pps + s.offset - s.phase) / B);
      for (let k = first; ; k++) { const x = (s.phase - s.offset + k * B) * pps - x0; if (x > w) break; g.fillRect(x, RULER_H - 6, 1, 6); }
    }
    const stepS = [1, 2, 5, 10, 15, 30, 60].find(v => v * pps >= 60) || 60;
    g.fillStyle = '#96a19b'; g.font = '11px ui-monospace, monospace';
    for (let t = Math.floor(x0 / pps / stepS) * stepS; ; t += stepS) {
      const x = t * pps - x0; if (x > w) break;
      g.fillRect(x, 0, 1, RULER_H); g.fillText(`${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`, x + 4, 14);
    }
    // waveform of the visible stretch
    g = wave.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, TRACK_H.aud);
    if (peaks) {
      g.fillStyle = 'rgba(217,248,120,.75)';
      const mid = TRACK_H.aud / 2;
      for (let x = 0; x < w; x++) {
        const t0 = (x + x0) / pps + s.offset, t1 = (x + 1 + x0) / pps + s.offset;
        const a = Math.floor(t0 * peakRate), b = Math.max(a + 1, Math.floor(t1 * peakRate));
        if (b <= 0 || a >= peaks.data.length) continue;
        let m = 0; for (let i = Math.max(0, a); i < Math.min(b, peaks.data.length); i++) m = Math.max(m, peaks.data[i]);
        const h = Math.max(1, m * (mid - 3)); g.fillRect(x, mid - h, 1, h * 2);
      }
    }
  }
  function setTime(t, follow = true) {
    const x = t * pps;
    // the playhead lives inside the scrolling area, so it already moves with the scroll: place it at plain time × zoom
    playhead.style.transform = `translateX(${x}px)`;
    playhead.style.height = totalH + 'px';
    if (follow && (x < scroller.scrollLeft || x > scroller.scrollLeft + scroller.clientWidth - 40)) {
      scroller.scrollLeft = Math.max(0, x - 60); drawCanvases();
    }
  }
  scroller.addEventListener('scroll', () => { drawCanvases(); setTime(api.state().t, false); });
  scroller.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - scroller.getBoundingClientRect().left); }
  }, { passive: false });
  new ResizeObserver(() => drawCanvases()).observe(scroller);

  // ----------------------------------------------------------- gestures --
  scroller.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const rect = scroller.getBoundingClientRect(), y = e.clientY - rect.top;
    const target = e.target.closest('[data-kind]');
    const edge = e.target.dataset.edge;
    if (y < RULER_H || !target) {   // ruler or empty space: scrub
      drag = { mode: 'scrub' };
      api.seek(Math.max(0, clientX2t(e.clientX)));
    } else {
      const kind = target.dataset.kind, i = Number(target.dataset.i);
      if (kind !== 'audio') api.select({ kind, i });
      drag = { mode: edge || kind, i, x: e.clientX, moved: false, target };
    }
    e.preventDefault();scroller.setPointerCapture(e.pointerId);
  });
  scroller.addEventListener('pointermove', e => {
    if (!drag) return;
    if (drag.mode === 'scrub') { api.seek(Math.max(0, clientX2t(e.clientX))); return; }
    const dx = e.clientX - drag.x;
    if (!drag.moved) { if (Math.abs(dx) < 4) return; drag.moved = true; api.beginEdit(); drag.base = api.snapshotTimes(); }
    const dt = dx / pps;
    if (drag.mode === 'slide') {   // reorder: show where it would land
      const t = clientX2t(e.clientX);
      const to = nearestGap(t);
      marker.style.display = 'block'; marker.style.left = gapX(to) + 'px'; marker.style.top = RULER_H + 'px'; marker.style.height = TRACK_H.img + 'px';
      drag.to = to;
      return;
    }
    api.dragEdit(drag.mode, drag.i, dt, drag.base, snapBeat, snapIn.checked);
  });
  scroller.addEventListener('pointerup', e => {
    if (!drag) return;
    if (drag.mode === 'slide' && drag.moved && drag.to != null) api.moveSlide(drag.i, drag.to);
    else if (drag.moved) api.endEdit();
    else if (drag.mode !== 'scrub' && drag.mode !== 'audio') api.seek(clientX2t(e.clientX));
    marker.style.display = 'none';
    drag = null;
  });
  scroller.addEventListener('pointercancel', () => {if(drag?.moved)api.endEdit();drag=null;marker.style.display='none';});
  scroller.addEventListener('dblclick', e => {
    const b = e.target.closest('.tl-lyric');
    if (b) api.editLyricText(Number(b.dataset.i));
  });
  // dropping picture files: on a clip = replace it, anywhere else on the image row = insert there
  scroller.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); scroller.classList.add('drop'); } });
  scroller.addEventListener('dragleave', () => scroller.classList.remove('drop'));
  scroller.addEventListener('drop', e => {
    e.preventDefault(); scroller.classList.remove('drop');
    const files = [...e.dataTransfer.files].filter(f => /^image\//.test(f.type));
    if (!files.length) return;
    const clip = e.target.closest('.tl-clip');
    if (clip) api.replaceSlide(Number(clip.dataset.i), files[0]);
    else api.insertImages(files, nearestGap(clientX2t(e.clientX)));
  });
  function gapX(k) { return (k <= 0 ? 0 : k >= lay.slides.length ? lay.slides[lay.slides.length - 1].end : lay.slides[k].start) * pps; }
  function nearestGap(t) {
    let best = 0, bd = Infinity;
    for (let k = 0; k <= lay.slides.length; k++) { const d = Math.abs(gapX(k) / pps - t); if (d < bd) { bd = d; best = k; } }
    return best;
  }


  let heightDrag=null,preferredHeight=DEFAULT_LYRIC_HEIGHT;
  const heightKey='unfold-lyric-track-height';
  try{const n=Number(localStorage.getItem(heightKey));if(Number.isFinite(n)&&n>=DEFAULT_LYRIC_HEIGHT)preferredHeight=n}catch{}
  function setHeight(n,save=false){
    const max=Math.max(DEFAULT_LYRIC_HEIGHT,Math.min(360,innerHeight-440));
    TRACK_H.lyr=Math.round(Math.max(DEFAULT_LYRIC_HEIGHT,Math.min(max,n)));
    totalH=RULER_H+TRACK_H.img+TRACK_H.aud+TRACK_H.lyr;
    content.style.height=totalH+'px';lyrTrack.style.height=TRACK_H.lyr+'px';heads.lastElementChild.style.height=TRACK_H.lyr+'px';
    heightHandle.setAttribute('aria-valuemin',String(DEFAULT_LYRIC_HEIGHT));heightHandle.setAttribute('aria-valuemax',String(max));heightHandle.setAttribute('aria-valuenow',String(TRACK_H.lyr));
    setTime(api.state().t,false);
    if(save){preferredHeight=TRACK_H.lyr;try{localStorage.setItem(heightKey,String(preferredHeight))}catch{}}
  }
  heightHandle.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();heightHandle.focus();heightDrag={id:e.pointerId,y:e.clientY,h:TRACK_H.lyr};heightHandle.setPointerCapture(e.pointerId)});
  heightHandle.addEventListener('pointermove',e=>{if(heightDrag?.id===e.pointerId)setHeight(heightDrag.h+heightDrag.y-e.clientY)});
  const endHeight=e=>{if(heightDrag?.id!==e.pointerId)return;heightDrag=null;setHeight(TRACK_H.lyr,true)};
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])heightHandle.addEventListener(ev,endHeight);
  heightHandle.addEventListener('dblclick',()=>setHeight(DEFAULT_LYRIC_HEIGHT,true));
  heightHandle.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();setHeight(TRACK_H.lyr+(e.key==='ArrowUp'?20:-20),true)}});
  window.addEventListener('resize',()=>setHeight(preferredHeight));setHeight(preferredHeight);

  return { render, fit, setTime, setStatus: t => { status.textContent = t; } };
}
