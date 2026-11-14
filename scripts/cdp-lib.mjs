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

  /** 订阅一个 CDP 事件，如 Fetch.requestPaused */
  const on = (method, handler) => {
    if (!listeners.has(method)) listeners.set(method, []);
    listeners.get(method).push(handler);
  };

  const send = (method, params = {}) => {
    const id = ++seq;
    return new Promise((res) => { pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
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
