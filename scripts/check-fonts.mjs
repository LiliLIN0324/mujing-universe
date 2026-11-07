/**
 * 构建前检查：src 里真正会渲染的每个字是否都在字体子集里。
 * 缺字时自动重跑 subset-fonts.py；Python 不可用才报错，避免站点悄悄用系统字体顶替。
 *
 * 取字口径（2026-11-07 改）：用 scripts/font-chars.mjs，**注释里的字不算**。
 * 以前这里扫的是 src/ 下每个文件的每个字符（连注释一起），而补字要
 * subset-fonts.py（需要 Python + fonttools）—— 本机有，Cloudflare 的构建
 * 镜像里没有。于是一个只写在注释里的生僻字就能把整个站点的部署打挂：
 * 2026-11-07 PR #127 的预览构建就是这么失败的（注释里的一个「掐」字）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { renderedChars } from './font-chars.mjs';

const root = path.resolve(import.meta.dirname, '..');
const manifestPath = path.join(root, 'scripts', 'font-charset.json');

function missingChars(wanted) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const baked = new Set(manifest.chars);
  return [...wanted].filter((c) => !baked.has(c));
}

const wanted = renderedChars(root);
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
