/**
 * 右下 Mimi 的 Rive 状态机。
 *
 * TODO(智能体搭建): 正式动画放到 public/mimi/mimi.riv，换文件即可，不用改页面。
 * 没有这个文件、文件打不开、或里面没有状态机时，头像停在 /mimi/avatar.png。
 *
 * 文件约定（名字区分大小写）：
 * - 用默认画板。
 * - 状态机名优先 Mimi，否则用文件里的第一个状态机。
 * - 输入 hover：Boolean。悬停 true，离开 false。微偏头。
 * - 输入 open：Boolean。面板打开 true。
 * - 输入 attention：Trigger。进站约 1.5s，或作品区滚进画面时 fire 一次。瞥一眼后回到 idle。
 * - 默认状态 idle：极慢呼吸、眨眼。三个输入都空着时停在这里。
 * 若文件用数据绑定而不是状态机输入，同名的 boolean / trigger 也会被写入。
 * prefers-reduced-motion：不创建运行时，停在静态头像的一帧。
 */

export const MIMI_RIVE_SRC = '/mimi/mimi.riv';
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
        autoplay: false,
        autoBind: true,
        shouldDisableRiveListeners: true,
        layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }),
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
              setHover(value) { writeBool(inputs, viewModel(rive), StateMachineInputType, 'hover', value); },
              setOpen(value) { writeBool(inputs, viewModel(rive), StateMachineInputType, 'open', value); },
              attention() { writeTrigger(inputs, viewModel(rive), StateMachineInputType, 'attention'); },
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
