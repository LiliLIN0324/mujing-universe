/**
 * Mimi 对话协议。浮层和工作台共用。
 * 只打现有的 /api/chat，不带密钥。501 / 404 / 断网时用本地演示回答。
 */

export const BANNED = /西湖|繁胜全景|xihu-panorama/i;

export const ANSWERS = {
  what: '幕景是杭州的 AIGC 文化艺术团队，以艺术家林丽丽为核心，做古画、民乐音画，也做展览和委托。目录在[作品页](/works/)，怎么合作写在[合作页](/contact/)。',
  works: '作品目录在[作品页](/works/)，按音画、产品、游戏和研究分开。',
  doing: '已经公开的在[作品页](/works/)，按音画、产品、游戏和研究分开。',
  find: '飞书名片点「看飞书名片」，邮件写到 lily1326685527@gmail.com。加好友后在群里 @Mimi。这里不会自动拉群。',
  made: '我是幕景的 AI 伙伴，不是真人。官网这一版用的是开源的飞书群智能体模板，小团队可以在飞书群里用它答疑、查资料、记事情：[feishu-group-agent](https://github.com/endtree-FDE/feishu-group-agent)。',
  coop: '可以说古画、民乐音画，或一个合作项目。下面是终树的飞书名片，自己扫码加好友，备注来意。官网不会自动拉群，也没有 24 小时在线的飞书助理。我们接什么，写在[合作页](/contact/#start)。\n[[COOP]]',
  secret: '这个不能给。想了解幕景、作品，或我是怎么搭的，可以直接问。',
  skip: '这一件我这边不介绍。已经公开的作品在[作品页](/works/)。想合作就点「怎么合作」，或去[合作页](/contact/)。',
  other: '这个问题我答不准，也不能替团队承诺。想合作，点「怎么合作」，或去[合作页](/contact/)。',
  en: 'I can’t answer that precisely. For a project, tap “怎么合作” or open the [collaborate page](/contact/).',
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
  if (flat === '聊合作' || /合作|咨询|联系|报价|多少钱|价格|档期|合同|版权|微信|飞书|终树|丁科智|古画|民乐|音画|展陈|委托/.test(flat)) return ANSWERS.coop;
  if (/[A-Za-z]/.test(s) && !/[\u4e00-\u9fff]/.test(s)) {
    return /collab|cooperat|contact|price|quote|hire|partner/i.test(s) ? ANSWERS.enCoop : ANSWERS.en;
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
        onDelta(text);
      } else if (typeof msg.delta === 'string' && msg.delta) {
        text += msg.delta;
        const view = holdMark(text);
        if (view.coop) coop = true;
        onDelta(view.shown);
      }
      if (msg.done) coop = msg.coop === true || coop;
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
  return { text: view.shown.trim(), coop: coop || view.coop, failed };
}

const RATE = '提问有点多，我先歇一会儿，稍后再问哦。';
const FAIL = '抱歉，这次没能生成回答，请稍后再试。';
const COOP_LINE = '想合作的话，用下面的名片自己加飞书好友。官网不会自动拉群。';

export async function requestReply({ messages, demo, onDelta }) {
  const q = String(messages[messages.length - 1]?.content || '');
  let reply = '';
  let failed = false;
  let showCoop = false;
  let streamed = false;
  let nextDemo = !!demo;
  let threw = false;
  try {
    if (nextDemo) {
      const parsed = splitCoop(localAnswer(q));
      reply = parsed.clean;
      showCoop = parsed.coop;
    } else {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: messages.slice(-8) }),
      });
      const ctype = res.headers.get('content-type') || '';
      if (res.status === 501 || res.status === 404) {
        nextDemo = true;
        const parsed = splitCoop(localAnswer(q));
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
    const parsed = splitCoop(localAnswer(q));
    reply = parsed.clean;
    showCoop = parsed.coop;
  }
  if (BANNED.test(reply)) {
    reply = splitCoop(ANSWERS.skip).clean;
    showCoop = false;
  }
  return { reply, showCoop, failed, streamed, demo: nextDemo, threw };
}
