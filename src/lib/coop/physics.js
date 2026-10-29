/*!
 * coop.js physics v0.1.0 — 鸡场物理适配器（音乐会 / 扔鸡的真实物理）
 * 鸡 = 有质量的圆体（restitution 0.35 / friction 0.02：抛物线 + 弹跳 + 滑停）；
 * 琴键 / 地板 = 可挪动的静态矩形（琴键 is-down 下沉时用 setStaticPos 同步物理位置）。
 * 零依赖纪律的唯一例外：matter.js 走 CDN 懒加载（与 mimi-live 的 Rive 运行时同模式）。
 *
 * 用法：
 *   import { createPhysics, simpleFallback } from './physics.js';
 *   const phy = (await createPhysics()) || simpleFallback(); // CDN 全败 → 降级，鸡不能残废
 *   phy.addStaticRect('floor', innerWidth / 2, innerHeight + 40, innerWidth, 80); // 矩形以「中心点」定位（Matter 惯例）
 *   phy.addCircle('chick-12', 300, 180, 20);  // 有质量的鸡（圆体）
 *   phy.applyThrow('chick-12', 5, -9);        // 速度单位 px/步(16.6ms)，vy 负 = 上抛；(5,-9) ≈ 300,540 px/s
 *   const off = phy.onGround('chick-12', (p) => {}); // 弹两下站稳后回调一次：p = { x, y, vx, vy }
 *   每帧 phy.getPos('chick-12') → { x, y, angle, vx, vy } 喂 DOM transform；收摊 phy.destroy()。
 *   自托管可传 createPhysics({ url: '/vendor/matter-js/+esm' })；无 rAF 的环境传 autoLoop: false 自己驱 step。
 *
 * 降级契约（CDN 失败时功能不残废）：
 *   1. createPhysics：jsdelivr +esm 通道懒加载 matter-js@0.20.0，重试 3 次间隔 700ms，
 *      兼容「命名导出 Matter 对象」与「default 整包」两种包装形状；全败返回 null；
 *   2. 调用方见 null 就换 simpleFallback()：同 API 形状、同速度单位，纯重力 + 视口地板反弹，
 *      无体间碰撞（琴键不挡鸡，其余手感一致）——扔、抛物线、弹跳、站稳回调都在；
 *   3. onGround：速度趋零且脚下有支撑（降级版 = 触底）连续约 100ms 才回调，一次落地说一次；
 *      applyThrow 会重新武装（再扔再报）；onGround 返回取消函数，destroy 后不再回调；
 *   4. step(dtMs) 固定 16.6ms 步长推进（dt 大了补步、单次至多 3 步防死亡螺旋）；
 *      默认内部 rAF 自转（页签隐藏随 rAF 自动暂停），autoLoop: false 时由调用方自驱 step。
 *   reduced-motion 下开不开物理由调用方定（适配器不替人做偏好假设）。
 */

const DEFAULT_URL = 'https://cdn.jsdelivr.net/npm/matter-js@0.20.0/+esm'; // 与 Rive 运行时同通道：jsdelivr +esm
const FIXED = 16.6; // 固定步长（ms）：matter 基准 delta，速度单位即 px / 此步
const MAX_SUBSTEPS = 3; // 单次 step 至多补 3 步：落后太多直接清账，防死亡螺旋
const RESTITUTION = 0.35; // 鸡的弹性：落地弹两下的手感
const FRICTION = 0.02; // 鸡的滑动摩擦：滑一小段停住
const GROUND_SPEED = 0.6; // 「站稳」速度阈值（px/步）：低于它算静止
const GROUND_CALM = 6; // 静止需连续 6 步（约 100ms）：滤掉弹跳谷底的瞬时低速
const FALLBACK_G = 0.276; // 降级版每步重力增量（px/步）：对齐 matter 默认重力（y=1 × scale 0.001 × 16.6ms²）

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* CDN 包两种包装形状都认（matter 是命名导出 Matter 对象，也可能被包进 default）：
   mod.Matter / mod.default.Matter / mod.default 即整包 / mod 本体即整包，见谁都算数。 */
function pickMatter(mod) {
  try {
    const cands = [mod, mod && mod.Matter, mod && mod.default, mod && mod.default && mod.default.Matter];
    for (const c of cands) {
      if (c && c.Engine && c.Bodies && c.Body && c.Composite && c.Query && typeof c.Engine.create === 'function') return c;
    }
  } catch { /* 结构怪异当没看见 */ }
  return null;
}

/**
 * 建物理世界。CDN 三次重试全败返回 null，调用方降级 simpleFallback()。
 * @param {{ url?: string, gravityY?: number, autoLoop?: boolean }} opts
 * @returns {Promise<object|null>} { ok:true, mode:'matter', addCircle, addStaticRect, setStaticPos, applyThrow, setSensor, getPos, step, onGround, destroy }
 */
export async function createPhysics(opts = {}) {
  const url = opts.url || DEFAULT_URL;
  const gravityY = opts.gravityY == null ? 1 : opts.gravityY; // 世界重力 y=1（方案手感基准）
  const autoLoop = opts.autoLoop !== false; // 默认内部 rAF 自转

  /* 懒加载 matter.js：CDN 偶发断连，重试三次、间隔 700ms（mimi-live 同款） */
  let M = null;
  try {
    let mod = null;
    let lastErr = null;
    for (let i = 0; i < 3; i += 1) {
      try { mod = await import(/* @vite-ignore */ url); lastErr = null; break; }
      catch (e) { lastErr = e; if (i < 2) await new Promise((r) => setTimeout(r, 700)); }
    }
    if (mod) M = pickMatter(mod);
    if (!M) throw lastErr || new Error('matter.js 结构不认识');
  } catch { return null; } // 降级契约：全败返回 null，调用方换 simpleFallback()

  let engine = null;
  let world = null;
  try {
    engine = M.Engine.create();
    world = engine.world;
    try { engine.gravity.y = gravityY; } catch { try { engine.world.gravity.y = gravityY; } catch { /* 老版本别名 */ } }
  } catch { return null; } // 建不成世界同样走降级

  const bodies = new Map(); // id → Matter body
  const watchers = new Map(); // id → { id, cb, calm, fired }
  let acc = 0; // 固定步长累加器（ms）
  let raf = 0;
  let lastT = -1;
  let dead = false;

  /* 同 id 重复添加：旧的出世界，新的顶上（换皮不换键） */
  function put(id, body) {
    const old = bodies.get(id);
    if (old) { try { M.Composite.remove(world, old); } catch { /* 旧的已不在 */ } }
    bodies.set(id, body);
  }

  /* 脚下有支撑吗：接触点落在圆心下方 35% 半径即算「有东西垫着」——琴键顶边 / 地板 / 别的鸡背都算。
     Query 只对挂了 onGround 的鸡跑（通常一两只），量小。 */
  function touchSupported(body) {
    try {
      const others = [];
      const all = M.Composite.allBodies(world);
      for (const b of all) { if (b !== body && !b.isSensor) others.push(b); }
      if (!others.length) return false;
      const cols = M.Query.collides(body, others);
      if (!cols || !cols.length) return false;
      const r = body.circleRadius || 12;
      for (const col of cols) {
        const sups = col.supports || [];
        const n = col.supportCount != null ? Math.min(col.supportCount, sups.length) : sups.length;
        for (let i = 0; i < n; i += 1) {
          const p = sups[i];
          if (p && p.y > body.position.y + r * 0.35) return true;
        }
      }
      return true; // 有接触但拿不到接触点（打包结构差异）：保守判有支撑，速度阈值兜底
    } catch { return false; }
  }

  /* 站稳判定：速度趋零 + 有支撑，连续 GROUND_CALM 步才报（一次落地说一次，applyThrow 重新武装） */
  function evalGround() {
    for (const w of watchers.values()) {
      if (w.fired) continue;
      const body = bodies.get(w.id);
      if (!body || body.isSensor) continue;
      const speed = body.speed || Math.hypot(body.velocity.x, body.velocity.y);
      if (speed < GROUND_SPEED && touchSupported(body)) w.calm += 1;
      else w.calm = 0;
      if (w.calm >= GROUND_CALM) {
        w.fired = true;
        w.calm = 0;
        try { w.cb({ x: body.position.x, y: body.position.y, vx: body.velocity.x, vy: body.velocity.y }); } catch { /* 回调炸了不掀桌 */ }
      }
    }
  }

  /* 固定步长推进：dt 拆成 16.6ms 的整步，单次至多 MAX_SUBSTEPS 步，落后太多丢帧保命 */
  function doStep(dtMs) {
    if (!engine || dead) return 0;
    acc += clamp(Number(dtMs) || 0, 0, 50);
    let n = 0;
    while (acc >= FIXED && n < MAX_SUBSTEPS) {
      acc -= FIXED;
      n += 1;
      try { M.Engine.update(engine, FIXED); } catch { acc = 0; return n; }
    }
    if (acc >= FIXED) acc = 0;
    if (n > 0) evalGround();
    return n;
  }

  /* 内部 rAF 步进循环：页签隐藏时 rAF 自停（acc 封顶，恢复不追帧） */
  function loop(now) {
    if (dead) return;
    try {
      const dt = lastT < 0 ? FIXED : Math.min(50, now - lastT);
      lastT = now;
      doStep(dt);
    } catch { /* 单帧失败不掀桌 */ }
    raf = requestAnimationFrame(loop);
  }
  if (autoLoop && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(loop);

  return {
    ok: true,
    mode: 'matter', // 调用方可据此区分真物理与降级
    /* 鸡：有质量圆体。o 可传 density / label / angle 等 Matter 原生参数，默认弹性与摩擦见模块头 */
    addCircle(id, x, y, r, o) {
      try {
        if (dead) return null;
        const opt = Object.assign({ restitution: RESTITUTION, friction: FRICTION, label: String(id) }, o || {});
        const body = M.Bodies.circle(Number(x) || 0, Number(y) || 0, Math.max(2, Number(r) || 10), opt);
        if (!body) return null;
        put(String(id), body);
        M.Composite.add(world, body);
        return body;
      } catch { return null; }
    },
    /* 琴键 / 地板：静态矩形，以中心点定位（Bodies.rectangle 惯例）；o 可传 angle 等原生参数 */
    addStaticRect(id, x, y, w, h, o) {
      try {
        if (dead) return null;
        const opt = Object.assign({ isStatic: true, label: String(id) }, o || {});
        const body = M.Bodies.rectangle(Number(x) || 0, Number(y) || 0, Math.max(1, Number(w) || 1), Math.max(1, Number(h) || 1), opt);
        if (!body) return null;
        put(String(id), body);
        M.Composite.add(world, body);
        return body;
      } catch { return null; }
    },
    /* 挪静态体：琴键 is-down 下沉 / 地板随布局变化时同步；对动态体也生效（瞬移） */
    setStaticPos(id, x, y) {
      try {
        const body = bodies.get(String(id));
        if (!body) return false;
        M.Body.setPosition(body, { x: Number(x) || 0, y: Number(y) || 0 });
        return true;
      } catch { return false; }
    },
    /* 扔鸡：设初速度（px/步，vy 负 = 上抛）+ 一点随机翻滚；顺带重新武装该鸡的 onGround（再扔再报） */
    applyThrow(id, vx, vy) {
      try {
        const k = String(id);
        const body = bodies.get(k);
        if (!body) return false;
        try { M.Sleeping.set(body, false); } catch { /* 未启用睡眠 */ }
        M.Body.setVelocity(body, { x: Number(vx) || 0, y: Number(vy) || 0 });
        try { M.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.12); } catch { /* 翻滚可省 */ }
        const w = watchers.get(k);
        if (w) { w.fired = false; w.calm = 0; }
        return true;
      } catch { return false; }
    },
    /* 穿墙 / 穿琴键模式：传感器不受碰撞力，但仍触发接触事件 */
    setSensor(id, flag) {
      try {
        const body = bodies.get(String(id));
        if (!body) return false;
        body.isSensor = !!flag;
        return true;
      } catch { return false; }
    },
    /* 喂渲染：位置 + 角度 + 速度（px/步），id 不存在返回 null */
    getPos(id) {
      try {
        const body = bodies.get(String(id));
        if (!body) return null;
        return { x: body.position.x, y: body.position.y, angle: body.angle || 0, vx: body.velocity.x, vy: body.velocity.y };
      } catch { return null; }
    },
    /* 手动步进（autoLoop: false 时用）；返回本帧实际走的物理步数 */
    step(dtMs) {
      try { return doStep(dtMs); } catch { return 0; }
    },
    /* 站稳回调（一次落地一次）：返回取消函数；onGround 可先于 addCircle/applyThrow 挂 */
    onGround(id, cb) {
      try {
        if (typeof cb !== 'function') return () => {};
        const k = String(id);
        watchers.set(k, { id: k, cb, calm: 0, fired: false });
        return () => { try { watchers.delete(k); } catch { /* 已销毁 */ } };
      } catch { return () => {}; }
    },
    destroy() {
      dead = true;
      try { if (raf) cancelAnimationFrame(raf); } catch { /* 已停 */ }
      raf = 0;
      try { M.Events.off(engine); } catch { /* 无监听 */ }
      try { M.Composite.clear(world, false); } catch { /* 已清 */ }
      try { M.Engine.clear(engine); } catch { /* 已清 */ }
      bodies.clear();
      watchers.clear();
      engine = null;
      world = null;
    },
  };
}

/**
 * 降级迷你运动学：无 matter.js 时的保底，功能不残废。
 * 同 API 形状、同速度单位（px/步）：纯重力 + 视口地板反弹（floorY 可传，默认 window.innerHeight），
 * 无体间碰撞——琴键不挡鸡，左右软墙兜住不让鸡飞丢。onGround = 触底且速度趋零。
 * @param {{ floorY?: number }} opts
 * @returns {object} { ok:true, mode:'fallback', …同上 }
 */
export function simpleFallback(opts = {}) {
  const circles = new Map(); // id → { x, y, vx, vy, r, sensor }
  const rects = new Map(); // id → { x, y, w, h }（降级版不参与碰撞，仅占位保 API 形状）
  const watchers = new Map();
  let acc = 0;
  let dead = false;

  const floorY = () => { try { const f = Number(opts.floorY); return Number.isFinite(f) ? f : window.innerHeight; } catch { return 800; } };
  const viewW = () => { try { return window.innerWidth; } catch { return 800; } };

  /* 一个 16.6ms 步：重力积分 → 左右软墙 → 地板反弹（系数对齐 matter 版 0.35） */
  function tick() {
    const W = viewW();
    const F = floorY();
    for (const c of circles.values()) {
      c.vy += FALLBACK_G;
      c.x += c.vx;
      c.y += c.vy;
      c.vx *= 0.998; // 空气阻尼
      if (c.x < c.r) { c.x = c.r; c.vx = Math.abs(c.vx) * RESTITUTION; }
      else if (c.x > W - c.r) { c.x = W - c.r; c.vx = -Math.abs(c.vx) * RESTITUTION; }
      if (c.y > F - c.r) {
        c.y = F - c.r;
        if (c.vy > 0) {
          c.vy = -c.vy * RESTITUTION;
          c.vx *= 0.92; // 落地蹭掉一点横速
          if (Math.abs(c.vy) < 0.5) c.vy = 0; // 微弹吸收 → 站稳
        }
      }
    }
  }

  function evalGround() {
    const F = floorY();
    for (const w of watchers.values()) {
      if (w.fired) continue;
      const c = circles.get(w.id);
      if (!c || c.sensor) continue;
      const grounded = c.y >= F - c.r - 1 && Math.abs(c.vy) < GROUND_SPEED && Math.abs(c.vx) < GROUND_SPEED;
      w.calm = grounded ? w.calm + 1 : 0;
      if (w.calm >= GROUND_CALM) {
        w.fired = true; // 一次落地说一次；applyThrow 重新武装
        w.calm = 0;
        try { w.cb({ x: c.x, y: c.y, vx: c.vx, vy: c.vy }); } catch { /* 回调炸了不掀桌 */ }
      }
    }
  }

  return {
    ok: true,
    mode: 'fallback', // 调用方可据此知道跑的是简装物理
    addCircle(id, x, y, r) {
      try {
        if (dead) return null;
        const c = { x: Number(x) || 0, y: Number(y) || 0, vx: 0, vy: 0, r: Math.max(2, Number(r) || 10), sensor: false };
        circles.set(String(id), c);
        return c;
      } catch { return null; }
    },
    /* 降级版静态矩形不参与碰撞（琴键不挡鸡），仅占位保 API 形状 */
    addStaticRect(id, x, y, w, h) {
      try {
        if (dead) return null;
        const rc = { x: Number(x) || 0, y: Number(y) || 0, w: Math.max(1, Number(w) || 1), h: Math.max(1, Number(h) || 1) };
        rects.set(String(id), rc);
        return rc;
      } catch { return null; }
    },
    setStaticPos(id, x, y) {
      try {
        const rc = rects.get(String(id));
        if (!rc) return false;
        rc.x = Number(x) || 0;
        rc.y = Number(y) || 0;
        return true;
      } catch { return false; }
    },
    applyThrow(id, vx, vy) {
      try {
        const k = String(id);
        const c = circles.get(k);
        if (!c) return false;
        c.vx = Number(vx) || 0;
        c.vy = Number(vy) || 0;
        const w = watchers.get(k);
        if (w) { w.fired = false; w.calm = 0; } // 再扔再报
        return true;
      } catch { return false; }
    },
    /* 降级版仅记标记：没有碰撞系统，sensor 与否行为一致（契约见模块头第 2 条） */
    setSensor(id, flag) {
      try {
        const c = circles.get(String(id));
        if (!c) return false;
        c.sensor = !!flag;
        return true;
      } catch { return false; }
    },
    getPos(id) {
      try {
        const c = circles.get(String(id));
        return c ? { x: c.x, y: c.y, angle: 0, vx: c.vx, vy: c.vy } : null;
      } catch { return null; }
    },
    step(dtMs) {
      try {
        if (dead) return 0;
        acc += clamp(Number(dtMs) || 0, 0, 50);
        let n = 0;
        while (acc >= FIXED && n < MAX_SUBSTEPS) { acc -= FIXED; n += 1; tick(); }
        if (acc >= FIXED) acc = 0; // 落后太多丢帧保命
        if (n > 0) evalGround();
        return n;
      } catch { return 0; }
    },
    onGround(id, cb) {
      try {
        if (typeof cb !== 'function') return () => {};
        const k = String(id);
        watchers.set(k, { id: k, cb, calm: 0, fired: false });
        return () => { try { watchers.delete(k); } catch { /* 已销毁 */ } };
      } catch { return () => {}; }
    },
    destroy() {
      dead = true;
      try { circles.clear(); rects.clear(); watchers.clear(); } catch { /* 已清 */ }
    },
  };
}
