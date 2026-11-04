/**
 * 构建前检查：src 里的每个字是否都在字体子集里。
 * 缺字时自动重跑 subset-fonts.py；Python 不可用才报错，避免站点悄悄用系统字体顶替。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const srcDir = path.join(root, 'src');
const manifestPath = path.join(root, 'scripts', 'font-charset.json');
const EXTS = new Set(['.astro', '.js', '.json', '.ts', '.css', '.mjs']);
const EXTRA = '（）《》「」『』·—…！？：；、，。％℃①②③④⑤⑥⑦⑧⑨⑩×÷±→←↑↓';

function siteChars() {
  const chars = new Set();
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      const stat = fs.statSync(file);
      if (stat.isDirectory()) walk(file);
      else if (EXTS.has(path.extname(name))) {
        for (const c of fs.readFileSync(file, 'utf8')) chars.add(c);
      }
    }
  };
  walk(srcDir);
  for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
  for (const c of EXTRA) chars.add(c);
  chars.delete('\n'); chars.delete('\r'); chars.delete('\t');
  return chars;
}

function missingChars(wanted) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const baked = new Set(manifest.chars);
  return [...wanted].filter((c) => !baked.has(c));
}

const wanted = siteChars();
let missing = missingChars(wanted);

if (missing.length) {
  console.log(`字体子集缺少 ${missing.length} 个新用字：${missing.slice(0, 40).join('')}`);
  try {
    execFileSync('python', [path.join(root, 'scripts', 'subset-fonts.py')], { cwd: root, stdio: 'inherit' });
    missing = missingChars(wanted);
  } catch (e) {
    console.error('自动补字失败（本机需要 Python + fonttools）。请先运行 npm run fonts 再构建。');
    process.exit(1);
  }
  if (missing.length) {
    console.error(`重新生成后仍缺字：${missing.slice(0, 40).join('')}（原字体里可能没有这些字）`);
    process.exit(1);
  }
  console.log('字体已自动补齐');
}
