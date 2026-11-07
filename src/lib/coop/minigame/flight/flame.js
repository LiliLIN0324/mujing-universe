/*!
 * flight/flame.js — 尾焰（简化带状粒子）
 *
 * 抄的是「一条简化的带子」这个结构（research/minigame-opensource.md §1.4），
 * 不是图片序列帧、不是实时流体模拟。
 *
 * 画风纪律（art-style.md §2 / 硬约束）：
 *   粒子只用**纯色小方块**，不做加色混合、不做阴影、不做渐变。
 *   所以这里没有任何 globalCompositeOperation / shadowBlur / 渐变。
 */

const TAU = Math.PI * 2;

/**
 * 造一条尾焰。
 * @param {{max:number, life:number, size:number, spread:number}} cfg
 */
export function createFlame(cfg) {
  const max = Math.max(1, cfg.max | 0);
  const life = cfg.life || 0.4;
  const size = cfg.size || 5;
  const spread = cfg.spread || 0.5;
  const parts = [];

  /**
   * 放一节尾焰。angle 是机头朝向（弧度，0 = 朝上）。
   * @param {number} x @param {number} y @param {number} angle @param {number} speed
   * @param {number} [scale] 速度越大尾焰越稀
   */
  function emit(x, y, angle, speed, scale) {
    if (parts.length >= max) parts.shift();
    const back = angle + Math.PI;                       // 机尾方向
    const jitter = (Math.random() - 0.5) * spread;
    const sp = (0.35 + Math.random() * 0.5) * Math.min(1.6, (speed || 150) / 170);
    parts.push({
      x: x + (Math.random() - 0.5) * 3,
      y: y + (Math.random() - 0.5) * 3,
      vx: Math.cos(back + jitter) * sp * 90,
      vy: Math.sin(back + jitter) * sp * 90,
      life: life * (0.7 + Math.random() * 0.5),
      age: 0,
      size: size * (0.7 + Math.random() * 0.6),
    });
  }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
  }

  /** 画尾焰：纯色小方块，一节比一节小 */
  function draw(g, P) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const k = 1 - p.age / p.life;
      const s = Math.max(1, p.size * k);
      g.fillStyle = P.yellow;         // 纯色，不加色混合
      g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.round(s), Math.round(s));
    }
  }

  function clear() { parts.length = 0; }

  return { emit, update, draw, clear, count: () => parts.length, TAU };
}
