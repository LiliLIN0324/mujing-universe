# 新增作品逐项核对清单

交付前逐项打勾；任何一项「待确认」都要在交付报告里单列。

## A. 数据条目（src/content/works/<slug>.json）

- [ ] 文件名 = slug = 路由，全小写连字符，不与现有条目冲突
- [ ] schema 必填字段齐全（slug/title/category/year/yearNum/line/status/description/abstract/challenge/solution/tech/images/icon/hasDemo/flags/source/sourceFile）
- [ ] `line` 是五个枚举值之一（数字艺术/智能体/产品/游戏/空间）
- [ ] 取不到的真实信息留 `""` 或 `[]`，并在报告标「待确认」，未编造
- [ ] `demo`/`repo`/`link` 是 http(s) 完整 URL，或干脆不写该字段

## B. 署名

- [ ] `by` 取值在取值表内（缺省=lin 林丽丽 / `ding` 丁科智 / `collab` 林丽丽×丁科智合作 / `yaohao` 吴耀好 / 新作者小写标识），`credit` 与取值表写法逐字一致
- [ ] 丁科智（= 丁 = 终树 = 科智 = endTree）作品：`by: "ding"` + `credit: "丁科智 endTree"`，复用既有 `endtree/` 目录，未另开目录、未出现第二种署名写法
- [ ] 合作项目：`by: "collab"` + `credit: "林丽丽 Lili Lin × 丁科智 endTree"`
- [ ] `abstract` 分工句：已有条目保持原样不动；新增条目默认不写，除非用户当次明确要求
- [ ] 外部作者署名不含「幕景宇宙」及无关人员名字

## C. 资源（R2）

- [ ] 静帧按 `01.jpg…NN.jpg` 两位补零命名，logo 用 `logo.jpg/png`
- [ ] 自研作品走 `fig/<slug>/` 简写；**新合作者已在 R2 建同级作者目录**（与 endtree/、yaohao/ 同级），JSON 写全 URL
- [ ] 素材未到位时槽位已按约定文件名预留，构建不因 404 失败
- [ ] 有封面视频时已用 Range 请求核实（206 + video/mp4），再登记进 `lib.ts` 的 `COVER_CLIP`
- [ ] 进 `HOME_PICKS` 的作品已跑 `node scripts/optimize-home-covers.mjs` 并回写 `src/data/home-covers.json`；不进首页的作品不跑

## D. Demo 回退

- [ ] 本地手动验证过 demo URL 可打开
- [ ] 不可内嵌的域名已补进 `DemoEmbed.astro` 的 `isExternal` 正则
- [ ] 回退态（封面 + 在新标签打开）本地看过，不是空白黑框

## E. 构建与预览

- [ ] `npm run build` 通过（含 check-fonts prebuild）
- [ ] `npm run preview`（127.0.0.1:4471）看过：作品列表页卡片/筛选、新作品详情页、Demo 区块或回退态
- [ ] 若动了公共组件（DemoEmbed/lib.ts），抽查至少一个既有作品详情页无回归
- [ ] 引用 public/ 下嵌套页面时写的是完整 `…/index.html` 路径

## F. 交付

- [ ] 预览效果已报告用户，获得明确 push 口令
- [ ] 只提交本次相关文件，工作区其他改动保持原样
- [ ] 推 main、不强推；报告提交链接与「待确认」清单
