// Plays the preview of a card while the mouse is over it; on a touch screen (or from the keyboard) a tap / Enter starts and stops it.
// Only one plays at a time, and a video is created only when it is asked for, so a page with many cards does not load them all.
const canHover = matchMedia('(hover: hover) and (pointer: fine)');
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const stop = shot => { shot.classList.remove('playing'); shot.querySelector('video')?.remove(); };
const play = shot => {
  if (shot.classList.contains('playing') || !shot.dataset.clip) return;
  document.querySelectorAll('.shot.playing').forEach(stop);
  const video = document.createElement('video');
  Object.assign(video, { src: shot.dataset.clip, muted: true, loop: true, playsInline: true, autoplay: true });
  shot.append(video);
  shot.classList.add('playing');
  video.play().catch(() => { /* the browser said no (data saver, autoplay rules): the picture just stays */ });
};
for (const shot of document.querySelectorAll('.shot')) {
  shot.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && !calm.matches) play(shot); });
  shot.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') stop(shot); });
  // a click is the tap on a touch screen or the Enter key; with a mouse the pointer being over the card already did the work
  shot.addEventListener('click', () => { if (canHover.matches && !calm.matches) return; shot.classList.contains('playing') ? stop(shot) : play(shot); });
  shot.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); shot.classList.contains('playing') ? stop(shot) : play(shot); } });
}
