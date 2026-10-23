const fs = require('fs');
let t = fs.readFileSync('src/pages/about.astro', 'utf8');
// 1) 文案精简
const oldTxt = '首尔大学城市规划硕士，曾获首尔大学优秀外国留学生全额奖学金及生活津贴。';
if (!t.includes(oldTxt)) { console.log('文案没匹配上'); process.exit(1); }
t = t.replace(oldTxt, '首尔大学城市规划全奖硕士生。');
// 2) 肖像列加宽 → 图片更大
t = t.replace(
  '.member { display: grid; grid-template-columns: 260px 1fr; gap: 52px; align-items: start; padding-top: 48px; border-top: 1px solid var(--rule); }',
  '.member { display: grid; grid-template-columns: 360px 1fr; gap: 56px; align-items: start; padding-top: 48px; border-top: 1px solid var(--rule); }',
);
// 3) 介绍文字：栏宽加宽、行距收紧
t = t.replace(
  '.member-info p { font-size: 1rem; color: var(--ink2); line-height: 1.7; max-width: 30em; }',
  '.member-info p { font-size: 1rem; color: var(--ink2); line-height: 1.65; max-width: 44em; }',
);
fs.writeFileSync('src/pages/about.astro', t);
console.log('ok');
