/*!
 * flight/levels.js — 农场层级 / 波次表（难度跟「层级」走，不跟分数走）
 *
 * 抄 Cosmic Assault 的口径（research/minigame-opensource.md §1.2）：
 *   「难度跟着你所在的 galaxy 走，不跟着分数走」。
 *   所以这里是一张**纯数据表**：层级由时间推进（tier index），刷怪节奏由表里的
 *   waves 决定，**跟玩家当前分数完全无关** —— 打得再好，这一层的密度也不会自己变。
 *
 * 表的形状：
 *   tier = { id, name, dur, flow, waves: [...] }
 *     dur   —— 这一层持续多少秒（累加起来就是一局的长度）
 *     flow  —— 这一层里「农场往后退」的速度 px/s（风把纸飞机往前推的基准）
 *     waves —— 这一层刷什么。wave = { type, every, first, speedMul }
 *       type     —— enemies.js 里的敌型 id
 *       every    —— 间隔多少秒刷一只
 *       first    —— 这一层开始后多少秒才开始刷
 *       speedMul —— 这只的速度倍率（层级越深越大）
 *
 * 改难度只改这张表，不用碰逻辑代码。
 */

/* 五个农场层级，从谷仓院一路飞到云上头 */
export const TIERS = [
  {
    id: 'yard',
    name: '谷仓院',
    dur: 12,
    flow: 160,
    waves: [
      { type: 'ladybug', every: 1.75, first: 0.7, speedMul: 0.9 },
    ],
  },
  {
    id: 'fence',
    name: '篱笆线',
    dur: 14,
    flow: 175,
    waves: [
      { type: 'ladybug', every: 1.35, first: 0.5, speedMul: 1.0 },
      { type: 'sparrow', every: 5.4, first: 3.6, speedMul: 0.9 },
    ],
  },
  {
    id: 'field',
    name: '田垄上',
    dur: 16,
    flow: 190,
    waves: [
      { type: 'ladybug', every: 1.05, first: 0.4, speedMul: 1.1 },
      { type: 'sparrow', every: 4.0, first: 2.8, speedMul: 1.0 },
    ],
  },
  {
    id: 'slope',
    name: '远山坡',
    dur: 16,
    flow: 205,
    waves: [
      { type: 'ladybug', every: 0.85, first: 0.3, speedMul: 1.2 },
      { type: 'sparrow', every: 3.1, first: 2.2, speedMul: 1.1 },
    ],
  },
  {
    id: 'cloud',
    name: '云上头',
    dur: 14,
    flow: 220,
    waves: [
      { type: 'ladybug', every: 0.72, first: 0.3, speedMul: 1.3 },
      { type: 'sparrow', every: 2.5, first: 1.8, speedMul: 1.2 },
    ],
  },
];

/* 累加时长：一局的总长度（当前 72 秒，落在「30–90 秒一局」里） */
const BOUNDS = (() => {
  const b = [];
  let acc = 0;
  for (const t of TIERS) { b.push({ from: acc, to: acc + t.dur }); acc += t.dur; }
  return b;
})();

/** 一局总时长（秒） */
export function routeDuration() {
  return BOUNDS.length ? BOUNDS[BOUNDS.length - 1].to : 0;
}

/**
 * 某一时刻所在的层级。
 * @param {number} t 本局已玩秒数
 * @returns {{tier:object, index:number, into:number, left:number, progress:number, done:boolean}}
 */
export function tierAt(t) {
  const time = Math.max(0, Number(t) || 0);
  for (let i = 0; i < BOUNDS.length; i++) {
    const b = BOUNDS[i];
    if (time < b.to || i === BOUNDS.length - 1) {
      const into = Math.min(time - b.from, TIERS[i].dur);
      return {
        tier: TIERS[i],
        index: i,
        into: Math.max(0, into),
        left: Math.max(0, TIERS[i].dur - Math.max(0, into)),
        progress: TIERS[i].dur ? Math.max(0, into) / TIERS[i].dur : 1,
        done: time >= routeDuration(),
      };
    }
  }
  const last = TIERS[TIERS.length - 1];
  return { tier: last, index: TIERS.length - 1, into: last.dur, left: 0, progress: 1, done: true };
}
