/*!
 * flight/main.js — 小鸡开纸飞机：主模块（状态机 / 更新 / 渲染分离）
 *
 * 玩法一句话：小鸡驾着纸飞机在农场上空飞 30–90 秒，躲过被惊飞的农场生物，
 *   顺路发射羽毛把它们打下来；随时能暂停、随时能退出，退出不惩罚。
 *
 * 结构（抄 LittleJS 的「按能力分文件 + update/render 分离」，research §1.7）：
 *   main.js     —— 状态机 + 每帧推进 + 绘制编排 + 调试句柄
 *   controls.js —— 输入（移动与瞄准分离）
 *   levels.js   —— 农场层级 / 波次表（难度跟层级走，不跟分数走）
 *   enemies.js  —— 敌型 = 数据 + 行为函数
 *   collision.js—— 两段式碰撞（粗筛 + 精确）
 *   backdrop.js —— 三层视差背景
 *   flame.js    —— 尾焰（纯色小方块粒子）
 *   sfx.js      —— 音效（复用引擎 instruments.js，不新开 AudioContext）
 *   storage.js  —— 本地存档（读不到就不写，绝不抛异常）
 *   data.js     —— 机制参数 + 画风色板
 *
 * 引擎接入：**不新开 requestAnimationFrame**。引擎主循环是单条 rAF
 *   （src/coop.js 的 tick），小游戏把 update(dt) 挂进 window.__coopTick 数组，
 *   引擎每帧遍历调用（异常被引擎那边 try/catch 兜住）。
 */

import { FLIGHT, readPalette, mulberry32, hashStr, todayKey } from './data.js';
import { tierAt, routeDuration } from './levels.js';
import { ENEMY_TYPES, spawnEnemy } from './enemies.js';
import { hitPlane, hitFeathers } from './collision.js';
import { createBackdrop } from './backdrop.js';
import { createFlame } from './flame.js';
import { createControls } from './controls.js';
import { createSfx } from './sfx.js';
import { loadRecord, saveRecord, applyResult } from './storage.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * 造一局小游戏。
 * @param {{canvas:HTMLCanvasElement, reduced?:boolean}} opts
 * @returns {object} 调试句柄
 */
export function createFlight(opts) {
  const o = opts || {};
  const canvas = o.canvas;
  if (!canvas) throw new Error('createFlight: 少了一个 canvas');
  const g = canvas.getContext('2d');
  if (!g) throw new Error('createFlight: 这个 canvas 没有 2d 上下文');

  let P = readPalette();
  let W = 960, H = 640;
  let reduced = !!(o.reduced || prefersReduced());

  /* ---------- 运行时状态 ---------- */
  let state = 'ready';            // ready | playing | paused | over
  let frames = 0;
  let run = null;                 // 本局的账
  let obstacles = [];
  let feathers = [];
  let scroll = 0;                 // 世界滚动距离（背景与障碍共用）
  let shakeT = 0;
  let banner = null;              // { text, t }
  let api = null;                 // 引擎 tick 递过来的 api（音频链路）
  let rec = loadRecord(FLIGHT.storeKey);

  const plane = {
    x: 480, y: 400, heading: 0, speed: FLIGHT.world.baseSpeed,
    r: FLIGHT.plane.r, hitR: FLIGHT.plane.hitR,
  };

  const backdrop = createBackdrop();
  const flame = createFlame(FLIGHT.flame);
  const sfx = createSfx(() => (api && api.audio ? api.audio() : null));
  const controls = createControls(canvas, {
    isActive: () => state === 'playing' || state === 'paused',
    size: () => ({ w: W, h: H }),
  });

  /* ---------- 尺寸 ---------- */
  function resize() {
    /* 用 clientWidth（内容盒，不含边框）而不是 getBoundingClientRect（含边框）
       —— 否则画布自带边框时右边会少画 4px */
    const w = Math.max(320, Math.round(canvas.clientWidth || 960));
    const h = Math.max(240, Math.round(canvas.clientHeight || 640));
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    W = w; H = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    try { g.setTransform(dpr, 0, 0, dpr, 0, 0); } catch { /* 老浏览器 */ }
    backdrop.resize(W, H);
    clampPlane();
  }

  function clampPlane() {
    plane.x = clamp(plane.x, FLIGHT.plane.marginX, Math.max(FLIGHT.plane.marginX, W - FLIGHT.plane.marginX));
    plane.y = clamp(plane.y, FLIGHT.plane.marginTop, Math.max(FLIGHT.plane.marginTop, H - FLIGHT.plane.marginBottom));
  }

  /* ---------- 开局 / 结算 ---------- */
  function start() {
    const dayKey = todayKey();
    const seed = hashStr(dayKey + '|' + FLIGHT.seedSalt);
    run = {
      seed, dayKey,
      rng: mulberry32(seed),
      t: 0, path: 0, dodged: 0, tierIdx: -1, waveT: {},
      fireCd: 0, cleared: false,
    };
    obstacles = [];
    feathers = [];
    scroll = 0;
    banner = null;
    shakeT = 0;
    plane.x = W / 2;
    plane.y = H * 0.6;
    plane.heading = 0;
    plane.speed = FLIGHT.world.baseSpeed;
    reduced = prefersReduced();
    flame.clear();
    controls.reset();
    state = 'playing';
    sfx.start();
  }

  function score() {
    if (!run) return 0;
    return Math.floor(run.path / FLIGHT.score.perDistance) + run.dodged * FLIGHT.score.perDodge;
  }

  function bank(cleared, quit) {
    if (!run) return;
    try {
      rec = applyResult(rec, {
        score: score(),
        distance: run.path,
        dodged: run.dodged,
        cleared: !!cleared,
        dayKey: run.dayKey,
        quit: !!quit,
      });
      saveRecord(FLIGHT.storeKey, rec);
    } catch { /* 存档坏了也不能带塌游戏 */ }
  }

  /** 退出：不惩罚、不丢已收集的东西（streak 一个字都不动） */
  function quit() {
    if (state !== 'playing' && state !== 'paused') return;
    bank(false, true);
    state = 'ready';
    run = null;
    obstacles = [];
    feathers = [];
    banner = null;
    flame.clear();
  }

  function crash() {
    if (state !== 'playing') return;
    state = 'over';
    if (!reduced) shakeT = FLIGHT.shake.dur;   // reduced-motion：不开震动
    sfx.crash();
    bank(false, false);
  }

  function finishRoute() {
    if (state !== 'playing') return;
    run.cleared = true;
    state = 'over';
    sfx.tier();
    bank(true, false);
  }

  /* ---------- 每帧推进 ---------- */
  function step(dt) {
    const c = controls.read();

    /* Esc：进行中 → 暂停；暂停中再按一次 → 退出 */
    if (c.pause) {
      if (state === 'playing') state = 'paused';
      else if (state === 'paused') { quit(); return; }
    }
    if (c.quit && (state === 'playing' || state === 'paused')) { quit(); return; }

    if (state === 'ready') {
      idle(dt, true);
      if (c.fire || c.confirm) start();
      return;
    }
    if (state === 'over') {
      idle(dt, false);
      if (c.fire || c.confirm) start();
      return;
    }
    if (state === 'paused') return;   // 暂停：不推进

    /* ---- 飞行中 ---- */
    const W0 = FLIGHT.world;
    plane.heading = clamp(plane.heading + c.turn * W0.turnRate * dt, -W0.maxHeading, W0.maxHeading);
    if (c.thrust) plane.speed = Math.min(W0.maxSpeed, plane.speed + W0.accel * dt);
    else plane.speed = Math.max(W0.baseSpeed, plane.speed - W0.brake * dt);

    const tier = tierAt(run.t);
    const flow = tier.tier.flow;
    plane.x += Math.sin(plane.heading) * plane.speed * dt;
    plane.y -= (Math.cos(plane.heading) * plane.speed - flow) * dt;
    clampPlane();
    run.path += plane.speed * dt;
    run.t += dt;
    scroll += flow * dt;

    /* 层级推进（难度跟层级走，不跟分数走） */
    updateWaves(dt, tier);

    /* 发射羽毛 */
    if (c.fire) fireFeather(c.aim);
    if (run.fireCd > 0) run.fireCd = Math.max(0, run.fireCd - dt);

    /* 羽毛 */
    for (let i = feathers.length - 1; i >= 0; i--) {
      const f = feathers[i];
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.life -= dt;
      if (f.life <= 0 || f.x < -60 || f.x > W + 60 || f.y < -80 || f.y > H + 60) feathers.splice(i, 1);
    }

    /* 障碍 */
    const ectx = { W, H, flow, player: plane, rng: run.rng };
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const ob = obstacles[i];
      if (ob.dead) { obstacles.splice(i, 1); continue; }
      const T = ENEMY_TYPES[ob.type];
      if (T) { try { T.behave(ob, dt, ectx); } catch { /* 单只怪炸了不能带塌整局 */ } }
      if (ob.y > H + 70 || ob.y < -420 || ob.x < -260 || ob.x > W + 260) {
        obstacles.splice(i, 1);
        run.dodged++;
        sfx.dodge();
      }
    }

    /* 撞机（先判小鸡，再判羽毛 —— 小鸡自己撞上去就该结算，
       不能让自己刚射出的羽毛先把同一只障碍打掉） */
    if (hitPlane(plane, obstacles)) { crash(); return; }

    /* 羽毛打障碍 */
    const hit = hitFeathers(feathers, obstacles);
    if (hit) {
      hit.dead = true;
      run.dodged++;      // 打下来的也算「躲过去了」
      sfx.pop();
    }
    for (let i = feathers.length - 1; i >= 0; i--) {
      if (feathers[i].dead) feathers.splice(i, 1);
    }
    for (let i = obstacles.length - 1; i >= 0; i--) {
      if (obstacles[i].dead) obstacles.splice(i, 1);
    }

    /* 尾焰 */
    if (!reduced) {
      flame.emit(plane.x + Math.sin(plane.heading) * 12, plane.y - Math.cos(plane.heading) * 12, plane.heading, plane.speed);
    }
    flame.update(dt);

    /* 飞完全程 = 通关 */
    if (run.t >= routeDuration()) { finishRoute(); }
  }

  function updateWaves(dt, tier) {
    if (tier.index !== run.tierIdx) {
      run.tierIdx = tier.index;
      run.waveT = {};
      for (const w of tier.tier.waves) run.waveT[w.type] = w.first;
      banner = { text: tier.tier.name, t: 2.2 };
      sfx.tier();
    }
    for (const w of tier.tier.waves) {
      if (run.waveT[w.type] === undefined) run.waveT[w.type] = w.first;
      run.waveT[w.type] -= dt;
      if (run.waveT[w.type] <= 0) {
        run.waveT[w.type] += Math.max(0.3, w.every);
        spawnWave(w, tier);
      }
    }
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  }

  function spawnWave(w, tier) {
    const ectx = { W, H, flow: tier.tier.flow, player: plane, rng: run.rng, speedMul: w.speedMul || 1 };
    const e = spawnEnemy(w.type, run.rng, ectx);
    if (!e) return;
    obstacles.push(e);
    while (obstacles.length > FLIGHT.limits.maxObstacles) obstacles.shift();
  }

  function fireFeather(aim) {
    if (!run || run.fireCd > 0) return;
    run.fireCd = FLIGHT.feather.cooldown;
    let ang = plane.heading - Math.PI / 2;          // 键盘：沿机头方向
    if (aim) {
      const dx = aim.x - plane.x, dy = aim.y - plane.y;
      if (dx * dx + dy * dy > 64) ang = Math.atan2(dy, dx);   // 鼠标：鼠标指哪儿打哪儿
    }
    const sp = FLIGHT.feather.speed;
    feathers.push({
      x: plane.x, y: plane.y,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      r: FLIGHT.feather.r, angle: ang, life: FLIGHT.feather.life, dead: false,
    });
    while (feathers.length > FLIGHT.limits.maxFeathers) feathers.shift();
    sfx.fire();
  }

  /** 标题页：小鸡轻轻飘着（attract）；结算页：小鸡停在撞机的地方，尾焰慢慢熄 */
  function idle(dt, attract) {
    if (attract) {
      plane.x = W / 2 + Math.sin(frames * 0.02) * (W * 0.12);
      plane.y = H * 0.6 + Math.sin(frames * 0.031) * 10;
      plane.heading = Math.sin(frames * 0.017) * 0.35;
    }
    if (!reduced) {
      flame.emit(plane.x + Math.sin(plane.heading) * 12, plane.y - Math.cos(plane.heading) * 12, plane.heading, 120);
    }
    flame.update(dt);
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  }

  /* ---------- 绘制 ---------- */
  function render(dt) {
    g.save();
    if (shakeT > 0) {
      shakeT = Math.max(0, shakeT - dt);
      const amp = FLIGHT.shake.amp * (shakeT / FLIGHT.shake.dur);
      g.translate((Math.random() * 2 - 1) * amp, (Math.random() * 2 - 1) * amp);
    }
    backdrop.draw(g, P, scroll, plane.x);
    for (const ob of obstacles) {
      const T = ENEMY_TYPES[ob.type];
      if (T) { try { T.draw(g, ob, P); } catch { /* 画砸了不能带塌整局 */ } }
    }
    for (const f of feathers) drawFeather(g, f, P);
    flame.draw(g, P);
    drawPlane(g, P);
    g.restore();
    drawHud(g, P);
  }

  /** 纸飞机 + 小鸡（剪影单色：art-style.md §1「小鸡：剪影单色，不画细节」） */
  function drawPlane(g2, p) {
    g2.save();
    g2.translate(plane.x, plane.y);
    g2.rotate(plane.heading);
    g2.scale(1.25, 1.25);

    /* 纸飞机（米白 + 墨线折痕） */
    g2.beginPath();
    g2.moveTo(0, -20);
    g2.lineTo(-19, 15);
    g2.lineTo(0, 9);
    g2.lineTo(19, 15);
    g2.closePath();
    g2.fillStyle = p.paper;
    g2.fill();
    g2.lineWidth = 2;
    g2.strokeStyle = p.ink;
    g2.stroke();
    /* 折痕 */
    g2.beginPath();
    g2.moveTo(0, -20);
    g2.lineTo(0, 9);
    g2.moveTo(0, 9);
    g2.lineTo(-19, 15);
    g2.lineWidth = 1.5;
    g2.strokeStyle = p.ink;
    g2.stroke();

    /* 小鸡剪影（单色橙）坐在机身上。
       画法顺序很关键：**先描白、再描墨、最后填色** ——
       填色会把身子内部的分界线盖掉（不然头和身子之间会多出一道横线），
       外面留下 2px 墨边 + 2px 白分隔（色块之间白色描边分隔）。 */
    g2.save();
    g2.scale(0.72, 0.72);
    g2.translate(0, 1);
    g2.beginPath();
    /* 身子 + 头（一条闭合轮廓） */
    g2.moveTo(0, -17);
    g2.bezierCurveTo(5.5, -17, 7.5, -13, 6, -9.5);
    g2.bezierCurveTo(10, -6.5, 10, 1.5, 7, 5.5);
    g2.bezierCurveTo(3.5, 9.5, -3.5, 9.5, -7, 5.5);
    g2.bezierCurveTo(-10, 1.5, -10, -6.5, -6, -9.5);
    g2.bezierCurveTo(-7.5, -13, -5.5, -17, 0, -17);
    g2.closePath();
    /* 冠 */
    g2.moveTo(-3.6, -17.0); g2.lineTo(-2.2, -21.2); g2.lineTo(-0.6, -17.3); g2.closePath();
    g2.moveTo(-0.4, -17.5); g2.lineTo(1.0, -21.6); g2.lineTo(2.4, -17.4); g2.closePath();
    g2.moveTo(2.4, -17.0); g2.lineTo(3.8, -20.4); g2.lineTo(4.8, -16.6); g2.closePath();
    /* 喙 */
    g2.moveTo(4.6, -12.6); g2.lineTo(9.6, -15.4); g2.lineTo(5.6, -9.6); g2.closePath();
    /* 尾 */
    g2.moveTo(-6.2, 2.2); g2.lineTo(-13.6, 6.2); g2.lineTo(-5.2, 6.4); g2.closePath();
    g2.lineWidth = 8;
    g2.strokeStyle = p.white;
    g2.stroke();
    g2.lineWidth = 4;
    g2.strokeStyle = p.ink;
    g2.stroke();
    g2.fillStyle = p.orange;     // 单色剪影，不画细节
    g2.fill();
    g2.restore();
    g2.restore();
  }

  /** 羽毛（纯色高亮块 + 墨线） */
  function drawFeather(g2, f, p) {
    g2.save();
    g2.translate(f.x, f.y);
    g2.rotate(f.angle);
    g2.beginPath();
    g2.ellipse(0, 0, 9, 3.4, 0, 0, TAU, false);
    g2.fillStyle = p.yellow;
    g2.fill();
    g2.lineWidth = 2;
    g2.strokeStyle = p.ink;
    g2.stroke();
    g2.restore();
  }

  /* ---------- HUD / 浮层 ---------- */
  function text(g2, str, x, y, size, align) {
    g2.font = '600 ' + size + 'px "Alibaba PuHuiTi 3.0","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif';
    g2.textAlign = align || 'left';
    g2.textBaseline = 'top';
    g2.fillStyle = P.ink;          // 文字统一 --farm-ink
    g2.fillText(str, x, y);
  }

  function drawHud(g2, p) {
    const sc = run ? score() : 0;
    text(g2, '分数 ' + sc, 16, 14, 16);
    const tier = run ? tierAt(run.t) : null;
    if (tier) {
      text(g2, tier.tier.name + ' · 还剩 ' + Math.ceil(tier.left) + 's', W - 16, 14, 14, 'right');
      text(g2, '飞行 ' + Math.floor(run.path / 10) + 'm · 躲过 ' + run.dodged, 16, 36, 13);
      text(g2, '最高 ' + (rec.best | 0) + ' · 连庄 ' + (rec.streak | 0) + ' 天', W - 16, 36, 13, 'right');
    } else {
      text(g2, '最高 ' + (rec.best | 0) + ' · 连庄 ' + (rec.streak | 0) + ' 天', W - 16, 14, 13, 'right');
    }
    if (banner) {
      const a = banner.t;
      text(g2, banner.text, W / 2, 74, 22, 'center');
      if (a < 0.6) { /* 快没了就淡一点：直接画，不用半透明叠加 */ }
    }
    if (state === 'ready') card(g2, p, '小鸡开纸飞机', ['←→ 转向 · ↑ 加速', '鼠标点 / 空格 发射羽毛', 'Esc 暂停 · 再按退出', '按空格或点一下开始']);
    else if (state === 'paused') card(g2, p, '暂停中', ['Esc 继续', '再按一次 Esc 退出（不扣任何东西）']);
    else if (state === 'over') {
      const lines = run && run.cleared
        ? ['飞完全程 · 通关！', '本次 ' + score() + ' 分', '连庄 ' + (rec.streak | 0) + ' 天', '按空格再来一局']
        : ['撞上了……', '本次 ' + score() + ' 分', '最高 ' + (rec.best | 0) + ' 分', '按空格再来一局'];
      card(g2, p, run && run.cleared ? '通关' : '结束', lines);
    }
  }

  /** 居中的纸卡片（米白底 + 墨线边 + 白描边分隔） */
  function card(g2, p, title, lines) {
    const w = 320, h = 60 + lines.length * 24;
    const x = (W - w) / 2, y = (H - h) / 2;
    g2.beginPath();
    g2.rect(x, y, w, h);
    g2.fillStyle = p.paper;
    g2.fill();
    g2.lineWidth = 5;
    g2.strokeStyle = p.white;
    g2.stroke();
    g2.lineWidth = 2;
    g2.strokeStyle = p.ink;
    g2.stroke();
    text(g2, title, W / 2, y + 16, 20, 'center');
    for (let i = 0; i < lines.length; i++) {
      text(g2, lines[i], W / 2, y + 50 + i * 24, 14, 'center');
    }
  }

  /* ---------- 引擎 tick 接入 ---------- */
  function onTick(dt, t, tickApi) {
    frames++;
    if (tickApi) api = tickApi;
    const d = Math.max(0, Math.min(0.05, Number(dt) || 0));
    try {
      if (state === 'playing' || state === 'ready' || state === 'over') step(d);
      else step(d);          // paused：读输入（Esc 继续/退出），但不动玩法
    } catch (e) {
      /* 一帧炸了不能带塌引擎：下一帧继续 */
    }
    try { render(d); } catch (e) { /* 同上 */ }
  }

  const hooks = (window.__coopTick = window.__coopTick || []);
  hooks.push(onTick);

  /* ---------- 调试句柄（验收脚本靠它断言） ---------- */
  const handle = {
    version: 1,
    state: () => state,
    score: () => score(),
    objects: () => obstacles.map((o) => ({ type: o.type, x: Math.round(o.x), y: Math.round(o.y), r: o.r })),
    feathers: () => feathers.length,
    frames: () => frames,
    position: () => ({ x: Math.round(plane.x), y: Math.round(plane.y), heading: plane.heading, speed: Math.round(plane.speed) }),
    record: () => ({ best: rec.best | 0, streak: rec.streak | 0, lastDay: rec.lastDay, plays: rec.plays | 0 }),
    shakeAmt: () => (reduced ? 0 : shakeT),
    tier: () => (run ? { index: tierAt(run.t).index, name: tierAt(run.t).tier.name, t: run.t } : null),
    start: () => { start(); return state; },
    stop: () => { quit(); return state; },
    pause: () => { if (state === 'playing') state = 'paused'; return state; },
    resume: () => { if (state === 'paused') state = 'playing'; return state; },
    quit: () => { quit(); return state; },
    /** 验收用：把一只障碍直接放到小鸡身上，下一帧必定结算 */
    forceHit: () => {
      if (state !== 'playing' || !run) return false;
      feathers.length = 0;   // 清掉羽毛，免得它先把这只障碍打掉
      const tier = tierAt(run.t);
      const e = spawnEnemy('ladybug', run.rng, {
        W, H, flow: tier.tier.flow, player: plane, rng: run.rng, speedMul: 1,
      });
      if (!e) return false;
      e.x = plane.x; e.y = plane.y; e.baseY = plane.y; e.vx = 0;
      obstacles.push(e);
      return true;
    },
    setMuted: (m) => sfx.setMuted(m),
    destroy: () => {
      const i = hooks.indexOf(onTick);
      if (i >= 0) hooks.splice(i, 1);
      controls.destroy();
      state = 'ready';
    },
  };

  try { window.__flight = handle; } catch { /* 没有 window 就算了 */ }

  /* ---------- 启动 ---------- */
  resize();
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('resize', resize);
  }
  const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(resize) : null;
  if (ro) { try { ro.observe(canvas); } catch { /* 观察不了就算了 */ } }

  return handle;
}

/** 系统偏好：减少动态效果 */
function prefersReduced() {
  try {
    return !!(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch { return false; }
}

export default createFlight;
