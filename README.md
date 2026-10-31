# 幕景宇宙 · Mujing Universe

> AIGC 艺术工作室官网 —— 作品、艺术家，与一位能聊作品的 AI 向导「Mimi」。

**线上：<https://mujing-universe.pages.dev>**

| 项 | 说明 |
|---|---|
| 技术栈 | Astro 静态站点，无前端框架运行时 |
| 动态能力 | 页面右下角 AI 对话，跑在 Cloudflare Pages Functions 上 |
| 图片资产 | 托管于 Cloudflare R2，不进仓库 |

---

## 页面

| 路径 | 内容 |
|---|---|
| `/` | 首页：代表作全屏章节，悬停续播预览 |
| `/works/` | 作品全库，按创作线筛选，网格 / 列表切换 |
| `/works/<slug>/` | 单个作品详情，支持页内 Demo |
| `/news/` | 新闻时间轴 |
| `/about/` | 成员与工作室 |
| `/contact/` | 合作（邮件 / 飞书） |
| `/artist`、`/studio` | 经 `_redirects` 跳至 `/about/` |
| `/consult` | 跳至 `/contact/` |

## AI 向导 Mimi

| 项 | 说明 |
|---|---|
| 入口 | 页面右下角，流式对话 |
| 接口 | `functions/api/chat.ts`，Cloudflare Pages Functions |
| 本地调试 | `.dev.vars`（勿提交）配置 `SILICONFLOW_API_KEY` |

## 开源仓库

| 仓库 | 说明 |
|---|---|
| [mujing-universe](https://github.com/LiliLIN0324/mujing-universe) | 本站源码（当前仓库） |
| [Scendance2026](https://github.com/LiliLIN0324/Scendance2026) | Scendance · 3D 活动场景编辑器 |
| [mimi-agent](https://github.com/endtree-FDE/mimi-agent) | Mimi 的开源模板：飞书群内答疑、查资料、记事 |
| [tuijian](https://github.com/wustwyh/tuijian) | 推鉴 · 吴耀好的智能推荐作品 |
| [LiliLIN0324.github.io](https://github.com/LiliLIN0324/LiliLIN0324.github.io) | 林丽丽的个人作品集（多数作品的原始出处） |

## 站外直达

| 作品 | 平台 | 地址 |
|---|---|---|
| 推鉴 | 魔搭 | <https://wyh666a-tuijian.ms.show/> |
| 熟门熟路 | 魔搭 Studio | <https://www.modelscope.cn/studios/endTree26/venue-ahead> |
| 转塘艺讯 | 魔搭 | <https://endtree26-yixun.ms.show> |
| Genshot · AI 视频生成 | 产品官网 | <https://genshot.ai/> |
| Riffle · AI 生成小游戏 | 产品官网 | <https://www.riffle.games/> |
| Scendance · AI 活动布置平台 | 在线 Demo | <https://scendance-scene-planner-ewz.pages.dev> |
| GenStyle · AI 衣橱 | App Store | <https://apps.apple.com/ca/app/genstyle/id6744721458> |
| AnyReal · AI 虚拟影棚 | 在线 Demo | <https://lililin0324.github.io/demos/anyreal.html> |
| Dragon Diffusion · AI 创意画板 | 在线 Demo | <https://lililin0324.github.io/demos/dragon-diffusion.html> |
| 小鸡宇宙 · 小鸡名册 | 在线 Demo | <https://lililin0324.github.io/chicken-universe/%E5%B0%8F%E9%B8%A1%E5%90%8D%E5%86%8C/index.html> |

## 配套技能（Agent Skills）

本站的维护和内容生产沉淀了一套可复用技能，想不起怎么操作时来这里找：

| 技能 | 位置 | 用途 |
|---|---|---|
| `mujing-add-work` | 本机 `~/.trae-cn/skills/` | 新增 / 修改本站作品条目 |
| `product-cards` | 本机 `~/.trae-cn/skills/` | 编号产品介绍图集 |
| [project-image-skill](https://github.com/LiliLIN0324/project-image-skill) | GitHub | 项目配图生成 |
| [web-demo-video-skill](https://github.com/LiliLIN0324/web-demo-video-skill) | GitHub | 网页演示视频生成 |
| [page-slimming-skill](https://github.com/LiliLIN0324/page-slimming-skill) | GitHub | 页面精简瘦身 |
| [dsh-skills](https://github.com/LiliLIN0324/dsh-skills) | GitHub | 技能总库与索引（含以上及更多） |

## 本地开发

| 命令 | 作用 |
|---|---|
| `npm install` | 安装依赖 |
| `npm run dev` | 开发预览 <http://localhost:4471> |
| `npm run build` | 构建，产物在 `dist/` |
| `npm run preview` | 预览构建产物 |
| `npx wrangler pages dev dist --compatibility-date=2025-01-01` | 带 AI 接口的完整本地预览 |

## 内容模型

每个作品是 `src/content/works/` 下的一个 JSON 文件，字段由 [content.config.ts](src/content.config.ts) 校验——新增作品只需加一个 JSON，无需改页面。

| 项 | 规则 |
|---|---|
| 创作线 | `数字艺术 / 智能体 / 产品 / 游戏 / 空间`，写在 `line` 字段，作品页筛选顺序照此 |
| 图片字段 | `images`、`icon` 只写文件名时自动拼为 `fig/<slug>/<文件名>`；写完整 URL 则原样使用 |
| 合作署名 | `by: "collab"`，并在 `credit` 标注双方分工；详情页署名按 `by` 展示 |
| 成员卡片 | 写在 `src/pages/about.astro`，无照片时显示竖排姓名占位框 |

## 字体

| 项 | 说明 |
|---|---|
| 字体 | 阿里巴巴普惠体 3.0（三个字重），自托管于 `public/fonts/`，不依赖外部 CDN |
| 子集 | 仅收站内实际用字（约 1.4 千字，单字重约 170KB） |
| 更新 | 改文案后直接构建；`prebuild` 发现漏字会自动运行 `npm run fonts` 补齐并更新缓存版本号（需本机 Python + fonttools） |

## 图片资产

| 项 | 说明 |
|---|---|
| 存放 | 统一托管在 Cloudflare R2，按作者分目录（`team/` 成员肖像、`news/<id>/` 新闻配图等） |
| 使用 | 维护者用 Wrangler 上传后，页面直接引用其公开地址 |

## 部署

| 项 | 值 |
|---|---|
| 平台 | Cloudflare Pages |
| 构建命令 | `npm run build`，输出目录 `dist` |
| 环境变量 | `SILICONFLOW_API_KEY`（Functions 使用） |
| 安全响应头 | `public/_headers` |

## 目录

| 路径 | 内容 |
|---|---|
| `src/pages/` | 路由 |
| `src/content/works/` | 作品 JSON |
| `src/components/` | 页面组件（含 MimiChat） |
| `functions/api/` | Cloudflare Pages Functions |
| `public/` | `_headers`、`_redirects`、字体、品牌资产 |
| `scripts/` | 字体子集、封面抓取、作品导入 |
