#!/usr/bin/env node
/**
 * 徽标体检：Mimi 面板标题旁那个字，该显示「在线」还是「演示」。
 *
 * 规则（2026-11-14 定）：真模型答了写「在线」；走了本地模板 / 上游限流降级 /
 * 这轮失败，都退回「演示」。别让访客以为真模型的回答是假的，也别假装还在线。
 *
 * 用法：
 *   node scripts/audit-badge.mjs                    # 用假的 /api/chat 模拟两种来路
 *   node scripts/audit-badge.mjs --live             # 直接问线上真模型，看实际结果
 *   node scripts/audit-badge.mjs --live <url>       # 指定站
 *
 * 假模式会拦下 /api/chat，分别喂「SSE 正常流」和「502」，所以不需要任何 API key。
 * 退出码：0 = 符合预期；1 = 不符合；2 = 环境不可用。
 */
import { startBrowser } from './cdp-lib.mjs';

const args = process.argv.slice(2);
const live = args.includes('--live');
const url = args.find((a) => !a.startsWith('--')) || 'https://mujing-universe.pages.dev/';
const PORT = 9500 + (process.pid % 200);

let mode = 'ok';
let cdp;
try {
  cdp = await startBrowser({ port: PORT });
} catch (err) {
  console.error(`起不来浏览器：${err.message}`);
  process.exit(2);
}
const { send, evaluate, on, close } = cdp;

/* 假模式：拦下 /api/chat，按 mode 喂不同的响应 */
if (!live) {
  on('Fetch.requestPaused', async ({ requestId }) => {
    if (mode === 'ok') {
      const sse = 'data: {"delta":"我是真模型的回答"}\n\ndata: {"done":true}\n\ndata: [DONE]\n\n';
      await send('Fetch.fulfillRequest', {
        requestId,
        responseCode: 200,
        responseHeaders: [
          { name: 'content-type', value: 'text/event-stream; charset=utf-8' },
          { name: 'cache-control', value: 'no-cache' },
        ],
        body: Buffer.from(sse, 'utf8').toString('base64'),
      });
    } else {
      await send('Fetch.fulfillRequest', {
        requestId,
        responseCode: 502,
        responseHeaders: [{ name: 'content-type', value: 'application/json' }],
        body: Buffer.from('{"error":"upstream"}', 'utf8').toString('base64'),
      });
    }
  });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/chat*' }] });
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

async function askOnce(m, label) {
  mode = m;
  await send('Page.navigate', { url });
  await new Promise((s) => setTimeout(s, 7000));
  const before = await evaluate(`document.querySelector('.mimi-demo')?.textContent ?? '(none)'`);
  await evaluate(`(() => {
    document.querySelector('.mimi-launch')?.click();
    const inp = document.querySelector('.mimi-input');
    inp.value = '测试一下徽标';
    document.querySelector('.mimi-form')?.requestSubmit();
    return true;
  })()`);
  await new Promise((s) => setTimeout(s, live ? 12000 : 4000));
  const after = await evaluate(`document.querySelector('.mimi-demo')?.textContent ?? '(none)'`);
  const note = await evaluate(`document.querySelector('.mimi-note')?.textContent ?? '(no note)'`);
  const last = await evaluate(`(() => { const b=[...document.querySelectorAll('.mimi-msg.bot p')]; return b.length ? b[b.length-1].textContent.trim().slice(0,40) : '(no msg)'; })()`);
  console.log(`[${label}] 徽标：问之前="${before}" → 问之后="${after}" | 备注=${note} | 最后一条="${last}"`);
  return { before, after };
}

if (live) {
  const r = await askOnce('live', '线上真模型');
  console.log(`实际徽标 = "${r.after}"（线上要的是「在线」，上游挂了时是「演示」）`);
  close();
  process.exit(0);
}

const a = await askOnce('ok', '真模型回答');
const b = await askOnce('fail', '上游 502');
const pass = a.after === '在线' && b.after === '演示';
console.log(pass ? '✓ 通过：真模型→在线，上游挂了→演示' : '✗ 不符合预期');
close();
process.exit(pass ? 0 : 1);
