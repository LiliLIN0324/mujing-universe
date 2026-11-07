/**
 * __coopVer 自动算版本（2026-11-07）
 *
 * 为什么要有这个：鸡场素材放在 public/packs/** 下。public 里的文件由 Astro 原样发布，
 * 不会像 src/ 那样被 Vite 加上内容哈希 —— 浏览器和 CDN 只能靠 URL 上的查询串破缓存。
 * 以前这个查询串是**手写常量**（ChickenFarm.astro 里 'site-universe01-r8'）：
 * 换了图忘了改，用户就一直吃旧图（research/farm-features.md 规矩 25/26 的现场教训）。
 * 现在改成构建时按 public/packs/** 的实际内容算哈希 —— 动任何一张图，版本号自动变。
 *
 * 算哪些 / 不算哪些：
 *   算 public/packs/**       ← 运行时浏览器真正会请求的素材（引擎所有 /packs/... 路径都指向它）
 *   不算 src/lib/coop/*.js    ← 由 Vite 打包，Vite 自己带内容哈希，这层不必重复
 *   不算 src/lib/coop/packs/  ← 零引用的旧副本（见引擎 sync-packs.mjs 的注释）
 *
 * 用法（Astro 前台组件里）：
 *   import { coopVer } from '../lib/coop-ver.mjs';
 *   const ver = coopVer({ dev: import.meta.env.DEV });
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const PACKS_REL = path.join('public', 'packs');
const PREFIX = 'site-universe01';

/** 从一个起点往上找，找到带 public/packs 的那一层（构建 cwd 通常就是仓根，但别赌） */
function findRoot(start) {
  let dir = path.resolve(start);
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, PACKS_REL))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return path.resolve(start);
}

/** 递归列出文件（相对路径，统一用 / 分隔） */
function listFiles(dir, base = dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) listFiles(p, base, out);
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

let cached = null;

/**
 * @param {{ root?: string, dev?: boolean }} opts
 *   dev=true 时每次重算（astro dev 每请求都会重算前台组件，改图要立刻生效）；
 *   构建时算一次就够。
 */
export function coopVer(opts = {}) {
  const dev = !!opts.dev;
  if (cached && !dev) return cached;

  const root = findRoot(opts.root || process.cwd());
  const packsDir = path.join(root, PACKS_REL);
  const files = existsSync(packsDir) ? listFiles(packsDir).sort() : [];

  /* 素材目录不见了要显式报出来 —— 悄悄退化成「什么都没变」等于悄悄废掉破缓存 */
  if (!files.length) {
    const v = `${PREFIX}-nopacks`;
    if (!dev) cached = v;
    return v;
  }

  const h = createHash('sha1');
  for (const rel of files) {
    h.update(rel);
    h.update('\0');
    h.update(readFileSync(path.join(packsDir, rel)));
  }
  const v = `${PREFIX}-${h.digest('hex').slice(0, 8)}`;
  if (!dev) cached = v;
  return v;
}

export default coopVer;
