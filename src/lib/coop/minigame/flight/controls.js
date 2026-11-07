/*!
 * flight/controls.js — 输入：移动与瞄准分离（抄 Radius Raid，research §1.1）
 *
 * 核心口径：**移动与瞄准是两个独立通道**。
 *   移动通道 —— ←→ / AD 只转向，↑ / W 只加速（键盘、触屏拖动都能给移动）
 *   瞄准通道 —— 鼠标位置决定羽毛往哪儿飞；空格则沿当前机头方向发射（纯键盘也能玩）
 *
 * 键位写成数据表（抄 Cosmic Assault 的做法，research §1.1）：
 *   键 → 动作。AD 与方向键并存，照顾键盘 ghosting（双键同按时丢键）的机器。
 *
 * 接管方式：进入游戏时接管键盘，Esc 退出后还原 —— 不抢引擎自己的键盘响应，
 * 只在「游戏进行中」对这几个键 preventDefault（免得页面跟着滚动）。
 */

export const KEYMAP = {
  turnLeft: ['ArrowLeft', 'KeyA'],
  turnRight: ['ArrowRight', 'KeyD'],
  thrust: ['ArrowUp', 'KeyW'],
  fire: ['Space'],
  pause: ['Escape'],
  confirm: ['Enter'],
  quit: ['KeyQ'],
};

/* 反查表：code → 动作名 */
const CODE2ACT = (() => {
  const m = Object.create(null);
  for (const act of Object.keys(KEYMAP)) {
    for (const code of KEYMAP[act]) m[code] = act;
  }
  return m;
})();

/* 这些键在游戏进行时要拦掉默认行为（页面滚动 / 空格滚动） */
const SWALLOW = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * 造一套输入。
 * @param {HTMLCanvasElement} canvas
 * @param {{isActive:() => boolean, size:() => {w:number,h:number}}} opts
 *   isActive 为真时才算「游戏进行中」；size 给画布的逻辑尺寸（用来把鼠标坐标换算进来）
 */
export function createControls(canvas, opts) {
  const isActive = (opts && opts.isActive) || (() => true);
  const size = (opts && opts.size) || (() => ({ w: canvas.clientWidth || 300, h: canvas.clientHeight || 200 }));
  const keys = new Set();

  const st = {
    turn: 0,          // -1 .. 1（键盘）
    thrust: false,    // 油门
    fire: false,      // 边沿：这一帧按了发射
    pause: false,     // 边沿：这一帧按了 Esc
    quit: false,      // 边沿：这一帧按了 Q
    confirm: false,   // 边沿：这一帧按了回车
    aim: null,        // 鼠标位置（画布坐标），null = 还没动过
    dragTurn: 0,      // 触屏拖动给出的转向
    dragThrust: false,// 触屏拖动给出的油门
  };

  /* ---------- 键盘 ---------- */
  function onKeyDown(e) {
    const act = CODE2ACT[e.code];
    if (!act) return;
    if (act === 'pause' || act === 'quit' || act === 'confirm') {
      /* 这三个键任何时候都收（Esc 是这个游戏的退出键） */
      if (e.repeat) return;
      if (act === 'pause') st.pause = true;
      else if (act === 'quit') st.quit = true;
      else st.confirm = true;
      return;
    }
    if (!isActive()) return;
    if (SWALLOW.has(e.code) && e.preventDefault) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (act === 'fire') st.fire = true;
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onBlur() { keys.clear(); }

  /* ---------- 指针（鼠标 / 触屏） ---------- */
  let drag = null;   // { id, x0, y0, x, y, t, moved }

  function toLocal(e) {
    const r = canvas.getBoundingClientRect();
    const dim = size();
    /* rect 含边框，clientWidth 才是画布内容区 —— 差值就是边框，先扣掉再换算 */
    const bw = r.width - (canvas.clientWidth || r.width);
    const bh = r.height - (canvas.clientHeight || r.height);
    const cw = canvas.clientWidth || r.width;
    const ch = canvas.clientHeight || r.height;
    return {
      x: cw ? ((e.clientX - r.left - bw / 2) / cw) * dim.w : 0,
      y: ch ? ((e.clientY - r.top - bh / 2) / ch) * dim.h : 0,
    };
  }

  function onPointerDown(e) {
    if (!isActive()) {
      /* 开局前 / 结算后的点击 = 「开始」。
         开局卡上写着「按空格或点一下开始」，但这里以前直接 return ——
         结果鼠标点不动，只有键盘空格能开局（2026-11-07 接官网时实测撞到）。
         引擎的 step() 在 ready / over 两个状态下都会认 confirm → start()。 */
      st.confirm = true;
      return;
    }
    if (e.pointerType === 'touch') {
      const p = toLocal(e);
      drag = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y, t: performance.now(), moved: false };
      if (e.preventDefault) e.preventDefault();
    } else {
      const p = toLocal(e);
      st.aim = p;
      if (e.button === 0) st.fire = true;
    }
  }
  function onPointerMove(e) {
    if (!isActive()) return;
    const p = toLocal(e);
    if (e.pointerType === 'touch') {
      if (!drag || drag.id !== e.pointerId) return;
      drag.x = p.x; drag.y = p.y;
      if (Math.hypot(drag.x - drag.x0, drag.y - drag.y) > 8) drag.moved = true;
      if (e.preventDefault) e.preventDefault();
    } else {
      st.aim = p;
    }
  }
  function onPointerUp(e) {
    if (e.pointerType !== 'touch') return;
    if (!drag || drag.id !== e.pointerId) return;
    const p = toLocal(e);
    const moved = drag.moved || Math.hypot(p.x - drag.x0, p.y - drag.y) > 12;
    const dur = performance.now() - drag.t;
    /* 触屏：拖动转向 + 点击发射（短按且没拖动 = 点一下发射） */
    if (!moved && dur < 400 && isActive()) st.fire = true;
    drag = null;
  }

  /* ---------- 读这一帧的输入 ---------- */
  function read() {
    let turn = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) turn -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) turn += 1;
    st.turn = clamp(turn + st.dragTurn, -1, 1);
    st.thrust = keys.has('ArrowUp') || keys.has('KeyW') || st.dragThrust;

    /* 触屏拖动：横向位移 → 转向，纵向往上拉 → 加油 */
    if (drag) {
      st.dragTurn = clamp((drag.x - drag.x0) / 70, -1, 1);
      st.dragThrust = (drag.y0 - drag.y) > 26;
    } else {
      st.dragTurn = 0;
      st.dragThrust = false;
    }

    const out = {
      turn: st.turn,
      thrust: st.thrust,
      fire: st.fire,
      pause: st.pause,
      quit: st.quit,
      confirm: st.confirm,
      aim: st.aim,
    };
    st.fire = false;
    st.pause = false;
    st.quit = false;
    st.confirm = false;
    return out;
  }

  function reset() {
    keys.clear();
    drag = null;
    st.turn = 0; st.thrust = false;
    st.fire = false; st.pause = false; st.quit = false; st.confirm = false;
    st.dragTurn = 0; st.dragThrust = false;
  }

  function destroy() {
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
  }

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  try { canvas.style.touchAction = 'none'; } catch { /* 老浏览器没这个属性 */ }

  return { read, reset, destroy, state: st };
}
