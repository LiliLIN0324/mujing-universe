/**
 * 右下 Mimi 的 Rive 状态机。文件是 public/mimi/mimi.riv。
 * 打不开或没有状态机时，头像停在 /mimi/avatar.png。
 *
 * 这份文件（名字区分大小写）：
 * - 画板 Mimi，状态机 Mimi
 * - isHover：Boolean。悬停 true，离开 false
 * - isOpen：Boolean。面板打开 true，关上必须写回 false
 * - nudge：Trigger。进站约 1.5s，或作品区滚进画面时 fire 一次
 * - 状态：idle（极慢呼吸、眨眼）/ attention / hover / open
 * prefers-reduced-motion：不创建运行时，停在静态头像的一帧。
 */

export const MIMI_RIVE_SRC = '/mimi/mimi.riv';
export const MIMI_ARTBOARD = 'Mimi';
export const MIMI_STATE_MACHINE = 'Mimi';

export function mimiMotion({ open = false, hover = false, attention = false } = {}) {
  if (open) return 'open';
  if (hover) return 'hover';
  if (attention) return 'attention';
  return 'idle';
}

function viewModel(rive) {
  try {
    return rive.viewModelInstance || null;
  } catch {
    return null;
  }
}

function writeBool(inputs, vm, type, name, value) {
  const input = inputs.get(name);
  if (input && input.type !== type.Trigger) {
    try { input.value = !!value; } catch { /* 运行时已卸下 */ }
  }
  if (!vm) return;
  try {
    const prop = vm.boolean(name);
    if (prop) prop.value = !!value;
  } catch { /* 文件没有这个绑定 */ }
}

const DISC_ORANGE = [255, 105, 10];

function orangePixel(r, g, b, a) {
  return a > 140 && r > 170 && r > g + 40 && r > b + 60 && g < 200;
}

function solveCircle(pts) {
  const A = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const b = [0, 0, 0];
  for (let i = 0; i < pts.length; i += 1) {
    const x = pts[i][0];
    const y = pts[i][1];
    const z = x * x + y * y;
    const row = [x, y, 1];
    for (let r = 0; r < 3; r += 1) {
      b[r] -= row[r] * z;
      for (let c = 0; c < 3; c += 1) A[r * 3 + c] += row[r] * row[c];
    }
  }
  const M = [
    [A[0], A[1], A[2], b[0]],
    [A[3], A[4], A[5], b[1]],
    [A[6], A[7], A[8], b[2]],
  ];
  for (let col = 0; col < 3; col += 1) {
    let piv = col;
    for (let r = col + 1; r < 3; r += 1) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    const swap = M[col];
    M[col] = M[piv];
    M[piv] = swap;
    const div = M[col][col];
    if (Math.abs(div) < 1e-6) return null;
    for (let c = col; c < 4; c += 1) M[col][c] /= div;
    for (let r = 0; r < 3; r += 1) {
      if (r === col) continue;
      const f = M[r][col];
      for (let c = col; c < 4; c += 1) M[r][c] -= f * M[col][c];
    }
  }
  const cx = -M[0][3] / 2;
  const cy = -M[1][3] / 2;
  const rad = Math.sqrt(Math.max(0, cx * cx + cy * cy - M[2][3]));
  if (!Number.isFinite(rad) || rad < 4) return null;
  return { cx, cy, r: rad };
}

function fitOrangeDisc(data, w, h) {
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (!orangePixel(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
    const p = i >> 2;
    const x = p % w;
    const y = (p / w) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    count += 1;
  }
  if (count < 40) return null;
  const cx0 = (minX + maxX) / 2;
  const cy0 = (minY + maxY) / 2;
  const pts = [];
  const maxT = Math.hypot(w, h);
  for (let deg = 0; deg < 360; deg += 3) {
    const a = (deg * Math.PI) / 180;
    const co = Math.cos(a);
    const si = Math.sin(a);
    let last = null;
    for (let t = 2; t < maxT; t += 1) {
      const x = (cx0 + co * t) | 0;
      const y = (cy0 + si * t) | 0;
      if (x < 0 || y < 0 || x >= w || y >= h) break;
      const i = (y * w + x) * 4;
      if (orangePixel(data[i], data[i + 1], data[i + 2], data[i + 3])) last = [x + 0.5, y + 0.5, t];
    }
    if (last) pts.push(last);
  }
  if (pts.length < 12) return null;
  const radii = pts.map((p) => p[2]).sort((a, b) => a - b);
  const medR = radii[radii.length >> 1];
  const band = pts.filter((p) => Math.abs(p[2] - medR) < 12);
  const seed = band.length >= 12 ? band : pts;
  let fit = solveCircle(seed);
  if (!fit) return null;
  const kept = seed.filter((p) => Math.abs(Math.hypot(p[0] - fit.cx, p[1] - fit.cy) - fit.r) < 2.5);
  if (kept.length >= 12) {
    const next = solveCircle(kept);
    if (next) fit = next;
  }
  let err = 0;
  const sample = kept.length >= 12 ? kept : seed;
  for (let i = 0; i < sample.length; i += 1) {
    err += Math.abs(Math.hypot(sample[i][0] - fit.cx, sample[i][1] - fit.cy) - fit.r);
  }
  fit.med = err / sample.length;
  fit.kept = sample.length;
  return fit;
}

function discAlreadyClean(data, w, h, cx, cy, R) {
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (dist > R + 1.6 && a > 20) return false;
      if (dist < R - 2.2 && a < 16) return false;
    }
  }
  return true;
}

/* mimi.riv 在橙色正圆外面还画了一块不透明白底，悬停和打开时圆还会移动。
   画布命令要等这一帧的绘制回放完才落上像素，所以在下一帧回放之后再改。
   只清圆外的白底，并补上圆里没画到的橙。不缩放、不裁切容器。 */
function trimDisc(canvas, memory) {
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let img;
  try {
    img = ctx.getImageData(0, 0, w, h);
  } catch {
    return;
  }
  const data = img.data;
  const fit = fitOrangeDisc(data, w, h);
  const usable = fit && fit.kept >= 24 && fit.med < 2.2 ? fit : memory.last;
  if (!usable) return;
  if (fit && fit.kept >= 24 && fit.med < 2.2) memory.last = fit;
  const cx = usable.cx;
  const cy = usable.cy;
  const R = usable.r;
  if (discAlreadyClean(data, w, h, cx, cy, R)) return;
  const or = DISC_ORANGE[0];
  const og = DISC_ORANGE[1];
  const ob = DISC_ORANGE[2];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (dist > R + 1.15) {
        data[i + 3] = 0;
      } else if (a < 16 && dist < R - 0.4) {
        data[i] = or;
        data[i + 1] = og;
        data[i + 2] = ob;
        data[i + 3] = 255;
      } else if (a < 16) {
        const cov = (R + 1.15 - dist) / 1.55;
        data[i] = or;
        data[i + 1] = og;
        data[i + 2] = ob;
        data[i + 3] = Math.max(0, Math.min(255, (cov * 255) | 0));
      } else if (dist > R + 0.35) {
        const mn = Math.min(r, g, b);
        const mx = Math.max(r, g, b);
        const nearWhite = mn > 200 && mx - mn < 30;
        if (nearWhite || !orangePixel(r, g, b, a)) data[i + 3] = 0;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function writeTrigger(inputs, vm, type, name) {
  const input = inputs.get(name);
  if (input?.type === type.Trigger) input.fire();
  else if (input) {
    input.value = true;
    window.setTimeout(() => {
      try { input.value = false; } catch { /* 运行时已卸下 */ }
    }, 800);
  }
  if (!vm) return;
  try {
    const trig = vm.trigger(name);
    if (trig) {
      trig.trigger();
      return;
    }
  } catch { /* 没有同名 trigger */ }
  try {
    const prop = vm.boolean(name);
    if (!prop) return;
    prop.value = true;
    window.setTimeout(() => {
      try { prop.value = false; } catch { /* 运行时已卸下 */ }
    }, 800);
  } catch { /* 没有同名 boolean */ }
}

export async function mountMimiRive(canvas, reduce) {
  if (reduce || !canvas) return null;
  let buffer;
  try {
    const res = await fetch(MIMI_RIVE_SRC);
    if (!res.ok) return null;
    const kind = res.headers.get('content-type') || '';
    if (kind.includes('text/html')) return null;
    buffer = await res.arrayBuffer();
  } catch {
    return null;
  }
  if (!buffer || buffer.byteLength < 8) return null;

  let Rive;
  let Layout;
  let Fit;
  let Alignment;
  let StateMachineInputType;
  let RuntimeLoader;
  let wasmUrl;
  try {
    const runtime = await import('@rive-app/canvas');
    const wasm = await import('@rive-app/canvas/rive.wasm?url');
    Rive = runtime.Rive;
    Layout = runtime.Layout;
    Fit = runtime.Fit;
    Alignment = runtime.Alignment;
    StateMachineInputType = runtime.StateMachineInputType;
    RuntimeLoader = runtime.RuntimeLoader;
    wasmUrl = wasm.default;
  } catch {
    return null;
  }
  RuntimeLoader.setWasmUrl(wasmUrl);
  RuntimeLoader.setWasmFallbackUrl(null);
  Rive.suppressDeprecationWarnings = ['state-machine-inputs'];

  const face = canvas.closest('.mimi-face');
  return new Promise((resolve) => {
    let settled = false;
    let rive = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(giveUp);
      resolve(value);
    };
    const fail = () => {
      if (settled) return;
      try { rive?.cleanup(); } catch { /* 尚未建好 */ }
      canvas.hidden = true;
      face?.classList.remove('is-rive');
      finish(null);
    };
    const giveUp = window.setTimeout(fail, 20000);
    try {
      rive = new Rive({
        buffer,
        canvas,
        artboard: MIMI_ARTBOARD,
        stateMachine: MIMI_STATE_MACHINE,
        autoplay: true,
        shouldDisableRiveListeners: true,
        layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
        onLoadError: fail,
        onLoad: () => {
          try {
            const names = rive.stateMachineNames || [];
            const sm = names.includes(MIMI_STATE_MACHINE) ? MIMI_STATE_MACHINE : names[0];
            if (!sm) {
              fail();
              return;
            }
            rive.play(sm);
            const inputs = new Map((rive.stateMachineInputs(sm) || []).map((input) => [input.name, input]));
            const memory = { last: null };
            const draw = rive.draw.bind(rive);
            // 绘制命令要等本帧回放完才写上画布，所以清白底放在下一次绘制回放之后。
            rive._boundDraw = (time) => {
              draw(time);
              requestAnimationFrame(() => trimDisc(canvas, memory));
            };
            canvas.hidden = false;
            face?.classList.add('is-rive');
            // 注意和打开时橙圆会顶出画布。把画板装进留白后的区域，裁掉的圆顶才补得回来。
            const layoutFor = () => {
              const w = canvas.width;
              const h = canvas.height;
              const m = Math.round(Math.min(w, h) * 0.09);
              return new Layout({
                fit: Fit.Contain,
                alignment: Alignment.Center,
                minX: m,
                minY: m,
                maxX: Math.max(m + 1, w - m),
                maxY: Math.max(m + 1, h - m),
              });
            };
            const refit = () => {
              try {
                rive.resizeDrawingSurfaceToCanvas();
                rive.stopRendering();
                rive.layout = layoutFor();
                rive.startRendering();
              } catch { /* 已卸下 */ }
              trimDisc(canvas, memory);
            };
            refit();
            requestAnimationFrame(() => {
              const box = canvas.getBoundingClientRect();
              const dpr = window.devicePixelRatio || 1;
              const wantW = Math.round(box.width * dpr);
              const wantH = Math.round(box.height * dpr);
              if (wantW && wantH && (canvas.width !== wantW || canvas.height !== wantH)) refit();
            });
            finish({
              setHover(value) { writeBool(inputs, viewModel(rive), StateMachineInputType, 'isHover', value); },
              setOpen(value) { writeBool(inputs, viewModel(rive), StateMachineInputType, 'isOpen', value); },
              attention() { writeTrigger(inputs, viewModel(rive), StateMachineInputType, 'nudge'); },
              resize() { refit(); },
              cleanup() {
                try { rive.cleanup(); } catch { /* 已卸下 */ }
                canvas.hidden = true;
                face?.classList.remove('is-rive');
              },
            });
          } catch {
            fail();
          }
        },
      });
    } catch {
      fail();
    }
  });
}
