export type SectionId = 'tech' | 'activity' | 'tutorial';
export type WhenId = 'now' | 'future' | 'past' | 'undated';

export type NewsItem = {
  id: string;
  section: SectionId;
  title: string;
  /** 发表用英文题名。中文标题是译写。 */
  original?: string;
  summary?: string;
  /** YYYY-MM-DD。缺省表示还没日期，时间筛选里不进入现在 / 即将 / 往期。 */
  start?: string;
  end?: string;
  /** 开始之后仍未收束，归在「现在」（开始日晚于今天则归「即将」）。 */
  open?: boolean;
  /** year：界面只显示年份。start/end 仍用该年的 1 月 1 日和 12 月 31 日，方便归进往期。 */
  precision?: 'year' | 'day';
  place?: string;
  event?: string;
  format?: string;
  people?: string[];
  href?: string;
  hrefLabel?: string;
  /**
   * 封面。站内路径（以 / 开头）或图片地址。
   * 不写这个字段，列表和详情都不显示图。
   */
  image?: string;
  placeholder?: boolean;
  /** archive：艺术家档案。work：摘自作品页。placeholder：栏目位置。 */
  source?: 'archive' | 'work' | 'placeholder';
};

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'tech', label: '技术动态' },
  { id: 'activity', label: '活动参与' },
  { id: 'tutorial', label: '技术分享' },
];

export const SECTION_LABEL: Record<SectionId, string> = {
  tech: '技术动态',
  activity: '活动参与',
  tutorial: '技术分享',
};

export const WHENS: { id: WhenId | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'now', label: '现在' },
  { id: 'future', label: '即将' },
  { id: 'past', label: '往期' },
];

const SECTION_IDS = new Set<string>(['tech', 'activity', 'tutorial']);

export function isSection(value: string): value is SectionId {
  return SECTION_IDS.has(value);
}

/** 本地日历日，YYYY-MM-DD。用年月日拼接，避免时区把日期拨到前后一天。 */
export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function classify(item: { start?: string; end?: string; open?: boolean }, today: string): WhenId {
  const start = item.start || '';
  if (!start) return 'undated';
  if (item.open) return start > today ? 'future' : 'now';
  const end = item.end || start;
  if (end < today) return 'past';
  if (start > today) return 'future';
  return 'now';
}

export function dateLabel(item: Pick<NewsItem, 'start' | 'end' | 'open' | 'precision'>): string {
  if (!item.start) return '日期待定';
  if (item.precision === 'year') return item.start.slice(0, 4);
  const start = fmt(item.start);
  if (item.open && !item.end) return `${start} 起`;
  if (!item.end || item.end === item.start) return start;
  const [ys, ms] = item.start.split('-');
  const [ye, me, de] = item.end.split('-');
  if (ys === ye && ms === me) return `${start}–${de}`;
  if (ys === ye) return `${start}–${me}.${de}`;
  return `${start}–${fmt(item.end)}`;
}

export function metaLine(item: Pick<NewsItem, 'event' | 'place' | 'format'>): string {
  return [item.event, item.place, item.format].filter(Boolean).join(' · ');
}

export function sortNews<T extends { start?: string }>(items: readonly T[]): T[] {
  return items.map((item, index) => ({ item, index })).sort((a, b) => {
    if (a.item.start && b.item.start && a.item.start !== b.item.start) {
      return a.item.start < b.item.start ? 1 : -1;
    }
    if (a.item.start && !b.item.start) return -1;
    if (!a.item.start && b.item.start) return 1;
    return a.index - b.index;
  }).map(({ item }) => item);
}

function fmt(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${y}.${m}.${d}`;
}
