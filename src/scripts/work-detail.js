/**
 * Work detail page: hero guard, 聆听图景 (only where real audio exists), the
 * full-scroll strip (drag / swipe + progress line) and, ≤768px, page-by-page.
 */
import { mountMobilePager } from './mobile-pager.js';

export function mountWorkDetail() {
  // ---- hero: full height, never scaled above the image's natural height ----
  const hero = document.querySelector('.wd-hero');
  const heroImg = hero && hero.querySelector('img');
  const guard = () => {
    if (!hero || !heroImg || !heroImg.naturalHeight) return;
    heroImg.style.height = heroImg.naturalHeight < hero.clientHeight ? `${heroImg.naturalHeight}px` : '';
  };
  if (heroImg) { heroImg.addEventListener('load', guard); if (heroImg.complete) guard(); window.addEventListener('resize', guard); }

  // ---- 主视觉：有真实视频时，进入画面就静音循环；减少动效时只留播放按钮 ----
  const motion = hero && hero.querySelector('video.wd-motion');
  const playBtn = document.getElementById('wd-hero-play');
  if (motion && hero) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) motion.dataset.wanted = '1';
    const label = (on) => {
      if (!playBtn) return;
      playBtn.setAttribute('aria-pressed', String(on));
      playBtn.textContent = on ? '暂停' : '播放';
    };
    const kick = () => {
      if (motion.dataset.wanted !== '1') return;
      if (!motion.getAttribute('src') && motion.dataset.src) motion.src = motion.dataset.src;
      if (motion.dataset.hearing !== '1') motion.muted = true;
      const attempt = motion.play();
      if (attempt) attempt.catch((err) => { if (!err || err.name !== 'AbortError') label(false); });
    };
    motion.addEventListener('playing', () => { hero.classList.add('is-on'); label(true); });
    motion.addEventListener('pause', () => { hero.classList.remove('is-on'); label(false); });
    motion.addEventListener('error', () => {
      if (!motion.getAttribute('src')) return;
      motion.remove();
      playBtn?.remove();
      hero.classList.remove('is-on', 'has-motion');
    });
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (!motion.paused) {
          motion.dataset.wanted = '';
          motion.pause();
          return;
        }
        motion.dataset.wanted = '1';
        kick();
      });
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) kick();
        else if (!motion.paused) motion.pause();
      });
    }, { threshold: 0.35 });
    io.observe(hero);
  }

  // ---- 聆听图景: 西湖的声音和主视觉是同一条片子，开声音只取消静音，不把画面按停 ----
  const btn = document.getElementById('wd-listen');
  const media = document.getElementById('wd-audio');
  if (btn && media) {
    const label = btn.querySelector('.lb');
    const set = (on) => { btn.setAttribute('aria-pressed', String(on)); if (label) label.textContent = on ? '暂停' : '聆听图景'; };
    const visual = media.dataset.audio === '1';
    btn.addEventListener('click', () => {
      if (visual) {
        if (media.dataset.hearing === '1') {
          media.dataset.hearing = '';
          media.muted = true;
          set(false);
          return;
        }
        if (!media.getAttribute('src')) media.src = media.dataset.src;
        media.dataset.hearing = '1';
        media.muted = false;
        media.dataset.wanted = '1';
        set(true);
        const attempt = media.play();
        if (attempt) attempt.catch((err) => {
          if (!err || err.name !== 'AbortError') {
            media.dataset.hearing = '';
            media.muted = true;
            set(false);
          }
        });
        return;
      }
      if (!media.paused) { media.pause(); set(false); return; }
      if (!media.getAttribute('src')) media.src = media.dataset.src;
      media.muted = false;
      set(true);
      const attempt = media.play();
      if (attempt) attempt.catch((err) => { if (!err || err.name !== 'AbortError') set(false); });
    });
    media.addEventListener('playing', () => { if (media.dataset.hearing === '1') set(true); });
    media.addEventListener('pause', () => set(false));
    media.addEventListener('ended', () => set(false));
    media.addEventListener('error', () => {
      if (visual && !media.getAttribute('src')) return;
      set(false);
      btn.disabled = true;
    });
  }

  // ---- full-scroll strip ----
  const strip = document.getElementById('wd-strip');
  const prog = document.getElementById('wd-prog');
  let stripDwell = null;
  if (strip) {
    const max = () => Math.max(0, strip.scrollWidth - strip.clientWidth);
    const sync = () => { if (prog) prog.style.setProperty('--p', max() ? (strip.scrollLeft / max()).toFixed(4) : '0'); };
    strip.addEventListener('scroll', sync, { passive: true });
    strip.querySelector('img')?.addEventListener('load', sync);
    sync();
    // mouse drag (touch uses native horizontal scrolling)
    let drag = null;
    strip.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, left: strip.scrollLeft };
      strip.setPointerCapture(e.pointerId);
      strip.classList.add('is-drag');
    });
    strip.addEventListener('pointermove', (e) => { if (drag) strip.scrollLeft = drag.left - (e.clientX - drag.x); });
    const end = () => { drag = null; strip.classList.remove('is-drag'); };
    strip.addEventListener('pointerup', end);
    strip.addEventListener('pointercancel', end);
    strip.addEventListener('dragstart', (e) => e.preventDefault());
    // dwell controller: vertical swipes walk the strip one screen at a time
    stripDwell = {
      canStep: (dir) => (dir > 0 ? strip.scrollLeft < max() - 2 : strip.scrollLeft > 2),
      step: (dir) => strip.scrollBy({ left: dir * strip.clientWidth * 0.9, behavior: 'smooth' }),
    };
  }

  // ---- ≤768px page-by-page (same mechanism as the homepage) ----
  mountMobilePager([...document.querySelectorAll('.wd-page')].map((el) => ({
    el,
    dwell: el.querySelector('#wd-strip') ? stripDwell : null,
  })));
}
