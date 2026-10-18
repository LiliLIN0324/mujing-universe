import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'ogl';

const VERT = /* glsl */ `
precision highp float;
attribute vec2 uv;
attribute vec3 position;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float uAngle;
uniform vec2 uScale;
uniform float uTime;
uniform float uVelocity;
uniform float uRadius;
uniform float uPitch;
uniform float uOpen;
uniform float uClose;
uniform float uZFar;
uniform float uZNear;
uniform float uShiftX;
uniform float uShiftY;
uniform float uPop;
uniform float uFront;
uniform vec2 uIdle;
varying vec2 vUv;

mat4 rotationMatrix(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  return mat4(
    oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
    0.0, 0.0, 0.0, 1.0
  );
}

vec3 rotate(vec3 v, vec3 axis, float angle) {
  return (rotationMatrix(axis, angle) * vec4(v, 1.0)).xyz;
}

mat4 combinedMatrix(vec3 pos, float rotationAngle, vec3 scale) {
  mat4 rotationMat = rotationMatrix(vec3(0.0, 1.0, 0.0), rotationAngle);
  mat4 scaleMat = mat4(1.0);
  scaleMat[0].x = scale.x;
  scaleMat[1].y = scale.y;
  scaleMat[2].z = scale.z;
  mat4 translationMat = mat4(1.0);
  translationMat[3].xyz = pos;
  return translationMat * rotationMat * scaleMat;
}

void main() {
  const float PI = 3.141592653589793;
  float theta = uAngle * PI * 2.0;
  float spin = (uTime * 0.12 + uVelocity) * (1.0 - uClose);
  float delta = atan(sin(theta - uFront), cos(theta - uFront));
  float ad = abs(delta);
  float front = 1.0 - smoothstep(0.04, 0.32, ad);
  float thetaUse = mix(theta, uFront, uClose * 0.8 * (1.0 - front));
  float radius = uRadius * (1.0 + 0.32 * uOpen) * (1.0 - 0.45 * uClose);
  float grow = mix(1.0, uPop, front * uClose);
  float fold = 1.0 - uClose * (1.0 - front) * 0.92;
  vec2 scl = vec2(uScale.x * grow * fold, uScale.y * grow);
  float yaw = thetaUse - PI * 0.22 - position.x * 0.62 - uVelocity * 6.0;
  yaw += uClose * (1.0 - front) * sign(delta + 1e-4) * 1.2;
  float bow = position.x * position.x * 0.95;
  vec3 p = vec3(position.x * scl.x, position.y * scl.y, bow * scl.x);
  p = rotate(p, vec3(0.0, 1.0, 0.0), yaw);
  p += vec3(cos(thetaUse) * radius, 0.0, sin(thetaUse) * radius);
  p = rotate(p, vec3(0.0, 1.0, 0.0), spin);
  float tilt = -uPitch * (1.0 - 0.22 * uClose);
  p = rotate(p, vec3(1.0, 0.0, 0.0), tilt);
  p.x -= uIdle.x + uShiftX * front * uClose;
  p.y -= uIdle.y + uShiftY * front * uClose;
  p.z -= mix(uZFar, uZNear, front * uClose) + uClose * (1.0 - front) * 1.6;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vUv = uv;
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform vec2 uPlane;
uniform vec2 uImage;
uniform float uReady;
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
  gl_FragColor = vec4(color, 1.0);
}
`;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function wrapPi(rad) {
  const t = Math.PI * 2;
  let x = (rad + Math.PI) % t;
  if (x < 0) x += t;
  return x - Math.PI;
}

function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
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
  });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);

  const camera = new Camera(gl, { fov: 56, near: 0.05, far: 40 });
  camera.position.z = 4.5;

  const scene = new Transform();
  const geometry = new Plane(gl, { width: 1, height: 1, widthSegments: 50, heightSegments: 50 });
  const shared = {
    uTime: { value: 0 },
    uVelocity: { value: 0 },
    uRadius: { value: 0.62 },
    uPitch: { value: 0.55 },
    uOpen: { value: 0 },
    uClose: { value: 0 },
    uZFar: { value: 0.05 },
    uZNear: { value: -0.62 },
    uShiftX: { value: 0.95 },
    uShiftY: { value: -0.22 },
    uPop: { value: 2.4 },
    uFront: { value: 0 },
    uIdle: { value: [1.22, 0.52] },
    uScale: { value: [1.6, 0.9] },
  };

  const meshes = images.slice(0, 10).map((img, i) => {
    const texture = new Texture(gl, { generateMipmaps: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    const uniforms = {
      ...shared,
      uAngle: { value: i / 10 },
      uTexture: { value: texture },
      uPlane: { value: [1.6, 0.9] },
      uImage: { value: [1, 1] },
      uReady: { value: 0 },
    };
    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms,
      cullFace: false,
    });
    const mesh = new Mesh(gl, { geometry, program });
    mesh.setParent(scene);
    const local = `/ring/${i}.jpg`;
    const loader = new Image();
    loader.crossOrigin = 'anonymous';
    loader.onload = () => {
      texture.image = loader;
      uniforms.uImage.value = [loader.naturalWidth || 1, loader.naturalHeight || 1];
      uniforms.uReady.value = 1;
    };
    loader.onerror = () => {
      const fallback = new Image();
      fallback.onload = () => {
        texture.image = fallback;
        uniforms.uImage.value = [fallback.naturalWidth || 1, fallback.naturalHeight || 1];
        uniforms.uReady.value = 1;
      };
      fallback.src = '/ring/paper.jpg';
    };
    loader.src = local;
    return { mesh, img };
  });

  let scrollTarget = 0;
  let scrollCurrent = 0;
  let lastProgress = 0;
  let velocity = 0;
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
    root.style.height = `${window.innerHeight + listOverflow()}px`;
  }

  function resize() {
    const host = canvas.parentElement || root;
    const width = host.clientWidth || window.innerWidth;
    const height = host.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    camera.perspective({ aspect: width / Math.max(1, height) });
  }

  function setFront(index) {
    if (index === front) return;
    front = index;
    const work = pickData[index];
    if (introEl && work) introEl.textContent = work.intro;
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
    const follow = motion.matches ? 1 : 0.1;
    scrollCurrent = lerp(scrollCurrent, scrollTarget, follow);
    if (scrollCurrent > -0.4) scrollCurrent = 0;
    let progress = limit > 0 ? Math.abs(scrollCurrent) / limit : 0;
    if (progress > 1) progress = 1;
    const dProgress = progress - lastProgress;
    velocity = lerp(velocity, motion.matches ? 0 : dProgress, 0.1);
    const open = smoothstep(Math.min(1, progress / 0.42));
    const close = smoothstep(Math.max(0, (progress - 0.58) / 0.42));
    if (inView && !motion.matches) uTime += (0.009 * dt + 15 * velocity) * (1 - close);
    shared.uTime.value = uTime;
    shared.uVelocity.value = velocity;
    shared.uOpen.value = open;
    shared.uClose.value = close;
    const spin = motion.matches ? 0 : uTime * 0.12 + velocity;
    let best = 0;
    let bestFacing = -Infinity;
    for (let i = 0; i < meshes.length; i++) {
      const theta = (i / 10) * Math.PI * 2;
      const facing = Math.cos(wrapPi(theta + spin));
      if (facing > bestFacing) {
        bestFacing = facing;
        best = i;
      }
    }
    shared.uFront.value = (best / 10) * Math.PI * 2;
    if (listEl) listEl.style.transform = `translateY(${scrollCurrent}px)`;
    root.dataset.progress = progress.toFixed(3);
    root.classList.toggle('is-end', progress > 0.92);
    setFront(best);
    lastProgress = progress;
    renderer.render({ scene, camera, frustumCull: false });
    requestAnimationFrame(frame);
  }

  const watch = new IntersectionObserver((entries) => {
    inView = entries.some((entry) => entry.isIntersecting);
  }, { threshold: 0.12 });
  watch.observe(root);
  if (motion.matches) root.classList.add('is-reduced');
  syncRunway();
  resize();
  window.addEventListener('resize', () => {
    syncRunway();
    resize();
  });
  requestAnimationFrame(frame);
}
