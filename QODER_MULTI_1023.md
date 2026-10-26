# Qoder 多跑任务（DeepSeek · 全部同意 · 不合 main）

## 当前站况（不要推 main）
- 生产 v0.1.1：https://mujing-universe.pages.dev
- PR#59 新闻去重预览；PR#60 Mimi Rive；PR#62 咨询定金页在做
- 视觉：白底 #FFFFFF、直角、少字、瑞士国际主义

## 优先做（按序，能做就做，卡住换下一项）
1. `git fetch` 后从 `origin/main` 开分支 `feat/qoder-polish-1023`。
2. 对照 https://cursor-mimi-rive-094a.mujing-universe.pages.dev ：若 Mimi 头像橙底/背景仍被裁切，在本仓对应组件修到完整显示（角色可圆，外框直角，动效走 Rive 勿 CSS scale）。可 cherry-pick / 参考 origin/cursor/mimi-rive-094a。
3. 对照咨询页 PR 分支 origin/cursor/consult-deposit-f652（若已有）：确保 /consult 有支付宝码、四档 ¥1/9.9/49/99 +「自定义金额（扫码自填）」说明；合作页链到 /consult；直角白底。缺什么补什么。
4. 新闻：合并对照 origin/cursor/news-covers-89d7 与 origin/feat/news-unique-covers 的封面去重思路，保证 image URL 不重复。
5. 页脚社交入口若脏/缺，顺手干净一版。
6. 每完成一块就 commit + push 当前 feature 分支并开/更新 PR；**禁止合 main、禁止推 main**。

## 规则
- 模型用尽 DeepSeek；全部同意 --yolo；中文提交说明。
- 有图才配图；不发明假案例。
