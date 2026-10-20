/**
 * Two thin closed curves behind the artist hero.
 * Same tube and twist count, opposite torsion, different projection —
 * a decorative Bonnet pair: locally the same bend, globally not the same shape.
 * Pointer movement eases the first curve; the second follows half a beat later.
 * Nothing runs until the pointer moves, and the frame loop stops once both settle.
 * prefers-reduced-motion draws the resting pair and ignores the pointer.
 */

const STEPS = 220;
const TWISTS = 3;
const R = 1.2;
const TUBE = 0.36;

function curvePoint(which, t, phase, lift) {
  const torsion = which === 0 ? 1 : -1;
  const elev = (which === 0 ? 0.48 : 0.86) + lift * 0.22;
  const az = (which === 0 ? 0.32 : -0.18) + phase;
  const yScale = which === 0 ? 1 : 0.84;
  const u = TWISTS * t;
  const x = (R + TUBE * Math.cos(u)) * Math.cos(t);
  const y = (R + TUBE * Math.cos(u)) * Math.sin(t);
  const z = torsion * TUBE * Math.sin(u);
  const ca = Math.cos(az);
  const sa = Math.sin(az);
  const ce = Math.cos(elev);
  const se = Math.sin(elev);
  const x1 = x * ca - y * sa;
  const y1 = x * sa + y * ca;
  const y2 = y1 * ce - z * se;
  return [x1, y2 * yScale];
}

export function bonnetPath(which, phase, lift) {
  let d = "";
  for (let i = 0; i <= STEPS; i++) {
    const t = (i / STEPS) * Math.PI * 2;
    const [x, y] = curvePoint(which, t, phase, lift);
    d += `${i ? "L" : "M"}${x.toFixed(3)} ${y.toFixed(3)}`;
  }
  return `${d}Z`;
}

export function mountBonnet(root = document) {
  const svg = root.querySelector("[data-bonnet]");
  if (!svg) return;
  const pathA = svg.querySelector('[data-curve="a"]');
  const pathB = svg.querySelector('[data-curve="b"]');
  if (!pathA || !pathB) return;

  const draw = (phaseA, liftA, phaseB, liftB) => {
    pathA.setAttribute("d", bonnetPath(0, phaseA, liftA));
    pathB.setAttribute("d", bonnetPath(1, phaseB, liftB));
  };

  draw(0, 0, 0, 0);

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  if (motion.matches) return;

  let tx = 0;
  let ty = 0;
  let ax = 0;
  let ay = 0;
  let bx = 0;
  let by = 0;
  let raf = 0;

  const step = () => {
    ax += (tx - ax) * 0.2;
    ay += (ty - ay) * 0.2;
    bx += (ax - bx) * 0.1;
    by += (ay - by) * 0.1;
    draw(ax, ay, bx, by);
    const idle = Math.hypot(tx - ax, ty - ay) < 0.002 && Math.hypot(ax - bx, ay - by) < 0.002;
    raf = idle ? 0 : requestAnimationFrame(step);
  };

  const kick = () => {
    if (!raf) raf = requestAnimationFrame(step);
  };

  const onMove = (e) => {
    if (motion.matches) return;
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    tx = (e.clientX / w - 0.5) * 0.55;
    ty = (e.clientY / h - 0.5) * 0.28;
    kick();
  };

  const restTouch = (e) => {
    if (e.pointerType !== "touch") return;
    tx = 0;
    ty = 0;
    kick();
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", restTouch, { passive: true });
  window.addEventListener("pointercancel", restTouch, { passive: true });
  motion.addEventListener?.("change", () => {
    if (!motion.matches) return;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    draw(0, 0, 0, 0);
  });
}
