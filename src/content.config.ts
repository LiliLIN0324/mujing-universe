import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
const works = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/works' }),
  schema: z.object({
    slug: z.string(), title: z.string(), category: z.string(), year: z.string(), yearNum: z.number(),
    line: z.enum(['数字艺术', '产品', '游戏', '空间']), status: z.string(),
    credit: z.string().optional(),
    description: z.string(), abstract: z.string(), challenge: z.string(), solution: z.string(),
    tech: z.array(z.string()), images: z.array(z.string()), icon: z.string(), hasDemo: z.boolean(),
    flags: z.array(z.string()), source: z.string(), sourceFile: z.string(),
    note: z.string().optional(), link: z.string().optional(),
  }),
});
export const collections = { works };
