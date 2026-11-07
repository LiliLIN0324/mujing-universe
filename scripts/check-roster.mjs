/**
 * 名册对账（2026-11-07）
 *
 * 名册是**全站唯一一处**把引擎的概率、保底、限定窗口写成数字给用户看的地方
 * （现在住在「小鸡宇宙」作品页 /works/chicken-universe/ 里，不再是独立页面）。
 * 数字本身不是手写的：稀有度和权重来自 pack.json，保底来自引擎副本的常量。
 * 但页面上的**字面量**（PITY_START、weights 兜底值）是人手敲进去的 ——
 * 一边改了另一边没改，页面上的数字就和引擎不一样，而且**没人会发现**：
 * 构建照样绿、页面照样好看，只是概率在骗人。
 *
 * 这个脚本把两边对一遍：改了一边，另一边就红。
 *
 * 对账项：
 *   1. PITY_START —— 名册的字面量 vs 引擎副本 src/lib/coop/coop.js 里的常量
 *   2. weights 兜底值 —— 名册 vs 引擎副本（两边得用同一套兜底）
 *   3. 引擎的抽法还是不是「按品种逐个加权」
 *      （若改成「先抽稀有度档、再在档内平分」，名册的百分比会静默变错 —— 这条防的就是它）
 *   4. 限定窗口的判定式 —— 名册 vs 引擎副本
 *   5. 名册要渲染的每个品种立绘，在 public/ 下真的存在
 *
 * 用法：node scripts/check-roster.mjs [--warn]
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const ENGINE = path.join(root, 'src', 'lib', 'coop', 'coop.js');
const ROSTER = path.join(root, 'src', 'components', 'Roster.astro');
const PACK = path.join(root, 'src', 'lib', 'coop', 'pack.json');
const WARN_ONLY = process.argv.includes('--warn');

const problems = [];
const bad = (m) => problems.push(m);

const engineSrc = fs.readFileSync(ENGINE, 'utf8');
const rosterSrc = fs.readFileSync(ROSTER, 'utf8');
const pack = JSON.parse(fs.readFileSync(PACK, 'utf8'));

/* ---- 1. PITY_START ---- */
const enginePity = engineSrc.match(/const\s+PITY_START\s*=\s*(\d+)/);
const rosterPity = rosterSrc.match(/const\s+PITY_START\s*=\s*(\d+)/);
if (!enginePity) bad('引擎副本里找不到 PITY_START 常量（src/lib/coop/coop.js）');
if (!rosterPity) bad('名册里找不到 PITY_START 字面量（src/components/Roster.astro）');
if (enginePity && rosterPity && enginePity[1] !== rosterPity[1]) {
  bad(`PITY_START 对不上：引擎 ${enginePity[1]} vs 名册 ${rosterPity[1]}`);
}

/* ---- 2. weights 兜底值 ---- */
const grabWeights = (src) => {
  const m = src.match(/weights\s*\|\|\s*\{([^}]*)\}/);
  if (!m) return null;
  const out = {};
  for (const part of m[1].split(',')) {
    const kv = part.match(/(\w+)\s*:\s*(\d+)/);
    if (kv) out[kv[1]] = Number(kv[2]);
  }
  return out;
};
const engineW = grabWeights(engineSrc);
const rosterW = grabWeights(rosterSrc);
if (!engineW) bad('引擎副本里找不到 weights 兜底值');
if (!rosterW) bad('名册里找不到 weights 兜底值');
if (engineW && rosterW && JSON.stringify(engineW) !== JSON.stringify(rosterW)) {
  bad(`weights 兜底值对不上：引擎 ${JSON.stringify(engineW)} vs 名册 ${JSON.stringify(rosterW)}`);
}

/* ---- 3. 引擎的抽法：必须是「按品种逐个加权」 ----
   引擎 pickBreed() 现在是：把池子里每个品种的稀有度权重加进总数，再走一遍累计区间。
   也就是**每个品种各占一份权重**（不是同档平分）。
   名册的百分比就是按这个算的 —— 引擎若改成两段式抽档，页面上的数字会静默变错。 */
if (!/for\s*\(\s*const\s+b\s+of\s+POOL\s*\)\s*total\s*\+=\s*weightOf\(b\.rarity\)/.test(engineSrc)) {
  bad('引擎的 pickBreed() 不再是「按品种逐个加权」了 —— 名册的百分比算法要跟着改（先抽稀有度档的话概率算法完全不同）');
}

/* ---- 4. 限定窗口判定式 ---- */
const seasonExpr = /b\.season\.from\s*<=\s*md\s*&&\s*md\s*<=\s*b\.season\.to/;
if (!seasonExpr.test(engineSrc)) bad('引擎副本里找不到限定窗口判定式（b.season.from <= md && md <= b.season.to）');
if (!seasonExpr.test(rosterSrc)) bad('名册里找不到限定窗口判定式（跟引擎不一致）');

/* ---- 5. 名册要渲染的立绘在不在 ---- */
const breeds = pack.breeds || [];
for (const b of breeds) {
  const base = (b.rig && b.rig.base) || `/packs/mujing/breeds/${b.id}/`;
  const rel = path.join(root, 'public', base.replace(/^\/+/, ''), 'full.png');
  if (!fs.existsSync(rel)) {
    bad(`品种「${b.name || b.id}」的立绘不在：${path.relative(root, rel).replace(/\\/g, '/')}`);
  }
}

if (problems.length) {
  const head = WARN_ONLY ? '[warn] 名册和引擎对不上：' : '[fail] 名册和引擎对不上：';
  console.error('');
  console.error(head);
  for (const p of problems) console.error('  · ' + p);
  console.error('');
  console.error('  名册（作品页里）把这些数字直接给用户看，改了一边另一边必须一起改。');
  console.error('');
  if (!WARN_ONLY) process.exit(1);
} else {
  /* 顺手把真实概率报出来 —— 对账结果比空口说「一致」有用 */
  const weights = pack.weights || rosterW || {};
  const md = (() => {
    const d = new Date();
    return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  })();
  const pool = breeds.filter((b) => !b.season || (b.season.from <= md && md <= b.season.to));
  const total = pool.reduce((s, b) => s + (weights[b.rarity] || 0), 0);
  const rows = pool.map((b) => `${b.name || b.id} ${(((weights[b.rarity] || 0) / total) * 100).toFixed(2)}%`);
  console.log(`✓ 名册与引擎对账通过（${breeds.length} 个品种 / 池内 ${pool.length} 只 / 总权重 ${total}）`);
  console.log('  ' + rows.join(' · '));
}
