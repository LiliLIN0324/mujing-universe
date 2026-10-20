import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'ogl';

/**
 * Pick ring — Ferris / demalde About geometry (bv + cabinMatrix).
 * Scroll still eases the ring into its settled pose (uScroll).
 * Rotation is user-only: drag / swipe, wheel on the cards, click, arrow keys.
 * No idle autoplay. Back-half cards are discarded; back faces never draw.
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
varying float vFacing;

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
  float radius = 3.35;
  float angle = uAngle;
  float spin = uTime * 0.12 + uVelocity;
  float theta = angle * PI * 2.0;
  float frontP = PI * 0.5 - PI * 0.2;
  float ang = theta - spin - frontP;
  ang = mod(ang + PI, 2.0 * PI) - PI;
  float facing = cos(ang);
  vFacing = facing;

  vec2 ring = vec2(cos(theta), sin(theta)) * radius;
  // Planar cards. Yaw still turns neighbors around the ring; it does not bow the quad.
  float yaw0 = theta - PI * 0.2;

  // Active card larger; neighbors fall off quickly so the fan reads as one hero.
  float focusScale = mix(0.42, 1.16, pow(max(facing, 0.0), 2.0));
  float grow = (1.0 + 0.38 * uScroll * uScroll) * focusScale;
  vec4 p = cabinMatrix(vec3(ring.x, 0.0, ring.y), yaw0, vec3(uScale.x * grow, uScale.y * grow, 1.0)) * vec4(position, 1.0);
  p.xyz = rotate(p.xyz, vec3(0.0, 1.0, 0.0), spin);
  p.xyz = rotate(p.xyz, vec3(1.0, 0.0, 0.0), -PI * 0.15 * (1.0 - uScroll));
  p.z -= 20.0 - 12.0 * uScroll;  // end ≈ z-8 (01:37)
  p.x -= 3.7 * uScroll;          // more left than 01:37's 3.2
  p.y -= 0.85 * uScroll;
  p.x -= 1.4;                    // more left than 01:37's 1.15
  p.y -= 0.42;                   // drop the fan so the left title stays clear
  // Pull the active card toward the camera so it paints above its neighbors.
  p.z += 1.45 * smoothstep(0.45, 1.0, facing);

  gl_Position = projectionMatrix * viewMatrix * p;
  vUv = uv;
}
`;

// Cover-crop UV + soft edge vignette (no separate shadow mesh).
const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying float vFacing;
uniform sampler2D uTexture;
uniform vec2 uPlane;
uniform vec2 uImage;
uniform float uReady;
uniform float uFocus;
uniform float uWash;
uniform float uScroll;
void main() {
  // WebGL equivalent of backface-visibility: hidden — never show mirrored type.
  if (!gl_FrontFacing) discard;
  // Front ~5 cards stay solid; the next pair fades into the page; the back half is gone.
  float fade = smoothstep(-0.46, 0.22, vFacing);
  if (fade < 0.04) discard;

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
  color = mix(vec3(0.965, 0.961, 0.953), color, fade);

  gl_FragColor = vec4(color, 1.0);
}
`;

const SCROLL_LERP = 0.1;
const DELTA_LERP = 0.1;
/** Ring end pose (落幅); list stays still until progress reaches this. */
const LIST_LOCK = 0.92;
/** Idle/mid readable size: ~46% frustum width, 16:9. Hero scale is applied in the shader. */
const CARD_FRAC_W = 0.46;
const RING_R = 3.35;
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
  let inView = true;
  let front = -1;

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
  let spin = 0;
  let spinAnim = null; // { from, to, start, dur }
  let snapTimer = 0;
  let suppressClick = false;
  let hot = false;

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
    root.dataset.front = String(index);
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
   * Visual front ring phase — matches VERT cabin yaw offset (−PI*0.2).
   * Eye / best / setFront / spinTargetFor all park θ_i here.
   */
  function frontPhase() {
    return Math.PI / 2 - Math.PI * 0.2;
  }

  /** Face-on score: cos(θ − spin − frontPhase). Higher = more cabin-facing the eye. */
  function cardFacing(index, spin) {
    const theta = (index / N) * Math.PI * 2;
    return Math.cos(wrapPi(theta - spin - frontPhase()));
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
      const facing = cardFacing(i, sp);
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

  /** Shortest spin that puts card index at frontPhase (yaw-aware eye front). */
  function spinTargetFor(index, spinNow) {
    const theta = (index / N) * Math.PI * 2;
    const want = theta - frontPhase();
    return spinNow + wrapPi(want - spinNow);
  }

  function liveSpin() {
    return spin;
  }

  function clearSnap() {
    if (!snapTimer) return;
    clearTimeout(snapTimer);
    snapTimer = 0;
  }

  function bestIndex(spinNow) {
    const s = spinNow == null ? spin : spinNow;
    let best = 0;
    let bestFacing = -Infinity;
    for (let i = 0; i < meshes.length; i++) {
      const facing = cardFacing(i, s);
      if (facing > bestFacing) {
        bestFacing = facing;
        best = i;
      }
    }
    return best;
  }

  /** Select item: sync left copy + list; rotate ring so card faces front. No navigate. */
  function select(index, opts) {
    if (!Number.isFinite(index) || index < 0 || index >= pickData.length) return;
    // Ring only has N meshes — never pin past the last card (avoids θ alias desync).
    const i = Math.min(index, meshes.length - 1);
    clearSnap();
    pinned = i;
    pinScroll = scrollTarget;
    const now = spin;
    const to = spinTargetFor(i, now);
    const dur = motion.matches ? 0 : 480;
    if (!dur || Math.abs(to - now) < 1e-3) {
      spin = to;
      spinAnim = null;
    } else {
      spinAnim = { from: now, to, start: performance.now(), dur };
    }
    setFront(i, { scrollList: true });
    if (opts && opts.focus) {
      const btn = rowBtns[i];
      if (btn) btn.focus({ preventScroll: true });
    }
  }

  /** Nudge the ring, then settle the nearest card upright once the gesture ends. */
  function spinBy(delta) {
    if (!delta) return;
    pinned = -1;
    spinAnim = null;
    spin += delta;
    clearSnap();
    snapTimer = setTimeout(() => {
      snapTimer = 0;
      select(bestIndex(spin));
    }, motion.matches ? 0 : 160);
  }

  function frame(now) {
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
    if (pinned >= 0 && Math.abs(scrollTarget - pinScroll) > unpinSlop) pinned = -1;

    // User gesture or a short settle tween. Never an idle spin.
    if (spinAnim) {
      const dur = motion.matches ? 0 : spinAnim.dur;
      const t = !dur ? 1 : Math.min(1, (now - spinAnim.start) / dur);
      const e = !dur ? 1 : 1 - Math.pow(1 - t, 3);
      spin = spinAnim.from + (spinAnim.to - spinAnim.from) * e;
      if (t >= 1) {
        spin = spinAnim.to;
        spinAnim = null;
      }
    }

    shared.uTime.value = spin / 0.12;
    shared.uVelocity.value = 0;
    shared.uScroll.value = progress;

    // Yaw-aware eye-hero: argmax cardFacing (cabin −PI*0.2), not heroNX proximity.
    let best = 0;
    let bestFacing = -Infinity;
    const facings = new Array(meshes.length);
    for (let i = 0; i < meshes.length; i++) {
      const facing = cardFacing(i, spin);
      facings[i] = facing;
      if (facing > bestFacing) {
        bestFacing = facing;
        best = i;
      }
      // Back half stays out of the draw list; the shader fades the wings.
      meshes[i].mesh.visible = facing > -0.55;
      meshes[i].mesh.renderOrder = Math.round((facing + 1) * 50);
    }
    const hero = pinned >= 0 ? pinned : best;
    for (let i = 0; i < meshes.length; i++) {
      const facing = facings[i];
      const isHero = i === hero;
      const t = Math.max(0, facing);
      meshes[i].uniforms.uFocus.value = isHero ? 1 : Math.max(0.42, 0.2 + t * 0.55);
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
    const R = RING_R;
    let x = R * Math.cos(phase);
    let y = 0;
    let z = R * Math.sin(phase);
    const pitch = -Math.PI * 0.15 * (1 - progress);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const y2 = y * cp - z * sp;
    const z2 = y * sp + z * cp;
    x -= 3.7 * progress + 1.4;
    y = y2 - 0.85 * progress - 0.42;
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
    return phaseScreenNX(theta - spin, progress);
  }

  /** Map click on canvas to the visible card under the cursor (hit-test only). */
  function pickIndexAtClientX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const nx = (clientX - rect.left) / Math.max(1, rect.width);
    return pickIndexAtNX(nx);
  }
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    suppressClick = false;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, spin, moved: false, axis: '' };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.axis) {
      if (Math.hypot(dx, dy) < 6) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.axis === 'y') { drag = null; return; }
      clearSnap();
      pinned = -1;
      spinAnim = null;
      drag.spin = spin;
      drag.x = e.clientX;
      drag.moved = true;
      canvas.classList.add('is-drag');
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* already released */ }
      return;
    }
    spin = drag.spin - (e.clientX - drag.x) * 0.0034;
    drag.moved = true;
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moved && drag.axis === 'x';
    drag = null;
    canvas.classList.remove('is-drag');
    if (!moved) return;
    suppressClick = true;
    select(bestIndex(spin));
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    canvas.classList.remove('is-drag');
    select(bestIndex(spin));
  });
  canvas.addEventListener('pointerenter', () => { hot = true; });
  canvas.addEventListener('pointerleave', () => { hot = false; });
  canvas.addEventListener('wheel', (e) => {
    if (e.ctrlKey) return;
    const rect = canvas.getBoundingClientRect();
    const y = (e.clientY - rect.top) / Math.max(1, rect.height);
    const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;
    // Middle band turns the ring once it has settled. Before that, vertical
    // wheel keeps scrolling the page through the entrance. Top and bottom always scroll.
    const onCards = y > 0.26 && y < 0.9;
    if (!horizontal && !(onCards && lastProgress >= LIST_LOCK)) return;
    e.preventDefault();
    let delta = horizontal
      ? ((e.shiftKey && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) ? e.deltaY : (e.deltaX || e.deltaY))
      : e.deltaY;
    if (e.deltaMode === 1) delta *= 16;
    else if (e.deltaMode === 2) delta *= 120;
    spinBy(delta * 0.0042);
  }, { passive: false });
  canvas.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; return; }
    select(pickIndexAtClientX(e.clientX));
  });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    const onRow = !!(ae && ae.classList && ae.classList.contains('pick-row-btn') && root.contains(ae));
    if (!onRow && !hot) return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const current = front < 0 ? 0 : front;
    select((current + dir + meshes.length) % meshes.length, { focus: onRow });
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
      const fp = frontPhase();
      const hnx = heroNX(progress);
      let best = 0;
      let bestFacing = -Infinity;
      const cards = [];
      for (let i = 0; i < meshes.length; i++) {
        const facing = cardFacing(i, spin);
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
        frontPhase: fp,
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

  spin = spinTargetFor(0, 0);
  setFront(0);
  syncRunway();
  resize();
  window.addEventListener('resize', () => {
    syncRunway();
    resize();
  });
  requestAnimationFrame(frame);
}
