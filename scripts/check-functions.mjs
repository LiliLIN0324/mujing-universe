/**
 * functions/ 目录自检（Cloudflare Pages Functions）。
 *
 * 为什么单独查：Astro 的 build 完全不碰 functions/ —— 那是 Cloudflare Pages
 * Functions 的入口，只在 Cloudflare 上用 esbuild 打包。2026-11-14 就因此踩了坑：
 * 本地 npm run build 全绿，PR 的 Cloudflare 构建却挂了（手工解冲突时留下一个
 * 没闭合的函数声明）。Astro 绿 ≠ Cloudflare 绿。
 *
 * 怎么查（按 Node 能力自动降级，**绝不因为环境缺工具就把整站构建搞挂**）：
 *   1) Node 能直接 import .ts（类型剥离，Node 22.18+ / 23.6+ 默认开）
 *      → 完整解析，能抓出所有语法错
 *   2) 不支持 → 退化成花括号/圆括号平衡扫描（零依赖，任何 Node 都能跑），
 *      至少能抓出「解冲突留下的残缺代码」这类最常见的事故
 *
 * 跑法：node scripts/check-functions.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FN_DIR = path.join(ROOT, 'functions');

/** 收集 functions/ 下的源码文件 */
function collect(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...collect(full));
    else if (/\.(ts|js|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * 抹掉注释、字符串、正则字面量的内容（保留换行以维持行号），只留代码骨架。
 * 认正则字面量的办法跟 scripts/font-chars.mjs 一致：靠前一个有效字符判断 `/` 是除号还是正则开头。
 */
const REGEX_AFTER_WORD = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'case', 'do', 'else', 'yield', 'await', 'throw',
]);

function blankLiterals(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  let prev = '';
  let prevWord = '';
  const blank = (ch) => (ch === '\n' ? '\n' : ' ');

  while (i < n) {
    const c = src[i];
    const c2 = src.slice(i, i + 2);

    if (c2 === '//') { while (i < n && src[i] !== '\n') { out.push(' '); i++; } continue; }
    if (c2 === '/*') {
      i += 2; out.push('  ');
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out.push(blank(src[i])); i++; }
      i += 2; out.push('  ');
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out.push(c); i++;
      while (i < n && src[i] !== q) {
        if (src[i] === '\\') { out.push(blank(src[i])); if (i + 1 < n) { out.push(blank(src[i + 1])); i += 2; } else i++; continue; }
        out.push(blank(src[i])); i++;
      }
      if (i < n) { out.push(q); i++; }
      prev = q; prevWord = '';
      continue;
    }
    // 正则字面量：前面不是标识符/数字/右括号时才算
    const regexAllowed = !prev || REGEX_AFTER_WORD.has(prevWord) || (!/[A-Za-z0-9_$]/.test(prev) && prev !== ')' && prev !== ']');
    if (c === '/' && regexAllowed) {
      out.push(c); i++;
      let inClass = false;
      while (i < n) {
        if (src[i] === '\\') { out.push('  '); i += 2; continue; }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        else if (src[i] === '/' && !inClass) { out.push('/'); i++; break; }
        else if (src[i] === '\n') { out.push('\n'); break; }
        out.push(' '); i++;
      }
      prev = '/'; prevWord = '';
      continue;
    }
    if (/[A-Za-z0-9_$]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
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

/** 括号平衡扫描（在「抹掉字面量」的骨架上跑，零误报） */
function braceBalance(src) {
  const skeleton = blankLiterals(src);
  let i = 0;
  const n = skeleton.length;
  const open = [];
  let line = 1;
  while (i < n) {
    const c = skeleton[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === '{' || c === '(' || c === '[') open.push({ c, line });
    if (c === '}' || c === ')' || c === ']') {
      const want = { '}': '{', ')': '(', ']': '[' }[c];
      const top = open.pop();
      if (!top || top.c !== want) return { ok: false, line, msg: `多出来的 ${c}` };
    }
    i++;
  }
  if (open.length) {
    const top = open[open.length - 1];
    return { ok: false, line: top.line, msg: `第 ${top.line} 行的 ${top.c} 没有闭合` };
  }
  return { ok: true };
}

const problems = [];
const files = collect(FN_DIR);

/* ===== 1) 入口文件必须导出 onRequest ===== */
for (const file of files) {
  const rel = path.relative(FN_DIR, file).split(path.sep).join('/');
  const isEntry = !rel.split('/').some((seg) => seg.startsWith('_')) && !rel.endsWith('_mimi-text.js');
  if (!isEntry) continue;
  const src = fs.readFileSync(file, 'utf8');
  if (!/export\s+(async\s+)?function\s+onRequest\b/.test(src) && !/export\s*\{[^}]*onRequest/.test(src)) {
    problems.push(`${rel}：入口文件没有导出 onRequest，Cloudflare 上会生成一个无效路由`);
  }
}

/* ===== 2) 括号平衡（任何 Node 都能跑） ===== */
for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const src = fs.readFileSync(file, 'utf8');
  const res = braceBalance(src);
  if (!res.ok) problems.push(`${rel}：${res.msg}`);
  // 解冲突残留：手工删标记最容易留下半截代码（2026-11-14 的 Cloudflare 构建失败就是它）
  src.split('\n').forEach((line, i) => {
    if (/^(<{7}|={7}|>{7})(\s|$)/.test(line.trim())) {
      problems.push(`${rel}：第 ${i + 1} 行还留着冲突标记（${line.trim().slice(0, 12)}）`);
    }
  });
}

/* ===== 3) 完整解析（Node 支持类型剥离时才有；不支持就跳过，绝不因此失败） ===== */
let parsed = 0;
let skipped = 0;
for (const file of files) {
  if (!file.endsWith('.ts')) continue;
  try {
    await import(pathToFileURL(file).href);
    parsed += 1;
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    // 「这个 Node 不认识 .ts」= 环境缺能力，不是代码有问题 → 降级跳过
    if (/Unknown file extension|ERR_UNKNOWN_FILE_EXTENSION|was created to turn off|experimental-strip-types/i.test(msg)) {
      skipped += 1;
      continue;
    }
    problems.push(`${path.relative(ROOT, file).split(path.sep).join('/')}：${msg.split('\n')[0]}`);
  }
}

if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  console.error(`\nfunctions/ 自检：${problems.length} 处问题`);
  process.exit(1);
}
console.log(
  `✓ functions/ 自检通过（${files.length} 个文件` +
  (parsed ? `，${parsed} 个完整解析` : '') +
  (skipped ? `，${skipped} 个因 Node 不支持类型剥离只做了括号检查` : '') +
  '）',
);
