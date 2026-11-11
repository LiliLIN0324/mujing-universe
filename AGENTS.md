# 幕景宇宙 · Mujing Universe · 项目规范（AI 与人共同必读）

本仓是幕景宇宙（Mujing Universe）的官网：作品、艺术家，与一位能聊作品的 AI 向导「Mimi」。
更细的交接与踩坑记录见 `CLAUDE.md`；贡献与自动化约定见 `CONTRIBUTING.md`。本文件是入口，与两者冲突时以 `CLAUDE.md` 的实测结论为准。

## 一、技术栈

- Astro 5 静态站点，无前端框架运行时
- 动态能力：Cloudflare Pages Functions（`functions/api/chat.ts`），AI 对话走 SiliconFlow
- 图片资产托管在 Cloudflare R2，不进仓库
- 字体：阿里巴巴普惠体 3.0，自托管于 `public/fonts/`，按站内实际用字做子集
- 部署：Cloudflare Pages，`main` 自动构建上线

## 二、目录结构

```
src/pages/          路由
src/content/works/  作品 JSON（每个作品一个文件）
src/components/     页面组件（含 MimiChat）
src/lib/            站点逻辑（如 allWorks() 图片路径展开）
functions/api/      Cloudflare Pages Functions
public/             _headers、_redirects、字体、品牌资产
scripts/            字体子集、封面抓取、作品导入、pack 校验
docs/               设计/内容文档
```

## 三、常用命令（均来自 package.json，不要自造）

```bash
npm install                          # 安装依赖
npm run dev                          # 开发预览 http://localhost:4471
npm run build                        # 构建（prebuild 会跑字体与 pack 校验），产物在 dist/
npm run preview                      # 预览构建产物
npm run check:packs                  # 单独校验鸡场美术包是否完整
npm run fonts                        # 重新生成字体子集（需 Python + fonttools + brotli）
npm run fetch-covers                 # 抓取作品封面
npx wrangler pages dev dist --compatibility-date=2025-01-01   # 带 AI 接口的完整本地预览
```

本地 AI 接口调试用 `.dev.vars` 配 `SILICONFLOW_API_KEY`，该文件不得提交。

## 四、内容与代码风格

- 每个作品是 `src/content/works/` 下的一个 JSON，字段由 `src/content.config.ts` 校验；新增作品只加 JSON，不改页面。
- 创作线固定为 `数字艺术 / 智能体 / 产品 / 游戏 / 空间`，写在 `line` 字段。
- 图片字段 `images` / `icon`：只写文件名时自动拼为 `fig/<slug>/<文件名>`；写完整 URL 原样使用；以 `/` 开头的站内相对路径不拼 R2 前缀。
- **`images` 只列 R2 上真实存在的文件**：先上传 R2，再写进 JSON。R2 对不存在对象返回 404 + `text/html`，`<img>` 不会触发 error，结果就是空白格子。
- 文案用朴素、一听就懂的说法；设计继续保持浅灰 `#F6F5F3` 干净背景，不要墨晕、暗角等「脏」效果。
- 不自动播放；交互由用户触发，拖动/滚轮/点击/滚动互不冲突，交付前自己测（含手机）。
- 特效必须服务作品内容；纯装饰特效不做。
- 行尾约定：本仓是 CRLF，改文件按 HEAD 的行尾写，避免整文件重写。

## 五、提交与 PR 规范

- `main` 必须走 PR：人、Renovate、superagent 或其他 agent 都只能开 PR，不得直推 `main`。
- 合并权始终在人；自动化只把 PR 开到「可评审」为止。
- 分支前缀：agent 用 `agent/`；人工用 `feat/` `fix/` `docs/` `chore/`。
- 提交信息用 Conventional Commits：`type(scope): 一句话`。
- 没有证据就不算完成：说「构建通过」必须贴 `npm run build` 的真实输出；PR 描述写清已验证与未验证的部分。
- 合并即上线，合并前必须本地 `npm run build` 通过。

## 六、禁止事项

- 不 `git add -A`、不强推；推送被拒就报告。
- 不提交 `.dev.vars`、`.env*`、`node_modules`、`dist/`、`.astro/`，或任何密钥。
- 不把鸡场美术包等授权未确认的素材提交进这个公开仓；缺素材时的构建行为由 `scripts/check-packs.mjs` 判定，不要擅自绕过 `SKIP_PACKS_CHECK`。
- 不手改 `src/lib/coop/coop.js`（它是引擎仓的逐字副本）。
- 不伪造构建结果、不把未执行的步骤算作通过。
- 不打 tag、不发 release、不部署，除非人明确要求。
