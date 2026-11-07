/*!
 * flight/sfx.js — 音效（复用引擎的 src/instruments.js，零素材）
 *
 * 硬约束：
 *   - 不引任何音频素材文件（纯振荡器合成）
 *   - **不新开第二个 AudioContext** —— 用的是引擎 ensureAudio() 建的那一个
 *   - 首次用户手势之后才有 ctx（引擎那边就是这么做的；这里只是读，拿不到就静音）
 *
 * 做法：引擎把已有的音频链路（actx + master）通过 tick 钩子的 api 递过来，
 *   这里拿 createVoices(actx, master) 现搭一套音色，全部直连 master。
 *   引擎的 instruments.js 是同一个模块实例（同一 URL），不重复加载。
 */

import { createVoices } from '../../instruments.js';

export function createSfx(getAudio) {
  let voices = null;
  let actxRef = null;
  let muted = false;

  /** 拿到引擎的音频链路；拿不到就静音（绝不自己建 ctx） */
  function ensure() {
    let a = null;
    try { a = getAudio(); } catch { a = null; }
    if (!a || !a.actx || !a.master) return null;
    if (actxRef !== a.actx) {
      try {
        voices = createVoices(a.actx, a.master);
        actxRef = a.actx;
      } catch { voices = null; }
    }
    if (!voices) return null;
    return { actx: a.actx, v: voices };
  }

  function setMuted(m) { muted = !!m; }
  function isMuted() { return muted; }

  /** 发射羽毛：短促的 pluck */
  function fire() {
    if (muted) return;
    const s = ensure(); if (!s) return;
    try { s.v.pluck(s.actx.currentTime, 88, 0.14); } catch { /* 静默退化 */ }
  }
  /** 打掉一个障碍：一记小铃 */
  function pop() {
    if (muted) return;
    const s = ensure(); if (!s) return;
    try { s.v.bell(s.actx.currentTime, 76, 0.16); } catch { /* 静默退化 */ }
  }
  /** 撞机：一下闷响 */
  function crash() {
    if (muted) return;
    const s = ensure(); if (!s) return;
    try {
      s.v.drum(s.actx.currentTime, 'kick', 0.34);
      s.v.drum(s.actx.currentTime + 0.04, 'snare', 0.16);
    } catch { /* 静默退化 */ }
  }
  /** 进下一层：一声清亮的铃 */
  function tier() {
    if (muted) return;
    const s = ensure(); if (!s) return;
    try { s.v.bell(s.actx.currentTime, 83, 0.18); } catch { /* 静默退化 */ }
  }
  /** 开局：一颗小音 */
  function start() {
    if (muted) return;
    const s = ensure(); if (!s) return;
    try { s.v.piano(s.actx.currentTime, 72, 0.3, 0.18); } catch { /* 静默退化 */ }
  }
  /** 躲过一个障碍：一记沙锤 */
  function dodge() {
    if (muted) return;
    const s = ensure(); if (!s) return;
    try { s.v.shaker(s.actx.currentTime, 0.10); } catch { /* 静默退化 */ }
  }

  return { fire, pop, crash, tier, start, dodge, setMuted, isMuted, ready: () => !!ensure() };
}
