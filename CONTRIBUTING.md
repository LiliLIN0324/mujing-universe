# 贡献与自动化约定（幕景宇宙官网）

本仓库由「人 + agent」共同维护。规则目的：**每个改动都可追溯、可评审、可回滚**。

## 三条硬规则

1. **main 必须走 PR**：任何改动（人、Renovate、superagent、其他 agent）都只能开 PR。
2. **合并权始终在人**：Renovate `automerge=false`；superagent/agent 只开 PR 不合并。
3. **没有证据就不算完成**：说"构建通过"要给 `npm run build` 的真实输出。

## 本项目特有的坑（踩过的）

- **字体子集**：`npm run build` 的 `prebuild` 会检查 `src/` 用字是否都在 `scripts/font-charset.json` 里。新增汉字后若子集没跟上，**在没装 Python + fonttools 的环境会直接构建失败**（Cloudflare 上会红）。修法：本地装 `fonttools` 后跑 `npm run fonts`，把 `public/fonts/*.woff2` 与 `font-charset.json` 一并提交（参考 PR #108）。
- **换行符**：重新生成字体时脚本会把文本文件重写成 LF；本仓部分文件是 CRLF。提交前用 `git diff --stat` 确认没有整文件重写。
- 图片资产走 Cloudflare R2，`/public/` 里只放站点必需的小文件。

## 分支与提交

| 前缀 | 用途 |
|---|---|
| `agent/` | agent 自动创建的工单分支 |
| `feat/` `fix/` `docs/` `chore/` | 人工改动 |

提交信息用约定式提交：`type(scope): 一句话`。

## 部署

Cloudflare Pages 监听 main 自动构建部署；合并即上线。因此**合并前必须本地 `npm run build` 通过**。

## 自动化工具

| 工具 | 职责 | 边界 |
|---|---|---|
| Renovate（Mend Community，LiliLIN0324 账号） | 依赖升级 PR | 不自动合并；主版本需人确认 |
| superagent（本地 WSL） | @提及 → 工单 → PR | 不合并、不直推 main |
