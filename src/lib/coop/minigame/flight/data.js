/*!
 * flight/data.js — 小鸡开纸飞机：机制参数 + 画风色板（小游戏侧唯一出处）
 *
 * 为什么参数不放 packs/mujing/pack.json：
 *   pack.json 是鸡场的运行时包，主会话随时可能改它；小游戏参数单独放这里，
 *   两边改起来会打架。将来要接 pack.json，方案见
 *   research/minigame-flight-design.md §「接 pack.json 的方案」。
 *
 * 画风色板：research/art-style.md §2 的 9 个 farm 色 token，一个不多一个不少。
 *   画风的唯一出处是那份文档；这里的 hex 是它的镜像（canvas 读不到 CSS 变量时兜底），
 *   readPalette() 会优先读宿主页面 :root 上的 --farm-* 变量，读不到才回落到这份镜像。
 *
 * 禁项自查（art-style.md）：无渐变 / 无半透明叠色 / 无阴影投影 / 无外发光 /
 *   无纯色背景（纸底 + 颗粒噪点 + 三层视差）/ 无 CRT 扫描线 / 无霓虹 glow /
 *   无 bloom·暗角·色差。粒子只有纯色小方块，不做加色混合。
 */

/* 9 个 farm 色 token（research/art-style.md §2） */
export const PALETTE = {
  paper: '#F3EBDD',  // 纸底、卡片底、盘面
  green: '#6E9A55',  // 草、叶、手绘块
  yellow: '#E8B93C', // 玉米、太阳、高亮块
  orange: '#E4743A', // 圆边、胶带、剪影主色
  red: '#9C3A31',    // 深红点缀
  blue: '#4A6E96',   // 冷色块、水
  ink: '#2B2118',    // 线条、描边、文字
  pink: '#EAA98D',   // 粉色块
  gray: '#9C9C93',   // 灰色块
  white: '#FFFFFF',  // 色块之间的白色分隔描边
};

/* CSS 变量名（宿主页面若定义了 --farm-*，优先用它） */
const CSS_NAME = {
  paper: 'paper', green: 'green', yellow: 'yellow', orange: 'orange',
  red: 'red', blue: 'blue', ink: 'ink', pink: 'pink', gray: 'gray', white: 'white',
};

/**
 * 读宿主页 :root 上的 --farm-* 变量；读不到就回落到内置镜像。
 * 任何异常都吞掉 —— 画风读不到不能带塌游戏。
 * @param {Document} [doc]
 * @returns {typeof PALETTE}
 */
export function readPalette(doc) {
  const p = Object.assign({}, PALETTE);
  try {
    const d = doc || (typeof document !== 'undefined' ? document : null);
    if (!d || !d.documentElement) return p;
    const cs = getComputedStyle(d.documentElement);
    for (const k of Object.keys(PALETTE)) {
      const v = cs.getPropertyValue('--farm-' + CSS_NAME[k]);
      if (v && v.trim()) p[k] = v.trim();
    }
  } catch { /* 读不到就用内置镜像 */ }
  return p;
}

/* 机制参数：一处改，全局生效 */
export const FLIGHT = {
  /* 本地存档键（与鸡场的 coop-farm-v1 分开，互不干扰） */
  storeKey: 'coop-flight-v1',
  /* 每日一局的种子盐：同一天 → 同一条航线 */
  seedSalt: 'mujing-paper-plane',

  world: {
    baseSpeed: 170,   // 纸飞机一直往前飘的基准速度 px/s
    maxSpeed: 300,    // 满油门
    accel: 200,       // 加速速率 px/s²
    brake: 150,       // 松油门回落速率 px/s²
    turnRate: 2.5,    // 转向角速度 rad/s
    maxHeading: 1.15, // 航向夹角（±66°，不许倒着飞）
  },

  plane: {
    r: 13,            // 视觉半径
    hitR: 9,          // 判定半径（比视觉小一点，手感宽容）
    marginX: 26,
    marginTop: 46,
    marginBottom: 76,
  },

  feather: {
    speed: 640,
    life: 1.15,
    r: 7,
    cooldown: 0.15,   // 两根羽毛之间的最小间隔
  },

  score: {
    perDistance: 10,  // 每 10px 飞行距离记 1 分
    perDodge: 10,     // 每躲过一个障碍记 10 分
  },

  flame: {
    max: 26,
    life: 0.42,
    size: 5,
    spread: 0.5,
  },

  /* 撞机时的屏幕震动（reduced-motion 下整个关掉） */
  shake: { amp: 10, dur: 0.32 },

  limits: { maxObstacles: 26, maxFeathers: 24 },
};

/* 纸底颗粒噪点（art-style.md §1：纸张颗粒做旧，噪点 opacity ≤ 0.08）。
   引擎自己的 GRAIN 是内联 SVG 贴图，这里用同一思路自己生成一块可平铺的噪点，
   不引外部图片文件。 */
export const GRAIN = { tile: 120, alpha: 0.06, dot: 1 };

/* ---------- 随机数（每日航线要可复现，所以不用 Math.random） ---------- */

/** mulberry32：小而稳的种子随机数 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 字符串 → 32 位种子（FNV-1a） */
export function hashStr(s) {
  let h = 2166136261;
  const t = String(s == null ? '' : s);
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 本地日期 → 'YYYY-MM-DD'（每日一局按本地日历天算） */
export function todayKey(d) {
  const t = d instanceof Date ? d : new Date();
  const p = (n) => String(n).padStart(2, '0');
  return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
}

/** 'YYYY-MM-DD' → 前一天（算连续 streak 用） */
export function prevDayKey(dayKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey || ''));
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}
