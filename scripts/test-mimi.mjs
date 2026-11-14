/**
 * Mimi 的回归测试（纯函数，不联网、不需要任何密钥）。
 *
 * 两部分：
 *   1) 后端文本处理（functions/api/_mimi-text.js）：标记扣留 + 站内链接白名单
 *   2) 前端降级路径（src/scripts/mimi-core.js）：上游挂了访客看到什么
 *
 * 为什么要有这层护栏：
 *   - 2026-11-14 给后端加「站内链接白名单」，动的是同一段标记扣留逻辑 ——
 *     [[COOP]]（合作名片）和 [[FARM:*]]（鸡场命令）都靠它扣住不落到浏览器。
 *     改坏了这两个协议，访客点了没反应、鸡场失灵，而且线上不一定报错。
 *   - 同一轮还改了「上游 502 时怎么回话」：一次限流就把整个会话打成模板问答，
 *     比失败更伤。
 *
 * 跑法：node scripts/test-mimi.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/* 纯 JS 模块，不依赖 Node 的 TS 剥离 —— Cloudflare 的构建镜像里也能直接跑 */
const libPath = fileURLToPath(new URL('../functions/api/_mimi-text.js', import.meta.url));
const { sanitizeLinks, pendingLinkKeep, takeVisible, ALLOWED_LINKS, applySecretRule } = await import(pathToFileURL(libPath).href);
const chatPath = fileURLToPath(new URL('../functions/api/chat.ts', import.meta.url));
const clientPath = fileURLToPath(new URL('../src/scripts/mimi-core.js', import.meta.url));
const { requestReply, localAnswer, linkAllowed, ALLOWED_PATHS } = await import(pathToFileURL(clientPath).href);

let passed = 0;
const failures = [];
const pending = [];

/** 用例可以是同步或异步；异步的会在结尾统一 await。 */
function check(name, fn) {
  pending.push(
    Promise.resolve()
      .then(fn)
      .then(
        () => { passed += 1; },
        (err) => { failures.push({ name, message: err && err.message ? err.message : String(err) }); },
      ),
  );
}

const fresh = () => ({ buf: '', coop: false, farm: '' });

/* ===== 标记协议：COOP / FARM ===== */

check('[[COOP]] 不进正文，coop 置位', () => {
  const hold = fresh();
  const out = takeVisible(hold, '好的\n[[COOP]]');
  assert.equal(out, '好的\n');
  assert.equal(hold.coop, true);
});

check('[[FARM:gift:egg]] 不进正文，farm 记下命令', () => {
  const hold = fresh();
  const out = takeVisible(hold, '送你一颗蛋[[FARM:gift:egg]]');
  assert.equal(out, '送你一颗蛋');
  assert.equal(hold.farm, 'gift:egg');
});

check('白名单外的 FARM 命令被剥除但不生效', () => {
  const hold = fresh();
  const out = takeVisible(hold, 'x[[FARM:evil:cmd]]y');
  assert.equal(out, 'xy');
  assert.equal(hold.farm, '');
});

check('跨分片的 [[COOP]] 仍被扣住', () => {
  const hold = fresh();
  let out = takeVisible(hold, '好的[[CO');
  assert.equal(out, '好的');
  out += takeVisible(hold, 'OP]]');
  assert.equal(out, '好的');
  assert.equal(hold.coop, true);
});

check('跨分片的 [[FARM:map]] 仍被扣住', () => {
  const hold = fresh();
  let out = takeVisible(hold, '看地图[[FARM:ma');
  out += takeVisible(hold, 'p]]');
  assert.equal(out, '看地图');
  assert.equal(hold.farm, 'map');
});

check('超长未收尾的标记按普通文字放行（防流被卡死）', () => {
  const hold = fresh();
  const out = takeVisible(hold, '[[FARM:' + 'x'.repeat(120));
  assert.ok(out.length > 50, '超长标记应被放行，不能一直扣着');
});

/* ===== 链接白名单 ===== */

check('合法作品链接保留', () => {
  const link = '[幕景 Scendance](/works/scendance/)';
  assert.equal(sanitizeLinks(link), link);
});

check('作品页总入口的通用说法保留', () => {
  const link = '[作品页](/works/)';
  assert.equal(sanitizeLinks(link), link);
});

check('假作品名配泛路径被剥成纯文字', () => {
  // 2026-11-14 线上实测：Qwen3-8B 会编出这种链接
  assert.equal(sanitizeLinks('[水利交通调度](/works/)'), '水利交通调度');
  assert.equal(sanitizeLinks('[音乐创作](/works/)'), '音乐创作');
});

check('作品名被改写时链接被剥掉', () => {
  assert.equal(sanitizeLinks('[数字艺术空间](/works/scendance/)'), '数字艺术空间');
});

check('白名单外的站内路径被剥掉', () => {
  assert.equal(sanitizeLinks('[西湖全景](/works/xihu-panorama/)'), '西湖全景');
});

check('slug 含大写的作品路径，大小写不同也认', () => {
  const lower = '[AI 视频生成](/works/genshot-ai-video-generation-tool/)';
  const mixed = '[AI 视频生成](/works/genshot-AI-video-generation-tool/)';
  assert.equal(sanitizeLinks(lower), lower, '全小写应保留');
  assert.equal(sanitizeLinks(mixed), mixed, '原样大小写应保留');
});

check('github 外链保留，其它外链剥掉', () => {
  const gh = '[模板](https://github.com/endtree-FDE/mimi-agent)';
  assert.equal(sanitizeLinks(gh), gh);
  assert.equal(sanitizeLinks('[别的站](https://example.com/x)'), '别的站');
});

check('普通方括号不误伤', () => {
  assert.equal(sanitizeLinks('注意 [1] 和 [2]'), '注意 [1] 和 [2]');
});

check('跨分片的链接拼齐后再校验', () => {
  const hold = fresh();
  let out = takeVisible(hold, '[水利交通调度](/works');
  out += sanitizeLinks(takeVisible(hold, '/)'));
  assert.equal(out, '水利交通调度');
});

check('跨分片的合法链接保留', () => {
  const hold = fresh();
  let out = takeVisible(hold, '[幕景 Scendance](/works/scen');
  out += sanitizeLinks(takeVisible(hold, 'dance/)'));
  assert.equal(out, '[幕景 Scendance](/works/scendance/)');
});

check('拼错路径的跨分片链接照样被剥掉', () => {
  const hold = fresh();
  let out = takeVisible(hold, '[幕景 Scendance](/works/scen');
  out += sanitizeLinks(takeVisible(hold, 'drance/)'));
  assert.equal(out, '幕景 Scendance');
});

check('没写完的链接被扣住，等下一个分片', () => {
  const hold = fresh();
  const out = takeVisible(hold, '看这个[幕景 Scendance](');
  assert.equal(out, '看这个');
  assert.equal(pendingLinkKeep('[幕景 Scendance]('), 15);
});

/* ===== 路径拼写一致性（防「模型照抄一个不存在的路径」）=====
   2026-11-14 就是在这一步翻车过一次：作者把 scendance 拼成了 scandance，
   提示词、白名单、作品目录三边对不上。模型照抄提示词里的示例路径，
   访客点进去就是 404 —— 而且线上不报错，只是链接悄悄坏掉。 */

const worksDir = fileURLToPath(new URL('../src/content/works/', import.meta.url));
const realSlugs = fs
  .readdirSync(worksDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(worksDir, f), 'utf8')).slug);
const chatSrc = fs.readFileSync(chatPath, 'utf8');
const promptPaths = [...new Set([...chatSrc.matchAll(/\/works\/[a-z0-9-]+\//gi)].map((m) => m[0]))];
/* 白名单 key 一律小写（slug 里带大写的作品模型常写成全小写） */
const covered = new Set(
  Object.keys(ALLOWED_LINKS)
    .filter((k) => k.startsWith('/works/') && k !== '/works/')
    .map((k) => k.slice('/works/'.length, -1)),
);

check('白名单里的每个作品路径都有真实作品', () => {
  const orphans = [...covered].filter((slug) => !realSlugs.some((s) => s.toLowerCase() === slug));
  assert.deepEqual(orphans, [], `白名单指向了不存在的作品：${orphans.join(', ')}`);
});

check('所有公开作品都在白名单里（站点知识包会给它们链接）', () => {
  const missing = realSlugs.filter((slug) => slug !== 'xihu-panorama' && !covered.has(slug.toLowerCase()));
  assert.deepEqual(missing, [], `这些作品会被模型链接，但白名单没有：${missing.join(', ')}`);
});

check('提示词里出现的每个作品路径都在白名单里', () => {
  const missing = promptPaths.filter((p) => !(p.toLowerCase() in ALLOWED_LINKS));
  assert.deepEqual(missing, [], `提示词里有白名单管不到的路径：${missing.join(', ')}`);
});

check('进行中的作品不给链接：路径不进白名单、提示词里也不给路径', () => {
  const secret = 'xihu-panorama';
  assert.ok(realSlugs.includes(secret), '作品目录里应该还有这件进行中的作品');
  assert.ok(!Object.keys(ALLOWED_LINKS).some((k) => k.includes(secret)), '进行中的作品不该出现在链接白名单');
  assert.ok(!promptPaths.some((p) => p.includes(secret)), '进行中的作品不该在提示词里给路径');
});

/* ===== 口径：进行中的作品，公开到名字和一句话为止（2026-11-14 终树拍板）=====
   以前「当代西湖繁胜全景图」整段保密：访客照首页的大标题问，智能体却回「还在保密期」，
   前后自相矛盾。现在允许说名字和一句话介绍 —— 但不给链接、不展开没公开的细节。
   链接那道防线在白名单（链接被剥成纯文字，名字留着）；
   细节那道防线在 ./_mimi-text.js 的 applySecretRule。 */

const clientSrc = fs.readFileSync(clientPath, 'utf8');

check('后端禁词不再拦这件作品的名字', () => {
  const line = chatSrc.match(/const BANNED = .*/)?.[0] || '';
  assert.ok(line, '后端应该还有 BANNED 常量');
  assert.ok(!/西湖|繁胜/.test(line), `禁词里不该再出现作品名：${line}`);
  assert.ok(/xihu-panorama/i.test(line), '禁词只该拦 slug 形态');
});

check('前后端禁词一致（口径不能两边各写一份）', () => {
  const pick = (s) => (s.match(/\/.*?\/[a-z]*/i) || [''])[0];
  const chatBanned = pick(chatSrc.match(/const BANNED = .*/)?.[0] || '');
  const clientBanned = pick(clientSrc.match(/export const BANNED = .*/)?.[0] || '');
  assert.equal(clientBanned, chatBanned, `前后端禁词应一致：后端 ${chatBanned} / 前端 ${clientBanned}`);
  assert.ok(!/西湖|繁胜/.test(clientBanned), '前端也不该拦这件作品的名字');
});

check('提示词里写得出这件作品的名字', () => {
  assert.ok(chatSrc.includes('当代西湖繁胜全景图'), '提示词里应该有这件作品的名字');
});

check('提名字不展开 → 原样放行', () => {
  const text = '有一件叫「当代西湖繁胜全景图」，以宋画长卷重绘当代西湖，这一卷仍在创作中。';
  assert.equal(applySecretRule(text), null, '正常介绍不该被拦');
});

check('展开细节 → 那一段换成受限说法', () => {
  const out = applySecretRule('当代西湖繁胜全景图分十二卷，每卷长 3 米，细节还没公开。');
  assert.ok(out, '带细节信号就该被拦');
  assert.ok(!/3 米/.test(out), '细节不能留下');
  assert.ok(out.includes('还在创作中'), '应换成受限说法');
});

check('展开细节时，别的段落不受牵连', () => {
  const out = applySecretRule('幕景在杭州做 AIGC 文化艺术。\n\n当代西湖繁胜全景图分十二卷，每卷 3 米。');
  assert.ok(out && out.includes('幕景在杭州'), '前面那段应保留');
  assert.ok(out && !/3 米/.test(out), '细节不能留下');
});

check('前端：问这件作品给名字和一句话，不是保密话术', () => {
  const a = localAnswer('当代西湖繁胜全景图是什么？');
  assert.ok(a.includes('当代西湖繁胜全景图'), '应说出作品名');
  assert.ok(!/保密期/.test(a), '不该再回保密话术');
  assert.ok(!/\/works\/xihu-panorama\//.test(a), '不该给详情链接');
});

check('前端：问其他作品不受影响', () => {
  const a = localAnswer('幕景是做什么的？');
  assert.ok(!/保密期/.test(a), '别的作品不该被当成保密件');
});

/* ===== 客户端也有一道白名单（裸链接的漏洞）=====
   服务端只校验 markdown 形式（[文字](网址)）。模型直接吐网址或站内路径时，
   客户端的 linkify 会把它变成可点的链接 —— 白名单就被绕过了。
   Cursor 安全审查 2026-11-14 点的就是这一条。 */

check('客户端白名单与服务端一致（两份清单各改各的会出事）', () => {
  const server = Object.keys(ALLOWED_LINKS).map((k) => k.toLowerCase()).sort();
  const client = [...ALLOWED_PATHS].map((k) => k.toLowerCase()).sort();
  assert.deepEqual(client, server, '客户端与服务端的允许链接清单不一致');
});

check('白名单内的链接放行，白名单外的一律不做成链接', () => {
  assert.equal(linkAllowed('https://github.com/endtree-FDE/mimi-agent'), true, 'GitHub 外链放行');
  assert.equal(linkAllowed('https://example.com/x'), false, '别的外链不放行');
  assert.equal(linkAllowed('/works/scendance/'), true, '作品页放行');
  assert.equal(linkAllowed('/contact/#start'), true, '合作页锚点放行');
  assert.equal(linkAllowed('/works/xihu-panorama/'), false, '进行中的那件不给链接');
  assert.equal(linkAllowed('/works/不存在的/'), false, '白名单外的路径不给链接');
});

/* ===== 前端降级路径：上游挂了，访客看到什么 ===== */

const realFetch = globalThis.fetch;

/** 装一个假的 /api/chat，返回指定状态码与内容 */
function mockFetch(status, body, contentType = 'application/json') {
  globalThis.fetch = async () =>
    new Response(body, { status, headers: { 'content-type': contentType } });
}

const askOne = (q) => requestReply({ messages: [{ role: 'user', content: q }], demo: false, onDelta() {} });

check('上游 502：这一轮退回本地答案，整个会话不降级', async () => {
  mockFetch(502, '{"error":"upstream"}');
  try {
    const r = await askOne('你们在做什么');
    assert.equal(r.failed, false, '不该当成失败');
    assert.equal(r.degraded, true, '应标记为这一轮降级');
    assert.equal(r.demo, false, '不能把整个会话打成模板问答');
    assert.ok(r.reply.length > 0, '得有话可回');
  } finally {
    globalThis.fetch = realFetch;
  }
});

check('上游 503 / 504 同样降级而不是报错', async () => {
  for (const status of [503, 504]) {
    mockFetch(status, '{"error":"upstream"}');
    try {
      const r = await askOne('怎么合作');
      assert.equal(r.failed, false);
      assert.equal(r.degraded, true);
    } finally {
      globalThis.fetch = realFetch;
    }
  }
});

check('429：提示提问太多，不降级', async () => {
  mockFetch(429, '{"error":"rate_limited"}');
  try {
    const r = await askOne('你们在做什么');
    assert.equal(r.failed, true);
    assert.equal(r.degraded, false);
    assert.match(r.reply, /提问有点多/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

check('501：没配 key，整个会话进演示态', async () => {
  mockFetch(501, '{"error":"unconfigured"}');
  try {
    const r = await askOne('你们在做什么');
    assert.equal(r.demo, true);
    assert.equal(r.failed, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

check('正常 SSE：照常读出回复', async () => {
  const sse = ['data: {"delta":"我们"}', 'data: {"delta":"做数字艺术"}', 'data: {"done":true,"coop":false,"farm":""}', ''].join('\n\n');
  mockFetch(200, sse, 'text/event-stream');
  try {
    const r = await askOne('你们在做什么');
    assert.equal(r.failed, false);
    assert.equal(r.streamed, true);
    assert.equal(r.reply, '我们做数字艺术');
  } finally {
    globalThis.fetch = realFetch;
  }
});

/* ===== 结果 ===== */

await Promise.all(pending);

if (failures.length) {
  for (const f of failures) console.error(`✗ ${f.name}\n  ${f.message}`);
  console.error(`\n${failures.length} 组失败，${passed} 组通过`);
  process.exit(1);
}
console.log(`Mimi：${passed} 组全部通过`);
