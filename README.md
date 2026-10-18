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

- `/` 首页（长卷、聆听图景、精选作品、底部合作）
- `/works/` 作品（图录 / 编号索引 / 年表，按创作线筛选）
- `/works/[slug]` 作品详情
- `/artist/` 艺术家
- `/studio/` 工作室
- `/contact/` 合作与经纪
- `/about/` 重定向至工作室
