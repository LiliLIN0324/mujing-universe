import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'ogl';
import { INK_MS, paintWave } from './ink-layer.js';

/**
 * Desktop 精选 arc. A short virtual arc, not a full ring.
 *
 * theta_i = wrap(i - cur) * 30° into [-180, 180].
 * |theta| <= 45 opaque, 45–60 fades to 0, |theta| > 60 is not drawn.
 * R = 2.2 * cardWidth, cards are 4:5, the center card is 30% of the canvas
 * width, fov is 32. The camera sits in front of that arc (about 2.4R on a
 * square canvas; on a wide canvas it is closer so the 30% width still holds).
 *
 * Inputs write `tgt` only. cur eases with lambda 7
 * (cur += (tgt-cur) * (1-exp(-7*dt))). Reduced motion uses lambda 20 and
 * skips bend, parallax, and release inertia.
 *
 * Wheel rule (page scroll is never trapped):
 * A wheel/trackpad event rotates the arc only when the pointer is over the
 * canvas AND the gesture is clearly horizontal (|deltaX| > |deltaY| and
 * |deltaX| > 1px). Vertical deltaY is never consumed, so the page scrolls.
 * The arc loops, so there is no first/last card to release at. Leaving the
 * canvas, or any vertical/ambiguous gesture, is the boundary: the page gets
 * the event. Drag uses the pointer, not the wheel.
 */

const VERT = /* glsl */ `
precision highp float;
attribute vec2 uv;
attribute vec3 position;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float uTheta;
uniform float uRadius;
uniform vec2 uSize;
uniform float uBend;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorld;

void main() {
  float x = position.x * uSize.x;
  float y = position.y * uSize.y;
  float R = max(uRadius, 0.001);
  float under = max(R * R - x * x, 1e-4);
  float root = sqrt(under);
  float z = R - root;
  z += uBend * uSize.x * sin(position.x * 3.14159265);

  float dzdx = x / root;
  float bendDz = uBend * 3.14159265 * cos(position.x * 3.14159265);
  vec3 N = normalize(vec3(-(dzdx + bendDz), 0.0, 1.0));

  float s = sin(uTheta);
  float c = cos(uTheta);
  vec3 p = vec3(c * x + s * z, y, -s * x + c * z);
  vec3 n = normalize(vec3(c * N.x + s * N.z, N.y, -s * N.x + c * N.z));
  p.x += s * R;
  p.z += c * R - R;

  vUv = uv;
  vNormal = n;
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorld;

uniform sampler2D uTexture;
uniform vec2 uPlane;
uniform vec2 uImage;
uniform float uReady;
uniform float uOpacity;
uniform float uBright;
uniform float uParallax;
uniform float uInk;
uniform vec3 uCam;

float inkBlob(vec2 p, vec2 c, float r) {
  vec2 d = (p - c) * vec2(1.0, 1.18);
  return 1.0 - smoothstep(r * 0.62, r, length(d));
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCam - vWorld);
  if (dot(N, V) < 0.15) discard;
  if (uOpacity < 0.004) discard;

  vec2 uv = (vUv - 0.5) / 1.12 + 0.5;
  uv.x += uParallax;
  if (uImage.x > 1.0 && uImage.y > 1.0) {
    float planeAspect = uPlane.x / max(uPlane.y, 0.0001);
    float imageAspect = uImage.x / max(uImage.y, 0.0001);
    if (imageAspect > planeAspect) {
      float s = planeAspect / imageAspect;
      uv.x = (uv.x - 0.5) * s + 0.5;
    } else {
      float s = imageAspect / planeAspect;
      uv.y = (uv.y - 0.5) * s + 0.5;
    }
  }
  uv = clamp(uv, 0.0, 1.0);

  vec3 paper = vec3(0.965, 0.961, 0.953);
  vec3 color = paper;
  if (uReady > 0.5) color = texture2D(uTexture, uv).rgb;

  if (uInk < 1.5) {
    float spread = max(uInk, 0.0);
    float ink = inkBlob(uv, vec2(0.50, 0.48), spread * 0.95);
    ink = max(ink, inkBlob(uv, vec2(0.68, 0.38), spread * 0.58));
    ink = max(ink, inkBlob(uv, vec2(0.33, 0.64), spread * 0.5));
    color = mix(paper, color, clamp(ink, 0.0, 1.0));
  }

  color *= uBright;
  gl_FragColor = vec4(color, uOpacity);
}
`;

const FOV = 32;
const CARD_FRAC = 0.3;
const STEP_DEG = 30;
const TEX_MAX = 1920;
const DRAG_CARDS = 0.22;
const LAMBDA = 7;
const LAMBDA_SNAP = 5;
const LAMBDA_REDUCED = 20;
const SNAP_MS = 140;
const VEL_CAP = 14;
const CLICK_PX = 6;
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0];

function mod(a, n) {
  return ((a % n) + n) % n;
}

function wrap180(deg) {
  return ((deg + 180) % 360 + 360) % 360 - 180;
}

function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** Values a / b / c at 0° / 30° / 60°, smoothstep on each half. */
function knot(absDeg, a, b, c) {
  if (absDeg <= 0) return a;
  if (absDeg >= 60) return c;
  if (absDeg <= 30) return a + (b - a) * smoothstep(absDeg / 30);
  return b + (c - b) * smoothstep((absDeg - 30) / 30);
}

function opacityFor(absDeg) {
  if (absDeg >= 60) return 0;
  if (absDeg <= 45) return 1;
  return 1 - (absDeg - 45) / 15;
}

function capVel(v) {
  if (v > VEL_CAP) return VEL_CAP;
  if (v < -VEL_CAP) return -VEL_CAP;
  return v;
}

export function mountPickRing(root, pickData) {
  const canvas = root.querySelector('#pick-canvas');
  const introEl = root.querySelector('#pick-intro');
  const listWindow = root.querySelector('.pick-list-window');
  const images = [...root.querySelectorAll('.about__gallery__media__image')];
  const narrow = matchMedia('(max-width: 860px)');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (!canvas || images.length < 2) return;

  images.forEach((img) => {
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

  const renderer = new Renderer({
    canvas,
    alpha: true,
    antialias: false,
    dpr: Math.min(2, window.devicePixelRatio || 1),
    webgl: 1,
    preserveDrawingBuffer: false,
  });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);

  const camera = new Camera(gl, { fov: FOV, near: 0.1, far: 100 });
  camera.position.set(0, 0, 5);

  const scene = new Transform();
  const geometry = new Plane(gl, {
    width: 1,
    height: 1,
    widthSegments: 64,
    heightSegments: 1,
  });

  const N = Math.min(10, images.length);
  let viewW = 1;
  let viewH = 1;
  let cardW = 1;
  let cardH = 1.25;
  let radius = 2.2;
  let camZ = 5;

  function paintTexture(texture, uniforms, source) {
    const w = source.naturalWidth || source.width || 1;
    const h = source.naturalHeight || source.height || 1;
    const maxEdge = Math.max(w, h);
    let image = source;
    let iw = w;
    let ih = h;
    if (maxEdge > TEX_MAX) {
      const s = TEX_MAX / maxEdge;
      iw = Math.max(1, Math.round(w * s));
      ih = Math.max(1, Math.round(h * s));
      const c = document.createElement('canvas');
      c.width = iw;
      c.height = ih;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(source, 0, 0, iw, ih);
        image = c;
      }
    }
    texture.image = image;
    texture.needsUpdate = true;
    uniforms.uImage.value = [iw, ih];
    uniforms.uReady.value = 1;
  }

  const meshes = images.slice(0, N).map((img, i) => {
    const texture = new Texture(gl, {
      generateMipmaps: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
    });
    const uniforms = {
      uTheta: { value: 0 },
      uRadius: { value: radius },
      uSize: { value: [cardW, cardH] },
      uBend: { value: 0 },
      uTexture: { value: texture },
      uPlane: { value: [4, 5] },
      uImage: { value: [1, 1] },
      uReady: { value: 0 },
      uOpacity: { value: i === 0 ? 1 : 0 },
      uBright: { value: 1 },
      uParallax: { value: 0 },
      uInk: { value: 1.6 },
      uCam: { value: [0, 0, camZ] },
    };
    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms,
      cullFace: gl.BACK,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new Mesh(gl, { geometry, program });
    mesh.frustumCulled = false;
    mesh.visible = i === 0;
    mesh.renderOrder = 1;
    mesh.setParent(scene);

    const entry = { mesh, program, img, uniforms, texture };
    const loader = new Image();
    loader.crossOrigin = 'anonymous';
    loader.decoding = 'async';
    loader.onload = () => paintTexture(texture, uniforms, loader);
    loader.onerror = () => {
      const fallback = new Image();
      fallback.crossOrigin = 'anonymous';
      fallback.onload = () => paintTexture(texture, uniforms, fallback);
      fallback.src = '/ring/paper.jpg';
    };
    loader.src = `/ring/${i}.jpg`;
    return entry;
  });

  const waveEl = introEl && introEl.querySelector('[data-role="wave"]');
  const titleLink = introEl && introEl.querySelector('[data-role="title-link"]');
  const summaryEl = introEl && introEl.querySelector('[data-role="summary"]');
  const metaEl = introEl && introEl.querySelector('[data-role="meta"]');
  const bodyEl = introEl && introEl.querySelector('[data-role="body"]');
  const viewEl = introEl && introEl.querySelector('[data-role="view"]');
  const rowEls = [...root.querySelectorAll('.pick-row')];
  const rowBtns = [...root.querySelectorAll('.pick-row-btn')];
  const soundBtn = root.querySelector('#pick-sound');
  const soundLabel = root.querySelector('[data-role="sound-label"]');

  let cur = 0;
  let tgt = 0;
  let vel = 0;
  let bendVel = 0;
  let snapping = false;
  let snapDue = 0;
  let dragging = false;
  let gesture = null;
  let active = 0;
  let inView = false;
  let raf = 0;
  let frames = 0;
  let lastNow = performance.now();
  let userMoved = false;
  let soundOn = false;
  let audioCtx = null;
  let inkJob = null;
  const sampleCache = new Map();

  function resize() {
    const host = canvas.parentElement || root;
    viewW = host.clientWidth || window.innerWidth;
    viewH = host.clientHeight || window.innerHeight;
    renderer.setSize(viewW, viewH);
    const aspect = viewW / Math.max(1, viewH);
    camera.perspective({ aspect, fov: FOV });
    const tan = Math.tan((FOV * Math.PI) / 360);
    // Front card is 30% of the canvas width. R = 2.2 * cardWidth.
    // camZ / R is 2.4 on a square canvas and closer on a wide one, so the
    // 30% width still holds at fov 32.
    cardW = 1;
    radius = 2.2 * cardW;
    camZ = cardW / (CARD_FRAC * 2 * tan * Math.max(0.2, aspect));
    cardH = cardW * (5 / 4);
    camera.position.set(0, 0, camZ);
  }

  /** Signed slot distance in (-N/2, N/2], then 30° per slot, wrapped to [-180, 180]. */
  function thetaOf(index) {
    let d = mod(index - cur, N);
    if (d > N / 2) d -= N;
    return wrap180(d * STEP_DEG);
  }

  function layoutCard(index) {
    const deg = thetaOf(index);
    const abs = Math.abs(deg);
    const shown = abs < 60;
    const depth = knot(abs, 1, 0.92, 0.86);
    const bright = knot(abs, 1, 0.94, 0.88);
    const opacity = opacityFor(abs);
    const bend = motion.matches ? 0 : capBend(bendVel);
    const parallax = motion.matches || abs < 1e-3 ? 0 : (deg * Math.PI) / 180 * 0.08;
    const entry = meshes[index];
    entry.mesh.visible = shown && opacity > 0;
    entry.mesh.renderOrder = 1 + Math.round((60 - abs) * 10);
    entry.uniforms.uTheta.value = (deg * Math.PI) / 180;
    entry.uniforms.uRadius.value = radius;
    entry.uniforms.uSize.value = [cardW * depth, cardH * depth];
    entry.uniforms.uBend.value = shown ? bend : 0;
    entry.uniforms.uOpacity.value = opacity;
    entry.uniforms.uBright.value = bright;
    entry.uniforms.uParallax.value = parallax;
    entry.uniforms.uCam.value = [0, 0, camZ];
    entry.uniforms.uPlane.value = [cardW * depth, cardH * depth];
    return { deg, abs, shown, opacity, depth };
  }

  function capBend(v) {
    const b = v * 0.6;
    if (b > 0.12) return 0.12;
    if (b < -0.12) return -0.12;
    if (Math.abs(b) < 1e-4) return 0;
    return b;
  }

  function project(x, y, z) {
    const depth = camZ - z;
    if (depth < 0.05) return null;
    const halfH = Math.tan((FOV * Math.PI) / 360) * depth;
    const halfW = halfH * (viewW / Math.max(1, viewH));
    return {
      x: (x / halfW) * 0.5 + 0.5,
      y: 0.5 - (y / halfH) * 0.5,
    };
  }

  function cardQuad(index) {
    const deg = thetaOf(index);
    if (Math.abs(deg) >= 60) return null;
    const depth = knot(Math.abs(deg), 1, 0.92, 0.86);
    const th = (deg * Math.PI) / 180;
    const s = Math.sin(th);
    const c = Math.cos(th);
    const hw = (cardW * depth) / 2;
    const hh = (cardH * depth) / 2;
    const pts = [];
    for (const sx of [-hw, hw]) {
      for (const sy of [-hh, hh]) {
        const under = Math.max(radius * radius - sx * sx, 1e-4);
        const zc = radius - Math.sqrt(under);
        const x = c * sx + s * zc + s * radius;
        const y = sy;
        const z = -s * sx + c * zc + c * radius - radius;
        const p = project(x, y, z);
        if (!p) return null;
        pts.push(p);
      }
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, maxX, minY, maxY, abs: Math.abs(deg) };
  }

  /** CSS-pixel point relative to the canvas. Front-most hit wins. */
  function pickCard(px, py) {
    const nx = px / Math.max(1, viewW);
    const ny = py / Math.max(1, viewH);
    let best = -1;
    let bestAbs = Infinity;
    for (let i = 0; i < N; i++) {
      const q = cardQuad(i);
      if (!q) continue;
      if (nx < q.minX || nx > q.maxX || ny < q.minY || ny > q.maxY) continue;
      if (q.abs < bestAbs) {
        bestAbs = q.abs;
        best = i;
      }
    }
    return best;
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
      if (btn) {
        if (on) btn.setAttribute('aria-current', 'true');
        else btn.removeAttribute('aria-current');
      }
    });
    const row = rowEls[index];
    if (!row || !listWindow) return;
    const rowTop = row.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;
    const viewTop = listWindow.scrollTop;
    const viewBottom = viewTop + listWindow.clientHeight;
    if (rowTop < viewTop) listWindow.scrollTop = rowTop;
    else if (rowBottom > viewBottom) listWindow.scrollTop = rowBottom - listWindow.clientHeight;
  }

  function beginInk(index) {
    const entry = meshes[index];
    if (!entry) return;
    if (motion.matches || !inView) {
      entry.uniforms.uInk.value = 1.6;
      inkJob = null;
      return;
    }
    entry.uniforms.uInk.value = 0;
    inkJob = { index, start: performance.now() };
  }

  function applyActive(index) {
    const work = pickData[index];
    fillCopy(work);
    paintWave(waveEl, index);
    beginInk(index);
    syncList(index);
  }

  root.addEventListener('ring:change', (ev) => {
    const index = ev.detail && ev.detail.index;
    if (!Number.isFinite(index)) return;
    applyActive(index);
    if (userMoved && soundOn) pluck(index);
  });

  function emitActive(index) {
    const work = pickData[index] || null;
    root.dispatchEvent(new CustomEvent('ring:change', { detail: { index, work } }));
  }

  function markInput() {
    snapDue = performance.now() + SNAP_MS;
    snapping = false;
  }

  function wrapTo(origin, index) {
    const here = mod(origin, N);
    let d = index - here;
    if (d > N / 2) d -= N;
    if (d < -N / 2) d += N;
    return origin + d;
  }

  function goTo(index) {
    if (!Number.isFinite(index)) return;
    const i = mod(Math.round(index), N);
    const origin = dragging ? cur : tgt;
    tgt = wrapTo(origin, i);
    vel = 0;
    bendVel = 0;
    dragging = false;
    userMoved = true;
    markInput();
    kick();
  }

  function step(dir) {
    tgt += dir;
    vel = 0;
    bendVel = 0;
    userMoved = true;
    markInput();
    kick();
  }

  function openOrFocus(index) {
    const shown = mod(Math.round(cur), N);
    if (index === shown) {
      const href = pickData[index] && pickData[index].href;
      if (href) window.location.assign(href);
      return;
    }
    goTo(index);
  }

  function lambdaNow() {
    if (motion.matches) return LAMBDA_REDUCED;
    if (snapping) return LAMBDA_SNAP;
    return LAMBDA;
  }

  function degreeFreq(index) {
    const deg = ((index % 5) + 5) % 5;
    const oct = Math.floor(index / 5);
    return PENTA[deg] * 2 ** oct;
  }

  function ensureCtx() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
      return audioCtx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      audioCtx = new AC();
    } catch (err) {
      return null;
    }
    return audioCtx;
  }

  function pluckKS(freq) {
    const ctx = audioCtx;
    if (!ctx) return;
    const sr = ctx.sampleRate;
    const n = Math.max(2, Math.round(sr / freq));
    const dur = 0.9;
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const damp = 0.996;
    for (let i = n; i < len; i++) {
      const a = data[i - n];
      const b = data[i - n + 1] || a;
      data[i] = (a + b) * 0.5 * damp;
    }
    const attack = Math.floor(sr * 0.008);
    for (let i = 0; i < attack; i++) data[i] *= i / attack;
    const tail = Math.floor(sr * 0.08);
    for (let i = 0; i < tail; i++) data[len - 1 - i] *= i / tail;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = 0.2;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  function playBuffer(buffer) {
    if (!audioCtx || !buffer) return;
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.8;
    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();
  }

  function probeSample(slug) {
    if (!slug || sampleCache.has(slug)) return;
    const url = `/ring-sounds/${encodeURIComponent(slug)}.mp3`;
    const job = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('miss');
        return res.arrayBuffer();
      })
      .then((ab) => {
        const ctx = audioCtx;
        if (!ctx) throw new Error('noctx');
        return ctx.decodeAudioData(ab.slice(0));
      })
      .then((buffer) => {
        sampleCache.set(slug, buffer);
      })
      .catch(() => {
        sampleCache.set(slug, 'miss');
      });
    sampleCache.set(slug, job);
  }

  function pluck(index) {
    if (!soundOn) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    const work = pickData[index];
    const slug = work && work.slug;
    const cached = slug ? sampleCache.get(slug) : null;
    if (cached && cached !== 'miss' && typeof cached.then !== 'function') {
      playBuffer(cached);
      return;
    }
    pluckKS(degreeFreq(index));
    if (slug && !sampleCache.has(slug)) probeSample(slug);
  }

  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      soundOn = !soundOn;
      soundBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
      soundBtn.setAttribute('aria-label', soundOn ? '声音 开' : '声音 关');
      if (soundLabel) soundLabel.textContent = soundOn ? '开' : '关';
      if (!soundOn) return;
      ensureCtx();
      for (let i = 0; i < pickData.length; i++) {
        const slug = pickData[i] && pickData[i].slug;
        if (slug) probeSample(slug);
      }
      if (active >= 0) pluck(active);
    });
  }

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    frames += 1;
    if (narrow.matches || !inView) {
      raf = 0;
      return;
    }

    if (!dragging) {
      if (Math.abs(vel) > 0.015) {
        tgt += vel * dt;
        vel *= 0.92 ** (dt * 60);
        if (Math.abs(vel) <= 0.015) vel = 0;
        bendVel = vel;
      } else {
        vel = 0;
        bendVel = 0;
        if (!snapping && snapDue && now >= snapDue) {
          tgt = Math.round(tgt);
          snapping = true;
        }
      }
    }

    const lambda = lambdaNow();
    cur += (tgt - cur) * (1 - Math.exp(-lambda * dt));
    if (Math.abs(tgt - cur) < 1e-4) cur = tgt;

    if (inkJob && !motion.matches) {
      const t = Math.min(1, (now - inkJob.start) / INK_MS);
      const e = 1 - (1 - t) ** 3;
      const entry = meshes[inkJob.index];
      if (entry) entry.uniforms.uInk.value = e * 1.6;
      if (t >= 1) inkJob = null;
    }

    let shown = 0;
    for (let i = 0; i < N; i++) {
      if (layoutCard(i).shown) shown += 1;
    }

    const next = mod(Math.round(cur), N);
    if (next !== active) {
      active = next;
      emitActive(next);
    }

    renderer.render({ scene, camera, frustumCull: false });
    if (needsFrame()) raf = requestAnimationFrame(frame);
    else raf = 0;
    return shown;
  }

  function needsFrame() {
    if (narrow.matches || !inView) return false;
    if (dragging || gesture) return true;
    if (Math.abs(vel) > 1e-3) return true;
    if (Math.abs(cur - tgt) > 1e-4) return true;
    if (snapDue && !snapping && performance.now() < snapDue) return true;
    if (inkJob) return true;
    return false;
  }

  function kick() {
    if (raf || narrow.matches || !inView) return;
    lastNow = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function endGesture(e) {
    if (!gesture || (e && e.pointerId !== gesture.id)) return;
    const g = gesture;
    gesture = null;
    dragging = false;
    canvas.classList.remove('is-dragging');
    if (canvas.hasPointerCapture?.(g.id)) {
      try { canvas.releasePointerCapture(g.id); } catch (err) { /* already released */ }
    }
    if (g.moved < CLICK_PX) {
      const rect = canvas.getBoundingClientRect();
      const hit = pickCard(e.clientX - rect.left, e.clientY - rect.top);
      if (hit >= 0) openOrFocus(hit);
      kick();
      return;
    }
    vel = motion.matches ? 0 : capVel(g.vel);
    bendVel = vel;
    userMoved = true;
    markInput();
    kick();
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    canvas.setPointerCapture?.(e.pointerId);
    vel = 0;
    bendVel = 0;
    snapping = false;
    dragging = false;
    gesture = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastT: performance.now(),
      moved: 0,
      vel: 0,
    };
    kick();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!gesture || e.pointerId !== gesture.id) return;
    const now = performance.now();
    const dx = e.clientX - gesture.lastX;
    const dt = Math.max(0.001, (now - gesture.lastT) / 1000);
    gesture.moved = Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y);
    gesture.lastX = e.clientX;
    gesture.lastT = now;
    if (gesture.moved < CLICK_PX) return;
    dragging = true;
    canvas.classList.add('is-dragging');
    const cards = -dx / (DRAG_CARDS * Math.max(1, viewW));
    tgt += cards;
    const inst = cards / dt;
    gesture.vel = gesture.vel * 0.35 + inst * 0.65;
    bendVel = capVel(gesture.vel);
    vel = 0;
    userMoved = true;
    markInput();
    kick();
  });

  canvas.addEventListener('pointerup', endGesture);
  canvas.addEventListener('pointercancel', endGesture);
  canvas.addEventListener('lostpointercapture', (e) => {
    if (gesture && e.pointerId === gesture.id) endGesture(e);
  });

  canvas.addEventListener('click', (e) => {
    if (gesture) return;
    // pointerup already handled the click. Swallow the synthetic click so a drag cannot open.
    e.preventDefault();
    e.stopPropagation();
  });

  canvas.addEventListener('wheel', (e) => {
    if (!canvas.matches(':hover')) return;
    const ax = Math.abs(e.deltaX);
    const ay = Math.abs(e.deltaY);
    // Vertical, or a tie, belongs to the page. Only a clearly horizontal gesture rotates.
    if (ax <= ay || ax < 1) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewW : 1;
    const cards = (e.deltaX * unit) / (DRAG_CARDS * Math.max(1, viewW));
    tgt += cards;
    vel = 0;
    bendVel = 0;
    userMoved = true;
    markInput();
    kick();
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    // Arrows only while focus is inside the section, so a pointer resting on
    // the canvas does not trap page scrolling.
    if (!root.contains(e.target)) return;
    e.preventDefault();
    step(e.key === 'ArrowRight' ? 1 : -1);
  });

  rowBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      goTo(Number(btn.dataset.i));
    });
  });

  const watch = new IntersectionObserver((entries) => {
    inView = entries.some((entry) => entry.isIntersecting);
    if (!inView) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      return;
    }
    kick();
  }, { threshold: 0.05 });
  watch.observe(root);
  if (motion.matches) root.classList.add('is-reduced');

  root.__pickRing = {
    select: goTo,
    step,
    pickAt: (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      return pickCard(clientX - rect.left, clientY == null ? rect.height / 2 : clientY - rect.top);
    },
    state: () => {
      const cards = [];
      for (let i = 0; i < N; i++) {
        const deg = thetaOf(i);
        const abs = Math.abs(deg);
        cards.push({
          i,
          deg: Math.round(deg * 10) / 10,
          opacity: Math.round(opacityFor(abs) * 1000) / 1000,
          shown: abs < 60 && opacityFor(abs) > 0,
          bend: meshes[i].uniforms.uBend.value,
          parallax: Math.round(meshes[i].uniforms.uParallax.value * 1000) / 1000,
          bright: Math.round(meshes[i].uniforms.uBright.value * 1000) / 1000,
          scale: Math.round(knot(abs, 1, 0.92, 0.86) * 1000) / 1000,
        });
      }
      return {
        cur: Math.round(cur * 1000) / 1000,
        tgt: Math.round(tgt * 1000) / 1000,
        vel: Math.round(vel * 1000) / 1000,
        bend: capBend(bendVel),
        active,
        snapping,
        dragging,
        lambda: lambdaNow(),
        frames,
        raf: raf ? 1 : 0,
        sound: soundOn,
        n: N,
        shown: cards.filter((c) => c.shown).length,
        camZ: Math.round(camZ * 1000) / 1000,
        radius,
        cardW,
        fov: FOV,
        cards,
        title: (pickData[active] && pickData[active].title) || '',
      };
    },
  };

  function onResize() {
    resize();
    if (inView) {
      for (let i = 0; i < N; i++) layoutCard(i);
      renderer.render({ scene, camera, frustumCull: false });
    }
  }

  resize();
  for (let i = 0; i < N; i++) layoutCard(i);
  window.addEventListener('resize', onResize);
  kick();
}
