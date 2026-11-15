/**
 * 起一个 headless 浏览器并接上 CDP —— 给体检脚本用。
 * 不依赖任何 npm 包（Node 18+ 自带 WebSocket 与 fetch）。
 *
 * 用法：
 *   const { startBrowser } = await import('./cdp-lib.mjs');
 *   const { send, evaluate, close } = await startBrowser({ port: 9400 });
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

export function findBrowser() {
  return BROWSERS.find((p) => existsSync(p)) || null;
}

/**
 * 起浏览器 + 连 CDP。
 * @returns {{ send:Function, evaluate:Function, close:Function, port:number }}
 */
export async function startBrowser({ port = 9400, extraArgs = [] } = {}) {
  const exe = findBrowser();
  if (!exe) throw new Error('本机找不到 Edge 或 Chrome');

  const profile = path.join(tmpdir(), `mj-cdp-${process.pid}`);
  mkdirSync(profile, { recursive: true });
  const child = spawn(exe, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    /* 压掉 Edge 的首次运行/同步提示（2026-11-15）：
       新建临时 profile 启动 Edge 会弹一个「同步确认」页（edge://sync-confirmation-dialog/），
       那是**浏览器级弹窗**，会把我们这个标签页挤成 hidden → 页面里的 rAF 被节流到 0 →
       鸡场整个冻住（引擎决策数 60 秒 +0）。
       加了这几个开关后实测：/json/list 里只剩我们自己的 page 目标，没有那个弹窗页。 */
    '--no-default-browser-check',
    '--disable-features=msEdgeFirstRunExperience,msEdgeSync,msSingleSignOn',
    '--disable-background-mode',
    '--disable-component-update',
    '--disable-sync',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    ...extraArgs,
    'about:blank',
  ], { stdio: 'ignore' });

  let page = null;
  for (let i = 0; i < 60 && !page; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await r.json();
      page = list.find((t) => t.type === 'page');
    } catch { /* 还没起来 */ }
    if (!page) await new Promise((s) => setTimeout(s, 500));
  }
  if (!page) {
    try { child.kill(); } catch { /* ignore */ }
    throw new Error('浏览器没起来');
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  const listeners = new Map();
  let seq = 0;
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    /* CDP 事件（如 Fetch.requestPaused）没有 id，走监听表 */
    if (m.method && listeners.has(m.method)) {
      for (const h of listeners.get(m.method)) h(m.params, m);
    }
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });

  /* 把页面拉回前台 + 关掉 Edge 自己弹的后台页（2026-11-15）。
     为什么必须：本机 Edge 启动时会弹一个「同步确认」的新页面
     （edge://sync-confirmation-dialog/），它抢走前台 → 我们这个标签页
     document.hidden 变成 true → 引擎的 visibilitychange 处理器把 rAF 循环停了
     → 鸡场整个冻住（决策数 +0）。现场：预览站上「引擎不动了」，
     查了半天是浏览器开的后台页，不是站点的锅。
     凡是「页面突然不动了」先查 document.hidden 和 /json/list 里的其他 page 目标。 */
  /** 把本页拉回前台（不等它回话，最多等 1.5 秒） */
  const front = () => {
    try {
      const id = ++seq;
      const p = new Promise((res) => { pending.set(id, res); ws.send(JSON.stringify({ id, method: 'Page.bringToFront', params: {} })); });
      return Promise.race([p, new Promise((r) => setTimeout(r, 1500))]);
    } catch { return Promise.resolve(); }
  };

  /** 把 Edge 自己弹出来的后台页（同步确认等）关掉 —— 它们会抢前台 */
  const closeStrayPages = async () => {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      for (const t of list) {
        if (t.type !== 'page') continue;
        if (t.id === page.id) continue;
        if (!/^(edge|chrome|about|devtools):/.test(t.url || '')) continue;
        try { await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`); } catch { /* 关不掉就算了 */ }
      }
    } catch { /* 没有就算了 */ }
  };

  await front();
  await closeStrayPages();
  /* 弹窗可能过一会儿才冒出来，再拉两次 */
  setTimeout(() => { front(); closeStrayPages(); }, 1200);
  setTimeout(() => { front(); closeStrayPages(); }, 3200);

  /** 订阅一个 CDP 事件，如 Fetch.requestPaused */
  const on = (method, handler) => {
    if (!listeners.has(method)) listeners.set(method, []);
    listeners.get(method).push(handler);
  };

  const send = (method, params = {}) => {
    const id = ++seq;
    const p = new Promise((res) => { pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
    /* 每次导航完都把页面拉回前台：Edge 的弹窗随时可能抢走前台，
       一旦我们这个标签页变 hidden，页面里的 rAF 就被节流到 0，什么都不动了。 */
    if (method === 'Page.navigate') return p.then((m) => { front(); return m; });
    return p;
  };

  const evaluate = async (expression) => {
    const m = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.text || 'evaluate 出错');
    return m.result?.result?.value;
  };

  const close = () => {
    try { ws.close(); } catch { /* ignore */ }
    try { child.kill(); } catch { /* ignore */ }
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  };

  return { send, evaluate, on, close, port };
}
