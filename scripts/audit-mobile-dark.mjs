#!/usr/bin/env node
/**
 * 移动端 + 暗色模式体检：量 Mimi 面板的可读性与遮挡。
 *
 * 为什么要有这个：暗色模式的问题**看截图看不出来** —— 截图只能看出「暗」，
 * 看不出「读不出来」。2026-11-14 就是靠这里量出 chips 文字对比度只有 1.03
 * （深色压深色，等于隐形），而浅色模式一切正常。
 *
 * 用法：
 *   node scripts/audit-mobile-dark.mjs                       # 体检线上站
 *   node scripts/audit-mobile-dark.mjs http://127.0.0.1:4471/ # 体检本地 preview
 *   node scripts/audit-mobile-dark.mjs <url> --shot out.png   # 顺便截一张图
 *
 * 需要本机有 Edge 或 Chrome（headless + CDP）。脚本自己起浏览器、用完关掉，
 * 不依赖任何 npm 包（Node 18+ 自带 WebSocket）。
 *
 * 退出码：0 = 没问题；1 = 有低对比度元素或按钮被挡；2 = 环境不可用。
 */
import { writeFileSync } from 'node:fs';
import { startBrowser } from './cdp-lib.mjs';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--')) || 'https://mujing-universe.pages.dev/';
const shotIdx = args.indexOf('--shot');
const shotPath = shotIdx >= 0 ? args[shotIdx + 1] : null;
const W = 390;
const H = 844;
const PORT = 9300 + (process.pid % 200);

let cdp;
try {
  cdp = await startBrowser({ port: PORT });
} catch (err) {
  console.error(`体检不了：${err.message}`);
  process.exit(2);
}
const { send, evaluate, close } = cdp;

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await send('Page.navigate', { url });
  await new Promise((s) => setTimeout(s, 8000));
  /* 打开 Mimi 面板 —— 遮挡只有面板打开时才存在（头像压在 CTA 按钮上） */
  await evaluate(`document.querySelector('.mimi-launch')?.click()`);
  await new Promise((s) => setTimeout(s, 1500));

  const expr = `(() => {
  const lum = (c) => {
    const m = c.match(/[\\d.]+/g);
    if (!m) return null;
    const [r, g, b] = m.map(Number);
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    if (l1 === null || l2 === null) return null;
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
  };
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      const m = cs.backgroundColor.match(/[\\d.]+/g);
      if (m && (m.length < 4 || Number(m[3]) > 0.5)) return cs.backgroundColor;
      n = n.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  const panel = document.querySelector('.mimi-panel');
  const lowContrast = [];
  if (panel) {
    panel.querySelectorAll('*').forEach((el) => {
      const txt = (el.textContent || '').trim();
      if (!txt || el.children.length > 0) return;
      const cs = getComputedStyle(el);
      const r = ratio(cs.color, bgOf(el));
      if (r !== null && r < 2.2) {
        lowContrast.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 40), text: txt.slice(0, 18), color: cs.color, bg: bgOf(el), ratio: r });
      }
    });
  }
  const launch = document.querySelector('.mimi-launch');
  let launchCtaOverlap = [];
  if (launch && panel) {
    const lcs = getComputedStyle(launch);
    const visible = lcs.visibility !== 'hidden' && Number(lcs.opacity) > 0.05 && lcs.pointerEvents !== 'none';
    const lr = launch.getBoundingClientRect();
    launchCtaOverlap = [...document.querySelectorAll('.mimi-cta button')].map((b) => {
      const r = b.getBoundingClientRect();
      const w = Math.min(lr.right, r.right) - Math.max(lr.left, r.left);
      const h = Math.min(lr.bottom, r.bottom) - Math.max(lr.top, r.top);
      const overlap = w > 0 && h > 0 ? Math.round(w * h) : 0;
      return { label: b.textContent.trim(), overlap, blocksClick: visible && overlap > 0 };
    });
  }
  return JSON.stringify({
    url: location.href,
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    docScrollW: document.documentElement.scrollWidth,
    theme: document.documentElement.className,
    panelOpen: !!document.querySelector('.mimi')?.classList.contains('is-open'),
    lowContrast,
    launchCtaOverlap,
  }, null, 2);
})()`;
  const report = JSON.parse(await evaluate(expr));

  if (shotPath) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot.result?.data) {
      writeFileSync(shotPath, Buffer.from(shot.result.data, 'base64'));
      console.log(`截图 → ${shotPath}`);
    }
  }

  console.log(JSON.stringify(report, null, 2));
  const blocking = report.lowContrast.length || report.launchCtaOverlap.some((c) => c.blocksClick);
  console.log(blocking
    ? '✗ 有问题：低对比度元素或被挡住的按钮（见上）'
    : '✓ 通过：没有低对比度元素，按钮也没被挡');
  close();
  process.exit(blocking ? 1 : 0);
} catch (err) {
  console.error(`体检失败：${err.message}`);
  close();
  process.exit(2);
}
