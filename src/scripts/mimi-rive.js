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
            canvas.hidden = false;
            face?.classList.add('is-rive');
            rive.resizeDrawingSurfaceToCanvas();
            requestAnimationFrame(() => {
              try { rive.resizeDrawingSurfaceToCanvas(); } catch { /* 已卸下 */ }
            });
            finish({
              setHover(value) { writeBool(inputs, viewModel(rive), StateMachineInputType, 'isHover', value); },
              setOpen(value) { writeBool(inputs, viewModel(rive), StateMachineInputType, 'isOpen', value); },
              attention() { writeTrigger(inputs, viewModel(rive), StateMachineInputType, 'nudge'); },
              resize() {
                try { rive.resizeDrawingSurfaceToCanvas(); } catch { /* 已卸下 */ }
              },
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
