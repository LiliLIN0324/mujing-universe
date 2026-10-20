/**
 * Effect layer on top of the existing 精选 ring / mobile stack.
 * Does not move cards. Ink bloom is ~600ms; the waveform is a static
 * per-work line with a slow dash drift. No audio.
 */

const INK_MS = 600;
const W = 240;
const H = 28;

function mulberry(seed) {
  let s = (Math.abs(seed | 0) + 1) * 9973;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Deterministic voiceprint. Same index always draws the same line. */
export function waveSVG(index) {
  const rand = mulberry(index * 17 + 3);
  const phases = [rand(), rand(), rand()];
  const amps = [0.55 + rand() * 0.4, 0.22 + rand() * 0.3, 0.08 + rand() * 0.16];
  const freqs = [2 + Math.floor(rand() * 3), 5 + Math.floor(rand() * 4), 10 + Math.floor(rand() * 4)];
  let d = '';
  const n = 56;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const env = Math.sin(t * Math.PI);
    let y = 0;
    for (let k = 0; k < 3; k++) y += Math.sin((t * freqs[k] + phases[k]) * Math.PI * 2) * amps[k];
    const px = (t * W).toFixed(1);
    const py = (H / 2 + y * env * (H * 0.42)).toFixed(1);
    d += i ? `L${px} ${py}` : `M${px} ${py}`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" focusable="false"><path vector-effect="non-scaling-stroke" d="${d}"/></svg>`;
}

export function paintWave(host, index) {
  if (!host || !Number.isFinite(index)) return;
  host.innerHTML = waveSVG(index);
}

/** Restart the CSS ink mask on a mobile card. No-op under reduced motion. */
export function bloomCard(card) {
  if (!card) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    card.classList.remove('is-ink');
    return;
  }
  const parent = card.parentElement;
  if (parent) {
    parent.querySelectorAll('.is-ink').forEach((el) => {
      if (el !== card) el.classList.remove('is-ink');
    });
  }
  card.classList.remove('is-ink');
  void card.offsetWidth;
  card.classList.add('is-ink');
}

export { INK_MS };
