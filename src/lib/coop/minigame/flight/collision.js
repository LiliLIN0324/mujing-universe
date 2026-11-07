/*!
 * flight/collision.js — 两段式碰撞（抄 Nova Rift 的结构，research §1.3）
 *
 * 第一段：包围盒粗筛（AABB）—— 便宜的矩形相交，先把绝大多数不相干的甩掉。
 * 第二段：精确判定（圆 vs 圆）—— 小鸡的判定圆比视觉小，手感宽容一点。
 *
 * 为什么分两段：一只屏幕上可能有二十几个障碍，逐个做圆判定不算贵，
 * 但先粗筛能让「不相干」的那部分连平方根都不用算；更重要的是，
 * 两段职责分开后，将来换成别的形状（矩形 / 多边形）只要换第二段。
 */

/**
 * 包围盒相交（粗筛）。a / b = { x, y, hw, hh }（中心 + 半宽半高）
 * @returns {boolean}
 */
export function aabbOverlap(a, b) {
  return (
    a.x - a.hw <= b.x + b.hw &&
    b.x - b.hw <= a.x + a.hw &&
    a.y - a.hh <= b.y + b.hh &&
    b.y - b.hh <= a.y + a.hh
  );
}

/**
 * 圆与圆相交（精确判定）
 * @returns {boolean}
 */
export function circleOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const rr = ar + br;
  return dx * dx + dy * dy <= rr * rr;
}

/**
 * 小鸡撞到障碍了吗（两段式）。
 * @param {{x:number,y:number,hitR:number}} plane
 * @param {Array} objs 障碍数组
 * @returns {object|null} 撞到的那个障碍，没撞返回 null
 */
export function hitPlane(plane, objs) {
  if (!plane || !objs || !objs.length) return null;
  /* 第一段：包围盒粗筛 */
  const a = { x: plane.x, y: plane.y, hw: plane.hitR, hh: plane.hitR };
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    if (!o || o.dead) continue;
    const b = { x: o.x, y: o.y, hw: o.hitR, hh: o.hitR };
    if (!aabbOverlap(a, b)) continue;
    /* 第二段：精确判定 */
    if (circleOverlap(plane.x, plane.y, plane.hitR, o.x, o.y, o.hitR)) return o;
  }
  return null;
}

/**
 * 羽毛打中障碍了吗（两段式，同上）。
 * @param {Array} feathers
 * @param {Array} objs
 * @returns {object|null} 第一个被打中的障碍
 */
export function hitFeathers(feathers, objs) {
  if (!feathers || !objs || !feathers.length || !objs.length) return null;
  for (let f = 0; f < feathers.length; f++) {
    const p = feathers[f];
    if (!p || p.dead) continue;
    const a = { x: p.x, y: p.y, hw: p.r, hh: p.r };
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      if (!o || o.dead) continue;
      const b = { x: o.x, y: o.y, hw: o.hitR, hh: o.hitR };
      if (!aabbOverlap(a, b)) continue;
      if (circleOverlap(p.x, p.y, p.r, o.x, o.y, o.hitR)) return o;
    }
  }
  return null;
}
