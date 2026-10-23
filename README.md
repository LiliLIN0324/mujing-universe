# 幕景宇宙 · 林丽丽艺术工作室

艺术家林丽丽的 AIGC 文化艺术工作室官网（Astro 5，包名 `mujing-site`）。

页面底色是 `#F6F5F3`：大圆角作品图、图下短标题与灰色信息、稀疏顶栏，主按钮是黑底胶囊。中文使用自托管的阿里巴巴普惠体 3.0（Regular / Medium / SemiBold 子集，官方 OSS 返回 403），字体栈是 `"Alibaba PuHuiTi 3.0", "Noto Sans SC", system-ui, sans-serif`。Noto Sans SC 只做回退。英文说明用 Inter。

## 本地运行

```bash
npm install
npm run dev
```

开发服务器：<http://127.0.0.1:4471>

```bash
npm run build
npm run preview
```

## 页面

- `/` 首页（代表作全屏章节，悬停预览；合作在顶栏和页脚，不挡画面）
- `/works/` 作品（全库，按创作线筛选，网格或列表）
- `/works/[slug]` 作品详情
- `/news/` 新闻（浅灰纸色列表，按板块和时间筛）
- `/about/` 关于
- `/contact/` 合作
