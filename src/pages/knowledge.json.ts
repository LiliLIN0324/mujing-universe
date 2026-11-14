import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import news from '../data/news.json';

export const prerender = true;

// 站点知识包：供 functions/api/chat.ts 注入 Mimi 的 SYSTEM。
// 新增作品/动态在构建时自动进入本包，不必手改 chat.ts 里的手工清单。
// 口径（2026-11-14 终树拍板）：xihu-panorama 是「进行中」的作品 ——
// 名字和一句话可以公开，但不给详情链接，所以不收进本包（收进来模型就会照抄路径）。
// 它的一句话介绍手写在 chat.ts 的 SYSTEM 里；作品目录里那件的简介还是占位文字，
// 别拿来当公开介绍。chat.ts 注入前还会对每一行做禁词过滤（口径真源只在 chat.ts 一处）。
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