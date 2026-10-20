/**
 * 散点长卷 — cards along one undulating ground line.
 *
 * Motion is the same 60fps engine as the arc: a float `position` (card index),
 * drag velocity, a short coast, then a critically damped spring. Each frame
 * writes transform and opacity only. Nothing runs at rest. No autoplay.
 *
 * Layout is a handscroll, not a vanishing-point ring. Spacing is constant
 * (dragging unrolls one card per card-width). Scale barely changes. Distance
 * is mist: the card fades, and a paper-colored veil (#F6F5F3) washes over it.
 * No filter, no blur, no per-frame layout read.
 */

const OMEGA = 12;
const COAST_DRAG = 3.4;
/** Cards farther than this are fully in the mist and not drawn. */
const VISIBLE = 4.15;
/** Vertical anchor inside the stage. Must match CSS `top` on the links. */
const ANCHOR_Y = 0.5;

const mod = (n, m) => ((n % m) + m) % m;

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
  /** Explicit selection. Copy tracks this until the scroll arrives; drag clears it. */
  let announced = -1;
  let spacing = 512;
  let waveAmp = 14;
  let pxPer = 512;
  let cardW = 440;
  let cardH = 248;
  let anchor = 0;
  let runway = 1;
  let scrollY = window.scrollY;
  let isEnd = false;
  let zKey = null;
  let hot = false;
  let raf = 0;
  let lastTick = 0;
  const placed = [];
  const veils = cards.map((card) => {
    let veil = card.querySelector('.pick-mist');
    if (!veil) {
      veil = document.createElement('span');
      veil.className = 'pick-mist';
      veil.setAttribute('aria-hidden', 'true');
      card.appendChild(veil);
    }
    return veil;
  });

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

  /**
   * One ground line. x is linear in card index (unrolling, no vanishing point).
   * y is a slow landscape wave. Scale falls only a little. Mist is a separate
   * paper veil, not a blur.
   */
  function pose(pos) {
    const out = [];
    for (let i = 0; i < N; i++) {
      const d = wrapDelta(i, pos, N);
      const ad = Math.abs(d);
      const x = -d * spacing;
      const y = waveAmp * Math.sin(d * 1.05);
      const scale = 1 - Math.min(ad, 3.2) * 0.035;
      let opacity = 1;
      if (ad > 1.05) {
        const t = Math.min(1, (ad - 1.05) / 2.35);
        const s = t * t * (3 - 2 * t);
        opacity = 1 - s;
      }
      const veilT = ad <= 0.12 ? 0 : Math.min(1, (ad - 0.12) / 1.85);
      const veil = veilT * 0.72;
      out.push({
        i,
        d,
        x,
        y,
        scale,
        opacity,
        veil,
        show: ad <= VISIBLE && opacity > 0.035,
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
          veils[i].style.opacity = '0';
          el.style.pointerEvents = 'none';
        }
        continue;
      }
      el.dataset.on = '1';
      el.style.opacity = p.opacity.toFixed(3);
      veils[i].style.opacity = p.veil.toFixed(3);
      el.style.pointerEvents = Math.abs(p.d) < 1.85 ? 'auto' : 'none';
      el.style.transform = `translate3d(calc(-50% + ${p.x.toFixed(2)}px), calc(-50% + ${p.y.toFixed(2)}px), 0) scale(${p.scale.toFixed(4)})`;
      if (writeZ) el.style.zIndex = String(240 - Math.round(Math.abs(p.d) * 28));
    }
  }

  function measure() {
    if (narrow.matches) {
      root.style.height = '';
      return;
    }
    const card = cards[0];
    cardW = card.offsetWidth || 440;
    cardH = card.offsetHeight || cardW * 9 / 16;
    spacing = cardW + 64;
    pxPer = spacing;
    waveAmp = 26;
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
    const ly = clientY - (rect.top + rect.height * ANCHOR_Y);
    let best = activeIndex(position);
    let bestD = Infinity;
    for (let i = 0; i < N; i++) {
      const p = placed[i];
      if (!p || !p.show || Math.abs(p.d) > 1.85) continue;
      const hw = Math.max(24, cardW * p.scale * 0.5);
      const hh = Math.max(24, cardH * p.scale * 0.5);
      const dx = (lx - p.x) / hw;
      const dy = (ly - p.y) / hh;
      const hit = dx * dx + dy * dy;
      if (hit > 1) continue;
      const d = hit - p.scale * 0.08;
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
    veils.forEach((veil) => { veil.style.opacity = ''; });
    stage.classList.remove('is-scroll', 'is-drag');
  }

  function engage() {
    if (narrow.matches) {
      clearArc();
      root.style.height = '';
      return;
    }
    stage.classList.add('is-scroll');
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
