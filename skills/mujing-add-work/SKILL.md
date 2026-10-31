---
name: "mujing-add-work"
description: "往幕景宇宙官网（mujing-universe，Astro 站点）新增或修改作品条目时调用：在 src/content/works/ 建 JSON、登记封面视频、处理 R2 图床资源、配置署名与 Demo 回退、调整首页精选。用户说「加个作品」「把 X 加进作品列表」「新增一个智能体」「给站点添一个项目」「给某作品登记封面视频/Demo」时命中。不处理新闻条目（news.json）、关于页、页脚、产品介绍图集生成（那是 product-cards 的活）。"
---

# 幕景宇宙 · 新增/修改作品条目

站点是 Astro 5 + Cloudflare Pages。作品数据全部来自 **Astro content collection**：`src/content/works/<slug>.json`，schema 在 `src/content.config.ts`。新增作品 = 加一个 JSON + 备好 R2 资源 + 按需登记视频/首页精选。**改完必须本地构建预览，用户给口令后才能 push。**

## 一、作品 JSON 字段（schema 为准）

`src/content/works/<slug>.json`，slug 即文件名也是路由 `/works/<slug>/`。

| 字段 | 类型 | 必填 | 含义与写法 |
|---|---|---|---|
| slug | string | 是 | 与文件名一致，小写连字符 |
| title | string | 是 | 中文名；列表页会按 ` - `/`：`/括号 拆主副标题（lib.ts `splitTitle`） |
| category | string | 是 | 自由分类文案，卡片 hover 层显示「category · year」 |
| year | string | 是 | 展示用年份，如 `"2026"` 或 `"2026.10.8 至今"` |
| yearNum | number | 是 | 排序用数字年份 |
| line | enum | 是 | 只能取 `数字艺术 / 智能体 / 产品 / 游戏 / 空间`，决定作品页筛选签与 hover 色板颜色 |
| status | string | 是 | 如 `已上线`、`进行中`、`参赛作品 · 已上线` |
| credit | string | 否 | 署名展示文本，见「三、署名机制」 |
| by | string | 否 | 署名标识，见「三、署名机制」 |
| description | string | 是 | 一句话简介；卡片 hover 层、详情页副题、首页摘要都取它 |
| abstract | string | 是 | 详情页第二段长文；与 description 相同则不渲染 |
| challenge | string | 是 | 挑战（当前详情页不直接渲染，仍按 schema 必填） |
| solution | string | 是 | 方案（同上） |
| tech | string[] | 是 | 技术栈；详情页事实表「技术」行，含「占位」的条目会被过滤 |
| images | string[] | 是 | 静帧图集，见「二、资源约定」 |
| icon | string | 是 | 封面 logo/兜底图，写法同 images |
| hasDemo | boolean | 是 | 是否有体验入口（数据标记） |
| flags | string[] | 是 | 暂无消费者，写 `[]` |
| source | string | 是 | 来源标记，手工条目写 `"manual"` |
| sourceFile | string | 是 | 来源文件名，手工条目写 `"manual"` 或项目名 |
| note | string | 否 | 详情页追加的一段说明文字 |
| link | string | 否 | 相关报道 URL（http 才渲染） |
| repo | string | 否 | 开源仓库 URL，渲染为「GitHub ↗」 |
| demo | string | 否 | 真实可打开的体验地址（http 才渲染），见「四、Demo」 |

缺内容时的留空位写法：字符串写 `""`、数组写 `[]`（schema 均合法，页面自动隐藏对应区块）。**取不到的真实信息留空位并在交付报告里标「待确认」，不要编造。**

## 二、图片与视频资源（R2 图床）

公开基址：`https://pub-3209bcb7fc36444a914deb0e70ceca92.r2.dev/`

- **路径简写**：JSON 里 images/icon 写裸文件名（如 `01.jpg`），构建时在 `src/lib.ts` 的 `allWorks()` 统一展开为 `fig/<slug>/<文件>`；写全 URL 的照旧不展开。
- **目录约定（死规则）**：自研作品放 `fig/<slug>/`；**新出现的外部合作者，必须在 R2 建一个与其他合作者同级的作者目录**存放其作品资源（现状：`endtree/`、`yaohao/`），JSON 里写全 URL，如 `endtree/mimi-agent/01.jpg`、`yaohao/tuijian/01.jpg`。
- **丁科智不是新合作者**：丁科智 = 丁 = 终树 = 科智 = `endTree`，同一个人。他的作品一律用既有 `endtree/` 目录、`by: "ding"`、署名固定「丁科智 endTree」；不得为他另开目录，不得出现第二种署名写法。只有真正新出现的合作者才按上一条开新目录。
- **文件命名**：静帧统一 `01.jpg`、`02.jpg`……两位补零的 jpg；logo 用 `logo.jpg`/`logo.png`；带其他前缀的文件会被忽略（页面只渲染 images/icon 里登记的文件名）。
- **缺失容错**：列表卡 `WorkCover.astro` 在无图时退为排版封面（纯文字卡）；详情页静帧加载失败会被移除，不留破图。素材未到位时 JSON 先按约定文件名预留槽位，构建不会因远程 404 失败。
- **封面视频（悬停/预览 mp4）**：在 `src/lib.ts` 的 `COVER_CLIP` 按 slug 显式登记 URL。**登记前必须发 Range 请求核实（返回 206、Content-Type video/mp4），不按 slug 猜路径**；没核实就不登记，封面保持静图。所有悬停/预览视频默认 `muted`，不预先判断音轨。
- **首页优化封面（进精选必做）**：作品一旦加入 `HOME_PICKS`，必须跑 `node scripts/optimize-home-covers.mjs`——脚本读 `index.astro` 的 HOME_PICKS 名单，出 960/1920（西湖 2560）WebP + 48px 模糊底图，传 R2 `opt/home/`，回写 `src/data/home-covers.json`；`--dry` 只出图看体积不上传。未跑的作品首页自动退回原图，功能正常但首屏会加载多 MB 大图。不进首页的作品不需要跑。该脚本不在 package.json scripts 里，手动执行，需 wrangler 与 R2 凭证。
- 上传管道与凭证：由 Agent 向用户索要 R2 API Token 并在会话内执行上传，不让用户手动设环境变量（详见 product-cards 技能的「上传」节，管道在 `C:\Users\13266\Documents\assets-pipeline\scripts\`）。

## 三、署名机制（by / credit）

- **展示只看 `credit`**：作品列表卡 hover 层（`WorkCard.astro`）有 credit 显示 credit，没有则默认「林丽丽 Lili Lin」。详情页目前不渲染 credit/by。
- **`by` 是标识符**：写在卡片 `data-by` 属性上（当前无样式/脚本消费）。完整取值表（与 `src/content.config.ts` 注释一致）：

| by | 对应的人 | credit 写法 | 在用条目 |
|---|---|---|---|
| 缺省 | 林丽丽 | 缺省，显示「林丽丽 Lili Lin」 | 其余全部作品 |
| `ding` | 丁科智（= 丁 = 终树 = 科智 = endTree） | `丁科智 endTree` | zhuantang-yixun、mimi-agent、venue-ahead |
| `collab` | 林丽丽 × 丁科智合作项目 | `林丽丽 Lili Lin × 丁科智 endTree` | scendance、xihu-panorama、chicken-universe、bmw-meta-island、peace-elite-hust-campus、72-hour-game-jam |
| `yaohao` | 吴耀好 | `吴耀好 Wu Yaohao` | tuijian |
| 新作者 | 新外部合作者 | 只写作者本人，不带幕景宇宙或无关人名 | 新增时取小写标识 |
- **合作项目**：`by: "collab"` + `credit: "林丽丽 Lili Lin × 丁科智 endTree"`。`abstract` 末尾的分工句（小鸡宇宙范式）：**已有条目里存在的保持不动，不回头删；新增条目默认不写**，是否添加以用户当次指示为准（scendance 曾按要求补写后又按要求删除）。
- **丁科智单人项目**：`by: "ding"` + `credit: "丁科智 endTree"`（参照 zhuantang-yixun、mimi-agent）。
- **外部作者项目**：`by: "<作者标识>"` + credit 只写作者本人（如 `吴耀好 Wu Yaohao`），不带幕景宇宙或其他人名字。

## 四、Demo 与加载回退

- `demo` 必须是 http(s) URL，否则详情页不渲染「体验」区块（`[slug].astro` 的 `httpUrl` 过滤）。
- **体验区块进场即加载**（`DemoEmbed.astro`，2026-10 起不再有「打开 Demo」点击按钮），iframe 6 秒无 load → 判定被 X-Frame-Options 拦截 → 自动回退为「封面大图 + 在新标签打开 ↗ + 关闭」。
- **已知不可内嵌的域名**加进 `DemoEmbed.astro` 的 `isExternal` 正则（现状：`apps\.apple\.com|endtree26-yixun|modelscope\.cn`），命中即直接展示回退态，不出空白黑框。新增作品遇到不可内嵌站点，先验证再把域名补进该正则。
- `hasDemo` 只是数据标记，真正控制渲染的是 `demo` 字段。

## 五、排序与首页精选

- **作品列表页**（`/works/`）：`src/lib.ts` 的 `allWorks()` 自动收录全部 JSON。固定前三 `WORKS_PINNED = scendance → xihu-panorama → chicken-universe`；其余按 `yearNum` 倒序 → `WORKS_RANK`（个别置后，如 riffle）→ slug 字典序。新作品一般不用动代码。
- **首页精选**：`src/pages/index.astro` 的 `HOME_PICKS` 固定名单，顺序即轮播顺序；**不在名单里的作品不进首页**。把新作品加进首页属单独决策，需用户明确要求，同时通常要配 `COVER_CLIP` 视频和 `home-covers.json` 优化封面。
- **作品卡片比例**：列表页卡片统一 16:9（`.wf .cv`，与 riffle `01.jpg` 4762×2678 原生比例一致）。

## 六、必知的坑

- **目录式 URL 本地 404**：Astro dev server 对 `public/` 下目录 URL（如 `/works/x/`) 返回 404，本地引用嵌套页面必须写全 `…/index.html`；生产 Cloudflare Pages 会自动映射。
- **详情页视频浮窗**：仅通过右上角 × 关闭，滚回英雄区不自动消失；浮窗有独立声音按钮（`src/scripts/work-detail.js` 动态建 DOM，样式要 `:global`）。
- **全局样式污染**：页脚等全局元素曾被同名 class 污染，新样式用更高优先级选择器或加作用域。
- 作品图片只认 images/icon 字段里登记的条目；R2 目录里多放的文件不会出现在页面上。

## 七、验证与交付

1. `npm run build`（prebuild 会先跑 `scripts/check-fonts.mjs`）。
2. `npm run preview`（127.0.0.1:4471），逐个核对：作品列表页卡片与筛选、新作品详情页、（若进精选）首页轮播、Demo 区块/回退态。
3. 构建/预览确认后向用户报告效果，**得到明确口令才 commit + push**（推 main，不新建分支，不强推；只提交相关文件，不裹挟工作区其他改动）。

## 待确认（代码里读不到、只有口头约定的）

- R2 上传管道的具体脚本与凭证流程：以 product-cards 技能记载为准，执行时向用户索要 Token。

（2026-11-01 已定稿为死规则、不再待确认：新合作者必须开 R2 同级目录；丁科智=endTree 复用 endtree/ 目录与 ding 标识；by 完整取值表见「三」；进 HOME_PICKS 必跑封面优化脚本。）

## 参照

- 逐项核对清单：同目录 [checklist.md](checklist.md)，交付前逐项打勾。
- 字段合法性最终裁决：`src/content.config.ts`；排序/图床展开/视频名单：`src/lib.ts`。
