# 目标：新闻封面不重复（认真执行）

## 成功标准（全部满足才算完）
1. 打开 `src/data/news.json`，凡有 `image` 的条目，**两两 URL/路径互不相同**。
2. 对照丽丽作品集 https://lililin0324.github.io/#/work ：封面优先从她作品页真实图/本仓库 `public` 与作品素材里选，**不要用同一张图冒充多条新闻**。
3. 同一系列（如热韧性、知识图谱）多条新闻：各用不同帧/不同图；没有第二张就**删掉 image 字段**（有图才配，禁止占位）。
4. 列表页截图或文字核对：肉眼无明显「两张一样」。
5. 背景保持纯白 `#FFFFFF`；详情封面不要过大（已有上限可保留）。
6. 推到当前分支 `feat/news-unique-covers`（可 force 推远程同名或推 origin），**禁止合 main、禁止推 main**。

## 必做步骤
1. 读 `src/data/news.json`，列出所有 image，标出重复或近似重复。
2. 打开丽丽作品集与仓库里 works / public / R2 fig 路径，给每条新闻找互不重复的真实图。
3. 改 json，本地 `npm run build` 能过。
4. 提交说明写清「去重封面 + 丽丽作品集对照」。
5. `git push -u origin feat/news-unique-covers`（或更新 PR 分支）。

## 规则
- 全部同意、直接改、不要问用户。
- 不要发明假图、不要灰底脏效果、不要圆角。
- 中文回复。

## 参考
- 作品集：https://lililin0324.github.io/#/work
- 预览对照：https://cursor-news-covers-89d7.mujing-universe.pages.dev/news/
