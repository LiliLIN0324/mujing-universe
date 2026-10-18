import { getCollection } from 'astro:content';
export const LINES = ['音画', 'AIGC 产品', '游戏', '空间与研究'] as const;
export const LINE_EN: Record<string,string> = { '音画':'Audio-Visual', 'AIGC 产品':'AIGC Products', '游戏':'Games', '空间与研究':'Space & Research' };
export async function allWorks() {
  const ws = (await getCollection('works')).map(w => w.data);
  ws.sort((a,b) => LINES.indexOf(a.line) - LINES.indexOf(b.line) || b.yearNum - a.yearNum);
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
