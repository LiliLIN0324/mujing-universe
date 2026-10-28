# 幕景宇宙 · Mujing Universe

AIGC 艺术工作室的官网：作品目录、艺术家与工作室介绍，外加一个能聊作品的 AI 向导「Mimi」。

**线上：<https://mujing-universe.pages.dev>**

Astro 静态站点，无前端框架运行时；唯一的动态能力是页面右下角的 AI 对话，跑在 Cloudflare Pages Functions 上。

---

## 页面

| 路径 | 内容 |
|---|---|
| `/` | 首页（代表作全屏章节，悬停预览） |
| `/works/` | 作品全库，按创作线筛选，网格或列表 |
| `/works/<slug>/` | 单个作品 |
| `/news/` | 新闻（浅灰纸色列表） |
| `/about/` | 关于（成员与工作室） |
| `/contact/` | 合作。邮件或飞书 |

`/artist` 与 `/studio` 通过 `_redirects` 跳到 `/about/`。`/consult` 跳到 `/contact/`。

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

创作线分四类：数字艺术、智能体、产品、游戏（另留一档「空间」），写在 `line` 字段里，作品页的筛选顺序也照这个走。

`images` 和 `icon` 可以只写文件名，构建时自动拼成 `fig/<slug>/<文件名>`；写完整网址就原样使用。

成员卡片直接写在 `src/pages/about.astro`，没有照片时显示竖排姓名的占位框。

封面图可用 `scripts/fetch-ring-covers.mjs` 批量抓取；字体自托管在 `public/fonts/`，不依赖外部 CDN。

## 图片与 R2

站点图片不进仓库，统一放在 Cloudflare R2 桶 `lili-assets`，对外用公开地址 `https://pub-3209bcb7fc36444a914deb0e70ceca92.r2.dev/`。

| 前缀 | 放什么 |
|---|---|
| `team/` | 成员肖像：`team/lili-01…07.jpg`、`team/ding.jpg`、`team/wu.jpg` |
| `fig/<slug>/` | 林丽丽的作品图，目录名等于作品 slug（存量，不再新增） |
| `endtree/<slug>/` | 丁科智的作品图（存量，不再新增） |
| `yaohao/<slug>/` | 吴耀好的作品图 |
| `news/<id>/` | 新闻配图，按 01、02 编号 |
| `artist/` | 早期肖像，已由 `team/` 取代，留作备份 |

上传一张新图：

```bash
npx wrangler r2 object put lili-assets/team/wu.jpg --remote --content-type image/jpeg --file=wu.jpg
```

`--remote` 不能省，否则会写进本地模拟的桶。传完先打开公开地址确认能访问，再改页面引用。

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

