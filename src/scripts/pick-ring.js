import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'ogl';
import { INK_MS, paintWave } from './ink-layer.js';

/**
 * Pick ring — Ferris / demalde About geometry (bv + cabinMatrix).
 * Spec: demalde-crawl/FINDINGS.md, demalde-about/PICK-RING.md, ferris-wheel-demo.
 * Page scroll → uScroll/uVelocity; no drag-spin / uJitter / shadow layer.
 */

const VERT = /* glsl */ `
precision highp float;
attribute vec2 uv;
attribute vec3 position;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float uAngle;
uniform vec2 uScale;
uniform float uTime;
uniform float uScroll;
uniform float uVelocity;
uniform float uFocus;
uniform float uLag;
uniform float uBend;
uniform float uFit;
uniform float uBreath;
uniform float uTilt;
uniform float uClock;

varying vec2 vUv;

mat4 rotationMatrix(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  return mat4(
    oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s, 0.0,
    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s, 0.0,
    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,          0.0,
    0.0, 0.0, 0.0, 1.0
  );
}

vec3 rotate(vec3 v, vec3 axis, float angle) {
  return (rotationMatrix(axis, angle) * vec4(v, 1.0)).xyz;
}

mat4 cabinMatrix(vec3 ringPos, float yaw, vec3 scale) {
  mat4 R = rotationMatrix(vec3(0.0, 1.0, 0.0), yaw);
  mat4 S = mat4(1.0);
  S[0].x = scale.x;
  S[1].y = scale.y;
  S[2].z = scale.z;
  mat4 T = mat4(1.0);
  T[3].xyz = ringPos;
  return T * R * S;
}

void main() {
  const float PI = 3.141592653589793;
  float radius = 3.0;
  float angle = uAngle;
  vec2 ring = vec2(cos(angle * PI * 2.0), sin(angle * PI * 2.0)) * radius;
  float yaw0 = angle * PI * 2.0 - PI * 0.2 - position.x * 0.3 - uVelocity * 15.0;

  // Ribbon bend is 0 at the card center, so hit-tests and the settled pose stay put.
  vec3 pos = position;
  pos.z += sin(position.x * PI) * uBend;

  // Back to ~01:37 end dose (~3 near), then nudge MORE LEFT than that round
  float grow = 1.0 + 0.5 * uScroll * uScroll;
  float fit = max(uFit, 0.2);
  vec4 p = cabinMatrix(vec3(ring.x, 0.0, ring.y), yaw0, vec3(uScale.x * grow * fit, uScale.y * grow * fit, 1.0)) * vec4(pos, 1.0);
  p.xyz = rotate(p.xyz, vec3(0.0, 1.0, 0.0), uTime * 0.12 + uVelocity + uLag);
  p.xyz = rotate(p.xyz, vec3(1.0, 0.0, 0.0), -PI * 0.15 * (1.0 - uScroll));
  p.z -= 20.0 - 12.0 * uScroll;  // end ≈ z-8 (01:37)
  p.x -= 3.7 * uScroll;          // more left than 01:37's 3.2
  p.y -= 0.85 * uScroll;
  p.x -= 1.4;                    // more left than 01:37's 1.15

  // Idle float. Exactly 0 at 落幅, and uBreath/uTilt are 0 under reduced motion.
  float settle = 1.0 - smoothstep(0.62, 1.0, uScroll);
  p.y += uBreath * settle * sin(uClock * 0.5 + angle * PI * 2.0);
  p.xyz = rotate(p.xyz, vec3(0.0, 0.0, 1.0), uTilt * settle);

  gl_Position = projectionMatrix * viewMatrix * p;
  vUv = uv;
}
`;

// Cover-crop UV + soft edge vignette (no separate shadow mesh).
const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform vec2 uPlane;
uniform vec2 uImage;
uniform float uReady;
uniform float uFocus;
uniform float uWash;
uniform float uScroll;
uniform float uInk;
float inkBlob(vec2 p, vec2 c, float r) {
  vec2 d = (p - c) * vec2(1.0, 1.18);
  return 1.0 - smoothstep(r * 0.62, r, length(d));
}
void main() {
  vec2 uv = vUv;
  if (uImage.x > 1.0 && uImage.y > 1.0) {
    float planeAspect = uPlane.x / max(uPlane.y, 0.0001);
    float imageAspect = uImage.x / max(uImage.y, 0.0001);
    if (imageAspect > planeAspect) {
      float s = planeAspect / imageAspect;
      uv.x = uv.x * s + (1.0 - s) * 0.5;
    } else {
      float s = imageAspect / planeAspect;
      uv.y = uv.y * s + (1.0 - s) * 0.5;
    }
  }
  vec3 paper = vec3(0.902, 0.890, 0.871);
  vec3 color = paper;
  if (uReady > 0.5) color = texture2D(uTexture, uv).rgb;

  // Soft AO — even lighter
  vec2 e = abs(vUv - 0.5) * 2.0;
  float edge = max(e.x, e.y);
  float vignette = smoothstep(0.86, 1.15, edge);
  color *= 1.0 - vignette * 0.07;

  float contact = smoothstep(0.32, 0.0, vUv.y) * 0.045;
  color *= 1.0 - contact;

  float corner = length(e);
  float cornerDark = smoothstep(1.08, 1.48, corner) * 0.035;
  color *= 1.0 - cornerDark;

  // Soft AO kept; wash only true paper. uFocus dims non-front so click/落幅 hero reads clearly.
  float washKill = 1.0 - uWash * smoothstep(0.25, 0.65, uScroll);
  if (washKill < 0.2) discard;
  color = mix(vec3(0.945, 0.945, 0.941), color, clamp(washKill, 0.0, 1.0));
  color *= mix(0.62, 1.0, clamp(uFocus, 0.0, 1.0));

  // Ink bloom layered on the cover. Geometry is unchanged.
  // uInk 0 = paper, about 1.6 = the photograph fully open (~600ms).
  // At 1.5 the three blobs already cover the whole card, so the mix is a no-op.
  if (uInk < 1.5) {
    float spread = max(uInk, 0.0);
    float ink = inkBlob(vUv, vec2(0.50, 0.48), spread * 0.95);
    ink = max(ink, inkBlob(vUv, vec2(0.68, 0.38), spread * 0.58));
    ink = max(ink, inkBlob(vUv, vec2(0.33, 0.64), spread * 0.5));
    color = mix(vec3(0.965, 0.961, 0.953), color, clamp(ink, 0.0, 1.0));
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

/** VERT: world yaw added as `uTime * 0.12 + uVelocity + uLag`. */
const SPIN_RATE = 0.12;
/** VERT cabin yaw at card center: `θ - PI*0.2 - uVelocity*15` (position.x bend is 0 at center). */
const CABIN_YAW = Math.PI * 0.2;
const VEL_YAW = 15;
/** Ring end pose (落幅); list stays still until progress reaches this. */
const LIST_LOCK = 0.92;
/** Idle/mid readable size: ~40% frustum width, 16:9 (demalde DOM-scale order). */
const CARD_FRAC_W = 0.50;
const TEX_MAX = 1920;
/** Underdamped, but the first crossing may not pass 3% of that step's error. */
const ZETA = 0.75;
const OVERSHOOT = 0.03;
const SNAP_X = 1.5e-4;
const SNAP_V = 2e-3;
const SCROLL_OMEGA = 8;
const SPIN_OMEGA = 10;
const VEL_OMEGA = 14;
const TILT_OMEGA = 7;
const TILT_MAX = (4 * Math.PI) / 180;
/** Breathing stays off. A visible bob read as the ring moving by itself. */
const BREATH_AMP = 0;
const BREATH_PERIOD = Math.PI * 4;
const BEND_SCALE = 0.05;
const BEND_MAX = 0.16;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Semi-implicit damped spring. dt is seconds.
 * trackVel damps (v − targetVel) so a constant ramp has no steady lag.
 * Absolute damping (scroll, spin, tilt) uses targetVel 0.
 */
function springStep(spring, target, omega, dt, targetVel = 0, trackVel = false) {
  if (!(dt > 0) || !(omega > 0)) return false;
  const err0 = spring.x - target;
  const damp = trackVel ? spring.v - targetVel : spring.v;
  const accel = -omega * omega * err0 - 2 * ZETA * omega * damp;
  spring.v += accel * dt;
  spring.x += spring.v * dt;

  const err1 = spring.x - target;
  if (err0 * err1 < 0) {
    const cap = OVERSHOOT * Math.abs(err0);
    if (Math.abs(err1) > cap) {
      spring.x = target + Math.sign(err1) * cap;
      spring.v *= 0.25;
    }
  }

  const step = Math.abs(targetVel) * dt;
  const posTol = trackVel ? Math.max(SNAP_X, step * 2 + 1e-5) : SNAP_X;
  const velTol = trackVel ? Math.max(SNAP_V, Math.abs(targetVel) * 0.05 + 1e-4) : SNAP_V;
  const vErr = spring.v - (trackVel ? targetVel : 0);
  if (Math.abs(spring.x - target) < posTol && Math.abs(vErr) < velTol) {
    spring.x = target;
    spring.v = trackVel ? targetVel : 0;
    return true;
  }
  return false;
}

function wrapPi(rad) {
  const t = Math.PI * 2;
  let x = (rad + Math.PI) % t;
  if (x < 0) x += t;
  return x - Math.PI;
}

export function mountPickRing(root, pickData) {
  const canvas = root.querySelector('#pick-canvas');
  const introEl = root.querySelector('#pick-intro');
  const listEl = root.querySelector('#pick-list');
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
    antialias: true,
    dpr: Math.min(2, window.devicePixelRatio || 1),
    webgl: 1,
    preserveDrawingBuffer: false,
  });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.depthMask(true);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // About / Ferris: fov 45, z=5, near 0.1, far 100
  const camera = new Camera(gl, { fov: 45, near: 0.1, far: 100 });
  camera.position.z = 5;

  const scene = new Transform();
  const geometry = new Plane(gl, {
    width: 1,
    height: 1,
    widthSegments: 16,
    heightSegments: 16,
  });

  const N = Math.min(10, images.length);

  const shared = {
    uTime: { value: 0 },
    uVelocity: { value: 0 },
    uScroll: { value: 0 },
    uScale: { value: [1.52, 0.855] },
    uBreath: { value: 0 },
    uTilt: { value: 0 },
    uClock: { value: 0 },
  };

  function frustumSizes() {
    const fovRad = (camera.fov * Math.PI) / 180;
    const h = 2 * Math.tan(fovRad / 2) * camera.position.z;
    const w = h * (camera.aspect || 1);
    return { width: w, height: h };
  }

  function applyCardScale() {
    const sizes = frustumSizes();
    const x = sizes.width * CARD_FRAC_W;
    const y = x * (9 / 16);
    shared.uScale.value = [x, y];
    for (const entry of meshes) {
      entry.uniforms.uPlane.value = [x, y];
    }
  }

  /** Upload cover; downscale in-canvas if larger than TEX_MAX (WebGL limit safety). */
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

    // Sample luminance spread so paper / near-white boards never win front
    try {
      const c = document.createElement('canvas');
      const sw = Math.min(64, iw);
      const sh = Math.min(64, ih);
      c.width = sw; c.height = sh;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(image, 0, 0, sw, sh);
        const data = ctx.getImageData(0, 0, sw, sh).data;
        let sum = 0, sum2 = 0, n = sw * sh;
        for (let i = 0; i < data.length; i += 4) {
          const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          sum += y; sum2 += y * y;
        }
        const mean = sum / n;
        const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
        // Prefer mid-tone, high-contrast covers; punish paper (~230, std<12) & flat white
        let score = std * 1.35 - Math.max(0, mean - 200) * 0.7 - Math.max(0, 40 - mean) * 0.15;
        // Only kill true flat paper. Light UI boards (Genshot/Genstyle) have structure
        // (std≳25) and must stay visible at 落幅 — else eye reads a neighbor as "front".
        if (std < 14 && mean > 200) score = -100;
        // stash on mesh entry via uniforms owner — filled by caller
        uniforms._coverScore = score;
        uniforms._isPaper = score < -50;
      }
    } catch (_) {}
  }

  const meshes = images.slice(0, N).map((img, i) => {
    const texture = new Texture(gl, {
      generateMipmaps: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
    });
    const uniforms = {
      uAngle: { value: i / N },
      uScale: shared.uScale,
      uTime: shared.uTime,
      uScroll: shared.uScroll,
      uVelocity: shared.uVelocity,
      uTexture: { value: texture },
      uPlane: { value: [1.52, 0.855] },
      uImage: { value: [1, 1] },
      uReady: { value: 0 },
      uFocus: { value: 1 },
      uWash: { value: 0 },
      uInk: { value: 1.6 },
      uLag: { value: 0 },
      uBend: { value: 0 },
      uFit: { value: 1 },
      uBreath: shared.uBreath,
      uTilt: shared.uTilt,
      uClock: shared.uClock,
    };

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms,
      cullFace: gl.BACK,
      depthTest: true,
      depthWrite: true,
    });
    const mesh = new Mesh(gl, { geometry, program });
    mesh.frustumCulled = false;
    mesh.setParent(scene);

    const local = `/ring/${i}.jpg`;
    const loader = new Image();
    loader.crossOrigin = 'anonymous';
    loader.decoding = 'async';
    const entry = { mesh, program, img, uniforms, texture, coverScore: 0, isPaper: false };
    const afterPaint = () => {
      entry.coverScore = uniforms._coverScore ?? 0;
      entry.isPaper = !!uniforms._isPaper;
      uniforms.uWash.value = (entry.isPaper || entry.coverScore < -20) ? 1 : 0;
    };
    loader.onload = () => { paintTexture(texture, uniforms, loader); afterPaint(); };
    loader.onerror = () => {
      const fallback = new Image();
      fallback.crossOrigin = 'anonymous';
      fallback.onload = () => { paintTexture(texture, uniforms, fallback); afterPaint(); };
      fallback.src = '/ring/paper.jpg';
    };
    loader.src = local;
    return entry;
  });

  let scrollTarget = 0;
  let lastProgress = 0;
  let smoothedDelta = 0;
  let uTime = 0;
  let inView = true;
  let front = -1;
  let lastNow = performance.now();
  const progressSpring = { x: 0, v: 0 };
  const velHold = { x: 0, v: 0 };
  const spinSpring = { x: 0, v: 0, hold: false };
  const tiltSpring = { x: 0, v: 0 };
  const cardSprings = meshes.map(() => ({ x: 0, v: 0 }));
  let cardsReady = false;
  let prevSharedSpinVel = 0;
  let tiltTarget = 0;
  let breathClock = 0;

  /** Softer springs trail, so the ring opens into a ribbon while it moves. */
  function cardOmega(i) {
    const t = meshes.length <= 1 ? 0 : i / (meshes.length - 1);
    return 18 - 10 * t;
  }

  function listOverflow() {
    if (!listEl || !listWindow) return window.innerHeight * 0.9;
    return Math.max(window.innerHeight * 0.85, listEl.scrollHeight - listWindow.clientHeight);
  }

  // Scroll geometry is cached. Reading it inside the frame forced layout every tick.
  let anchor = 0;
  let runway = 1;
  let limit = 1;
  let scrollY = window.scrollY;
  let raf = 0;

  function measure() {
    if (narrow.matches) return;
    limit = listOverflow();
    runway = Math.max(1, root.offsetHeight - window.innerHeight);
    anchor = root.getBoundingClientRect().top + window.scrollY;
  }

  function syncRunway() {
    if (narrow.matches) {
      root.style.height = '';
      return;
    }
    // runway keeps progress≈1 inside #picks (精选), not into CTA「合作」
    root.style.height = `${window.innerHeight + listOverflow()}px`;
    measure();
  }

  function resize() {
    const host = canvas.parentElement || root;
    const width = host.clientWidth || window.innerWidth;
    const height = host.clientHeight || window.innerHeight;
    viewW = width;
    viewH = height;
    renderer.setSize(width, height);
    camera.perspective({ aspect: width / Math.max(1, height), fov: 45 });
    applyCardScale();
  }

  const waveEl = introEl && introEl.querySelector('[data-role="wave"]');
  const titleLink = introEl && introEl.querySelector('[data-role="title-link"]');
  const summaryEl = introEl && introEl.querySelector('[data-role="summary"]');
  const metaEl = introEl && introEl.querySelector('[data-role="meta"]');
  const bodyEl = introEl && introEl.querySelector('[data-role="body"]');
  const viewEl = introEl && introEl.querySelector('[data-role="view"]');
  const rowEls = [...root.querySelectorAll('.pick-row')];
  const rowBtns = [...root.querySelectorAll('.pick-row-btn')];
  const haloEl = root.querySelector('#pick-halo');
  const haloWash = root.querySelector('.pick-halo-wash');
  const sealEl = root.querySelector('#pick-seal');
  const sealPress = root.querySelector('.pick-seal-press');
  const sealCharEl = root.querySelector('[data-role="seal-char"]');
  const soundBtn = root.querySelector('#pick-sound');
  const soundLabel = root.querySelector('[data-role="sound-label"]');

  let pinned = -1;
  let pinScroll = 0;
  let inkJob = null; // { index, start }
  let inkHold = -1;
  let picksSeen = false;
  let viewW = 1;
  let viewH = 1;
  // Effects stay quiet until a click or a real scroll. The first setFront on load does not count.
  let userMoved = false;
  let gestureScroll = window.scrollY;
  let soundOn = false;
  let audioCtx = null;
  let fxIndex = -1;
  let haloIndex = -1;
  let sealIndex = -1;

  /** Cover of the card that just became front. Paper until the section is on screen. */
  function beginInk(index) {
    const entry = meshes[index];
    if (!entry) return;
    if (motion.matches) {
      entry.uniforms.uInk.value = 1.6;
      inkJob = null;
      inkHold = -1;
      return;
    }
    entry.uniforms.uInk.value = 0;
    if (!picksSeen) {
      inkHold = index;
      inkJob = null;
      return;
    }
    inkHold = -1;
    inkJob = { index, start: performance.now() };
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
  }

  /** Scroll `.pick-list-window` so row index is visible (no page scroll). */
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

  function setFront(index, opts) {
    const forceScroll = !!(opts && opts.scrollList);
    if (index === front) {
      if (forceScroll) ensureRowVisible(index);
      return;
    }
    front = index;
    const work = pickData[index];
    fillCopy(work);
    paintWave(waveEl, index);
    beginInk(index);
    syncList(index);
    // After ring 落幅 (or explicit select), keep active row in the catalog window.
    if (forceScroll || lastProgress >= LIST_LOCK) ensureRowVisible(index);
  }

  function smoothstep01(t) {
    const x = Math.min(1, Math.max(0, t));
    return x * x * (3 - 2 * x);
  }

  /**
   * Eye yaw of card center. VERT writes the rotation matrix in column-major order,
   * so it is transposed: world Z of the normal is cos(yaw0 + spin) either way.
   * yaw0 = θ - CABIN_YAW - VEL_YAW*vel, spin = uTime*SPIN_RATE + vel.
   * The old front (θ - spin - (π/2 - π*0.2)) only matched this at rest (both pick i=1).
   * Once spin or uVelocity moved, list/copy followed the old score and the card
   * facing the camera was a different slot — about a quarter turn on click.
   * Faces the camera when eyeYaw ≡ 0.
   */
  function eyeYaw(index, spin, vel) {
    const theta = (index / N) * Math.PI * 2;
    return theta - CABIN_YAW - (vel || 0) * VEL_YAW + spin;
  }

  /** Face-on score. Higher = card center normal toward the camera. */
  function cardFacing(index, spin, vel) {
    return Math.cos(wrapPi(eyeYaw(index, spin, vel)));
  }

  /**
   * Click hit-test only (not scroll-hero): nearest screen-X among facing cards.
   * Scroll-hero uses argmax cardFacing — proximity to heroNX disagreed with eye.
   */
  function heroNX(progress) {
    return lerp(0.52, 0.36, smoothstep01(progress));
  }

  function pickIndexAtNX(nx, spin, progress) {
    const base = spin == null ? liveSpin() : spin;
    const pr = progress == null ? shared.uScroll.value : progress;
    const vel = motion.matches ? 0 : shared.uVelocity.value;
    const scored = [];
    for (let i = 0; i < meshes.length; i++) {
      const sp = base + lagOf(i);
      const facing = cardFacing(i, sp, vel);
      if (facing < -0.2) continue;
      const sx = cardScreenNX(i, sp, pr);
      if (sx < 0.0 || sx > 1.0) continue;
      scored.push({ i, facing, sx, d: Math.abs(sx - nx) });
    }
    if (!scored.length) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < meshes.length; i++) {
        const sx = cardScreenNX(i, base + lagOf(i), pr);
        const d = Math.abs(sx - nx);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    }
    scored.sort((a, b) => a.d - b.d || b.facing - a.facing);
    return scored[0].i;
  }

  /** Absolute world spin that puts card index face-on at this velocity. */
  function spinForFront(index, vel) {
    const theta = (index / N) * Math.PI * 2;
    return -theta + CABIN_YAW + (vel || 0) * VEL_YAW;
  }

  function liveSpin() {
    return uTime * SPIN_RATE + (motion.matches ? 0 : smoothedDelta);
  }

  function lagOf(i) {
    if (motion.matches) return 0;
    const u = meshes[i] && meshes[i].uniforms.uLag;
    return u ? u.value : 0;
  }

  function cardSpin(i, base) {
    return (base == null ? liveSpin() : base) + lagOf(i);
  }

  /** 1 at rest, exactly 0 at uScroll = 1. Matches the shader smoothstep. */
  function settleOf(progress) {
    const t = Math.min(1, Math.max(0, (progress - 0.62) / 0.38));
    const s = t * t * (3 - 2 * t);
    return 1 - s;
  }

  function visualTilt(progress) {
    if (motion.matches) return 0;
    return tiltSpring.x * settleOf(progress);
  }

  function snapCards(spin) {
    for (let i = 0; i < meshes.length; i++) {
      cardSprings[i].x = spin;
      cardSprings[i].v = 0;
      meshes[i].uniforms.uLag.value = 0;
      meshes[i].uniforms.uBend.value = 0;
    }
  }

  /** Select item: sync left copy + list; rotate ring so that card's center faces the camera. No navigate. */
  function select(index) {
    if (!Number.isFinite(index) || index < 0 || index >= pickData.length) return;
    // Ring only has N meshes — never pin past the last card (avoids θ alias desync).
    const i = Math.min(index, meshes.length - 1);
    userMoved = true;
    pinned = i;
    pinScroll = scrollTarget;
    const vel = motion.matches ? 0 : smoothedDelta;
    const now = liveSpin();
    if (motion.matches) {
      // Snap. Reduced motion skips the spring, but the face-on card must still match the list.
      smoothedDelta = 0;
      velHold.x = 0;
      velHold.v = 0;
      progressSpring.v = 0;
      uTime = spinForFront(i, 0) / SPIN_RATE;
      spinSpring.hold = false;
      spinSpring.x = spinForFront(i, 0);
      spinSpring.v = 0;
      snapCards(uTime * SPIN_RATE);
    } else {
      // Spring the velocity-free part of spin. Each frame adds VEL_YAW*vel back so eye yaw
      // stays on the curve while scroll velocity dies (see frame).
      spinSpring.x = now - VEL_YAW * vel;
      spinSpring.v = 0;
      spinSpring.hold = true;
    }
    setFront(i, { scrollList: true });
    kick();
  }

  // 宫商角徵羽, then the same degrees an octave up. Index i → degree i % 5.
  const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0];
  const HALO_W = 220;
  const HALO_H = 150;
  const SEAL = 34;
  // One character per work. Missing slugs fall back to the first CJK in the title.
  const SEAL_CHAR = {
    'xihu-panorama': '西',
    litflow: '流',
    'riffle-ai-game-generation-tool': '戏',
    scendance: '幕',
    'bazi-fengshui-analysis': '风',
    'genshot-AI-video-generation-tool': '镜',
    genstyle: '衣',
    anyreal: '影',
    'dragon-diffussion': '龙',
    'early-campus-experience': '校',
  };
  // slug → AudioBuffer, Promise, or 'miss'. A file at /ring-sounds/<slug>.mp3 replaces the pluck.
  const sampleCache = new Map();

  function sealChar(work) {
    if (!work) return '';
    if (work.slug && SEAL_CHAR[work.slug]) return SEAL_CHAR[work.slug];
    const title = work.title || '';
    const cjk = title.match(/[\u4e00-\u9fff]/);
    if (cjk) return cjk[0];
    const trimmed = title.trim();
    return trimmed ? trimmed[0] : '';
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
    // Don't wait on the file. The pluck stands in until a buffer is cached.
    pluckKS(degreeFreq(index));
    if (slug && !sampleCache.has(slug)) probeSample(slug);
  }

  function bloomWash(retractFirst) {
    if (!haloWash) return;
    haloWash.getAnimations().forEach((anim) => anim.cancel());
    if (motion.matches) {
      haloIndex = fxIndex;
      haloWash.style.opacity = '1';
      haloWash.style.transform = 'scale(1)';
      return;
    }
    const bloom = () => {
      haloWash.animate(
        [
          { opacity: 0, transform: 'scale(0.72)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
        { duration: 520, easing: 'cubic-bezier(0.22, 0.61, 0.18, 1)', fill: 'forwards' },
      );
    };
    if (!retractFirst) {
      bloom();
      return;
    }
    const retract = haloWash.animate(
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.84)' },
      ],
      { duration: 140, easing: 'ease-in', fill: 'forwards' },
    );
    retract.onfinish = () => {
      haloIndex = fxIndex;
      placeOverlays();
      bloom();
    };
  }

  function stampSeal(index) {
    if (!sealPress) return;
    const ch = sealChar(pickData[index]);
    if (sealCharEl) sealCharEl.textContent = ch;
    sealPress.getAnimations().forEach((anim) => anim.cancel());
    if (motion.matches) {
      sealPress.style.opacity = '1';
      sealPress.style.transform = 'scale(1)';
      return;
    }
    sealPress.animate(
      [
        { transform: 'scale(1.45)', opacity: 0 },
        { transform: 'scale(0.9)', opacity: 1, offset: 0.55 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 280, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'forwards' },
    );
  }

  function startFx(index) {
    const prev = haloIndex;
    fxIndex = index;
    sealIndex = index;
    stampSeal(index);
    pluck(index);
    if (prev >= 0 && prev !== index) bloomWash(true);
    else {
      haloIndex = index;
      bloomWash(false);
    }
  }

  /** Front-center card the user actually brought around. Load never calls this. */
  function maybeFx(index, facing) {
    if (!userMoved || index < 0 || index === fxIndex) return;
    if (facing < 0.82) return;
    startFx(index);
  }

  function placeOverlays() {
    const progress = shared.uScroll.value;
    const base = liveSpin();
    if (haloEl && haloIndex >= 0) {
      const spin = base + lagOf(haloIndex);
      const c = projectLocal(haloIndex, spin, progress, 0, 0);
      const left = projectLocal(haloIndex, spin, progress, -0.5, 0);
      const right = projectLocal(haloIndex, spin, progress, 0.5, 0);
      const cardW = Math.abs(right.x - left.x);
      const s = Math.max(0.35, (cardW * 2.35) / HALO_W);
      const x = c.x - (HALO_W * s) / 2;
      const y = c.y - (HALO_H * s) / 2;
      haloEl.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
    }
    if (sealEl && sealIndex >= 0) {
      const corner = projectLocal(sealIndex, base + lagOf(sealIndex), progress, 0.34, 0.32);
      const x = corner.x - SEAL / 2;
      const y = corner.y - SEAL / 2;
      sealEl.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    }
  }

  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      soundOn = !soundOn;
      soundBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
      soundBtn.setAttribute('aria-label', soundOn ? '声音 开' : '声音 关');
      if (soundLabel) soundLabel.textContent = soundOn ? '开' : '关';
      if (!soundOn) return;
      // This click is the gesture that may create the audio context.
      ensureCtx();
      for (let i = 0; i < pickData.length; i++) {
        const slug = pickData[i] && pickData[i].slug;
        if (slug) probeSample(slug);
      }
      // The card already resting at front-center plays once. A later spin continues the melody.
      if (front >= 0) {
        const facing = cardFacing(front, liveSpin() + lagOf(front), motion.matches ? 0 : smoothedDelta);
        if (facing > 0.82) pluck(front);
      }
    });
  }

  function frame(now) {
    const dt = Math.min(34, now - lastNow);
    lastNow = now;
    if (narrow.matches) {
      raf = 0;
      return;
    }

    const passed = Math.min(runway, Math.max(0, scrollY - anchor));
    scrollTarget = -passed * (limit / runway);

    // Page progress, not the spring. LIST_LOCK / unpin stay on this so a 3%
    // overshoot cannot toggle 落幅 or drop a click hold.
    let pageProgress = runway > 0 ? passed / runway : 0;
    if (pageProgress < 0.0008) pageProgress = 0;
    if (pageProgress > 1) pageProgress = 1;
    pageProgress = Math.round(pageProgress * 1e4) / 1e4;
    lastProgress = pageProgress;

    const dtSec = Math.min(0.05, Math.max(0, dt / 1000));
    if (motion.matches) {
      progressSpring.x = pageProgress;
      progressSpring.v = 0;
      velHold.x = 0;
      velHold.v = 0;
      smoothedDelta = 0;
    } else {
      springStep(progressSpring, pageProgress, SCROLL_OMEGA, dtSec);
      if (pageProgress === 0 && Math.abs(progressSpring.x) < 0.004 && Math.abs(progressSpring.v) < 0.08) {
        progressSpring.x = 0;
        progressSpring.v = 0;
      }
    }

    // Release pin only on real page scroll — spring noise at 落幅 must not
    // drop the click hold (list said one work while the ring drifted).
    const unpinSlop = Math.max(28, limit * 0.035);
    if (pinned >= 0 && Math.abs(scrollTarget - pinScroll) > unpinSlop) {
      pinned = -1;
      spinSpring.hold = false;
    }

    if (!motion.matches) {
      const frameDelta = progressSpring.v * dtSec;
      if (pinned < 0) {
        velHold.x = frameDelta;
        velHold.v = 0;
        smoothedDelta = frameDelta;
      } else {
        springStep(velHold, 0, VEL_OMEGA, dtSec);
        smoothedDelta = Math.abs(velHold.x) < 1e-5 ? 0 : velHold.x;
      }
    }

    let progress = progressSpring.x;
    if (progress < 0) progress = 0;
    else if (progress > 1) progress = 1;
    progress = Math.round(progress * 1e4) / 1e4;

    if (pinned >= 0 && !motion.matches) {
      const goal = spinForFront(pinned, 0);
      if (spinSpring.hold) {
        if (springStep(spinSpring, goal, SPIN_OMEGA, dtSec)) spinSpring.hold = false;
      } else {
        spinSpring.x = goal;
        spinSpring.v = 0;
      }
      // visual is the vel=0 spin. Shader still subtracts VEL_YAW*vel, so add it back.
      const visual = spinSpring.x;
      const want = visual + VEL_YAW * smoothedDelta;
      uTime = (want - smoothedDelta) / SPIN_RATE;
    } else if (inView && !motion.matches && Math.abs(smoothedDelta) > 1e-5) {
      // Scroll flings the ring. Nothing is added while the page is still,
      // so the ring does not spin on its own.
      uTime += 15 * smoothedDelta;
    }

    breathClock = (breathClock + 0.009 * dt) % BREATH_PERIOD;
    shared.uBreath.value = motion.matches ? 0 : BREATH_AMP;
    if (motion.matches) {
      tiltSpring.x = 0;
      tiltSpring.v = 0;
      shared.uTilt.value = 0;
    } else {
      springStep(tiltSpring, tiltTarget, TILT_OMEGA, dtSec);
      shared.uTilt.value = tiltSpring.x;
    }
    shared.uClock.value = breathClock;

    if (inkJob && !motion.matches) {
      const t = Math.min(1, (now - inkJob.start) / INK_MS);
      const e = 1 - Math.pow(1 - t, 3);
      const entry = meshes[inkJob.index];
      if (entry) entry.uniforms.uInk.value = e * 1.6;
      if (t >= 1) inkJob = null;
    }

    const vel = motion.matches ? 0 : smoothedDelta;
    shared.uTime.value = uTime;
    shared.uVelocity.value = vel;
    shared.uScroll.value = progress;

    const spin = uTime * SPIN_RATE + vel;
    // No idle cruise. Velocity is only the scroll fling or the click spring.
    let sharedSpinVel = 0;
    if (!motion.matches && pinned >= 0) {
      sharedSpinVel = spinSpring.v + VEL_YAW * velHold.v;
    } else if (!motion.matches && Math.abs(progressSpring.v) > 1e-3) {
      sharedSpinVel = SPIN_RATE * 15 * progressSpring.v;
    }
    const spinAccel = dtSec > 0 ? Math.abs(sharedSpinVel - prevSharedSpinVel) / dtSec : 0;
    prevSharedSpinVel = sharedSpinVel;
    // Constant cruise has no stagger. Glue once the tails are close so a settled
    // ring matches the single shared angle exactly (list / caption / front card).
    const coasting = spinAccel < 1.5;
    if (motion.matches) {
      snapCards(spin);
      cardsReady = true;
    } else if (!cardsReady) {
      for (let i = 0; i < meshes.length; i++) {
        cardSprings[i].x = spin;
        cardSprings[i].v = sharedSpinVel;
        meshes[i].uniforms.uLag.value = 0;
        meshes[i].uniforms.uBend.value = 0;
      }
      cardsReady = true;
    } else {
      for (let i = 0; i < meshes.length; i++) {
        const s = cardSprings[i];
        springStep(s, spin, cardOmega(i), dtSec, sharedSpinVel, true);
        let lag = s.x - spin;
        let relV = s.v - sharedSpinVel;
        if (Math.abs(sharedSpinVel) < 0.02 || (coasting && Math.abs(lag) < 0.05)) {
          lag = 0;
          relV = 0;
          s.x = spin;
          s.v = sharedSpinVel;
        } else if (Math.abs(lag) < 1e-4) {
          lag = 0;
          s.x = spin;
        }
        meshes[i].uniforms.uLag.value = lag;
        let bend = relV * BEND_SCALE;
        if (bend > BEND_MAX) bend = BEND_MAX;
        else if (bend < -BEND_MAX) bend = -BEND_MAX;
        if (Math.abs(bend) < 1e-3) bend = 0;
        meshes[i].uniforms.uBend.value = bend;
      }
    }

    // Per-card angle, so a trailing card can be the one actually facing the camera.
    let best = 0;
    let bestFacing = -Infinity;
    const facings = new Array(meshes.length);
    for (let i = 0; i < meshes.length; i++) {
      const facing = cardFacing(i, spin + meshes[i].uniforms.uLag.value, vel);
      facings[i] = facing;
      if (facing > bestFacing) {
        bestFacing = facing;
        best = i;
      }
    }
    // Near a crossover, keep the current row so ribbon lag does not flicker the caption.
    if (pinned < 0 && front >= 0 && front < meshes.length && best !== front) {
      if (facings[front] > bestFacing - 0.035) best = front;
    }
    const hero = pinned >= 0 ? pinned : best;
    for (let i = 0; i < meshes.length; i++) {
      const facing = facings[i];
      const isHero = i === hero;
      // Draw the facing card last, without a depth test, so a neighbor's near
      // edge cannot cover it. Pinned neighbors also shrink and step back.
      meshes[i].mesh.renderOrder = isHero ? 2 : 0;
      meshes[i].program.depthTest = !isHero;
      meshes[i].uniforms.uFit.value = pinned >= 0 && !isHero ? 0.82 : 1;
      meshes[i].uniforms.uFocus.value = isHero
        ? 1
        : pinned >= 0
          ? 0.36
          : Math.max(0.12, facing * 0.45 + 0.02);
      if (isHero) meshes[i].uniforms.uWash.value = 0;
      else if (meshes[i].isPaper || meshes[i].coverScore < -20) meshes[i].uniforms.uWash.value = 1;
      else meshes[i].uniforms.uWash.value = 0;
    }

    // List stays put during approach/zoom; only the ring uses sprung progress.
    // 落幅 follows the page, so spring overshoot cannot toggle the catalog.
    const end = pageProgress > LIST_LOCK;
    if (root.classList.contains('is-end') !== end) root.classList.toggle('is-end', end);
    const progLabel = progress.toFixed(3);
    if (root.dataset.progress !== progLabel) root.dataset.progress = progLabel;
    const active = pinned >= 0 ? pinned : best;
    setFront(active);
    maybeFx(active, active >= 0 ? facings[active] : -1);
    placeOverlays(progress, spin);

    renderer.render({ scene, camera, frustumCull: false });
    if (needsFrame()) raf = requestAnimationFrame(frame);
    else raf = 0;
  }

  function needsFrame() {
    if (inkJob) return true;
    if (Math.abs(progressSpring.x - lastProgress) > 2e-4 || Math.abs(progressSpring.v) > 2e-3) return true;
    if (Math.abs(tiltSpring.x - tiltTarget) > 1e-4 || Math.abs(tiltSpring.v) > 2e-3) return true;
    if (pinned >= 0 && spinSpring.hold) return true;
    if (Math.abs(smoothedDelta) > 1e-4 || Math.abs(velHold.v) > 2e-3) return true;
    for (let i = 0; i < meshes.length; i++) {
      if (Math.abs(meshes[i].uniforms.uLag.value) > 1e-4) return true;
      if (Math.abs(meshes[i].uniforms.uBend.value) > 1e-4) return true;
    }
    return false;
  }

  function kick() {
    if (raf || narrow.matches) return;
    lastNow = performance.now();
    raf = requestAnimationFrame(frame);
  }

  const watch = new IntersectionObserver(
    (entries) => {
      inView = entries.some((entry) => entry.isIntersecting);
      if (!inView) return;
      picksSeen = true;
      if (inkHold >= 0) beginInk(inkHold);
      kick();
    },
    { threshold: 0.12 },
  );
  watch.observe(root);
  if (motion.matches) root.classList.add('is-reduced');

  // Desktop: canvas / 名录 select only (bring to front + left sync). Detail via「查看作品 →」/ title link.
  /**
   * Project ring phase (θ−spin) to normalized canvas X.
   * Used for click hit-testing (pickIndexAtNX); not for scroll-hero / best.
   */
  /** Same column-major mat4 the vertex shader builds (row-written, so transposed). */
  function shaderRotate(axis, angle, v) {
    const ax = axis[0];
    const ay = axis[1];
    const az = axis[2];
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    const oc = 1 - c;
    const m0 = oc * ax * ax + c;
    const m1 = oc * ax * ay - az * s;
    const m2 = oc * az * ax + ay * s;
    const m4 = oc * ax * ay + az * s;
    const m5 = oc * ay * ay + c;
    const m6 = oc * ay * az - ax * s;
    const m8 = oc * az * ax - ay * s;
    const m9 = oc * ay * az + ax * s;
    const m10 = oc * az * az + c;
    const x = v[0];
    const y = v[1];
    const z = v[2];
    return [
      m0 * x + m4 * y + m8 * z,
      m1 * x + m5 * y + m9 * z,
      m2 * x + m6 * y + m10 * z,
    ];
  }

  /** Screen pixels of a point on the card. localX/localY are -0.5..0.5 in the plane. */
  function projectLocal(index, spin, progress, localX, localY) {
    const theta = (index / N) * Math.PI * 2;
    const grow = 1 + 0.5 * progress * progress;
    const scale = shared.uScale.value;
    const vel = motion.matches ? 0 : shared.uVelocity.value;
    const yaw0 = theta - Math.PI * 0.2 - localX * 0.3 - vel * 15;
    let p = shaderRotate([0, 1, 0], yaw0, [localX * scale[0] * grow, localY * scale[1] * grow, 0]);
    p[0] += 3 * Math.cos(theta);
    p[2] += 3 * Math.sin(theta);
    p = shaderRotate([0, 1, 0], spin, p);
    p = shaderRotate([1, 0, 0], -Math.PI * 0.15 * (1 - progress), p);
    p[0] -= 3.7 * progress + 1.4;
    p[1] -= 0.85 * progress;
    p[2] -= 20 - 12 * progress;
    const tilt = visualTilt(progress);
    if (tilt) p = shaderRotate([0, 0, 1], tilt, p);
    const depth = Math.max(0.35, -(p[2] - camera.position.z));
    const fovRad = (camera.fov * Math.PI) / 180;
    const halfH = Math.tan(fovRad / 2) * depth;
    const halfW = halfH * (camera.aspect || 1);
    return {
      x: ((p[0] / Math.max(1e-4, halfW)) * 0.5 + 0.5) * viewW,
      y: (0.5 - (p[1] / Math.max(1e-4, halfH)) * 0.5) * viewH,
    };
  }

  function phaseScreen(phase, progress, fit) {
    const R = 3;
    let x = R * Math.cos(phase);
    let y = 0;
    let z = R * Math.sin(phase);
    const pitch = -Math.PI * 0.15 * (1 - progress);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    // Shader's mat4 constructor is column-major, so this X pitch is transposed.
    const y2 = y * cp + z * sp;
    const z2 = -y * sp + z * cp;
    x -= 3.7 * progress + 1.4;
    y = y2 - 0.85 * progress;
    z = z2 - (20 - 12 * progress);
    // Same transposed Z rotation as the shader (column-major matrix is stored transposed).
    const tilt = visualTilt(progress);
    if (tilt !== 0) {
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      const xt = x * ct + y * st;
      const yt = -x * st + y * ct;
      x = xt;
      y = yt;
    }
    const viewZ = z - camera.position.z;
    const depth = Math.max(0.35, -viewZ);
    const fovRad = (camera.fov * Math.PI) / 180;
    const halfH = Math.tan(fovRad / 2) * depth;
    const halfW = halfH * (camera.aspect || 1);
    const nx = (x / Math.max(1e-4, halfW)) * 0.5 + 0.5;
    const ny = 0.5 - (y / Math.max(1e-4, halfH)) * 0.5;
    const grow = 1 + 0.5 * progress * progress;
    const scale = shared.uScale.value;
    const f = fit == null ? 1 : fit;
    const pxW = ((scale[0] * grow * f * 0.5) / Math.max(1e-4, halfW)) * viewW;
    const pxH = ((scale[1] * grow * f * 0.5) / Math.max(1e-4, halfH)) * viewH;
    return { nx, ny, pxW, pxH };
  }

  function phaseScreenNX(phase, progress) {
    return phaseScreen(phase, progress, 1).nx;
  }

  function cardScreen(index, spin, progress, fit) {
    const theta = (index / N) * Math.PI * 2;
    // Transposed Y rotation sends the ring angle to θ+spin (not θ−spin).
    return phaseScreen(theta + spin, progress, fit);
  }

  function cardScreenNX(index, spin, progress) {
    return cardScreen(index, spin, progress, 1).nx;
  }

  /** Map click on canvas to the visible card under the cursor (hit-test only). */
  function pickIndexAtClientX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const nx = (clientX - rect.left) / Math.max(1, rect.width);
    return pickIndexAtNX(nx);
  }
  canvas.addEventListener('click', (e) => {
    select(pickIndexAtClientX(e.clientX));
  });
  rowBtns.forEach((btn) => {
    btn.addEventListener('click', () => select(Number(btn.dataset.i)));
  });
  window.addEventListener('pointermove', (e) => {
    const nx = e.clientX / Math.max(1, window.innerWidth);
    const next = (Math.min(1, Math.max(0, nx)) - 0.5) * 2 * TILT_MAX;
    if (Math.abs(next - tiltTarget) < 1e-4) return;
    tiltTarget = next;
    kick();
  });
  window.addEventListener('pointerleave', () => {
    if (tiltTarget === 0) return;
    tiltTarget = 0;
    kick();
  });
  // During approach, pin catalog scroll; after 落幅 allow overflow scroll for selection.
  listWindow?.addEventListener('scroll', () => {
    if (lastProgress < LIST_LOCK) listWindow.scrollTop = 0;
  });

  root.__pickRing = {
    select,
    pickAt: pickIndexAtClientX,
    state: () => {
      const progress = shared.uScroll.value;
      const spin = liveSpin();
      const vel = motion.matches ? 0 : smoothedDelta;
      const hnx = heroNX(progress);
      let best = 0;
      let bestFacing = -Infinity;
      let maxLag = 0;
      let maxBend = 0;
      const cards = [];
      for (let i = 0; i < meshes.length; i++) {
        const lag = lagOf(i);
        const bend = meshes[i].uniforms.uBend.value;
        if (Math.abs(lag) > maxLag) maxLag = Math.abs(lag);
        if (Math.abs(bend) > maxBend) maxBend = Math.abs(bend);
        const card = spin + lag;
        const facing = cardFacing(i, card, vel);
        const sx = cardScreenNX(i, card, progress);
        if (facing > bestFacing) {
          bestFacing = facing;
          best = i;
        }
        cards.push({
          i,
          title: (pickData[i] && pickData[i].title) || '',
          sx: Math.round(sx * 1000) / 1000,
          facing: Math.round(facing * 1000) / 1000,
          lag: Math.round(lag * 1000) / 1000,
          dHero: Math.round(Math.abs(sx - hnx) * 1000) / 1000,
        });
      }
      cards.sort((a, b) => b.facing - a.facing || a.dHero - b.dHero);
      const frontSpin = spin + lagOf(Math.max(0, front));
      return {
        front,
        pinned,
        progress,
        page: lastProgress,
        vel,
        uTime,
        eye: front < 0 ? null : Math.round(wrapPi(eyeYaw(front, frontSpin, vel)) * 1000) / 1000,
        heroNX: Math.round(hnx * 1000) / 1000,
        spin,
        maxLag: Math.round(maxLag * 1e4) / 1e4,
        maxBend: Math.round(maxBend * 1e4) / 1e4,
        tilt: Math.round(visualTilt(progress) * 1e4) / 1e4,
        breath: motion.matches ? 0 : Math.round(BREATH_AMP * settleOf(progress) * 1e4) / 1e4,
        heroDepthTest: front >= 0 ? meshes[front].program.depthTest : null,
        best,
        bestFacing: Math.round(bestFacing * 1000) / 1000,
        bestTitle: (pickData[best] && pickData[best].title) || '',
        frontTitle: (pickData[front] && pickData[front].title) || '',
        top: cards.slice(0, 4),
        n: meshes.length,
        sound: soundOn,
        fx: fxIndex,
        seal: sealCharEl ? sealCharEl.textContent : '',
        userMoved,
      };
    },
  };

  syncRunway();
  resize();
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (Math.abs(y - gestureScroll) > 8) {
      userMoved = true;
      gestureScroll = y;
    }
    scrollY = y;
    kick();
  }, { passive: true });
  window.addEventListener('resize', () => {
    syncRunway();
    resize();
    kick();
  });
  window.addEventListener('load', () => {
    syncRunway();
    kick();
  });
  kick();
}
