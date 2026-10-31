import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
const works = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/works' }),
  schema: z.object({
    slug: z.string(), title: z.string(), category: z.string(), year: z.string(), yearNum: z.number(),
    line: z.enum(['数字艺术', '智能体', '产品', '游戏', '空间']), status: z.string(),
    credit: z.string().optional(),
    by: z.string().optional(), // 署名标识（展示文本在 credit 字段）：缺省=lin 林丽丽；ding=丁科智 endTree（同一人：丁/终树/科智/endTree）；collab=林丽丽×丁科智合作项目；yaohao=吴耀好。新作者取小写标识
    description: z.string(), abstract: z.string(), challenge: z.string(), solution: z.string(),
    tech: z.array(z.string()), images: z.array(z.string()), icon: z.string(), hasDemo: z.boolean(),
    flags: z.array(z.string()), source: z.string(), sourceFile: z.string(),
    note: z.string().optional(), link: z.string().optional(),
    repo: z.string().optional(), // 开源模板等真实仓库地址。
    demo: z.string().optional(), // 真实可打开的体验地址。个人站 source 不是 Demo。
  }),
});
export const collections = { works };
