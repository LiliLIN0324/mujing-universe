import { getCollection } from 'astro:content';
export const LINES = ['数字艺术', '智能体', '产品', '游戏', '空间'] as const;
export const LINE_EN: Record<string,string> = { '数字艺术':'Digital Art', '智能体':'Agents', '产品':'Products', '游戏':'Games', '空间':'Space' };
// 作品页固定前三：幕景 Scendance → 西湖 → 小鸡宇宙；其余按年份倒序。
const WORKS_PINNED = ['scendance', 'xihu-panorama', 'chicken-universe'];
export async function allWorks() {
  const ws = (await getCollection('works')).map(w => w.data);
  // slug breaks ties so the order (and the /ring/<slot>.jpg covers) is the same on every build
  ws.sort((a,b) => {
    const pa = WORKS_PINNED.indexOf(a.slug), pb = WORKS_PINNED.indexOf(b.slug);
    if (pa !== -1 || pb !== -1) return (pa === -1 ? Infinity : pa) - (pb === -1 ? Infinity : pb);
    return b.yearNum - a.yearNum || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
  });
  // 图床简写：JSON 里写文件名即可，统一在这里展开成 fig/<slug>/<文件>；写全 URL 的照旧
  return ws.map((w,i) => ({
    ...w,
    images: (w.images ?? []).map((src) => (/^https?:\/\//.test(src) ? src : `${R2_FIG}/${w.slug}/${src}`)),
    icon: w.icon && !/^https?:\/\//.test(w.icon) ? `${R2_FIG}/${w.slug}/${w.icon}` : w.icon,
    no: String(i+1).padStart(2,'0'),
  }));
}
const R2_FIG = 'https://pub-3209bcb7fc36444a914deb0e70ceca92.r2.dev/fig';

/** Homepage 精选：数字艺术 / 展览线。产品、游戏、研究留在 /works/。有实拍封面的排前面。 */
export function featuredWorks<T extends { line: string; images: string[]; icon: string }>(ws: T[]): T[] {
  const art = ws.filter((w) => w.line === '数字艺术');
  const hasCover = (w: T) => Boolean(w.images[0] || w.icon);
  return [...art.filter(hasCover), ...art.filter((w) => !hasCover(w))];
}

/** 精选环带用的静帧。音画只有一卷时，用同一件作品的 01 / 02。 */
export function workCovers(w: { slug: string; images?: string[]; icon?: string }): string[] {
  if (w.slug === 'xihu-panorama') {
    return [`${R2_FIG}/xihu-panorama/01.jpg?v=20261026`, `${R2_FIG}/xihu-panorama/02.jpg`];
  }
  const photos = (w.images ?? []).filter((src) => /\.(jpe?g|png|webp)(?:$|\?)/i.test(src));
  if (photos.length) return photos.slice(0, 2);
  const icon = w.icon ?? '';
  if (/\.(jpe?g|png|webp)(?:$|\?)/i.test(icon)) return [icon];
  return [`${R2_FIG}/${w.slug}/01.jpg`];
}

export function workFallback(w: { slug: string; icon?: string }) {
  const icon = w.icon ?? '';
  if (/\.(jpe?g|png|webp)(?:$|\?)/i.test(icon)) return icon;
  return `${R2_FIG}/${w.slug}/01.jpg`;
}

const XIHU_INTRO = '当代西湖繁胜全景图，是幕景宇宙正在进行的音画长卷。以宋画的观看方式重绘今日西湖，舟船、岸线与人烟由声音转译生成。这一卷仍在创作中。';

function textWidth(text: string) {
  let width = 0;
  for (const ch of text) width += ch.charCodeAt(0) < 128 ? 8.4 : 16;
  return width;
}

/** 约 4–6 行（380px、16px、1.65）。按中英文宽度收束，不写入占位说明。 */
export function pickIntro(w: { slug: string; title: string; yearNum?: number; line: string; description?: string; category?: string; tech?: string[] }): string {
  if (w.slug === 'xihu-panorama') return XIHU_INTRO;
  const desc = (w.description || '').replace(/（占位[^）]*）/g, '').trim();
  const bits = [`${w.title}，${w.yearNum || ''}，${w.line}。`];
  if (desc) bits.push(/[。！？]$/.test(desc) ? desc : `${desc}。`);
  else if (w.category) bits.push(`归在${w.category}。`);
  const tech = (w.tech || []).filter((item) => item && !item.includes('占位')).slice(0, 3);
  if (tech.length) bits.push(`涉及${tech.join('、')}。`);
  let text = bits.join('');
  const pads = [
    '这件作品与音画长卷一起，收在幕景宇宙的创作目录里。',
  ];
  for (const pad of pads) {
    if (textWidth(text) >= 380 * 4.15) break;
    text += pad;
  }
  if (textWidth(text) > 380 * 5.7) {
    const sentences = text.split(/(?<=。)/);
    while (sentences.length > 2 && textWidth(sentences.join('')) > 380 * 5.7) sentences.pop();
    text = sentences.join('');
  }
  return text;
}

/* ---- Mobile featured stack (≤768px) helpers. Desktop does not read these. ---- */
const isPlaceholder = (text: string) => /占位/.test(text);
const stripPlaceholder = (text: string) => text.replace(/[（(]占位[^）)]*[）)]/g, '').trim();

/** 移动端精选正文：作品自己的完整描述，不截断、不补句。没有就留空。 */
export function pickBody(w: { slug: string; description?: string }): string {
  if (w.slug === 'xihu-panorama') return XIHU_INTRO;
  const raw = stripPlaceholder(w.description || '');
  if (!raw) return '';
  return /[。！？.!?]$/.test(raw) ? raw : `${raw}。`;
}

/** 真实技术栈：去掉含「占位」的条目。 */
export function pickTech(w: { tech?: string[] }): string[] {
  return (w.tech || []).filter((item) => item && !isPlaceholder(item)).map((item) => item.trim()).filter(Boolean);
}

/** 移动端副标题：类型 · 年份 · 技术（前两项）。缺哪段就省哪段。 */
export function pickMeta(w: { line?: string; yearNum?: number; tech?: string[] }): string {
  const tech = pickTech(w).slice(0, 2).join(' / ');
  return [w.line || '', w.yearNum ? String(w.yearNum) : '', tech].filter(Boolean).join(' · ');
}

/** Desktop 精选左侧：类型 · 年份 only（无 tech）。 */
export function pickTypeYear(w: { line?: string; yearNum?: number; year?: string | number }): string {
  const year = w.yearNum ?? w.year;
  return [w.line || '', year ? String(year) : ''].filter(Boolean).join(' · ');
}

/** Desktop 精选左侧：一行摘要（比正文略淡）。西湖用副标题；其它取描述首句并收束为一行。 */
export function pickSummary(w: { slug: string; description?: string }): string {
  if (w.slug === 'xihu-panorama') return '以宋画长卷重绘当代西湖，画面由声音转译生成。';
  const raw = stripPlaceholder(w.description || '');
  if (!raw) return '';
  let s = (raw.split(/(?<=[。！？.!?])/)[0] || raw).trim();
  if (!s) return '';
  if (!/[。！？.!?]$/.test(s)) s += '。';
  // ~one line at ~22em / 15px
  if (s.length > 40) s = `${s.slice(0, 39).replace(/[，、,.\s]+$/, '')}…`;
  return s;
}

/** Desktop 精选左侧正文：用偏长的 intro（可含轻量技术点），由 CSS clamp 到 2–3 行。 */
export function pickDeskBody(w: {
  slug: string;
  title: string;
  yearNum?: number;
  line: string;
  description?: string;
  category?: string;
  tech?: string[];
}): string {
  const intro = pickIntro(w);
  if (intro) return intro;
  return pickBody(w);
}

/* ---- Work detail page helpers ---- */
/** 西湖长卷的副标题（与首页同一句）。其它作品没有副标题字段，留空即隐藏。 */
export function workSubtitle(w: { slug: string }): string {
  return w.slug === 'xihu-panorama' ? '以宋画长卷重绘当代西湖，画面由声音转译生成。' : '';
}
/** 全卷长条：R2 上只有西湖有整卷静帧（32768×627）。 */
export function workStrip(w: { slug: string }): string | null {
  return w.slug === 'xihu-panorama' ? `${R2_FIG}/xihu-panorama/still.jpg` : null;
}
/** 可聆听的声音：有封面视频就默认能聆听——有音轨的出声（小鸡 cover.mp4 已核实 h264+AAC），没音轨的点了也只是静音。 */
export function workAudio(w: { slug: string }): string | null {
  return coverClip(w.slug);
}
/**
 * 封面预览：只有 R2 上核对过的 mp4。没有片的作品不在这里，封面保持静图。
 * 路径用 Range 请求确认过（206、video/mp4），不按 slug 猜。
 * 首页章节和作品库用同一份名单。
 */
const COVER_CLIP: Record<string, string> = {
  'xihu-panorama': `${R2_FIG}/xihu-panorama/scroll-placeholder.mp4`,
  'scendance': `${R2_FIG}/scendance/cover.mp4`,
  'riffle-ai-game-generation-tool': `${R2_FIG}/riffle/cover.mp4`,
  'genstyle': `${R2_FIG}/genstyle/cover.mp4`,
  'genshot-AI-video-generation-tool': `${R2_FIG}/genshot/cover.mp4`,
  'anyreal': `${R2_FIG}/anyreal/cover.mp4`,
  'dragon-diffussion': `${R2_FIG}/dragon-diffusion/cover.mp4`,
  'bazi-fengshui-analysis': `${R2_FIG}/bazi/cover.mp4`,
  'bmw-meta-island': `${R2_FIG}/bmw-meta-island/cover.mp4`,
  'peace-elite-hust-campus': `${R2_FIG}/peace-elite-hust/cover.mp4`,
  '72-hour-game-jam': `${R2_FIG}/game-jam/cover.mp4`,
  'chicken-universe': `${R2_FIG}/chicken-universe/cover.mp4`,
};
/** 首页章节、作品库封面和详情主视觉的真实预览。没有就返回 null，保持静图。 */
export function coverClip(slug: string): string | null {
  return COVER_CLIP[slug] ?? null;
}
/** 详情页静帧：全部帧（01 打头，共 100；R2 上缺的由全局 error 移除，不留破图）。 */
export function workStills(w: { slug: string; images?: string[]; icon?: string }): string[] {
  return (w.images ?? []).filter((src) => /\.(jpe?g|png|webp)(?:$|\?)/i.test(src));
}
/** 详情页主图：西湖与幕景用精选环同一张静帧，其它用第一张图或 icon。 */
export function workHero(w: { slug: string; images?: string[]; icon?: string }): string {
  if (w.slug === 'xihu-panorama' || w.slug === 'scendance') return workCovers(w)[0];
  return (w.images ?? [])[0] || w.icon || `${R2_FIG}/${w.slug}/01.jpg`;
}
/** 主图两侧的纸色：西湖取自 01.jpg 左右边缘像素均值（≈rgb(174,166,149)），其它作品用默认底色。 */
export function workPaper(w: { slug: string }): string | null {
  return w.slug === 'xihu-panorama' ? '#aea695' : null;
}

/* ---- /works/ index page helpers ---- */
/** 去掉「（占位…）」说明。 */
export function clean(text?: string): string {
  return (text || '').replace(/[（(]占位[^）)]*[）)]/g, '').trim();
}
/** 主标题 / 副标题：' - ' → ' — ' → '：' → 末尾全角括号 → 「中文 + 空格 + 英文」。只拆分，不改写。 */
export function splitTitle(t: string): [string, string] {
  for (const sep of [' - ', ' — ', '：']) {
    const i = t.indexOf(sep);
    if (i > 0) return [t.slice(0, i).trim(), t.slice(i + sep.length).trim()];
  }
  let m = t.match(/^(.*?)（(.*)）$/);
  if (m) return [m[1].trim(), m[2].trim()];
  m = t.match(/^([\u4e00-\u9fff].*?[\u4e00-\u9fff])\s+([A-Za-z].*)$/);
  if (m) return [m[1], m[2]];
  return [t, ''];
}
/** 标题宽度：汉字等全角计 2，其他计 1。 */
export function titleWidth(t: string): number {
  let n = 0;
  for (const ch of t) n += ch.codePointAt(0)! > 0x2e80 ? 2 : 1;
  return n;
}
/** 作品页封面：这里只放人工调过裁切/缩放的条目；未登记的作品由 WorkCover 自动用第一张静帧，无图才走排版封面。 */
export const WORKS_COVER: Record<string, { src: string; pos?: string; scale?: number }> = {
  'xihu-panorama': { src: `${R2_FIG}/xihu-panorama/01.jpg?v=20261026`, scale: 1.08 },
  'riffle-ai-game-generation-tool': { src: `${R2_FIG}/riffle/01.jpg` },
  'bazi-fengshui-analysis': { src: `${R2_FIG}/bazi/01.jpg` },
};
