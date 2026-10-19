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
  p.y -= 1.55 * uScroll;
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

  // Soft AO kept; only kill wash/empty boards (no uFocus single-card lock)
  float washKill = 1.0 - uWash * smoothstep(0.25, 0.65, uScroll);
  if (washKill < 0.2) discard;
  color = mix(vec3(0.945, 0.945, 0.941), color, clamp(washKill, 0.0, 1.0));

  gl_FragColor = vec4(color, 1.0);
}
`;

const SCROLL_LERP = 0.1;
const DELTA_LERP = 0.1;
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
        // beige / paper / flat white-gray boards
        if (std < 18 && mean > 195) score = -100;
        if (std < 35 && mean > 235) score = -80;
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

  function setFront(index) {
    if (index === front) return;
    front = index;
    const work = pickData[index];
    fillCopy(work);
    syncList(index);
  }

  /**
   * Shortest spin that puts card index at the VISUAL front slot.
   * Shader: z′ ∝ sin(θ − s) after rotateY; raw max-z is θ−s = π/2.
   * After X-tilt + perspective the eye-hero card sits ~one slot earlier
   * (phase π/2 − 2π/N). Empirically soff=+1 card: AnyReal→橙狗, Dragon→黑板;
   * raw π/2 left AnyReal on dark / Dragon on orange (prod FAIL class).
   */
  function spinTargetFor(index, spinNow) {
    const theta = (index / N) * Math.PI * 2;
    const frontPhase = Math.PI / 2 - (Math.PI * 2) / N;
    const want = theta - frontPhase;
    return spinNow + wrapPi(want - spinNow);
  }

  function liveSpin() {
    return (motion.matches ? 0 : uTime * 0.12) + (motion.matches ? 0 : smoothedDelta);
  }

  /** Select item: sync left copy + list; rotate ring so card faces front. No navigate. */
  function select(index) {
    if (!Number.isFinite(index) || index < 0 || index >= pickData.length) return;
    // Ring only has N meshes — never pin past the last card (avoids θ alias desync).
    const i = Math.min(index, meshes.length - 1);
    pinned = i;
    pinScroll = scrollTarget;
    if (!motion.matches && i >= 0) {
      const now = liveSpin();
      const to = spinTargetFor(i, now);
      spinAnim = { from: now, to, start: performance.now() };
    }
    setFront(i);
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

    // Scroll after a selection releases the pin so idle facing can continue.
    if (pinned >= 0 && Math.abs(scrollTarget - pinScroll) > 1) {
      pinned = -1;
      spinAnim = null;
    }

    if (spinAnim && !motion.matches) {
      const t = Math.min(1, (now - spinAnim.start) / 450);
      const e = 1 - Math.pow(1 - t, 3);
      const spinWant = spinAnim.from + (spinAnim.to - spinAnim.from) * e;
      // Hold velocity near 0 while tweening; map desired spin onto uTime.
      smoothedDelta = lerp(smoothedDelta, 0, 0.35);
      uTime = (spinWant - smoothedDelta) / 0.12;
      if (t >= 1) spinAnim = null;
    } else if (pinned >= 0 && !motion.matches) {
      // Hard hold: keep selected card geometrically front; idle must not drift away.
      smoothedDelta = lerp(smoothedDelta, 0, 0.4);
      const want = spinTargetFor(pinned, liveSpin());
      uTime = (want - smoothedDelta) / 0.12;
    } else if (inView && !motion.matches) {
      uTime += 0.009 * dt + 15 * smoothedDelta;
    }

    shared.uTime.value = motion.matches ? 0 : uTime;
    shared.uVelocity.value = motion.matches ? 0 : smoothedDelta;
    shared.uScroll.value = progress;

    // Visual front ≈ phase π/2 − 2π/N (not raw max-z). Score cos(Δphase).
    const spin = motion.matches ? 0 : uTime * 0.12 + smoothedDelta;
    const frontPhase = Math.PI / 2 - (Math.PI * 2) / N;
    let best = 0;
    let bestFacing = -Infinity;
    for (let i = 0; i < meshes.length; i++) {
      const theta = (i / N) * Math.PI * 2;
      const facing = Math.cos(wrapPi(theta - spin - frontPhase));
      if (facing > bestFacing) {
        bestFacing = facing;
        best = i;
      }
      meshes[i].uniforms.uFocus.value = 1; // render all; wash handled in frag
    }

    if (listEl) listEl.style.transform = `translateY(${scrollCurrent}px)`;
    root.dataset.progress = progress.toFixed(3);
    root.classList.toggle('is-end', progress > 0.92);
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
  /** Map click X on canvas to nearest visible ring card (approx screen phase). */
  function pickIndexAtClientX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const nx = (clientX - rect.left) / Math.max(1, rect.width);
    const spin = liveSpin();
    let best = front >= 0 ? front : 0;
    let bestScore = Infinity;
    for (let i = 0; i < meshes.length; i++) {
      const theta = (i / N) * Math.PI * 2;
      const phase = wrapPi(theta - spin);
      const frontPhase = Math.PI / 2 - (Math.PI * 2) / N;
      const facing = Math.cos(wrapPi(phase - frontPhase));
      if (facing < -0.15) continue; // back of ring
      const approxX = 0.52 + Math.cos(phase) * 0.38;
      const score = Math.abs(approxX - nx) - facing * 0.12;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }
  canvas.addEventListener('click', (e) => {
    select(pickIndexAtClientX(e.clientX));
  });
  rowBtns.forEach((btn) => {
    btn.addEventListener('click', () => select(Number(btn.dataset.i)));
  });
  listWindow?.addEventListener('scroll', () => { listWindow.scrollTop = 0; });

  root.__pickRing = {
    select,
    state: () => ({ front, pinned, progress: shared.uScroll.value, n: meshes.length }),
  };

  syncRunway();
  resize();
  window.addEventListener('resize', () => {
    syncRunway();
    resize();
  });
  requestAnimationFrame(frame);
}
