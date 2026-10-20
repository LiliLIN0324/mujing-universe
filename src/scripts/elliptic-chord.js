/**
 * Elliptic chord under the West Lake handscroll.
 *
 * Short Weierstrass model y² = x³ + ax + b with a = -1, b = 0
 * (y² = x³ − x): an oval on [-1, 0] and an unbounded branch on [1, ∞).
 * P and Q ride the upper oval. Their chord meets the curve again at R
 * on the branch (the group law). t in [0, 1] sends R from x ≈ 1.02 to
 * 1.63, and the branch arc it is crossing is the current section.
 *
 * No timer. t follows the page scroll until the handscroll itself is
 * moved, then t follows that scroll. prefers-reduced-motion still tracks
 * the scroll; nothing eases or plays on its own.
 */

const SECTIONS = 6;
const VB_W = 400;
const VB_H = 460;

const A0 = -0.65;
const A1 = -0.95;
const B0 = -0.31;
const B1 = -0.41;

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function yOf(x, sign) {
  return sign * Math.sqrt(Math.max(0, x * x * x - x));
}

/** Third intersection of the line PQ with y² = x³ − x. */
function third(p, q) {
  const m = (q.y - p.y) / (q.x - p.x);
  const x = m * m - p.x - q.x;
  const y = p.y + m * (x - p.x);
  return { x, y };
}

function pointAt(t) {
  const u = clamp(t, 0, 1);
  const p = { x: A0 + (A1 - A0) * u, y: yOf(A0 + (A1 - A0) * u, 1) };
  const q = { x: B0 + (B1 - B0) * u, y: yOf(B0 + (B1 - B0) * u, 1) };
  return { p, q, r: third(p, q) };
}

function makeMap() {
  const X0 = -1.55;
  const X1 = 1.82;
  const Y0 = -1.9;
  const Y1 = 1.9;
  const pad = 18;
  const s = Math.min((VB_W - pad * 2) / (X1 - X0), (VB_H - pad * 2) / (Y1 - Y0));
  const ox = (VB_W - (X1 - X0) * s) / 2;
  const oy = (VB_H - (Y1 - Y0) * s) / 2;
  return {
    x: (x) => ox + (x - X0) * s,
    y: (y) => oy + (Y1 - y) * s,
  };
}

function pathOf(map, pts, close) {
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    d += `${i ? 'L' : 'M'}${map.x(pts[i][0]).toFixed(1)} ${map.y(pts[i][1]).toFixed(1)}`;
  }
  return close ? `${d}Z` : d;
}

function sampleCurve() {
  const oval = [];
  for (let i = 0; i <= 72; i++) oval.push([-1 + i / 72, yOf(-1 + i / 72, 1)]);
  for (let i = 72; i >= 0; i--) oval.push([-1 + i / 72, yOf(-1 + i / 72, -1)]);
  const branch = [];
  const xMax = 1.72;
  for (let i = 0; i <= 64; i++) {
    const x = 1 + (xMax - 1) * (i / 64);
    branch.push([x, yOf(x, -1)]);
  }
  for (let i = 64; i >= 0; i--) {
    const x = 1 + (xMax - 1) * (i / 64);
    branch.push([x, yOf(x, 1)]);
  }
  return { oval, branch };
}

function upperArc(x0, x1) {
  const lo = Math.min(x0, x1);
  const hi = Math.max(x0, x1);
  const pts = [];
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const x = lo + (hi - lo) * (i / n);
    if (x >= 1) pts.push([x, yOf(x, 1)]);
  }
  return pts;
}

function svgEl(name, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

const INK = '#1A1A1C';

export function mountEllipticChord(root) {
  const host = root || document.querySelector('[data-elliptic]');
  if (!host || host.dataset.ready === '1') return;
  host.dataset.ready = '1';
  const svg = host.querySelector('svg');
  const strip = document.getElementById('wd-strip');
  const label = host.querySelector('[data-elliptic-sec]');
  if (!svg) return;

  const map = makeMap();
  const { oval, branch } = sampleCurve();
  const stroke = {
    fill: 'none',
    stroke: INK,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'vector-effect': 'non-scaling-stroke',
  };
  svg.append(
    svgEl('path', { ...stroke, d: pathOf(map, oval, true), 'stroke-width': '1.25', opacity: '0.38' }),
    svgEl('path', { ...stroke, d: pathOf(map, branch, false), 'stroke-width': '1.25', opacity: '0.38' }),
  );
  const section = svgEl('path', { ...stroke, 'stroke-width': '2', opacity: '1' });
  const chord = svgEl('line', { ...stroke, 'stroke-width': '1.15', opacity: '0.9' });
  const halo = svgEl('circle', { fill: INK, opacity: '0.12' });
  const cP = svgEl('circle', { fill: INK });
  const cQ = svgEl('circle', { fill: INK });
  const cR = svgEl('circle', { fill: INK });
  svg.append(section, chord, halo, cP, cQ, cR);

  const bounds = [];
  for (let i = 0; i <= SECTIONS; i++) bounds.push(pointAt(i / SECTIONS).r.x);

  let stripOwned = false;
  let frame = 0;
  let t = 0;

  function place(el, pt, r) {
    el.setAttribute('cx', map.x(pt.x).toFixed(1));
    el.setAttribute('cy', map.y(pt.y).toFixed(1));
    el.setAttribute('r', String(r));
  }

  function render(next) {
    t = clamp(next, 0, 1);
    const { p, q, r } = pointAt(t);
    const from = {
      x: p.x + (p.x - r.x) * 0.14,
      y: p.y + (p.y - r.y) * 0.14,
    };
    const to = {
      x: r.x + (r.x - p.x) * 0.08,
      y: r.y + (r.y - p.y) * 0.08,
    };
    chord.setAttribute('x1', map.x(from.x).toFixed(1));
    chord.setAttribute('y1', map.y(from.y).toFixed(1));
    chord.setAttribute('x2', map.x(to.x).toFixed(1));
    chord.setAttribute('y2', map.y(to.y).toFixed(1));
    const idx = Math.min(SECTIONS - 1, Math.max(0, Math.floor(t * SECTIONS - 1e-6)));
    section.setAttribute('d', pathOf(map, upperArc(bounds[idx], bounds[idx + 1]), false));
    place(cP, p, 4.2);
    place(cQ, q, 4.2);
    place(halo, r, 11);
    place(cR, r, 5);
    if (label) label.textContent = `第 ${idx + 1} / ${SECTIONS} 段`;
    host.dataset.t = t.toFixed(3);
    host.dataset.section = String(idx + 1);
  }

  function readStrip() {
    if (!strip) return 0;
    const max = strip.scrollWidth - strip.clientWidth;
    return max > 1 ? strip.scrollLeft / max : 0;
  }

  function readPage() {
    const rect = host.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const start = vh * 1.02;
    const end = vh * 0.2;
    return clamp((start - rect.top) / (start - end), 0, 1);
  }

  function schedule(next) {
    t = next;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      render(t);
    });
  }

  if (strip) {
    strip.addEventListener('scroll', () => {
      if (strip.scrollLeft > 1) stripOwned = true;
      if (stripOwned) schedule(readStrip());
    }, { passive: true });
    strip.querySelector('img')?.addEventListener('load', () => {
      if (stripOwned) schedule(readStrip());
    });
  }
  window.addEventListener('scroll', () => {
    if (!stripOwned) schedule(readPage());
  }, { passive: true });
  window.addEventListener('resize', () => {
    schedule(stripOwned ? readStrip() : readPage());
  }, { passive: true });

  render(readPage());
}
