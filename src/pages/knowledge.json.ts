import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import news from '../data/news.json';

export const prerender = true;

// 站点知识包：供 functions/api/chat.ts 注入 Mimi 的 SYSTEM。
// 新增作品/动态在构建时自动进入本包，不必手改 chat.ts 里的手工清单。
// 保密口径：xihu-panorama 与 chat.ts 的 BANNED 保持一致，不出现在本包；
// chat.ts 注入前还会对每一行做 BANNED 过滤（保密真源只在 chat.ts 一处）。
type WorkBrief = { slug: string; title: string; line: string; year: string; status: string; brief: string };
type NewsBrief = { title: string; start: string; summary: string };

export const GET: APIRoute = async () => {
  const worksRaw = await getCollection('works');
  const works: WorkBrief[] = worksRaw
    .map((w) => {
      const d = w.data as { slug: string; title: string; line: string; year: string; status: string; abstract: string };
      return {
        slug: d.slug || w.id,
        title: d.title,
        line: d.line,
        year: d.year,
        status: d.status,
        brief: d.abstract.slice(0, 100),
      };
    })
    .filter((w) => w.slug !== 'xihu-panorama')
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const items = (news as { items?: Array<{ title: string; summary?: string; start: string }> }).items || [];
  const newsBrief: NewsBrief[] = items
    .slice()
    .sort((a, b) => (a.start < b.start ? 1 : -1))
    .slice(0, 5)
    .map((n) => ({ title: n.title, start: n.start, summary: (n.summary || '').slice(0, 80) }));
  return new Response(
    JSON.stringify({ schema: 'mujing-knowledge/1', works, news: newsBrief }),
    { headers: { 'content-type': 'application/json; charset=utf-8' } },
  );
};