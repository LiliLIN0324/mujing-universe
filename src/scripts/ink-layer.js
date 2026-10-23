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

/**
 * Quiet voiceprint under the caption. Attributes live on the path because the
 * SVG is injected from script and does not receive scoped page CSS — without
 * fill="none" the browser paints the default black fill over the ring.
 * Same index always draws the same line.
 */
export function waveSVG(index) {
  const rand = mulberry(index * 17 + 3);
  const phases = [rand(), rand()];
  const amps = [0.34, 0.14];
  const freqs = [1.4 + rand() * 0.6, 2.8 + rand() * 0.8];
  let d = '';
  const n = 48;
  const mid = H / 2;
  const amp = H * 0.18;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const env = Math.sin(t * Math.PI);
    let y = 0;
    for (let k = 0; k < 2; k++) y += Math.sin((t * freqs[k] + phases[k]) * Math.PI * 2) * amps[k];
    const px = (t * W).toFixed(1);
    const py = (mid + y * env * amp).toFixed(1);
    d += i ? `L${px} ${py}` : `M${px} ${py}`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" focusable="false" aria-hidden="true"><path fill="none" stroke="#B7B3AC" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" d="${d}"/></svg>`;
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
