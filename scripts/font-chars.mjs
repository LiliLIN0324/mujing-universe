/**
 * 站点真正会显示出来的字（不含注释里的字）。
 *
 * 为什么不能直接扫 src/ 的每个字符：
 *   scripts/check-fonts.mjs 扫的是 src/ 下每个文件的每个字符，**注释也算**。
 *   而补字要靠 scripts/subset-fonts.py（需要 Python + fonttools）——
 *   本机有，Cloudflare 的构建镜像里没有。于是一个只写在注释里的生僻字，
 *   就能把整个站点的部署打挂：2026-11-07 PR #127 就是这么挂的
 *   （注释里一个「掐」字 → prebuild exit 1 → Cloudflare 构建失败）。
 *
 * 所以这里按文件类型把注释剥掉，只留会渲染出来的内容：
 *   .astro  HTML 注释 + frontmatter/script 里的 JS 注释 + Astro 的花括号块注释
 *   .js/.mjs/.ts  JS 注释（认字符串和正则字面量，不会把 URL 的 // 当注释）
 *   .css   块注释
 *   .json  JSON 没有注释，原样
 *
 * 只减不增：剥注释只可能让集合变小，不会凭空多出字。
 * 保守起见，模板里 { } 内联的 JS 表达式不剥（宁可多收，不可漏收）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');

const EXTS = new Set(['.astro', '.js', '.json', '.ts', '.css', '.mjs']);

/* 正则字面量前面可能是这些关键字：后面跟的 / 是正则，不是除号 */
const REGEX_AFTER_WORD = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'case', 'do', 'else', 'yield', 'await', 'throw',
]);

const isWordChar = (c) => /[A-Za-z0-9_$]/.test(c);

function regexAllowed(prev, prevWord) {
  if (!prev) return true;
  if (prevWord && REGEX_AFTER_WORD.has(prevWord)) return true;
  if (/[A-Za-z0-9_$]/.test(prev)) return false;   // 标识符/数字后面是除号
  if (prev === ')' || prev === ']') return false;
  return true;
}

/** 剥掉 JS 注释：认字符串（含模板串）与正则字面量，避免把 URL 的 // 当注释起点 */
export function stripJsComments(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  let prev = '';       // 上一个有效字符
  let prevWord = '';   // 上一个标识符/关键字

  while (i < n) {
    const c = src[i];
    const c2 = src.slice(i, i + 2);

    if (c2 === '//') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c2 === '/*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      out.push(c); i++;
      while (i < n) {
        if (src[i] === '\\') { out.push(src[i], src[i + 1] || ''); i += 2; continue; }
        out.push(src[i]);
        if (src[i] === q) { i++; break; }
        i++;
      }
      prev = q; prevWord = '';
      continue;
    }

    if (c === '/' && regexAllowed(prev, prevWord)) {
      out.push(c); i++;
      let inClass = false;
      while (i < n) {
        if (src[i] === '\\') { out.push(src[i], src[i + 1] || ''); i += 2; continue; }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        else if (src[i] === '/' && !inClass) { out.push('/'); i++; break; }
        else if (src[i] === '\n') break;         // 没闭合，当普通字符处理
        out.push(src[i]); i++;
      }
      prev = '/'; prevWord = '';
      continue;
    }

    if (isWordChar(c)) {
      let j = i;
      while (j < n && isWordChar(src[j])) j++;
      const word = src.slice(i, j);
      out.push(word); i = j;
      prev = word[word.length - 1]; prevWord = word;
      continue;
    }

    out.push(c); i++;
    if (!/\s/.test(c)) { prev = c; prevWord = ''; }
  }
  return out.join('');
}

export function stripCssComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

export function stripAstro(src) {
  let out = src.replace(/<!--[\s\S]*?-->/g, ' ');        // HTML 注释
  out = out.replace(/^---\r?\n([\s\S]*?)\r?\n---/, (m, fm) => ' ' + stripJsComments(fm) + ' ');
  out = out.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (m, code) => ' ' + stripJsComments(code) + ' ');
  out = out.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');        // Astro 模板注释
  return out;
}

/** 去掉某个文件里的注释 */
export function stripComments(file, src) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.astro') return stripAstro(src);
  if (ext === '.css') return stripCssComments(src);
  if (ext === '.js' || ext === '.mjs' || ext === '.ts') return stripJsComments(src);
  return src;   // .json 没有注释
}

/** 站点会渲染出来的字符集合 */
export function renderedChars(root = ROOT) {
  const srcDir = path.join(root, 'src');
  const chars = new Set();
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      const stat = fs.statSync(file);
      if (stat.isDirectory()) walk(file);
      else if (EXTS.has(path.extname(name))) {
        const raw = fs.readFileSync(file, 'utf8');
        for (const c of stripComments(file, raw)) chars.add(c);
      }
    }
  };
  walk(srcDir);
  for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
  for (const c of '（）《》「」『』·—…！？：；、，。％℃①②③④⑤⑥⑦⑧⑨⑩×÷±→←↑↓') chars.add(c);
  chars.delete('\n'); chars.delete('\r'); chars.delete('\t');
  return chars;
}

/* 命令行：node scripts/font-chars.mjs            → 人类可读的统计
 *         node scripts/font-chars.mjs --json     → JSON 字符数组（给 subset-fonts.py 用） */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const chars = renderedChars();
  const arr = [...chars].sort();
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(arr.join('')));
  } else {
    console.log(`会渲染的字符数：${chars.size}`);
    console.log(arr.join(''));
  }
}
