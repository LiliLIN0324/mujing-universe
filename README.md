# 幕景宇宙 · Mujing Universe

AIGC 艺术工作室的官网：作品目录、艺术家与工作室介绍，外加一个能聊作品的 AI 向导「Mimi」。

**线上：<https://mujing-universe.pages.dev>**

Astro 静态站点，无前端框架运行时；唯一的动态能力是页面右下角的 AI 对话，跑在 Cloudflare Pages Functions 上。

---

## 页面

| 路径 | 内容 |
|---|---|
| `/` | 首页 |
| `/works/` | 作品列表 |
| `/works/<slug>/` | 单个作品 |
| `/artist/` · `/studio/` | 艺术家与工作室 |
| `/contact/` | 联系方式 |

`/about` 通过 `_redirects` 跳到 `/studio/`。

## AI 向导 Mimi

`functions/api/chat.ts` 是一个流式（SSE）接口，后端调用 SiliconFlow 的 `Qwen/Qwen3-8B`，按 IP 限流。

本地运行对话需要一个 API Key：

```bash
# .dev.vars（不要提交）
SILICONFLOW_API_KEY=sk-...
```

## 本地开发

```bash
npm install
npm run dev        # http://localhost:4471
npm run build      # 产物在 dist/
npm run preview
```

带 AI 接口的本地预览用 Wrangler：

```bash
npx wrangler pages dev dist --compatibility-date=2025-01-01
```

## 作品数据

每个作品是 `src/content/works/` 下的一个 JSON 文件，字段由 `src/content.config.ts` 校验。新增作品＝加一个 JSON，无需改页面。

封面图可用 `scripts/fetch-ring-covers.mjs` 批量抓取；字体自托管在 `public/fonts/`，不依赖外部 CDN。

## 部署

Cloudflare Pages：

- 构建命令 `npm run build`，输出目录 `dist`
- 环境变量 `SILICONFLOW_API_KEY`（Functions 用）
- `public/_headers` 已配置安全响应头

## 目录

```
src/pages/         路由
src/content/works/ 作品 JSON
src/components/    页面组件（含 MimiChat）
functions/api/     Cloudflare Pages Functions
public/            _headers、_redirects、字体、山形装饰
scripts/           封面抓取、作品导入
```
