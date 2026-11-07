/*!
 * flight/enemies.js — 敌型 = 一条数据 + 一个行为函数（不做继承树）
 *
 * 抄 Radius Raid 的最小组织法（research/minigame-opensource.md §1.2）：
 *   每个敌型就是一个对象，里面是数据（半径 / 速度 / 血量）和一个行为函数 behave()。
 *   加新敌型 = 往 ENEMY_TYPES 里加一条，不动任何别的代码，也不建类层次。
 *
 * 敌型（抄机制不抄皮肤）：
 *   瓢虫 —— 被惊飞的农场瓢虫，横着飘，慢，但会慢慢横穿整条航线
 *   麻雀 —— 被惊飞的麻雀，先直着滑一段，靠近后俯冲；俯冲有转向上限，躲得开
 */

const TAU = Math.PI * 2;

/* 敌型表：数据 + 行为函数 + 画法 */
export const ENEMY_TYPES = {
  /* ---------- 瓢虫：横着飘 ---------- */
  ladybug: {
    id: 'ladybug',
    label: '瓢虫',
    r: 14,
    hitR: 11,
    hp: 1,
    drift: 78,        // 横向漂移速度 px/s
    bobAmp: 7,        // 上下浮动的幅度
    bobHz: 0.55,
    color: 'red',

    spawn(e, rng, ctx) {
      /* 从画面上方进场，横向漂移方向随机 */
      const mul = ctx.speedMul || 1;
      e.speedMul = mul;
      e.y = -40 - rng() * 60;
      e.x = -40 + rng() * (ctx.W + 80);
      e.vx = (rng() < 0.5 ? -1 : 1) * this.drift * mul * (0.85 + rng() * 0.3);
      e.baseY = e.y;
      e.phaseT = rng() * TAU;
      e.angle = e.vx > 0 ? 0 : Math.PI; // 脸朝漂的方向
    },

    /* 行为函数：横着飘 + 轻微上下浮动 */
    behave(e, dt, ctx) {
      e.phaseT += dt;
      e.x += e.vx * dt;
      e.baseY += ctx.flow * 0.34 * dt;   // 跟着农场的流向慢慢往下走
      e.y = e.baseY + Math.sin(e.phaseT * TAU * this.bobHz) * this.bobAmp;
      e.angle = e.vx > 0 ? 0 : Math.PI;
    },

    draw(g, e, P) {
      const r = this.r;
      g.save();
      g.translate(e.x, e.y);
      /* 身体：红壳（8 参数 ellipse，rotation 必须给，否则角度整体错位） */
      g.beginPath();
      g.ellipse(0, 0, r, r * 0.88, 0, 0, TAU, false);
      g.fillStyle = P.red;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = P.ink;
      g.stroke();
      /* 壳上几颗墨点 */
      g.fillStyle = P.ink;
      g.beginPath();
      g.ellipse(-r * 0.34, -r * 0.18, r * 0.16, r * 0.16, 0, 0, TAU, false);
      g.fill();
      g.beginPath();
      g.ellipse(r * 0.30, -r * 0.26, r * 0.13, r * 0.13, 0, 0, TAU, false);
      g.fill();
      /* 头：先用白色描边把色块分开，再画墨色的头 */
      const hx = e.vx > 0 ? r * 0.86 : -r * 0.86;
      g.beginPath();
      g.ellipse(hx, -r * 0.08, r * 0.42, r * 0.38, 0, 0, TAU, false);
      g.lineWidth = 3;
      g.strokeStyle = P.white;
      g.stroke();
      g.fillStyle = P.ink;
      g.fill();
      g.restore();
    },
  },

  /* ---------- 麻雀：俯冲 ---------- */
  sparrow: {
    id: 'sparrow',
    label: '麻雀',
    r: 15,
    hitR: 10,
    hp: 1,
    glide: 26,        // 滑翔时的额外下落速度
    diveSpeed: 252,   // 俯冲速度
    turnRate: 2.1,    // 俯冲时的转向上限（rad/s）—— 有上限才躲得开
    diveDelay: 1.5,   // 进场多久之后开始俯冲
    color: 'gray',

    spawn(e, rng, ctx) {
      e.speedMul = ctx.speedMul || 1;
      e.y = -70 - rng() * 60;
      e.x = 40 + rng() * Math.max(40, ctx.W - 80);
      e.phase = 'glide';
      e.t = 0;
      e.angle = Math.PI / 2; // 先朝下
      e.vx = (rng() - 0.5) * 40;
    },

    /* 行为函数：先滑翔，靠近（或等够时间）后俯冲追小鸡 */
    behave(e, dt, ctx) {
      e.t += dt;
      if (e.phase === 'glide') {
        e.x += e.vx * dt;
        e.y += (ctx.flow * 0.9 + this.glide) * dt;
        e.angle = Math.PI / 2 + e.vx * 0.004;
        const p = ctx.player;
        const close = p && (e.y > p.y - 220);
        if (e.t > this.diveDelay || close) e.phase = 'dive';
      } else {
        const p = ctx.player;
        if (p) {
          const want = Math.atan2(p.y - e.y, p.x - e.x);
          let diff = want - e.angle;
          while (diff > Math.PI) diff -= TAU;
          while (diff < -Math.PI) diff += TAU;
          const maxTurn = this.turnRate * dt;
          e.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
        }
        e.x += Math.cos(e.angle) * this.diveSpeed * (e.speedMul || 1) * dt;
        e.y += Math.sin(e.angle) * this.diveSpeed * (e.speedMul || 1) * dt;
      }
    },

    draw(g, e, P) {
      const r = this.r;
      g.save();
      g.translate(e.x, e.y);
      g.rotate(e.angle);
      /* 身体：灰块 */
      g.beginPath();
      g.ellipse(0, 0, r * 1.16, r * 0.78, 0, 0, TAU, false);
      g.fillStyle = P.gray;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = P.ink;
      g.stroke();
      /* 翅膀：米白块，先垫白描边再填色（色块之间白色描边分隔） */
      g.beginPath();
      g.ellipse(-r * 0.12, -r * 0.1, r * 0.62, r * 0.4, -0.22, 0, TAU, false);
      g.lineWidth = 3;
      g.strokeStyle = P.white;
      g.stroke();
      g.fillStyle = P.paper;
      g.fill();
      /* 喙 + 眼：墨色线条 */
      g.beginPath();
      g.moveTo(r * 1.1, 0);
      g.lineTo(r * 1.5, r * 0.16);
      g.lineTo(r * 1.1, r * 0.3);
      g.closePath();
      g.fillStyle = P.ink;
      g.fill();
      g.beginPath();
      g.ellipse(r * 0.62, -r * 0.24, r * 0.13, r * 0.13, 0, 0, TAU, false);
      g.fillStyle = P.ink;
      g.fill();
      g.restore();
    },
  },
};

/**
 * 造一只敌。类型不认识就返回 null（不抛异常）。
 * @param {string} type ENEMY_TYPES 的键
 * @param {function} rng 种子随机数（每日航线要可复现）
 * @param {object} ctx { W, H, flow, player }
 */
export function spawnEnemy(type, rng, ctx) {
  const T = ENEMY_TYPES[type];
  if (!T) return null;
  const e = {
    type: T.id,
    label: T.label,
    r: T.r,
    hitR: T.hitR,
    hp: T.hp,
    x: 0, y: 0, vx: 0, angle: 0, phase: '', phaseT: 0, t: 0, baseY: 0, speedMul: 1, dead: false,
  };
  try { T.spawn(e, rng, ctx); } catch { return null; }
  return e;
}
