/**
 * 构建前检查：鸡场的美术素材在不在、跟引擎是不是同一份。
 *
 * 为什么要有这个（2026-11-04）：
 *   鸡场的器物图 / 品种表情表**不入本仓**（公开仓，pack.json 里写着「授权条款确认前
 *   请勿公开分发本包美术」）。它们由引擎仓 C:\coop-js 的 `npm run sync:packs` 生成到
 *   public/packs/ 下。**忘了跑这一步，构建照样成功**，但线上器物图和 8 个品种的表情表
 *   会全部 404 —— 静默失败，浏览器控制台才看得到。
 *   所以这里让它**响亮地失败**：构建直接报错，不让坏站发出去。
 *
 * 检查项（全部从 pack.json 里读真相，不硬编码文件名）：
 *   1. public/packs/mujing/ 在，且 pack.json 能 parse
 *   2. 每个品种的表情表精灵图 + 帧表 + 整只图在
 *   3. 每个品种 rig 的每一层 PNG 在
 *   4. 每件器物的图片在
 *   5. src/lib/coop/pack.json 与 public/packs/mujing/pack.json 是同一份
 *      （src/lib/coop/ 下的是引擎副本，public/ 下的是站点运行时用的）
 *   6. src/lib/coop/sprite.svg 在
 *
 * 两种情况要分开看（2026-11-04 加，否则会误伤 Cloudflare 自动构建）：
 *   A. **这个构建压根没有鸡场美术**（public/packs/ 整个目录不存在）
 *      —— 公开仓全新 clone 就是这样：Cloudflare Pages 每个分支自动构建，
 *      从 GitHub 拉代码，美术没入库（授权条款确认前不能公开分发）。
 *      这种构建**不该阻断**（否则站点再也更新不了），但要**大声说出来**：
 *      线上器物图/品种表情表会 404。
 *      判据用 CF_PAGES 环境变量（Cloudflare Pages 构建时给），不是猜。
 *   B. **有鸡场美术但不齐**（目录在、文件缺）—— 同步被中断/被吞。
 *      这才是要抓的静默失败，**直接让构建失败**。
 *
 * 逃逸：SKIP_PACKS_CHECK=1 npm run build   （确实不想要鸡场的构建才用）
 * dev 用：node scripts/check-packs.mjs --warn   （只警告不挡，dev 本来就该能跑）
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const PACK_DIR = path.join(root, 'public', 'packs', 'mujing');
const SRC_COOP = path.join(root, 'src', 'lib', 'coop');
const WARN_ONLY = process.argv.includes('--warn');
/* Cloudflare Pages 构建时给的环境变量（CF_PAGES=1 / CF_PAGES_BRANCH=<分支>）。
   用来区分「公开构建（本来就不该有美术）」和「本地构建（忘了同步）」。 */
const IS_PUBLIC_BUILD = !!(process.env.CF_PAGES || process.env.CF_PAGES_BRANCH);

if (process.env.SKIP_PACKS_CHECK === '1') {
  console.log('⏭  SKIP_PACKS_CHECK=1 → 跳过鸡场素材检查');
  process.exit(0);
}

const missing = [];
const need = (abs, label) => {
  if (!fs.existsSync(abs)) missing.push(label + '  →  ' + path.relative(root, abs).replace(/\\/g, '/'));
};

/* ---- A. 这个构建压根没有鸡场美术 ----
   公开仓全新 clone 就是这样：Cloudflare Pages 每个分支自动构建，从 GitHub 拉代码，
   而鸡场美术不入库（授权条款确认前不得公开分发）。
   这是**正常状态**，不能阻断（否则站点再也更新不了），但必须说清楚线上会 404。 */
if (!fs.existsSync(PACK_DIR)) {
  if (IS_PUBLIC_BUILD) {
    console.log('');
    console.log('ℹ  公开构建：本次构建不含鸡场美术（public/packs/ 不存在）');
    console.log('   原因：鸡场美术不入公开仓（pack.json 授权条款确认前不得公开分发）。');
    console.log('   影响：线上器物图 / 品种表情表 / rig 分层图会 404（鸡本体照常，sprite.svg 已内联进 bundle）。');
    console.log('   本地想要完整鸡场：在引擎仓跑 npm run sync:packs，再本地构建。');
    console.log('');
    process.exit(0);
  }
  console.error('');
  console.error('[fail] 鸡场美术素材整个目录不存在：' + path.relative(root, PACK_DIR).replace(/\\/g, '/'));
  console.error('');
  console.error('  你大概忘了在引擎仓跑：');
  console.error('');
  console.error('      cd C:\\coop-js && npm run sync:packs');
  console.error('');
  console.error('  确实不要鸡场的构建：SKIP_PACKS_CHECK=1 npm run build');
  console.error('');
  process.exit(1);
}

const packPath = path.join(PACK_DIR, 'pack.json');
need(packPath, '鸡场包清单');
if (missing.length) { fail(); process.exit(0); }

let pack;
try {
  pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
} catch (e) {
  console.error(`[fail] pack.json 解析失败：${e.message}`);
  process.exit(1);
}

/** pack.json 里的绝对站内路径 /packs/mujing/xxx → public/packs/mujing/xxx */
const pubFile = (sitePath) => path.join(root, 'public', sitePath.replace(/^\/+/, ''));

/* 1) 表情表精灵图 + 每个品种目录里的帧表与整只图 */
need(path.join(PACK_DIR, 'breeds', 'breeds.json'), '品种元信息');
for (const b of pack.breeds || []) {
  const name = b.name || b.id;
  if (b.expr?.sheet) need(pubFile(b.expr.sheet), `品种「${name}」的表情表精灵图`);
  /* 有些品种有独立的 breeds/<id>/ 目录（帧表 + 整只图），
     有些用共享的根级表情表（如 universe01 用 rig 分层 + 根 expr-sheet.png）——
     目录存在才查里面的文件，不存在不是缺失。 */
  const dir = path.join(PACK_DIR, 'breeds', b.id);
  if (fs.existsSync(dir)) {
    need(path.join(dir, 'expr-sheet.json'), `品种「${name}」的表情帧表`);
    need(path.join(dir, 'full.png'), `品种「${name}」的整只图`);
  }
  /* rig 分层：每一层都得在 */
  if (b.rig?.base) {
    for (const l of b.rig.layers || []) {
      need(path.join(root, 'public', b.rig.base.replace(/^\/+/, ''), l.file), `品种「${name}」的分层 ${l.file}`);
    }
  }
}

/* 2) 器物图 */
for (const [id, d] of Object.entries(pack.decos || {})) {
  if (d.img) need(pubFile(d.img), `器物「${id}」的图`);
}

/* 3) 引擎副本：pack.json 要跟 public 下的是同一份（sync:packs 同步过去的） */
const srcPack = path.join(SRC_COOP, 'pack.json');
need(srcPack, '引擎副本 pack.json（src/lib/coop/）');
need(path.join(SRC_COOP, 'sprite.svg'), '引擎副本 sprite.svg（src/lib/coop/）');
if (!missing.length && fs.existsSync(srcPack)) {
  const a = fs.readFileSync(srcPack, 'utf8').replace(/\r\n/g, '\n').trim();
  const b = fs.readFileSync(packPath, 'utf8').replace(/\r\n/g, '\n').trim();
  if (a !== b) missing.push('src/lib/coop/pack.json 与 public/packs/mujing/pack.json 不是同一份（sync:packs 没跑完？）');
}

if (missing.length) { fail(); process.exit(0); }

function fail() {
  if (WARN_ONLY) {
    console.warn('');
    console.warn(`[warn] 鸡场美术素材不齐（${missing.length} 项），页面上的器物图/品种表情表会 404：`);
    for (const m of missing) console.warn('  · ' + m);
    console.warn('  在引擎仓跑：cd C:\\coop-js && npm run sync:packs');
    console.warn('');
    return;
  }
  console.error('');
  console.error(`[fail] 鸡场美术素材不齐（${missing.length} 项）：`);
  for (const m of missing) console.error('  · ' + m);
  console.error('');
  console.error('  这些素材不入本仓（公开仓，授权未确认前不分发本包美术），');
  console.error('  由引擎仓生成。请在引擎仓跑：');
  console.error('');
  console.error('      cd C:\\coop-js && npm run sync:packs');
  console.error('');
  console.error('  再回本站构建。确实不要鸡场的话：SKIP_PACKS_CHECK=1 npm run build');
  console.error('');
  process.exit(1);
}

/* 全套在位：报个数，让人知道构建带上了什么 */
const breedCount = (pack.breeds || []).length;
const decoCount = Object.keys(pack.decos || {}).length;
console.log(`✓ 鸡场素材齐全（${breedCount} 个品种 / ${decoCount} 件器物 / 精灵图与帧表都在）`);
