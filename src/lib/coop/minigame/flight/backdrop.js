/*!
 * flight/backdrop.js — 三层视差背景（远山 / 谷仓树 / 篱笆田垄）
 *
 * 抄 Nova Rift 的**结构**（research/minigame-opensource.md §1.4）：
 *   背景分三层、按不同速度平移。只抄结构，不抄皮：
 *   不用渐变天空、不用星场、不用 CRT 扫描线 —— 用 3 层纯色色块 + 白描边分层。
 *
 * 三层的景深与视差：
 *   远山 far   —— 视差 0（无限远，只随镜头横移一点点），站在地平线上
 *   谷仓树 mid —— 视差 0.42，从地平线下面进场，慢慢往下走
 *   篱笆田垄 near —— 视差 1.0（贴着地面走），压在最前面
 *
 * 层与层之间靠「白色描边」分隔（art-style.md §2），描边默认 --farm-ink 2px。
 */

/** 整数 → [0,1) 的稳定伪随机（同一行号永远同一个位置，不闪） */
function pseudo(i, k) {
  let h = Math.imul((i | 0) * 374761393 + (k | 0) * 668265263, 1274126177);
  h = (h ^ (h >>> 13)) >>> 0;
  return (h % 100000) / 100000;
}

const TAU = Math.PI * 2;

/**
 * 造一套背景。
 * @returns {{resize:(w:number,h:number)=>void, draw:(g:CanvasRenderingContext2D,P:object)=>void}}
 */
export function createBackdrop() {
  let W = 960, H = 640;
  let hz = Math.round(H * 0.26);   // 地平线
  let grain = null;                 // 纸底颗粒贴图（可平铺）
  let grainPat = null;              // 颗粒的 pattern（建一次，别每帧重建）

  /* 纸底颗粒：自绘一块可平铺的噪点（art-style.md §1：纸张颗粒做旧，opacity ≤ 0.08）。
     不引外部图片；噪点像素自带 alpha，所以画的时候不需要全局半透明叠加。 */
  function makeGrain() {
    try {
      const c = document.createElement('canvas');
      const size = 120;
      c.width = size; c.height = size;
      const gg = c.getContext('2d');
      if (!gg) return null;
      gg.clearRect(0, 0, size, size);
      for (let i = 0; i < 2600; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        gg.fillStyle = Math.random() < 0.25 ? 'rgba(43,33,24,0.08)' : 'rgba(43,33,24,0.04)';
        gg.fillRect(x, y, 1, 1);
      }
      return c;
    } catch { return null; }
  }

  function resize(w, h) {
    W = Math.max(320, w | 0);
    H = Math.max(240, h | 0);
    hz = Math.round(H * 0.26);
    grain = makeGrain();
    grainPat = null;   // pattern 得在新的 2d 上下文上建，resize 后重做
  }

  /* ---------- 远山 ---------- */
  function drawFar(g, P, camX) {
    const off = ((camX * 0.05) % 280 + 280) % 280;
    for (let x = -280 - off; x < W + 280; x += 280) {
      const peak = 62 + pseudo(Math.round(x / 280), 9) * 34;
      g.beginPath();
      g.moveTo(x, hz);
      g.lineTo(x + 140, hz - peak);
      g.lineTo(x + 280, hz);
      g.closePath();
      g.fillStyle = P.green;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = P.ink;
      g.stroke();
    }
  }

  /* ---------- 谷仓（米白墙 + 橙屋顶） ---------- */
  function drawBarn(g, P, x, y) {
    const w = 74, h = 50;
    /* 墙 */
    g.beginPath();
    g.rect(x - w / 2, y - h, w, h);
    g.fillStyle = P.paper;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = P.ink;
    g.stroke();
    /* 屋顶：先填色，再垫白线（分隔色块），最后描墨线 */
    g.beginPath();
    g.moveTo(x - w / 2 - 8, y - h);
    g.lineTo(x, y - h - 34);
    g.lineTo(x + w / 2 + 8, y - h);
    g.closePath();
    g.fillStyle = P.orange;
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = P.white;
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = P.ink;
    g.stroke();
    /* 门 */
    g.beginPath();
    g.rect(x - 13, y - 30, 26, 30);
    g.fillStyle = P.ink;
    g.fill();
  }

  /* ---------- 树 ---------- */
  function drawTree(g, P, x, y) {
    g.beginPath();
    g.rect(x - 4, y - 18, 8, 18);
    g.fillStyle = P.ink;
    g.fill();
    g.beginPath();
    g.ellipse(x, y - 32, 25, 23, 0, 0, TAU, false);
    g.fillStyle = P.green;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = P.ink;
    g.stroke();
  }

  /* ---------- 中景：谷仓 + 树（视差 0.42） ---------- */
  function drawMid(g, P, scroll) {
    const SP = 300;
    const s = scroll * 0.42;
    const i0 = Math.ceil((s - H - 80) / SP);
    const i1 = Math.floor((s - hz) / SP);
    for (let i = i0; i <= i1; i++) {
      const y = hz + (s - i * SP);
      if (y < hz - 10 || y > H + 90) continue;
      const bx = -70 + pseudo(i, 0) * Math.max(60, W * 0.42);
      const tx = W * 0.55 + pseudo(i, 1) * Math.max(60, W * 0.42);
      drawBarn(g, P, bx, y);
      drawTree(g, P, tx, y);
    }
  }

  /* ---------- 近景：篱笆 + 草皮块（视差 1.0） ---------- */
  function drawNear(g, P, scroll) {
    const SP = 168;
    const s = scroll;
    const i0 = Math.ceil((s - H - 120) / SP);
    const i1 = Math.floor((s - hz) / SP);
    for (let i = i0; i <= i1; i++) {
      const y = hz + (s - i * SP);
      if (y < hz - 10 || y > H + 120) continue;
      /* 草皮块（绿） */
      const px = pseudo(i, 3) * (W + 160) - 80;
      g.beginPath();
      g.ellipse(px, y - 46, 74, 15, 0, 0, TAU, false);
      g.fillStyle = P.green;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = P.ink;
      g.stroke();
      /* 篱笆横杆（米白长条 + 墨线） */
      g.beginPath();
      g.rect(0, y - 20, W, 10);
      g.fillStyle = P.paper;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = P.ink;
      g.stroke();
      /* 立柱 */
      for (let x = 24 + pseudo(i, 4) * 40; x < W; x += 96) {
        g.beginPath();
        g.rect(x - 5, y - 42, 10, 42);
        g.fillStyle = P.paper;
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = P.ink;
        g.stroke();
      }
    }
  }

  /**
   * 画背景。
   * @param {CanvasRenderingContext2D} g
   * @param {object} P 色板
   * @param {number} scroll 世界滚动距离
   * @param {number} camX 镜头横向位移（用来做远山的横向视差）
   */
  function draw(g, P, scroll, camX) {
    /* 纸底 */
    g.fillStyle = P.paper;
    g.fillRect(0, 0, W, H);
    /* 纸底颗粒 */
    if (grain) {
      try {
        if (!grainPat) grainPat = g.createPattern(grain, 'repeat');
        if (grainPat) { g.fillStyle = grainPat; g.fillRect(0, 0, W, H); }
      } catch { /* 颗粒画不出来就算了，纸底还在 */ }
    }
    /* 地平线：白色描边把天空和地分开 */
    g.beginPath();
    g.moveTo(0, hz + 0.5);
    g.lineTo(W, hz + 0.5);
    g.lineWidth = 3;
    g.strokeStyle = P.white;
    g.stroke();
    drawFar(g, P, camX || 0);
    drawMid(g, P, scroll || 0);
    drawNear(g, P, scroll || 0);
  }

  return { resize, draw };
}
