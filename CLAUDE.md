# 幕景宇宙官网 · 给 Claude 的交接说明

## 项目
- 幕景宇宙：终树（丁科智）和艺术家林丽丽在杭州的 AIGC 文化艺术团队，做 AIGC 古画、民乐音画、AI 产品。还没注册公司，对外只称「团队」。
- Astro 5，部署 Cloudflare Pages。线上 https://mujing-universe.pages.dev ，每个分支自动预览：https://<分支名把/换成->.mujing-universe.pages.dev
- 仓库归丽丽，视觉设计由她定。截止：10.23 前出丽丽认可的版本，用于 10.24 观猹大会。

## 工作规则（必须遵守）
- 用中文，简洁，一次只推进一小步（用户有 ADHD）。
- 不直接推 main：新建分支 → PR → 给用户预览链接（他常用手机看）→ 用户/丽丽认可再合并。
- 大的视觉改动先出效果图（多给几个方向），用户选定后再改代码。
- 背景保持浅灰 #F6F5F3，画面干净；不要墨晕、发暗边缘等「脏」效果。
- 不要自动播放；交互都由用户触发，拖动/滚轮/点击/滚动互不冲突，交付前自己测过（含手机）。
- 特效必须服务作品内容、说得清帮访客理解什么；纯装饰（数学特效、六边形、立体砖等）已否决。
- 文案用大家一听就懂的朴素说法，不要生造词。
- 上线、买域名、对外发布前先问用户。

## 已完成
- 精选环 src/scripts/pick-ring.js（WebGL，手机版未改）：旋转环 + 间距/深浅层次/连续拖动惯性吸附/轻悬停；标题是画布下方固定条里的 DOM 文字，淡入淡出；印章移除，声音默认关。已合并 main（#49）。曾试过虚拟弧形方案，被否（压字、丑）。

## 待用户/丽丽审的 PR（别重复做）
- #51 cursor/copy-cleanup：中文标题+英文副标题、错别字、英文详情上加中文摘要、去内部黑话、/services→/contact、/about→/studio（301）。
- #52 cursor/contact-onestep：微信 endTree-26 + 复制按钮（联系页和所有页脚）、二维码位 public/wechat-qr.png（缺文件则隐藏）、「一起合作」页脚。
- cursor/hero-no-autoplay：首页不自动播放，状态待确认。

## 下一步（顺序）
1. 作品库「代表作」：6–8 件精选 + 折叠的全部作品归档（参考 Marshmallow Laser Feast 的 FEATURES / ALL WORKS）。先出效果图给用户看。
2. 手机端：Mimi 头像对话气泡挡文字、作品库筛选行溢出。
3. 详情页结构：概念 → 过程 → 成果（参考 Kimchi and Chips）；署名用 NONOTAK 式「画面：林丽丽 / 声音：丁科智」。
4. 艺术家页。

## 参考资料
- 调研 PDF（11 个参考站：Kimchi and Chips、NONOTAK、徐冰、Sougwen Chung、Refik Anadol、teamLab、UVA、Marshmallow Laser Feast、Pentagram、Studio Dumbar、Moment Factory）已发飞书群给丽丽。
- Mimi 智能体接硅基流动 SiliconFlow，环境变量由丽丽在 Cloudflare 控制台配置。
