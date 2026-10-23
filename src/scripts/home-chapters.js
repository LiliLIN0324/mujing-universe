/**
 * Homepage chapters (desktop ≥769px).
 *
 * Scroll position is the only clock: each chapter holds, then a short
 * crossfade (Perlin smootherstep) while the incoming picture settles
 * from scale 1.04 to 1. Nothing advances on a timer.
 * The first picture also settles once on arrival.
 * 聆听图景 is opt-in. The scroll video stays paused until that click.
 *
 * --hold in CSS (extra viewports resting on the last chapter) must match
 * the data-hold attribute on #fs-runway.
 */
const INTRO_MS = 760;
const FADE = 0.22;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smootherstep = (x) => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function bindListen(buttons, video) {
  const list = buttons.filter(Boolean);
  if (!list.length || !video) return { stop() {}, get on() { return false; } };
  const fill = document.getElementById('m-prog-fill');
  const time = document.getElementById('m-prog-time');
  let on = false;
  let raf = 0;

  function paintProgress() {
    const dur = Number.isFinite(video.duration) ? video.duration : 0;
    const p = dur > 0 ? clamp01(video.currentTime / dur) : 0;
    if (fill) fill.style.setProperty('--prog', p.toFixed(4));
    if (time) time.textContent = `${mmss(video.currentTime)} / ${mmss(dur)}`;
  }
  function tick() {
    paintProgress();
    raf = on ? requestAnimationFrame(tick) : 0;
  }
  function setPressed(next) {
    on = next;
    video.classList.toggle('is-on', next);
    for (const button of list) {
      button.setAttribute('aria-pressed', String(next));
      const label = button.querySelector('.lb');
      if (label) label.textContent = next ? '静音' : '聆听图景';
    }
  }
  function stop() {
    setPressed(false);
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    try { video.pause(); } catch (_) {}
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function fail() {
    stop();
    for (const button of list) button.disabled = true;
  }
  function attach() {
    const src = video.dataset.src;
    if (!src) return false;
    video.playsInline = true;
    video.loop = true;
    if (video.getAttribute('src') !== src) video.src = src;
    return true;
  }
  video.addEventListener('error', () => { if (on) fail(); });
  for (const button of list) {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      if (on) { stop(); return; }
      if (!attach()) { fail(); return; }
      setPressed(true);
      video.muted = false;
      video.defaultMuted = false;
      video.removeAttribute('muted');
      try { video.volume = 1; } catch (_) {}
      const pending = video.play();
      if (pending) pending.catch((err) => {
        if (err && err.name === 'AbortError') return;
        stop();
        if (video.error) fail();
      });
      if (!raf) raf = requestAnimationFrame(tick);
    });
  }
  const hero = document.getElementById('scroll-hero-m');
  if (hero && matchMedia('(max-width: 768px)').matches) {
    new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) stop();
    }, { threshold: 0.35 }).observe(hero);
  }
  return { stop, get on() { return on; } };
}

export function mountHomeChapters() {
  const video = document.getElementById('scroll-video');
  const media = bindListen(
    [document.getElementById('snd'), document.getElementById('snd-m')],
    video,
  );

  document.querySelectorAll('img[data-fallback]').forEach((img) => {
    img.addEventListener('error', () => {
      const fb = img.getAttribute('data-fallback');
      if (!fb || img.getAttribute('src') === fb) return;
      img.setAttribute('src', fb);
    });
  });

  const runway = document.getElementById('fs-runway');
  const stage = document.getElementById('fs-stage');
  const desktop = matchMedia('(min-width: 769px)');
  if (!runway || !stage) return;
  if (!desktop.matches) {
    desktop.addEventListener('change', () => {
      if (desktop.matches) startChapters(runway, stage, media);
    }, { once: true });
    return;
  }
  startChapters(runway, stage, media);
}

function startChapters(runway, stage, media) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const slides = Array.from(stage.querySelectorAll('.fs-slide'));
  const dots = Array.from(stage.querySelectorAll('.fs-dot'));
  const n = slides.length;
  if (!n) return;
  const hold = Number(runway.dataset.hold || '0.85') || 0.85;
  const introStart = performance.now();
  let lastScroll = 0;
  let running = false;

  function progress() {
    const view = window.innerHeight || 1;
    const total = Math.max(1, runway.offsetHeight - view);
    const scrolled = Math.min(Math.max(-runway.getBoundingClientRect().top, 0), total);
    return scrolled / total;
  }
  function chapterAt(p) {
    const x = p * ((n - 1) + hold);
    if (x >= n - 1) return { i: n - 1, blend: 0 };
    const i = Math.floor(x);
    const frac = x - i;
    const blend = frac > 1 - FADE ? smootherstep((frac - (1 - FADE)) / FADE) : 0;
    return { i, blend };
  }
  function fadeOut(blend) {
    if (blend <= 0) return 1;
    if (blend >= 0.4) return 0;
    return 1 - smootherstep(blend / 0.4);
  }
  function fadeIn(blend) {
    if (blend <= 0.25) return 0;
    if (blend >= 0.7) return 1;
    return smootherstep((blend - 0.25) / 0.45);
  }
  function place(slide, imageOpacity, scale, plateOpacity, y) {
    const visible = imageOpacity > 0.01 || plateOpacity > 0.01;
    slide.style.opacity = visible ? '1' : '0';
    slide.style.transform = `translate3d(0,0,0) scale(${scale.toFixed(4)})`;
    slide.style.zIndex = imageOpacity > 0.5 ? '2' : '1';
    slide.style.pointerEvents = plateOpacity > 0.55 ? 'auto' : 'none';
    slide.setAttribute('aria-hidden', String(plateOpacity < 0.08 && imageOpacity < 0.08));
    slide.toggleAttribute('inert', plateOpacity < 0.5);
    const media = slide.querySelector('.fs-pan, .fs-bg');
    if (media) media.style.opacity = imageOpacity.toFixed(4);
    const plate = slide.querySelector('.fs-plate');
    if (plate) {
      plate.style.opacity = plateOpacity.toFixed(4);
      plate.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
    }
  }
  function apply(now) {
    const p = progress();
    let { i, blend } = chapterAt(p);
    if (reduce) {
      const x = Math.min(p * ((n - 1) + hold), n - 1);
      i = Math.min(n - 1, Math.round(x));
      blend = 0;
    }
    const intro = reduce ? 1 : smootherstep(Math.min(1, (now - introStart) / INTRO_MS));
    stage.style.setProperty('--p', p.toFixed(4));
    let front = i;
    slides.forEach((slide, idx) => {
      if (idx === i && blend === 0 && idx === 0 && p < 0.001) {
        place(slide, 1, 1.04 - 0.04 * intro, intro, 18 * (1 - intro));
        return;
      }
      if (idx === i) {
        const plateO = blend ? fadeOut(blend) : 1;
        place(slide, 1 - blend, blend ? 1 + 0.03 * blend : 1, plateO, blend ? -8 * (1 - plateO) : 0);
        return;
      }
      if (idx === i + 1 && blend > 0) {
        const plateO = fadeIn(blend);
        place(slide, blend, 1.04 - 0.04 * blend, plateO, 16 * (1 - plateO));
        if (blend > 0.5) front = idx;
        return;
      }
      place(slide, 0, 1.04, 0, 16);
    });
    dots.forEach((dot, idx) => {
      const on = idx === front;
      dot.classList.toggle('on', on);
      if (on) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    if (front !== 0 && media.on) media.stop();
  }
  function step(now) {
    apply(now);
    const introLive = !reduce && now - introStart < INTRO_MS + 40;
    const scrolling = performance.now() - lastScroll < 180;
    if (introLive || scrolling) requestAnimationFrame(step);
    else running = false;
  }
  function kick() {
    lastScroll = performance.now();
    if (running) return;
    running = true;
    requestAnimationFrame(step);
  }
  function scrollToIndex(index) {
    const view = window.innerHeight || 1;
    const span = (n - 1) + hold;
    const p = Math.min(Math.max(index, 0), n - 1) / span;
    const total = Math.max(0, runway.offsetHeight - view);
    const top = runway.getBoundingClientRect().top + window.scrollY + p * total;
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    kick();
  }
  dots.forEach((dot, idx) => dot.addEventListener('click', () => scrollToIndex(idx)));
  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', kick);
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const rect = runway.getBoundingClientRect();
    const view = window.innerHeight || 1;
    if (rect.bottom < view * 0.45 || rect.top > view * 0.4) return;
    const { i, blend } = chapterAt(progress());
    const current = blend > 0.5 ? Math.min(i + 1, n - 1) : i;
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
    const next = current + dir;
    if (next < 0) return;
    e.preventDefault();
    if (next >= n) {
      document.getElementById('cta')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    scrollToIndex(next);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) media.stop(); });
  kick();
}
