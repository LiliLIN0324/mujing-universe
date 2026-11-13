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

## 图床：作品图在 R2（踩过坑，别再踩）
- 图在 `https://pub-3209bcb7fc36444a914deb0e70ceca92.r2.dev/fig`，**只有真实存在的文件才画得出来**。
  R2 对不存在的对象返回 **404 + `text/html`** → Chrome 的 ORB 直接拦掉，
  **`<img>` 连 error 事件都不触发** → `Base.astro` 里那个 `img[data-r2]` 全局兜底**接不住**，
  结果就是作品页画廊留一格一格空白。
- 所以规矩是：**`src/content/works/*.json` 的 `images` 只列 R2 上真实存在的文件**。
  加图先上传 R2，再把文件名写进 JSON；反过来（先写 JSON 后传）就会留空白格子。
  2026-11-03 已按 R2 实际内容把 15 件作品的 images 从各 100 张裁到 5–44 张。
- 展开规则在 `src/lib.ts` 的 `allWorks()`：写全 URL 照旧；**以 `/` 开头的站内相对路径照旧**
  （`public/` 下的东西，别再拼 R2 前缀——`mimi-agent` 的封面就踩过这个）；
  其它（只写文件名）展开成 `fig/<slug>/<文件>`。
- 体检脚本：`workspace/audit-r2-images.cjs` 全站查 R2 真实存在的文件并输出 `r2-image-audit.json`，
  `workspace/trim-work-images.mjs` 按体检结果裁 JSON（`--apply` 才落盘）。

## 字体子集：src 里出现新用字，构建会直接失败（2026-11-04）
- `npm run build` 前有 prebuild 检查（`scripts/check-fonts.mjs`）：`src/` 里出现的每个字
  都必须已经在字体子集里；缺字就自动重跑 `scripts/subset-fonts.py` 重新生成 woff2，
  **本机没有 Python + fonttools 就直接构建失败**（不是警告，是 exit 1）。
- 任何新增中文内容之后，第一次构建大概率撞这个坑。2026-11-04 合上游后
  鸡场的器物名一次引进 63 个新字（瓷 竹 露 篓 缸 脸 蔫 盹 攒 胶 肤 磁 钉 镜 锁 陶 …）。
- 补字步骤：
  1. `npm install` —— 装 devDependency `@fontpkg/alibaba-pu-hui-ti-3-0`，
     **TTF 源在 `node_modules/@fontpkg/alibaba-pu-hui-ti-3-0/`，之前常没装**，没装就补不了字。
  2. `npm run fonts` —— 需要 Python + `fonttools` + `brotli`；脚本会重生成三个字重的
     woff2，并自动更新 `global.css` 与 `Base.astro` 里的 `?v=` 版本号。
  3. 把 woff2 + `scripts/font-charset.json` + 两处版本号一起提交。
- 字体子集只含 `src/` 里出现过的字；**运行时才生成的文案（聊天回复等）不在源文件里，
  遇到生僻字会回退系统字体**。

### 补字只在「真会显示的字」上做，注释里的字不算（2026-11-07）
- **踩坑现场**：在 `src/layouts/Base.astro` 的注释里写了个「掐」字，PR #127 的
  Cloudflare 预览构建直接失败 —— 因为补字要 `scripts/subset-fonts.py`（Python +
  fonttools），**本机有，Cloudflare 的构建镜像里没有**，于是 prebuild exit 1，
  整个站点发不出去（本批 PR #125/#126/#127 全卡在这）。
- **现在的口径**：`scripts/font-chars.mjs` 负责取字，按文件类型剥掉注释
  （.astro 的 HTML 注释 / frontmatter 与 script 里的 JS 注释 / .js 的 JS 注释 /
  .css 块注释；.json 没注释原样）。**只有真会显示的字才进子集。**
- **为什么不能只按「字是不是新的」处理**：注释里的字进子集 → 改一句注释就得重生成
  三个字重的 woff2 并提交二进制；不进子集 → CI 里补不上字，整个站发不出去。
- **两头都有护栏**：`scripts/test-font-chars.mjs`（13 组用例，已接进 prebuild）断言
  「注释里的字必须被剥掉、渲染用的字必须留着」；`scripts/check-fonts.mjs` 仍然会对
  **界面文案**里缺字硬失败（exit 1），不会悄悄回退系统字体。
- 子集只增不减：`subset-fonts.py` 取 `渲染字 ∪ 已有子集`，不会把历史上烘进去的字删掉。

## 鸡场美术素材：本地有，库里没有（2026-11-04）
- `public/packs/mujing/`（器物图、9 个品种的表情表、universe01 分层图）和
  `src/lib/coop/packs/mujing/` **都不在 git 里**，已在 `.gitignore` 里排除。
  原因：官网仓是**公开仓**，而 `pack.json` 里明写「授权条款（CC BY 4.0 / CC BY-NC）
  确认前请勿公开分发本包美术」——批量新增的美术不能进公开仓。
  （这跟 `public/_preview-portraits/` 立绘不入库是同一个理由。）
- **所以构建/部署前必须在引擎仓跑 `npm run sync:packs`**（`C:\coop-js`），
  它把 `packs/mujing/` 的运行时集合同步到本站 `public/packs/mujing/`，
  并把 `pack.json` 同步到 `src/lib/coop/pack.json`。
  漏了这一步 → 构建出来的站上器物/品种图全 404。
- 代码同步和素材同步是**两条线**：
  `npm run sync:site` 只同步 `src/lib/coop/coop.js`（代码），
  `npm run sync:packs` 同步素材。两个都进 `npm run verify`（在引擎仓跑）。
- `src/lib/coop/coop.js` 是引擎 `src/coop.js` 的逐字副本，**禁手改**。
- **素材不齐现在会拦住构建**（2026-11-04 加）：`prebuild` 跑 `scripts/check-packs.mjs`，
  从 `pack.json` 里读真相，逐个核对表情表精灵图 / 帧表 / 整只图 / rig 分层 / 器物图在不在，
  还核对 `src/lib/coop/pack.json` 与 `public/packs/mujing/pack.json` 是不是同一份。
  缺了就**直接报错让构建失败**，不让坏站悄悄发出去。
  `npm run dev` 用的是 `--warn` 模式（只警告不挡，dev 本来就该能跑）。
  逃逸：`SKIP_PACKS_CHECK=1 npm run build`。
- ⚠️ **但公开构建不能挡死**（2026-11-04 差点把线上搞挂）：
  本站部署在 **Cloudflare Pages，每个分支都自动构建**，从 GitHub 拉代码 ——
  全新 clone 里**没有 `public/packs/`**（美术不入公开仓）。
  所以 `check-packs` 分两种情况：
  - **整个 packs 目录不存在** = 这个构建压根不含鸡场美术（公开构建的正常状态）
    → **不阻断**，只说明「线上器物图/表情表会 404」。用 `CF_PAGES` 环境变量判定，不靠猜。
  - **目录在但内容不齐** = 同步被中断/被吞 → **直接失败**。这才是要抓的静默失败。
  **以后加任何 prebuild 检查，先想一遍：全新 clone 上会不会挂？**
- **既成事实**：线上 `https://mujing-universe.pages.dev/packs/...` 现在**全 404** ——
  鸡场美术从来没上过公开站（授权条款确认前不能公开分发），
  所以访客看到的鸡场是「鸡在、图没有」。要上美术得先解决授权与分发方式（待终树定）。

## 小鸡宇宙的两个东西住哪儿（2026-11-07 定，别再搬）
- **名册住在作品页里**：`/works/chicken-universe/` 的正文之后有一节名册
  （`src/components/Roster.astro`；作品内容里 `roster: true` 才渲染这一节）。
  官网上**没有**独立的 `/roster/` 页了 —— 2026-11-07 撤掉的（PR #129），
  老链接由 `public/_redirects` 301 到作品页。名册里的数字仍由
  `scripts/check-roster.mjs` 跟引擎对账（改一边另一边必须一起改）。
- **纸飞机小游戏只留引擎仓**：`endtree-FDE/coop.js` 的 `src/minigame/flight/`
  （私有仓，官网没接）。终树原话：「暂时放到 github 库里，不要放官网上，因为我们还没改好」。
  官网侧的页面、模块副本、封面都撤了；引擎仓 `scripts/sync-site.mjs` 的 `EXTRA_DIRS`
  也不再搬 minigame —— **别再加回去**，除非终树发话。

## functions/ 目录：Astro 不检查，只有 Cloudflare 会（2026-11-14）
- `functions/api/chat.ts` 是 Cloudflare Pages Function（后端），**`npm run build` 完全不碰它** ——
  那里只在 Cloudflare 上用 esbuild 打包。**Astro 绿 ≠ Cloudflare 绿。**
- 现场：2026-11-14 PR #136 第一次推上去，本地 build 全绿，Cloudflare 构建失败 ——
  手工解 git 冲突时留下一个重复的 `function json` 声明（外层 `{` 没闭合）。
  esbuild 报 "Unexpected export"，本地完全看不出来。
- 已加 `scripts/check-functions.mjs`（接进 `prebuild`）：入口必须导出 `onRequest`、
  括号平衡（抹掉注释/字符串/正则后扫，零误报）、解冲突残留标记；
  Node 支持类型剥离时再完整解析，**不支持就跳过，绝不因环境缺工具把整站构建搞挂**。
- 改 `functions/` 里的代码后，除了 `npm run build`，还要跑 `npm run check:functions`。
- `functions/` 下以 `_` 开头的文件**不是路由**（共享模块放这儿，如 `_mimi-text.js`）。

## 行尾约定（别擅自改）
- **本仓的约定是 CRLF**（上游丽丽一直这么写，全仓 89 个文本文件都是）。
  本机 `core.autocrlf=true`，所以 git 比较时会自动归一，diff 显示的是真实改动量。
- **引擎仓 `C:\coop-js` 相反**：2026-11-04 加了 `.gitattributes`（`* text=auto eol=lf`），
  统一 LF。那里只有 4 个 CRLF 文件，一次性归一化代价小；本仓 89 个，代价大，**先别动**。
- 改本仓文件时**按 HEAD 里的行尾写**（脚本重写 JSON 尤其注意：
  `JSON.stringify(x, null, 2)` 出来是 LF，会让 git diff 变成整文件重写）。
  跨仓拷素材时更要按目标仓的行尾写、比对时归一化再比。

## 已完成
- 精选环 src/scripts/pick-ring.js（WebGL，手机版未改）：旋转环 + 间距/深浅层次/连续拖动惯性吸附/轻悬停；标题是画布下方固定条里的 DOM 文字，淡入淡出；印章移除，声音默认关。已合并 main（#49）。曾试过虚拟弧形方案，被否（压字、丑）。

## 待用户/丽丽审的 PR（别重复做）
- **#136 fix/mimi-reliability**（接在 #135 之上）：Mimi 上游限流时换模型重试并降级、
  站内链接白名单堵假作品链接、提示词事实纪律、回归测试 27 组 + functions/ 自检。
  诊断与分档方案见 `research/mimi-intelligence.md`。
- #135 feat/mimi-knowledge-pack：站点知识包注入 chat（作品/动态自动进 Mimi）+ 默认模型升 Qwen3-32B。
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
