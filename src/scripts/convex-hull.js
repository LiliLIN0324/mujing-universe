/**
 * Ink dots that pull together and trace their convex hull.
 *
 * Scroll mode (红旗渠): t is how far the tall track has moved while the
 * plate is stuck. Pointer mode (404): t is how close the pointer is to
 * the plate. No timer — the picture is a function of that input.
 * prefers-reduced-motion draws the converged hull and stays there.
 */

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function smooth(u) {
  const t = clamp(u, 0, 1);
  return t * t * (3 - 2 * t);
}

function mulberry(seed) {
  let s = (Math.abs(seed | 0) + 1) * 9973;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function cross(o, a, b) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function convexHull(points) {
  const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const uniq = [];
  for (const p of pts) {
    const last = uniq[uniq.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) uniq.push(p);
  }
  if (uniq.length < 3) return uniq;
  const lower = [];
  for (const p of uniq) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = uniq.length - 1; i >= 0; i--) {
    const p = uniq[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function perimeter(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return s;
}

const CLOUDS = [
  [0.16, 0.28],
  [0.84, 0.26],
  [0.18, 0.76],
  [0.82, 0.74],
  [0.5, 0.5],
];

function buildDots(rand, n) {
  const dots = [];
  for (let i = 0; i < n; i++) {
    const cloud = CLOUDS[i % CLOUDS.length];
    const spread = i % CLOUDS.length === 4 ? 0.1 : 0.13;
    const ang = (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.4;
    const wobble = 1 + 0.1 * Math.sin(3 * ang) + 0.05 * Math.cos(5 * ang);
    const radial = Math.pow(0.42 + rand() * 0.58, 0.62);
    dots.push({
      sx: clamp(cloud[0] + (rand() - 0.5) * spread * 2, 0.06, 0.94),
      sy: clamp(cloud[1] + (rand() - 0.5) * spread * 2, 0.08, 0.92),
      tx: clamp(0.5 + Math.cos(ang) * 0.28 * wobble * radial, 0.12, 0.88),
      ty: clamp(0.52 + Math.sin(ang) * 0.3 * wobble * radial, 0.14, 0.88),
      rx: 1.3 + rand() * 1.8,
      ry: 1.1 + rand() * 1.6,
      rot: rand() * Math.PI,
      alpha: 0.45 + rand() * 0.5,
    });
  }
  return dots;
}

export function mountConvexHull(root) {
  const host = root || document.querySelector('[data-hull]');
  if (!host || host.dataset.ready === '1') return;
  host.dataset.ready = '1';
  const stage = host.querySelector('.math-hull-stage');
  const canvas = host.querySelector('canvas');
  if (!stage || !canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const mode = host.dataset.hull === 'pointer' ? 'pointer' : 'scroll';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const track = host.closest('.math-hull-track');
  const rand = mulberry(2026);
  const dots = buildDots(rand, 40);
  let pointerT = 0;
  let frame = 0;
  let pending = reduce ? 1 : 0;

  function size() {
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function readScroll() {
    if (!track) {
      const rect = host.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      return clamp((vh * 0.95 - rect.top) / (vh * 0.7), 0, 1);
    }
    const stickyTop = parseFloat(getComputedStyle(host).top) || 0;
    const rect = track.getBoundingClientRect();
    const total = Math.max(1, track.offsetHeight - host.offsetHeight);
    return clamp((stickyTop - rect.top) / total, 0, 1);
  }

  function draw(t) {
    const { w, h } = size();
    const u = reduce ? 1 : clamp(t, 0, 1);
    const move = smooth(u / 0.78);
    const drawIn = smooth((u - 0.4) / 0.6);
    ctx.clearRect(0, 0, w, h);
    const placed = dots.map((d) => ({
      x: (d.sx + (d.tx - d.sx) * move) * w,
      y: (d.sy + (d.ty - d.sy) * move) * h,
      rx: d.rx,
      ry: d.ry,
      rot: d.rot,
      alpha: d.alpha,
    }));
    for (const d of placed) {
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.rx, d.ry, d.rot, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(26, 26, 28, ${d.alpha})`;
      ctx.fill();
    }
    if (drawIn > 0.02) {
      const hull = convexHull(placed);
      if (hull.length >= 3) {
        ctx.beginPath();
        hull.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.strokeStyle = '#1A1A1C';
        ctx.lineWidth = 1.25;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        const perim = perimeter(hull);
        if (drawIn >= 0.995) ctx.setLineDash([]);
        else ctx.setLineDash([Math.max(0.5, perim * drawIn), perim]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    host.style.setProperty('--hull', u.toFixed(3));
    host.dataset.t = u.toFixed(3);
  }

  function schedule(next) {
    pending = next;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      draw(pending);
    });
  }

  if (!reduce && mode === 'scroll') {
    window.addEventListener('scroll', () => schedule(readScroll()), { passive: true });
    schedule(readScroll());
  } else if (!reduce && mode === 'pointer') {
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const onPtr = (e) => {
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * (rect.height / rect.width);
      pointerT = clamp(1 - Math.hypot(nx, ny) / 0.48, 0, 1);
      schedule(pointerT);
    };
    host.addEventListener('pointerdown', onPtr);
    host.addEventListener('pointermove', onPtr);
    if (fine) {
      host.addEventListener('pointerleave', () => schedule(0));
    }
    schedule(0);
  } else {
    schedule(1);
  }

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => schedule(reduce ? 1 : pending));
    ro.observe(stage);
  } else {
    window.addEventListener('resize', () => schedule(reduce ? 1 : pending), { passive: true });
  }
}
