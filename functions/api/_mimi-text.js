/**
 * Mimi 回复文本的纯逻辑：标记扣留 + 站内链接白名单。
 *
 * 为什么单独放一个 .js：
 *   这段逻辑同时被线上后端（functions/api/chat.ts）和回归测试
 *   （scripts/test-mimi-text.mjs）用。写成纯 JS（不是 .ts）是为了让测试
 *   在任何 Node 版本上都能直接 import —— 2026-11-07 踩过：prebuild 里
 *   只要有一个检查在 Cloudflare 构建镜像里跑不起来，整个站就发不出去。
 *
 * 文件名以 _ 开头：Cloudflare Pages 不会把它当成 /api/_mimi-text 这个路由。
 */

/* 站内链接白名单：路径 → 允许出现在链接文字里的关键词（命中任一即可，比对忽略大小写）。
   模型只准链到下面这些路径。站内路径不在表里、或者链接文字跟路径对不上的，一律剥成纯文字，
   免得访客点到一个根本不存在的作品页。
   2026-11-14 实测：Qwen3-8B 会把「幕景 Scendance」改写成「数字艺术空间」，再挂一个泛路径
   /works/，点进去是个空目录 —— 光靠提示词劝不住，得在代码里挡一道。

   key 一律小写：slug 里带大写字母的（genshot-AI-…），模型常写成全小写，
   匹配时统一按小写查，免得明明是同一个作品却被剥掉。

   作品清单要跟「站点知识补充」（src/pages/knowledge.json.ts，构建时从作品目录生成）同步 ——
   知识包里有的作品，模型就会给链接，白名单漏了就会被剥成纯文字。
   scripts/test-mimi.mjs 会核对这件事。 */
export const ALLOWED_LINKS = {
  '/works/': ['作品', 'works'],
  '/about/': ['关于', '团队', '我们', 'about'],
  '/news/': ['动态', '新闻', 'news'],
  '/contact/': ['合作', '联系', 'contact', '聊'],
  '/contact/#start': ['合作', '联系', 'contact', '聊'],
  '/works/scendance/': ['scendance', '活动布置', '幕景'],
  '/works/anyreal/': ['anyreal', '影棚'],
  '/works/riffle-ai-game-generation-tool/': ['riffle', '小游戏'],
  '/works/genstyle/': ['genstyle', '衣橱'],
  '/works/genshot-ai-video-generation-tool/': ['genshot', '视频生成', '成片'],
  '/works/bazi-fengshui-analysis/': ['bazi', '八字', '风水'],
  '/works/dragon-diffussion/': ['画板', 'dragon', '图像'],
  '/works/zhuantang-yixun/': ['转塘', '艺讯'],
  '/works/mimi-agent/': ['mimi', '智能体'],
  '/works/tuijian/': ['tuijian', '推鉴'],
  '/works/venue-ahead/': ['venue-ahead', '熟门熟路', '场馆', '预走'],
  '/works/peace-elite-hust-campus/': ['和平精英', '华科'],
  '/works/72-hour-game-jam/': ['gamejam', '72', '金奖'],
  '/works/bmw-meta-island/': ['宝马', 'bmw', '元宇宙'],
  '/works/chicken-universe/': ['小鸡宇宙', '鸡场'],
};

/* 外链只放行 GitHub（提示词里提到的开源模板），别的域名一律剥成纯文字 */
export const ALLOWED_EXTERNAL = /^(https?:\/\/)?(www\.)?github\.com\//i;

/* ---- 进行中的作品：只公开名字和一句话 ----
   2026-11-14 终树拍板的口径：以前「当代西湖繁胜全景图」整段保密，访客照首页问却得到
   「还在保密期」，前后自相矛盾。现在公开到进行中为止 ——
     可以说名字和一句话介绍（首页本来就这么写），不给详情链接、不展开没公开的细节。
   两道防线分开管：
     链接 → 不放进 ALLOWED_LINKS，模型给的链接会被剥成纯文字（名字还留着）
     细节 → 下面的 SECRETS + applySecretRule，命中就把那一段换成受限说法
   提示词里那一件的一句话在 functions/api/chat.ts 的 SYSTEM 里手写（作品目录里
   它的简介还是占位，别拿占位文字当公开介绍）。 */
export const SECRETS = {
  '当代西湖繁胜全景图': {
    limited: '这一卷还在创作中，公开到名字和一句话为止，更多细节等完成再给你。',
    /* 展开细节的信号词。只在谈这件作品的那一段里查，词要窄：
       命中的是「分几卷」「多少米」「未公开的草稿」这类内部信息，
       不是「长卷」「画面」这些正常说法。 */
    detail: /第\s*[一二三四五六七八九十\d]+\s*[卷章节幕]|全卷|逐卷|分卷|卷首|未公开|未发布|内部资料|内部版|草稿|初稿|分镜|母版|原稿|底稿|原始文件|尺寸[:：]|\d+\s*[米厘]|长\s*\d|宽\s*\d/,
  },
};

const LINK_RE = /\[([^\]\n]{0,80})\]\(([^)\s]{0,200})\)/g;

/**
 * 链接文字与路径对不上、或路径不在白名单里 → 剥成纯文字，链接本身不落到浏览器。
 * @param {string} text
 * @returns {string}
 */
export function sanitizeLinks(text) {
  return text.replace(LINK_RE, (whole, label, href) => {
    if (/^https?:\/\//i.test(href)) return ALLOWED_EXTERNAL.test(href) ? whole : label;
    const keys = ALLOWED_LINKS[String(href).toLowerCase()];
    if (!keys) return label;
    const low = String(label).toLowerCase();
    return keys.some((k) => low.includes(String(k).toLowerCase())) ? whole : label;
  });
}

/**
 * buf 末尾若有个还没闭合的 markdown 链接，返回要扣住的字符数（等下一个分片补齐再一起校验）。
 * @param {string} buf
 * @returns {number}
 */
export function pendingLinkKeep(buf) {
  const open = buf.lastIndexOf('](');
  if (open < 0) return 0;
  if (buf.indexOf(')', open) >= 0) return 0; // 已经闭合
  const lb = buf.lastIndexOf('[', open);
  if (lb < 0) return 0;
  return buf.length - lb;
}

export const COOP_MARK = '[[COOP]]';
export const FARM_HEAD = '[[FARM:';
export const FARM_TAIL = ']]';
/* 服务器白名单：模型只能输出这几种鸡场命令 */
export const FARM_OK = /^(gift:egg|goto:(works|about|news)|map|event)$/;

/**
 * 扣住 [[COOP]] 与 [[FARM:...]]，标记永远不进浏览器；farm 记最后一条命中白名单的命令。
 * @param {{ buf: string, coop: boolean, farm: string }} hold
 * @param {string} chunk
 * @returns {string} 可以放行给浏览器的正文
 */
export function takeVisible(hold, chunk) {
  hold.buf += chunk;
  let out = '';
  for (;;) {
    const coopAt = hold.buf.indexOf(COOP_MARK);
    if (coopAt >= 0) {
      hold.coop = true;
      out += hold.buf.slice(0, coopAt);
      hold.buf = hold.buf.slice(coopAt + COOP_MARK.length);
      continue;
    }
    const farmAt = hold.buf.indexOf(FARM_HEAD);
    if (farmAt >= 0) {
      const end = hold.buf.indexOf(FARM_TAIL, farmAt + FARM_HEAD.length);
      if (end < 0) {
        if (hold.buf.length - farmAt > 64) {
          out += hold.buf; // 超长仍未收尾：模型在胡写，整段按普通文字放行
          hold.buf = '';
          return out;
        }
        out += hold.buf.slice(0, farmAt); // 标记之前放行，标记本身扣住等下一个分片
        hold.buf = hold.buf.slice(farmAt);
        return out;
      }
      const mark = hold.buf.slice(farmAt, end + FARM_TAIL.length);
      const cmd = mark.slice(FARM_HEAD.length, mark.length - FARM_TAIL.length).trim();
      hold.farm = FARM_OK.test(cmd) ? cmd : ''; // 白名单外：剥除标记但不生效
      out += hold.buf.slice(0, farmAt);
      hold.buf = hold.buf.slice(end + FARM_TAIL.length);
      continue;
    }
    // 没有完整标记：扣住可能是标记前缀的尾巴，其余放行
    let keep = 0;
    for (let n = Math.min(hold.buf.length, COOP_MARK.length - 1); n > keep; n -= 1) {
      const tail = hold.buf.slice(-n);
      if (COOP_MARK.startsWith(tail) || FARM_HEAD.startsWith(tail)) { keep = n; break; }
    }
    // 再扣住「可能还没写完的 markdown 链接」，等下一个分片补齐再一起过白名单
    keep = Math.max(keep, pendingLinkKeep(hold.buf));
    out += hold.buf.slice(0, hold.buf.length - keep);
    hold.buf = hold.buf.slice(hold.buf.length - keep);
    return out;
  }
}

/**
 * 进行中的作品被展开细节时，把谈到它的那一段换成受限说法；别的段落原样保留。
 * 按空行分段，一段一段查 —— 只在谈这件作品的那段里找细节信号，不牵连整条回答。
 * @param {string} text
 * @returns {string|null} 需要改写时返回新文本，不用改时返回 null
 */
export function applySecretRule(text) {
  if (!text) return null;
  const paras = String(text).split(/\n{2,}/);
  let changed = false;
  const out = paras.map((para) => {
    for (const [title, rule] of Object.entries(SECRETS)) {
      if (!para.includes(title)) continue;
      if (!rule.detail.test(para)) continue;
      changed = true;
      return rule.limited;
    }
    return para;
  });
  return changed ? out.join('\n\n') : null;
}
