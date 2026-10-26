/**
 * Mimi 对话协议。浮层和工作台共用。
 * 只打现有的 /api/chat，不带密钥。501 / 404 / 断网时用本地演示回答。
 */

export const BANNED = /西湖|繁胜全景|xihu-panorama/i;

export const ANSWERS = {
  what: '幕景是杭州的 AIGC 文化艺术团队，以艺术家林丽丽为核心，做古画、民乐音画，也做展览和委托。目录在[作品页](/works/)，怎么合作写在[合作页](/contact/)。',
  works: '作品目录在[作品页](/works/)，按数字艺术、产品和游戏分开。',
  doing: '已经公开的在[作品页](/works/)，按数字艺术、产品和游戏分开。',
  find: '飞书名片点「看飞书名片」，邮件写到 lily1326685527@gmail.com。加好友后在群里 @Mimi。这里不会自动拉群。',
  made: '我是幕景的 AI 伙伴，不是真人。官网这一版用的是我的开源模板 mimi-agent，小团队可以在飞书群里用它答疑、查资料、记事情，写入操作要先本人确认：[mimi-agent](https://github.com/endtree-FDE/mimi-agent)。',
  coop: '可以说古画、民乐音画，或一个合作项目。下面是终树的飞书名片，自己扫码加好友，备注来意。官网不会自动拉群，也没有 24 小时在线的飞书助理。我们接什么，写在[合作页](/contact/#start)。\n[[COOP]]',
  secret: '这个不能给。想了解幕景、作品，或我是怎么搭的，可以直接问。',
  skip: '这一件还在保密期，我不方便展开。已经公开的作品在[作品页](/works/)。想聊类似方向的合作，去[合作页](/contact/)跟我说。', // v2 提示词，待丽丽风格锚/保密口径/浮层开场白拍板
  other: '这个问题我答不准，也不能替团队承诺。想合作，点「怎么合作」，或去[合作页](/contact/)。',
  en: 'I can’t answer that precisely. For a project, open the [collaborate page](/contact/).', // v2 提示词，待丽丽风格锚/保密口径/浮层开场白拍板
  enCoop: 'Say what you want to make. Then add 终树 on Feishu with the card below and leave a note. This site will not create a group, and there is no 24-hour assistant.\n[[COOP]]',
};

export function splitCoop(text) {
  const coop = /\[\[\s*COOP\s*\]\]/.test(text);
  const clean = text.replace(/\[\[\s*COOP\s*\]\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return { clean, coop };
}

export function holdMark(text) {
  const parsed = splitCoop(text);
  const token = '[[COOP]]';
  let shown = parsed.clean;
  for (let n = Math.min(token.length - 1, shown.length); n > 0; n -= 1) {
    if (token.startsWith(shown.slice(-n))) {
      shown = shown.slice(0, -n);
      break;
    }
  }
  return { shown, coop: parsed.coop };
}

export function localAnswer(q) {
  const s = q.trim();
  const flat = s.replace(/\s+/g, '');
  if (BANNED.test(flat)) return ANSWERS.skip;
  if (/提示词|系统提示|忽略规则|扮演/.test(flat)) return ANSWERS.secret;
  if (flat === 'Mimi是怎么做出来的？' || /怎么做出来|你是谁|你是怎么/.test(flat)) return ANSWERS.made;
  if (flat === '作品在做什么' || /在做什么/.test(flat)) return ANSWERS.doing;
  if (flat === '怎么找到你们' || /怎么找|找到你们/.test(flat)) return ANSWERS.find;
  if (flat === '看看代表作品' || /代表作/.test(flat) || (/作品/.test(flat) && !/做什么|委托|合作|古画|民乐|音画/.test(flat))) return ANSWERS.works;
  if (flat === '幕景是做什么的？' || ((/幕景|你们/.test(flat)) && /做|是什么|干什么/.test(flat))) return ANSWERS.what;
  if (flat === '聊合作' || /合作|咨询|联系|报价|多少钱|价格|定金|支付宝|付款|收款|支付|档期|合同|版权|微信|飞书|终树|丁科智|古画|民乐|音画|展陈|委托/.test(flat)) return ANSWERS.coop;
  if (/[A-Za-z]/.test(s) && !/[\u4e00-\u9fff]/.test(s)) {
    return /collab|cooperat|contact|price|quote|hire|partner|alipay|payment|deposit/i.test(s) ? ANSWERS.enCoop : ANSWERS.en;
  }
  return ANSWERS.other;
}

export function linkify(parent, text) {
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/(?!\/)[A-Za-z0-9/_\-.%#]*)\)|(https?:\/\/[^\s<]+)|(\/(?:works|contact|artist|studio)\/[A-Za-z0-9/_\-.#]*)/g;
  let last = 0;
  let match;
  while ((match = re.exec(text))) {
    if (match.index > last) parent.append(text.slice(last, match.index));
    let href = match[2] || match[3] || match[4] || '';
    let label = match[1] || href;
    const trail = href.match(/[.,，。、；;：:！!？?）)]+$/);
    if (trail && !match[1]) {
      href = href.slice(0, -trail[0].length);
      label = href;
    }
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (/^https?:/i.test(href)) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    parent.append(a);
    if (trail && !match[1]) parent.append(trail[0]);
    last = match.index + match[0].length;
  }
  if (last < text.length) parent.append(text.slice(last));
}

export async function readSse(res, onDelta) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  let coop = false;
  let farm = ''; // 鸡场命令（服务端扣留 [[FARM:*]] 后随 done 事件下发）
  let failed = false;
  const take = (block) => {
    for (const line of block.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      let msg;
      try { msg = JSON.parse(data); } catch { continue; }
      if (msg.error) failed = true;
      if (typeof msg.replace === 'string') {
        text = msg.replace;
        coop = false;
        farm = '';
        onDelta(text);
      } else if (typeof msg.delta === 'string' && msg.delta) {
        text += msg.delta;
        const view = holdMark(text);
        if (view.coop) coop = true;
        onDelta(view.shown);
      }
      if (msg.done) {
        coop = msg.coop === true || coop;
        if (typeof msg.farm === 'string') farm = msg.farm;
      }
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx = buf.indexOf('\n\n');
    while (idx >= 0) {
      take(buf.slice(0, idx));
      buf = buf.slice(idx + 2);
      idx = buf.indexOf('\n\n');
    }
  }
  if (buf.trim()) take(buf);
  const view = holdMark(text);
  return { text: view.shown.trim(), coop: coop || view.coop, farm, failed };
}

const RATE = '提问有点多，我先歇一会儿，稍后再问哦。';
const FAIL = '抱歉，这次没能生成回答，请稍后再试。';
const COOP_LINE = '想合作的话，用下面的名片自己加飞书好友。官网不会自动拉群。';

/* 鸡场问题的演示态兜底：仅当 /api/chat 不可用（501/断网）走演示分支时使用；
   线上主路径由后端把农场账注入 SYSTEM（AI Native），不走这里。 */
const FARM_CN = { home: '首页', works: '作品页', about: '关于页', news: '动态页', contact: '合作页' };
const FARM_Q = /我的.{0,6}鸡|小鸡|鸡场|鸡都?在|鸡群|出鸡|孵化|图鉴|蛋.{0,8}(哪|多少|几颗|几只)/;
function farmReply(q, farm) {
  if (!farm || !FARM_Q.test(q)) return null;
  const where = Object.entries(farm.pagesMap || farm.pages || {}).filter(([, n]) => n > 0)
    .map(([p, n]) => `${FARM_CN[p] || p} ${n} 只`);
  const lines = [`东家清点：鸡 ${farm.chickens} 只。`];
  lines.push(where.length ? `${where.join('，')}；还有 ${Math.max(0, farm.eggs - farm.chickens)} 颗蛋没孵。` : '都在鸡篮里待着，还没放出本页。');
  lines.push(farm.dex_left > 0 ? `图鉴还差 ${farm.dex_left} 个品种，点空白处多下几颗蛋就有了。` : '图鉴已经集齐，就等东家来领证书。');
  return lines.join('');
}

export async function requestReply({ messages, demo, farm, butler, onDelta }) {
  const q = String(messages[messages.length - 1]?.content || '');
  let reply = '';
  let failed = false;
  let showCoop = false;
  let streamed = false;
  let nextDemo = !!demo;
  let threw = false;
  let farmCmd = ''; // 鸡场命令透传：只有 SSE 分支可能带，其余分支恒为空
  try {
    if (nextDemo) {
      const parsed = splitCoop(farmReply(q, farm) || localAnswer(q));
      reply = parsed.clean;
      showCoop = parsed.coop;
    } else {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: messages.slice(-8),
          ...(farm ? { farm } : {}),
          ...(butler ? { butler: true } : {}),
        }),
      });
      const ctype = res.headers.get('content-type') || '';
      if (res.status === 501 || res.status === 404) {
        nextDemo = true;
        const parsed = splitCoop(farmReply(q, farm) || localAnswer(q));
        reply = parsed.clean;
        showCoop = parsed.coop;
      } else if (res.status === 429) {
        failed = true;
        reply = RATE;
      } else if (!res.ok) {
        failed = true;
        reply = FAIL;
      } else if (ctype.includes('text/event-stream') && res.body) {
        streamed = true;
        const result = await readSse(res, onDelta);
        reply = result.text;
        showCoop = result.coop;
        farmCmd = result.farm || '';
        if (!reply && showCoop) reply = COOP_LINE;
        failed = result.failed || !reply;
        if (failed && !reply) reply = FAIL;
      } else {
        const data = await res.json().catch(() => ({}));
        const parsed = splitCoop(typeof data.reply === 'string' ? data.reply.trim() : '');
        reply = parsed.clean;
        showCoop = parsed.coop;
        if (!reply) {
          failed = true;
          reply = FAIL;
        }
      }
    }
  } catch {
    threw = true;
    streamed = false;
    nextDemo = true;
    failed = false;
    const parsed = splitCoop(farmReply(q, farm) || localAnswer(q));
    reply = parsed.clean;
    showCoop = parsed.coop;
  }
  if (BANNED.test(reply)) {
    reply = splitCoop(ANSWERS.skip).clean;
    showCoop = false;
  }
  return { reply, showCoop, failed, streamed, demo: nextDemo, threw, farm: farmCmd };
}
