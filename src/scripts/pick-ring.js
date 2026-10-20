import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'ogl';

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

  // Back to ~01:37 end dose (~3 near), then nudge MORE LEFT than that round
  float grow = 1.0 + 0.5 * uScroll * uScroll;
  vec4 p = cabinMatrix(vec3(ring.x, 0.0, ring.y), yaw0, vec3(uScale.x * grow, uScale.y * grow, 1.0)) * vec4(position, 1.0);
  p.xyz = rotate(p.xyz, vec3(0.0, 1.0, 0.0), uTime * 0.12 + uVelocity);
  p.xyz = rotate(p.xyz, vec3(1.0, 0.0, 0.0), -PI * 0.15 * (1.0 - uScroll));
  p.z -= 20.0 - 12.0 * uScroll;  // end ≈ z-8 (01:37)
  p.x -= 3.7 * uScroll;          // more left than 01:37's 3.2
  p.y -= 0.85 * uScroll;
  p.x -= 1.4;                    // more left than 01:37's 1.15

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

  gl_FragColor = vec4(color, 1.0);
}
`;

const SCROLL_LERP = 0.1;
const DELTA_LERP = 0.1;
/** VERT: world yaw added as `uTime * 0.12 + uVelocity`. */
const SPIN_RATE = 0.12;
/** VERT cabin yaw at card center: `θ - PI*0.2 - uVelocity*15` (position.x bend is 0 at center). */
const CABIN_YAW = Math.PI * 0.2;
const VEL_YAW = 15;
/** Ring end pose (落幅); list stays still until progress reaches this. */
const LIST_LOCK = 0.92;
/** Idle/mid readable size: ~40% frustum width, 16:9 (demalde DOM-scale order). */
const CARD_FRAC_W = 0.50;
const TEX_MAX = 1920;

function lerp(a, b, t) {
  return a + (b - a) * t;
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
    preserveDrawingBuffer: true,
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
    widthSegments: 50,
    heightSegments: 50,
  });

  const N = Math.min(10, images.length);

  const shared = {
    uTime: { value: 0 },
    uVelocity: { value: 0 },
    uScroll: { value: 0 },
    uScale: { value: [1.52, 0.855] },
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
      uScroll: shared.uScroll,
    };

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms,
      cullFace: false,
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
    const entry = { mesh, img, uniforms, texture, coverScore: 0, isPaper: false };
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
  let scrollCurrent = 0;
  let lastProgress = 0;
  let smoothedDelta = 0;
  let uTime = 0;
  let inView = true;
  let front = -1;
  let lastNow = performance.now();

  function listOverflow() {
    if (!listEl || !listWindow) return window.innerHeight * 0.9;
    return Math.max(window.innerHeight * 0.85, listEl.scrollHeight - listWindow.clientHeight);
  }

  function syncRunway() {
    if (narrow.matches) {
      root.style.height = '';
      return;
    }
    // runway keeps progress≈1 inside #picks (精选), not into CTA「合作」
    root.style.height = `${window.innerHeight + listOverflow()}px`;
  }

  function resize() {
    const host = canvas.parentElement || root;
    const width = host.clientWidth || window.innerWidth;
    const height = host.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    camera.perspective({ aspect: width / Math.max(1, height), fov: 45 });
    applyCardScale();
  }

  const titleLink = introEl && introEl.querySelector('[data-role="title-link"]');
  const summaryEl = introEl && introEl.querySelector('[data-role="summary"]');
  const metaEl = introEl && introEl.querySelector('[data-role="meta"]');
  const bodyEl = introEl && introEl.querySelector('[data-role="body"]');
  const viewEl = introEl && introEl.querySelector('[data-role="view"]');
  const rowEls = [...root.querySelectorAll('.pick-row')];
  const rowBtns = [...root.querySelectorAll('.pick-row-btn')];

  let pinned = -1;
  let pinScroll = 0;
  let spinAnim = null; // { from, to, start }

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
    const sp = spin == null ? liveSpin() : spin;
    const pr = progress == null ? lastProgress : progress;
    const scored = [];
    for (let i = 0; i < meshes.length; i++) {
      const facing = cardFacing(i, sp, motion.matches ? 0 : shared.uVelocity.value);
      if (facing < -0.2) continue;
      const sx = cardScreenNX(i, sp, pr);
      if (sx < 0.0 || sx > 1.0) continue;
      scored.push({ i, facing, sx, d: Math.abs(sx - nx) });
    }
    if (!scored.length) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < meshes.length; i++) {
        const sx = cardScreenNX(i, sp, pr);
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

  /** Select item: sync left copy + list; rotate ring so that card's center faces the camera. No navigate. */
  function select(index) {
    if (!Number.isFinite(index) || index < 0 || index >= pickData.length) return;
    // Ring only has N meshes — never pin past the last card (avoids θ alias desync).
    const i = Math.min(index, meshes.length - 1);
    pinned = i;
    pinScroll = scrollTarget;
    const vel = motion.matches ? 0 : smoothedDelta;
    const now = liveSpin();
    if (motion.matches) {
      // Snap. Reduced motion skips the tween, but the face-on card must still match the list.
      smoothedDelta = 0;
      uTime = spinForFront(i, 0) / SPIN_RATE;
      spinAnim = null;
    } else {
      // Ease the velocity-free part of spin. Each frame adds 15*vel back so eye yaw
      // stays on the curve while scroll velocity dies (see frame).
      spinAnim = { from: now - VEL_YAW * vel, start: performance.now() };
    }
    setFront(i, { scrollList: true });
  }

  function frame(now) {
    const dt = Math.min(34, now - lastNow);
    lastNow = now;
    if (narrow.matches) {
      requestAnimationFrame(frame);
      return;
    }

    const limit = listOverflow();
    const rect = root.getBoundingClientRect();
    const runway = Math.max(1, root.offsetHeight - window.innerHeight);
    const passed = Math.min(runway, Math.max(0, -rect.top));
    scrollTarget = -passed * (limit / runway);

    const follow = motion.matches ? 1 : SCROLL_LERP;
    scrollCurrent = lerp(scrollCurrent, scrollTarget, follow);
    if (scrollCurrent > -0.4) scrollCurrent = 0;

    let progress = limit > 0 ? Math.abs(scrollCurrent) / limit : 0;
    if (progress > 1) progress = 1;
    progress = Math.round(progress * 1e4) / 1e4;

    const delta = progress - lastProgress;
    smoothedDelta = lerp(smoothedDelta, motion.matches ? 0 : delta, DELTA_LERP);
    lastProgress = progress;

    // Release pin only on real page scroll — lerp noise at 落幅 used to be >1px
    // and dropped the click hold (list said Genstyle while ring drifted).
    const unpinSlop = Math.max(28, limit * 0.035);
    if (pinned >= 0 && Math.abs(scrollTarget - pinScroll) > unpinSlop) {
      pinned = -1;
      spinAnim = null;
    }

    if (pinned >= 0 && !motion.matches) {
      smoothedDelta = lerp(smoothedDelta, 0, spinAnim ? 0.35 : 0.4);
      const vel = smoothedDelta;
      let visual = spinForFront(pinned, 0);
      if (spinAnim) {
        const t = Math.min(1, (now - spinAnim.start) / 450);
        const e = 1 - Math.pow(1 - t, 3);
        visual = spinAnim.from + (spinForFront(pinned, 0) - spinAnim.from) * e;
        if (t >= 1) spinAnim = null;
      }
      // visual is the vel=0 spin. Shader still subtracts VEL_YAW*vel, so add it back.
      const want = visual + VEL_YAW * vel;
      uTime = (want - vel) / SPIN_RATE;
    } else if (inView && !motion.matches) {
      uTime += 0.009 * dt + 15 * smoothedDelta;
    }

    const vel = motion.matches ? 0 : smoothedDelta;
    shared.uTime.value = uTime;
    shared.uVelocity.value = vel;
    shared.uScroll.value = progress;

    // Same yaw the shader uses, so the highlighted row is the card facing the camera.
    const spin = uTime * SPIN_RATE + vel;
    let best = 0;
    let bestFacing = -Infinity;
    const facings = new Array(meshes.length);
    for (let i = 0; i < meshes.length; i++) {
      const facing = cardFacing(i, spin, vel);
      facings[i] = facing;
      if (facing > bestFacing) {
        bestFacing = facing;
        best = i;
      }
    }
    const hero = pinned >= 0 ? pinned : best;
    for (let i = 0; i < meshes.length; i++) {
      const facing = facings[i];
      const isHero = i === hero;
      // Stronger dim on non-hero so the visual front reads clearly.
      meshes[i].uniforms.uFocus.value = isHero ? 1 : Math.max(0.12, facing * 0.45 + 0.02);
      if (isHero) meshes[i].uniforms.uWash.value = 0;
      else if (meshes[i].isPaper || meshes[i].coverScore < -20) meshes[i].uniforms.uWash.value = 1;
      else meshes[i].uniforms.uWash.value = 0;
    }

    // List stays put during approach/zoom; only ring uses progress. After 落幅,
    // selection (not page scroll) moves the catalog via ensureRowVisible.
    if (listEl) listEl.style.transform = 'translateY(0px)';
    if (listWindow && progress < LIST_LOCK) listWindow.scrollTop = 0;
    root.dataset.progress = progress.toFixed(3);
    root.classList.toggle('is-end', progress > LIST_LOCK);
    setFront(pinned >= 0 ? pinned : best);

    renderer.render({ scene, camera, frustumCull: false });
    requestAnimationFrame(frame);
  }

  const watch = new IntersectionObserver(
    (entries) => {
      inView = entries.some((entry) => entry.isIntersecting);
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
  function phaseScreenNX(phase, progress) {
    const R = 3;
    let x = R * Math.cos(phase);
    let y = 0;
    let z = R * Math.sin(phase);
    const pitch = -Math.PI * 0.15 * (1 - progress);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const y2 = y * cp - z * sp;
    const z2 = y * sp + z * cp;
    x -= 3.7 * progress + 1.4;
    y = y2 - 0.85 * progress;
    z = z2 - (20 - 12 * progress);
    const viewZ = z - camera.position.z;
    const depth = Math.max(0.35, -viewZ);
    const fovRad = (camera.fov * Math.PI) / 180;
    const halfW = Math.tan(fovRad / 2) * depth * (camera.aspect || 1);
    const ndcX = x / Math.max(1e-4, halfW);
    return ndcX * 0.5 + 0.5;
  }

  function cardScreenNX(index, spin, progress) {
    const theta = (index / N) * Math.PI * 2;
    // Transposed Y rotation sends the ring angle to θ+spin (not θ−spin).
    return phaseScreenNX(theta + spin, progress);
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
      const cards = [];
      for (let i = 0; i < meshes.length; i++) {
        const facing = cardFacing(i, spin, vel);
        const sx = cardScreenNX(i, spin, progress);
        if (facing > bestFacing) {
          bestFacing = facing;
          best = i;
        }
        cards.push({
          i,
          title: (pickData[i] && pickData[i].title) || '',
          sx: Math.round(sx * 1000) / 1000,
          facing: Math.round(facing * 1000) / 1000,
          dHero: Math.round(Math.abs(sx - hnx) * 1000) / 1000,
        });
      }
      cards.sort((a, b) => b.facing - a.facing || a.dHero - b.dHero);
      return {
        front,
        pinned,
        progress,
        vel,
        uTime,
        eye: Math.round(wrapPi(eyeYaw(front, spin, vel)) * 1000) / 1000,
        heroNX: Math.round(hnx * 1000) / 1000,
        spin,
        best,
        bestFacing: Math.round(bestFacing * 1000) / 1000,
        bestTitle: (pickData[best] && pickData[best].title) || '',
        frontTitle: (pickData[front] && pickData[front].title) || '',
        top: cards.slice(0, 4),
        n: meshes.length,
      };
    },
  };

  syncRunway();
  resize();
  window.addEventListener('resize', () => {
    syncRunway();
    resize();
  });
  requestAnimationFrame(frame);
}
