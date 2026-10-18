/**
 * Mobile homepage paging (≤768px only).
 *
 * Paging itself is CSS: html { scroll-snap-type: y mandatory } and every page
 * section has scroll-snap-align: start + scroll-snap-stop: always, so one
 * swipe / fling moves exactly one page.
 *
 * Dwell (per page, data-dwell="on" | "off", set from PAGE_DWELL in index.astro):
 * while a dwell page is the current page, vertical swipes are captured and fed to
 * that page's controller ({ canStep(dir), step(dir) }) until its content reaches
 * the end in that direction; then the swipe is released to the native snap and
 * the page flips. dir = +1 is "next" (finger moves up), -1 is "back".
 *
 * Fling guard: Chrome does not always honour scroll-snap-stop on a hard fling
 * (seen skipping a page going back up). Each gesture records the page it started
 * on and the scroll position is clamped to [previous page top, next page top]
 * until the scroll settles, so even a fast fling moves at most one page.
 */
const AXIS_SLOP = 6;
const STEP_MIN = 24; // px of vertical travel that counts as a swipe

export function mountMobilePager(pages) {
  const mq = matchMedia('(max-width: 768px)');
  const list = pages.filter((p) => p && p.el);
  if (!list.length) return;

  function currentPage() {
    const y = window.scrollY;
    let best = null;
    for (const p of list) {
      const top = p.el.getBoundingClientRect().top + y;
      if (Math.abs(top - y) <= 4) best = p;
    }
    return best;
  }

  // ---- fling guard ----
  let fence = null;
  let idle = 0;
  function tops() {
    const y = window.scrollY;
    return list.map((p) => Math.round(p.el.getBoundingClientRect().top + y));
  }
  function armFence() {
    const t = tops();
    const y = window.scrollY;
    let i = 0;
    for (let k = 0; k < t.length; k++) if (t[k] <= y + 4) i = k;
    const maxY = document.documentElement.scrollHeight - window.innerHeight;
    const lo = i > 0 ? t[i - 1] : 0;
    const hi = i < t.length - 1 ? t[i + 1] : maxY;
    fence = { lo, hi };
  }
  function releaseLater() {
    clearTimeout(idle);
    idle = setTimeout(() => { if (!touching) fence = null; }, 220);
  }
  let touching = false;
  window.addEventListener('scroll', () => {
    if (!fence || !mq.matches) return;
    const y = window.scrollY;
    if (y < fence.lo - 1) window.scrollTo({ top: fence.lo, behavior: 'instant' });
    else if (y > fence.hi + 1) window.scrollTo({ top: fence.hi, behavior: 'instant' });
    releaseLater();
  }, { passive: true });

  let g = null;
  document.addEventListener('touchstart', (e) => {
    if (!mq.matches || e.touches.length !== 1) { g = null; return; }
    touching = true;
    clearTimeout(idle);
    // re-arm from the page we're resting on; keep the old fence only mid-momentum
    const y = window.scrollY;
    const maxY = document.documentElement.scrollHeight - window.innerHeight;
    if (!fence || y >= maxY - 4 || tops().some((v) => Math.abs(v - y) <= 4)) armFence();
    const t = e.touches[0];
    g = { x0: t.clientX, y0: t.clientY, axis: '', dir: 0, page: null, captured: false };
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x0;
    const dy = t.clientY - g.y0;
    if (!g.axis) {
      if (Math.abs(dx) < AXIS_SLOP && Math.abs(dy) < AXIS_SLOP && !(Math.abs(dy) > 0 && Math.abs(dx) === 0)) return;
      g.axis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
      if (g.axis === 'x') return; // horizontal: painting scrub / card stack handle it
      g.dir = dy < 0 ? 1 : -1;
      const page = currentPage();
      if (page && page.el.dataset.dwell === 'on' && page.dwell && page.dwell.canStep(g.dir)) {
        g.page = page;
        g.captured = true;
      }
    }
    if (g.captured && e.cancelable) e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchend', (e) => {
    touching = false;
    releaseLater();
    if (!g) return;
    const d = g;
    g = null;
    if (!d.captured) return;
    const t = e.changedTouches[0];
    const dy = t ? t.clientY - d.y0 : 0;
    if (Math.abs(dy) >= STEP_MIN) d.page.dwell.step(d.dir);
  }, { passive: true });
  document.addEventListener('touchcancel', () => { g = null; touching = false; releaseLater(); }, { passive: true });
}
