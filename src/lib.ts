import { getCollection } from 'astro:content';
export const LINES = ['音画', 'AIGC 产品', '游戏', '空间与研究'] as const;
export const LINE_EN: Record<string,string> = { '音画':'Audio-Visual', 'AIGC 产品':'AIGC Products', '游戏':'Games', '空间与研究':'Space & Research' };
export async function allWorks() {
  const ws = (await getCollection('works')).map(w => w.data);
  // slug breaks ties so the order (and the /ring/<slot>.jpg covers) is the same on every build
  ws.sort((a,b) => LINES.indexOf(a.line) - LINES.indexOf(b.line) || b.yearNum - a.yearNum || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return ws.map((w,i) => ({ ...w, no: String(i+1).padStart(2,'0') }));
}
const PLACEHOLDER_COVER = 'scroll-placeholder.svg';

/** Homepage 精选：音画 / 展览线。产品、游戏、研究留在 /works/。有实拍封面的排在矢量底图前面。 */
export function featuredWorks<T extends { line: string; images: string[]; icon: string }>(ws: T[]): T[] {
  const art = ws.filter((w) => w.line === '音画');
  const hasCover = (w: T) => {
    const src = w.images[0] || w.icon || '';
    return src.length > 0 && !src.includes(PLACEHOLDER_COVER);
  };
  return [...art.filter(hasCover), ...art.filter((w) => !hasCover(w))];
}

const R2_FIG = 'https://pub-3209bcb7fc36444a914deb0e70ceca92.r2.dev/fig';
const LOCAL_COVER = '/scroll-placeholder.svg';
/** R2 has no usable still for these slugs (01/logo 404). */
const BROKEN_COVERS = new Set<string>([]);

/** 精选环带用的静帧。音画只有一卷时，用同一件作品的 01 / 02。缺图用本地占位，不留破图。 */
export function workCovers(w: { slug: string; images?: string[]; icon?: string }): string[] {
  if (w.slug === 'xihu-panorama') {
    return [`${R2_FIG}/xihu-panorama/01.jpg`, `${R2_FIG}/xihu-panorama/02.jpg`];
  }
  if (w.slug === 'scendance') return ['/ring/_sources/scendance-hero.jpg'];
  if (BROKEN_COVERS.has(w.slug)) return [LOCAL_COVER];
  const photos = (w.images ?? []).filter((src) => /\.(jpe?g|png|webp)(?:$|\?)/i.test(src));
  if (photos.length) return photos.slice(0, 2);
  const icon = w.icon ?? '';
  if (/\.(jpe?g|png|webp)(?:$|\?)/i.test(icon) && !icon.includes('scroll-placeholder')) return [icon];
  return [`${R2_FIG}/${w.slug}/01.jpg`];
}

export function workFallback(w: { slug: string; icon?: string }) {
  if (BROKEN_COVERS.has(w.slug)) return LOCAL_COVER;
  const icon = w.icon ?? '';
  if (/\.(jpe?g|png|webp)(?:$|\?)/i.test(icon) && !icon.includes('scroll-placeholder')) return icon;
  return LOCAL_COVER;
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

/* ---- Work detail page helpers ---- */
/** 西湖长卷的副标题（与首页同一句）。其它作品没有副标题字段，留空即隐藏。 */
export function workSubtitle(w: { slug: string }): string {
  return w.slug === 'xihu-panorama' ? '以宋画长卷重绘当代西湖，画面由声音转译生成。' : '';
}
/** 全卷长条：R2 上只有西湖有整卷静帧（32768×627）。 */
export function workStrip(w: { slug: string }): string | null {
  return w.slug === 'xihu-panorama' ? `${R2_FIG}/xihu-panorama/still.jpg` : null;
}
/** 可聆听的声音：只有西湖有（首页同一个 R2 音画文件，含 AAC 音轨）。 */
export function workAudio(w: { slug: string }): string | null {
  return w.slug === 'xihu-panorama' ? `${R2_FIG}/xihu-panorama/scroll-placeholder.mp4` : null;
}
/** 详情页静帧：主图之后的全部 R2 图片（西湖为 02）。 */
export function workStills(w: { slug: string; images?: string[]; icon?: string }): string[] {
  if (w.slug === 'xihu-panorama') return workCovers(w).slice(1);
  return (w.images ?? []).slice(1).filter((src) => /\.(jpe?g|png|webp)(?:$|\?)/i.test(src));
}
/** 详情页主图：西湖用 R2 01，其它用第一张图或 icon。 */
export function workHero(w: { slug: string; images?: string[]; icon?: string }): string {
  if (w.slug === 'xihu-panorama') return workCovers(w)[0];
  return (w.images ?? [])[0] || w.icon || LOCAL_COVER;
}
/** 主图两侧的纸色：西湖取自 01.jpg 左右边缘像素均值（≈rgb(174,166,149)），其它作品用默认底色。 */
export function workPaper(w: { slug: string }): string | null {
  return w.slug === 'xihu-panorama' ? '#aea695' : null;
}
