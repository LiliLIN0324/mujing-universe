/**
 * Mobile featured card stack (≤768px only). Desktop never runs the interaction:
 * everything below is gated by matchMedia('(max-width: 768px)').
 *
 * pos is a continuous card index (cyclic over N). For card i, p = i - pos
 * (wrapped into [-N/2, N/2)): p = 0 is the current card, p in (0, 3] are the
 * peeking cards to the right, p in (-1, 0) is the card leaving to the left.
 */
const GAP = 14;           // px between the current card and the one leaving
const PEEK = 20;          // px each stacked card sits further right
const SHRINK = 0.08;      // scale step per stacked card
const TILT = 8;           // deg rotateY per stacked card (0 with reduced motion)
const LEFT = 24;          // current card left margin
const SETTLE_MS = 450;
const AXIS_SLOP = 8;

const mod = (n, m) => ((n % m) + m) % m;
const pad = (n) => String(n).padStart(2, '0');
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export function mountMobileStack(root) {
  const mq = matchMedia('(max-width: 768px)');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const dataEl = root.querySelector('#m-pick-data');
  const stage = root.querySelector('#m-stage');
  const cards = [...root.querySelectorAll('.m-card')];
  const segs = [...root.querySelectorAll('#m-bar i')];
  const rows = [...root.querySelectorAll('.m-row[data-i]')];
  const allBtn = root.querySelector('#m-all');
  const el = {
    count: root.querySelector('#m-count'),
    title: root.querySelector('#m-title'),
    meta: root.querySelector('#m-meta'),
    body: root.querySelector('#m-body'),
    facts: root.querySelector('#m-facts'),
    role: root.querySelector('#m-role'),
    tech: root.querySelector('#m-tech'),
  };
  const data = JSON.parse((dataEl && dataEl.textContent) || '[]');
  const N = Math.min(cards.length, data.length);
  if (!stage || N < 2) return null;

  cards.forEach((card) => {
    const img = card.querySelector('img');
    if (!img) return;
    const fail = () => {
      const next = img.dataset.fallback;
      const svg = '/scroll-placeholder.svg';
      if (next && img.getAttribute('src') !== next) { img.dataset.fallback = svg; img.src = next; return; }
      if (img.getAttribute('src') !== svg) img.src = svg;
    };
    img.addEventListener('error', fail);
    if (img.complete && img.getAttribute('src') && img.naturalWidth === 0) fail();
  });

  let pos = 0;
  let current = -1;
  let expanded = false;
  let anim = 0;
  let cardW = 300;

  function measure() {
    cardW = cards[0].offsetWidth || Math.max(200, window.innerWidth - 90);
  }

  function layout() {
    const tilt = motion.matches ? 0 : TILT;
    for (let i = 0; i < N; i++) {
      let p = mod(i - pos + N / 2, N) - N / 2;
      const card = cards[i];
      let x, s, ry, op;
      if (p <= 0) {
        x = LEFT + p * (cardW + GAP);
        s = 1; ry = 0; op = p <= -1 ? 0 : 1;
      } else {
        x = LEFT + p * PEEK;
        s = 1 - p * SHRINK;
        ry = -tilt * p;
        op = p <= 1 ? 1 : p <= 3 ? 1 - (p - 1) * 0.35 : Math.max(0, 0.3 * (4 - p));
      }
      card.style.transform = `translateX(${x.toFixed(2)}px) scale(${s.toFixed(4)}) rotateY(${ry.toFixed(2)}deg)`;
      card.style.opacity = op.toFixed(3);
      card.style.zIndex = String(100 - Math.round(p * 10));
      card.style.visibility = op <= 0 ? 'hidden' : 'visible';
    }
    const idx = mod(Math.round(pos), N);
    if (idx !== current) setCurrent(idx);
  }

  function setCurrent(idx) {
    current = idx;
    const w = data[idx];
    if (el.count) el.count.textContent = `${pad(idx + 1)} / ${pad(N)}`;
    segs.forEach((seg, i) => seg.classList.toggle('on', i === idx));
    cards.forEach((card, i) => card.setAttribute('aria-hidden', i === idx ? 'false' : 'true'));
    if (el.title) el.title.textContent = w.title;
    if (el.meta) { el.meta.textContent = w.meta || ''; el.meta.hidden = !w.meta; }
    if (el.body) { el.body.textContent = w.body || ''; el.body.hidden = !w.body; }
    const role = (w.role || []).filter(Boolean);
    const tech = (w.tech || []).filter(Boolean);
    if (el.role) { el.role.hidden = !role.length; el.role.querySelector('dd').textContent = role.join(' · '); }
    if (el.tech) { el.tech.hidden = !tech.length; el.tech.querySelector('dd').textContent = tech.join(' · '); }
    if (el.facts) el.facts.hidden = !role.length && !tech.length;
    syncList();
  }

  function syncList() {
    const show = new Set();
    for (let k = 0; k < 4; k++) show.add(mod(current + k, N));
    const list = rows[0] && rows[0].parentElement;
    rows.forEach((row) => {
      const i = Number(row.dataset.i);
      row.classList.toggle('on', i === current);
      row.hidden = !expanded && !show.has(i);
    });
    // Collapsed: current + next 3 in stack order. Expanded: natural 01…N order.
    if (list) {
      const order = expanded ? rows : [...show].map((i) => rows.find((r) => Number(r.dataset.i) === i));
      const allRow = allBtn && allBtn.closest('li');
      order.forEach((row) => row && list.insertBefore(row, allRow || null));
      if (!expanded) rows.filter((r) => !show.has(Number(r.dataset.i))).forEach((row) => list.insertBefore(row, allRow || null));
    }
  }

  function stop() {
    if (anim) cancelAnimationFrame(anim);
    anim = 0;
  }

  function settleTo(target, ms = SETTLE_MS) {
    stop();
    const from = pos;
    const dur = motion.matches ? 0 : ms;
    if (!dur || Math.abs(target - from) < 1e-4) { pos = target; layout(); return; }
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      pos = from + (target - from) * easeOut(t);
      layout();
      anim = t < 1 ? requestAnimationFrame(step) : 0;
      if (t >= 1) pos = target;
    };
    anim = requestAnimationFrame(step);
  }

  /** Flip to card idx along the shortest cyclic direction. */
  function goTo(idx) {
    const base = Math.round(pos);
    let d = mod(idx - mod(base, N), N);
    if (d > N / 2) d -= N;
    settleTo(base + d);
  }

  // ---- swipe: horizontal only, vertical stays native scroll (touch-action: pan-y) ----
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    if (!mq.matches || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, pos0: pos, axis: '', samples: [{ x: e.clientX, t: e.timeStamp }] };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (!drag.axis) {
      if (Math.abs(dx) < AXIS_SLOP && Math.abs(dy) < AXIS_SLOP) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.axis === 'y') { drag = null; return; }
      stop();
      drag.pos0 = pos;
      drag.x0 = e.clientX;
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    }
    const ddx = e.clientX - drag.x0;
    pos = drag.pos0 - ddx / (cardW + GAP);
    drag.samples.push({ x: e.clientX, t: e.timeStamp });
    if (drag.samples.length > 6) drag.samples.shift();
    layout();
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.axis !== 'x') return;
    const recent = d.samples.filter((s) => e.timeStamp - s.t < 100);
    const first = recent[0] || d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const v = (last.x - first.x) / Math.max(16, last.t - first.t); // px/ms, + = rightward
    // inertia: project ~180ms of travel, settle on a whole card, at most 2 cards per fling
    const projected = pos - (v * 180) / (cardW + GAP);
    const start = Math.round(d.pos0);
    let target = Math.round(projected);
    const moved = pos - d.pos0;
    if (target === start && (Math.abs(moved) > 0.12 || Math.abs(v) > 0.3)) target = start + Math.sign(moved || -v);
    target = Math.max(start - 2, Math.min(start + 2, target));
    settleTo(target);
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const axis = drag.axis;
    drag = null;
    if (axis === 'x') settleTo(Math.round(pos));
  });
  stage.addEventListener('dragstart', (e) => e.preventDefault());

  // ---- list ----
  rows.forEach((row) => {
    const btn = row.querySelector('button');
    if (btn) btn.addEventListener('click', () => goTo(Number(row.dataset.i)));
  });
  if (allBtn) {
    const label = allBtn.querySelector('.t');
    allBtn.addEventListener('click', () => {
      expanded = !expanded;
      allBtn.setAttribute('aria-expanded', String(expanded));
      if (label) label.textContent = expanded ? '收起' : '全部作品';
      syncList();
    });
  }

  function onResize() {
    if (!mq.matches) return;
    measure();
    layout();
  }
  window.addEventListener('resize', onResize);
  mq.addEventListener?.('change', onResize);
  motion.addEventListener?.('change', () => mq.matches && layout());

  if (mq.matches) { measure(); layout(); }
  root.dataset.ready = '1';

  // dwell controller (mobile-pager.js, data-dwell="on"): vertical swipes walk 01 → N, then flip the page
  return {
    canStep(dir) {
      if (!mq.matches) return false;
      const idx = mod(Math.round(pos), N);
      return dir > 0 ? idx < N - 1 : idx > 0;
    },
    step(dir) {
      goTo(mod(Math.round(pos), N) + dir);
    },
    get index() { return mod(Math.round(pos), N); },
  };
}
