/**
 * Mobile first screen (≤768px only): the painting is the player.
 *
 * The handscroll is read right to left: progress 0 shows the right end of the
 * painting, progress 1 the left end, so the painting slides rightwards as it plays.
 * 聆听图景 plays the existing scroll video's soundtrack (scroll-placeholder.mp4,
 * AAC, ~160 s; the video layer itself stays invisible) and the pan follows
 * video.currentTime. If that source errors or cannot play, the same button
 * drives a pure timed pan of PLACEHOLDER_SECONDS instead. No new audio source.
 * Dragging the painting scrubs the progress. Desktop never runs any of this.
 */
const PLACEHOLDER_SECONDS = 160; // matches the existing soundtrack length
const AXIS_SLOP = 8;
const DIRECTION = 1; // 1: right→left handscroll reading; -1 would pan left→right
const DWELL_STEPS = 3;   // dwell mode: vertical swipes needed to pan the whole painting
const DWELL_MS = 450;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export function mountMobileHero() {
  const mq = matchMedia('(max-width: 768px)');
  const hero = document.getElementById('scroll-hero');
  const pan = hero && hero.querySelector('.hero-pan');
  const still = hero && hero.querySelector('.hero-still');
  const video = document.getElementById('scroll-video');
  const button = document.getElementById('snd');
  const label = button && button.querySelector('.lb');
  const fill = document.getElementById('m-prog-fill');
  const time = document.getElementById('m-prog-time');
  const nav = document.getElementById('home-nav');
  if (!hero || !pan || !still || !button) return null;

  let active = false;     // mobile mode bound
  let progress = 0;       // 0..1 along the scroll
  let playing = false;
  let source = 'video';   // 'video' | 'timed'
  let raf = 0;
  let lastNow = 0;
  let range = 0;
  let scrub = null;

  const videoUsable = () => !!(video && video.getAttribute('src') && !video.error);
  const duration = () => (source === 'video' && video && Number.isFinite(video.duration) && video.duration > 0)
    ? video.duration : PLACEHOLDER_SECONDS;

  function measure() {
    // Never scale the painting up: cap its height at the natural height.
    const natural = still.naturalHeight || 0;
    still.style.height = natural && natural < hero.clientHeight ? `${natural}px` : '';
    range = Math.max(0, still.offsetWidth - hero.clientWidth);
  }

  function render() {
    const x = DIRECTION > 0 ? -range * (1 - progress) : -range * progress;
    pan.style.setProperty('--pan-x', `${x.toFixed(1)}px`);
    if (fill) fill.style.setProperty('--prog', progress.toFixed(4));
    if (time) time.textContent = `${mmss(progress * duration())} / ${mmss(duration())}`;
  }

  function setButton(on) {
    button.setAttribute('aria-pressed', String(on));
    if (label) label.textContent = on ? '暂停' : '聆听图景';
    button.setAttribute('aria-label', on ? '暂停长卷' : '聆听图景');
  }

  function tick(now) {
    const dt = Math.min(100, now - lastNow);
    lastNow = now;
    if (playing && !scrub) {
      if (source === 'video' && video && !video.paused && Number.isFinite(video.duration) && video.duration > 0) {
        progress = clamp01(video.currentTime / video.duration);
      } else if (source === 'timed') {
        progress = clamp01(progress + dt / (PLACEHOLDER_SECONDS * 1000));
        if (progress >= 1) pause();
      }
      render();
    }
    raf = playing ? requestAnimationFrame(tick) : 0;
  }

  function startTicking() {
    if (raf) return;
    lastNow = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function fallbackToTimed() {
    source = 'timed';
    if (video) { try { video.pause(); } catch (_) {} video.muted = true; }
    render();
  }

  function seekVideo() {
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    try { video.currentTime = progress * video.duration; } catch (_) {}
  }

  function play() {
    if (progress >= 0.999) progress = 0;
    playing = true;
    setButton(true);
    if (source === 'video' && videoUsable()) {
      video.loop = false;
      video.muted = false;
      video.defaultMuted = false;
      video.removeAttribute('muted');
      try { video.volume = 1; } catch (_) {}
      if (Number.isFinite(video.duration) && video.duration > 0) seekVideo();
      else video.addEventListener('loadedmetadata', seekVideo, { once: true });
      const attempt = video.play();
      if (attempt) attempt.catch((err) => {
        if (err && err.name === 'AbortError') return;
        if (playing) fallbackToTimed();
      });
    } else {
      source = 'timed';
    }
    startTicking();
  }

  function pause() {
    playing = false;
    setButton(false);
    if (video) { try { video.pause(); } catch (_) {} }
  }

  function onButton(e) {
    if (!active) return;
    e.stopImmediatePropagation();
    if (playing) pause(); else play();
  }

  // ---- scrub: horizontal drag on the painting; vertical stays page scroll ----
  function onDown(e) {
    if (!active || (e.pointerType === 'mouse' && e.button !== 0)) return;
    scrub = { id: e.pointerId, x0: e.clientX, y0: e.clientY, p0: progress, axis: '' };
  }
  function onMove(e) {
    if (!scrub || e.pointerId !== scrub.id) return;
    const dx = e.clientX - scrub.x0;
    const dy = e.clientY - scrub.y0;
    if (!scrub.axis) {
      if (Math.abs(dx) < AXIS_SLOP && Math.abs(dy) < AXIS_SLOP) return;
      scrub.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (scrub.axis === 'y') { scrub = null; return; }
      scrub.x0 = e.clientX;
      scrub.p0 = progress;
      try { hero.setPointerCapture(e.pointerId); } catch (_) {}
    }
    // the painting follows the finger
    const ddx = e.clientX - scrub.x0;
    progress = clamp01(scrub.p0 + (DIRECTION * ddx) / Math.max(1, range));
    render();
  }
  function onUp(e) {
    if (!scrub || e.pointerId !== scrub.id) return;
    const wasX = scrub.axis === 'x';
    scrub = null;
    if (wasX && source === 'video') seekVideo();
  }

  function onVideoEnded() {
    if (!active || source !== 'video') return;
    progress = 1;
    render();
    pause();
  }
  function onVideoError() {
    if (!active) return;
    if (playing) fallbackToTimed(); else source = 'timed';
  }

  // nav reads as the mock's light gradient while it sits over the painting
  const navIo = nav && 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      const over = entries.some((en) => en.isIntersecting);
      nav.classList.toggle('on-hero', active && over);
    }, { rootMargin: '-52px 0px 0px 0px', threshold: 0 })
    : null;

  function bind() {
    if (active) return;
    active = true;
    if (video) {
      // mobile: no background autoplay; the soundtrack starts on 聆听图景
      video.autoplay = false;
      video.loop = false;
      try { video.pause(); } catch (_) {}
      video.muted = true;
      if (video.error) source = 'timed';
    }
    setButton(false);
    measure();
    render();
    navIo && navIo.observe(hero);
  }

  function unbind() {
    if (!active) return;
    pause();
    active = false;
    scrub = null;
    pan.style.removeProperty('--pan-x');
    still.style.height = '';
    if (label) label.textContent = '聆听图景';
    button.removeAttribute('aria-label');
    if (nav) nav.classList.remove('on-hero');
    navIo && navIo.disconnect();
  }

  // capture phase so the desktop listener never sees mobile taps
  button.addEventListener('click', onButton, true);
  hero.addEventListener('pointerdown', onDown);
  hero.addEventListener('pointermove', onMove);
  hero.addEventListener('pointerup', onUp);
  hero.addEventListener('pointercancel', onUp);
  hero.addEventListener('dragstart', (e) => { if (active) e.preventDefault(); });
  if (video) {
    video.addEventListener('ended', onVideoEnded);
    video.addEventListener('error', onVideoError);
    video.addEventListener('loadedmetadata', () => active && render());
  }
  still.addEventListener('load', () => { if (active) { measure(); render(); } });
  window.addEventListener('resize', () => { if (active) { measure(); render(); } });
  mq.addEventListener?.('change', () => (mq.matches ? bind() : unbind()));
  if (mq.matches) bind();

  // ---- dwell controller (used by mobile-pager.js when this page has data-dwell="on") ----
  let dwellAnim = 0;
  function animateTo(target) {
    if (dwellAnim) cancelAnimationFrame(dwellAnim);
    const from = progress;
    const t0 = performance.now();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = (now) => {
      const t = reduce ? 1 : Math.min(1, (now - t0) / DWELL_MS);
      progress = from + (target - from) * (1 - Math.pow(1 - t, 3));
      render();
      if (t < 1) dwellAnim = requestAnimationFrame(step);
      else { dwellAnim = 0; if (source === 'video') seekVideo(); }
    };
    dwellAnim = requestAnimationFrame(step);
  }
  return {
    canStep(dir) {
      if (!active || range <= 0) return false;
      return dir > 0 ? progress < 0.999 : progress > 0.001;
    },
    step(dir) {
      const S = DWELL_STEPS;
      const k = dir > 0 ? Math.floor(progress * S + 1e-3) + 1 : Math.ceil(progress * S - 1e-3) - 1;
      animateTo(clamp01(k / S));
    },
    get progress() { return progress; },
  };
}
