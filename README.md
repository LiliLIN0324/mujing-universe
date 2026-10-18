# 幕景宇宙 · 林丽丽艺术工作室

艺术家林丽丽的 AIGC 文化艺术工作室官网（Astro 5，包名 `mujing-site`）。

视觉系统是「墨夜 Ink Atelier」：深炭黑画布、暖象牙色文字、古董金点缀，朱砂只留在一枚很小的印记上。首页有一段象牙色的声画法则插页，其余页面保持暗色画廊。内容、作品数据与交互沿用原站。

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

- `/` 首页（长卷、聆听图景、精选作品）
- `/works/` 作品（图录 / 编号索引 / 年表，按创作线筛选）
- `/works/[slug]` 作品详情
- `/artist/` 艺术家
- `/studio/` 工作室
- `/contact/` 合作与经纪
- `/about/` 重定向至工作室
