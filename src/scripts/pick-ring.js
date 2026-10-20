/**
 * Pick arc — one ellipse, one gaussian.
 *
 * Profile of the previous WebGL ring (1440×900, Chrome trace):
 * idle ~42fps, drag ~35fps (max frame 100ms). Every animation frame called
 * getBoundingClientRect (800+ forced layouts), uploaded a full WebGL frame of
 * 50×50 segment planes, and kept preserveDrawingBuffer. That was the jank.
 *
 * This version writes transform and opacity only, on a cached ellipse.
 * A float `position` (card index) is driven by drag velocity, a short coast,
 * then a critically damped spring onto the nearest card. Nothing runs when
 * the arc is at rest. No autoplay.
 */

const PHI = 1.618033988749895;
/**
 * Gaussian variance of card index.
 * g(1) ≈ 0.79, g(2) ≈ 0.39 ≈ 1/φ², g(3) ≈ 0.12.
 * One smooth falloff for scale and opacity; wide enough that five cards stay in the arc.
 */
const SIGMA2 = 2.15;
/** Radians of ellipse parameter per card. Same step everywhere. */
const THETA = 0.56;
const OMEGA = 12;
const COAST_DRAG = 3.4;
const VISIBLE = 3.35;

const mod = (n, m) => ((n % m) + m) % m;

function gauss(d) {
  return Math.exp(-(d * d) / (2 * SIGMA2));
}

function wrapDelta(i, position, n) {
  let d = i - position;
  d -= n * Math.round(d / n);
  return d;
}

export function mountPickRing(root, pickData) {
  const stage = root.querySelector('#pick-stage');
  const introEl = root.querySelector('#pick-intro');
  const listEl = root.querySelector('#pick-list');
  const listWindow = root.querySelector('.pick-list-window');
  const cards = [...root.querySelectorAll('.about__gallery__link')];
  const narrow = matchMedia('(max-width: 860px)');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const N = Math.min(cards.length, pickData.length);
  if (!stage || N < 2) return;

  cards.forEach((card) => {
    const img = card.querySelector('img');
    if (!img) return;
    const fail = () => {
      const next = img.dataset.fallback;
      const svg = '/scroll-placeholder.svg';
      if (next && img.getAttribute('src') !== next) {
        img.dataset.fallback = svg;
        img.src = next;
        return;
      }
      if (img.getAttribute('src') !== svg) img.src = svg;
    };
    img.addEventListener('error', fail);
    if (img.complete && img.getAttribute('src') && img.naturalWidth === 0) fail();
  });

  const titleLink = introEl && introEl.querySelector('[data-role="title-link"]');
  const summaryEl = introEl && introEl.querySelector('[data-role="summary"]');
  const metaEl = introEl && introEl.querySelector('[data-role="meta"]');
  const bodyEl = introEl && introEl.querySelector('[data-role="body"]');
  const viewEl = introEl && introEl.querySelector('[data-role="view"]');
  const rowEls = [...root.querySelectorAll('.pick-row')];
  const rowBtns = [...root.querySelectorAll('.pick-row-btn')];

  let position = 0;
  let velocity = 0;
  let mode = 'rest';
  let target = 0;
  let front = -1;
  /** Explicit selection. Copy tracks this until the arc arrives; drag clears it. */
  let announced = -1;
  let rx = 320;
  let ry = 122;
  let pxPer = 200;
  let anchor = 0;
  let runway = 1;
  let scrollY = window.scrollY;
  let isEnd = false;
  let zKey = null;
  let hot = false;
  let raf = 0;
  let lastTick = 0;
  const placed = [];

  function activeIndex(pos) {
    return mod(Math.round(pos), N);
  }

  function fillCopy(work) {
    if (!work) return;
    if (titleLink) {
      titleLink.textContent = work.title || '';
      if (work.href) titleLink.setAttribute('href', work.href);
    }
    if (summaryEl) {
      summaryEl.textContent = work.summary || '';
      summaryEl.hidden = !work.summary;
    }
    if (metaEl) {
      metaEl.textContent = work.meta || '';
      metaEl.hidden = !work.meta;
    }
    if (bodyEl) {
      bodyEl.textContent = work.body || '';
      bodyEl.hidden = !work.body;
    }
    if (viewEl && work.href) viewEl.setAttribute('href', work.href);
  }

  function syncList(index) {
    rowEls.forEach((row, i) => {
      const on = i === index;
      row.classList.toggle('is-active', on);
      const btn = row.querySelector('.pick-row-btn');
      if (!btn) return;
      if (on) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
  }

  function ensureRowVisible(index) {
    const row = rowEls[index];
    if (!row || !listWindow) return;
    const rowTop = row.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;
    const viewTop = listWindow.scrollTop;
    const viewBottom = viewTop + listWindow.clientHeight;
    if (rowTop < viewTop) listWindow.scrollTop = rowTop;
    else if (rowBottom > viewBottom) listWindow.scrollTop = rowBottom - listWindow.clientHeight;
  }

  function setFront(index, scrollList) {
    if (index === front) {
      if (scrollList) ensureRowVisible(index);
      return;
    }
    front = index;
    root.dataset.front = String(index);
    fillCopy(pickData[index]);
    syncList(index);
    if (scrollList || isEnd) ensureRowVisible(index);
  }

  function publish(scrollList) {
    const index = announced >= 0 ? announced : activeIndex(position);
    setFront(index, scrollList);
    if (announced >= 0 && mode === 'rest' && activeIndex(position) === announced) announced = -1;
  }

  /** Geometry for every card from one float. No DOM reads. */
  function pose(pos) {
    const out = [];
    for (let i = 0; i < N; i++) {
      const d = wrapDelta(i, pos, N);
      const g = gauss(d);
      const t = d * THETA;
      const x = rx * Math.sin(t);
      const y = -ry * (1 - Math.cos(t));
      let opacity = (g - 0.05) / 0.48;
      if (opacity < 0) opacity = 0;
      else if (opacity > 1) opacity = 1;
      out.push({
        i,
        d,
        x,
        y,
        scale: g,
        opacity,
        show: Math.abs(d) <= VISIBLE && opacity > 0.02,
      });
    }
    return out;
  }

  function apply(pos) {
    if (narrow.matches) return;
    const key = Math.round(pos * 2);
    const writeZ = key !== zKey;
    if (writeZ) zKey = key;
    const framePose = pose(pos);
    for (let i = 0; i < N; i++) {
      const p = framePose[i];
      placed[i] = p;
      const el = cards[i];
      if (!p.show) {
        if (el.dataset.on !== '0') {
          el.dataset.on = '0';
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
        }
        continue;
      }
      el.dataset.on = '1';
      el.style.opacity = p.opacity.toFixed(3);
      el.style.pointerEvents = Math.abs(p.d) < 2.35 ? 'auto' : 'none';
      el.style.transform = `translate3d(calc(-50% + ${p.x.toFixed(2)}px), calc(-50% + ${p.y.toFixed(2)}px), 0) scale(${p.scale.toFixed(4)})`;
      if (writeZ) el.style.zIndex = String(100 + Math.round(p.scale * 200));
    }
  }

  function measure() {
    if (narrow.matches) {
      root.style.height = '';
      return;
    }
    const card = cards[0];
    const cardW = card.offsetWidth || 420;
    const stageW = stage.clientWidth || 880;
    rx = Math.min(stageW * 0.34, cardW * 0.58);
    ry = rx / (PHI * PHI);
    pxPer = Math.max(120, rx * Math.sin(THETA));
    const limit = listWindow ? Math.max(window.innerHeight * 0.85, (listEl ? listEl.scrollHeight - listWindow.clientHeight : 0)) : window.innerHeight * 0.9;
    root.style.height = `${window.innerHeight + Math.max(window.innerHeight * 0.85, limit)}px`;
    anchor = root.getBoundingClientRect().top + window.scrollY;
    runway = Math.max(1, root.offsetHeight - window.innerHeight);
  }

  function updateProgress() {
    const p = Math.min(1, Math.max(0, (scrollY - anchor) / runway));
    const end = p > 0.92;
    if (end !== isEnd) {
      isEnd = end;
      root.classList.toggle('is-end', end);
    }
  }

  function settleTarget(from) {
    return Math.round(from);
  }

  function step(dt) {
    if (mode === 'drag' || mode === 'rest') return;
    if (motion.matches) {
      position = target;
      velocity = 0;
      mode = 'rest';
      return;
    }
    if (mode === 'coast') {
      position += velocity * dt;
      velocity *= Math.exp(-COAST_DRAG * dt);
      if (Math.abs(velocity) < 1.15) {
        target = settleTarget(position + velocity * 0.09);
        mode = 'spring';
      }
      return;
    }
    const err = target - position;
    const acc = OMEGA * OMEGA * err - 2 * OMEGA * velocity;
    velocity += acc * dt;
    position += velocity * dt;
    if (Math.abs(err) < 0.012 && Math.abs(velocity) < 0.16) {
      position = target;
      velocity = 0;
      mode = 'rest';
    }
  }

  function frame(now) {
    const dt = Math.min(0.034, (now - lastTick) / 1000 || 0.016);
    lastTick = now;
    step(dt);
    apply(position);
    publish(false);
    if (mode !== 'rest') raf = requestAnimationFrame(frame);
    else raf = 0;
  }

  function kick() {
    if (raf) return;
    lastTick = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function springTo(index, opts) {
    if (!Number.isFinite(index)) return;
    const i = mod(Math.round(index), N);
    const dest = i + N * Math.round((position - i) / N);
    announced = i;
    target = dest;
    if (motion.matches || Math.abs(dest - position) < 1e-4) {
      position = dest;
      velocity = 0;
      mode = 'rest';
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      apply(position);
      publish(true);
    } else {
      mode = 'spring';
      kick();
      publish(true);
    }
    if (opts && opts.focus) {
      const btn = rowBtns[i];
      if (btn) btn.focus({ preventScroll: true });
    }
  }

  function pickFromClient(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    const lx = clientX - (rect.left + rect.width / 2);
    const ly = clientY - (rect.top + rect.height / 2);
    let best = activeIndex(position);
    let bestD = Infinity;
    for (let i = 0; i < N; i++) {
      const p = placed[i];
      if (!p || !p.show || Math.abs(p.d) > 2.4) continue;
      const dx = lx - p.x;
      const dy = ly - p.y;
      const hit = (dx * dx) / Math.max(1, (rx * 0.18) ** 2) + (dy * dy) / Math.max(1, (ry + 80) ** 2);
      const d = hit - p.scale * 0.15;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  let drag = null;
  let suppressClick = false;

  stage.addEventListener('pointerdown', (e) => {
    if (narrow.matches) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    suppressClick = false;
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      origin: position,
      moved: false,
      axis: '',
      lastT: e.timeStamp,
    };
    mode = 'drag';
    velocity = 0;
    kick();
    try { stage.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  });

  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.axis) {
      if (Math.hypot(dx, dy) < 5) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.axis === 'y') {
        drag = null;
        mode = 'rest';
        return;
      }
      stage.classList.add('is-drag');
      announced = -1;
      drag.x = e.clientX;
      drag.origin = position;
      drag.lastT = e.timeStamp;
      return;
    }
    const next = drag.origin - (e.clientX - drag.x) / pxPer;
    const dt = Math.max(0.016, (e.timeStamp - drag.lastT) / 1000);
    const inst = (next - position) / dt;
    const blended = velocity * 0.55 + inst * 0.45;
    velocity = Math.max(-6.5, Math.min(6.5, blended));
    position = next;
    drag.lastT = e.timeStamp;
    drag.moved = true;
    apply(position);
    publish(false);
  }, { passive: true });

  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moved && drag.axis === 'x';
    const tap = !moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8;
    drag = null;
    stage.classList.remove('is-drag');
    if (tap) {
      suppressClick = true;
      mode = 'rest';
      springTo(pickFromClient(e.clientX, e.clientY));
      return;
    }
    if (!moved) {
      mode = 'rest';
      return;
    }
    suppressClick = true;
    if (motion.matches || Math.abs(velocity) < 0.35) {
      springTo(settleTarget(position));
      return;
    }
    mode = 'coast';
    kick();
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    stage.classList.remove('is-drag');
    springTo(settleTarget(position));
  });
  stage.addEventListener('click', (e) => {
    if (suppressClick) {
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    }
  });
  stage.addEventListener('pointerenter', () => { hot = true; });
  stage.addEventListener('pointerleave', () => { hot = false; });
  stage.addEventListener('dragstart', (e) => e.preventDefault());

  // Wheel must be non-passive so the arc can take the gesture instead of the page.
  stage.addEventListener('wheel', (e) => {
    if (narrow.matches || e.ctrlKey) return;
    e.preventDefault();
    let delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (e.deltaMode === 1) delta *= 16;
    else if (e.deltaMode === 2) delta *= 120;
    velocity += (delta / pxPer) * 14;
    if (motion.matches) {
      springTo(settleTarget(position + Math.sign(delta || 1)));
      return;
    }
    mode = 'coast';
    kick();
  }, { passive: false });

  rowBtns.forEach((btn) => {
    btn.addEventListener('click', () => springTo(Number(btn.dataset.i)));
  });

  window.addEventListener('keydown', (e) => {
    if (narrow.matches) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    const onRow = !!(ae && ae.classList && ae.classList.contains('pick-row-btn') && root.contains(ae));
    if (!onRow && !hot) return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    springTo(activeIndex(position) + dir, { focus: onRow });
  });

  window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
    updateProgress();
  }, { passive: true });

  window.addEventListener('resize', () => {
    measure();
    zKey = null;
    apply(position);
    updateProgress();
  });

  if (motion.matches) root.classList.add('is-reduced');
  motion.addEventListener?.('change', () => {
    root.classList.toggle('is-reduced', motion.matches);
    if (motion.matches && mode !== 'rest') springTo(settleTarget(position));
  });

  function clearArc() {
    cards.forEach((el) => {
      el.style.transform = '';
      el.style.opacity = '';
      el.style.zIndex = '';
      el.style.pointerEvents = '';
      delete el.dataset.on;
    });
    stage.classList.remove('is-arc', 'is-drag');
  }

  function engage() {
    if (narrow.matches) {
      clearArc();
      root.style.height = '';
      return;
    }
    stage.classList.add('is-arc');
    measure();
    zKey = null;
    apply(position);
    updateProgress();
  }

  narrow.addEventListener?.('change', engage);

  root.__pickRing = {
    select: (index) => springTo(index),
    pickAt: pickFromClient,
    sample: (pos) => pose(pos == null ? position : pos).map((p) => ({
      i: p.i,
      d: Math.round(p.d * 1000) / 1000,
      x: Math.round(p.x),
      y: Math.round(p.y),
      scale: Math.round(p.scale * 1000) / 1000,
      opacity: Math.round(p.opacity * 1000) / 1000,
    })),
    state: () => {
      const best = activeIndex(position);
      return {
        front,
        pinned: mode === 'rest' ? best : -1,
        progress: Math.min(1, Math.max(0, (scrollY - anchor) / runway)),
        spin: position,
        mode,
        velocity,
        best,
        bestTitle: (pickData[best] && pickData[best].title) || '',
        frontTitle: (pickData[front] && pickData[front].title) || '',
        n: N,
      };
    },
  };

  engage();
  publish(false);
}
