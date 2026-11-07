/**
 * font-chars.mjs 的回归测试：注释里的字不能进集合，渲染的字必须进集合。
 *
 * 为什么两头都要卡：
 *   放松一点 —— 注释里的生僻字会进子集，改一句注释就得重生成字体；
 *                CI（Cloudflare）里没有 fonttools，补不上就直接打挂部署
 *                （2026-11-07 PR #127 就是这么挂的）。
 *   收紧一点 —— 真正显示出来的字被误判成注释，页面上就少字形，
 *                但没有任何报错，只能靠肉眼发现。
 *
 * 用法：node scripts/test-font-chars.mjs（已接进 prebuild）
 */
import { stripComments } from './font-chars.mjs';

const cases = [
  { name: 'JS 行注释', file: 'a.js', src: 'const a = 1; // 掐\nconst b = 2;', keep: [], drop: ['掐'] },
  { name: 'JS 块注释', file: 'a.js', src: '/* 掐 */\nconst a = 1;', keep: [], drop: ['掐'] },
  { name: 'JS 字符串', file: 'a.js', src: 'const a = "掐";', keep: ['掐'], drop: [] },
  { name: 'JS 模板串', file: 'a.js', src: 'const a = `掐 ${x} 露`;', keep: ['掐', '露'], drop: [] },
  { name: 'URL 里的 // 不是注释', file: 'a.js', src: 'const u = "https://x.com/掐";', keep: ['掐'], drop: [] },
  { name: '正则字面量', file: 'a.js', src: 'const re = /掐/g;', keep: ['掐'], drop: [] },
  { name: '正则里的转义斜杠', file: 'a.js', src: 'const re = /a\\/\\/掐/;', keep: ['掐'], drop: [] },
  { name: '除号不是正则', file: 'a.js', src: 'const n = a / b; // 掐\nconst m = "露";', keep: ['露'], drop: ['掐'] },
  { name: 'CSS 块注释', file: 'a.css', src: '/* 掐 */\n.a{content:"露"}', keep: ['露'], drop: ['掐'] },
  { name: 'HTML 注释', file: 'a.astro', src: '<!-- 掐 -->\n<p>露</p>', keep: ['露'], drop: ['掐'] },
  { name: 'astro script 里的 JS 注释', file: 'a.astro', src: '<script>\n// 掐\nconst a = "露";\n</script>', keep: ['露'], drop: ['掐'] },
  { name: 'astro frontmatter 里的注释', file: 'a.astro', src: '---\n// 掐\nconst t = "露";\n---\n<p>x</p>', keep: ['露'], drop: ['掐'] },
  { name: 'JSON 原样（没有注释）', file: 'a.json', src: '{"t":"掐"}', keep: ['掐'], drop: [] },
];

let failed = 0;
for (const c of cases) {
  const out = stripComments(c.file, c.src);
  for (const ch of c.keep) {
    if (!out.includes(ch)) {
      console.error(`✗ ${c.name}：会显示的「${ch}」被误当成注释剥掉了`);
      failed++;
    }
  }
  for (const ch of c.drop) {
    if (out.includes(ch)) {
      console.error(`✗ ${c.name}：注释里的「${ch}」没被剥掉`);
      failed++;
    }
  }
}

if (failed) {
  console.error(`\nfont-chars 取字口径回归：${failed} 项不通过`);
  process.exit(1);
}
console.log(`✓ font-chars 取字口径回归：${cases.length} 组用例全通过`);
