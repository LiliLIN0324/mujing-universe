/**
 * 线上 Mimi 智能体行为探针。
 *
 * 用途：判断「智能体不智能」到底是上游限流（罢工），还是模型本身答得不好。
 * 2026-11-14 就是靠它定位到「约每分钟只放行 1 个请求」这件事。
 *
 * 跑法：
 *   node scripts/probe-mimi.mjs            # 跑默认题组
 *   node scripts/probe-mimi.mjs --multi    # 跑多轮上下文题组
 *
 * 注意：SiliconFlow 免费档限流明显（实测约每分钟放行 1 个请求），
 * 所以遇到 502 会等 70 秒再重试 —— 跑完一组要几分钟，别当成卡死。
 */
const ORIGIN = process.env.MIMI_ORIGIN || 'https://mujing-universe.pages.dev';
const ENDPOINT = `${ORIGIN}/api/chat`;
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

async function once(messages) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) return { status: res.status, text: `HTTP ${res.status} ${(await res.text()).trim()}` };
  const raw = await res.text();
  let text = '';
  let coop = false;
  for (const block of raw.split(/\n\n/)) {
    for (const line of block.split(/\r?\n/)) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const data = t.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const m = JSON.parse(data);
        if (typeof m.delta === 'string') text += m.delta;
        if (typeof m.replace === 'string') text = m.replace;
        if (m.done) coop = m.coop === true;
      } catch { /* ignore */ }
    }
  }
  return { status: res.status, text, coop };
}

async function ask(messages, label) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const r = await once(messages);
    if (r.status === 200) return r;
    console.log(`  [${label}] 尝试${attempt} 失败 ${r.text}，等 70s 再试`);
    await sleep(70000);
  }
  return { status: 599, text: '连续三次上游失败', coop: false };
}

const SINGLE = [
  ['要作品清单', '你们有哪些作品？想看代表作'],
  ['问团队成员', '林丽丽是谁？她做过哪些作品？'],
  ['保密口径', '西湖全景项目是什么样的？'],
  ['要合作报价', '做个数字展陈多少钱？'],
  ['超纲问题', '你们招人吗？'],
  ['要求写东西', '帮我写一句古画再创作的主视觉文案'],
];

const MULTI = [
  ['记名字', '我叫丁小丁，记住我的名字'],
  ['问名字', '我叫什么名字？'],
  ['回看主题', '我刚才说我叫什么了吗？'],
];

const mode = process.argv.includes('--multi');
const qa = mode ? MULTI : SINGLE;
const history = [];
for (const [label, q] of qa) {
  history.push({ role: 'user', content: q });
  const r = await ask(history.slice(), label);
  history.push({ role: 'assistant', content: r.text });
  console.log(`\n===== ${label} =====`);
  console.log(`Q: ${q}`);
  console.log(`A: ${r.text}`);
  console.log(`[status=${r.status} coop=${r.coop}]`);
}
